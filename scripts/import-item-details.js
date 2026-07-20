/**
 * Scarica metadati e schemi da ogni pagina dettaglio SCIM.
 *
 * Uso:
 *   node scripts/import-item-details.js
 *   node scripts/import-item-details.js --limit 5
 *   node scripts/import-item-details.js --slug cement
 *   node scripts/import-item-details.js --category minerali
 */

const fs = require('fs');
const path = require('path');
const { fetchUrl, buildItemDetailUrl } = require('./scim-http');
const { parseItemDetailPage } = require('./scim-detail-parser');

const ITEMS_JSON = path.join(__dirname, '../src/database/seeds/items.json');
const OUTPUT_JSON = path.join(__dirname, '../src/database/seeds/item-details.json');
const DATA_VERSION = 1;
const REQUEST_DELAY_MS = 250;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadItems(filterSlug, filterCategory, limit) {
  const data = JSON.parse(fs.readFileSync(ITEMS_JSON, 'utf8'));
  let items = data.items;

  if (filterSlug) {
    items = items.filter((item) => item.slug === filterSlug);
  }

  if (filterCategory) {
    items = items.filter((item) => item.category === filterCategory);
  }

  if (limit > 0) {
    items = items.slice(0, limit);
  }

  return items;
}

function buildSlugMap(items) {
  const map = new Map();
  for (const item of items) {
    map.set(item.game_id, item.slug);
  }
  return map;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let limit = 0;
  let slug = null;
  let category = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--slug' && args[i + 1]) {
      slug = args[i + 1];
      i++;
    } else if (args[i] === '--category' && args[i + 1]) {
      category = args[i + 1];
      i++;
    }
  }

  return { limit, slug, category };
}

function mergeItemResults(existingItems, importedItems) {
  const byGameId = new Map(existingItems.map((item) => [item.game_id, item]));

  for (const item of importedItems) {
    byGameId.set(item.game_id, item);
  }

  return Array.from(byGameId.values());
}

async function main() {
  const { limit, slug, category } = parseArgs();
  const allItems = JSON.parse(fs.readFileSync(ITEMS_JSON, 'utf8')).items;
  const slugMap = buildSlugMap(allItems);
  const items = loadItems(slug, category, limit);
  const partialImport = Boolean(slug || category || limit > 0);

  if (!items.length) {
    throw new Error('Nessun item da importare');
  }

  console.log(`Import dettagli per ${items.length} oggetti...`);

  const results = [];
  let errors = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const url = buildItemDetailUrl(item.game_id, item.name);

    process.stdout.write(`\r[${i + 1}/${items.length}] ${item.name}`.padEnd(60));

    try {
      const html = await fetchUrl(url);
      const detail = parseItemDetailPage(html, item.game_id, slugMap);

      results.push({
        game_id: item.game_id,
        slug: item.slug,
        category: item.category,
        description: detail.description || '',
        schemas: detail.schemas,
      });
    } catch (err) {
      errors++;
      console.error(`\n  ✗ ${item.slug}: ${err.message}`);
      results.push({
        game_id: item.game_id,
        slug: item.slug,
        category: item.category,
        description: '',
        schemas: [],
        error: err.message,
      });
    }

    if (i < items.length - 1) await sleep(REQUEST_DELAY_MS);
  }

  console.log('\n');

  let mergedItems = results;
  if (partialImport && fs.existsSync(OUTPUT_JSON)) {
    const existing = JSON.parse(fs.readFileSync(OUTPUT_JSON, 'utf8'));
    mergedItems = mergeItemResults(existing.items, results);
    mergedItems.sort((a, b) => {
      const orderA = allItems.findIndex((item) => item.game_id === a.game_id);
      const orderB = allItems.findIndex((item) => item.game_id === b.game_id);
      return orderA - orderB;
    });
  }

  const payload = {
    dataVersion: DATA_VERSION,
    source: 'https://satisfactory-calculator.com/it/items',
    importedAt: new Date().toISOString(),
    items: mergedItems,
  };

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(payload, null, 2));

  const withSchemas = mergedItems.filter((r) => r.schemas.length > 0).length;
  const totalSchemas = mergedItems.reduce((sum, r) => sum + r.schemas.length, 0);
  const withDesc = mergedItems.filter((r) => r.description).length;

  console.log('Import dettagli completato!');
  console.log(`  Output: ${OUTPUT_JSON}`);
  console.log(`  Oggetti: ${mergedItems.length}`);
  console.log(`  Con descrizione: ${withDesc}`);
  console.log(`  Con schemi: ${withSchemas} (${totalSchemas} ricette totali)`);
  console.log(`  Errori: ${errors}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
