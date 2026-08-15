const { getItemSchemas } = require('./schemas');
const { pickDefaultSchema } = require('./auto-plan-recipes');
const {
  getProductionChainById,
  getProductionChainDetail,
  getStepById,
  addProductionChainStep,
  addSinkProductionChainStep,
  updateProductionChainStep,
  setProductionStepInputLinks,
  setProductionStepExtractionLinks,
  getStepOutputRateForItem,
} = require('./production-chains');

const SKIP_LINK_DETAIL = { skipDetail: true };
const {
  addMineralExtraction,
  updateMineralExtraction,
  isExtractionItem,
  getDefaultExtractionConfig,
  getExtractionById,
} = require('./mineral-extraction');
const {
  applyStepChange,
  scaleSchema,
  getBaseOutputPerMin,
  computeMachinesForTargetAtOverclock,
  computeTargetOutput,
  outputPerMinute,
  DEFAULT_OVERCLOCK,
} = require('./production-scale');
const {
  applyExtractionChange,
  getBaseExtractionPerNode,
  computeExtractionTargetOutput,
  normalizeNodeCount,
} = require('./extraction-scale');
const { getBeltRate, clampBeltMk, DEFAULT_MAX_BELT_MK } = require('./transport');

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

/** Alternate Wet Concrete on cement: limestone (stone) + water → cement. */
function findWetConcreteSchema(db, cementItemId) {
  const schemas = getItemSchemas(db, cementItemId);
  return (
    schemas.find(
      (schema) =>
        (schema.inputs || []).some((io) => io.item_slug === 'water') &&
        (schema.inputs || []).some((io) => io.item_slug === 'stone')
    ) ||
    schemas.find((schema) => /wet\s*concrete/i.test(String(schema.name ?? ''))) ||
    null
  );
}

/**
 * Packager recipe that consumes `fluidSlug` and outputs a solid
 * (owned by the packaged item when possible).
 */
function findPackagingSchemaForFluid(db, getItemById, fluidSlug) {
  const slug = String(fluidSlug ?? '').trim();
  if (!slug) return null;

  const stmt = db.prepare(`
    SELECT DISTINCT s.id AS schema_id, s.item_id
    FROM item_schemas s
    JOIN schema_io inp
      ON inp.schema_id = s.id AND inp.is_output = 0
     AND inp.item_slug = ? AND inp.is_fluid = 1
    JOIN schema_io outp
      ON outp.schema_id = s.id AND outp.is_output = 1 AND outp.is_fluid = 0
    WHERE s.building_slug = 'packager'
  `);
  stmt.bind([slug]);
  const candidates = [];
  while (stmt.step()) candidates.push(stmt.getAsObject());
  stmt.free();

  let fallback = null;
  for (const row of candidates) {
    const schemas = getItemSchemas(db, row.item_id);
    const schema = schemas.find((s) => Number(s.id) === Number(row.schema_id));
    if (!schema) continue;
    const solidOut = (schema.outputs || []).find((io) => !io.is_fluid);
    if (!solidOut) continue;
    const result = {
      schema,
      outputSlug: solidOut.item_slug,
      item: getItemById(db, row.item_id),
    };
    const owner = queryOne(db, 'SELECT id FROM items WHERE slug = ?', [solidOut.item_slug]);
    if (owner && Number(owner.id) === Number(row.item_id)) {
      return result;
    }
    if (!fallback) fallback = result;
  }
  return fallback;
}

/** @deprecated alias */
function findPackagingSchema(db, getItemById, fluidSlug) {
  return findPackagingSchemaForFluid(db, getItemById, fluidSlug);
}

function computeSinkMachineCount(rate, maxBeltMk = DEFAULT_MAX_BELT_MK) {
  const capacity = getBeltRate(clampBeltMk(maxBeltMk, DEFAULT_MAX_BELT_MK));
  const amount = Number(rate) || 0;
  if (!(capacity > 0)) return 1;
  return Math.max(1, Math.ceil(amount / capacity - 1e-9));
}

/**
 * Secondary craft outputs (not the step's primary item) become disposal candidates.
 * Rate is summed across producers; `is_fluid` comes from schema IO.
 */
function collectByproductDisposeRates(steps) {
  const dispose = new Map();
  for (const step of steps) {
    if (Number(step.is_sink) === 1) continue;
    const primarySlug = step.item?.slug;
    for (const output of step.scaled_outputs || []) {
      const slug = output.item_slug;
      if (!slug || slug === primarySlug) continue;
      const outRate = getStepOutputRateForItem(step, slug);
      if (!(outRate > 0)) continue;
      const prev = dispose.get(slug) || { rate: 0, is_fluid: false };
      prev.rate += outRate;
      prev.is_fluid = prev.is_fluid || Boolean(output.is_fluid);
      dispose.set(slug, prev);
    }
  }
  return dispose;
}

