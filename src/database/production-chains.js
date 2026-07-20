const { getItemSchemaById, getItemSchemas } = require('./schemas');
const {
  loadChainExtractions,
  deleteExtractionsForChain,
  getExtractionById,
  ensureExtractionsTable,
} = require('./mineral-extraction');
const {
  getDefaultTargetOutput,
  resolveStepProduction,
  scaleSchema,
  roundProduction,
  roundMachineCount,
  outputPerMinute,
  DEFAULT_OVERCLOCK,
  DEFAULT_MACHINE_COUNT,
} = require('./production-scale');

const STEP_SELECT = `
  id, chain_id, name, item_id, item_schema_id, sort_order, group_name,
  target_output, machine_count, overclock, somersloop_mask, oc_machines_linked, marked, created_at
`;

function normalizeGroupName(name) {
  const trimmed = String(name ?? '').trim();
  return trimmed ? trimmed.toLocaleUpperCase('it') : null;
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

function ensureProductionChainStepsTable(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS production_chain_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chain_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      item_id INTEGER NOT NULL,
      item_schema_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      target_output REAL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chain_id) REFERENCES production_chains(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id),
      FOREIGN KEY (item_schema_id) REFERENCES item_schemas(id)
    );
  `);

  const info = db.exec('PRAGMA table_info(production_chain_steps)')[0]?.values ?? [];
  const cols = new Set(info.map((row) => row[1]));
  if (!cols.has('target_output')) {
    db.run('ALTER TABLE production_chain_steps ADD COLUMN target_output REAL');
  }
  if (!cols.has('machine_count')) {
    db.run(
      `ALTER TABLE production_chain_steps ADD COLUMN machine_count REAL DEFAULT ${DEFAULT_MACHINE_COUNT}`
    );
  }
  if (!cols.has('overclock')) {
    db.run(
      `ALTER TABLE production_chain_steps ADD COLUMN overclock REAL DEFAULT ${DEFAULT_OVERCLOCK}`
    );
  }
  if (!cols.has('somersloop_mask')) {
    db.run('ALTER TABLE production_chain_steps ADD COLUMN somersloop_mask INTEGER NOT NULL DEFAULT 0');
  }
  if (!cols.has('oc_machines_linked')) {
    db.run('ALTER TABLE production_chain_steps ADD COLUMN oc_machines_linked INTEGER NOT NULL DEFAULT 0');
  }
  if (!cols.has('group_name')) {
    db.run('ALTER TABLE production_chain_steps ADD COLUMN group_name TEXT');
  }
  if (!cols.has('marked')) {
    db.run('ALTER TABLE production_chain_steps ADD COLUMN marked INTEGER NOT NULL DEFAULT 0');
  }

  ensureStepLinksTable(db);
}

function ensureProductionGroupMarksTable(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS production_chain_group_marks (
      chain_id INTEGER NOT NULL,
      group_name TEXT NOT NULL,
      marked INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (chain_id, group_name),
      FOREIGN KEY (chain_id) REFERENCES production_chains(id) ON DELETE CASCADE
    );
  `);
}

function loadGroupMarks(db, chainId) {
  ensureProductionGroupMarksTable(db);
  const rows = queryAll(
    db,
    `SELECT group_name, marked
     FROM production_chain_group_marks
     WHERE chain_id = ?`,
    [chainId]
  );

  return Object.fromEntries(
    rows.map((row) => [row.group_name, Number(row.marked) === 1 ? 1 : 0])
  );
}

function isGroupMarked(db, chainId, groupName) {
  const normalized = normalizeGroupName(groupName);
  if (!normalized) return false;
  ensureProductionGroupMarksTable(db);
  const row = queryOne(
    db,
    `SELECT marked FROM production_chain_group_marks WHERE chain_id = ? AND group_name = ?`,
    [chainId, normalized]
  );
  return Number(row?.marked) === 1;
}

function clearGroupMarkForStep(db, chainId, stepId) {
  const step = queryOne(
    db,
    `SELECT group_name FROM production_chain_steps WHERE id = ? AND chain_id = ?`,
    [stepId, chainId]
  );
  const groupName = normalizeGroupName(step?.group_name);
  if (!groupName) return;

  ensureProductionGroupMarksTable(db);
  db.run(
    `UPDATE production_chain_group_marks SET marked = 0 WHERE chain_id = ? AND group_name = ?`,
    [chainId, groupName]
  );
}

function markStepIfGroupMarked(db, chainId, stepId, groupName) {
  const normalized = normalizeGroupName(groupName);
  if (!normalized || !isGroupMarked(db, chainId, normalized)) return;
  db.run('UPDATE production_chain_steps SET marked = 1 WHERE id = ?', [stepId]);
}

