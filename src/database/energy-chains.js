const { getBuildingBySlug } = require('./buildings');
const {
  loadEnergyChainExtractions,
  deleteEnergyExtractionsForChain,
  ensureEnergyExtractionsTable,
} = require('./energy-extraction');
const {
  getStepById,
  getStepOutputRateForItem,
  listProductionObjectives,
  getProductionChainById,
} = require('./production-chains');
const {
  resolveGeneratorProduction,
  scaleGeneratorForUpdate,
  getGeneratorDefinition,
  getSupportedGenerators,
  isSupportedGeneratorSlug,
  SUPPORTED_GENERATOR_SLUGS,
  DEFAULT_OVERCLOCK,
  DEFAULT_MACHINE_COUNT,
} = require('./energy-scale');
const {
  ENERGY_SCHEMA_FORMATS,
  PRODUCTION_SCHEMA_FORMATS,
  prepareEnergyImportSchema,
} = require('./schema-import-guard');

const GENERATOR_SELECT = `
  id, chain_id, building_slug, fuel_slug, machine_count, overclock, target_fuel_input, target_power, sort_order, created_at
`;

function ensureEnergyProductionLinksTable(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS energy_chain_production_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chain_id INTEGER NOT NULL,
      consumer_generator_id INTEGER NOT NULL,
      producer_production_step_id INTEGER NOT NULL,
      item_slug TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chain_id) REFERENCES energy_chains(id) ON DELETE CASCADE,
      FOREIGN KEY (consumer_generator_id) REFERENCES energy_chain_generators(id) ON DELETE CASCADE,
      FOREIGN KEY (producer_production_step_id) REFERENCES production_chain_steps(id) ON DELETE CASCADE
    );
  `);
}

function loadChainProductionLinks(db, chainId) {
  ensureEnergyProductionLinksTable(db);
  return queryAll(
    db,
    `SELECT id, chain_id, consumer_generator_id, producer_production_step_id, item_slug
     FROM energy_chain_production_links
     WHERE chain_id = ?
     ORDER BY id ASC`,
    [chainId]
  );
}

function attachProductionLinksToGenerators(generators, productionLinks, getItemById, db) {
  generators.forEach((generator) => {
    generator.production_input_links = {};
  });

  for (const link of productionLinks) {
    const consumer = generators.find((generator) => generator.id === link.consumer_generator_id);
    const producer = getStepById(db, link.producer_production_step_id, getItemById);
    if (!consumer || !producer) continue;

    const productionChain = getProductionChainById(db, producer.chain_id);

    const entry = {
      id: link.id,
      item_slug: link.item_slug,
      producer_production_step_id: link.producer_production_step_id,
      producer_step_name: producer.name,
      producer_chain_name: productionChain?.name ?? '',
      producer_rate: getStepOutputRateForItem(producer, link.item_slug),
    };

    if (!consumer.production_input_links[link.item_slug]) {
      consumer.production_input_links[link.item_slug] = [];
    }
    consumer.production_input_links[link.item_slug].push(entry);
  }

  return generators;
}

function ensureEnergyGeneratorLinksTable(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS energy_chain_generator_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chain_id INTEGER NOT NULL,
      consumer_generator_id INTEGER NOT NULL,
      producer_extraction_id INTEGER NOT NULL,
      item_slug TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chain_id) REFERENCES energy_chains(id) ON DELETE CASCADE,
      FOREIGN KEY (consumer_generator_id) REFERENCES energy_chain_generators(id) ON DELETE CASCADE,
      FOREIGN KEY (producer_extraction_id) REFERENCES energy_chain_extractions(id) ON DELETE CASCADE
    );
  `);
}

function loadChainGeneratorLinks(db, chainId) {
  ensureEnergyGeneratorLinksTable(db);
  return queryAll(
    db,
    `SELECT id, chain_id, consumer_generator_id, producer_extraction_id, item_slug
     FROM energy_chain_generator_links
     WHERE chain_id = ?
     ORDER BY id ASC`,
    [chainId]
  );
}

