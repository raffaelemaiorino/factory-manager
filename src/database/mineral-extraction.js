const { getBuildingBySlug } = require('./buildings');
const { DEFAULT_OVERCLOCK } = require('./production-scale');
const {
  MINER_BASE_RATES,
  OIL_PUMP_BASE_RATES,
  WATER_PUMP_BASE_RATE,
  computeExtractionRate,
  resolveExtractionProduction,
  mergeExtractionStored,
  serializeSubNodes,
  normalizeExtractorSlug,
  normalizePurity,
  normalizeNodeCount,
} = require('./extraction-scale');

const MINER_SLUGS = ['miner-mk1', 'miner-mk2', 'miner-mk3'];
const OIL_PUMP_SLUG = 'oil-pump';
const WATER_PUMP_SLUG = 'water-pump';
const FRACKING_EXTRACTOR_SLUG = 'fracking-extractor';
const FRACKING_SMASHER_SLUG = 'fracking-smasher';
const EXTRACTOR_SLUGS = [
  ...MINER_SLUGS,
  OIL_PUMP_SLUG,
  WATER_PUMP_SLUG,
  FRACKING_EXTRACTOR_SLUG,
];

const LIQUID_EXTRACTION_SLUGS = ['liquid-oil', 'water'];
const WELL_EXTRACTION_ITEM_SLUGS = ['nitrogen-gas', 'water', 'liquid-oil'];

const PURITY_VALUES = ['impure', 'normal', 'pure'];

const EXTRACTION_SELECT = `
  id, chain_id, item_id, miner_slug, purity, overclock, node_count, target_output, sub_nodes, sort_order, created_at
`;

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

function getExtractionKindForItem(item, stored = {}) {
  if (!item) return 'mineral';
  if (stored.miner_slug === FRACKING_EXTRACTOR_SLUG || stored.extraction_method === 'well') {
    return 'well';
  }
  if (item.slug === 'liquid-oil') return 'oil';
  if (item.slug === 'water') return 'water';
  if (item.slug === 'nitrogen-gas') return 'well';
  if (item.category === 'minerali') return 'mineral';
  return null;
}

function isExtractionItem(item, options = {}) {
  if (options.extraction_method === 'well') {
    return WELL_EXTRACTION_ITEM_SLUGS.includes(item?.slug);
  }
  return getExtractionKindForItem(item) != null;
}

function getDefaultExtractionConfig(item, options = {}) {
  const method = options.extraction_method;
  if (method === 'well' || options.miner_slug === FRACKING_EXTRACTOR_SLUG) {
    return {
      miner_slug: FRACKING_EXTRACTOR_SLUG,
      purity: 'normal',
      overclock: DEFAULT_OVERCLOCK,
      node_count: 1,
    };
  }

  const kind = getExtractionKindForItem(item);
  if (kind === 'oil') {
    return {
      miner_slug: OIL_PUMP_SLUG,
      purity: 'normal',
      overclock: DEFAULT_OVERCLOCK,
      node_count: 1,
    };
  }
  if (kind === 'water') {
    return {
      miner_slug: WATER_PUMP_SLUG,
      purity: 'normal',
      overclock: DEFAULT_OVERCLOCK,
      node_count: 1,
    };
  }
  return {
    miner_slug: 'miner-mk1',
    purity: 'normal',
    overclock: DEFAULT_OVERCLOCK,
    node_count: 1,
  };
}