function ensureStepLinksTable(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS production_chain_step_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chain_id INTEGER NOT NULL,
      consumer_step_id INTEGER NOT NULL,
      producer_step_id INTEGER,
      producer_extraction_id INTEGER,
      item_slug TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chain_id) REFERENCES production_chains(id) ON DELETE CASCADE,
      FOREIGN KEY (consumer_step_id) REFERENCES production_chain_steps(id) ON DELETE CASCADE,
      FOREIGN KEY (producer_step_id) REFERENCES production_chain_steps(id) ON DELETE CASCADE,
      FOREIGN KEY (producer_extraction_id) REFERENCES production_chain_extractions(id) ON DELETE CASCADE
    );
  `);

  const info = db.exec('PRAGMA table_info(production_chain_step_links)')[0]?.values ?? [];
  const cols = new Set(info.map((row) => row[1]));
  if (!cols.has('producer_extraction_id')) {
    db.run('ALTER TABLE production_chain_step_links ADD COLUMN producer_extraction_id INTEGER');
  }

  migrateStepLinksNullableProducer(db);
}

function migrateStepLinksNullableProducer(db) {
  const info = db.exec('PRAGMA table_info(production_chain_step_links)')[0]?.values ?? [];
  if (!info.length) return;

  const producerStepCol = info.find((row) => row[1] === 'producer_step_id');
  if (!producerStepCol || producerStepCol[3] !== 1) return;

  db.run(`
    CREATE TABLE production_chain_step_links_migrated (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chain_id INTEGER NOT NULL,
      consumer_step_id INTEGER NOT NULL,
      producer_step_id INTEGER,
      producer_extraction_id INTEGER,
      item_slug TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chain_id) REFERENCES production_chains(id) ON DELETE CASCADE,
      FOREIGN KEY (consumer_step_id) REFERENCES production_chain_steps(id) ON DELETE CASCADE,
      FOREIGN KEY (producer_step_id) REFERENCES production_chain_steps(id) ON DELETE CASCADE,
      FOREIGN KEY (producer_extraction_id) REFERENCES production_chain_extractions(id) ON DELETE CASCADE
    );
  `);

  db.run(`
    INSERT INTO production_chain_step_links_migrated
      (id, chain_id, consumer_step_id, producer_step_id, producer_extraction_id, item_slug, created_at)
    SELECT id, chain_id, consumer_step_id, producer_step_id, producer_extraction_id, item_slug, created_at
    FROM production_chain_step_links
  `);

  db.run('DROP TABLE production_chain_step_links');
  db.run('ALTER TABLE production_chain_step_links_migrated RENAME TO production_chain_step_links');
}

const LINK_BALANCE_TOLERANCE = 0.05;

function getStepOutputRateForItem(step, itemSlug) {
  const io = (step.scaled_outputs ?? []).find((output) => output.item_slug === itemSlug);
  if (!io || !step.schema?.duration) return 0;
  return roundProduction(outputPerMinute(io.amount, step.schema.duration));
}

function getStepInputRateForItem(step, itemSlug) {
  const io = (step.scaled_inputs ?? []).find((input) => input.item_slug === itemSlug);
  if (!io || !step.schema?.duration) return 0;
  return roundProduction(outputPerMinute(io.amount, step.schema.duration));
}

function normalizeLinkDelta(rawDelta, referenceRate = 0) {
  const delta = roundProduction(Math.max(0, Number(rawDelta)));
  if (!Number.isFinite(delta) || delta <= 0) return 0;
  const ref = Math.max(Number(referenceRate) || 0, 0);
  const tolerance = Math.max(LINK_BALANCE_TOLERANCE, ref * 0.001);
  return delta <= tolerance ? 0 : delta;
}

function getProducerAllocations(producer, itemSlug, steps) {
  const outputRate = getStepOutputRateForItem(producer, itemSlug);
  if (!outputRate) return new Map();

  const consumers = steps
    .filter((candidate) => Number(candidate.id) !== Number(producer.id))
    .filter((candidate) =>
      (candidate.input_links?.[itemSlug] ?? []).some(
        (link) => Number(link.producer_step_id) === Number(producer.id)
      )
    )
    .sort(
      (left, right) =>
        (left.sort_order ?? 0) - (right.sort_order ?? 0) || Number(left.id) - Number(right.id)
    );

  let remaining = outputRate;
  const allocations = new Map();

  for (const consumer of consumers) {
    const required = getStepInputRateForItem(consumer, itemSlug);
    const take = roundProduction(Math.min(remaining, required));
    if (take <= 0) {
      allocations.set(consumer.id, 0);
      continue;
    }

    allocations.set(consumer.id, take);
    remaining = roundProduction(Math.max(0, remaining - take));
    if (remaining <= LINK_BALANCE_TOLERANCE) break;
  }

  return allocations;
}

function getProducerAttributedDemand(producer, consumer, itemSlug, steps) {
  return getProducerAllocations(producer, itemSlug, steps).get(consumer.id) ?? 0;
}

function getTotalDemandForOutput(producer, itemSlug, steps) {
  let demand = 0;
  for (const take of getProducerAllocations(producer, itemSlug, steps).values()) {
    demand += take;
  }
  return roundProduction(demand);
}

function getExtractionOutputRate(extraction) {
  return roundProduction(Number(extraction?.output_rate) || 0);
}

function extractionDisplayName(extraction, allExtractions) {
  const baseName = extraction.item?.name || 'Risorsa';
  const sameItem = allExtractions.filter((item) => item.item_id === extraction.item_id);
  if (sameItem.length <= 1) return baseName;
  const index = sameItem.findIndex((item) => item.id === extraction.id);
  return `${baseName} #${index + 1}`;
}

function loadChainLinks(db, chainId) {
  ensureStepLinksTable(db);
  return queryAll(
    db,
    `SELECT id, chain_id, consumer_step_id, producer_step_id, producer_extraction_id, item_slug
     FROM production_chain_step_links
     WHERE chain_id = ?
     ORDER BY id ASC`,
    [chainId]
  );
}

function attachLinksToSteps(steps, links, extractions = []) {
  const stepMap = new Map(steps.map((step) => [step.id, step]));
  const extractionMap = new Map(extractions.map((extraction) => [extraction.id, extraction]));

  steps.forEach((step) => {
    step.input_links = {};
  });

  for (const link of links) {
    const consumer = stepMap.get(link.consumer_step_id);
    if (!consumer) continue;

    let entry = null;

    if (link.producer_step_id) {
      const producer = stepMap.get(link.producer_step_id);
      if (!producer) continue;

      entry = {
        id: link.id,
        item_slug: link.item_slug,
        producer_step_id: link.producer_step_id,
        producer_name: producer.name,
        producer_rate: getStepOutputRateForItem(producer, link.item_slug),
      };
    } else if (link.producer_extraction_id) {
      const extraction = extractionMap.get(link.producer_extraction_id);
      if (!extraction) continue;

      entry = {
        id: link.id,
        item_slug: link.item_slug,
        producer_extraction_id: link.producer_extraction_id,
        producer_name: extractionDisplayName(extraction, extractions),
        producer_rate: getExtractionOutputRate(extraction),
      };
    }

    if (!entry) continue;

    if (!consumer.input_links[link.item_slug]) {
      consumer.input_links[link.item_slug] = [];
    }
    consumer.input_links[link.item_slug].push(entry);
  }

  return steps;
}