function attachLinksToGenerators(generators, extractions, links) {
  const extractionMap = new Map(extractions.map((extraction) => [extraction.id, extraction]));

  generators.forEach((generator) => {
    generator.input_links = {};
  });

  for (const link of links) {
    const consumer = generators.find((generator) => generator.id === link.consumer_generator_id);
    const extraction = extractionMap.get(link.producer_extraction_id);
    if (!consumer || !extraction) continue;

    const entry = {
      id: link.id,
      item_slug: link.item_slug,
      producer_extraction_id: link.producer_extraction_id,
      producer_name: extraction.item?.name ?? link.item_slug,
      producer_rate: extraction.output_rate ?? 0,
    };

    if (!consumer.input_links[link.item_slug]) {
      consumer.input_links[link.item_slug] = [];
    }
    consumer.input_links[link.item_slug].push(entry);
  }

  return generators;
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

function ensureEnergyChainsTable(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS energy_chains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  ensureEnergyChainTargetColumns(db);
  ensureEnergyGeneratorsTable(db);
  ensureEnergyGeneratorLinksTable(db);
  ensureEnergyProductionLinksTable(db);
}

function ensureEnergyChainTargetColumns(db) {
  const info = db.exec('PRAGMA table_info(energy_chains)')[0]?.values ?? [];
  const cols = new Set(info.map((row) => row[1]));
  if (!cols.has('target_power_mw')) {
    db.run('ALTER TABLE energy_chains ADD COLUMN target_power_mw REAL');
  }
  if (!cols.has('target_building_slug')) {
    db.run('ALTER TABLE energy_chains ADD COLUMN target_building_slug TEXT');
  }
  if (!cols.has('target_fuel_slug')) {
    db.run('ALTER TABLE energy_chains ADD COLUMN target_fuel_slug TEXT');
  }
  if (!cols.has('target_fuel_rate')) {
    db.run('ALTER TABLE energy_chains ADD COLUMN target_fuel_rate REAL');
  }
  if (!cols.has('target_mode')) {
    db.run(`ALTER TABLE energy_chains ADD COLUMN target_mode TEXT NOT NULL DEFAULT 'mw'`);
  }
  if (!cols.has('linked_production_chain_id')) {
    db.run('ALTER TABLE energy_chains ADD COLUMN linked_production_chain_id INTEGER');
  }
  if (!cols.has('power_shard_limit')) {
    db.run('ALTER TABLE energy_chains ADD COLUMN power_shard_limit INTEGER NOT NULL DEFAULT 0');
  }
}

function ensureEnergyGeneratorsTable(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS energy_chain_generators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chain_id INTEGER NOT NULL,
      building_slug TEXT NOT NULL,
      fuel_slug TEXT NOT NULL DEFAULT 'coal',
      machine_count REAL NOT NULL DEFAULT 1,
      overclock REAL NOT NULL DEFAULT 100,
      target_power REAL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (chain_id) REFERENCES energy_chains(id) ON DELETE CASCADE
    );
  `);

  const info = db.exec('PRAGMA table_info(energy_chain_generators)')[0]?.values ?? [];
  const cols = new Set(info.map((row) => row[1]));
  if (!cols.has('target_fuel_input')) {
    db.run('ALTER TABLE energy_chain_generators ADD COLUMN target_fuel_input REAL');
  }
}

function normalizeEnergyTargetMode(raw) {
  return String(raw ?? '').trim().toLowerCase() === 'fuel' ? 'fuel' : 'mw';
}

function mapChain(row) {
  const { parsePowerShardLimit, isPowerShardUnlimited, DEFAULT_POWER_SHARD_LIMIT } = require('./transport');
  const powerShardLimit = parsePowerShardLimit(row.power_shard_limit, DEFAULT_POWER_SHARD_LIMIT);
  return {
    id: row.id,
    name: row.name,
    notes: row.notes ?? null,
    target_power_mw: row.target_power_mw != null ? Number(row.target_power_mw) : null,
    target_building_slug: row.target_building_slug ?? null,
    target_fuel_slug: row.target_fuel_slug ?? null,
    target_fuel_rate: row.target_fuel_rate != null ? Number(row.target_fuel_rate) : null,
    target_mode: normalizeEnergyTargetMode(row.target_mode),
    linked_production_chain_id:
      row.linked_production_chain_id != null ? Number(row.linked_production_chain_id) : null,
    power_shard_limit: powerShardLimit,
    power_shard_unlimited: isPowerShardUnlimited(powerShardLimit),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function getItemBySlug(db, slug, getItemById) {
  const row = queryOne(db, 'SELECT id FROM items WHERE slug = ?', [slug]);
  return row ? getItemById(db, row.id) : null;
}

function mapGenerator(row, db, getItemById) {
  const resolved = resolveGeneratorProduction(row.building_slug, {
    fuel_slug: row.fuel_slug,
    machine_count: row.machine_count,
    overclock: row.overclock,
    target_fuel_input: row.target_fuel_input,
  });
  const definition = getGeneratorDefinition(row.building_slug);
  const building = getBuildingBySlug(db, row.building_slug);
  const fuelItem = getItemBySlug(db, resolved.fuel_item_slug, getItemById);
  const waterItem = getItemBySlug(db, 'water', getItemById);
  const wasteItem = resolved.waste_item_slug
    ? getItemBySlug(db, resolved.waste_item_slug, getItemById)
    : null;
  const fuelIsFluid = Boolean(definition?.fuelIsFluid);

  return {
    id: row.id,
    chain_id: row.chain_id,
    building_slug: resolved.building_slug,
    fuel_slug: resolved.fuel_slug,
    machine_count: resolved.machine_count,
    overclock: resolved.overclock,
    target_fuel_input: resolved.target_fuel_input,
    target_power: resolved.target_power,
    base_power_per_machine: resolved.base_power_per_machine,
    max_target_fuel: resolved.max_target_fuel,
    max_target_power: resolved.max_target_power,
    power_output_mw: resolved.power_output_mw,
    fuel_consumption: resolved.fuel_consumption,
    water_consumption: resolved.water_consumption,
    fuel_item_slug: resolved.fuel_item_slug,
    fuel_label: resolved.fuel_label,
    fuel_rate_base: resolved.fuel_rate_base,
    water_rate_base: resolved.water_rate_base,
    waste_item_slug: resolved.waste_item_slug,
    waste_label: resolved.waste_label,
    waste_output: resolved.waste_output,
    waste_per_rod: resolved.waste_per_rod,
    waste_item: wasteItem
      ? { slug: wasteItem.slug, name: wasteItem.name, image: wasteItem.image ?? null, is_fluid: false }
      : null,
    sort_order: row.sort_order,
    created_at: row.created_at,
    building_name: building?.name ?? row.building_slug,
    building_image: building?.image ?? null,
    fuel_is_fluid: fuelIsFluid,
    fuel_item: fuelItem
      ? { slug: fuelItem.slug, name: fuelItem.name, image: fuelItem.image ?? null, is_fluid: fuelIsFluid }
      : null,
    water_item: waterItem
      ? { slug: waterItem.slug, name: waterItem.name, image: waterItem.image ?? null, is_fluid: true }
      : { slug: 'water', name: 'Acqua', image: null, is_fluid: true },
  };
}

function loadChainGenerators(db, chainId, getItemById) {
  ensureEnergyGeneratorsTable(db);
  const rows = queryAll(
    db,
    `SELECT ${GENERATOR_SELECT}
     FROM energy_chain_generators
     WHERE chain_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [chainId]
  );

  return rows.map((row) => mapGenerator(row, db, getItemById));
}

