const {
  roundProduction,
  roundConfigOutput,
  clampOverclock,
  clampOverclockSlider,
  isIntegerOverclock,
  roundTargetOutput,
  OVERCLOCK_MIN,
  OVERCLOCK_MAX,
  DEFAULT_OVERCLOCK,
} = require('./production-scale');

const MINER_BASE_RATES = {
  'miner-mk1': { impure: 30, normal: 60, pure: 120 },
  'miner-mk2': { impure: 60, normal: 120, pure: 240 },
  'miner-mk3': { impure: 120, normal: 240, pure: 480 },
};

const OIL_PUMP_BASE_RATES = {
  impure: 60,
  normal: 120,
  pure: 250,
};

const WATER_PUMP_BASE_RATE = 120;

const PURITY_VALUES = ['impure', 'normal', 'pure'];

function getExtractionKindForItem(item) {
  if (!item) return 'mineral';
  if (item.slug === 'liquid-oil') return 'oil';
  if (item.slug === 'water') return 'water';
  if (item.category === 'minerali') return 'mineral';
  return 'mineral';
}

function normalizeExtractorSlug(slug, item) {
  const kind = getExtractionKindForItem(item);
  if (kind === 'oil') return 'oil-pump';
  if (kind === 'water') return 'water-pump';
  return MINER_BASE_RATES[slug] ? slug : 'miner-mk1';
}

function normalizePurity(purity, item) {
  if (getExtractionKindForItem(item) === 'water') return 'normal';
  return PURITY_VALUES.includes(purity) ? purity : 'normal';
}

function normalizeNodeCount(nodeCount) {
  const value = Math.round(Number(nodeCount));
  if (!Number.isFinite(value) || value < 1) return 1;
  return value;
}

function getBaseExtractionPerNode(extractorSlug, purity, item = null) {
  const kind = item ? getExtractionKindForItem(item) : null;
  const slug = normalizeExtractorSlug(extractorSlug, item);
  const purityValue = normalizePurity(purity, item);

  if (slug === 'oil-pump' || kind === 'oil') {
    return OIL_PUMP_BASE_RATES[purityValue] ?? OIL_PUMP_BASE_RATES.normal;
  }

  if (slug === 'water-pump' || kind === 'water') {
    return WATER_PUMP_BASE_RATE;
  }

  return MINER_BASE_RATES[slug]?.[purityValue] ?? 0;
}

function computeMinExtractionOutput(basePerNode, nodeCount) {
  const base = Number(basePerNode);
  const nodes = normalizeNodeCount(nodeCount);
  if (!base || !nodes) return 1;
  const atMin = base * nodes * (OVERCLOCK_MIN / 100);
  return atMin < 1 ? roundProduction(atMin) : Math.max(1, Math.round(atMin));
}

function computeMaxExtractionOutput(basePerNode, nodeCount) {
  const base = Number(basePerNode);
  const nodes = normalizeNodeCount(nodeCount);
  if (!base || !nodes) return 1;
  return roundConfigOutput(base * nodes * (OVERCLOCK_MAX / 100));
}

function computeExtractionOverclock(targetOutput, basePerNode, nodeCount) {
  const base = Number(basePerNode);
  const target = Number(targetOutput);
  const nodes = normalizeNodeCount(nodeCount);
  if (!base || !target || !nodes) return DEFAULT_OVERCLOCK;
  return clampOverclock((target / (base * nodes)) * 100);
}

function computeExtractionTargetOutput(basePerNode, nodeCount, overclock) {
  const base = Number(basePerNode);
  const nodes = normalizeNodeCount(nodeCount);
  const oc = clampOverclock(overclock);
  if (!base) return 0;
  return roundTargetOutput(base * nodes * (oc / 100), oc);
}

function clampExtractionTargetToMax(targetOutput, basePerNode, nodeCount) {
  const max = computeMaxExtractionOutput(basePerNode, nodeCount);
  return Math.min(Number(targetOutput), max);
}

function clampExtractionTargetToRange(targetOutput, basePerNode, nodeCount) {
  const min = computeMinExtractionOutput(basePerNode, nodeCount);
  const max = computeMaxExtractionOutput(basePerNode, nodeCount);
  return Math.min(max, Math.max(min, Number(targetOutput)));
}

function resolveExtractionProduction(item, stored = {}) {
  const minerSlug = normalizeExtractorSlug(stored.miner_slug, item);
  const purity = normalizePurity(stored.purity, item);
  const nodeCount = normalizeNodeCount(stored.node_count);
  let overclock =
    stored.overclock != null && stored.overclock !== ''
      ? clampOverclock(stored.overclock)
      : DEFAULT_OVERCLOCK;
  const basePerNode = getBaseExtractionPerNode(minerSlug, purity, item);

  let targetOutput =
    stored.target_output != null && stored.target_output !== ''
      ? Number(stored.target_output)
      : computeExtractionTargetOutput(basePerNode, nodeCount, overclock);

  if (!Number.isFinite(targetOutput) || targetOutput <= 0) {
    targetOutput = computeExtractionTargetOutput(basePerNode, nodeCount, overclock);
  }

  targetOutput = clampExtractionTargetToRange(targetOutput, basePerNode, nodeCount);
  targetOutput = roundTargetOutput(targetOutput, overclock);
  overclock = computeExtractionOverclock(targetOutput, basePerNode, nodeCount);

  return {
    miner_slug: minerSlug,
    purity,
    node_count: nodeCount,
    overclock,
    target_output: targetOutput,
    base_per_node: roundProduction(basePerNode),
    output_rate: targetOutput,
    min_target_output: computeMinExtractionOutput(basePerNode, nodeCount),
    max_target_output: computeMaxExtractionOutput(basePerNode, nodeCount),
  };
}