function mapChain(row) {
  return {
    id: row.id,
    name: row.name,
    target_item_slug: row.target_item_slug,
    target_rate: row.target_rate,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapStep(row, item, schema) {
  const production = schema
    ? resolveStepProduction(schema, item, row)
    : {
        base_per_min: getDefaultTargetOutput(schema, item),
        target_output: getDefaultTargetOutput(schema, item),
        machine_count: DEFAULT_MACHINE_COUNT,
        overclock: DEFAULT_OVERCLOCK,
        somersloop_mask: 0,
      };

  const scaled = schema
    ? scaleSchema(schema, item, production.target_output, production.somersloop_mask, production.overclock)
    : null;

  return {
    id: row.id,
    chain_id: row.chain_id,
    name: row.name,
    item_id: row.item_id,
    item_schema_id: row.item_schema_id,
    sort_order: row.sort_order,
    group_name: normalizeGroupName(row.group_name),
    base_per_min: production.base_per_min,
    target_output: production.target_output,
    machine_count: production.machine_count,
    overclock: production.overclock,
    somersloop_mask: production.somersloop_mask,
    oc_machines_linked: production.oc_machines_linked ? 1 : 0,
    marked: Number(row.marked) === 1 ? 1 : 0,
    created_at: row.created_at,
    item,
    schema,
    scaled_inputs: scaled?.inputs ?? [],
    scaled_outputs: scaled?.outputs ?? [],
  };
}

function schemaNameForStep(schema) {
  const name = String(schema?.name ?? '').trim();
  return name.replace(/^Alternativo:\s*/i, '') || 'Schema';
}

function generateStepName(db, chainId, itemSchemaId, schemaName) {
  const countRow = queryOne(
    db,
    `SELECT COUNT(*) AS count
     FROM production_chain_steps
     WHERE chain_id = ? AND item_schema_id = ?`,
    [chainId, itemSchemaId]
  );
  const nextNum = (countRow?.count ?? 0) + 1;
  const baseName = String(schemaName ?? '').trim() || 'Schema';
  return `${baseName} #${nextNum}`;
}

function loadChainSteps(db, chainId, getItemById) {
  const rows = queryAll(
    db,
    `SELECT ${STEP_SELECT}
     FROM production_chain_steps
     WHERE chain_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [chainId]
  );

  return rows.map((row) => {
    const item = getItemById(db, row.item_id);
    const schema = getItemSchemaById(db, row.item_schema_id);
    return mapStep(row, item, schema);
  });
}

function getStepById(db, stepId, getItemById) {
  const row = queryOne(
    db,
    `SELECT ${STEP_SELECT}
     FROM production_chain_steps
     WHERE id = ?`,
    [stepId]
  );
  if (!row) return null;

  const item = getItemById(db, row.item_id);
  const schema = getItemSchemaById(db, row.item_schema_id);
  return mapStep(row, item, schema);
}

function listProductionChains(db) {
  ensureProductionChainStepsTable(db);
  return queryAll(
    db,
    `SELECT id, name, target_item_slug, target_rate, notes, created_at, updated_at
     FROM production_chains
     ORDER BY updated_at DESC, name ASC`
  ).map(mapChain);
}

function getProductionChainById(db, id) {
  ensureProductionChainStepsTable(db);
  const row = queryOne(
    db,
    `SELECT id, name, target_item_slug, target_rate, notes, created_at, updated_at
     FROM production_chains
     WHERE id = ?`,
    [id]
  );
  return row ? mapChain(row) : null;
}

function getProductionChainDetail(db, chainId, getItemById) {
  ensureProductionChainStepsTable(db);
  const chain = getProductionChainById(db, chainId);
  if (!chain) return null;

  const steps = loadChainSteps(db, chainId, getItemById);
  const extractions = loadChainExtractions(db, chainId, getItemById);
  const links = loadChainLinks(db, chainId);
  attachLinksToSteps(steps, links, extractions);
  const group_marks = loadGroupMarks(db, chainId);
  return { chain, steps, extractions, links, group_marks };
}

function createProductionChain(db, persist, { name }) {
  ensureProductionChainStepsTable(db);
  const trimmed = String(name ?? '').trim();
  if (!trimmed) {
    throw new Error('Il nome è obbligatorio');
  }

  db.run(
    `INSERT INTO production_chains (name, updated_at)
     VALUES (?, datetime('now'))`,
    [trimmed]
  );

  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  persist();
  return getProductionChainById(db, id);
}

function updateProductionChain(db, persist, id, { name }) {
  ensureProductionChainStepsTable(db);
  const chain = getProductionChainById(db, id);
  if (!chain) {
    throw new Error('Schema non trovato');
  }

  const trimmed = String(name ?? '').trim();
  if (!trimmed) {
    throw new Error('Il nome è obbligatorio');
  }

  db.run(`UPDATE production_chains SET name = ?, updated_at = datetime('now') WHERE id = ?`, [
    trimmed,
    id,
  ]);
  persist();
  return getProductionChainById(db, id);
}

function addProductionChainStep(
  db,
  persist,
  chainId,
  { item_id, item_schema_id, group_name },
  getItemById
) {
  ensureProductionChainStepsTable(db);

  const chain = getProductionChainById(db, chainId);
  if (!chain) {
    throw new Error('Schema di produzione non trovato');
  }

  const item = getItemById(db, item_id);
  if (!item) {
    throw new Error('Risorsa non trovata');
  }

  const schema = getItemSchemaById(db, item_schema_id);
  if (!schema || schema.item_id !== item.id) {
    throw new Error('Schema risorsa non valido');
  }

  const sortRow = queryOne(
    db,
    'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM production_chain_steps WHERE chain_id = ?',
    [chainId]
  );
  const sortOrder = (sortRow?.max_order ?? -1) + 1;
  const stepName = generateStepName(db, chainId, schema.id, schemaNameForStep(schema));
  const targetOutput = getDefaultTargetOutput(schema, item);
  const normalizedGroupName = normalizeGroupName(group_name);

  db.run(
    `INSERT INTO production_chain_steps
      (chain_id, name, item_id, item_schema_id, sort_order, group_name, target_output, machine_count, overclock, somersloop_mask, oc_machines_linked)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      chainId,
      stepName,
      item.id,
      schema.id,
      sortOrder,
      normalizedGroupName,
      targetOutput,
      DEFAULT_MACHINE_COUNT,
      DEFAULT_OVERCLOCK,
      0,
      0,
    ]
  );

  db.run(`UPDATE production_chains SET updated_at = datetime('now') WHERE id = ?`, [chainId]);

  const stepId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  markStepIfGroupMarked(db, chainId, stepId, normalizedGroupName);
  persist();
  return getStepById(db, stepId, getItemById);
}

function updateProductionChainStep(
  db,
  persist,
  stepId,
  { target_output, machine_count, overclock, somersloop_mask, oc_machines_linked },
  getItemById
) {
  ensureProductionChainStepsTable(db);

  const existing = queryOne(
    db,
    `SELECT id, chain_id, oc_machines_linked FROM production_chain_steps WHERE id = ?`,
    [stepId]
  );
  if (!existing) {
    throw new Error('Schema risorsa non trovato');
  }

  const target = roundProduction(target_output);
  const machines = roundMachineCount(machine_count);
  const oc = roundProduction(overclock);
  const somersloopMask = Number.isFinite(Number(somersloop_mask))
    ? Number(somersloop_mask) & 15
    : 0;
  const linked =
    oc_machines_linked === undefined
      ? Number(existing.oc_machines_linked) === 1
      : Boolean(oc_machines_linked);

  if (!Number.isFinite(target) || target <= 0) {
    throw new Error('Output non valido');
  }
  if (!Number.isFinite(machines) || machines <= 0) {
    throw new Error('Numero macchine non valido');
  }
  if (!Number.isFinite(oc) || oc < 1 || oc > 250) {
    throw new Error('Overclock non valido (1–250%)');
  }

  db.run(
    `UPDATE production_chain_steps
     SET target_output = ?, machine_count = ?, overclock = ?, somersloop_mask = ?, oc_machines_linked = ?
     WHERE id = ?`,
    [target, machines, oc, somersloopMask, linked ? 1 : 0, stepId]
  );
  db.run(`UPDATE production_chains SET updated_at = datetime('now') WHERE id = ?`, [
    existing.chain_id,
  ]);
  persist();
  return getStepById(db, stepId, getItemById);
}

function setProductionStepMarked(db, persist, stepId, marked, getItemById) {
  ensureProductionChainStepsTable(db);

  const existing = queryOne(
    db,
    `SELECT id, chain_id FROM production_chain_steps WHERE id = ?`,
    [stepId]
  );
  if (!existing) {
    throw new Error('Schema risorsa non trovato');
  }

  db.run('UPDATE production_chain_steps SET marked = ? WHERE id = ?', [marked ? 1 : 0, stepId]);
  if (!marked) {
    clearGroupMarkForStep(db, existing.chain_id, stepId);
  }
  db.run(`UPDATE production_chains SET updated_at = datetime('now') WHERE id = ?`, [existing.chain_id]);
  persist();
  return getProductionChainDetail(db, existing.chain_id, getItemById);
}

function setProductionGroupMarked(db, persist, chainId, groupName, marked, getItemById) {
  ensureProductionChainStepsTable(db);
  ensureProductionGroupMarksTable(db);

  const normalized = normalizeGroupName(groupName);
  if (!normalized) {
    throw new Error('Raggruppamento non valido');
  }

  const chain = getProductionChainById(db, chainId);
  if (!chain) {
    throw new Error('Schema di produzione non trovato');
  }

  const steps = loadChainSteps(db, chainId, getItemById);
  const inGroup = steps.some((step) => normalizeGroupName(step.group_name) === normalized);
  if (!inGroup) {
    throw new Error('Raggruppamento non trovato');
  }

  db.run(
    `INSERT INTO production_chain_group_marks (chain_id, group_name, marked)
     VALUES (?, ?, ?)
     ON CONFLICT(chain_id, group_name) DO UPDATE SET marked = excluded.marked`,
    [chainId, normalized, marked ? 1 : 0]
  );
  db.run(
    `UPDATE production_chain_steps SET marked = ?
     WHERE chain_id = ? AND group_name = ?`,
    [marked ? 1 : 0, chainId, normalized]
  );
  db.run(`UPDATE production_chains SET updated_at = datetime('now') WHERE id = ?`, [chainId]);
  persist();
  return getProductionChainDetail(db, chainId, getItemById);
}

function resetProductionChainStep(db, persist, stepId, getItemById) {
  ensureProductionChainStepsTable(db);
  ensureStepLinksTable(db);

  const step = getStepById(db, stepId, getItemById);
  if (!step) {
    throw new Error('Schema risorsa non trovato');
  }

  const defaultOutput = getDefaultTargetOutput(step.schema, step.item);

  db.run(
    `UPDATE production_chain_steps
     SET target_output = ?, machine_count = ?, overclock = ?, somersloop_mask = ?, oc_machines_linked = 0
     WHERE id = ?`,
    [defaultOutput, DEFAULT_MACHINE_COUNT, DEFAULT_OVERCLOCK, 0, stepId]
  );
  db.run('DELETE FROM production_chain_step_links WHERE consumer_step_id = ?', [stepId]);
  db.run('DELETE FROM production_chain_step_links WHERE producer_step_id = ?', [stepId]);
  db.run(`UPDATE production_chains SET updated_at = datetime('now') WHERE id = ?`, [step.chain_id]);
  persist();

  return getProductionChainDetail(db, step.chain_id, getItemById);
}

function deleteProductionChainStep(db, persist, stepId) {
  ensureProductionChainStepsTable(db);

  const step = queryOne(
    db,
    `SELECT id, chain_id, name FROM production_chain_steps WHERE id = ?`,
    [stepId]
  );
  if (!step) {
    throw new Error('Schema risorsa non trovato');
  }

  db.run('DELETE FROM production_chain_steps WHERE id = ?', [stepId]);
  db.run(`UPDATE production_chains SET updated_at = datetime('now') WHERE id = ?`, [step.chain_id]);
  persist();
  return { deleted: true, id: step.id, chain_id: step.chain_id, name: step.name };
}

function reorderProductionChainSteps(db, persist, chainId, orderedStepIds, getItemById) {
  ensureProductionChainStepsTable(db);

  const chain = getProductionChainById(db, chainId);
  if (!chain) {
    throw new Error('Schema di produzione non trovato');
  }

  const ids = (orderedStepIds ?? []).map((id) => Number(id)).filter(Boolean);
  const existing = loadChainSteps(db, chainId, getItemById);
  const existingIds = new Set(existing.map((step) => step.id));

  if (ids.length !== existing.length) {
    throw new Error('Ordine schemi risorsa non valido');
  }

  for (const id of ids) {
    if (!existingIds.has(id)) {
      throw new Error('Schema risorsa non trovato');
    }
  }

  ids.forEach((id, index) => {
    db.run(
      'UPDATE production_chain_steps SET sort_order = ? WHERE id = ? AND chain_id = ?',
      [index, id, chainId]
    );
  });

  db.run(`UPDATE production_chains SET updated_at = datetime('now') WHERE id = ?`, [chainId]);
  persist();
  return getProductionChainDetail(db, chainId, getItemById);
}

function reorderProductionChainStepsInGroup(
  db,
  persist,
  chainId,
  groupName,
  orderedStepIdsInGroup,
  getItemById
) {
  ensureProductionChainStepsTable(db);

  const normalizedGroup = normalizeGroupName(groupName);
  const allSteps = loadChainSteps(db, chainId, getItemById);
  const groupSteps = allSteps.filter(
    (step) => normalizeGroupName(step.group_name) === normalizedGroup
  );
  const groupIds = new Set(groupSteps.map((step) => step.id));

  const newGroupOrder = (orderedStepIdsInGroup ?? []).map((id) => Number(id)).filter(Boolean);
  if (newGroupOrder.length !== groupSteps.length) {
    throw new Error('Ordine schemi risorsa non valido');
  }

  for (const id of newGroupOrder) {
    if (!groupIds.has(id)) {
      throw new Error('Schema risorsa non trovato');
    }
  }

  const merged = [];
  let groupInserted = false;

  for (const step of allSteps) {
    if (groupIds.has(step.id)) {
      if (!groupInserted) {
        merged.push(...newGroupOrder);
        groupInserted = true;
      }
      continue;
    }
    merged.push(step.id);
  }

  if (!groupInserted) {
    merged.push(...newGroupOrder);
  }

  return reorderProductionChainSteps(db, persist, chainId, merged, getItemById);
}

const PRODUCTION_GROUP_KEY_UNGROUPED = '__ungrouped__';

function normalizeProductionGroupKey(key) {
  if (key == null || String(key).trim() === '' || String(key) === PRODUCTION_GROUP_KEY_UNGROUPED) {
    return PRODUCTION_GROUP_KEY_UNGROUPED;
  }
  return normalizeGroupName(key);
}

function groupKeyFromStep(step) {
  return normalizeGroupName(step.group_name) ?? PRODUCTION_GROUP_KEY_UNGROUPED;
}

function reorderProductionChainGroups(db, persist, chainId, orderedGroupKeys, getItemById) {
  ensureProductionChainStepsTable(db);

  const chain = getProductionChainById(db, chainId);
  if (!chain) {
    throw new Error('Schema di produzione non trovato');
  }

  const allSteps = loadChainSteps(db, chainId, getItemById);
  const stepsByGroup = new Map();

  for (const step of allSteps) {
    const key = groupKeyFromStep(step);
    if (!stepsByGroup.has(key)) stepsByGroup.set(key, []);
    stepsByGroup.get(key).push(step);
  }

  for (const groupSteps of stepsByGroup.values()) {
    groupSteps.sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || Number(a.id) - Number(b.id)
    );
  }

  const keys = (orderedGroupKeys ?? []).map((key) => normalizeProductionGroupKey(key));
  if (keys.length !== stepsByGroup.size) {
    throw new Error('Ordine raggruppamenti non valido');
  }

  const seen = new Set();
  for (const key of keys) {
    if (!stepsByGroup.has(key) || seen.has(key)) {
      throw new Error('Ordine raggruppamenti non valido');
    }
    seen.add(key);
  }

  const merged = [];
  for (const key of keys) {
    merged.push(...stepsByGroup.get(key).map((step) => step.id));
  }

  return reorderProductionChainSteps(db, persist, chainId, merged, getItemById);
}