function getGeneratorById(db, generatorId, getItemById) {
  ensureEnergyGeneratorsTable(db);
  const row = queryOne(
    db,
    `SELECT ${GENERATOR_SELECT}
     FROM energy_chain_generators
     WHERE id = ?`,
    [generatorId]
  );
  if (!row) return null;
  return mapGenerator(row, db, getItemById);
}

function listEnergyChains(db) {
  ensureEnergyChainsTable(db);
  return queryAll(
    db,
    `SELECT id, name, notes, target_power_mw, target_building_slug, target_fuel_slug,
            target_fuel_rate, target_mode, linked_production_chain_id, power_shard_limit,
            created_at, updated_at
     FROM energy_chains
     ORDER BY updated_at DESC, name ASC`
  ).map(mapChain);
}

function getEnergyChainById(db, id) {
  ensureEnergyChainsTable(db);
  const row = queryOne(
    db,
    `SELECT id, name, notes, target_power_mw, target_building_slug, target_fuel_slug,
            target_fuel_rate, target_mode, linked_production_chain_id, power_shard_limit,
            created_at, updated_at
     FROM energy_chains
     WHERE id = ?`,
    [id]
  );
  return row ? mapChain(row) : null;
}

function collectGeneratorInputSlugs(generators) {
  const slugs = new Set();
  for (const generator of generators ?? []) {
    if (generator.fuel_item_slug) slugs.add(generator.fuel_item_slug);
    if ((generator.water_consumption ?? 0) > 0 || (generator.water_rate_base ?? 0) > 0) {
      slugs.add('water');
    }
  }
  return [...slugs];
}

