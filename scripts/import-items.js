/**
 * Scarica tutti gli oggetti da satisfactory-calculator.com/it/items
 * e genera seeds/items.json + immagini in src/renderer/assets/items/
 *
 * Uso: node scripts/import-items.js
 */

const fs = require('fs');
const path = require('path');
const { fetchUrl, fetchBinary } = require('./scim-http');

const SOURCE_URL = 'https://satisfactory-calculator.com/it/items';
const OUTPUT_JSON = path.join(__dirname, '../src/database/seeds/items.json');
const IMAGES_DIR = path.join(__dirname, '../src/renderer/assets/items');
const DATA_VERSION = 2;

/** Slug univoci per categorie con nomi duplicati su SCIM (es. "Minerali" x2) */
const CATEGORY_SLUG_BY_KEY = {
  'Minerali:1': 'minerali',
  'Minerali:2': 'materiali',
  Lingotti: 'lingotti',
  Alieni: 'alieni',
  Liquidi: 'liquidi',
  Benzina: 'gas',
  'Componenti standard': 'componenti-standard',
  'Componenti industriali': 'componenti-industriali',
  'Componenti elettronici': 'componenti-elettronici',
  Comunicazioni: 'comunicazioni',
  'Tecnologia quantistica': 'tecnologia-quantistica',
  Contenitori: 'contenitori',
  Carburante: 'carburante',
  Consumato: 'consumato',
  Munizioni: 'munizioni',
  Nucleare: 'nucleare',
  Rifiuti: 'rifiuti',
  Speciali: 'speciali',
};

function decodeHtml(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\'/g, "'");
}

function gameIdToSlug(gameId) {
  return gameId
    .replace(/^Desc_/, '')
    .replace(/_C$/, '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

function parseItemsPage(html) {
  const categoryCounts = {};
  const categories = [];
  const items = [];
  const categoryIndex = new Map();

  const blocks = html.split('<nav aria-label="breadcrumb">').slice(1);

  for (const block of blocks) {
    const crumbs = [
      ...block.matchAll(/<li class="breadcrumb-item[^>]*>([\s\S]*?)<\/li>/g),
    ];
    if (crumbs.length < 1) continue;

    const categoryName = decodeHtml(
      crumbs[crumbs.length - 1][1].replace(/<[^>]+>/g, '').trim()
    );
    if (!categoryName) continue;

    categoryCounts[categoryName] = (categoryCounts[categoryName] || 0) + 1;
    const catKey =
      categoryCounts[categoryName] > 1
        ? `${categoryName}:${categoryCounts[categoryName]}`
        : categoryName;

    let slug =
      CATEGORY_SLUG_BY_KEY[catKey] ??
      CATEGORY_SLUG_BY_KEY[categoryName] ??
      categoryName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    if (!categoryIndex.has(slug)) {
      categoryIndex.set(slug, categories.length);
      categories.push({
        slug,
        name: categoryName,
        sort_order: categories.length + 1,
      });
    }

    const navEnd = block.indexOf('</nav>');
    const itemRowStart = block.indexOf('<div class="row">', navEnd);
    if (itemRowStart < 0) continue;

    const nextRow = block.indexOf('<div class="row">', itemRowStart + 20);
    const itemSection =
      nextRow > -1 ? block.slice(itemRowStart, nextRow) : block.slice(itemRowStart);

    const itemRegex =
      /<a href="\/it\/items\/detail\/id\/([^"]+)\/name\/[^"]*">\s*<img src="([^"]+)"[^>]*alt="([^"]*)"/g;

    let match;
    while ((match = itemRegex.exec(itemSection)) !== null) {
      const gameId = match[1];
      const imageUrl = match[2].split('?')[0];
      const name = decodeHtml(match[3].trim());

      items.push({
        game_id: gameId,
        slug: gameIdToSlug(gameId),
        name,
        category: slug,
        image_url: imageUrl,
        image: `assets/items/${gameId}.png`,
      });
    }
  }

  return { categories, items };
}

async function downloadImage(url, destPath) {
  if (fs.existsSync(destPath)) return false;
  const data = await fetchBinary(url);
  fs.writeFileSync(destPath, data);
  return true;
}

async function downloadAllImages(items, concurrency = 8) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (item) => {
        const dest = path.join(IMAGES_DIR, `${item.game_id}.png`);
        try {
          const wasNew = await downloadImage(item.image_url, dest);
          if (wasNew) downloaded++;
          else skipped++;
        } catch (err) {
          failed++;
          console.error(`  ✗ ${item.game_id}: ${err.message}`);
        }
      })
    );
    process.stdout.write(`\r  Immagini: ${i + batch.length}/${items.length}`);
  }
  console.log('');
  return { downloaded, skipped, failed };
}

async function main() {
  console.log('Fetching', SOURCE_URL);
  const html = await fetchUrl(SOURCE_URL);

  const { categories, items } = parseItemsPage(html);
  console.log(`Trovati ${categories.length} categorie, ${items.length} oggetti`);

  if (items.length < 100) {
    throw new Error(`Troppi pochi oggetti (${items.length}) — il parser potrebbe essere rotto`);
  }

  console.log('Download immagini...');
  const imgStats = await downloadAllImages(items);

  const payload = {
    dataVersion: DATA_VERSION,
    source: SOURCE_URL,
    importedAt: new Date().toISOString(),
    categories,
    items: items.map(({ image_url, ...rest }) => rest),
  };

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(payload, null, 2));

  console.log('\nImport completato!');
  console.log(`  JSON: ${OUTPUT_JSON}`);
  console.log(`  Immagini: ${IMAGES_DIR}`);
  console.log(`  Scaricate: ${imgStats.downloaded}, già presenti: ${imgStats.skipped}, errori: ${imgStats.failed}`);
  categories.forEach((c) => {
    const count = items.filter((i) => i.category === c.slug).length;
    console.log(`  - ${c.name} (${c.slug}): ${count}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