function sizeCraftStepAt100(schema, item, needed) {
  const basePerMin = getBaseOutputPerMin(schema, item);
  const machines = computeMachinesForTargetAtOverclock(needed, basePerMin, 100, 0, schema);
  let config = {
    target_output: computeTargetOutput(basePerMin, machines, 100, 0, schema),
    machine_count: machines,
    overclock: 100,
    somersloop_mask: 0,
  };
  config = applyStepChange(schema, item, config, 'machines', machines) || config;
  return {
    ...config,
    overclock: 100,
    target_output: Math.max(needed, Number(config.target_output) || 0),
  };
}

function inputRateFromScaled(schema, scaledInputs, itemSlug) {
  const io = (scaledInputs || []).find((row) => row.item_slug === itemSlug);
  if (!io || !(schema?.duration > 0)) return 0;
  return outputPerMinute(io.amount, schema.duration);
}

function sizeExtractionForRate(item, needed) {
  const defaults = getDefaultExtractionConfig(item);
  const base = getBaseExtractionPerNode(defaults.miner_slug, defaults.purity, item);
  let nodes = Math.max(1, Math.ceil(needed / Math.max(base, 1e-9)));
  while (
    computeExtractionTargetOutput(base, nodes, 100) + 1e-9 < needed &&
    nodes < 500
  ) {
    nodes += 1;
  }
  return (
    applyExtractionChange(
      item,
      {
        ...defaults,
        node_count: normalizeNodeCount(nodes),
        overclock: 100,
        target_output: computeExtractionTargetOutput(base, nodes, 100),
      },
      'output',
      needed
    ) || {
      ...defaults,
      node_count: normalizeNodeCount(nodes),
      overclock: 100,
      target_output: computeExtractionTargetOutput(base, nodes, 100),
    }
  );
}

function ensureExtractionForRate(db, noopPersist, chainId, item, needed, getItemById, extractionBySlug) {
  const existingId = extractionBySlug.get(item.slug);
  if (existingId) {
    const existing = getExtractionById(db, existingId, getItemById);
    const currentRate = Number(existing?.target_output) || 0;
    const target = Math.max(currentRate, needed);
    const config = sizeExtractionForRate(item, target);
    updateMineralExtraction(db, noopPersist, existingId, config, getItemById);
    return existingId;
  }

  const extraction = addMineralExtraction(
    db,
    noopPersist,
    chainId,
    { item_id: item.id },
    getItemById
  );
  const config = sizeExtractionForRate(item, needed);
  updateMineralExtraction(db, noopPersist, extraction.id, config, getItemById);
  extractionBySlug.set(item.slug, extraction.id);
  return extraction.id;
}

/**
 * Ensure a solid side-input (e.g. fluid-canister) exists at least at `needed` /min.
 * Extraction items are mined; others use the default craft recipe (no deep oil tree).
 */
function ensureSideInput(
  db,
  noopPersist,
  chainId,
  getItemById,
  extractionBySlug,
  stepBySlug,
  itemSlug,
  needed
) {
  if (!(needed > 1e-9)) return;
  const item = findItemBySlug(db, getItemById, itemSlug);
  if (!item) return;

  if (isExtractionItem(item)) {
    const extId = ensureExtractionForRate(
      db,
      noopPersist,
      chainId,
      item,
      needed,
      getItemById,
      extractionBySlug
    );
    return { kind: 'extract', id: extId };
  }

  if (stepBySlug.has(itemSlug)) {
    const stepId = stepBySlug.get(itemSlug);
    const step = getStepById(db, stepId, getItemById);
    if (!step?.schema) return { kind: 'craft', id: stepId };
    const current = Number(step.target_output) || 0;
    const target = Math.max(current, needed);
    const config = sizeCraftStepAt100(step.schema, item, target);
    updateProductionChainStep(db, noopPersist, stepId, config, getItemById);
    return { kind: 'craft', id: stepId };
  }

  const schema = pickDefaultSchema(db, item.id, item);
  if (!schema) return null;

  const step = addProductionChainStep(
    db,
    noopPersist,
    chainId,
    { item_id: item.id, item_schema_id: schema.id, group_name: 'SINK' },
    getItemById
  );
  const config = sizeCraftStepAt100(schema, item, needed);
  updateProductionChainStep(db, noopPersist, step.id, config, getItemById);
  stepBySlug.set(itemSlug, step.id);

  // One-level inputs (e.g. plastic for canisters) — extract if possible, else leave open
  const scaled = scaleSchema(schema, item, config.target_output);
  for (const io of scaled.inputs || []) {
    const rate = outputPerMinute(io.amount, schema.duration);
    const inputItem = findItemBySlug(db, getItemById, io.item_slug);
    if (inputItem && isExtractionItem(inputItem)) {
      const extId = ensureExtractionForRate(
        db,
        noopPersist,
        chainId,
        inputItem,
        rate,
        getItemById,
        extractionBySlug
      );
      setProductionStepExtractionLinks(
        db,
        noopPersist,
        step.id,
        io.item_slug,
        [extId],
        getItemById,
        SKIP_LINK_DETAIL
      );
    } else if (stepBySlug.has(io.item_slug)) {
      setProductionStepInputLinks(
        db,
        noopPersist,
        step.id,
        io.item_slug,
        [stepBySlug.get(io.item_slug)],
        getItemById,
        SKIP_LINK_DETAIL
      );
    }
  }

  return { kind: 'craft', id: step.id };
}