function getEnergyChainDetail(db, chainId, getItemById, options = {}) {
  ensureEnergyChainsTable(db);
  const chain = getEnergyChainById(db, chainId);
  if (!chain) return null;

  const extractions = loadEnergyChainExtractions(db, chainId, getItemById);
  const generators = loadChainGenerators(db, chainId, getItemById);
  const links = loadChainGeneratorLinks(db, chainId);
  const productionLinks = loadChainProductionLinks(db, chainId);
  attachLinksToGenerators(generators, extractions, links);
  attachProductionLinksToGenerators(generators, productionLinks, getItemById, db);
  const production_objectives = options.includeProductionObjectives
    ? listProductionObjectives(db, getItemById, {
        itemSlugs: collectGeneratorInputSlugs(generators),
        includeAllocated: true,
      })
    : [];

  return { chain, extractions, generators, links, production_objectives };
}

function getEnergyChainEditorDetail(db, chainId, getItemById) {
  return getEnergyChainDetail(db, chainId, getItemById, { includeProductionObjectives: true });
}

function createEnergyChain(
  db,
  persist,
  {
    name,
    target_power_mw = null,
    target_building_slug = null,
    target_fuel_slug = null,
    target_fuel_rate = null,
    target_mode = 'mw',
    linked_production_chain_id = null,
    power_shard_limit = 0,
  } = {}
) {
  ensureEnergyChainsTable(db);
  const trimmed = String(name ?? '').trim();
  if (!trimmed) {
    throw new Error('Il nome è obbligatorio');
  }

  const { parsePowerShardLimit } = require('./transport');
  const targetMw =
    target_power_mw != null && target_power_mw !== '' ? Number(target_power_mw) : null;
  const targetFuelRate =
    target_fuel_rate != null && target_fuel_rate !== '' ? Number(target_fuel_rate) : null;
  const buildingSlug = target_building_slug ? String(target_building_slug).trim() : null;
  const fuelSlug = target_fuel_slug ? String(target_fuel_slug).trim() : null;
  const linkedId =
    linked_production_chain_id != null && linked_production_chain_id !== ''
      ? Number(linked_production_chain_id)
      : null;
  const shardLimit = parsePowerShardLimit(power_shard_limit, 0);
  const mode = normalizeEnergyTargetMode(target_mode);

  db.run(
    `INSERT INTO energy_chains
      (name, target_power_mw, target_building_slug, target_fuel_slug, target_fuel_rate, target_mode,
       linked_production_chain_id, power_shard_limit, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      trimmed,
      Number.isFinite(targetMw) && targetMw > 0 ? targetMw : null,
      buildingSlug || null,
      fuelSlug || null,
      Number.isFinite(targetFuelRate) && targetFuelRate > 0 ? targetFuelRate : null,
      mode,
      Number.isFinite(linkedId) && linkedId > 0 ? linkedId : null,
      shardLimit,
    ]
  );

  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  persist();
  return getEnergyChainById(db, id);
}

function updateEnergyChain(
  db,
  persist,
  id,
  {
    name,
    target_power_mw,
    target_building_slug,
    target_fuel_slug,
    target_fuel_rate,
    target_mode,
    linked_production_chain_id,
    power_shard_limit,
  } = {}
) {
  ensureEnergyChainsTable(db);
  const chain = getEnergyChainById(db, id);
  if (!chain) {
    throw new Error('Schema energia non trovato');
  }

  const { parsePowerShardLimit } = require('./transport');

  const nextName = name !== undefined ? String(name ?? '').trim() : chain.name;
  if (!nextName) {
    throw new Error('Il nome è obbligatorio');
  }

  const nextMw =
    target_power_mw !== undefined
      ? target_power_mw != null && target_power_mw !== ''
        ? Number(target_power_mw)
        : null
      : chain.target_power_mw;
  const nextFuelRate =
    target_fuel_rate !== undefined
      ? target_fuel_rate != null && target_fuel_rate !== ''
        ? Number(target_fuel_rate)
        : null
      : chain.target_fuel_rate;
  const nextBuilding =
    target_building_slug !== undefined
      ? target_building_slug
        ? String(target_building_slug).trim()
        : null
      : chain.target_building_slug;
  const nextFuel =
    target_fuel_slug !== undefined
      ? target_fuel_slug
        ? String(target_fuel_slug).trim()
        : null
      : chain.target_fuel_slug;
  const nextMode =
    target_mode !== undefined ? normalizeEnergyTargetMode(target_mode) : chain.target_mode;
  const nextLinked =
    linked_production_chain_id !== undefined
      ? linked_production_chain_id != null && linked_production_chain_id !== ''
        ? Number(linked_production_chain_id)
        : null
      : chain.linked_production_chain_id;
  const nextShard =
    power_shard_limit !== undefined
      ? parsePowerShardLimit(power_shard_limit, chain.power_shard_limit)
      : chain.power_shard_limit;

  db.run(
    `UPDATE energy_chains
     SET name = ?, target_power_mw = ?, target_building_slug = ?, target_fuel_slug = ?,
         target_fuel_rate = ?, target_mode = ?, linked_production_chain_id = ?,
         power_shard_limit = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [
      nextName,
      Number.isFinite(nextMw) && nextMw > 0 ? nextMw : null,
      nextBuilding || null,
      nextFuel || null,
      Number.isFinite(nextFuelRate) && nextFuelRate > 0 ? nextFuelRate : null,
      nextMode,
      Number.isFinite(nextLinked) && nextLinked > 0 ? nextLinked : null,
      nextShard,
      id,
    ]
  );
  persist();
  return getEnergyChainById(db, id);
}

