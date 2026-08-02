const { getItemSchemas } = require('./schemas');
const {
  addProductionChainStep,
  updateProductionChainStep,
  setProductionStepInputLinks,
  setProductionStepExtractionLinks,
  getProductionChainById,
  getProductionChainDetail,
  ensureProductionChainStepsTable,
} = require('./production-chains');
const {
  addMineralExtraction,
  updateMineralExtraction,
  isExtractionItem,
  getDefaultExtractionConfig,
  deleteExtractionsForChain,
} = require('./mineral-extraction');
const {
  applyStepChange,
  scaleSchema,
  outputPerMinute,
  OVERCLOCK_MAX,
  getBaseOutputPerMin,
  computeMachinesForTargetAtOverclock,
  computeTargetOutput,
  DEFAULT_OVERCLOCK,
} = require('./production-scale');
const {
  applyExtractionChange,
  getBaseExtractionPerNode,
  computeExtractionTargetOutput,
  normalizeNodeCount,
} = require('./extraction-scale');
const {
  ensureProductionChainTargetsTable,
  replaceChainTargets,
  loadChainTargets,
  normalizeTargetEntries,
} = require('./production-targets');
const { isPowerShardUnlimited, parsePowerShardLimit } = require('./transport');

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

function pickDefaultSchema(db, itemId) {
  const schemas = getItemSchemas(db, itemId);
  if (!schemas.length) return null;
  return schemas.find((schema) => !schema.is_alternative) || schemas[0];
}

function resolveItemDemandRate(scaledInput, schema) {
  return outputPerMinute(scaledInput.amount, schema.duration);
}

function nodesForExtractionTarget(item, minerSlug, purity, targetRate) {
  const base = getBaseExtractionPerNode(minerSlug, purity, item);
  if (!(base > 0)) return 1;
  const atFullClock = base * (OVERCLOCK_MAX / 100);
  return Math.max(1, Math.ceil(Number(targetRate) / atFullClock));
}

function clearProductionChainContents(db, chainId) {
  ensureProductionChainStepsTable(db);
  db.run(`
    CREATE TABLE IF NOT EXISTS production_chain_group_marks (
      chain_id INTEGER NOT NULL,
      group_name TEXT NOT NULL,
      marked INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (chain_id, group_name),
      FOREIGN KEY (chain_id) REFERENCES production_chains(id) ON DELETE CASCADE
    );
  `);
  db.run('DELETE FROM production_chain_step_links WHERE chain_id = ?', [chainId]);
  db.run('DELETE FROM production_chain_steps WHERE chain_id = ?', [chainId]);
  db.run('DELETE FROM production_chain_group_marks WHERE chain_id = ?', [chainId]);
  deleteExtractionsForChain(db, chainId);
}

function resolveTargetsInput(db, getItemById, options = {}) {
  if (Array.isArray(options.targets) && options.targets.length) {
    return normalizeTargetEntries(options.targets).map((entry) => {
      const item = getItemById(db, entry.item_id);
      if (!item) throw new Error('Risorsa non trovata');
      return { item, target_rate: entry.target_rate };
    });
  }

  // Legacy single-target shape
  if (options.item_id != null && options.target_rate != null) {
    const item = getItemById(db, Number(options.item_id));
    if (!item) throw new Error('Risorsa non trovata');
    const rate = Number(options.target_rate);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('Rate non valido');
    return [{ item, target_rate: rate }];
  }

  return [];
}

/**
 * Build / rebuild a production tree from one or more target products + rates.
 * Shared intermediates are aggregated; raw nodes become extractions; links are wired.
 */
