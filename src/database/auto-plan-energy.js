const {
  getEnergyChainById,
  getEnergyChainDetail,
  updateEnergyChain,
  addEnergyGenerator,
  updateEnergyGenerator,
  setEnergyGeneratorInputLinks,
  setEnergyGeneratorProductionLinks,
} = require('./energy-chains');
const {
  sizeGeneratorsForTargetMw,
  getGeneratorDefinition,
  getFuelOption,
  isSupportedGeneratorSlug,
} = require('./energy-scale');
const {
  addEnergyExtraction,
  updateEnergyExtraction,
  deleteEnergyExtractionsForChain,
  getDefaultEnergyExtractionConfig,
  ENERGY_EXTRACTION_SLUGS,
} = require('./energy-extraction');
const {
  applyExtractionChange,
  getBaseExtractionPerNode,
  computeExtractionTargetOutput,
  normalizeNodeCount,
} = require('./extraction-scale');
const { createProductionChain, deleteProductionChain } = require('./production-chains');
const { autoPlanProductionChain } = require('./auto-plan');

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

function findItemBySlug(db, getItemById, slug) {
  const row = queryOne(db, 'SELECT id FROM items WHERE slug = ?', [String(slug ?? '').trim()]);
  if (!row) return null;
  return getItemById(db, row.id);
}

function clearEnergyChainContents(db, chainId) {
  db.run('DELETE FROM energy_chain_generator_links WHERE chain_id = ?', [chainId]);
  db.run('DELETE FROM energy_chain_production_links WHERE chain_id = ?', [chainId]);
  db.run('DELETE FROM energy_chain_generators WHERE chain_id = ?', [chainId]);
  deleteEnergyExtractionsForChain(db, chainId);
}

function sizeExtractionForRate(item, neededRate) {
  const defaults = getDefaultEnergyExtractionConfig(item);
  const base = getBaseExtractionPerNode(defaults.miner_slug, defaults.purity, item);
  let nodeCount = Math.max(1, Math.ceil(neededRate / Math.max(base, 1e-9)));
  while (
    computeExtractionTargetOutput(base, nodeCount, 100) + 1e-9 < neededRate &&
    nodeCount < 500
  ) {
    nodeCount += 1;
  }
  const config = applyExtractionChange(
    item,
    {
      ...defaults,
      node_count: normalizeNodeCount(nodeCount),
      overclock: 100,
      target_output: computeExtractionTargetOutput(base, nodeCount, 100),
    },
    'output',
    neededRate
  );
  if (!config) {
    throw new Error(`Impossibile dimensionare l'estrazione di «${item.name}»`);
  }
  return {
    ...config,
    node_count: normalizeNodeCount(config.node_count),
    overclock: 100,
    target_output: computeExtractionTargetOutput(
      getBaseExtractionPerNode(config.miner_slug, config.purity, item),
      normalizeNodeCount(config.node_count),
      100
    ),
  };
}

function ensureSizedEnergyExtraction(db, noopPersist, chainId, item, neededRate, getItemById) {
  const extraction = addEnergyExtraction(
    db,
    noopPersist,
    chainId,
    { item_id: item.id },
    getItemById
  );
  const config = sizeExtractionForRate(item, neededRate);
  updateEnergyExtraction(db, noopPersist, extraction.id, config, getItemById);
  return extraction.id;
}

/**
 * Rebuild an energy chain from target MW + generator + fuel.
 * Coal/water use energy extractions; other fuels get a companion production plan.
 */