function findProducerStepIdsForSlug(steps, slug) {
  return steps
    .filter(
      (step) =>
        Number(step.is_sink) !== 1 &&
        (step.scaled_outputs || []).some((io) => io.item_slug === slug)
    )
    .map((step) => step.id);
}

function primaryNeededForInputRate(schema, item, inputSlug, inputRate) {
  const input = (schema.inputs || []).find((io) => io.item_slug === inputSlug);
  const inputPerMin = outputPerMinute(input?.amount || 0, schema.duration);
  const primaryPerMin = getBaseOutputPerMin(schema, item);
  if (!(inputPerMin > 0) || !(primaryPerMin > 0)) return inputRate;
  return inputRate * (primaryPerMin / inputPerMin);
}

/**
 * After auto-plan craft+links, append packaging / wet-concrete / AWESOME Sink lines
 * for unused secondary outputs.
 */
function appendSinkByproducts(db, persist, chainId, getItemById, context = {}) {
  const chain = getProductionChainById(db, chainId);
  if (!chain) return null;

  const sinkEnabled =
    context.sink_byproducts != null
      ? Boolean(Number(context.sink_byproducts))
      : Boolean(Number(chain.sink_byproducts));
  if (!sinkEnabled) {
    return getProductionChainDetail(db, chainId, getItemById, {
      includeProductionObjectives: true,
    });
  }

  const noopPersist = () => {};
  const extractionBySlug = new Map(context.extractionBySlug || []);
  const stepBySlug = new Map(context.stepBySlug || []);
  const maxBeltMk = clampBeltMk(context.max_belt_mk ?? chain.max_belt_mk, DEFAULT_MAX_BELT_MK);

  const detail = getProductionChainDetail(db, chainId, getItemById);
  const dispose = collectByproductDisposeRates(detail.steps || []);
  if (!dispose.size) return detail;

  // Producers for byproduct outputs are known from the pre-sink plan; avoid
  // reloading full chain detail on every dispose entry (that froze large creates).
  const producersBySlug = new Map();
  for (const step of detail.steps || []) {
    if (Number(step.is_sink) === 1) continue;
    for (const io of step.scaled_outputs || []) {
      const outSlug = String(io.item_slug ?? '').trim();
      if (!outSlug) continue;
      const list = producersBySlug.get(outSlug) || [];
      list.push(step.id);
      producersBySlug.set(outSlug, list);
    }
  }

  const cementItem = findItemBySlug(db, getItemById, 'cement');
  const wetConcreteSchema = cementItem ? findWetConcreteSchema(db, cementItem.id) : null;

  for (const [slug, info] of dispose.entries()) {
    const rate = info.rate;
    if (!(rate > 0)) continue;
    const item = findItemBySlug(db, getItemById, slug);
    if (!item) continue;

    const producerIds = [...new Set(producersBySlug.get(slug) || [])];

    // Water → Wet Concrete → sink cement
    if (slug === 'water' && wetConcreteSchema && cementItem) {
      const primaryNeeded = primaryNeededForInputRate(
        wetConcreteSchema,
        cementItem,
        'water',
        rate
      );

      const step = addProductionChainStep(
        db,
        noopPersist,
        chainId,
        { item_id: cementItem.id, item_schema_id: wetConcreteSchema.id, group_name: 'SINK' },
        getItemById
      );
      const config = sizeCraftStepAt100(wetConcreteSchema, cementItem, primaryNeeded);
      updateProductionChainStep(db, noopPersist, step.id, config, getItemById);

      if (producerIds.length) {
        setProductionStepInputLinks(
          db,
          noopPersist,
          step.id,
          'water',
          producerIds,
          getItemById,
          SKIP_LINK_DETAIL
        );
      }

      const stoneScaled = scaleSchema(wetConcreteSchema, cementItem, config.target_output);
      const stoneRate = inputRateFromScaled(wetConcreteSchema, stoneScaled.inputs, 'stone');
      const stoneItem = findItemBySlug(db, getItemById, 'stone');
      if (stoneItem && stoneRate > 0) {
        const side = ensureSideInput(
          db,
          noopPersist,
          chainId,
          getItemById,
          extractionBySlug,
          stepBySlug,
          'stone',
          stoneRate
        );
        if (side?.kind === 'extract') {
          setProductionStepExtractionLinks(
            db,
            noopPersist,
            step.id,
            'stone',
            [side.id],
            getItemById,
            SKIP_LINK_DETAIL
          );
        } else if (side?.kind === 'craft') {
          setProductionStepInputLinks(
            db,
            noopPersist,
            step.id,
            'stone',
            [side.id],
            getItemById,
            SKIP_LINK_DETAIL
          );
        }
      }

      const sink = addSinkProductionChainStep(
        db,
        noopPersist,
        chainId,
        {
          item_id: cementItem.id,
          target_output: config.target_output,
          machine_count: computeSinkMachineCount(config.target_output, maxBeltMk),
          name: `Sink: ${cementItem.name}`,
        },
        getItemById
      );
      setProductionStepInputLinks(
        db,
        noopPersist,
        sink.id,
        'cement',
        [step.id],
        getItemById,
        SKIP_LINK_DETAIL
      );
      continue;
    }

    // Other fluids → package then sink packaged solid
    if (info.is_fluid) {
      const packed = findPackagingSchemaForFluid(db, getItemById, slug);
      if (!packed?.schema || !packed.item) continue;

      const primaryNeeded = primaryNeededForInputRate(packed.schema, packed.item, slug, rate);
      const step = addProductionChainStep(
        db,
        noopPersist,
        chainId,
        { item_id: packed.item.id, item_schema_id: packed.schema.id, group_name: 'SINK' },
        getItemById
      );
      const config = sizeCraftStepAt100(packed.schema, packed.item, primaryNeeded);
      updateProductionChainStep(db, noopPersist, step.id, config, getItemById);

      if (producerIds.length) {
        setProductionStepInputLinks(
          db,
          noopPersist,
          step.id,
          slug,
          producerIds,
          getItemById,
          SKIP_LINK_DETAIL
        );
      }

      const scaled = scaleSchema(packed.schema, packed.item, config.target_output);
      for (const io of scaled.inputs || []) {
        if (io.item_slug === slug) continue;
        const sideRate = outputPerMinute(io.amount, packed.schema.duration);
        const side = ensureSideInput(
          db,
          noopPersist,
          chainId,
          getItemById,
          extractionBySlug,
          stepBySlug,
          io.item_slug,
          sideRate
        );
        if (side?.kind === 'extract') {
          setProductionStepExtractionLinks(
            db,
            noopPersist,
            step.id,
            io.item_slug,
            [side.id],
            getItemById,
            SKIP_LINK_DETAIL
          );
        } else if (side?.kind === 'craft') {
          setProductionStepInputLinks(
            db,
            noopPersist,
            step.id,
            io.item_slug,
            [side.id],
            getItemById,
            SKIP_LINK_DETAIL
          );
        }
      }

      const sink = addSinkProductionChainStep(
        db,
        noopPersist,
        chainId,
        {
          item_id: packed.item.id,
          target_output: config.target_output,
          machine_count: computeSinkMachineCount(config.target_output, maxBeltMk),
          name: `Sink: ${packed.item.name}`,
        },
        getItemById
      );
      setProductionStepInputLinks(
        db,
        noopPersist,
        sink.id,
        packed.outputSlug || packed.item.slug,
        [step.id],
        getItemById,
        SKIP_LINK_DETAIL
      );
      continue;
    }

    // Solids → AWESOME Sink
    const sink = addSinkProductionChainStep(
      db,
      noopPersist,
      chainId,
      {
        item_id: item.id,
        target_output: rate,
        machine_count: computeSinkMachineCount(rate, maxBeltMk),
        name: `Sink: ${item.name}`,
      },
      getItemById
    );
    if (producerIds.length) {
      setProductionStepInputLinks(
        db,
        noopPersist,
        sink.id,
        slug,
        producerIds,
        getItemById,
        SKIP_LINK_DETAIL
      );
    }
  }

  persist();
  return getProductionChainDetail(db, chainId, getItemById, { includeProductionObjectives: true });
}

module.exports = {
  appendSinkByproducts,
  collectByproductDisposeRates,
  computeSinkMachineCount,
  findWetConcreteSchema,
  findPackagingSchema,
  findPackagingSchemaForFluid,
};
