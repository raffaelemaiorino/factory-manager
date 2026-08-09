const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { detectSchemaFormatKind } = require('./schema-import-guard');
const {
  getCategories,
  getItemsByCategory,
  getAllItemsGrouped,
  searchItems,
  getItemById,
  updateItem,
} = require('./items');
const { ensureSchemaTables, getItemDetail } = require('./schemas');
const {
  ensureDefaultResources,
  resetDefaultResources,
  getResourcesDataInfo,
} = require('./resources');
const {
  listProductionChains,
  createProductionChain,
  updateProductionChain: patchProductionChain,
  deleteProductionChain,
  duplicateProductionChain: cloneProductionChain,
  exportProductionChain: buildProductionChainExport,
  importProductionChain: loadProductionChainImport,
  getProductionChainDetail: loadProductionChainDetail,
  getProductionChainById,
  addProductionChainStep: insertProductionChainStep,
  updateProductionChainStep: patchProductionChainStep,
  setProductionStepMarked: patchProductionStepMarked,
  setProductionGroupMarked: patchProductionGroupMarked,
  resetProductionChainStep: resetChainStep,
  deleteProductionChainStep: removeProductionChainStep,
  reorderProductionChainSteps: reorderChainSteps,
  reorderProductionChainStepsInGroup: reorderChainStepsInGroup,
  reorderProductionChainGroups: reorderChainStepGroups,
  setProductionStepGroupName: setStepGroupName,
  renameProductionStepGroup: renameChainStepGroup,
  setProductionStepInputLinks: patchStepInputLinks,
  setProductionStepExtractionLinks: patchStepExtractionLinks,
  ensureProductionChainStepsTable,
} = require('./production-chains');
const {
  addMineralExtraction: insertMineralExtraction,
  updateMineralExtraction: patchMineralExtraction,
  deleteMineralExtraction: removeMineralExtraction,
  resetMineralExtraction: resetChainExtraction,
} = require('./mineral-extraction');
const {
  ensureEnergyChainsTable,
  listEnergyChains,
  createEnergyChain,
  updateEnergyChain: patchEnergyChain,
  deleteEnergyChain,
  getEnergyChainById,
  getEnergyChainDetail: loadEnergyChainDetail,
  exportEnergyChain: buildEnergyChainExport,
  importEnergyChain: loadEnergyChainImport,
  addEnergyGenerator: insertEnergyGenerator,
  updateEnergyGenerator: patchEnergyGenerator,
  deleteEnergyGenerator: removeEnergyGenerator,
  resetEnergyGenerator: resetChainGenerator,
  getEnergyGeneratorCatalog,
  setEnergyGeneratorInputLinks: patchEnergyGeneratorLinks,
  setEnergyGeneratorProductionLinks: patchEnergyGeneratorProductionLinks,
} = require('./energy-chains');
const {
  ensureEnergyExtractionsTable,
  addEnergyExtraction: insertEnergyExtraction,
  updateEnergyExtraction: patchEnergyExtraction,
  deleteEnergyExtraction: removeEnergyExtraction,
  resetEnergyExtraction: resetChainEnergyExtraction,
} = require('./energy-extraction');
const {
  ensureI18nTables,
  getI18nInfo,
  getAppLocale,
  setAppLocale,
  listLocales,
  listAvailableLocales,
} = require('./i18n');
const { getAppSettings, setAppSettings } = require('./app-settings');
const {
  ensureTransportPlansTables,
  listTransportPlans,
  getTransportPlanById,
  createTransportPlan,
  updateTransportPlan: patchTransportPlan,
  deleteTransportPlan,
  duplicateTransportPlan: cloneTransportPlan,
  listVehiclesCatalog,
} = require('./transport-plans');

const DB_FILE_NAME = 'factory-manager.db';
const LEGACY_DB_FILE_NAMES = ['satisfactory.db'];

let db;
let dbPath;
let SQL;

function ensureDbFileFromLegacy(dataDir) {
  const targetPath = path.join(dataDir, DB_FILE_NAME);
  if (fs.existsSync(targetPath)) return targetPath;

  for (const legacyName of LEGACY_DB_FILE_NAMES) {
    const legacyPath = path.join(dataDir, legacyName);
    if (!fs.existsSync(legacyPath)) continue;
    fs.copyFileSync(legacyPath, targetPath);
    return targetPath;
  }

  return targetPath;
}