function setProductionStepGroupName(db, persist, stepId, groupName, getItemById) {
  ensureProductionChainStepsTable(db);

  const row = queryOne(
    db,
    `SELECT id, chain_id, group_name FROM production_chain_steps WHERE id = ?`,
    [stepId]
  );
  if (!row) {
    throw new Error('Schema risorsa non trovato');
  }

  const newGroup = normalizeGroupName(groupName);
  const oldGroup = normalizeGroupName(row.group_name);
  if (newGroup === oldGroup) {
    return getProductionChainDetail(db, row.chain_id, getItemById);
  }

  db.run('UPDATE production_chain_steps SET group_name = ? WHERE id = ?', [newGroup, stepId]);
  markStepIfGroupMarked(db, row.chain_id, stepId, newGroup);

  const allSteps = loadChainSteps(db, row.chain_id, getItemById);
  const withoutMoved = allSteps.filter((step) => step.id !== stepId).map((step) => step.id);

  let insertIndex = withoutMoved.length;
  for (let index = withoutMoved.length - 1; index >= 0; index -= 1) {
    const step = allSteps.find((entry) => entry.id === withoutMoved[index]);
    if (normalizeGroupName(step?.group_name) === newGroup) {
      insertIndex = index + 1;
      break;
    }
    if (index === 0 && newGroup === null) {
      insertIndex = 0;
    }
  }

  const merged = [
    ...withoutMoved.slice(0, insertIndex),
    Number(stepId),
    ...withoutMoved.slice(insertIndex),
  ];

  merged.forEach((id, index) => {
    db.run(
      'UPDATE production_chain_steps SET sort_order = ? WHERE id = ? AND chain_id = ?',
      [index, id, row.chain_id]
    );
  });

  db.run(`UPDATE production_chains SET updated_at = datetime('now') WHERE id = ?`, [row.chain_id]);
  persist();
  return getProductionChainDetail(db, row.chain_id, getItemById);
}