function autoPlanProductionChain(db, persist, chainId, options, getItemById) {
  const chain = getProductionChainById(db, chainId);
  if (!chain) {
    throw new Error('Schema di produzione non trovato');
  }

  const targetList = resolveTargetsInput(db, getItemById, options);
  if (!targetList.length) {
    throw new Error('Seleziona almeno un prodotto obiettivo');
  }

  const replaceExisting = options.replace !== false;
  const noopPersist = () => {};

  ensureProductionChainTargetsTable(db);

  if (replaceExisting) {
    clearProductionChainContents(db, chainId);
  }

  replaceChainTargets(
    db,
    noopPersist,
    chainId,
    targetList.map((entry) => ({
      item_id: entry.item.id,
      target_rate: entry.target_rate,
    })),
    getItemById
  );

  const totalDemand = new Map();
  const expandedAmount = new Map();
  const planMeta = new Map();
  const queue = [];
  const targetItemsBySlug = new Map(targetList.map((entry) => [entry.item.slug, entry.item]));

  function addDemand(slug, amount) {
    const key = String(slug ?? '').trim();
    if (!key || !(amount > 0)) return;
    totalDemand.set(key, (totalDemand.get(key) || 0) + amount);
    queue.push(key);
  }

  for (const entry of targetList) {
    addDemand(entry.item.slug, entry.target_rate);
  }

  let guard = 0;
  while (queue.length) {
    if (++guard > 8000) {
      throw new Error('Auto-plan interrotto: possibile ciclo nelle ricette');
    }

    const slug = queue.pop();
    const needed = totalDemand.get(slug) || 0;
    const already = expandedAmount.get(slug) || 0;
    const delta = needed - already;
    if (!(delta > 1e-9)) continue;
    expandedAmount.set(slug, needed);

    const item =
      targetItemsBySlug.get(slug) || findItemBySlug(db, getItemById, slug);
    if (!item) {
      throw new Error(`Risorsa sconosciuta: ${slug}`);
    }

    if (isExtractionItem(item)) {
      planMeta.set(slug, { kind: 'extract', item });
      continue;
    }

    const schema = pickDefaultSchema(db, item.id);
    if (!schema) {
      // No craft recipe (e.g. missing seed data, or power-only specials not yet seeded):
      // leave as external demand instead of aborting the whole plan.
      planMeta.set(slug, { kind: 'external', item });
      continue;
    }

    planMeta.set(slug, { kind: 'craft', item, schema });

    const scaled = scaleSchema(schema, item, delta);
    for (const input of scaled.inputs ?? []) {
      addDemand(input.item_slug, resolveItemDemandRate(input, schema));
    }
  }

  const extractSlugs = [];
  const craftSlugs = [];
  for (const [slug, meta] of planMeta.entries()) {
    if (meta.kind === 'extract') extractSlugs.push(slug);
    else if (meta.kind === 'craft') craftSlugs.push(slug);
    // 'external' intentionally skipped — shows as shortfall / objective
  }

  function craftDepth(slug, visiting = new Set()) {
    const meta = planMeta.get(slug);
    if (!meta || meta.kind !== 'craft') return 0;
    if (visiting.has(slug)) return 0;
    visiting.add(slug);
    let depth = 0;
    for (const input of meta.schema.inputs ?? []) {
      depth = Math.max(depth, craftDepth(input.item_slug, visiting));
    }
    visiting.delete(slug);
    return depth + 1;
  }

  craftSlugs.sort((a, b) => craftDepth(a) - craftDepth(b));

  const stepBySlug = new Map();
  const extractionBySlug = new Map();
  const shardLimit = parsePowerShardLimit(chain.power_shard_limit);
  const preferNoShards = !isPowerShardUnlimited(shardLimit);

  for (const slug of extractSlugs) {
    const { item } = planMeta.get(slug);
    const needed = totalDemand.get(slug) || 0;
    const extraction = addMineralExtraction(
      db,
      noopPersist,
      chainId,
      { item_id: item.id },
      getItemById
    );

    const defaults = getDefaultExtractionConfig(item);
    let config;
    if (preferNoShards) {
      const base = getBaseExtractionPerNode(defaults.miner_slug, defaults.purity, item);
      const nodes = Math.max(1, Math.ceil(needed / Math.max(base, 1e-9)));
      config = applyExtractionChange(
        item,
        {
          ...defaults,
          node_count: nodes,
          overclock: 100,
          target_output: computeExtractionTargetOutput(base, nodes, 100),
        },
        'output',
        needed
      );
      if (config) {
        // Force 100% after sizing to nodes
        const base2 = getBaseExtractionPerNode(config.miner_slug, config.purity, item);
        let nodeCount = normalizeNodeCount(config.node_count);
        while (
          computeExtractionTargetOutput(base2, nodeCount, 100) + 1e-9 < needed &&
          nodeCount < 500
        ) {
          nodeCount += 1;
        }
        config = {
          ...config,
          node_count: nodeCount,
          overclock: 100,
          target_output: computeExtractionTargetOutput(base2, nodeCount, 100),
        };
      }
    } else {
      const nodes = nodesForExtractionTarget(
        item,
        defaults.miner_slug,
        defaults.purity,
        needed
      );
      config = applyExtractionChange(
        item,
        {
          ...defaults,
          node_count: nodes,
          target_output: extraction.target_output,
        },
        'output',
        needed
      );
    }
    if (!config) {
      throw new Error(`Impossibile dimensionare l'estrazione di «${item.name}»`);
    }

    updateMineralExtraction(db, noopPersist, extraction.id, config, getItemById);
    extractionBySlug.set(slug, extraction.id);
  }

  for (const slug of craftSlugs) {
    const { item, schema } = planMeta.get(slug);
    const needed = totalDemand.get(slug) || 0;
    const step = addProductionChainStep(
      db,
      noopPersist,
      chainId,
      { item_id: item.id, item_schema_id: schema.id },
      getItemById
    );

    let config;
    if (preferNoShards) {
      const basePerMin = getBaseOutputPerMin(schema, item);
      const machines = computeMachinesForTargetAtOverclock(
        needed,
        basePerMin,
        100,
        0,
        schema
      );
      const target = computeTargetOutput(basePerMin, machines, 100, 0, schema);
      config = {
        target_output: Math.max(needed, target),
        machine_count: machines,
        overclock: 100,
        somersloop_mask: 0,
      };
      // Re-run apply at 100% for consistent rounding
      config = applyStepChange(schema, item, { ...config, overclock: 100 }, 'machines', machines);
      if (config && config.overclock > 100) {
        const machines2 = computeMachinesForTargetAtOverclock(
          needed,
          basePerMin,
          100,
          config.somersloop_mask ?? 0,
          schema
        );
        config = {
          ...config,
          machine_count: machines2,
          overclock: 100,
          target_output: computeTargetOutput(
            basePerMin,
            machines2,
            100,
            config.somersloop_mask ?? 0,
            schema
          ),
        };
      }
    } else {
      config = applyStepChange(
        schema,
        item,
        {
          target_output: step.target_output,
          machine_count: step.machine_count,
          overclock: step.overclock,
          somersloop_mask: step.somersloop_mask ?? 0,
        },
        'output',
        needed
      );
    }
    if (!config) {
      throw new Error(`Impossibile dimensionare la produzione di «${item.name}»`);
    }

    updateProductionChainStep(db, noopPersist, step.id, config, getItemById);
    stepBySlug.set(slug, step.id);
  }

  for (const slug of craftSlugs) {
    const consumerId = stepBySlug.get(slug);
    const { item, schema } = planMeta.get(slug);
    const needed = totalDemand.get(slug) || 0;
    const scaled = scaleSchema(schema, item, needed);
    const inputSlugs = [
      ...new Set((scaled.inputs ?? []).map((io) => io.item_slug).filter(Boolean)),
    ];

    for (const inputSlug of inputSlugs) {
      const producerStepId = stepBySlug.get(inputSlug);
      const producerExtractionId = extractionBySlug.get(inputSlug);

      if (producerStepId) {
        setProductionStepInputLinks(
          db,
          noopPersist,
          consumerId,
          inputSlug,
          [producerStepId],
          getItemById
        );
      }
      if (producerExtractionId) {
        setProductionStepExtractionLinks(
          db,
          noopPersist,
          consumerId,
          inputSlug,
          [producerExtractionId],
          getItemById
        );
      }
    }
  }

  const sinkEnabled =
    options.sink_byproducts != null
      ? Boolean(Number(options.sink_byproducts))
      : Boolean(Number(chain.sink_byproducts));

  if (sinkEnabled) {
    const { appendSinkByproducts } = require('./sink-plan');
    appendSinkByproducts(db, noopPersist, chainId, getItemById, {
      totalDemand,
      stepBySlug,
      extractionBySlug,
      planMeta,
      craftSlugs,
      preferNoShards,
      max_belt_mk: chain.max_belt_mk,
      sink_byproducts: true,
    });
  }

  persist();
  return getProductionChainDetail(db, chainId, getItemById);
}

function setProductionChainTargetsAndReplan(db, persist, chainId, targets, getItemById) {
  const normalized = normalizeTargetEntries(targets);
  if (!normalized.length) {
    // Clear targets and wipe auto-built contents
    ensureProductionChainTargetsTable(db);
    clearProductionChainContents(db, chainId);
    replaceChainTargets(db, persist, chainId, [], getItemById);
    return getProductionChainDetail(db, chainId, getItemById);
  }

  return autoPlanProductionChain(
    db,
    persist,
    chainId,
    {
      targets: normalized,
      replace: true,
      sink_byproducts: getProductionChainById(db, chainId)?.sink_byproducts,
    },
    getItemById
  );
}

module.exports = {
  autoPlanProductionChain,
  setProductionChainTargetsAndReplan,
  clearProductionChainContents,
  pickDefaultSchema,
  findItemBySlug,
  loadChainTargets,
};
