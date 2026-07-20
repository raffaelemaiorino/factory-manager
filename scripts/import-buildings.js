/**
 * Scarica strutture da satisfactory-calculator.com/it/buildings
 * e genera seeds/buildings.json + immagini in src/renderer/assets/buildings/
 *
 * Uso: node scripts/import-buildings.js
 */

const fs = require('fs');
const path = require('path');
const { fetchUrl, fetchBinary } = require('./scim-http');
const { buildingIdToSlug } = require('../src/database/seeds/building-slugs');

const SOURCE_URL = 'https://satisfactory-calculator.com/it/buildings';
const OUTPUT_JSON = path.join(__dirname, '../src/database/seeds/buildings.json');
const IMAGES_DIR = path.join(__dirname, '../src/renderer/assets/buildings');
const DATA_VERSION = 1;

const CATEGORY_SLUG_BY_NAME = {
  Estrazione: 'estrazione',
  Produzione: 'produzione',
  Generatori: 'generatori',
  Speciali: 'speciali',
  'Postazioni di lavoro': 'postazioni-di-lavoro',
  Deposito: 'deposito',
  'Stazioni di attracco': 'stazioni-di-attracco',
  Torri: 'torri',
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

function categoryToSlug(name) {
  return (
    CATEGORY_SLUG_BY_NAME[name] ??
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  );
}

function parseBuildingsPage(html) {
  const categories = [];
  const buildings = [];
  const categoryIndex = new Map();

  const blocks = html.split('<nav aria-label="breadcrumb">').slice(1);

  for (const block of blocks) {
    const crumbs = [
      ...block.matchAll(/<li class="breadcrumb-item[^>]*>([\s\S]*?)<\/li>/g),
    ];
    if (!crumbs.length) continue;

    const categoryName = decodeHtml(
      crumbs[crumbs.length - 1][1].replace(/<[^>]+>/g, '').trim()
    );
    if (!categoryName) continue;

    const slug = categoryToSlug(categoryName);
    if (!categoryIndex.has(slug)) {
      categoryIndex.set(slug, categories.length);
      categories.push({
        slug,
        name: categoryName,
        sort_order: categories.length + 1,
      });
    }

    const navEnd = block.indexOf('</nav>');
    const rowStart = block.indexOf('<div class="row">', navEnd);
    if (rowStart < 0) continue;

    const nextRow = block.indexOf('<div class="row">', rowStart + 20);
    const section =
      nextRow > -1 ? block.slice(rowStart, nextRow) : block.slice(rowStart);

    const regex =
      /<a href="\/it\/buildings\/detail\/id\/([^"]+)\/name\/[^"]*">\s*<img src="([^"]+)"[^>]*alt="([^"]*)"/g;

    let match;
    while ((match = regex.exec(section)) !== null) {
      const gameId = match[1];
      const imageUrl = match[2].split('?')[0];
      const name = decodeHtml(match[3].trim());
      const buildingSlug = buildingIdToSlug(gameId);

      buildings.push({
        game_id: gameId,
        slug: buildingSlug,
        name,
        category: slug,
        image_url: imageUrl,
        image: `assets/buildings/${gameId}.png`,
      });
    }
  }

  const bySlug = new Map();
  for (const building of buildings) {
    if (!bySlug.has(building.slug)) {
      bySlug.set(building.slug, building);
    }
  }

  return {
    categories,
    buildings: [...bySlug.values()],
  };
}

async function downloadImage(url, destPath) {
  if (fs.existsSync(destPath)) return false;
  const data = await fetchBinary(url);
  fs.writeFileSync(destPath, data);
  return true;
}

async function downloadAllImages(buildings, concurrency = 8) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < buildings.length; i += concurrency) {
    const batch = buildings.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (building) => {
        const dest = path.join(IMAGES_DIR, `${building.game_id}.png`);
        try {
          const wasNew = await downloadImage(building.image_url, dest);
          if (wasNew) downloaded++;
          else skipped++;
        } catch (err) {
          failed++;
          console.error(`  ✗ ${building.game_id}: ${err.message}`);
        }
      })
    );
    process.stdout.write(`\r  Immagini: ${Math.min(i + batch.length, buildings.length)}/${buildings.length}`);
  }
  console.log('');
  return { downloaded, skipped, failed };
}

async function main() {
  console.log('Fetching', SOURCE_URL);
  const html = await fetchUrl(SOURCE_URL);
  const { categories, buildings } = parseBuildingsPage(html);

  console.log(`Trovati ${categories.length} categorie, ${buildings.length} strutture`);
  if (buildings.length < 10) {
    throw new Error(`Troppo poche strutture (${buildings.length}) — il parser potrebbe essere rotto`);
  }

  console.log('Download immagini...');
  const imgStats = await downloadAllImages(buildings);

  const payload = {
    dataVersion: DATA_VERSION,
    source: SOURCE_URL,
    importedAt: new Date().toISOString(),
    categories,
    buildings: buildings.map(({ image_url, ...rest }) => rest),
  };

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(payload, null, 2));

  console.log('\nImport completato!');
  console.log(`  JSON: ${OUTPUT_JSON}`);
  console.log(`  Immagini: ${IMAGES_DIR}`);
  console.log(
    `  Scaricate: ${imgStats.downloaded}, già presenti: ${imgStats.skipped}, errori: ${imgStats.failed}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