function autoPlanEnergyChain(db, persist, chainId, options = {}, getItemById) {
  const chain = getEnergyChainById(db, chainId);
  if (!chain) {
    throw new Error('Schema energia non trovato');
  }

  const targetMw = Number(options.target_power_mw ?? chain.target_power_mw);
  const buildingSlug = String(
    options.target_building_slug ?? chain.target_building_slug ?? ''
  ).trim();
  const fuelSlug = String(options.target_fuel_slug ?? chain.target_fuel_slug ?? '').trim();

  if (!Number.isFinite(targetMw) || targetMw <= 0) {
    throw new Error('Target MW non valido');
  }
  if (!isSupportedGeneratorSlug(buildingSlug)) {
    throw new Error('Generatore non supportato');
  }
  const definition = getGeneratorDefinition(buildingSlug);
  const fuelOption = getFuelOption(definition, fuelSlug);
  if (!fuelOption) {
    throw new Error('Combustibile non supportato');
  }

  const noopPersist = () => {};
  const previousLinkedId = chain.linked_production_chain_id;
  const { parsePowerShardLimit, isPowerShardUnlimited } = require('./transport');
  const shardLimit = parsePowerShardLimit(
    options.power_shard_limit ?? chain.power_shard_limit,
    0
  );
  const prefer100oc = !isPowerShardUnlimited(shardLimit);

  updateEnergyChain(db, noopPersist, chainId, {
    target_power_mw: targetMw,
    target_building_slug: buildingSlug,
    target_fuel_slug: fuelOption.slug,
    power_shard_limit: shardLimit,
  });

  clearEnergyChainContents(db, chainId);

  const sized = sizeGeneratorsForTargetMw({
    building_slug: buildingSlug,
    fuel_slug: fuelOption.slug,
    target_mw: targetMw,
    prefer100oc,
  });

  const generator = addEnergyGenerator(
    db,
    noopPersist,
    chainId,
    {
      building_slug: sized.building_slug,
      fuel_slug: sized.fuel_slug,
      machine_count: sized.machine_count,
      overclock: sized.overclock,
      target_fuel_input: sized.target_fuel_input,
    },
    getItemById
  );

  // Ensure stored values match sizing (add path already resolves, but re-assert)
  updateEnergyGenerator(
    db,
    noopPersist,
    generator.id,
    {
      fuel_slug: sized.fuel_slug,
      machine_count: sized.machine_count,
      overclock: sized.overclock,
      target_fuel_input: sized.fuel_consumption,
    },
    getItemById
  );

  const fuelItemSlug = sized.fuel_item_slug || fuelOption.slug;
  const fuelRate = Number(sized.fuel_consumption) || 0;
  const waterRate = Number(sized.water_consumption) || 0;

  if (waterRate > 0) {
    const waterItem = findItemBySlug(db, getItemById, 'water');
    if (!waterItem) throw new Error('Risorsa acqua non trovata');
    const waterExtractionId = ensureSizedEnergyExtraction(
      db,
      noopPersist,
      chainId,
      waterItem,
      waterRate,
      getItemById
    );
    setEnergyGeneratorInputLinks(
      db,
      noopPersist,
      generator.id,
      'water',
      [waterExtractionId],
      getItemById
    );
  }

  let linkedProductionChainId = null;

  if (ENERGY_EXTRACTION_SLUGS.includes(fuelItemSlug)) {
    const fuelItem = findItemBySlug(db, getItemById, fuelItemSlug);
    if (!fuelItem) throw new Error(`Risorsa combustibile non trovata: ${fuelItemSlug}`);
    const fuelExtractionId = ensureSizedEnergyExtraction(
      db,
      noopPersist,
      chainId,
      fuelItem,
      fuelRate,
      getItemById
    );
    setEnergyGeneratorInputLinks(
      db,
      noopPersist,
      generator.id,
      fuelItemSlug,
      [fuelExtractionId],
      getItemById
    );
  } else if (fuelRate > 0) {
    const fuelItem = findItemBySlug(db, getItemById, fuelItemSlug);
    if (!fuelItem) throw new Error(`Risorsa combustibile non trovata: ${fuelItemSlug}`);

    let productionChainId = previousLinkedId;
    let productionChain = productionChainId
      ? queryOne(db, 'SELECT id, name FROM production_chains WHERE id = ?', [productionChainId])
      : null;

    if (!productionChain) {
      productionChain = createProductionChain(
        db,
        noopPersist,
        {
          name: `${chain.name} — ${fuelItem.name}`,
          target_item_slug: fuelItem.slug,
          target_rate: fuelRate,
          sink_byproducts: 0,
        }
      );
      productionChainId = productionChain.id;
    }

    const { updateProductionChain } = require('./production-chains');
    updateProductionChain(db, noopPersist, productionChainId, {
      power_shard_limit: shardLimit,
    });

    autoPlanProductionChain(
      db,
      noopPersist,
      productionChainId,
      {
        targets: [{ item_id: fuelItem.id, target_rate: fuelRate }],
        replace: true,
        sink_byproducts: false,
      },
      getItemById
    );

    const detail = require('./production-chains').getProductionChainDetail(
      db,
      productionChainId,
      getItemById
    );
    const producerStep = (detail?.steps ?? []).find((step) => step.item?.slug === fuelItemSlug);
    if (!producerStep) {
      throw new Error(`Auto-plan combustibile incompleto per «${fuelItem.name}»`);
    }

    setEnergyGeneratorProductionLinks(
      db,
      noopPersist,
      generator.id,
      fuelItemSlug,
      [producerStep.id],
      getItemById
    );
    linkedProductionChainId = productionChainId;

    if (previousLinkedId && previousLinkedId !== productionChainId) {
      try {
        deleteProductionChain(db, noopPersist, previousLinkedId);
      } catch {
        /* companion may already be gone */
      }
    }
  } else if (previousLinkedId) {
    try {
      deleteProductionChain(db, noopPersist, previousLinkedId);
    } catch {
      /* ignore */
    }
  }

  updateEnergyChain(db, noopPersist, chainId, {
    linked_production_chain_id: linkedProductionChainId,
  });

  db.run(`UPDATE energy_chains SET updated_at = datetime('now') WHERE id = ?`, [chainId]);
  persist();
  return getEnergyChainDetail(db, chainId, getItemById);
}

function setEnergyChainTargetsAndReplan(db, persist, chainId, options, getItemById) {
  return autoPlanEnergyChain(db, persist, chainId, options, getItemById);
}

module.exports = {
  autoPlanEnergyChain,
  setEnergyChainTargetsAndReplan,
  sizeGeneratorsForTargetMw,
};