function deleteEnergyChain(db, persist, id) {
  ensureEnergyChainsTable(db);
  const chain = getEnergyChainById(db, id);
  if (!chain) {
    throw new Error('Schema energia non trovato');
  }

  deleteEnergyExtractionsForChain(db, id);
  db.run('DELETE FROM energy_chain_generators WHERE chain_id = ?', [id]);
  db.run('DELETE FROM energy_chains WHERE id = ?', [id]);
  persist();
  return { id };
}

function addEnergyGenerator(
  db,
  persist,
  chainId,
  { building_slug, fuel_slug, machine_count, overclock, target_fuel_input, target_power },
  getItemById
) {
  ensureEnergyGeneratorsTable(db);

  const chain = getEnergyChainById(db, chainId);
  if (!chain) {
    throw new Error('Schema energia non trovato');
  }

  const definition = getGeneratorDefinition(building_slug);
  if (!definition) {
    throw new Error('Generatore non supportato');
  }

  const resolved = resolveGeneratorProduction(building_slug, {
    fuel_slug: fuel_slug ?? definition.fuelOptions[0]?.slug,
    machine_count: machine_count ?? DEFAULT_MACHINE_COUNT,
    overclock: overclock ?? DEFAULT_OVERCLOCK,
    target_fuel_input: target_fuel_input ?? target_power,
  });

  const sortRow = queryOne(
    db,
    'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM energy_chain_generators WHERE chain_id = ?',
    [chainId]
  );
  const sortOrder = (sortRow?.max_order ?? -1) + 1;

  db.run(
    `INSERT INTO energy_chain_generators
      (chain_id, building_slug, fuel_slug, machine_count, overclock, target_fuel_input, target_power, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      chainId,
      building_slug,
      resolved.fuel_slug,
      resolved.machine_count,
      resolved.overclock,
      resolved.target_fuel_input,
      resolved.target_power,
      sortOrder,
    ]
  );

  db.run(`UPDATE energy_chains SET updated_at = datetime('now') WHERE id = ?`, [chainId]);
  persist();

  const generatorId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
  return getGeneratorById(db, generatorId, getItemById);
}

function updateEnergyGenerator(
  db,
  persist,
  generatorId,
  { fuel_slug, machine_count, overclock, target_fuel_input, target_power },
  getItemById
) {
  ensureEnergyGeneratorsTable(db);

  const existing = queryOne(
    db,
    `SELECT ${GENERATOR_SELECT}
     FROM energy_chain_generators WHERE id = ?`,
    [generatorId]
  );
  if (!existing) {
    throw new Error('Generatore non trovato');
  }

  const fuelChanged =
    fuel_slug != null && fuel_slug !== '' && fuel_slug !== existing.fuel_slug;

  const previousFuelItemSlug = fuelChanged
    ? resolveGeneratorProduction(existing.building_slug, {
        fuel_slug: existing.fuel_slug,
        machine_count: existing.machine_count,
        overclock: existing.overclock,
        target_fuel_input: existing.target_fuel_input,
      }).fuel_item_slug
    : null;

  const resolved = scaleGeneratorForUpdate(existing.building_slug, existing, {
    fuel_slug,
    machine_count,
    overclock,
    target_fuel_input: target_fuel_input ?? target_power,
  });

  if (fuelChanged && previousFuelItemSlug) {
    db.run(
      'DELETE FROM energy_chain_generator_links WHERE consumer_generator_id = ? AND item_slug = ?',
      [generatorId, previousFuelItemSlug]
    );
    db.run(
      'DELETE FROM energy_chain_production_links WHERE consumer_generator_id = ? AND item_slug = ?',
      [generatorId, previousFuelItemSlug]
    );
  }

  db.run(
    `UPDATE energy_chain_generators
     SET fuel_slug = ?, machine_count = ?, overclock = ?, target_fuel_input = ?, target_power = ?
     WHERE id = ?`,
    [
      resolved.fuel_slug,
      resolved.machine_count,
      resolved.overclock,
      resolved.target_fuel_input,
      resolved.target_power,
      generatorId,
    ]
  );
  db.run(`UPDATE energy_chains SET updated_at = datetime('now') WHERE id = ?`, [existing.chain_id]);
  persist();

  return getGeneratorById(db, generatorId, getItemById);
}

function deleteEnergyGenerator(db, persist, generatorId) {
  ensureEnergyGeneratorsTable(db);

  const row = queryOne(
    db,
    `SELECT id, chain_id FROM energy_chain_generators WHERE id = ?`,
    [generatorId]
  );
  if (!row) {
    throw new Error('Generatore non trovato');
  }

  db.run('DELETE FROM energy_chain_generator_links WHERE consumer_generator_id = ?', [generatorId]);
  db.run('DELETE FROM energy_chain_production_links WHERE consumer_generator_id = ?', [generatorId]);
  db.run('DELETE FROM energy_chain_generators WHERE id = ?', [generatorId]);
  db.run(`UPDATE energy_chains SET updated_at = datetime('now') WHERE id = ?`, [row.chain_id]);
  persist();

  return { chain_id: row.chain_id };
}

function resetEnergyGenerator(db, persist, generatorId, getItemById) {
  ensureEnergyGeneratorsTable(db);

  const existing = queryOne(
    db,
    `SELECT ${GENERATOR_SELECT}
     FROM energy_chain_generators WHERE id = ?`,
    [generatorId]
  );
  if (!existing) {
    throw new Error('Generatore non trovato');
  }

  const resolved = resolveGeneratorProduction(existing.building_slug, {
    fuel_slug: existing.fuel_slug,
    machine_count: DEFAULT_MACHINE_COUNT,
    overclock: DEFAULT_OVERCLOCK,
  });

  db.run(
    `UPDATE energy_chain_generators
     SET fuel_slug = ?, machine_count = ?, overclock = ?, target_fuel_input = ?, target_power = ?
     WHERE id = ?`,
    [
      resolved.fuel_slug,
      resolved.machine_count,
      resolved.overclock,
      resolved.target_fuel_input,
      resolved.target_power,
      generatorId,
    ]
  );
  db.run(`UPDATE energy_chains SET updated_at = datetime('now') WHERE id = ?`, [existing.chain_id]);
  persist();

  return getGeneratorById(db, generatorId, getItemById);
}

function getEnergyGeneratorCatalog(db) {
  ensureEnergyChainsTable(db);
  return getSupportedGenerators().map((definition) => {
    const building = getBuildingBySlug(db, definition.slug);
    return {
      slug: definition.slug,
      name: building?.name ?? definition.slug,
      image: building?.image ?? null,
      basePowerMw: definition.basePowerMw,
      waterPerMin: definition.waterPerMin,
      fuelIsFluid: Boolean(definition.fuelIsFluid),
      fuelOptions: definition.fuelOptions,
    };
  });
}

function getGeneratorByIdRaw(db, generatorId) {
  ensureEnergyGeneratorsTable(db);
  return queryOne(
    db,
    `SELECT ${GENERATOR_SELECT}
     FROM energy_chain_generators
     WHERE id = ?`,
    [generatorId]
  );
}

function setEnergyGeneratorInputLinks(
  db,
  persist,
  consumerGeneratorId,
  itemSlug,
  producerExtractionIds,
  getItemById
) {
  ensureEnergyGeneratorLinksTable(db);

  const consumerRow = getGeneratorByIdRaw(db, consumerGeneratorId);
  if (!consumerRow) {
    throw new Error('Generatore non trovato');
  }

  const consumer = getGeneratorById(db, consumerGeneratorId, getItemById);
  const slug = String(itemSlug ?? '').trim();
  if (!slug) {
    throw new Error('Risorsa non valida');
  }

  const definition = getGeneratorDefinition(consumerRow.building_slug);
  const validSlugs = new Set([consumer.fuel_item_slug]);
  if ((definition?.waterPerMin ?? 0) > 0) {
    validSlugs.add('water');
  }
  if (!validSlugs.has(slug)) {
    throw new Error('Questo generatore non richiede la risorsa indicata');
  }

  const chainId = consumerRow.chain_id;
  const producers = [
    ...new Set((producerExtractionIds ?? []).map((id) => Number(id)).filter(Boolean)),
  ];

  for (const extractionId of producers) {
    const extraction = queryOne(
      db,
      'SELECT id, chain_id, item_id FROM energy_chain_extractions WHERE id = ?',
      [extractionId]
    );
    if (!extraction || extraction.chain_id !== chainId) {
      throw new Error('Estrazione non valida');
    }
    const item = getItemById(db, extraction.item_id);
    if (!item || item.slug !== slug) {
      throw new Error(`L'estrazione selezionata non produce ${slug}`);
    }
  }

  db.run(
    'DELETE FROM energy_chain_generator_links WHERE consumer_generator_id = ? AND item_slug = ?',
    [consumerGeneratorId, slug]
  );

  for (const extractionId of producers) {
    db.run(
      `INSERT INTO energy_chain_generator_links
        (chain_id, consumer_generator_id, producer_extraction_id, item_slug)
       VALUES (?, ?, ?, ?)`,
      [chainId, consumerGeneratorId, extractionId, slug]
    );
  }

  db.run(`UPDATE energy_chains SET updated_at = datetime('now') WHERE id = ?`, [chainId]);
  persist();
  return getEnergyChainEditorDetail(db, chainId, getItemById);
}