function ensureExtractionsTable(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS production_chain_extractions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chain_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      miner_slug TEXT NOT NULL DEFAULT 'miner-mk1',
      purity TEXT NOT NULL DEFAULT 'normal',
      overclock REAL NOT NULL DEFAULT 100,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chain_id) REFERENCES production_chains(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id)
    );
  `);

  const info = db.exec('PRAGMA table_info(production_chain_extractions)')[0]?.values ?? [];
  const cols = new Set(info.map((row) => row[1]));
  if (!cols.has('node_count')) {
    db.run(
      'ALTER TABLE production_chain_extractions ADD COLUMN node_count INTEGER NOT NULL DEFAULT 1'
    );
  }
  if (!cols.has('target_output')) {
    db.run('ALTER TABLE production_chain_extractions ADD COLUMN target_output REAL');
  }
  if (!cols.has('sub_nodes')) {
    db.run('ALTER TABLE production_chain_extractions ADD COLUMN sub_nodes TEXT');
  }
}

function mapExtraction(row, item, db) {
  const resolved = resolveExtractionProduction(item, row);
  const extractionKind = getExtractionKindForItem(item, {
    miner_slug: resolved.miner_slug,
  });
  const isWell = extractionKind === 'well';
  const extractorBuilding = getBuildingBySlug(db, resolved.miner_slug);
  const pressurizerBuilding = isWell ? getBuildingBySlug(db, FRACKING_SMASHER_SLUG) : null;
  const building = isWell ? pressurizerBuilding : extractorBuilding;

  return {
    id: row.id,
    chain_id: row.chain_id,
    item_id: row.item_id,
    miner_slug: resolved.miner_slug,
    purity: resolved.purity,
    overclock: resolved.overclock,
    node_count: resolved.node_count,
    sub_nodes: resolved.sub_nodes,
    target_output: resolved.target_output,
    base_per_node: resolved.base_per_node,
    min_target_output: resolved.min_target_output,
    max_target_output: resolved.max_target_output,
    sort_order: row.sort_order,
    created_at: row.created_at,
    extraction_kind: extractionKind,
    output_rate: resolved.output_rate,
    item,
    building_name: building?.name ?? resolved.miner_slug,
    building_image: building?.image ?? null,
    extractor_building_name: isWell ? extractorBuilding?.name ?? null : null,
    extractor_building_image: isWell ? extractorBuilding?.image ?? null : null,
    power_consumption: Number(building?.power_consumption) || 0,
  };
}

function loadChainExtractions(db, chainId, getItemById) {
  ensureExtractionsTable(db);
  const rows = queryAll(
    db,
    `SELECT ${EXTRACTION_SELECT}
     FROM production_chain_extractions
     WHERE chain_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [chainId]
  );

  return rows.map((row) => mapExtraction(row, getItemById(db, row.item_id), db));
}

function getExtractionById(db, extractionId, getItemById) {
  ensureExtractionsTable(db);
  const row = queryOne(
    db,
    `SELECT ${EXTRACTION_SELECT}
     FROM production_chain_extractions
     WHERE id = ?`,
    [extractionId]
  );
  if (!row) return null;
  return mapExtraction(row, getItemById(db, row.item_id), db);
}

