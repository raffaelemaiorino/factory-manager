(function () {
  const PS = window.ProductionScale;

  const MINER_BASE_RATES = {
    'miner-mk1': { impure: 30, normal: 60, pure: 120 },
    'miner-mk2': { impure: 60, normal: 120, pure: 240 },
    'miner-mk3': { impure: 120, normal: 240, pure: 480 },
  };

  const OIL_PUMP_BASE_RATES = {
    impure: 60,
    normal: 120,
    pure: 240,
  };

  const WATER_PUMP_BASE_RATE = 120;

  const WELL_EXTRACTOR_BASE_RATES = {
    impure: 30,
    normal: 60,
    pure: 120,
  };

  const FRACKING_EXTRACTOR_SLUG = 'fracking-extractor';

  const PURITY_VALUES = ['impure', 'normal', 'pure'];

  function getExtractionKindForItem(item) {
    if (!item) return 'mineral';
    if (item.slug === 'nitrogen-gas') return 'well';
    if (item.slug === 'liquid-oil') return 'oil';
    if (item.slug === 'water') return 'water';
    if (item.category === 'minerali') return 'mineral';
    return 'mineral';
  }

  function isWellExtractionContext(item, stored = {}) {
    if (String(stored.miner_slug ?? '').trim() === FRACKING_EXTRACTOR_SLUG) return true;
    if (Array.isArray(stored.sub_nodes) && stored.sub_nodes.length > 0) return true;
    if (typeof stored.sub_nodes === 'string' && stored.sub_nodes.trim()) return true;
    return item?.slug === 'nitrogen-gas';
  }

  function normalizeExtractorSlug(slug, item) {
    const key = String(slug ?? '').trim();
    if (key === FRACKING_EXTRACTOR_SLUG) return FRACKING_EXTRACTOR_SLUG;
    if (getExtractionKindForItem(item) === 'well') return FRACKING_EXTRACTOR_SLUG;
    const kind = getExtractionKindForItem(item);
    if (kind === 'oil') return 'oil-pump';
    if (kind === 'water') return 'water-pump';
    return MINER_BASE_RATES[slug] ? slug : 'miner-mk1';
  }

  function normalizePurity(purity, item, extractorSlug = null) {
    const slug = extractorSlug ?? null;
    if (slug === 'water-pump') return 'normal';
    if (getExtractionKindForItem(item) === 'water' && slug !== FRACKING_EXTRACTOR_SLUG) {
      return 'normal';
    }
    return PURITY_VALUES.includes(purity) ? purity : 'normal';
  }

  const NODE_COUNT_MAX = 2000;

  function normalizeNodeCount(nodeCount) {
    const value = Math.round(Number(nodeCount));
    if (!Number.isFinite(value) || value < 1) return 1;
    return Math.min(NODE_COUNT_MAX, value);
  }

  function computeNodesForTargetOutput(targetOutput, basePerNode, maxNodes = NODE_COUNT_MAX) {
    const base = Number(basePerNode);
    const target = Number(targetOutput);
    const cap = Math.max(1, Math.min(NODE_COUNT_MAX, Math.round(Number(maxNodes) || NODE_COUNT_MAX)));
    if (!base || !Number.isFinite(target) || target <= 0) return 1;
    const perNodeMax = base * (PS.OVERCLOCK_MAX / 100);
    if (!(perNodeMax > 0)) return 1;
    let nodes = PS.roundUpPreferEven(target / perNodeMax);
    nodes = Math.min(cap, nodes);
    while (computeMaxExtractionOutput(base, nodes) + 1e-9 < target && nodes < cap) {
      nodes += nodes === 1 ? 1 : 2;
    }
    return normalizeNodeCount(nodes);
  }

  function getBaseExtractionPerNode(extractorSlug, purity, item = null) {
    const kind = item ? getExtractionKindForItem(item) : null;
    const slug = normalizeExtractorSlug(extractorSlug, item);
    const purityValue = normalizePurity(purity, item, slug);

    if (slug === 'oil-pump' || (kind === 'oil' && slug !== FRACKING_EXTRACTOR_SLUG)) {
      return OIL_PUMP_BASE_RATES[purityValue] ?? OIL_PUMP_BASE_RATES.normal;
    }

    if (slug === 'water-pump' || (kind === 'water' && slug !== FRACKING_EXTRACTOR_SLUG)) {
      return WATER_PUMP_BASE_RATE;
    }

    if (slug === FRACKING_EXTRACTOR_SLUG) {
      return WELL_EXTRACTOR_BASE_RATES[purityValue] ?? WELL_EXTRACTOR_BASE_RATES.normal;
    }

    return MINER_BASE_RATES[slug]?.[purityValue] ?? 0;
  }

  function computeMinExtractionOutput(basePerNode, nodeCount) {
    const base = Number(basePerNode);
    const nodes = normalizeNodeCount(nodeCount);
    if (!base || !nodes) return 1;
    const atMin = base * nodes * (PS.OVERCLOCK_MIN / 100);
    return atMin < 1 ? PS.roundProduction(atMin) : Math.max(1, Math.round(atMin));
  }

  function computeMaxExtractionOutput(basePerNode, nodeCount) {
    const base = Number(basePerNode);
    const nodes = normalizeNodeCount(nodeCount);
    if (!base || !nodes) return 1;
    return PS.roundConfigOutput(base * nodes * (PS.OVERCLOCK_MAX / 100));
  }

  function computeExtractionOverclock(targetOutput, basePerNode, nodeCount) {
    const base = Number(basePerNode);
    const target = Number(targetOutput);
    const nodes = normalizeNodeCount(nodeCount);
    if (!base || !target || !nodes) return PS.DEFAULT_OVERCLOCK;
    return PS.clampOverclock((target / (base * nodes)) * 100);
  }

  function computeExtractionTargetOutput(basePerNode, nodeCount, overclock) {
    const base = Number(basePerNode);
    const nodes = normalizeNodeCount(nodeCount);
    const oc = PS.clampOverclock(overclock);
    if (!base) return 0;
    return PS.roundTargetOutput(base * nodes * (oc / 100), oc);
  }

  function clampExtractionTargetToRange(targetOutput, basePerNode, nodeCount) {
    const min = computeMinExtractionOutput(basePerNode, nodeCount);
    const max = computeMaxExtractionOutput(basePerNode, nodeCount);
    return Math.min(max, Math.max(min, Number(targetOutput)));
  }

  function parseSubNode(node, item, defaultPurity) {
    return {
      purity: normalizePurity(node?.purity ?? defaultPurity, item, FRACKING_EXTRACTOR_SLUG),
      extractor_count: normalizeNodeCount(node?.extractor_count ?? 1),
    };
  }

  function parseSubNodes(stored = {}, item = null) {
    const defaultPurity = normalizePurity(stored.purity, item, FRACKING_EXTRACTOR_SLUG);
    let raw = stored.sub_nodes;
    if (typeof raw === 'string' && raw.trim()) {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = null;
      }
    }
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((node) => parseSubNode(node, item, defaultPurity));
    }
    const nodeCount = normalizeNodeCount(stored.node_count);
    return Array.from({ length: nodeCount }, () => parseSubNode(null, item, defaultPurity));
  }

  function computeWellTotalExtractors(subNodes = []) {
    return (subNodes ?? []).reduce(
      (sum, node) => sum + normalizeNodeCount(node?.extractor_count ?? 1),
      0
    );
  }

  function computeWellBaseSum(subNodes, item) {
    return (subNodes ?? []).reduce((sum, node) => {
      const base = getBaseExtractionPerNode(FRACKING_EXTRACTOR_SLUG, node.purity, item);
      const extractors = normalizeNodeCount(node.extractor_count ?? 1);
      return sum + base * extractors;
    }, 0);
  }

  function computeWellOutput(subNodes, overclock, item) {
    const baseSum = computeWellBaseSum(subNodes, item);
    const oc = PS.clampOverclock(overclock);
    if (!baseSum) return 0;
    return PS.roundTargetOutput(baseSum * (oc / 100), oc);
  }

  function computeWellOverclock(targetOutput, subNodes, item) {
    const baseSum = computeWellBaseSum(subNodes, item);
    const target = Number(targetOutput);
    if (!baseSum || !Number.isFinite(target) || target <= 0) return PS.DEFAULT_OVERCLOCK;
    return PS.clampOverclock((target / baseSum) * 100);
  }

  function computeWellMinOutput(subNodes, item) {
    return computeWellOutput(subNodes, PS.OVERCLOCK_MIN, item);
  }

  function computeWellMaxOutput(subNodes, item) {
    const baseSum = computeWellBaseSum(subNodes, item);
    if (!baseSum) return 1;
    return PS.roundConfigOutput(baseSum * (PS.OVERCLOCK_MAX / 100));
  }

  function clampWellTargetToRange(targetOutput, subNodes, item) {
    const min = computeWellMinOutput(subNodes, item);
    const max = computeWellMaxOutput(subNodes, item);
    return Math.min(max, Math.max(min, Number(targetOutput)));
  }

  function resolveWellExtractionProduction(item, stored = {}) {
    let subNodes = parseSubNodes(stored, item);
    let overclock =
      stored.overclock != null && stored.overclock !== ''
        ? PS.clampOverclock(stored.overclock)
        : PS.DEFAULT_OVERCLOCK;

    let targetOutput =
      stored.target_output != null && stored.target_output !== ''
        ? Number(stored.target_output)
        : computeWellOutput(subNodes, overclock, item);

    if (!Number.isFinite(targetOutput) || targetOutput <= 0) {
      targetOutput = computeWellOutput(subNodes, overclock, item);
    }

    targetOutput = clampWellTargetToRange(targetOutput, subNodes, item);
    targetOutput = PS.roundTargetOutput(targetOutput, overclock);
    overclock = computeWellOverclock(targetOutput, subNodes, item);

    const baseSum = computeWellBaseSum(subNodes, item);

    return {
      miner_slug: FRACKING_EXTRACTOR_SLUG,
      purity: subNodes[0]?.purity ?? 'normal',
      node_count: computeWellTotalExtractors(subNodes),
      sub_nodes: subNodes,
      overclock,
      target_output: targetOutput,
      base_per_node: PS.roundProduction(subNodes.length ? baseSum / subNodes.length : 0),
      output_rate: targetOutput,
      min_target_output: computeWellMinOutput(subNodes, item),
      max_target_output: computeWellMaxOutput(subNodes, item),
    };
  }

  function applyWellExtractionChange(item, current, changedField, rawValue) {
    let subNodes = parseSubNodes(current, item);
    let overclock = PS.clampOverclock(current.overclock);
    let targetOutput = PS.roundTargetOutput(
      current.target_output ?? current.output_rate,
      overclock
    );

    if (changedField === 'sub-node-purity') {
      const index = Number(rawValue?.index);
      const purity = normalizePurity(rawValue?.purity, item, FRACKING_EXTRACTOR_SLUG);
      if (!Number.isFinite(index) || index < 0 || index >= subNodes.length) return null;
      subNodes = subNodes.map((node, nodeIndex) =>
        nodeIndex === index ? { ...node, purity } : node
      );
      targetOutput = computeWellOutput(subNodes, overclock, item);
      targetOutput = clampWellTargetToRange(targetOutput, subNodes, item);
      targetOutput = PS.roundTargetOutput(targetOutput, overclock);
      overclock = computeWellOverclock(targetOutput, subNodes, item);
    } else if (changedField === 'add-sub-node') {
      subNodes = [...subNodes, { purity: 'normal', extractor_count: 1 }];
      targetOutput = computeWellOutput(subNodes, overclock, item);
      targetOutput = clampWellTargetToRange(targetOutput, subNodes, item);
      targetOutput = PS.roundTargetOutput(targetOutput, overclock);
    } else if (changedField === 'sub-node-extractors' || changedField === 'sub-node-extractors-slider') {
      const index = Number(rawValue?.index);
      const count = normalizeNodeCount(rawValue?.count ?? rawValue);
      if (!Number.isFinite(index) || index < 0 || index >= subNodes.length) return null;
      subNodes = subNodes.map((node, nodeIndex) =>
        nodeIndex === index ? { ...node, extractor_count: count } : node
      );
      targetOutput = computeWellOutput(subNodes, overclock, item);
      targetOutput = clampWellTargetToRange(targetOutput, subNodes, item);
      targetOutput = PS.roundTargetOutput(targetOutput, overclock);
      overclock = computeWellOverclock(targetOutput, subNodes, item);
    } else if (changedField === 'sub-node-output') {
      const index = Number(rawValue?.index);
      const parsed = Number(rawValue?.output ?? rawValue);
      if (!Number.isFinite(index) || index < 0 || index >= subNodes.length) return null;
      if (!Number.isFinite(parsed) || parsed <= 0) return null;

      const node = subNodes[index];
      const base = getBaseExtractionPerNode(FRACKING_EXTRACTOR_SLUG, node.purity, item);
      if (!base) return null;

      const oc = PS.clampOverclock(overclock);
      const maxExtractors = 25;
      const minOutput = PS.roundTargetOutput(base * (PS.OVERCLOCK_MIN / 100), oc);
      const maxOutput = PS.roundTargetOutput(base * maxExtractors * (PS.OVERCLOCK_MAX / 100), oc);
      const nodeTarget = Math.min(maxOutput, Math.max(minOutput, parsed));
      const extractors = normalizeNodeCount(Math.round((nodeTarget * 100) / (base * oc)));

      subNodes = subNodes.map((subNode, nodeIndex) =>
        nodeIndex === index ? { ...subNode, extractor_count: extractors } : subNode
      );
      targetOutput = computeWellOutput(subNodes, overclock, item);
      targetOutput = clampWellTargetToRange(targetOutput, subNodes, item);
      targetOutput = PS.roundTargetOutput(targetOutput, overclock);
    } else if (changedField === 'remove-sub-node') {
      const index = Number(rawValue);
      if (!Number.isFinite(index) || index < 0 || index >= subNodes.length || subNodes.length <= 1) {
        return null;
      }
      subNodes = subNodes.filter((_, nodeIndex) => nodeIndex !== index);
      targetOutput = clampWellTargetToRange(targetOutput, subNodes, item);
      targetOutput = PS.roundTargetOutput(targetOutput, overclock);
      overclock = computeWellOverclock(targetOutput, subNodes, item);
    } else if (changedField === 'nodes' || changedField === 'nodes-slider') {
      const targetCount = normalizeNodeCount(rawValue);
      const currentCount = subNodes.length;
      if (targetCount > currentCount) {
        subNodes = [
          ...subNodes,
          ...Array.from({ length: targetCount - currentCount }, () => ({
            purity: 'normal',
            extractor_count: 1,
          })),
        ];
      } else if (targetCount < currentCount) {
        subNodes = subNodes.slice(0, targetCount);
      }
      if (subNodes.length < 1) {
        subNodes = [parseSubNode(null, item, normalizePurity(current.purity, item, FRACKING_EXTRACTOR_SLUG))];
      }
      targetOutput = computeWellOutput(subNodes, overclock, item);
      targetOutput = clampWellTargetToRange(targetOutput, subNodes, item);
      targetOutput = PS.roundTargetOutput(targetOutput, overclock);
    } else if (changedField === 'purity') {
      const purity = normalizePurity(rawValue, item, FRACKING_EXTRACTOR_SLUG);
      subNodes = subNodes.map((node, index) => (index === 0 ? { ...node, purity } : node));
      targetOutput = computeWellOutput(subNodes, overclock, item);
      targetOutput = clampWellTargetToRange(targetOutput, subNodes, item);
      targetOutput = PS.roundTargetOutput(targetOutput, overclock);
      overclock = computeWellOverclock(targetOutput, subNodes, item);
    } else if (changedField === 'output') {
      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed) || parsed <= 0) return null;
      targetOutput = PS.roundTargetOutput(parsed, overclock);
      targetOutput = clampWellTargetToRange(targetOutput, subNodes, item);
      targetOutput = PS.roundTargetOutput(targetOutput, overclock);
      overclock = computeWellOverclock(targetOutput, subNodes, item);
    } else if (changedField === 'overclock' || changedField === 'overclock-slider') {
      overclock =
        changedField === 'overclock-slider'
          ? PS.clampOverclockSlider(rawValue)
          : PS.clampOverclock(rawValue);
      targetOutput = computeWellOutput(subNodes, overclock, item);
      targetOutput = clampWellTargetToRange(targetOutput, subNodes, item);
      targetOutput = PS.roundTargetOutput(targetOutput, overclock);
    } else {
      return null;
    }

    const baseSum = computeWellBaseSum(subNodes, item);

    return {
      miner_slug: FRACKING_EXTRACTOR_SLUG,
      purity: subNodes[0]?.purity ?? 'normal',
      node_count: computeWellTotalExtractors(subNodes),
      sub_nodes: subNodes,
      overclock,
      target_output: targetOutput,
      base_per_node: PS.roundProduction(subNodes.length ? baseSum / subNodes.length : 0),
      output_rate: targetOutput,
      min_target_output: computeWellMinOutput(subNodes, item),
      max_target_output: computeWellMaxOutput(subNodes, item),
    };
  }

  function resolveExtractionProduction(item, stored = {}) {
    if (isWellExtractionContext(item, stored)) {
      return resolveWellExtractionProduction(item, {
        ...stored,
        miner_slug: FRACKING_EXTRACTOR_SLUG,
      });
    }
    const minerSlug = normalizeExtractorSlug(stored.miner_slug, item);
    const purity = normalizePurity(stored.purity, item, minerSlug);
    const nodeCount = normalizeNodeCount(stored.node_count);
    let overclock =
      stored.overclock != null && stored.overclock !== ''
        ? PS.clampOverclock(stored.overclock)
        : PS.DEFAULT_OVERCLOCK;
    const basePerNode = getBaseExtractionPerNode(minerSlug, purity, item);

    let targetOutput =
      stored.target_output != null && stored.target_output !== ''
        ? Number(stored.target_output)
        : computeExtractionTargetOutput(basePerNode, nodeCount, overclock);

    if (!Number.isFinite(targetOutput) || targetOutput <= 0) {
      targetOutput = computeExtractionTargetOutput(basePerNode, nodeCount, overclock);
    }

    targetOutput = clampExtractionTargetToRange(targetOutput, basePerNode, nodeCount);
    targetOutput = PS.roundTargetOutput(targetOutput, overclock);
    overclock = computeExtractionOverclock(targetOutput, basePerNode, nodeCount);

    return {
      miner_slug: minerSlug,
      purity,
      node_count: nodeCount,
      overclock,
      target_output: targetOutput,
      base_per_node: PS.roundProduction(basePerNode),
      output_rate: targetOutput,
      min_target_output: computeMinExtractionOutput(basePerNode, nodeCount),
      max_target_output: computeMaxExtractionOutput(basePerNode, nodeCount),
    };
  }

  function applyExtractionChange(item, current, changedField, rawValue) {
    if (isWellExtractionContext(item, current)) {
      return applyWellExtractionChange(
        item,
        { ...current, miner_slug: FRACKING_EXTRACTOR_SLUG },
        changedField,
        rawValue
      );
    }

    let { target_output, node_count, overclock, miner_slug, purity } = { ...current };
    miner_slug = normalizeExtractorSlug(miner_slug, item);
    purity = normalizePurity(purity, item, miner_slug);
    node_count = normalizeNodeCount(node_count);
    overclock = PS.clampOverclock(overclock);
    target_output = PS.roundTargetOutput(target_output, overclock);

    let basePerNode = getBaseExtractionPerNode(miner_slug, purity, item);

    if (changedField === 'miner') {
      miner_slug = normalizeExtractorSlug(rawValue, item);
      basePerNode = getBaseExtractionPerNode(miner_slug, purity, item);
      target_output = computeExtractionTargetOutput(basePerNode, node_count, overclock);
      target_output = clampExtractionTargetToRange(target_output, basePerNode, node_count);
      target_output = PS.roundTargetOutput(target_output, overclock);
    } else if (changedField === 'purity') {
      purity = normalizePurity(rawValue, item, miner_slug);
      basePerNode = getBaseExtractionPerNode(miner_slug, purity, item);
      target_output = computeExtractionTargetOutput(basePerNode, node_count, overclock);
      target_output = clampExtractionTargetToRange(target_output, basePerNode, node_count);
      target_output = PS.roundTargetOutput(target_output, overclock);
    } else if (changedField === 'output') {
      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed) || parsed <= 0) return null;
      target_output = PS.roundTargetOutput(parsed, overclock);
      if (target_output > computeMaxExtractionOutput(basePerNode, node_count) + 1e-9) {
        node_count = computeNodesForTargetOutput(target_output, basePerNode);
      }
      target_output = clampExtractionTargetToRange(target_output, basePerNode, node_count);
      target_output = PS.roundTargetOutput(target_output, overclock);
      overclock = computeExtractionOverclock(target_output, basePerNode, node_count);
    } else if (changedField === 'nodes') {
      node_count = normalizeNodeCount(rawValue);
      target_output = computeExtractionTargetOutput(basePerNode, node_count, overclock);
      target_output = clampExtractionTargetToRange(target_output, basePerNode, node_count);
      target_output = PS.roundTargetOutput(target_output, overclock);
    } else if (changedField === 'overclock' || changedField === 'overclock-slider') {
      overclock =
        changedField === 'overclock-slider'
          ? PS.clampOverclockSlider(rawValue)
          : PS.clampOverclock(rawValue);
      target_output = computeExtractionTargetOutput(basePerNode, node_count, overclock);
      target_output = clampExtractionTargetToRange(target_output, basePerNode, node_count);
      target_output = PS.roundTargetOutput(target_output, overclock);
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
      base_per_node: PS.roundProduction(getBaseExtractionPerNode(miner_slug, purity, item)),
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

  function computeExtractionRate(extractorSlug, purity, overclock, nodeCount = 1, item = null) {
    const basePerNode = getBaseExtractionPerNode(extractorSlug, purity, item);
    return computeExtractionTargetOutput(basePerNode, nodeCount, overclock);
  }

  window.ExtractionScale = {
    getExtractionKindForItem,
    normalizeExtractorSlug,
    normalizePurity,
    normalizeNodeCount,
    getBaseExtractionPerNode,
    computeMinExtractionOutput,
    computeMaxExtractionOutput,
    computeNodesForTargetOutput,
    computeExtractionOverclock,
    computeExtractionTargetOutput,
    clampExtractionTargetToRange,
    parseSubNodes,
    computeWellOutput,
    resolveExtractionProduction,
    applyExtractionChange,
    computeExtractionRate,
    NODE_COUNT_MAX,
  };
})();
