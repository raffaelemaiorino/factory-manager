const { loadSeedData, DATA_VERSION } = require('./seeds/items');
const { ITEM_METADATA_PATCHES } = require('./seeds/item-metadata');
const {
  DEFAULT_LOCALE,
  ensureI18nTables,
  upsertItemTranslationsFromSeed,
  upsertCategoryTranslationsFromSeed,
  upsertItemTranslation,
  getAppLocale,
} = require('./i18n');

/** Oggetti alieni esclusi dalla sezione Risorse */
const EXCLUDED_ITEM_SLUGS = ['alien-protein', 'alien-dnacapsule'];

function excludedSlugsPlaceholders() {
  return EXCLUDED_ITEM_SLUGS.map(() => '?').join(', ');
}

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

function ensureItemColumns(db) {
  const info = db.exec('PRAGMA table_info(items)')[0]?.values ?? [];
  const cols = new Set(info.map((row) => row[1]));

  if (!cols.has('game_id')) {
    db.run('ALTER TABLE items ADD COLUMN game_id TEXT');
  }
  if (!cols.has('image')) {
    db.run('ALTER TABLE items ADD COLUMN image TEXT');
  }
  if (!cols.has('description')) {
    db.run('ALTER TABLE items ADD COLUMN description TEXT');
  }
}

function syncItemMetadata(db, persist, { force = false } = {}) {
  ensureItemColumns(db);
  ensureI18nTables(db);

  for (const patch of ITEM_METADATA_PATCHES) {
    db.run(`UPDATE items SET description = ? WHERE game_id = ?`, [
      patch.description,
      patch.game_id,
    ]);

    const item = queryOne(db, 'SELECT id, name FROM items WHERE game_id = ?', [patch.game_id]);
    if (item) {
      upsertItemTranslation(db, item.id, DEFAULT_LOCALE, {
        name: item.name,
        description: patch.description,
      });
    }
  }

  persist();
  return { patched: ITEM_METADATA_PATCHES.length };
}

