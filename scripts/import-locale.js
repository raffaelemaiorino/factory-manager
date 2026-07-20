/**
 * Import traduzioni catalogo da SCIM per una lingua.
 *
 * Uso:
 *   node scripts/import-locale.js --locale de
 *   node scripts/import-locale.js --locale fr --skip-details
 *   node scripts/import-locale.js --locale en --limit 5
 */

const fs = require('fs');
const path = require('path');
const { fetchUrl, buildItemDetailUrl } = require('./scim-http');
const { parseItemDetailPage } = require('./scim-detail-parser');
const { buildingIdToSlug } = require('../src/database/seeds/building-slugs');
const { isScimLocale } = require('./scim-locales');

const ITEMS_JSON = path.join(__dirname, '../src/database/seeds/items.json');
const BUILDINGS_JSON = path.join(__dirname, '../src/database/seeds/buildings.json');
const TRANSLATIONS_DIR = path.join(__dirname, '../src/database/seeds/translations');
const REQUEST_DELAY_MS = 180;
const DATA_VERSION = 1;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function parseArgs(argv = process.argv.slice(2)) {
  let locale = 'en';
  let limit = 0;
  let skipDetails = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--locale' && argv[i + 1]) {
      locale = argv[i + 1].toLowerCase();
      i++;
    } else if (argv[i] === '--limit' && argv[i + 1]) {
      limit = parseInt(argv[i + 1], 10);
      i++;
    } else if (argv[i] === '--skip-details') {
      skipDetails = true;
    }
  }

  return { locale, limit, skipDetails };
}

/**
 * Estrae item/building dalla pagina lista.
 * Lo slug categoria canonico viene risolto dopo via game_id.
 */
function parseCatalogPage(html, locale, kind) {
  const entries = [];
  const localizedCategoryByGameId = new Map();

  const linkPrefix =
    kind === 'buildings'
      ? `/${locale}/buildings/detail/id/`
      : `/${locale}/items/detail/id/`;
  const slugResolver = kind === 'buildings' ? buildingIdToSlug : gameIdToSlug;

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

    const navEnd = block.indexOf('</nav>');
    const rowStart = block.indexOf('<div class="row">', navEnd);
    if (rowStart < 0) continue;

    const nextRow = block.indexOf('<div class="row">', rowStart + 20);
    const section =
      nextRow > -1 ? block.slice(rowStart, nextRow) : block.slice(rowStart);

    const escaped = linkPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `<a href="${escaped}([^"]+)/name/[^"]*">\\s*<img src="([^"]+)"[^>]*alt="([^"]*)"`,
      'g'
    );

    let match;
    while ((match = regex.exec(section)) !== null) {
      const gameId = match[1];
      const name = decodeHtml(match[3].trim());
      localizedCategoryByGameId.set(gameId, categoryName);
      entries.push({
        game_id: gameId,
        slug: slugResolver(gameId),
        name,
      });
    }
  }

  if (kind === 'buildings') {
    const bySlug = new Map();
    for (const entry of entries) {
      if (!bySlug.has(entry.slug)) bySlug.set(entry.slug, entry);
    }
    return { entries: [...bySlug.values()], localizedCategoryByGameId };
  }

  return { entries, localizedCategoryByGameId };
}

function schemaFingerprint(schema) {
  const fmt = (list) =>
    (list || [])
      .map((io) => `${io.item_slug}:${io.amount}:${io.is_fluid ? 1 : 0}`)
      .join('|');
  return [
    schema.is_alternative ? 1 : 0,
    schema.building_slug || '',
    fmt(schema.inputs),
    fmt(schema.outputs),
  ].join('::');
}

function loadCanonicalMaps() {
  const itemsData = JSON.parse(fs.readFileSync(ITEMS_JSON, 'utf8'));
  const buildingsData = JSON.parse(fs.readFileSync(BUILDINGS_JSON, 'utf8'));
  const itemByGameId = new Map(itemsData.items.map((item) => [item.game_id, item]));
  const buildingByGameId = new Map(
    buildingsData.buildings.map((building) => [building.game_id, building])
  );
  const itemCategoriesMeta = new Map(
    (itemsData.categories || []).map((cat) => [cat.slug, cat])
  );
  const buildingCategoriesMeta = new Map(
    (buildingsData.categories || []).map((cat) => [cat.slug, cat])
  );
  return {
    itemsData,
    buildingsData,
    itemByGameId,
    buildingByGameId,
    itemCategoriesMeta,
    buildingCategoriesMeta,
  };
}

function buildCategoryNameMap(matchedEntries, canonicalByGameId, localizedCategoryByGameId) {
  const votes = new Map();

  for (const entry of matchedEntries) {
    const canonical = canonicalByGameId.get(entry.game_id);
    if (!canonical?.category) continue;
    const localized = localizedCategoryByGameId.get(entry.game_id);
    if (!localized) continue;
    if (!votes.has(canonical.category)) votes.set(canonical.category, new Map());
    const bucket = votes.get(canonical.category);
    bucket.set(localized, (bucket.get(localized) || 0) + 1);
  }

  const result = {};
  for (const [slug, bucket] of votes.entries()) {
    let bestName = null;
    let bestCount = -1;
    for (const [name, count] of bucket.entries()) {
      if (count > bestCount) {
        bestCount = count;
        bestName = name;
      }
    }
    if (bestName) result[slug] = bestName;
  }
  return result;
}