function setEnergyGeneratorProductionLinks(
  db,
  persist,
  consumerGeneratorId,
  itemSlug,
  producerProductionStepIds,
  getItemById
) {
  ensureEnergyProductionLinksTable(db);

  const consumerRow = getGeneratorByIdRaw(db, consumerGeneratorId);
  if (!consumerRow) {
    throw new Error('Generatore non trovato');
  }

  const consumer = getGeneratorById(db, consumerGeneratorId, getItemById);
  const slug = String(itemSlug ?? '').trim();
  if (!slug) {
    throw new Error('Risorsa non valida');
  }

  const definition = getGeneratorDefinition(consumerRow.building_slug);
  const validSlugs = new Set([consumer.fuel_item_slug]);
  if ((definition?.waterPerMin ?? 0) > 0) {
    validSlugs.add('water');
  }
  if (!validSlugs.has(slug)) {
    throw new Error('Questo generatore non richiede la risorsa indicata');
  }

  const chainId = consumerRow.chain_id;
  const producers = [
    ...new Set((producerProductionStepIds ?? []).map((id) => Number(id)).filter(Boolean)),
  ];

  for (const stepId of producers) {
    const producer = getStepById(db, stepId, getItemById);
    if (!producer) {
      throw new Error('Schema di produzione non valido');
    }

    const hasOutput = (producer.scaled_outputs ?? []).some((io) => io.item_slug === slug);
    if (!hasOutput) {
      throw new Error(`«${producer.name}» non produce ${slug}`);
    }
  }

  db.run(
    'DELETE FROM energy_chain_production_links WHERE consumer_generator_id = ? AND item_slug = ?',
    [consumerGeneratorId, slug]
  );

  for (const stepId of producers) {
    db.run(
      `INSERT INTO energy_chain_production_links
        (chain_id, consumer_generator_id, producer_production_step_id, item_slug)
       VALUES (?, ?, ?, ?)`,
      [chainId, consumerGeneratorId, stepId, slug]
    );
  }

  db.run(`UPDATE energy_chains SET updated_at = datetime('now') WHERE id = ?`, [chainId]);
  persist();
  return getEnergyChainEditorDetail(db, chainId, getItemById);
}