function renameProductionStepGroup(db, persist, chainId, oldGroupName, newGroupName, getItemById) {
  ensureProductionChainStepsTable(db);

  const chain = getProductionChainById(db, chainId);
  if (!chain) {
    throw new Error('Schema di produzione non trovato');
  }

  const oldGroup = normalizeGroupName(oldGroupName);
  const newGroup = normalizeGroupName(newGroupName);

  if (!oldGroup) {
    throw new Error('Non puoi rinominare «Senza gruppo»');
  }
  if (!newGroup) {
    throw new Error('Il nome del raggruppamento è obbligatorio');
  }
  if (oldGroup === newGroup) {
    return getProductionChainDetail(db, chainId, getItemById);
  }

  const steps = loadChainSteps(db, chainId, getItemById);
  const inOldGroup = steps.filter((step) => normalizeGroupName(step.group_name) === oldGroup);
  if (!inOldGroup.length) {
    throw new Error('Raggruppamento non trovato');
  }

  const targetExists = steps.some(
    (step) =>
      normalizeGroupName(step.group_name) === newGroup &&
      !inOldGroup.some((member) => member.id === step.id)
  );
  if (targetExists) {
    throw new Error(`Esiste già un raggruppamento «${newGroup}»`);
  }

  db.run(
    'UPDATE production_chain_steps SET group_name = ? WHERE chain_id = ? AND group_name = ?',
    [newGroup, chainId, oldGroup]
  );
  ensureProductionGroupMarksTable(db);
  db.run(
    `UPDATE production_chain_group_marks SET group_name = ?
     WHERE chain_id = ? AND group_name = ?`,
    [newGroup, chainId, oldGroup]
  );
  db.run(`UPDATE production_chains SET updated_at = datetime('now') WHERE id = ?`, [chainId]);
  persist();
  return getProductionChainDetail(db, chainId, getItemById);
}

