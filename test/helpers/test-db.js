/**
 * In-memory SQLite (sql.js) with full catalog seed — for auto-plan / domain tests.
 * Does not touch the Electron app-data DB singleton.
 */
const path = require('path');
const initSqlJs = require('sql.js');
const { ensureDefaultResources } = require('../../src/database/resources');
const { ensureProductionChainStepsTable } = require('../../src/database/production-chains');
const { ensureEnergyChainsTable } = require('../../src/database/energy-chains');
const { ensureEnergyExtractionsTable } = require('../../src/database/energy-extraction');
const { ensureI18nTables } = require('../../src/database/i18n');
const { getItemById } = require('../../src/database/items');

const SQL_JS_DIST = path.join(__dirname, '../../node_modules/sql.js/dist');

let sharedDbPromise = null;

function createBaseTables(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS item_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (category) REFERENCES item_categories(slug)
    );

    CREATE TABLE IF NOT EXISTS buildings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT,
      power_consumption REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS production_chains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target_item_slug TEXT,
      target_rate REAL DEFAULT 60,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  ensureEnergyChainsTable(db);
  ensureEnergyExtractionsTable(db);
  ensureProductionChainStepsTable(db);
  ensureI18nTables(db);

  const versionRow = db.exec('SELECT version FROM schema_version LIMIT 1');
  if (!versionRow.length) {
    db.run('INSERT INTO schema_version (version) VALUES (?)', [1]);
  }
}

async function createTestDatabase() {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(SQL_JS_DIST, file),
  });
  const db = new SQL.Database();
  createBaseTables(db);
  ensureDefaultResources(db, () => {});
  return db;
}

/** Shared seeded DB for a test file (seed once). */
function getSharedTestDatabase() {
  if (!sharedDbPromise) {
    sharedDbPromise = createTestDatabase();
  }
  return sharedDbPromise;
}

function findItemIdBySlug(db, slug) {
  const stmt = db.prepare('SELECT id FROM items WHERE slug = ?');
  stmt.bind([String(slug)]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject();
  stmt.free();
  return row.id;
}

function findItemBySlug(db, slug) {
  const id = findItemIdBySlug(db, slug);
  if (id == null) return null;
  return getItemById(db, id);
}

module.exports = {
  createTestDatabase,
  getSharedTestDatabase,
  findItemIdBySlug,
  findItemBySlug,
  getItemById,
};