function exportEnergyChain(db, sourceId, getItemById, { appVersion = null } = {}) {
  const detail = getEnergyChainDetail(db, sourceId, getItemById);
  if (!detail) {
    throw new Error('Schema energia non trovato');
  }

  const { chain, extractions, generators, links } = detail;

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

  const generatorRefById = new Map();
  const exportedGenerators = generators.map((generator, index) => {
    const ref = `g${index + 1}`;
    generatorRefById.set(generator.id, ref);
    return {
      ref,
      building_slug: generator.building_slug,
      fuel_slug: generator.fuel_slug,
      machine_count: generator.machine_count,
      overclock: generator.overclock,
      target_fuel_input: generator.target_fuel_input,
      target_power: generator.target_power,
      sort_order: generator.sort_order,
    };
  });

  const exportedLinks = links
    .map((link) => {
      const consumerRef = generatorRefById.get(link.consumer_generator_id);
      const producerRef = extractionRefById.get(link.producer_extraction_id);
      if (!consumerRef || !producerRef) return null;
      return {
        consumer_generator_ref: consumerRef,
        producer_extraction_ref: producerRef,
        item_slug: link.item_slug,
      };
    })
    .filter(Boolean);

  return {
    format: 'factory-manager-energy-schema',
    version: 1,
    exported_at: new Date().toISOString(),
    app_version: appVersion,
    schema: {
      name: chain.name,
      notes: chain.notes ?? null,
      extractions: exportedExtractions,
      generators: exportedGenerators,
      links: exportedLinks,
    },
  };
}