function seedItems(db, persist, { force = false } = {}) {
  ensureItemColumns(db);
  ensureI18nTables(db);

  const versionRow = queryOne(db, 'SELECT version FROM schema_version LIMIT 1');
  const currentVersion = versionRow?.version ?? 0;
  const itemCount = db.exec('SELECT COUNT(*) FROM items')[0]?.values[0][0] ?? 0;

  if (!force && currentVersion >= DATA_VERSION && itemCount >= 100) {
    return { seeded: false, count: itemCount };
  }

  const { categories, items } = loadSeedData();

  db.run('BEGIN TRANSACTION');

  try {
    db.run('DELETE FROM item_translations');
    db.run('DELETE FROM item_category_translations');
    db.run('DELETE FROM items');
    db.run('DELETE FROM item_categories');

    for (const cat of categories) {
      db.run(
        `INSERT INTO item_categories (slug, name, sort_order) VALUES (?, ?, ?)`,
        [cat.slug, cat.name, cat.sort_order]
      );
      upsertCategoryTranslationsFromSeed(db, cat, DEFAULT_LOCALE, 'item');
    }

    for (const item of items) {
      db.run(
        `INSERT INTO items (slug, name, category, game_id, image, description) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          item.slug,
          item.name,
          item.category,
          item.game_id,
          item.image,
          item.description ?? null,
        ]
      );
      const itemId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
      upsertItemTranslationsFromSeed(db, itemId, item, DEFAULT_LOCALE);
    }

    if (versionRow) {
      db.run('UPDATE schema_version SET version = ?', [DATA_VERSION]);
    } else {
      db.run('INSERT INTO schema_version (version) VALUES (?)', [DATA_VERSION]);
    }

    db.run('COMMIT');
    persist();
    return { seeded: true, count: items.length };
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }
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

function localizedItemSelect() {
  return `
  i.id, i.slug,
  COALESCE(it.name, i.name) AS name,
  i.category, i.game_id, i.image,
  COALESCE(it.description, i.description) AS description,
  (SELECT COUNT(*) FROM item_schemas s WHERE s.item_id = i.id) AS schema_count
`;
}

function getCategories(db) {
  ensureI18nTables(db);
  const locale = getAppLocale(db);
  const excluded = excludedSlugsPlaceholders();
  return queryAll(
    db,
    `SELECT c.slug, COALESCE(ct.name, c.name) AS name, c.sort_order, COUNT(i.id) AS item_count
     FROM item_categories c
     LEFT JOIN item_category_translations ct
       ON ct.category_slug = c.slug AND ct.locale = ?
     LEFT JOIN items i ON i.category = c.slug AND i.slug NOT IN (${excluded})
     GROUP BY c.id
     HAVING item_count > 0
     ORDER BY c.sort_order ASC`,
    [locale, ...EXCLUDED_ITEM_SLUGS]
  );
}

function getItemsByCategory(db, categorySlug) {
  ensureI18nTables(db);
  const locale = getAppLocale(db);
  const excluded = excludedSlugsPlaceholders();
  return queryAll(
    db,
    `SELECT ${localizedItemSelect()}
     FROM items i
     LEFT JOIN item_translations it ON it.item_id = i.id AND it.locale = ?
     WHERE i.category = ? AND i.slug NOT IN (${excluded})
     ORDER BY COALESCE(it.name, i.name) ASC`,
    [locale, categorySlug, ...EXCLUDED_ITEM_SLUGS]
  );
}

function getAllItemsGrouped(db) {
  const categories = getCategories(db);
  return categories.map((cat) => ({
    ...cat,
    items: getItemsByCategory(db, cat.slug),
  }));
}

function searchItems(db, query) {
  ensureI18nTables(db);
  const locale = getAppLocale(db);
  const term = `%${query.trim()}%`;
  const excluded = excludedSlugsPlaceholders();
  return queryAll(
    db,
    `SELECT ${localizedItemSelect()}, COALESCE(ct.name, c.name) AS category_name
     FROM items i
     JOIN item_categories c ON c.slug = i.category
     LEFT JOIN item_translations it ON it.item_id = i.id AND it.locale = ?
     LEFT JOIN item_category_translations ct
       ON ct.category_slug = c.slug AND ct.locale = ?
     WHERE i.slug NOT IN (${excluded})
       AND (
         COALESCE(it.name, i.name) LIKE ?
         OR i.slug LIKE ?
         OR i.game_id LIKE ?
         OR i.name LIKE ?
       )
     ORDER BY c.sort_order ASC, COALESCE(it.name, i.name) ASC`,
    [locale, locale, ...EXCLUDED_ITEM_SLUGS, term, term, term, term]
  );
}

function getItemById(db, id) {
  ensureI18nTables(db);
  const locale = getAppLocale(db);
  const excluded = excludedSlugsPlaceholders();
  return queryOne(
    db,
    `SELECT ${localizedItemSelect()}, COALESCE(ct.name, c.name) AS category_name
     FROM items i
     JOIN item_categories c ON c.slug = i.category
     LEFT JOIN item_translations it ON it.item_id = i.id AND it.locale = ?
     LEFT JOIN item_category_translations ct
       ON ct.category_slug = c.slug AND ct.locale = ?
     WHERE i.id = ? AND i.slug NOT IN (${excluded})`,
    [locale, locale, id, ...EXCLUDED_ITEM_SLUGS]
  );
}

function updateItem(db, persist, id, { name, category }) {
  const existing = getItemById(db, id);
  if (!existing) {
    throw new Error('Risorsa non trovata');
  }

  const categoryRow = queryOne(db, 'SELECT slug FROM item_categories WHERE slug = ?', [
    category,
  ]);
  if (!categoryRow) {
    throw new Error('Categoria non valida');
  }

  const nameTrim = String(name ?? '').trim();
  if (!nameTrim) {
    throw new Error('Il nome è obbligatorio');
  }

  db.run('UPDATE items SET name = ?, category = ? WHERE id = ?', [nameTrim, category, id]);

  ensureI18nTables(db);
  const locale = getAppLocale(db);
  const existingTranslation = queryOne(
    db,
    `SELECT description FROM item_translations WHERE item_id = ? AND locale = ?`,
    [id, locale]
  );
  upsertItemTranslation(db, id, locale, {
    name: nameTrim,
    description: existingTranslation?.description ?? existing.description ?? null,
  });

  persist();
  return getItemById(db, id);
}

module.exports = {
  EXCLUDED_ITEM_SLUGS,
  seedItems,
  syncItemMetadata,
  getCategories,
  getItemsByCategory,
  getAllItemsGrouped,
  searchItems,
  getItemById,
  updateItem,
};
