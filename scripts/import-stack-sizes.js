/**
 * Riesegue lo scrape di stack_size da SCIM e aggiorna items.json + item-details.json.
 *
 * Uso: node scripts/import-stack-sizes.js
 */

const fs = require('fs');
const path = require('path');
const { fetchUrl, buildItemDetailUrl } = require('./scim-http');
const { parseStackSize } = require('./scim-detail-parser');

const ITEMS_JSON = path.join(__dirname, '../src/database/seeds/items.json');
const DETAILS_JSON = path.join(__dirname, '../src/database/seeds/item-details.json');
const REQUEST_DELAY_MS = 250;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const itemsData = JSON.parse(fs.readFileSync(ITEMS_JSON, 'utf8'));
  const detailsData = fs.existsSync(DETAILS_JSON)
    ? JSON.parse(fs.readFileSync(DETAILS_JSON, 'utf8'))
    : { items: [] };

  const detailsByGameId = new Map(detailsData.items.map((item) => [item.game_id, item]));
  const scraped = new Map();
  const changes = [];
  let errors = 0;

  console.log(`Scrape stack_size per ${itemsData.items.length} oggetti...`);

  for (let i = 0; i < itemsData.items.length; i++) {
    const item = itemsData.items[i];
    const url = buildItemDetailUrl(item.game_id, item.name);
    process.stdout.write(`\r[${i + 1}/${itemsData.items.length}] ${item.name}`.padEnd(60));

    try {
      const html = await fetchUrl(url);
      const stackSize = parseStackSize(html, 'it');
      scraped.set(item.game_id, stackSize);

      const prevItems = item.stack_size ?? null;
      const prevDetails = detailsByGameId.get(item.game_id)?.stack_size ?? null;
      if (prevItems !== stackSize || prevDetails !== stackSize) {
        changes.push({
          slug: item.slug,
          name: item.name,
          scraped: stackSize,
          items_json: prevItems,
          details_json: prevDetails,
        });
      }
    } catch (err) {
      errors += 1;
      console.error(`\n  ✗ ${item.slug}: ${err.message}`);
    }

    if (i < itemsData.items.length - 1) await sleep(REQUEST_DELAY_MS);
  }

  console.log('\n');

  const missing = [...scraped.entries()].filter(([, v]) => v == null);
  if (missing.length) {
    console.warn(`Attenzione: ${missing.length} item senza stack_size parsato`);
    for (const [gameId] of missing.slice(0, 20)) {
      const item = itemsData.items.find((i) => i.game_id === gameId);
      console.warn(`  - ${item?.slug ?? gameId}`);
    }
  }

  for (const item of itemsData.items) {
    if (!scraped.has(item.game_id)) continue;
    item.stack_size = scraped.get(item.game_id);
  }

  for (const detail of detailsData.items) {
    if (!scraped.has(detail.game_id)) continue;
    detail.stack_size = scraped.get(detail.game_id);
  }

  itemsData.importedAt = new Date().toISOString();
  detailsData.importedAt = new Date().toISOString();

  fs.writeFileSync(ITEMS_JSON, JSON.stringify(itemsData, null, 2) + '\n');
  fs.writeFileSync(DETAILS_JSON, JSON.stringify(detailsData, null, 2) + '\n');

  const dist = {};
  for (const item of itemsData.items) {
    const key = String(item.stack_size ?? 'null');
    dist[key] = (dist[key] || 0) + 1;
  }

  console.log('Aggiornamento completato');
  console.log(`  Cambiamenti: ${changes.length}`);
  console.log(`  Errori rete/parse: ${errors}`);
  console.log(`  Distribuzione stack_size:`, dist);

  if (changes.length) {
    console.log('\nDiff (primi 80):');
    for (const row of changes.slice(0, 80)) {
      console.log(
        `  ${row.slug}: items ${row.items_json} | details ${row.details_json} → ${row.scraped}`
      );
    }
    if (changes.length > 80) console.log(`  ... +${changes.length - 80} altri`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