function setProductionStepInputLinks(
  db,
  persist,
  consumerStepId,
  itemSlug,
  producerStepIds,
  getItemById
) {
  ensureProductionChainStepsTable(db);

  const consumer = getStepById(db, consumerStepId, getItemById);
  if (!consumer) {
    throw new Error('Schema risorsa non trovato');
  }

  const slug = String(itemSlug ?? '').trim();
  if (!slug) {
    throw new Error('Risorsa non valida');
  }

  const hasInput = (consumer.scaled_inputs ?? []).some((io) => io.item_slug === slug);
  if (!hasInput) {
    throw new Error('Questo schema non richiede la risorsa indicata');
  }

  const chainId = consumer.chain_id;
  const producers = [...new Set((producerStepIds ?? []).map((id) => Number(id)).filter(Boolean))];

  for (const producerId of producers) {
    if (producerId === consumerStepId) {
      throw new Error('Non puoi collegare uno schema risorsa a sé stesso');
    }

    const producer = getStepById(db, producerId, getItemById);
    if (!producer || producer.chain_id !== chainId) {
      throw new Error('Schema produttore non valido');
    }

    const hasOutput = (producer.scaled_outputs ?? []).some((io) => io.item_slug === slug);
    if (!hasOutput) {
      throw new Error(`«${producer.name}» non produce ${slug}`);
    }
  }

  db.run(
    `DELETE FROM production_chain_step_links
     WHERE consumer_step_id = ? AND item_slug = ? AND producer_step_id IS NOT NULL`,
    [consumerStepId, slug]
  );

  for (const producerId of producers) {
    if (!producerId) continue;
    db.run(
      `INSERT INTO production_chain_step_links
        (chain_id, consumer_step_id, producer_step_id, item_slug)
       VALUES (?, ?, ?, ?)`,
      [chainId, consumerStepId, producerId, slug]
    );
  }

  db.run(`UPDATE production_chains SET updated_at = datetime('now') WHERE id = ?`, [chainId]);
  persist();
  return getProductionChainDetail(db, chainId, getItemById);
}

function setProductionStepExtractionLinks(
  db,
  persist,
  consumerStepId,
  itemSlug,
  producerExtractionIds,
  getItemById
) {
  ensureProductionChainStepsTable(db);

  const consumer = getStepById(db, consumerStepId, getItemById);
  if (!consumer) {
    throw new Error('Schema risorsa non trovato');
  }

  const slug = String(itemSlug ?? '').trim();
  if (!slug) {
    throw new Error('Risorsa non valida');
  }

  const hasInput = (consumer.scaled_inputs ?? []).some((io) => io.item_slug === slug);
  if (!hasInput) {
    throw new Error('Questo schema non richiede la risorsa indicata');
  }

  const chainId = consumer.chain_id;
  const producers = [
    ...new Set((producerExtractionIds ?? []).map((id) => Number(id)).filter(Boolean)),
  ];

  for (const extractionId of producers) {
    const extraction = getExtractionById(db, extractionId, getItemById);
    if (!extraction || extraction.chain_id !== chainId) {
      throw new Error('Estrazione non valida');
    }
    if (extraction.item?.slug !== slug) {
      throw new Error(`L'estrazione selezionata non produce ${slug}`);
    }
  }

  db.run(
    `DELETE FROM production_chain_step_links
     WHERE consumer_step_id = ? AND item_slug = ? AND producer_extraction_id IS NOT NULL`,
    [consumerStepId, slug]
  );

  for (const extractionId of producers) {
    if (!extractionId) continue;
    db.run(
      `INSERT INTO production_chain_step_links
        (chain_id, consumer_step_id, producer_extraction_id, item_slug)
       VALUES (?, ?, ?, ?)`,
      [chainId, consumerStepId, extractionId, slug]
    );
  }

  db.run(`UPDATE production_chains SET updated_at = datetime('now') WHERE id = ?`, [chainId]);
  persist();
  return getProductionChainDetail(db, chainId, getItemById);
}

function getLinkedConsumerStepIds(links, consumerStepId, itemSlug, producerStepId) {
  return links.some(
    (link) =>
      link.consumer_step_id === consumerStepId &&
      link.item_slug === itemSlug &&
      link.producer_step_id === producerStepId
  );
}

function computeChainObjectives(steps, links) {
  attachLinksToSteps(steps, links);
  const objectives = [];

  for (const step of steps) {
    for (const io of step.scaled_outputs ?? []) {
      const rate = getStepOutputRateForItem(step, io.item_slug);
      if (!rate) continue;

      const totalDemand = getTotalDemandForOutput(step, io.item_slug, steps);
      const excessRate = normalizeLinkDelta(rate - totalDemand, rate);
      if (excessRate <= 0) continue;

      objectives.push({
        step_id: step.id,
        step_name: step.name,
        item_slug: io.item_slug,
        item_name: io.item_name || io.item_slug,
        item_image: io.item_image ?? null,
        is_fluid: Boolean(io.is_fluid),
        rate,
        excess_rate: excessRate,
      });
    }
  }

  return objectives;
}

function listAllProductionObjectives(db, getItemById) {
  ensureProductionChainStepsTable(db);
  const chains = listProductionChains(db);
  const results = [];

  for (const chain of chains) {
    const steps = loadChainSteps(db, chain.id, getItemById);
    const links = loadChainLinks(db, chain.id);
    const objectives = computeChainObjectives(steps, links);

    for (const objective of objectives) {
      results.push({
        ...objective,
        chain_id: chain.id,
        chain_name: chain.name,
      });
    }
  }

  return results.sort((a, b) => {
    const chainCmp = a.chain_name.localeCompare(b.chain_name, 'it');
    if (chainCmp !== 0) return chainCmp;
    const stepCmp = a.step_name.localeCompare(b.step_name, 'it');
    if (stepCmp !== 0) return stepCmp;
    return a.item_name.localeCompare(b.item_name, 'it');
  });
}