async function importDetails(locale, items, itemByGameId, limit) {
  const slugMap = new Map();
  for (const item of itemByGameId.values()) {
    slugMap.set(item.game_id, item.slug);
  }

  let list = items;
  if (limit > 0) list = list.slice(0, limit);

  const details = {};
  let errors = 0;

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!itemByGameId.has(item.game_id)) continue;

    process.stdout.write(
      `\r  Dettagli [${i + 1}/${list.length}] ${item.name}`.padEnd(70)
    );

    try {
      const url = buildItemDetailUrl(item.game_id, item.name, locale);
      const html = await fetchUrl(url);
      const detail = parseItemDetailPage(html, item.game_id, slugMap, { locale });

      details[item.game_id] = {
        description: detail.description || '',
        schemas: (detail.schemas || []).map((schema) => ({
          name: schema.name,
          is_alternative: schema.is_alternative ? 1 : 0,
          building_slug: schema.building_slug,
          sort_order: schema.sort_order,
          fingerprint: schemaFingerprint(schema),
        })),
      };
    } catch (err) {
      errors++;
      console.error(`\n  ✗ ${item.game_id}: ${err.message}`);
      details[item.game_id] = { description: '', schemas: [], error: err.message };
    }

    if (i < list.length - 1) await sleep(REQUEST_DELAY_MS);
  }

  console.log('');
  return { details, errors };
}

async function importLocale(locale, { limit = 0, skipDetails = false } = {}) {
  if (!isScimLocale(locale)) {
    throw new Error(`Locale SCIM non supportato: ${locale}`);
  }

  const {
    itemByGameId,
    buildingByGameId,
  } = loadCanonicalMaps();

  const itemsUrl = `https://satisfactory-calculator.com/${locale}/items`;
  const buildingsUrl = `https://satisfactory-calculator.com/${locale}/buildings`;

  console.log(`Import locale "${locale}"`);
  console.log('Fetching', itemsUrl);
  const itemsHtml = await fetchUrl(itemsUrl);
  const {
    entries: items,
    localizedCategoryByGameId: itemCatNames,
  } = parseCatalogPage(itemsHtml, locale, 'items');
  console.log(`  Items grezzi: ${items.length}`);

  console.log('Fetching', buildingsUrl);
  const buildingsHtml = await fetchUrl(buildingsUrl);
  const {
    entries: buildings,
    localizedCategoryByGameId: buildingCatNames,
  } = parseCatalogPage(buildingsHtml, locale, 'buildings');
  console.log(`  Buildings grezzi: ${buildings.length}`);

  const matchedItems = items.filter((item) => itemByGameId.has(item.game_id));
  const unmatchedItems = items.filter((item) => !itemByGameId.has(item.game_id));
  const matchedBuildings = buildings.filter((b) => buildingByGameId.has(b.game_id));
  const unmatchedBuildings = buildings.filter((b) => !buildingByGameId.has(b.game_id));

  if (matchedItems.length < 100) {
    throw new Error(`Troppi pochi item allineati (${matchedItems.length})`);
  }

  const itemCategories = buildCategoryNameMap(
    matchedItems,
    itemByGameId,
    itemCatNames
  );
  const buildingCategories = buildCategoryNameMap(
    matchedBuildings,
    buildingByGameId,
    buildingCatNames
  );

  let details = {};
  let detailErrors = 0;
  if (!skipDetails) {
    console.log('Download dettagli item (descrizioni + nomi ricette)...');
    const result = await importDetails(locale, matchedItems, itemByGameId, limit);
    details = result.details;
    detailErrors = result.errors;
  }

  const payload = {
    dataVersion: DATA_VERSION,
    locale,
    source: {
      items: itemsUrl,
      buildings: buildingsUrl,
    },
    importedAt: new Date().toISOString(),
    itemCategories,
    buildingCategories,
    items: Object.fromEntries(
      matchedItems.map((item) => {
        const detail = details[item.game_id] || {};
        const entry = {
          name: item.name,
        };
        if (detail.description) entry.description = detail.description;
        if (detail.schemas?.length) entry.schemas = detail.schemas;
        return [item.game_id, entry];
      })
    ),
    buildings: Object.fromEntries(
      matchedBuildings.map((building) => [building.game_id, { name: building.name }])
    ),
    unmatched: {
      items: unmatchedItems.map((i) => i.game_id),
      buildings: unmatchedBuildings.map((b) => b.game_id),
    },
  };

  fs.mkdirSync(TRANSLATIONS_DIR, { recursive: true });
  const outPath = path.join(TRANSLATIONS_DIR, `${locale}.json`);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));

  const summary = {
    locale,
    outPath,
    items: Object.keys(payload.items).length,
    buildings: Object.keys(payload.buildings).length,
    itemCategories: Object.keys(payload.itemCategories).length,
    buildingCategories: Object.keys(payload.buildingCategories).length,
    withDesc: Object.values(payload.items).filter((i) => i.description).length,
    withSchemas: Object.values(payload.items).filter((i) => i.schemas?.length).length,
    schemaCount: Object.values(payload.items).reduce(
      (sum, i) => sum + (i.schemas?.length || 0),
      0
    ),
    detailErrors,
    unmatchedItems: unmatchedItems.length,
    unmatchedBuildings: unmatchedBuildings.length,
  };

  console.log('\nImport locale completato!');
  console.log(`  Output: ${outPath}`);
  console.log(`  Item: ${summary.items}, building: ${summary.buildings}`);
  console.log(
    `  Categorie item: ${summary.itemCategories}, building: ${summary.buildingCategories}`
  );
  if (!skipDetails) {
    console.log(
      `  Descrizioni: ${summary.withDesc}, ricette: ${summary.withSchemas} (${summary.schemaCount} nomi), errori: ${detailErrors}`
    );
  }

  return summary;
}

async function main() {
  const { locale, limit, skipDetails } = parseArgs();
  await importLocale(locale, { limit, skipDetails });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  importLocale,
  parseArgs,
  parseCatalogPage,
};
