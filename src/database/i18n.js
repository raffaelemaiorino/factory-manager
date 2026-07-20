/**
 * Multilingua catalogo di gioco (item, building, categorie, ricette).
 *
 * Le colonne `name` / `description` sulle tabelle canoniche restano il fallback
 * (oggi italiano). Le traduzioni vivono in *_translations, chiave (entity, locale).
 *
 * I testi UI dell'app non stanno qui: vedi src/locales/ui/.
 */

const { loadAllLocalePacks, listBundledLocales } = require('./seeds/load-translations');
const { SCIM_LOCALES } = require('./seeds/scim-locales');

const DEFAULT_LOCALE = 'it';
const FALLBACK_LOCALES = ['it', 'en'];
const I18N_SEED_VERSION = 4;
const META_LOCALE = 'locale';
const META_I18N_SEED = 'i18n_seed_version';

function queryOne(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryCount(db, table) {
  return queryOne(db, `SELECT COUNT(*) AS count FROM ${table}`)?.count ?? 0;
}

function tableHasColumn(db, table, column) {
  const info = db.exec(`PRAGMA table_info(${table})`)[0]?.values ?? [];
  return info.some((row) => row[1] === column);
}

function tableExists(db, table) {
  return !!queryOne(
    db,
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [table]
  );
}

function ensureAppMetaTable(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function getMeta(db, key) {
  ensureAppMetaTable(db);
  return queryOne(db, 'SELECT value FROM app_meta WHERE key = ?', [key])?.value ?? null;
}

function setMeta(db, key, value) {
  ensureAppMetaTable(db);
  db.run(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, String(value)]
  );
}

function ensureI18nTables(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS locales (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS item_translations (
      item_id INTEGER NOT NULL,
      locale TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      PRIMARY KEY (item_id, locale),
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
      FOREIGN KEY (locale) REFERENCES locales(code)
    );

    CREATE TABLE IF NOT EXISTS building_translations (
      building_id INTEGER NOT NULL,
      locale TEXT NOT NULL,
      name TEXT NOT NULL,
      PRIMARY KEY (building_id, locale),
      FOREIGN KEY (building_id) REFERENCES buildings(id) ON DELETE CASCADE,
      FOREIGN KEY (locale) REFERENCES locales(code)
    );

    CREATE TABLE IF NOT EXISTS item_category_translations (
      category_slug TEXT NOT NULL,
      locale TEXT NOT NULL,
      name TEXT NOT NULL,
      PRIMARY KEY (category_slug, locale),
      FOREIGN KEY (category_slug) REFERENCES item_categories(slug) ON DELETE CASCADE,
      FOREIGN KEY (locale) REFERENCES locales(code)
    );

    CREATE TABLE IF NOT EXISTS building_category_translations (
      category_slug TEXT NOT NULL,
      locale TEXT NOT NULL,
      name TEXT NOT NULL,
      PRIMARY KEY (category_slug, locale),
      FOREIGN KEY (locale) REFERENCES locales(code)
    );

    CREATE TABLE IF NOT EXISTS schema_translations (
      schema_id INTEGER NOT NULL,
      locale TEXT NOT NULL,
      name TEXT NOT NULL,
      PRIMARY KEY (schema_id, locale),
      FOREIGN KEY (schema_id) REFERENCES item_schemas(id) ON DELETE CASCADE,
      FOREIGN KEY (locale) REFERENCES locales(code)
    );
  `);

  seedLocales(db);
}

function seedLocales(db) {
  const locales = SCIM_LOCALES.map((locale) => ({
    code: locale.code,
    name: locale.name,
    is_default: locale.is_default ? 1 : 0,
    sort_order: locale.sort_order,
  }));

  for (const locale of locales) {
    db.run(
      `INSERT INTO locales (code, name, is_default, sort_order) VALUES (?, ?, ?, ?)
       ON CONFLICT(code) DO UPDATE SET
         name = excluded.name,
         is_default = excluded.is_default,
         sort_order = excluded.sort_order`,
      [locale.code, locale.name, locale.is_default, locale.sort_order]
    );
  }
}

function normalizeLocale(locale) {
  if (!locale || typeof locale !== 'string') return DEFAULT_LOCALE;
  const code = locale.trim().toLowerCase().split(/[_-]/)[0];
  return code || DEFAULT_LOCALE;
}

function getAppLocale(db) {
  return normalizeLocale(getMeta(db, META_LOCALE) || DEFAULT_LOCALE);
}

function setAppLocale(db, persist, locale) {
  ensureI18nTables(db);
  const code = normalizeLocale(locale);
  const row = queryOne(db, 'SELECT code FROM locales WHERE code = ?', [code]);
  if (!row) {
    throw new Error(`Locale non supportato: ${code}`);
  }
  setMeta(db, META_LOCALE, code);
  if (persist) persist();
  return code;
}

function listLocales(db) {
  ensureI18nTables(db);
  return queryAll(
    db,
    `SELECT code, name, is_default, sort_order FROM locales ORDER BY sort_order ASC`
  );
}

function pickLocalized(map, locale, fallbackValue = null) {
  if (!map || typeof map !== 'object') return fallbackValue;
  const wanted = normalizeLocale(locale);
  if (map[wanted]) return map[wanted];
  for (const code of FALLBACK_LOCALES) {
    if (map[code]) return map[code];
  }
  const first = Object.values(map).find(Boolean);
  return first ?? fallbackValue;
}

function resolveDisplayName(row, locale, { nameKey = 'name', translationsKey = 'translations' } = {}) {
  if (!row) return null;
  const fromMap = pickLocalized(row[translationsKey], locale);
  if (fromMap) return fromMap;
  return row[nameKey] ?? null;
}

function upsertItemTranslation(db, itemId, locale, { name, description }) {
  if (!itemId || !name) return;
  const code = normalizeLocale(locale);
  db.run(
    `INSERT INTO item_translations (item_id, locale, name, description)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(item_id, locale) DO UPDATE SET
       name = excluded.name,
       description = excluded.description`,
    [itemId, code, name, description ?? null]
  );
}

function upsertBuildingTranslation(db, buildingId, locale, { name }) {
  if (!buildingId || !name) return;
  const code = normalizeLocale(locale);
  db.run(
    `INSERT INTO building_translations (building_id, locale, name)
     VALUES (?, ?, ?)
     ON CONFLICT(building_id, locale) DO UPDATE SET name = excluded.name`,
    [buildingId, code, name]
  );
}

function upsertItemCategoryTranslation(db, categorySlug, locale, { name }) {
  if (!categorySlug || !name) return;
  const code = normalizeLocale(locale);
  db.run(
    `INSERT INTO item_category_translations (category_slug, locale, name)
     VALUES (?, ?, ?)
     ON CONFLICT(category_slug, locale) DO UPDATE SET name = excluded.name`,
    [categorySlug, code, name]
  );
}

function upsertBuildingCategoryTranslation(db, categorySlug, locale, { name }) {
  if (!categorySlug || !name) return;
  const code = normalizeLocale(locale);
  db.run(
    `INSERT INTO building_category_translations (category_slug, locale, name)
     VALUES (?, ?, ?)
     ON CONFLICT(category_slug, locale) DO UPDATE SET name = excluded.name`,
    [categorySlug, code, name]
  );
}

function upsertSchemaTranslation(db, schemaId, locale, { name }) {
  if (!schemaId || !name) return;
  const code = normalizeLocale(locale);
  db.run(
    `INSERT INTO schema_translations (schema_id, locale, name)
     VALUES (?, ?, ?)
     ON CONFLICT(schema_id, locale) DO UPDATE SET name = excluded.name`,
    [schemaId, code, name]
  );
}

/**
 * Scrive tutte le lingue presenti in un oggetto names/descriptions per un item.
 * Accetta anche name/description flat (locale default).
 */
function upsertItemTranslationsFromSeed(db, itemId, item, locale = DEFAULT_LOCALE) {
  const names =
    item.names && typeof item.names === 'object'
      ? item.names
      : { [locale]: item.name };
  const descriptions =
    item.descriptions && typeof item.descriptions === 'object'
      ? item.descriptions
      : item.description != null
        ? { [locale]: item.description }
        : {};

  for (const [code, name] of Object.entries(names)) {
    if (!name) continue;
    upsertItemTranslation(db, itemId, code, {
      name,
      description: descriptions[code] ?? descriptions[locale] ?? item.description ?? null,
    });
  }
}

function upsertBuildingTranslationsFromSeed(db, buildingId, building, locale = DEFAULT_LOCALE) {
  const names =
    building.names && typeof building.names === 'object'
      ? building.names
      : { [locale]: building.name };

  for (const [code, name] of Object.entries(names)) {
    if (!name) continue;
    upsertBuildingTranslation(db, buildingId, code, { name });
  }
}

function upsertCategoryTranslationsFromSeed(db, category, locale = DEFAULT_LOCALE, kind = 'item') {
  const names =
    category.names && typeof category.names === 'object'
      ? category.names
      : { [locale]: category.name };

  const upsert =
    kind === 'building' ? upsertBuildingCategoryTranslation : upsertItemCategoryTranslation;

  for (const [code, name] of Object.entries(names)) {
    if (!name) continue;
    upsert(db, category.slug, code, { name });
  }
}

function upsertSchemaTranslationsFromSeed(db, schemaId, schemaDef, locale = DEFAULT_LOCALE) {
  const names =
    schemaDef.names && typeof schemaDef.names === 'object'
      ? schemaDef.names
      : { [locale]: schemaDef.name };

  for (const [code, name] of Object.entries(names)) {
    if (!name) continue;
    upsertSchemaTranslation(db, schemaId, code, { name });
  }
}

function backfillItalianFromCanonical(db) {
  ensureI18nTables(db);

  if (tableExists(db, 'items')) {
    const hasDescription = tableHasColumn(db, 'items', 'description');
    const items = queryAll(
      db,
      hasDescription
        ? `SELECT id, name, description FROM items WHERE name IS NOT NULL AND TRIM(name) != ''`
        : `SELECT id, name FROM items WHERE name IS NOT NULL AND TRIM(name) != ''`
    );
    for (const item of items) {
      upsertItemTranslation(db, item.id, DEFAULT_LOCALE, {
        name: item.name,
        description: hasDescription ? item.description : null,
      });
    }
  }

  if (tableExists(db, 'buildings')) {
    const buildings = queryAll(
      db,
      `SELECT id, name FROM buildings WHERE name IS NOT NULL AND TRIM(name) != ''`
    );
    for (const building of buildings) {
      upsertBuildingTranslation(db, building.id, DEFAULT_LOCALE, { name: building.name });
    }
  }

  if (tableExists(db, 'item_categories')) {
    const itemCategories = queryAll(
      db,
      `SELECT slug, name FROM item_categories WHERE name IS NOT NULL AND TRIM(name) != ''`
    );
    for (const cat of itemCategories) {
      upsertItemCategoryTranslation(db, cat.slug, DEFAULT_LOCALE, { name: cat.name });
    }
  }

  if (tableExists(db, 'item_schemas')) {
    const schemas = queryAll(
      db,
      `SELECT id, name FROM item_schemas WHERE name IS NOT NULL AND TRIM(name) != ''`
    );
    for (const schema of schemas) {
      upsertSchemaTranslation(db, schema.id, DEFAULT_LOCALE, { name: schema.name });
    }
  }
}

function seedBuildingCategoriesFromSeed(db, categories, locale = DEFAULT_LOCALE) {
  if (!Array.isArray(categories)) return;
  for (const cat of categories) {
    if (!cat?.slug || !cat?.name) continue;
    upsertCategoryTranslationsFromSeed(db, cat, locale, 'building');
  }
}

function schemaFingerprintFromParts({ is_alternative, building_slug, inputs, outputs }) {
  const fmt = (list) =>
    (list || [])
      .map((io) => `${io.item_slug}:${io.amount}:${io.is_fluid ? 1 : 0}`)
      .join('|');
  return [
    is_alternative ? 1 : 0,
    building_slug || '',
    fmt(inputs),
    fmt(outputs),
  ].join('::');
}

function loadSchemaIoForFingerprint(db, schemaId, isOutput) {
  return queryAll(
    db,
    `SELECT item_slug, amount, is_fluid
     FROM schema_io
     WHERE schema_id = ? AND is_output = ?
     ORDER BY slot ASC`,
    [schemaId, isOutput ? 1 : 0]
  );
}

function buildDbSchemaFingerprintMap(db, itemId) {
  const schemas = queryAll(
    db,
    `SELECT id, is_alternative, building_slug, sort_order
     FROM item_schemas
     WHERE item_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [itemId]
  );

  const byFingerprint = new Map();
  const bySortOrder = new Map();

  for (const schema of schemas) {
    const fingerprint = schemaFingerprintFromParts({
      is_alternative: schema.is_alternative,
      building_slug: schema.building_slug,
      inputs: loadSchemaIoForFingerprint(db, schema.id, false),
      outputs: loadSchemaIoForFingerprint(db, schema.id, true),
    });
    byFingerprint.set(fingerprint, schema.id);
    bySortOrder.set(Number(schema.sort_order), schema.id);
  }

  return { byFingerprint, bySortOrder };
}

/**
 * Applica un pack locale (es. seeds/translations/en.json) alle tabelle *_translations.
 */
function applyLocalePack(db, pack) {
  if (!pack?.locale || pack.locale === DEFAULT_LOCALE) {
    return { locale: pack?.locale, applied: false, reason: 'skip_default_or_empty' };
  }

  const locale = normalizeLocale(pack.locale);
  let items = 0;
  let buildings = 0;
  let itemCategories = 0;
  let buildingCategories = 0;
  let schemas = 0;

  for (const [slug, name] of Object.entries(pack.itemCategories || {})) {
    if (!name) continue;
    upsertItemCategoryTranslation(db, slug, locale, { name });
    itemCategories++;
  }

  for (const [slug, name] of Object.entries(pack.buildingCategories || {})) {
    if (!name) continue;
    upsertBuildingCategoryTranslation(db, slug, locale, { name });
    buildingCategories++;
  }

  for (const [gameId, entry] of Object.entries(pack.items || {})) {
    if (!entry?.name) continue;
    const item = queryOne(db, 'SELECT id, name, description FROM items WHERE game_id = ?', [
      gameId,
    ]);
    if (!item) continue;

    upsertItemTranslation(db, item.id, locale, {
      name: entry.name,
      description: entry.description ?? null,
    });
    items++;

    if (!Array.isArray(entry.schemas) || !entry.schemas.length) continue;

    const { byFingerprint, bySortOrder } = buildDbSchemaFingerprintMap(db, item.id);
    for (const schemaDef of entry.schemas) {
      if (!schemaDef?.name) continue;
      const schemaId =
        (schemaDef.fingerprint && byFingerprint.get(schemaDef.fingerprint)) ||
        bySortOrder.get(Number(schemaDef.sort_order));
      if (!schemaId) continue;
      upsertSchemaTranslation(db, schemaId, locale, { name: schemaDef.name });
      schemas++;
    }
  }

  for (const [gameId, entry] of Object.entries(pack.buildings || {})) {
    if (!entry?.name) continue;
    const building = queryOne(db, 'SELECT id FROM buildings WHERE game_id = ?', [gameId]);
    if (!building) continue;
    upsertBuildingTranslation(db, building.id, locale, { name: entry.name });
    buildings++;
  }

  return {
    locale,
    applied: true,
    counts: { items, buildings, itemCategories, buildingCategories, schemas },
  };
}

function applyBundledLocalePacks(db) {
  const packs = loadAllLocalePacks();
  return packs.map((pack) => applyLocalePack(db, pack));
}

/**
 * Assicura tabelle i18n + backfill IT + pack locali bundlati.
 */
function ensureI18n(db, persist, { force = false } = {}) {
  ensureI18nTables(db);

  if (!getMeta(db, META_LOCALE)) {
    setMeta(db, META_LOCALE, DEFAULT_LOCALE);
  }

  const stored = Number(getMeta(db, META_I18N_SEED) || 0);
  const needsBackfill =
    force || stored < I18N_SEED_VERSION || queryCount(db, 'item_translations') === 0;

  const translationLocalesBefore =
    queryOne(
      db,
      `SELECT COUNT(DISTINCT locale) AS count FROM item_translations`
    )?.count ?? 0;

  if (needsBackfill) {
    backfillItalianFromCanonical(db);
  }

  const localeResults = applyBundledLocalePacks(db);

  const translationLocalesAfter =
    queryOne(
      db,
      `SELECT COUNT(DISTINCT locale) AS count FROM item_translations`
    )?.count ?? 0;

  if (
    needsBackfill ||
    force ||
    translationLocalesAfter !== translationLocalesBefore ||
    stored < I18N_SEED_VERSION
  ) {
    setMeta(db, META_I18N_SEED, I18N_SEED_VERSION);
    if (persist) persist();
  }

  return {
    locale: getAppLocale(db),
    seedVersion: I18N_SEED_VERSION,
    counts: getI18nCounts(db),
    bundledLocales: listBundledLocales(),
    localePacks: localeResults,
  };
}

function getI18nCounts(db) {
  ensureI18nTables(db);
  return {
    locales: queryCount(db, 'locales'),
    itemTranslations: queryCount(db, 'item_translations'),
    buildingTranslations: queryCount(db, 'building_translations'),
    itemCategoryTranslations: queryCount(db, 'item_category_translations'),
    buildingCategoryTranslations: queryCount(db, 'building_category_translations'),
    schemaTranslations: queryCount(db, 'schema_translations'),
  };
}

function listAvailableLocales(db) {
  ensureI18nTables(db);
  const catalogLocales = new Set([DEFAULT_LOCALE, ...listBundledLocales()]);
  return listLocales(db).filter((locale) => catalogLocales.has(locale.code));
}

function getI18nInfo(db) {
  ensureI18nTables(db);
  return {
    defaultLocale: DEFAULT_LOCALE,
    activeLocale: getAppLocale(db),
    seedVersion: Number(getMeta(db, META_I18N_SEED) || 0),
    bundledSeedVersion: I18N_SEED_VERSION,
    bundledLocales: listBundledLocales(),
    locales: listLocales(db),
    availableLocales: listAvailableLocales(db),
    counts: getI18nCounts(db),
  };
}

function getItemTranslation(db, itemId, locale = getAppLocale(db)) {
  const code = normalizeLocale(locale);
  return (
    queryOne(
      db,
      `SELECT name, description FROM item_translations WHERE item_id = ? AND locale = ?`,
      [itemId, code]
    ) ||
    queryOne(
      db,
      `SELECT name, description FROM item_translations WHERE item_id = ? AND locale = ?`,
      [itemId, DEFAULT_LOCALE]
    ) ||
    null
  );
}

function getBuildingTranslation(db, buildingId, locale = getAppLocale(db)) {
  const code = normalizeLocale(locale);
  return (
    queryOne(
      db,
      `SELECT name FROM building_translations WHERE building_id = ? AND locale = ?`,
      [buildingId, code]
    ) ||
    queryOne(
      db,
      `SELECT name FROM building_translations WHERE building_id = ? AND locale = ?`,
      [buildingId, DEFAULT_LOCALE]
    ) ||
    null
  );
}

function getSchemaTranslation(db, schemaId, locale = getAppLocale(db)) {
  const code = normalizeLocale(locale);
  return (
    queryOne(
      db,
      `SELECT name FROM schema_translations WHERE schema_id = ? AND locale = ?`,
      [schemaId, code]
    ) ||
    queryOne(
      db,
      `SELECT name FROM schema_translations WHERE schema_id = ? AND locale = ?`,
      [schemaId, DEFAULT_LOCALE]
    ) ||
    null
  );
}

module.exports = {
  DEFAULT_LOCALE,
  FALLBACK_LOCALES,
  I18N_SEED_VERSION,
  ensureI18nTables,
  ensureI18n,
  getAppLocale,
  setAppLocale,
  listLocales,
  listAvailableLocales,
  getI18nInfo,
  getI18nCounts,
  pickLocalized,
  resolveDisplayName,
  upsertItemTranslation,
  upsertBuildingTranslation,
  upsertItemCategoryTranslation,
  upsertBuildingCategoryTranslation,
  upsertSchemaTranslation,
  upsertItemTranslationsFromSeed,
  upsertBuildingTranslationsFromSeed,
  upsertCategoryTranslationsFromSeed,
  upsertSchemaTranslationsFromSeed,
  seedBuildingCategoriesFromSeed,
  backfillItalianFromCanonical,
  applyLocalePack,
  applyBundledLocalePacks,
  getItemTranslation,
  getBuildingTranslation,
  getSchemaTranslation,
};
