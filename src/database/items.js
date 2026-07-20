const { loadSeedData, DATA_VERSION } = require('./seeds/items');
const { ITEM_METADATA_PATCHES } = require('./seeds/item-metadata');

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

  for (const patch of ITEM_METADATA_PATCHES) {
    db.run(`UPDATE items SET description = ? WHERE game_id = ?`, [
      patch.description,
      patch.game_id,
    ]);
  }

  persist();
  return { patched: ITEM_METADATA_PATCHES.length };
}

function seedItems(db, persist, { force = false } = {}) {
  ensureItemColumns(db);

  const versionRow = queryOne(db, 'SELECT version FROM schema_version LIMIT 1');
  const currentVersion = versionRow?.version ?? 0;
  const itemCount = db.exec('SELECT COUNT(*) FROM items')[0]?.values[0][0] ?? 0;

  if (!force && currentVersion >= DATA_VERSION && itemCount >= 100) {
    return { seeded: false, count: itemCount };
  }

  const { categories, items } = loadSeedData();

  db.run('BEGIN TRANSACTION');

  try {
    db.run('DELETE FROM items');
    db.run('DELETE FROM item_categories');

    for (const cat of categories) {
      db.run(
        `INSERT INTO item_categories (slug, name, sort_order) VALUES (?, ?, ?)`,
        [cat.slug, cat.name, cat.sort_order]
      );
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

function getCategories(db) {
  const excluded = excludedSlugsPlaceholders();
  return queryAll(
    db,
    `SELECT c.slug, c.name, c.sort_order, COUNT(i.id) AS item_count
     FROM item_categories c
     LEFT JOIN items i ON i.category = c.slug AND i.slug NOT IN (${excluded})
     GROUP BY c.id
     HAVING item_count > 0
     ORDER BY c.sort_order ASC`,
    EXCLUDED_ITEM_SLUGS
  );
}

const ITEM_SELECT = `
  i.id, i.slug, i.name, i.category, i.game_id, i.image, i.description,
  (SELECT COUNT(*) FROM item_schemas s WHERE s.item_id = i.id) AS schema_count
`;

function getItemsByCategory(db, categorySlug) {
  const excluded = excludedSlugsPlaceholders();
  return queryAll(
    db,
    `SELECT ${ITEM_SELECT}
     FROM items i
     WHERE i.category = ? AND i.slug NOT IN (${excluded})
     ORDER BY i.name ASC`,
    [categorySlug, ...EXCLUDED_ITEM_SLUGS]
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
  const term = `%${query.trim()}%`;
  const excluded = excludedSlugsPlaceholders();
  return queryAll(
    db,
    `SELECT ${ITEM_SELECT}, c.name AS category_name
     FROM items i
     JOIN item_categories c ON c.slug = i.category
     WHERE i.slug NOT IN (${excluded})
       AND (i.name LIKE ? OR i.slug LIKE ? OR i.game_id LIKE ?)
     ORDER BY c.sort_order ASC, i.name ASC`,
    [...EXCLUDED_ITEM_SLUGS, term, term, term]
  );
}

function getItemById(db, id) {
  const excluded = excludedSlugsPlaceholders();
  return queryOne(
    db,
    `SELECT ${ITEM_SELECT}, c.name AS category_name
     FROM items i
     JOIN item_categories c ON c.slug = i.category
     WHERE i.id = ? AND i.slug NOT IN (${excluded})`,
    [id, ...EXCLUDED_ITEM_SLUGS]
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