/** Percorso WASM/JS di sql.js: funziona in dev e in asar / asar.unpacked. */
function resolveSqlJsAsset(file) {
  const candidates = [
    path.join(__dirname, '../../node_modules/sql.js/dist', file),
  ];

  if (process.resourcesPath) {
    candidates.push(
      path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', file),
      path.join(process.resourcesPath, 'node_modules', 'sql.js', 'dist', file)
    );
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return candidates[0];
}

async function initDatabase(userDataPath) {
  const dataDir = path.join(userDataPath, 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  dbPath = ensureDbFileFromLegacy(dataDir);

  SQL = await initSqlJs({
    locateFile: (file) => resolveSqlJsAsset(file),
  });

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  runMigrations();
  ensureDefaultResources(db, persist);
  persist();
  return db;
}

function runMigrations() {
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
  ensureTransportPlansTables(db);
  // Solo schema: il seed traduzioni avviene in ensureDefaultResources (dopo gli item).
  ensureI18nTables(db);

  const versionRow = queryOne('SELECT version FROM schema_version LIMIT 1');
  if (!versionRow) {
    db.run('INSERT INTO schema_version (version) VALUES (?)', [1]);
  }
}

function queryOne(sql, params = []) {
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

function queryCount(table) {
  const row = queryOne(`SELECT COUNT(*) AS count FROM ${table}`);
  return row?.count ?? 0;
}

function persist() {
  if (!db || !dbPath) return;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function getDbStatus() {
  if (!db) {
    return { connected: false, path: null, pathLabel: null };
  }

  const version = queryOne('SELECT version FROM schema_version LIMIT 1');
  const resources = getResourcesDataInfo(db);

  return {
    connected: true,
    // Non esporre il path assoluto al renderer (info disclosure locale)
    path: null,
    pathLabel: 'database locale',
    schemaVersion: version?.version ?? 0,
    resources,
    i18n: getI18nInfo(db),
    counts: {
      items: resources.counts.items,
      schemas: resources.counts.schemas,
      buildings: queryCount('buildings'),
      chains: queryCount('production_chains'),
      energyChains: queryCount('energy_chains'),
    },
  };
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}

function getResourcesGrouped() {
  return getAllItemsGrouped(getDb());
}

function getResourceCategories() {
  return getCategories(getDb());
}

function getResourcesByCategory(categorySlug) {
  return getItemsByCategory(getDb(), categorySlug);
}

function findResources(query) {
  return searchItems(getDb(), query);
}

function getResourceById(id) {
  return getItemById(getDb(), id);
}

function saveResource(id, data) {
  return updateItem(getDb(), persist, id, data);
}

function getResourceDetail(id) {
  return getItemDetail(getDb(), getItemById, id);
}

function restoreDefaultResources() {
  const result = resetDefaultResources(getDb(), persist);
  return {
    ...result,
    status: getDbStatus(),
  };
}

function getProductionChains() {
  return listProductionChains(getDb());
}

function saveProductionChain(data = {}) {
  const db = getDb();
  const {
    auto_plan = false,
    target_item_id = null,
    target_rate = null,
    targets = null,
    ...createData
  } = data;

  const normalizedTargets = Array.isArray(targets)
    ? targets
        .map((entry) => ({
          item_id: Number(entry?.item_id ?? entry?.id),
          target_rate: Number(entry?.target_rate ?? entry?.rate),
        }))
        .filter((entry) => Number.isFinite(entry.item_id) && entry.item_id > 0)
    : null;

  let targetSlug = createData.target_item_slug ?? null;
  let firstRate = target_rate ?? createData.target_rate ?? null;

  if (normalizedTargets?.length) {
    const firstItem = getItemById(db, normalizedTargets[0].item_id);
    if (!firstItem) throw new Error('Risorsa non trovata');
    targetSlug = firstItem.slug;
    firstRate = normalizedTargets[0].target_rate;
  } else if (target_item_id != null && target_item_id !== '') {
    const item = getItemById(db, Number(target_item_id));
    if (!item) {
      throw new Error('Risorsa non trovata');
    }
    targetSlug = item.slug;
  }

  const chain = createProductionChain(db, persist, {
    ...createData,
    target_item_slug: targetSlug,
    target_rate: firstRate,
  });

  const planTargets =
    normalizedTargets?.length > 0
      ? normalizedTargets
      : target_item_id != null &&
          target_item_id !== '' &&
          target_rate != null &&
          target_rate !== ''
        ? [{ item_id: Number(target_item_id), target_rate: Number(target_rate) }]
        : [];

  if (Boolean(auto_plan) && planTargets.length) {
    const { autoPlanProductionChain } = require('./auto-plan');
    autoPlanProductionChain(
      db,
      persist,
      chain.id,
      {
        targets: planTargets,
        replace: true,
        sink_byproducts: createData.sink_byproducts ?? chain.sink_byproducts,
      },
      getItemById
    );
    return getProductionChainById(db, chain.id);
  }

  if (planTargets.length) {
    const { replaceChainTargets } = require('./production-targets');
    replaceChainTargets(db, persist, chain.id, planTargets, getItemById);
  }

  return chain;
}

function setProductionChainTargets(chainId, targets) {
  const { setProductionChainTargetsAndReplan } = require('./auto-plan');
  return setProductionChainTargetsAndReplan(
    getDb(),
    persist,
    chainId,
    targets,
    getItemById
  );
}

function updateProductionChain(id, data) {
  return patchProductionChain(getDb(), persist, id, data);
}

function removeProductionChain(id) {
  return deleteProductionChain(getDb(), persist, id);
}

function duplicateProductionChain(id) {
  return cloneProductionChain(getDb(), persist, id, getItemById);
}

function exportProductionChain(id, options = {}) {
  return buildProductionChainExport(getDb(), id, getItemById, options);
}

function importProductionChain(payload) {
  return loadProductionChainImport(getDb(), persist, payload, getItemById);
}

function fetchProductionChainDetail(id) {
  return loadProductionChainDetail(getDb(), id, getItemById);
}

function addProductionChainStep(chainId, data) {
  return insertProductionChainStep(getDb(), persist, chainId, data, getItemById);
}

function updateProductionChainStep(stepId, data) {
  return patchProductionChainStep(getDb(), persist, stepId, data, getItemById);
}

function setProductionStepMarked(stepId, marked) {
  return patchProductionStepMarked(getDb(), persist, stepId, marked, getItemById);
}

function setProductionGroupMarked(chainId, groupName, marked) {
  return patchProductionGroupMarked(getDb(), persist, chainId, groupName, marked, getItemById);
}

function resetProductionChainStep(stepId) {
  return resetChainStep(getDb(), persist, stepId, getItemById);
}

function deleteProductionChainStep(stepId) {
  return removeProductionChainStep(getDb(), persist, stepId);
}

function reorderProductionChainSteps(chainId, orderedStepIds) {
  return reorderChainSteps(getDb(), persist, chainId, orderedStepIds, getItemById);
}

function reorderProductionChainStepsInGroup(chainId, groupName, orderedStepIds) {
  return reorderChainStepsInGroup(
    getDb(),
    persist,
    chainId,
    groupName,
    orderedStepIds,
    getItemById
  );
}

function reorderProductionChainGroups(chainId, orderedGroupKeys) {
  return reorderChainStepGroups(getDb(), persist, chainId, orderedGroupKeys, getItemById);
}

function setProductionStepGroupName(stepId, groupName) {
  return setStepGroupName(getDb(), persist, stepId, groupName, getItemById);
}

function renameProductionStepGroup(chainId, oldGroupName, newGroupName) {
  return renameChainStepGroup(getDb(), persist, chainId, oldGroupName, newGroupName, getItemById);
}

function setProductionStepInputLinks(consumerStepId, itemSlug, producerStepIds) {
  return patchStepInputLinks(
    getDb(),
    persist,
    consumerStepId,
    itemSlug,
    producerStepIds,
    getItemById
  );
}

function setProductionStepExtractionLinks(consumerStepId, itemSlug, producerExtractionIds) {
  return patchStepExtractionLinks(
    getDb(),
    persist,
    consumerStepId,
    itemSlug,
    producerExtractionIds,
    getItemById
  );
}

function addMineralExtraction(chainId, data) {
  insertMineralExtraction(getDb(), persist, chainId, data, getItemById);
  return loadProductionChainDetail(getDb(), chainId, getItemById);
}

function updateMineralExtraction(extractionId, data) {
  const extraction = patchMineralExtraction(getDb(), persist, extractionId, data, getItemById);
  return loadProductionChainDetail(getDb(), extraction.chain_id, getItemById);
}

function deleteMineralExtraction(extractionId) {
  const result = removeMineralExtraction(getDb(), persist, extractionId);
  return loadProductionChainDetail(getDb(), result.chain_id, getItemById);
}

function resetMineralExtraction(extractionId) {
  const extraction = resetChainExtraction(getDb(), persist, extractionId, getItemById);
  return loadProductionChainDetail(getDb(), extraction.chain_id, getItemById);
}

function getEnergyChains() {
  return listEnergyChains(getDb());
}

function saveEnergyChain(data = {}) {
  const db = getDb();
  const {
    auto_plan = false,
    target_power_mw = null,
    target_building_slug = null,
    target_fuel_slug = null,
    power_shard_limit = 0,
    ...createData
  } = data;

  const chain = createEnergyChain(db, persist, {
    ...createData,
    target_power_mw,
    target_building_slug,
    target_fuel_slug,
    power_shard_limit,
  });

  if (
    Boolean(auto_plan) &&
    target_power_mw != null &&
    target_power_mw !== '' &&
    target_building_slug &&
    target_fuel_slug
  ) {
    const { autoPlanEnergyChain } = require('./auto-plan-energy');
    autoPlanEnergyChain(
      db,
      persist,
      chain.id,
      {
        target_power_mw,
        target_building_slug,
        target_fuel_slug,
        power_shard_limit,
      },
      getItemById
    );
    return getEnergyChainById(db, chain.id);
  }

  return chain;
}

function setEnergyChainTargets(chainId, options = {}) {
  const { setEnergyChainTargetsAndReplan } = require('./auto-plan-energy');
  return setEnergyChainTargetsAndReplan(getDb(), persist, chainId, options, getItemById);
}

function updateEnergyChain(id, data) {
  return patchEnergyChain(getDb(), persist, id, data);
}

function removeEnergyChain(id) {
  return deleteEnergyChain(getDb(), persist, id);
}

function exportEnergyChain(id, options = {}) {
  return buildEnergyChainExport(getDb(), id, getItemById, options);
}

function importEnergyChain(payload) {
  return loadEnergyChainImport(getDb(), persist, payload, getItemById);
}

function fetchEnergyChainDetail(id) {
  return loadEnergyChainDetail(getDb(), id, getItemById);
}

function fetchEnergyGeneratorCatalog() {
  return getEnergyGeneratorCatalog(getDb());
}

function addEnergyChainExtraction(chainId, data) {
  insertEnergyExtraction(getDb(), persist, chainId, data, getItemById);
  return loadEnergyChainDetail(getDb(), chainId, getItemById);
}

function updateEnergyChainExtraction(extractionId, data) {
  const extraction = patchEnergyExtraction(getDb(), persist, extractionId, data, getItemById);
  return loadEnergyChainDetail(getDb(), extraction.chain_id, getItemById);
}

function deleteEnergyChainExtraction(extractionId) {
  const result = removeEnergyExtraction(getDb(), persist, extractionId);
  return loadEnergyChainDetail(getDb(), result.chain_id, getItemById);
}

function resetEnergyChainExtraction(extractionId) {
  const extraction = resetChainEnergyExtraction(getDb(), persist, extractionId, getItemById);
  return loadEnergyChainDetail(getDb(), extraction.chain_id, getItemById);
}

function addEnergyChainGenerator(chainId, data) {
  insertEnergyGenerator(getDb(), persist, chainId, data, getItemById);
  return loadEnergyChainDetail(getDb(), chainId, getItemById);
}

function updateEnergyChainGenerator(generatorId, data) {
  const generator = patchEnergyGenerator(getDb(), persist, generatorId, data, getItemById);
  return loadEnergyChainDetail(getDb(), generator.chain_id, getItemById);
}

function deleteEnergyChainGenerator(generatorId) {
  const result = removeEnergyGenerator(getDb(), persist, generatorId);
  return loadEnergyChainDetail(getDb(), result.chain_id, getItemById);
}

function resetEnergyChainGenerator(generatorId) {
  const generator = resetChainGenerator(getDb(), persist, generatorId, getItemById);
  return loadEnergyChainDetail(getDb(), generator.chain_id, getItemById);
}

function setEnergyGeneratorInputLinks(consumerGeneratorId, itemSlug, producerExtractionIds) {
  return patchEnergyGeneratorLinks(
    getDb(),
    persist,
    consumerGeneratorId,
    itemSlug,
    producerExtractionIds,
    getItemById
  );
}

function setEnergyGeneratorProductionLinks(consumerGeneratorId, itemSlug, producerStepIds) {
  return patchEnergyGeneratorProductionLinks(
    getDb(),
    persist,
    consumerGeneratorId,
    itemSlug,
    producerStepIds,
    getItemById
  );
}

function getTransportPlans() {
  return listTransportPlans(getDb(), getItemById);
}

function saveTransportPlan(data = {}) {
  return createTransportPlan(getDb(), persist, data, getItemById);
}

function updateTransportPlan(id, data) {
  return patchTransportPlan(getDb(), persist, id, data, getItemById);
}

function removeTransportPlan(id) {
  return deleteTransportPlan(getDb(), persist, id);
}

function duplicateTransportPlan(id) {
  return cloneTransportPlan(getDb(), persist, id, getItemById);
}

function fetchTransportPlanDetail(id) {
  return getTransportPlanById(getDb(), id, getItemById);
}

function fetchVehiclesCatalog() {
  return listVehiclesCatalog();
}

module.exports = {
  initDatabase,
  getDbStatus,
  getDb,
  persist,
  detectSchemaFormatKind,
  getResourcesGrouped,
  getResourceCategories,
  getResourcesByCategory,
  findResources,
  getResourceById,
  saveResource,
  getResourceDetail,
  restoreDefaultResources,
  getResourcesDataInfo: () => getResourcesDataInfo(getDb()),
  getProductionChains,
  saveProductionChain,
  setProductionChainTargets,
  updateProductionChain,
  removeProductionChain,
  duplicateProductionChain,
  exportProductionChain,
  importProductionChain,
  fetchProductionChainDetail,
  addProductionChainStep,
  updateProductionChainStep,
  setProductionStepMarked,
  setProductionGroupMarked,
  resetProductionChainStep,
  deleteProductionChainStep,
  reorderProductionChainSteps,
  reorderProductionChainStepsInGroup,
  reorderProductionChainGroups,
  setProductionStepGroupName,
  renameProductionStepGroup,
  setProductionStepInputLinks,
  setProductionStepExtractionLinks,
  addMineralExtraction,
  updateMineralExtraction,
  deleteMineralExtraction,
  resetMineralExtraction,
  getEnergyChains,
  saveEnergyChain,
  setEnergyChainTargets,
  updateEnergyChain,
  removeEnergyChain,
  exportEnergyChain,
  importEnergyChain,
  fetchEnergyChainDetail,
  fetchEnergyGeneratorCatalog,
  addEnergyChainExtraction,
  updateEnergyChainExtraction,
  deleteEnergyChainExtraction,
  resetEnergyChainExtraction,
  addEnergyChainGenerator,
  updateEnergyChainGenerator,
  deleteEnergyChainGenerator,
  resetEnergyChainGenerator,
  setEnergyGeneratorInputLinks,
  setEnergyGeneratorProductionLinks,
  getTransportPlans,
  saveTransportPlan,
  updateTransportPlan,
  removeTransportPlan,
  duplicateTransportPlan,
  fetchTransportPlanDetail,
  fetchVehiclesCatalog,
  getI18nInfo: () => getI18nInfo(getDb()),
  getAppLocale: () => getAppLocale(getDb()),
  setAppLocale: (locale) => setAppLocale(getDb(), persist, locale),
  listLocales: () => listLocales(getDb()),
  listAvailableLocales: () => listAvailableLocales(getDb()),
  getAppSettings: () => getAppSettings(getDb()),
  setAppSettings: (partial) => setAppSettings(getDb(), persist, partial),
};