function addMineralExtraction(db, persist, chainId, { item_id, extraction_method }, getItemById) {
  ensureExtractionsTable(db);

  const chainRow = queryOne(db, 'SELECT id FROM production_chains WHERE id = ?', [chainId]);
  if (!chainRow) {
    throw new Error('Schema di produzione non trovato');
  }

  const item = getItemById(db, item_id);
  if (!item) {
    throw new Error('Risorsa non trovata');
  }
  if (!isExtractionItem(item, { extraction_method })) {
    throw new Error('Seleziona una risorsa estraibile valida');
  }

  const defaults = getDefaultExtractionConfig(item, { extraction_method });
  const resolved = resolveExtractionProduction(item, defaults);

  const sortRow = queryOne(
    db,
    'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM production_chain_extractions WHERE chain_id = ?',
    [chainId]
  );
  const sortOrder = (sortRow?.max_order ?? -1) + 1;

  db.run(
    `INSERT INTO production_chain_extractions
      (chain_id, item_id, miner_slug, purity, overclock, node_count, target_output, sub_nodes, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      chainId,
      item.id,
      resolved.miner_slug,
      resolved.purity,
      resolved.overclock,
      resolved.node_count,
      resolved.target_output,
      serializeSubNodes(resolved.sub_nodes),
      sortOrder,
    ]
  );

  db.run(`UPDATE production_chains SET updated_at = datetime('now') WHERE id = ?`, [chainId]);
  persist();

  const extractionId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  return getExtractionById(db, extractionId, getItemById);
}

function updateMineralExtraction(
  db,
  persist,
  extractionId,
  { miner_slug, purity, overclock, node_count, target_output, sub_nodes },
  getItemById
) {
  ensureExtractionsTable(db);

  const existing = queryOne(
    db,
    `SELECT ${EXTRACTION_SELECT}
     FROM production_chain_extractions WHERE id = ?`,
    [extractionId]
  );
  if (!existing) {
    throw new Error('Estrazione non trovata');
  }

  const item = getItemById(db, existing.item_id);
  const merged = mergeExtractionStored(existing, {
    miner_slug,
    purity,
    overclock,
    node_count,
    target_output,
    sub_nodes,
  });
  if (sub_nodes != null) {
    merged.sub_nodes =
      typeof sub_nodes === 'string' ? sub_nodes : serializeSubNodes(sub_nodes);
  }
  const resolved = resolveExtractionProduction(item, merged);

  db.run(
    `UPDATE production_chain_extractions
     SET miner_slug = ?, purity = ?, overclock = ?, node_count = ?, target_output = ?, sub_nodes = ?
     WHERE id = ?`,
    [
      resolved.miner_slug,
      resolved.purity,
      resolved.overclock,
      resolved.node_count,
      resolved.target_output,
      serializeSubNodes(resolved.sub_nodes),
      extractionId,
    ]
  );
  db.run(`UPDATE production_chains SET updated_at = datetime('now') WHERE id = ?`, [
    existing.chain_id,
  ]);
  persist();

  return getExtractionById(db, extractionId, getItemById);
}

function deleteMineralExtraction(db, persist, extractionId) {
  ensureExtractionsTable(db);

  const row = queryOne(
    db,
    `SELECT id, chain_id FROM production_chain_extractions WHERE id = ?`,
    [extractionId]
  );
  if (!row) {
    throw new Error('Estrazione non trovata');
  }

  db.run('DELETE FROM production_chain_step_links WHERE producer_extraction_id = ?', [
    extractionId,
  ]);
  db.run('DELETE FROM production_chain_extractions WHERE id = ?', [extractionId]);
  db.run(`UPDATE production_chains SET updated_at = datetime('now') WHERE id = ?`, [row.chain_id]);
  persist();

  return { deleted: true, id: row.id, chain_id: row.chain_id };
}

function resetMineralExtraction(db, persist, extractionId, getItemById) {
  ensureExtractionsTable(db);

  const existing = queryOne(
    db,
    `SELECT id, chain_id, item_id FROM production_chain_extractions WHERE id = ?`,
    [extractionId]
  );
  if (!existing) {
    throw new Error('Estrazione non trovata');
  }

  const item = getItemById(db, existing.item_id);
  const defaults = getDefaultExtractionConfig(item, {
    miner_slug: existing.miner_slug,
  });
  const resolved = resolveExtractionProduction(item, defaults);

  db.run(
    `UPDATE production_chain_extractions
     SET miner_slug = ?, purity = ?, overclock = ?, node_count = ?, target_output = ?, sub_nodes = ?
     WHERE id = ?`,
    [
      resolved.miner_slug,
      resolved.purity,
      resolved.overclock,
      resolved.node_count,
      resolved.target_output,
      serializeSubNodes(resolved.sub_nodes),
      extractionId,
    ]
  );
  db.run(`UPDATE production_chains SET updated_at = datetime('now') WHERE id = ?`, [
    existing.chain_id,
  ]);
  persist();

  return getExtractionById(db, extractionId, getItemById);
}

function deleteExtractionsForChain(db, chainId) {
  ensureExtractionsTable(db);
  db.run('DELETE FROM production_chain_extractions WHERE chain_id = ?', [chainId]);
}

module.exports = {
  MINER_SLUGS,
  OIL_PUMP_SLUG,
  WATER_PUMP_SLUG,
  FRACKING_EXTRACTOR_SLUG,
  FRACKING_SMASHER_SLUG,
  EXTRACTOR_SLUGS,
  LIQUID_EXTRACTION_SLUGS,
  WELL_EXTRACTION_ITEM_SLUGS,
  MINER_BASE_RATES,
  OIL_PUMP_BASE_RATES,
  WATER_PUMP_BASE_RATE,
  PURITY_VALUES,
  getExtractionKindForItem,
  isExtractionItem,
  getDefaultExtractionConfig,
  computeExtractionRate,
  ensureExtractionsTable,
  loadChainExtractions,
  getExtractionById,
  addMineralExtraction,
  updateMineralExtraction,
  deleteMineralExtraction,
  resetMineralExtraction,
  deleteExtractionsForChain,
};