function applyExtractionChange(item, current, changedField, rawValue) {
  let { target_output, node_count, overclock, miner_slug, purity } = { ...current };
  miner_slug = normalizeExtractorSlug(miner_slug, item);
  purity = normalizePurity(purity, item);
  node_count = normalizeNodeCount(node_count);
  overclock = clampOverclock(overclock);
  target_output = roundTargetOutput(target_output, overclock);

  let basePerNode = getBaseExtractionPerNode(miner_slug, purity, item);

  if (changedField === 'miner') {
    miner_slug = normalizeExtractorSlug(rawValue, item);
    basePerNode = getBaseExtractionPerNode(miner_slug, purity, item);
    target_output = computeExtractionTargetOutput(basePerNode, node_count, overclock);
    target_output = clampExtractionTargetToRange(target_output, basePerNode, node_count);
    target_output = roundTargetOutput(target_output, overclock);
  } else if (changedField === 'purity') {
    purity = normalizePurity(rawValue, item);
    basePerNode = getBaseExtractionPerNode(miner_slug, purity, item);
    target_output = computeExtractionTargetOutput(basePerNode, node_count, overclock);
    target_output = clampExtractionTargetToRange(target_output, basePerNode, node_count);
    target_output = roundTargetOutput(target_output, overclock);
  } else if (changedField === 'output') {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    target_output = roundTargetOutput(parsed, overclock);
    target_output = clampExtractionTargetToRange(target_output, basePerNode, node_count);
    target_output = roundTargetOutput(target_output, overclock);
    overclock = computeExtractionOverclock(target_output, basePerNode, node_count);
  } else if (changedField === 'nodes') {
    node_count = normalizeNodeCount(rawValue);
    target_output = computeExtractionTargetOutput(basePerNode, node_count, overclock);
    target_output = clampExtractionTargetToRange(target_output, basePerNode, node_count);
    target_output = roundTargetOutput(target_output, overclock);
  } else if (changedField === 'overclock' || changedField === 'overclock-slider') {
    overclock =
      changedField === 'overclock-slider'
        ? clampOverclockSlider(rawValue)
        : clampOverclock(rawValue);
    target_output = computeExtractionTargetOutput(basePerNode, node_count, overclock);
    target_output = clampExtractionTargetToRange(target_output, basePerNode, node_count);
    target_output = roundTargetOutput(target_output, overclock);
    if (
      target_output <
      computeExtractionTargetOutput(basePerNode, node_count, overclock)
    ) {
      overclock = computeExtractionOverclock(target_output, basePerNode, node_count);
    }
  } else {
    return null;
  }

  return {
    miner_slug,
    purity,
    node_count,
    overclock,
    target_output,
    base_per_node: roundProduction(getBaseExtractionPerNode(miner_slug, purity, item)),
    output_rate: target_output,
    min_target_output: computeMinExtractionOutput(
      getBaseExtractionPerNode(miner_slug, purity, item),
      node_count
    ),
    max_target_output: computeMaxExtractionOutput(
      getBaseExtractionPerNode(miner_slug, purity, item),
      node_count
    ),
  };
}

function mergeExtractionStored(existing, updates = {}) {
  const stored = { ...existing };
  if (updates.miner_slug != null) stored.miner_slug = updates.miner_slug;
  if (updates.purity != null) stored.purity = updates.purity;
  if (updates.overclock != null && updates.overclock !== '') stored.overclock = updates.overclock;
  if (updates.node_count != null) stored.node_count = updates.node_count;
  if (updates.target_output != null && updates.target_output !== '') {
    stored.target_output = updates.target_output;
  }
  return stored;
}

function computeExtractionRate(extractorSlug, purity, overclock, nodeCount = 1, item = null) {
  const basePerNode = getBaseExtractionPerNode(extractorSlug, purity, item);
  return computeExtractionTargetOutput(basePerNode, nodeCount, overclock);
}

module.exports = {
  MINER_BASE_RATES,
  OIL_PUMP_BASE_RATES,
  WATER_PUMP_BASE_RATE,
  getExtractionKindForItem,
  normalizeExtractorSlug,
  normalizePurity,
  normalizeNodeCount,
  getBaseExtractionPerNode,
  computeMinExtractionOutput,
  computeMaxExtractionOutput,
  computeExtractionOverclock,
  computeExtractionTargetOutput,
  clampExtractionTargetToRange,
  resolveExtractionProduction,
  applyExtractionChange,
  mergeExtractionStored,
  computeExtractionRate,
};
