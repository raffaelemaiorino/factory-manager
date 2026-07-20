const { loadSeedData } = require('./seeds/items');
const { loadItemDetails } = require('./seeds/load-item-details');
const { seedItems, syncItemMetadata } = require('./items');
const { ensureSchemaTables, seedSchemas } = require('./schemas');
const { seedBuildings, loadSeedData: loadBuildingsSeed, DATA_VERSION: BUILDINGS_DATA_VERSION, ensureBuildingColumns } = require('./buildings');

const MIN_ITEMS = 100;

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

function queryCount(db, table) {
  const row = queryOne(db, `SELECT COUNT(*) AS count FROM ${table}`);
  return row?.count ?? 0;
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
  const row = queryOne(db, 'SELECT value FROM app_meta WHERE key = ?', [key]);
  return row?.value ?? null;
}

function setMeta(db, key, value) {
  db.run(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, String(value)]
  );
}

function getBundledResourcesVersion() {
  const details = loadItemDetails();
  const { dataVersion } = loadSeedData();
  const { dataVersion: buildingsVersion } = loadBuildingsSeed();
  return Math.max(
    details.dataVersion ?? 0,
    dataVersion ?? 0,
    buildingsVersion ?? 0,
    BUILDINGS_DATA_VERSION ?? 0
  );
}

function getExpectedCounts() {
  const { items } = loadSeedData();
  const details = loadItemDetails();
  const schemaItems = details.items.filter((item) => item.schemas?.length);
  const schemaCount = schemaItems.reduce((sum, item) => sum + item.schemas.length, 0);
  const { buildings } = loadBuildingsSeed();

  return {
    items: items.length,
    schemas: schemaCount,
    itemsWithSchemas: schemaItems.length,
    buildings: buildings.length,
    somersloopBuildings: buildings.filter((building) => (building.somersloop_slots ?? 0) > 0)
      .length,
  };
}

function needsInitialPopulation(db) {
  ensureSchemaTables(db);
  const itemCount = queryCount(db, 'items');
  const schemaCount = queryCount(db, 'item_schemas');
  const expected = getExpectedCounts();

  return itemCount < MIN_ITEMS || (expected.schemas > 0 && schemaCount === 0);
}

function resetDefaultResources(db, persist) {
  ensureAppMetaTable(db);

  const itemsResult = seedItems(db, persist, { force: true });
  syncItemMetadata(db, persist, { force: true });
  ensureSchemaTables(db);
  const schemasResult = seedSchemas(db, persist, { force: true });
  const buildingsResult = seedBuildings(db, persist, { force: true });

  const version = getBundledResourcesVersion();
  setMeta(db, 'resources_data_version', version);
  setMeta(db, 'resources_reset_at', new Date().toISOString());
  persist();

  return {
    items: itemsResult,
    schemas: schemasResult,
    buildings: buildingsResult,
    resourcesDataVersion: version,
  };
}

function ensureDefaultResources(db, persist) {
  ensureAppMetaTable(db);

  if (needsInitialPopulation(db)) {
    return { action: 'full_reset', ...resetDefaultResources(db, persist) };
  }

  const itemsResult = seedItems(db, persist);
  syncItemMetadata(db, persist);
  ensureSchemaTables(db);
  const schemasResult = seedSchemas(db, persist);
  const buildingsResult = seedBuildings(db, persist);

  const version = getBundledResourcesVersion();
  setMeta(db, 'resources_data_version', version);
  persist();

  return {
    action: 'incremental',
    items: itemsResult,
    schemas: schemasResult,
    buildings: buildingsResult,
    resourcesDataVersion: version,
  };
}

function getResourcesDataInfo(db) {
  ensureAppMetaTable(db);
  ensureSchemaTables(db);
  ensureBuildingColumns(db);
  const expected = getExpectedCounts();

  return {
    bundledVersion: getBundledResourcesVersion(),
    storedVersion: getMeta(db, 'resources_data_version'),
    lastResetAt: getMeta(db, 'resources_reset_at'),
    counts: {
      items: queryCount(db, 'items'),
      schemas: queryCount(db, 'item_schemas'),
      buildings: queryCount(db, 'buildings'),
      somersloopBuildings:
        queryOne(db, 'SELECT COUNT(*) AS count FROM buildings WHERE somersloop_slots > 0')
          ?.count ?? 0,
      itemsWithSchemas: queryOne(
        db,
        `SELECT COUNT(DISTINCT item_id) AS count FROM item_schemas`
      )?.count ?? 0,
    },
    expected: {
      items: expected.items,
      schemas: expected.schemas,
      itemsWithSchemas: expected.itemsWithSchemas,
      buildings: expected.buildings,
      somersloopBuildings: expected.somersloopBuildings,
    },
    needsPopulation: needsInitialPopulation(db),
  };
}

module.exports = {
  ensureDefaultResources,
  resetDefaultResources,
  getResourcesDataInfo,
  getExpectedCounts,
};
