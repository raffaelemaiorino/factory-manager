const { getBuildingBySlug } = require('./buildings');
const {
  resolveExtractionProduction,
  mergeExtractionStored,
} = require('./extraction-scale');
const { DEFAULT_OVERCLOCK } = require('./production-scale');

const ENERGY_EXTRACTION_SLUGS = ['coal', 'water'];

const EXTRACTION_SELECT = `
  id, chain_id, item_id, miner_slug, purity, overclock, node_count, target_output, sort_order, created_at
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

function isEnergyExtractionItem(item) {
  return item && ENERGY_EXTRACTION_SLUGS.includes(item.slug);
}

function getEnergyExtractionKind(item) {
  if (!item) return null;
  if (item.slug === 'water') return 'water';
  if (item.slug === 'coal') return 'coal';
  return null;
}

function getDefaultEnergyExtractionConfig(item) {
  if (item?.slug === 'water') {
    return {
      miner_slug: 'water-pump',
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

function ensureEnergyExtractionsTable(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS energy_chain_extractions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chain_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      miner_slug TEXT NOT NULL DEFAULT 'miner-mk1',
      purity TEXT NOT NULL DEFAULT 'normal',
      overclock REAL NOT NULL DEFAULT 100,
      node_count INTEGER NOT NULL DEFAULT 1,
      target_output REAL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chain_id) REFERENCES energy_chains(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id)
    );
  `);
}

function mapEnergyExtraction(row, item, db) {
  const resolved = resolveExtractionProduction(item, row);
  const building = getBuildingBySlug(db, resolved.miner_slug);
  const extractionKind = getEnergyExtractionKind(item);

  return {
    id: row.id,
    chain_id: row.chain_id,
    item_id: row.item_id,
    miner_slug: resolved.miner_slug,
    purity: resolved.purity,
    overclock: resolved.overclock,
    node_count: resolved.node_count,
    target_output: resolved.target_output,
    base_per_node: resolved.base_per_node,
    max_target_output: resolved.max_target_output,
    sort_order: row.sort_order,
    created_at: row.created_at,
    extraction_kind: extractionKind,
    output_rate: resolved.output_rate,
    item,
    building_name: building?.name ?? resolved.miner_slug,
    building_image: building?.image ?? null,
  };
}

function loadEnergyChainExtractions(db, chainId, getItemById) {
  ensureEnergyExtractionsTable(db);
  const rows = queryAll(
    db,
    `SELECT ${EXTRACTION_SELECT}
     FROM energy_chain_extractions
     WHERE chain_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [chainId]
  );

  return rows.map((row) => mapEnergyExtraction(row, getItemById(db, row.item_id), db));
}

function getEnergyExtractionById(db, extractionId, getItemById) {
  ensureEnergyExtractionsTable(db);
  const row = queryOne(
    db,
    `SELECT ${EXTRACTION_SELECT}
     FROM energy_chain_extractions
     WHERE id = ?`,
    [extractionId]
  );
  if (!row) return null;
  return mapEnergyExtraction(row, getItemById(db, row.item_id), db);
}

function addEnergyExtraction(db, persist, chainId, { item_id }, getItemById) {
  ensureEnergyExtractionsTable(db);

  const chainRow = queryOne(db, 'SELECT id FROM energy_chains WHERE id = ?', [chainId]);
  if (!chainRow) {
    throw new Error('Schema energia non trovato');
  }

  const item = getItemById(db, item_id);
  if (!item) {
    throw new Error('Risorsa non trovata');
  }
  if (!isEnergyExtractionItem(item)) {
    throw new Error('Seleziona acqua o carbone');
  }

  const defaults = getDefaultEnergyExtractionConfig(item);
  const resolved = resolveExtractionProduction(item, defaults);

  const sortRow = queryOne(
    db,
    'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM energy_chain_extractions WHERE chain_id = ?',
    [chainId]
  );
  const sortOrder = (sortRow?.max_order ?? -1) + 1;

  db.run(
    `INSERT INTO energy_chain_extractions
      (chain_id, item_id, miner_slug, purity, overclock, node_count, target_output, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      chainId,
      item.id,
      resolved.miner_slug,
      resolved.purity,
      resolved.overclock,
      resolved.node_count,
      resolved.target_output,
      sortOrder,
    ]
  );

  db.run(`UPDATE energy_chains SET updated_at = datetime('now') WHERE id = ?`, [chainId]);
  persist();

  const extractionId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  return getEnergyExtractionById(db, extractionId, getItemById);
}