function deleteProductionChain(db, persist, id) {
  ensureProductionChainStepsTable(db);
  const chain = getProductionChainById(db, id);
  if (!chain) {
    throw new Error('Schema non trovato');
  }

  db.run('DELETE FROM production_chain_steps WHERE chain_id = ?', [id]);
  deleteExtractionsForChain(db, id);
  db.run('DELETE FROM production_chains WHERE id = ?', [id]);
  persist();
  return { deleted: true, id: chain.id, name: chain.name };
}

function duplicateProductionChain(db, persist, sourceId, getItemById) {
  ensureProductionChainStepsTable(db);
  ensureExtractionsTable(db);
  ensureStepLinksTable(db);
  ensureProductionGroupMarksTable(db);

  const detail = getProductionChainDetail(db, sourceId, getItemById);
  if (!detail) {
    throw new Error('Schema non trovato');
  }

  const { chain, steps, extractions, links, group_marks } = detail;
  const copyName = `${chain.name} (copia)`;

  db.run(
    `INSERT INTO production_chains (name, target_item_slug, target_rate, notes, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))`,
    [copyName, chain.target_item_slug ?? null, chain.target_rate ?? null, chain.notes ?? null]
  );
  const newChainId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

  const extractionIdMap = new Map();
  for (const extraction of extractions) {
    db.run(
      `INSERT INTO production_chain_extractions
        (chain_id, item_id, miner_slug, purity, overclock, node_count, target_output, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newChainId,
        extraction.item_id,
        extraction.miner_slug,
        extraction.purity,
        extraction.overclock,
        extraction.node_count,
        extraction.target_output,
        extraction.sort_order,
      ]
    );
    const newExtractionId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    extractionIdMap.set(extraction.id, newExtractionId);
  }

  const stepIdMap = new Map();
  for (const step of steps) {
    db.run(
      `INSERT INTO production_chain_steps
        (chain_id, name, item_id, item_schema_id, sort_order, group_name, target_output,
         machine_count, overclock, somersloop_mask, oc_machines_linked, marked)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newChainId,
        step.name,
        step.item_id,
        step.item_schema_id,
        step.sort_order,
        step.group_name,
        step.target_output,
        step.machine_count,
        step.overclock,
        step.somersloop_mask ?? 0,
        step.oc_machines_linked ? 1 : 0,
        step.marked ? 1 : 0,
      ]
    );
    const newStepId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
    stepIdMap.set(step.id, newStepId);
  }

  for (const link of links) {
    const consumerStepId = stepIdMap.get(link.consumer_step_id);
    if (!consumerStepId) continue;

    const producerStepId = link.producer_step_id
      ? stepIdMap.get(link.producer_step_id) ?? null
      : null;
    const producerExtractionId = link.producer_extraction_id
      ? extractionIdMap.get(link.producer_extraction_id) ?? null
      : null;

    if (!producerStepId && !producerExtractionId) continue;

    db.run(
      `INSERT INTO production_chain_step_links
        (chain_id, consumer_step_id, producer_step_id, producer_extraction_id, item_slug)
       VALUES (?, ?, ?, ?, ?)`,
      [newChainId, consumerStepId, producerStepId, producerExtractionId, link.item_slug]
    );
  }

  for (const [groupName, marked] of Object.entries(group_marks ?? {})) {
    const normalized = normalizeGroupName(groupName);
    if (!normalized) continue;
    db.run(
      `INSERT INTO production_chain_group_marks (chain_id, group_name, marked)
       VALUES (?, ?, ?)`,
      [newChainId, normalized, Number(marked) === 1 ? 1 : 0]
    );
  }

  persist();
  return getProductionChainById(db, newChainId);
}

function exportProductionChain(db, sourceId, getItemById, { appVersion = null } = {}) {
  const detail = getProductionChainDetail(db, sourceId, getItemById);
  if (!detail) {
    throw new Error('Schema non trovato');
  }

  const { chain, steps, extractions, links, group_marks } = detail;

  const extractionRefById = new Map();
  const exportedExtractions = extractions.map((extraction, index) => {
    const ref = `e${index + 1}`;
    extractionRefById.set(extraction.id, ref);
    return {
      ref,
      item_slug: extraction.item?.slug ?? null,
      miner_slug: extraction.miner_slug,
      purity: extraction.purity,
      overclock: extraction.overclock,
      node_count: extraction.node_count,
      target_output: extraction.target_output,
      sort_order: extraction.sort_order,
    };
  });

  const stepRefById = new Map();
  const exportedSteps = steps.map((step, index) => {
    const ref = `s${index + 1}`;
    stepRefById.set(step.id, ref);
    return {
      ref,
      name: step.name,
      item_slug: step.item?.slug ?? null,
      schema_name: step.schema?.name ?? null,
      schema_is_alternative: Boolean(step.schema?.is_alternative),
      schema_building_slug: step.schema?.building_slug ?? null,
      group_name: step.group_name,
      sort_order: step.sort_order,
      target_output: step.target_output,
      machine_count: step.machine_count,
      overclock: step.overclock,
      somersloop_mask: step.somersloop_mask ?? 0,
      oc_machines_linked: step.oc_machines_linked ? 1 : 0,
      marked: step.marked ? 1 : 0,
    };
  });

  const exportedLinks = links
    .map((link) => {
      const consumerRef = stepRefById.get(link.consumer_step_id);
      if (!consumerRef) return null;
      return {
        consumer_ref: consumerRef,
        producer_step_ref: link.producer_step_id
          ? stepRefById.get(link.producer_step_id) ?? null
          : null,
        producer_extraction_ref: link.producer_extraction_id
          ? extractionRefById.get(link.producer_extraction_id) ?? null
          : null,
        item_slug: link.item_slug,
      };
    })
    .filter(Boolean);

  return {
    format: 'factory-manager-production-schema',
    version: 1,
    exported_at: new Date().toISOString(),
    app_version: appVersion,
    schema: {
      name: chain.name,
      notes: chain.notes ?? null,
      target_item_slug: chain.target_item_slug ?? null,
      target_rate: chain.target_rate ?? null,
      extractions: exportedExtractions,
      steps: exportedSteps,
      links: exportedLinks,
      group_marks: group_marks ?? {},
    },
  };
}

const PRODUCTION_SCHEMA_FORMATS = new Set([
  'factory-manager-production-schema',
  'satisfactory-manager-production-schema',
]);

function resolveItemBySlug(db, slug, getItemById) {
  const trimmed = String(slug ?? '').trim();
  if (!trimmed) return null;
  const row = queryOne(db, 'SELECT id FROM items WHERE slug = ?', [trimmed]);
  return row ? getItemById(db, row.id) : null;
}