function importEnergyChain(db, persist, payload, getItemById) {
  ensureEnergyChainsTable(db);
  ensureEnergyExtractionsTable(db);
  ensureEnergyGeneratorsTable(db);
  ensureEnergyGeneratorLinksTable(db);

  if (!payload || typeof payload !== 'object') {
    throw new Error('File schema non valido');
  }
  if (!ENERGY_SCHEMA_FORMATS.has(payload.format)) {
    if (PRODUCTION_SCHEMA_FORMATS.has(payload.format)) {
      throw new Error('SCHEMA_TYPE_MISMATCH:production');
    }
    throw new Error('Formato file non riconosciuto (atteso schema energia)');
  }

  const schema = prepareEnergyImportSchema(payload, isSupportedGeneratorSlug);
  const name = `${schema.name} (import)`;
  const { extractions, generators, links } = schema;

  db.run('BEGIN');
  try {
    db.run(
      `INSERT INTO energy_chains (name, notes, updated_at)
       VALUES (?, ?, datetime('now'))`,
      [name, schema.notes ?? null]
    );
    const newChainId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

    const extractionIdByRef = new Map();
    for (const [index, extraction] of extractions.entries()) {
      const item = getItemBySlug(db, extraction.item_slug, getItemById);
      if (!item) {
        throw new Error(`Risorsa estrazione non trovata: ${extraction.item_slug || '(vuota)'}`);
      }

      const ref = extraction.ref || `e${index + 1}`;
      db.run(
        `INSERT INTO energy_chain_extractions
          (chain_id, item_id, miner_slug, purity, overclock, node_count, target_output, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newChainId,
          item.id,
          extraction.miner_slug,
          extraction.purity,
          extraction.overclock,
          extraction.node_count,
          extraction.target_output,
          extraction.sort_order,
        ]
      );
      extractionIdByRef.set(ref, db.exec('SELECT last_insert_rowid()')[0].values[0][0]);
    }

    const generatorIdByRef = new Map();
    for (const [index, generator] of generators.entries()) {
      const ref = generator.ref || `g${index + 1}`;
      db.run(
        `INSERT INTO energy_chain_generators
          (chain_id, building_slug, fuel_slug, machine_count, overclock, target_fuel_input, target_power, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newChainId,
          generator.building_slug,
          generator.fuel_slug,
          generator.machine_count,
          generator.overclock,
          generator.target_fuel_input,
          generator.target_power,
          generator.sort_order,
        ]
      );
      generatorIdByRef.set(ref, db.exec('SELECT last_insert_rowid()')[0].values[0][0]);
    }

    for (const link of links) {
      const consumerId = generatorIdByRef.get(String(link.consumer_generator_ref ?? ''));
      const producerId = extractionIdByRef.get(String(link.producer_extraction_ref ?? ''));
      if (!consumerId || !producerId || !link.item_slug) continue;

      db.run(
        `INSERT INTO energy_chain_generator_links
          (chain_id, consumer_generator_id, producer_extraction_id, item_slug)
         VALUES (?, ?, ?, ?)`,
        [newChainId, consumerId, producerId, link.item_slug]
      );
    }

    db.run('COMMIT');
    persist();
    return getEnergyChainById(db, newChainId);
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
  SUPPORTED_GENERATOR_SLUGS,
  ensureEnergyChainsTable,
  ensureEnergyGeneratorLinksTable,
  ensureEnergyProductionLinksTable,
  listEnergyChains,
  getEnergyChainById,
  getEnergyChainDetail,
  createEnergyChain,
  updateEnergyChain,
  deleteEnergyChain,
  addEnergyGenerator,
  updateEnergyGenerator,
  deleteEnergyGenerator,
  resetEnergyGenerator,
  getEnergyGeneratorCatalog,
  setEnergyGeneratorInputLinks,
  setEnergyGeneratorProductionLinks,
  exportEnergyChain,
  importEnergyChain,
};