function updateEnergyExtraction(
  db,
  persist,
  extractionId,
  { miner_slug, purity, overclock, node_count, target_output },
  getItemById
) {
  ensureEnergyExtractionsTable(db);

  const existing = queryOne(
    db,
    `SELECT ${EXTRACTION_SELECT}
     FROM energy_chain_extractions WHERE id = ?`,
    [extractionId]
  );
  if (!existing) {
    throw new Error('Estrazione non trovata');
  }

  const item = getItemById(db, existing.item_id);
  const resolved = resolveExtractionProduction(
    item,
    mergeExtractionStored(existing, {
      miner_slug,
      purity,
      overclock,
      node_count,
      target_output,
    })
  );

  db.run(
    `UPDATE energy_chain_extractions
     SET miner_slug = ?, purity = ?, overclock = ?, node_count = ?, target_output = ?
     WHERE id = ?`,
    [
      resolved.miner_slug,
      resolved.purity,
      resolved.overclock,
      resolved.node_count,
      resolved.target_output,
      extractionId,
    ]
  );
  db.run(`UPDATE energy_chains SET updated_at = datetime('now') WHERE id = ?`, [existing.chain_id]);
  persist();

  return getEnergyExtractionById(db, extractionId, getItemById);
}

function deleteEnergyExtraction(db, persist, extractionId) {
  ensureEnergyExtractionsTable(db);

  const row = queryOne(
    db,
    `SELECT id, chain_id FROM energy_chain_extractions WHERE id = ?`,
    [extractionId]
  );
  if (!row) {
    throw new Error('Estrazione non trovata');
  }

  db.run('DELETE FROM energy_chain_extractions WHERE id = ?', [extractionId]);
  db.run('DELETE FROM energy_chain_generator_links WHERE producer_extraction_id = ?', [extractionId]);
  db.run(`UPDATE energy_chains SET updated_at = datetime('now') WHERE id = ?`, [row.chain_id]);
  persist();

  return { chain_id: row.chain_id };
}

function resetEnergyExtraction(db, persist, extractionId, getItemById) {
  ensureEnergyExtractionsTable(db);

  const existing = queryOne(
    db,
    `SELECT ${EXTRACTION_SELECT}
     FROM energy_chain_extractions WHERE id = ?`,
    [extractionId]
  );
  if (!existing) {
    throw new Error('Estrazione non trovata');
  }

  const item = getItemById(db, existing.item_id);
  const defaults = getDefaultEnergyExtractionConfig(item);
  const resolved = resolveExtractionProduction(item, defaults);

  db.run(
    `UPDATE energy_chain_extractions
     SET miner_slug = ?, purity = ?, overclock = ?, node_count = ?, target_output = ?
     WHERE id = ?`,
    [
      resolved.miner_slug,
      resolved.purity,
      resolved.overclock,
      resolved.node_count,
      resolved.target_output,
      extractionId,
    ]
  );
  db.run(`UPDATE energy_chains SET updated_at = datetime('now') WHERE id = ?`, [existing.chain_id]);
  persist();

  return getEnergyExtractionById(db, extractionId, getItemById);
}

function deleteEnergyExtractionsForChain(db, chainId) {
  ensureEnergyExtractionsTable(db);
  db.run('DELETE FROM energy_chain_extractions WHERE chain_id = ?', [chainId]);
}

module.exports = {
  ENERGY_EXTRACTION_SLUGS,
  isEnergyExtractionItem,
  getEnergyExtractionKind,
  ensureEnergyExtractionsTable,
  loadEnergyChainExtractions,
  addEnergyExtraction,
  updateEnergyExtraction,
  deleteEnergyExtraction,
  resetEnergyExtraction,
  deleteEnergyExtractionsForChain,
};