function resolveSchemaForImport(db, itemId, stepData) {
  const schemas = getItemSchemas(db, itemId);
  if (!schemas.length) return null;

  const wantedName = String(stepData.schema_name ?? '').trim();
  const wantedAlt = Boolean(stepData.schema_is_alternative);
  const wantedBuilding = String(stepData.schema_building_slug ?? '').trim();

  let match = schemas.find(
    (schema) =>
      schema.name === wantedName &&
      Boolean(schema.is_alternative) === wantedAlt &&
      (!wantedBuilding || schema.building_slug === wantedBuilding)
  );
  if (!match && wantedName) {
    match = schemas.find((schema) => schema.name === wantedName);
  }
  return match ?? schemas[0];
}

function importProductionChain(db, persist, payload, getItemById) {
  ensureProductionChainStepsTable(db);
  ensureExtractionsTable(db);
  ensureStepLinksTable(db);
  ensureProductionGroupMarksTable(db);

  if (!payload || typeof payload !== 'object') {
    throw new Error('File schema non valido');
  }
  if (!PRODUCTION_SCHEMA_FORMATS.has(payload.format)) {
    throw new Error('Formato file non riconosciuto (atteso schema di produzione)');
  }

  const schema = payload.schema;
  if (!schema || typeof schema !== 'object') {
    throw new Error('Contenuto schema mancante');
  }

  const baseName = String(schema.name ?? '').trim();
  if (!baseName) {
    throw new Error('Il nome dello schema è obbligatorio');
  }
  const name = `${baseName} (import)`;

  const extractions = Array.isArray(schema.extractions) ? schema.extractions : [];
  const steps = Array.isArray(schema.steps) ? schema.steps : [];
  const links = Array.isArray(schema.links) ? schema.links : [];
  const groupMarks =
    schema.group_marks && typeof schema.group_marks === 'object' ? schema.group_marks : {};

  db.run('BEGIN');
  try {
    db.run(
      `INSERT INTO production_chains (name, target_item_slug, target_rate, notes, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [name, schema.target_item_slug ?? null, schema.target_rate ?? null, schema.notes ?? null]
    );
    const newChainId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

    const extractionIdByRef = new Map();
    for (const [index, extraction] of extractions.entries()) {
      const item = resolveItemBySlug(db, extraction.item_slug, getItemById);
      if (!item) {
        throw new Error(`Risorsa estrazione non trovata: ${extraction.item_slug || '(vuota)'}`);
      }

      const ref = String(extraction.ref ?? `e${index + 1}`);
      db.run(
        `INSERT INTO production_chain_extractions
          (chain_id, item_id, miner_slug, purity, overclock, node_count, target_output, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newChainId,
          item.id,
          extraction.miner_slug ?? 'miner-mk1',
          extraction.purity ?? 'normal',
          extraction.overclock ?? DEFAULT_OVERCLOCK,
          extraction.node_count ?? 1,
          extraction.target_output ?? null,
          extraction.sort_order ?? index,
        ]
      );
      extractionIdByRef.set(ref, db.exec('SELECT last_insert_rowid()')[0].values[0][0]);
    }

    const stepIdByRef = new Map();
    for (const [index, step] of steps.entries()) {
      const item = resolveItemBySlug(db, step.item_slug, getItemById);
      if (!item) {
        throw new Error(`Risorsa schema non trovata: ${step.item_slug || '(vuota)'}`);
      }

      const itemSchema = resolveSchemaForImport(db, item.id, step);
      if (!itemSchema) {
        throw new Error(`Nessuna ricetta disponibile per «${item.name}»`);
      }

      const ref = String(step.ref ?? `s${index + 1}`);
      const stepName = String(step.name ?? '').trim() || `${schemaNameForStep(itemSchema)} #1`;
      const groupName = normalizeGroupName(step.group_name);

      db.run(
        `INSERT INTO production_chain_steps
          (chain_id, name, item_id, item_schema_id, sort_order, group_name, target_output,
           machine_count, overclock, somersloop_mask, oc_machines_linked, marked)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newChainId,
          stepName,
          item.id,
          itemSchema.id,
          step.sort_order ?? index,
          groupName,
          step.target_output ?? null,
          step.machine_count ?? DEFAULT_MACHINE_COUNT,
          step.overclock ?? DEFAULT_OVERCLOCK,
          step.somersloop_mask ?? 0,
          step.oc_machines_linked ? 1 : 0,
          step.marked ? 1 : 0,
        ]
      );
      stepIdByRef.set(ref, db.exec('SELECT last_insert_rowid()')[0].values[0][0]);
    }

    for (const link of links) {
      const consumerStepId = stepIdByRef.get(String(link.consumer_ref ?? ''));
      if (!consumerStepId || !link.item_slug) continue;

      const producerStepId = link.producer_step_ref
        ? stepIdByRef.get(String(link.producer_step_ref)) ?? null
        : null;
      const producerExtractionId = link.producer_extraction_ref
        ? extractionIdByRef.get(String(link.producer_extraction_ref)) ?? null
        : null;

      if (!producerStepId && !producerExtractionId) continue;

      db.run(
        `INSERT INTO production_chain_step_links
          (chain_id, consumer_step_id, producer_step_id, producer_extraction_id, item_slug)
         VALUES (?, ?, ?, ?, ?)`,
        [newChainId, consumerStepId, producerStepId, producerExtractionId, link.item_slug]
      );
    }

    for (const [groupName, marked] of Object.entries(groupMarks)) {
      const normalized = normalizeGroupName(groupName);
      if (!normalized) continue;
      db.run(
        `INSERT INTO production_chain_group_marks (chain_id, group_name, marked)
         VALUES (?, ?, ?)`,
        [newChainId, normalized, Number(marked) === 1 ? 1 : 0]
      );
    }

    db.run('COMMIT');
    persist();
    return getProductionChainById(db, newChainId);
  } catch (err) {
    try {
      db.run('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  }
}

module.exports = {
  ensureProductionChainStepsTable,
  listProductionChains,
  getProductionChainById,
  getProductionChainDetail,
  createProductionChain,
  updateProductionChain,
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
  deleteProductionChain,
  duplicateProductionChain,
  exportProductionChain,
  importProductionChain,
  listAllProductionObjectives,
  getStepById,
  getStepOutputRateForItem,
};
