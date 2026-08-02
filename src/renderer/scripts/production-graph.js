/**
 * Visualizzazione ad albero della catena di produzione (sinistra → destra).
 * Layout libero con posizionamento assoluto e drag & drop.
 */
(function () {
  const t = (key, vars) => window.t(key, vars);

  const NODE_WIDTH = 256;
  const MIN_LAYER_GAP_X = 200;
  const MAX_LAYER_GAP_X = 320;
  const NODE_GAP_Y = 36;
  const PADDING = 48;
  const LAYOUT_STORAGE_PREFIX = 'satisfactory-graph-layout-v2-';

  function getStepBanks(step, helpers) {
    const info = helpers.computeStepBuildInfo?.(step);
    const complex = helpers.treeDetailMode === 'complex';
    if (!complex || !info?.needsSplit || !(info.banks?.length > 1)) {
      return [{ index: 0, machines: info?.machines ?? step.machine_count ?? 1, share: 1, split: false }];
    }
    const total = info.machines || 1;
    return info.banks.map((machines, index) => ({
      index,
      machines,
      share: machines / total,
      split: true,
      bankCount: info.banks.length,
      overclock: info.overclock,
    }));
  }

  function getExtractionBanks(extraction, helpers) {
    const info = helpers.computeExtractionBuildInfo?.(extraction);
    const complex = helpers.treeDetailMode === 'complex';
    if (!complex || !info?.needsSplit || !(info.banks?.length > 1)) {
      return [{ index: 0, machines: info?.machines ?? extraction.node_count ?? 1, share: 1, split: false }];
    }
    const total = info.machines || 1;
    return info.banks.map((machines, index) => ({
      index,
      machines,
      share: machines / total,
      split: true,
      bankCount: info.banks.length,
      overclock: info.overclock,
    }));
  }

  function stepNodeId(stepId, bankIndex, split) {
    return split ? `step-${stepId}-bank-${bankIndex}` : `step-${stepId}`;
  }

  function extractionNodeId(extractionId, bankIndex, split) {
    return split ? `ext-${extractionId}-bank-${bankIndex}` : `ext-${extractionId}`;
  }

  function parseStepIdFromNodeId(nodeId) {
    const match = String(nodeId).match(/^step-(\d+)/);
    return match ? Number(match[1]) : null;
  }

  function addDistributedEdges(addEdge, fromBanks, toBanks, edgeBase, round) {
    if (fromBanks.length === toBanks.length && fromBanks.length > 1) {
      for (let index = 0; index < fromBanks.length; index += 1) {
        const fromBank = fromBanks[index];
        const toBank = toBanks[index];
        const rate = round(edgeBase.rate * fromBank.share);
        if (!(rate > 0)) continue;
        addEdge({
          ...edgeBase,
          from: fromBank.id,
          to: toBank.id,
          rate,
        });
      }
      return;
    }

    for (const fromBank of fromBanks) {
      for (const toBank of toBanks) {
        const rate = round(edgeBase.rate * fromBank.share * toBank.share);
        if (!(rate > 0)) continue;
        addEdge({
          ...edgeBase,
          from: fromBank.id,
          to: toBank.id,
          rate,
        });
      }
    }
  }

  function buildProductionGraph(detail, helpers, options = {}) {
    const allSteps = detail.steps ?? [];
    const extractions = detail.extractions ?? [];
    const groupKey = options.groupKey ?? null;
    const visibleSteps = groupKey
      ? allSteps.filter((step) => helpers.getProductionGroupKey(step.group_name) === groupKey)
      : allSteps;
    const visibleStepIds = new Set(visibleSteps.map((step) => step.id));
    const round = (value) => helpers.roundProduction?.(value) ?? value;

    if (groupKey && !visibleSteps.length) {
      return { nodes: [], edges: [] };
    }

    const nodes = [];
    const edges = [];
    const edgeKeys = new Set();
    const stepBanksById = new Map();
    const extractionBanksById = new Map();

    const addEdge = (edge) => {
      const key = `${edge.from}|${edge.to}|${edge.itemSlug}|${edge.rate}|${edge.kind}`;
      if (edgeKeys.has(key)) return;
      edgeKeys.add(key);
      edges.push(edge);
    };

    for (const step of visibleSteps) {
      const banks = getStepBanks(step, helpers);
      stepBanksById.set(
        step.id,
        banks.map((bank) => ({
          ...bank,
          id: stepNodeId(step.id, bank.index, bank.split),
        }))
      );
      for (const bank of banks) {
        nodes.push({
          id: stepNodeId(step.id, bank.index, bank.split),
          type: 'step',
          layer: null,
          data: {
            ...step,
            _bank: bank,
            machine_count: bank.machines,
          },
        });
      }
    }

    const objectives = helpers
      .computeProductionObjectives(allSteps)
      .filter((objective) => visibleStepIds.has(objective.step_id));
    for (const objective of objectives) {
      nodes.push({
        id: `obj-${objective.step_id}-${objective.item_slug}`,
        type: 'objective',
        layer: null,
        data: objective,
      });
    }

    for (const step of visibleSteps) {
      const toBanks = stepBanksById.get(step.id) || [];
      for (const [itemSlug, links] of Object.entries(step.input_links ?? {})) {
        for (const link of links) {
          const producer = allSteps.find((candidate) => candidate.id === link.producer_step_id);
          if (!producer || !visibleStepIds.has(producer.id)) continue;

          const io = (step.scaled_inputs ?? []).find((input) => input.item_slug === itemSlug);
          const rate = helpers.getProducerAttributedDemand(producer, step, itemSlug, allSteps);
          if (!rate) continue;

          const fromBanks = stepBanksById.get(producer.id) || [];
          addDistributedEdges(addEdge, fromBanks, toBanks, {
            itemSlug,
            itemName: io?.item_name ?? itemSlug,
            itemImage: io?.item_image ?? null,
            isFluid: Boolean(io?.is_fluid),
            rate,
            kind: 'step-link',
          }, round);
        }
      }
    }

    const extractionsBySlug = new Map();
    for (const extraction of extractions) {
      const slug = extraction.item?.slug;
      if (!slug) continue;
      if (!extractionsBySlug.has(slug)) extractionsBySlug.set(slug, []);
      extractionsBySlug.get(slug).push(extraction);
    }

    for (const step of visibleSteps) {
      const toBanks = stepBanksById.get(step.id) || [];
      for (const io of step.scaled_inputs ?? []) {
        if (!helpers.isExternalSummarySlug(io.item_slug)) continue;

        const demand = helpers.getStepInputRateForItem(step, io.item_slug);
        if (!demand) continue;

        const linkedRate = (step.input_links?.[io.item_slug] ?? []).reduce((sum, link) => {
          if (link.producer_step_id) {
            const producer = allSteps.find((candidate) => candidate.id === link.producer_step_id);
            if (!producer) return sum;
            return sum + helpers.getProducerAttributedDemand(producer, step, io.item_slug, allSteps);
          }
          if (link.producer_extraction_id) {
            const extraction = extractions.find(
              (candidate) => candidate.id === link.producer_extraction_id
            );
            if (!extraction) return sum;
            return (
              sum +
              helpers.getExtractionAttributedDemand(extraction, step, io.item_slug, allSteps, extractions)
            );
          }
          return sum;
        }, 0);

        const manualExtractionLinks = (step.input_links?.[io.item_slug] ?? []).filter(
          (link) => link.producer_extraction_id
        );
        const usesManualExtraction =
          manualExtractionLinks.length > 0 || helpers.hasManualExtractionLinks?.(step, io.item_slug);

        if (usesManualExtraction) {
          for (const link of manualExtractionLinks) {
            const extraction = extractions.find(
              (candidate) => candidate.id === link.producer_extraction_id
            );
            if (!extraction) continue;

            const rate = helpers.getExtractionAttributedDemand(
              extraction,
              step,
              io.item_slug,
              allSteps,
              extractions
            );
            if (rate <= helpers.linkTolerance) continue;

            let fromBanks = extractionBanksById.get(extraction.id);
            if (!fromBanks) {
              fromBanks = getExtractionBanks(extraction, helpers).map((bank) => ({
                ...bank,
                id: extractionNodeId(extraction.id, bank.index, bank.split),
              }));
              extractionBanksById.set(extraction.id, fromBanks);
            }

            addDistributedEdges(addEdge, fromBanks, toBanks, {
              itemSlug: io.item_slug,
              itemName: io.item_name ?? io.item_slug,
              itemImage: io.item_image ?? null,
              isFluid: Boolean(io.is_fluid),
              rate,
              kind: 'extraction-link',
            }, round);
          }
          continue;
        }

        const externalNeed = helpers.roundProduction(Math.max(0, demand - linkedRate));
        if (externalNeed <= helpers.linkTolerance) continue;

        const slugExtractions = extractionsBySlug.get(io.item_slug) ?? [];
        if (!slugExtractions.length) continue;

        const totalExtractionRate = slugExtractions.reduce(
          (sum, extraction) => sum + helpers.getExtractionOutputRate(extraction),
          0
        );

        for (const extraction of slugExtractions) {
          const extractionRate = helpers.getExtractionOutputRate(extraction);
          const share =
            totalExtractionRate > 0 ? extractionRate / totalExtractionRate : 1 / slugExtractions.length;
          const rate = helpers.roundProduction(externalNeed * share);
          if (rate <= 0) continue;

          let fromBanks = extractionBanksById.get(extraction.id);
          if (!fromBanks) {
            fromBanks = getExtractionBanks(extraction, helpers).map((bank) => ({
              ...bank,
              id: extractionNodeId(extraction.id, bank.index, bank.split),
            }));
            extractionBanksById.set(extraction.id, fromBanks);
          }

          addDistributedEdges(addEdge, fromBanks, toBanks, {
            itemSlug: io.item_slug,
            itemName: io.item_name ?? io.item_slug,
            itemImage: io.item_image ?? null,
            isFluid: Boolean(io.is_fluid),
            rate,
            kind: 'extraction-link',
          }, round);
        }
      }
    }

    for (const objective of objectives) {
      const fromBanks = stepBanksById.get(objective.step_id) || [
        { id: `step-${objective.step_id}`, share: 1 },
      ];
      const toBanks = [
        { id: `obj-${objective.step_id}-${objective.item_slug}`, share: 1 },
      ];
      addDistributedEdges(addEdge, fromBanks, toBanks, {
        itemSlug: objective.item_slug,
        itemName: objective.item_name,
        itemImage: objective.item_image,
        isFluid: Boolean(objective.is_fluid),
        rate: objective.rate,
        kind: 'objective-link',
      }, round);
    }

    const usedExtractionIds = new Set(
      edges
        .filter((edge) => edge.from.startsWith('ext-'))
        .map((edge) => {
          const match = edge.from.match(/^ext-(\d+)/);
          return match ? Number(match[1]) : null;
        })
        .filter((id) => id != null)
    );

    for (const extraction of extractions) {
      if (groupKey && !usedExtractionIds.has(extraction.id)) continue;
      let banks = extractionBanksById.get(extraction.id);
      if (!banks) {
        banks = getExtractionBanks(extraction, helpers).map((bank) => ({
          ...bank,
          id: extractionNodeId(extraction.id, bank.index, bank.split),
        }));
        extractionBanksById.set(extraction.id, banks);
      }
      for (const bank of banks) {
        nodes.unshift({
          id: bank.id,
          type: 'extraction',
          layer: 0,
          data: {
            ...extraction,
            _bank: bank,
            node_count: bank.machines,
          },
        });
      }
    }

    assignLayers(nodes, edges);
    compactLayers(nodes);
    return { nodes, edges };
  }

  function buildCollapsedGroupGraph(detail, helpers) {
    const full = buildProductionGraph(detail, helpers, {});
    const allSteps = detail.steps ?? [];
    const groupMarks = detail.group_marks ?? {};

    if (!allSteps.length) {
      return { nodes: [], edges: [] };
    }

    const stepIdToGroupKey = new Map();
    const groupsByKey = new Map();

    for (const step of allSteps) {
      const key = helpers.getProductionGroupKey(step.group_name);
      stepIdToGroupKey.set(step.id, key);

      const existing = groupsByKey.get(key) ?? {
        key,
        name: helpers.getProductionGroupLabel?.(key) ?? key,
        marked: Number(groupMarks[key]) === 1,
        stepCount: 0,
        minOrder: step.sort_order ?? 0,
        inputs: new Map(),
        outputs: new Map(),
      };
      existing.stepCount += 1;
      existing.minOrder = Math.min(existing.minOrder, step.sort_order ?? 0);
      groupsByKey.set(key, existing);
    }

    const addIo = (bucket, edge) => {
      const current = bucket.get(edge.itemSlug) ?? {
        item_slug: edge.itemSlug,
        item_name: edge.itemName,
        item_image: edge.itemImage,
        is_fluid: Boolean(edge.isFluid),
        rate: 0,
      };
      current.rate = helpers.roundProduction(current.rate + edge.rate);
      if (!current.item_name && edge.itemName) current.item_name = edge.itemName;
      if (!current.item_image && edge.itemImage) current.item_image = edge.itemImage;
      bucket.set(edge.itemSlug, current);
    };

    const edges = [];
    const edgeAgg = new Map();
    const objectivesByKey = new Map();

    const addEdge = (from, to, edge, kind) => {
      const key = `${from}|${to}|${edge.itemSlug}|${kind}`;
      const existing = edgeAgg.get(key);
      if (existing) {
        existing.rate = helpers.roundProduction(existing.rate + edge.rate);
        return;
      }
      const next = {
        from,
        to,
        itemSlug: edge.itemSlug,
        itemName: edge.itemName,
        itemImage: edge.itemImage,
        isFluid: Boolean(edge.isFluid),
        rate: edge.rate,
        kind,
      };
      edgeAgg.set(key, next);
      edges.push(next);
    };

    const resolveStepGroupId = (nodeId) => {
      const stepId = parseStepIdFromNodeId(nodeId);
      if (stepId == null) return null;
      const groupKey = stepIdToGroupKey.get(stepId);
      return groupKey ? `group-${groupKey}` : null;
    };

    for (const edge of full.edges) {
      if (edge.kind === 'step-link') {
        const fromGroupId = resolveStepGroupId(edge.from);
        const toGroupId = resolveStepGroupId(edge.to);
        if (!fromGroupId || !toGroupId || fromGroupId === toGroupId) continue;

        addEdge(fromGroupId, toGroupId, edge, 'group-link');
        const fromKey = fromGroupId.slice(6);
        const toKey = toGroupId.slice(6);
        addIo(groupsByKey.get(fromKey).outputs, edge);
        addIo(groupsByKey.get(toKey).inputs, edge);
        continue;
      }

      if (edge.kind === 'extraction-link') {
        const toGroupId = resolveStepGroupId(edge.to);
        if (!toGroupId) continue;
        addEdge(edge.from, toGroupId, edge, 'extraction-link');
        addIo(groupsByKey.get(toGroupId.slice(6)).inputs, edge);
        continue;
      }

      if (edge.kind === 'objective-link') {
        const fromGroupId = resolveStepGroupId(edge.from);
        if (!fromGroupId) continue;
        const groupKey = fromGroupId.slice(6);
        const objectiveId = `obj-group-${groupKey}-${edge.itemSlug}`;
        const existingObjective = objectivesByKey.get(objectiveId);
        if (existingObjective) {
          existingObjective.rate = helpers.roundProduction(existingObjective.rate + edge.rate);
        } else {
          objectivesByKey.set(objectiveId, {
            group_key: groupKey,
            group_name: groupsByKey.get(groupKey)?.name ?? groupKey,
            item_slug: edge.itemSlug,
            item_name: edge.itemName,
            item_image: edge.itemImage,
            is_fluid: Boolean(edge.isFluid),
            rate: edge.rate,
          });
        }
        addEdge(fromGroupId, objectiveId, edge, 'objective-link');
        addIo(groupsByKey.get(groupKey).outputs, edge);
      }
    }

    const nodes = [];
    const usedExtractionIds = new Set(
      edges
        .filter((edge) => edge.from.startsWith('ext-'))
        .map((edge) => Number(edge.from.slice(4)))
    );

    for (const extraction of detail.extractions ?? []) {
      if (!usedExtractionIds.has(extraction.id)) continue;
      nodes.push({
        id: `ext-${extraction.id}`,
        type: 'extraction',
        layer: 0,
        data: extraction,
      });
    }

    const sortedGroups = [...groupsByKey.values()].sort((a, b) => {
      if (a.minOrder !== b.minOrder) return a.minOrder - b.minOrder;
      return String(a.name).localeCompare(String(b.name), 'it');
    });

    for (const group of sortedGroups) {
      nodes.push({
        id: `group-${group.key}`,
        type: 'group',
        layer: null,
        data: {
          key: group.key,
          name: group.name,
          marked: group.marked,
          stepCount: group.stepCount,
          inputs: [...group.inputs.values()].sort((a, b) =>
            String(a.item_name).localeCompare(String(b.item_name), 'it')
          ),
          outputs: [...group.outputs.values()].sort((a, b) =>
            String(a.item_name).localeCompare(String(b.item_name), 'it')
          ),
        },
      });
    }

    for (const [id, objective] of objectivesByKey) {
      nodes.push({
        id,
        type: 'objective',
        layer: null,
        data: objective,
      });
    }

    assignLayers(nodes, edges);
    compactLayers(nodes);
    return { nodes, edges };
  }

  function compactLayers(nodes) {
    const usedLayers = [...new Set(nodes.map((node) => node.layer))].sort((a, b) => a - b);
    const remap = new Map(usedLayers.map((layer, index) => [layer, index]));
    for (const node of nodes) {
      node.layer = remap.get(node.layer) ?? 0;
    }
  }

  function assignLayers(nodes, edges) {
    const layers = new Map();

    for (const node of nodes) {
      if (node.type === 'extraction') layers.set(node.id, 0);
    }

    for (const node of nodes) {
      if (node.type === 'supply') layers.set(node.id, 0);
    }

    for (let pass = 0; pass < nodes.length + 2; pass += 1) {
      for (const edge of edges) {
        const fromLayer = layers.get(edge.from);
        if (fromLayer === undefined) continue;
        const nextLayer = fromLayer + 1;
        const current = layers.get(edge.to);
        if (current === undefined || nextLayer > current) {
          layers.set(edge.to, nextLayer);
        }
      }
    }

    let fallbackLayer = 1;
    for (const node of nodes) {
      if (node.type !== 'step' && node.type !== 'group' && node.type !== 'generator') {
        continue;
      }
      if (!layers.has(node.id)) {
        layers.set(node.id, fallbackLayer);
      }
      fallbackLayer = Math.max(fallbackLayer, (layers.get(node.id) ?? 0) + 1);
    }

    let maxLayer = 0;
    for (const node of nodes) {
      if (node.type === 'objective') {
        const incoming = edges.filter((edge) => edge.to === node.id);
        const fromLayer = incoming.length
          ? Math.max(...incoming.map((edge) => layers.get(edge.from) ?? 0))
          : maxLayer;
        layers.set(node.id, fromLayer + 1);
      }
      maxLayer = Math.max(maxLayer, layers.get(node.id) ?? 0);
    }

    for (const node of nodes) {
      node.layer = layers.get(node.id) ?? 0;
    }
  }

  function groupNodesByLayer(nodes) {
    const maxLayer = Math.max(...nodes.map((node) => node.layer), 0);
    const groups = Array.from({ length: maxLayer + 1 }, () => []);
    for (const node of nodes) {
      groups[node.layer].push(node);
    }
    return groups;
  }

  function sortLayerNodes(layerNodes, edges, nodeIndexById) {
    return [...layerNodes].sort((a, b) => {
      const barycenter = (nodeId) => {
        const related = edges
          .filter((edge) => edge.to === nodeId || edge.from === nodeId)
          .map((edge) => (edge.to === nodeId ? edge.from : edge.to))
          .map((id) => nodeIndexById.get(id))
          .filter((index) => index != null);
        if (!related.length) return nodeIndexById.get(nodeId) ?? 0;
        return related.reduce((sum, value) => sum + value, 0) / related.length;
      };

      const cmp = barycenter(a.id) - barycenter(b.id);
      if (Math.abs(cmp) > 0.01) return cmp;

      if (a.type === 'step' && b.type === 'step') {
        return (a.data.sort_order ?? 0) - (b.data.sort_order ?? 0);
      }

      if (a.type === 'generator' && b.type === 'generator') {
        return (a.data.sort_order ?? 0) - (b.data.sort_order ?? 0);
      }

      if (a.type === 'group' && b.type === 'group') {
        return String(a.data.name ?? '').localeCompare(String(b.data.name ?? ''), 'it');
      }

      const order = { extraction: 0, supply: 0, group: 1, step: 1, generator: 1, objective: 2 };
      return (order[a.type] ?? 1) - (order[b.type] ?? 1);
    });
  }

  function getLayoutStorageKey(chainId, options = {}) {
    if (!chainId) return null;
    const detail = options.detailMode === 'complex' ? 'complex' : 'simple';
    if (options.collapseGroups) {
      return `${LAYOUT_STORAGE_PREFIX}${chainId}::groups::${detail}`;
    }
    if (options.groupKey) {
      return `${LAYOUT_STORAGE_PREFIX}${chainId}::group::${options.groupKey}::${detail}`;
    }
    return `${LAYOUT_STORAGE_PREFIX}${chainId}::${detail}`;
  }

  /** Pre-detailMode keys (v2 without ::simple/::complex). */
  function getLegacyLayoutStorageKey(chainId, options = {}) {
    if (!chainId) return null;
    if (options.collapseGroups) return `${LAYOUT_STORAGE_PREFIX}${chainId}::groups`;
    if (options.groupKey) return `${LAYOUT_STORAGE_PREFIX}${chainId}::group::${options.groupKey}`;
    return `${LAYOUT_STORAGE_PREFIX}${chainId}`;
  }

  function readLayoutJson(storageKey) {
    if (!storageKey) return {};
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  function parseLayoutNodeId(nodeId) {
    const id = String(nodeId ?? '');
    const bank = id.match(/^(step|ext)-(\d+)-bank-(\d+)$/);
    if (bank) {
      return {
        kind: bank[1],
        numericId: Number(bank[2]),
        bankIndex: Number(bank[3]),
        baseId: `${bank[1]}-${bank[2]}`,
      };
    }
    const plain = id.match(/^(step|ext)-(\d+)$/);
    if (plain) {
      return {
        kind: plain[1],
        numericId: Number(plain[2]),
        bankIndex: null,
        baseId: `${plain[1]}-${plain[2]}`,
      };
    }
    return { kind: 'other', numericId: null, bankIndex: null, baseId: id };
  }

  /**
   * Resolve a saved position for a node id, including Simple ↔ Complex mapping
   * (step-5 ↔ step-5-bank-0 / bank-N with vertical offset).
   */
  function resolveSavedNodePosition(nodeId, savedLayout) {
    if (!savedLayout || typeof savedLayout !== 'object') return null;
    const direct = savedLayout[nodeId];
    if (direct && Number.isFinite(direct.x) && Number.isFinite(direct.y)) {
      return { x: direct.x, y: direct.y };
    }

    const parsed = parseLayoutNodeId(nodeId);
    if (parsed.kind !== 'step' && parsed.kind !== 'ext') return null;

    // Complex bank node ← simple base position
    if (parsed.bankIndex != null) {
      const base = savedLayout[parsed.baseId];
      if (base && Number.isFinite(base.x) && Number.isFinite(base.y)) {
        return {
          x: base.x,
          y: base.y + parsed.bankIndex * (110 + NODE_GAP_Y),
        };
      }
      return null;
    }

    // Simple node ← complex bank-0 (or first bank found)
    const bank0 = savedLayout[`${parsed.baseId}-bank-0`];
    if (bank0 && Number.isFinite(bank0.x) && Number.isFinite(bank0.y)) {
      return { x: bank0.x, y: bank0.y };
    }
    for (const [key, pos] of Object.entries(savedLayout)) {
      if (!key.startsWith(`${parsed.baseId}-bank-`)) continue;
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
        return { x: pos.x, y: pos.y };
      }
    }
    return null;
  }

  function loadSavedLayout(chainId, options = {}) {
    const storageKey = getLayoutStorageKey(chainId, options);
    let parsed = readLayoutJson(storageKey);
    if (Object.keys(parsed).length) return parsed;

    // Migrate legacy key (no ::simple/::complex suffix)
    const legacyKey = getLegacyLayoutStorageKey(chainId, options);
    parsed = readLayoutJson(legacyKey);
    if (Object.keys(parsed).length) {
      saveLayout(chainId, parsed, options);
      return parsed;
    }

    // Fallback: other detail mode (map ids via resolveSavedNodePosition)
    const otherMode = {
      ...options,
      detailMode: options.detailMode === 'complex' ? 'simple' : 'complex',
    };
    const otherKey = getLayoutStorageKey(chainId, otherMode);
    parsed = readLayoutJson(otherKey);
    if (Object.keys(parsed).length) return parsed;

    const otherLegacy = getLegacyLayoutStorageKey(chainId, otherMode);
    return readLayoutJson(otherLegacy);
  }

  function saveLayout(chainId, positions, options = {}) {
    const storageKey = getLayoutStorageKey(chainId, options);
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(positions));
    } catch {
      /* storage pieno o disabilitato */
    }
  }

  function computeLayerGap(layerCount, availableWidth) {
    if (layerCount <= 1) return 0;
    const usable = Math.max(320, availableWidth - PADDING * 2);
    const nodesWidth = layerCount * NODE_WIDTH;
    const gap = (usable - nodesWidth) / (layerCount - 1);
    // Never go below MIN — allow the stage to scroll horizontally instead.
    return Math.max(MIN_LAYER_GAP_X, Math.min(MAX_LAYER_GAP_X, Number.isFinite(gap) ? gap : MIN_LAYER_GAP_X));
  }

  function estimateNodeHeight(node, helpers) {
    const base = 110;
    if (node.type === 'extraction' || node.type === 'objective' || node.type === 'supply') {
      return base + 36;
    }

    if (node.type === 'group') {
      const inputCount = node.data.inputs?.length ?? 0;
      const outputCount = node.data.outputs?.length ?? 0;
      let height = base + 18;
      if (inputCount) height += 16 + inputCount * 24;
      if (outputCount) height += 16 + outputCount * 24;
      return height;
    }

    if (node.type === 'generator') {
      const generator = node.data;
      let inputCount = 0;
      if ((generator.fuel_consumption ?? 0) > 0) inputCount += 1;
      if ((generator.water_consumption ?? 0) > 0) inputCount += 1;
      const outputCount = 1 + ((generator.waste_output ?? 0) > 0 ? 1 : 0);
      let height = base;
      if (inputCount) height += 16 + inputCount * 24;
      if (outputCount) height += 16 + outputCount * 24;
      return height;
    }

    const step = node.data;
    const share = step._bank?.share ?? 1;
    const inputCount = (step.scaled_inputs ?? []).filter(
      (io) => helpers.getStepInputRateForItem(step, io.item_slug) * share > 0
    ).length;
    const outputCount = (step.scaled_outputs ?? []).filter(
      (io) => helpers.getStepOutputRateForItem(step, io.item_slug) * share > 0
    ).length;

    let height = base + (step._bank?.split ? 18 : 0);
    if (inputCount) height += 16 + inputCount * 24;
    if (outputCount) height += 16 + outputCount * 24;
    return height;
  }

  function reflowLayerPositions(nodesHost) {
    const nodes = [...nodesHost.querySelectorAll('.production-graph-node')];
    if (!nodes.length) return;

    const byX = new Map();
    for (const node of nodes) {
      const x = Math.round(parseFloat(node.style.left) || 0);
      if (!byX.has(x)) byX.set(x, []);
      byX.get(x).push(node);
    }

    for (const column of byX.values()) {
      column.sort((a, b) => (parseFloat(a.style.top) || 0) - (parseFloat(b.style.top) || 0));
      let y = PADDING;
      for (const node of column) {
        node.style.top = `${y}px`;
        y += node.offsetHeight + NODE_GAP_Y;
      }
    }
  }

  function computeAutoLayout(nodes, edges, savedLayout = {}, layerGap = MAX_LAYER_GAP_X, helpers) {
    const positions = {};
    const layers = groupNodesByLayer(nodes);
    const layerStackHeights = layers.map((layer) => {
      let total = 0;
      layer.forEach((node, index) => {
        total += estimateNodeHeight(node, helpers) + (index > 0 ? NODE_GAP_Y : 0);
      });
      return total;
    });
    const columnHeight = Math.max(...layerStackHeights, estimateNodeHeight(nodes[0], helpers));

    let globalIndex = 0;
    const nodeIndexById = new Map();

    for (let layerIndex = 0; layerIndex < layers.length; layerIndex += 1) {
      const sorted = sortLayerNodes(layers[layerIndex], edges, nodeIndexById);
      let layerHeight = 0;
      sorted.forEach((node, index) => {
        layerHeight += estimateNodeHeight(node, helpers) + (index > 0 ? NODE_GAP_Y : 0);
      });
      let currentY = PADDING + (columnHeight - layerHeight) / 2;
      const x = PADDING + layerIndex * (NODE_WIDTH + layerGap);

      sorted.forEach((node) => {
        nodeIndexById.set(node.id, globalIndex);
        globalIndex += 1;

        const saved = resolveSavedNodePosition(node.id, savedLayout);
        if (saved) {
          positions[node.id] = { x: saved.x, y: saved.y };
        } else {
          positions[node.id] = { x, y: currentY };
        }
        currentY += estimateNodeHeight(node, helpers) + NODE_GAP_Y;
      });
    }

    return positions;
  }

  function renderIoRow(io, rate, helpers) {
    const unit = io.unit || (io.is_fluid ? 'm³/min' : '/min');
    return `
      <div class="production-graph-node-io-row">
        ${renderNodeIcon(io.item_image, 'production-graph-node-io-icon', helpers)}
        <span class="production-graph-node-io-name">${helpers.escapeHtml(io.item_name || io.item_slug)}</span>
        <span class="production-graph-node-io-rate">${helpers.formatRateWithUnit(rate, unit)}</span>
      </div>`;
  }

  function renderStepIoSections(step, helpers) {
    const share = step._bank?.share ?? 1;
    const round = (value) => helpers.roundProduction?.(value) ?? value;
    const inputs = (step.scaled_inputs ?? [])
      .map((io) => ({
        io,
        rate: round(helpers.getStepInputRateForItem(step, io.item_slug) * share),
      }))
      .filter(({ rate }) => rate > 0);

    const outputs = (step.scaled_outputs ?? [])
      .map((io) => ({
        io,
        rate: round(helpers.getStepOutputRateForItem(step, io.item_slug) * share),
      }))
      .filter(({ rate }) => rate > 0);

    const inputHtml = inputs.length
      ? `<div class="production-graph-node-io">
          <span class="production-graph-node-io-label">${escapeHtml(t('common.input'))}</span>
          ${inputs.map(({ io, rate }) => renderIoRow(io, rate, helpers)).join('')}
        </div>`
      : '';

    const outputHtml = outputs.length
      ? `<div class="production-graph-node-io">
          <span class="production-graph-node-io-label">${escapeHtml(t('common.output'))}</span>
          ${outputs.map(({ io, rate }) => renderIoRow(io, rate, helpers)).join('')}
        </div>`
      : '';

    return `${inputHtml}${outputHtml}`;
  }

  function renderNodeIcon(imgSrc, className, helpers) {
    if (imgSrc) {
      return `<img class="${className}" src="${helpers.escapeHtml(imgSrc)}" alt="" draggable="false" />`;
    }
    return `<span class="resource-img resource-img--placeholder ${className}"></span>`;
  }

  function renderExtractionNode(node, helpers) {
    const extraction = node.data;
    const bank = extraction._bank;
    const share = bank?.share ?? 1;
    const displayName = helpers.getExtractionDisplayName(extraction, helpers.extractions);
    const item = extraction.item;
    const rate = helpers.roundProduction?.(helpers.getExtractionOutputRate(extraction) * share)
      ?? helpers.getExtractionOutputRate(extraction) * share;
    const baseInfo =
      helpers.computeExtractionBuildInfo?.(extraction) ||
      {
        machines: extraction.node_count,
        overclock: extraction.overclock,
        isExtraction: true,
        needsSplit: false,
        banks: [extraction.node_count],
        manifoldCount: 1,
      };
    const buildInfo = bank?.split
      ? {
          ...baseInfo,
          machines: bank.machines,
          needsSplit: false,
          banks: [bank.machines],
          manifoldCount: 1,
          isExtraction: true,
        }
      : baseInfo;
    const bankLabel =
      bank?.split
        ? `<span class="production-graph-node-bank">${helpers.escapeHtml(
            t('graph.manifoldBank', { index: bank.index + 1, count: bank.bankCount })
          )}</span>`
        : '';

    return `
      <div class="production-graph-node production-graph-node--extraction${
        bank?.split ? ' production-graph-node--manifold-bank' : ''
      }" data-node-id="${node.id}" role="button" tabindex="0" aria-grabbed="false">
        <div class="production-graph-node-icons">
          ${renderNodeIcon(item?.image, 'production-graph-item-icon', helpers)}
          ${renderNodeIcon(extraction.building_image, 'production-graph-building-icon', helpers)}
        </div>
        <div class="production-graph-node-body">
          <span class="production-graph-node-type">${escapeHtml(t('graph.extraction'))}</span>
          <strong class="production-graph-node-title">${helpers.escapeHtml(displayName)}</strong>
          ${bankLabel}
          ${helpers.renderBuildStatsBadge?.(buildInfo) || ''}
          <div class="production-graph-node-io">
            <span class="production-graph-node-io-label">${escapeHtml(t('common.output'))}</span>
            ${renderIoRow({ item_image: item?.image, item_name: item?.name || displayName, item_slug: item?.slug, is_fluid: item?.is_fluid }, rate, helpers)}
          </div>
        </div>
      </div>`;
  }

  function renderStepNode(node, helpers) {
    const step = node.data;
    const bank = step._bank;
    const item = step.item;
    const schema = step.schema;
    const isSink = Number(step.is_sink) === 1;
    const isMarked = Number(step.marked) === 1;
    const slots = window.ProductionScale?.getSomersloopSlots?.(schema) ?? 0;
    const hasSomersloop =
      !isSink &&
      slots > 0 &&
      (window.ProductionScale?.countSomersloopChecked?.(step.somersloop_mask ?? 0, slots) ?? 0) > 0;
    const baseInfo = helpers.computeStepBuildInfo?.(step) || {
      machines: step.machine_count,
      overclock: step.overclock,
      needsSplit: false,
      banks: [step.machine_count],
      manifoldCount: 1,
    };
    const buildInfo = bank?.split
      ? {
          ...baseInfo,
          machines: bank.machines,
          needsSplit: false,
          banks: [bank.machines],
          manifoldCount: 1,
        }
      : baseInfo;
    const bankLabel =
      bank?.split
        ? `<span class="production-graph-node-bank">${helpers.escapeHtml(
            t('graph.manifoldBank', { index: bank.index + 1, count: bank.bankCount })
          )}</span>`
        : '';
    const nodeClasses = [
      'production-graph-node',
      'production-graph-node--step',
      isSink ? 'production-graph-node--sink' : '',
      isMarked ? 'production-graph-node--marked' : '',
      hasSomersloop ? 'production-graph-node--somersloop' : '',
      bank?.split ? 'production-graph-node--manifold-bank' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return `
      <div class="${nodeClasses}" data-node-id="${node.id}" role="button" tabindex="0" aria-grabbed="false">
        ${
          isSink
            ? ''
            : `<label
          class="production-graph-step-mark-btn${isMarked ? ' production-graph-step-mark-btn--active' : ''}"
          title="${escapeHtml(t('production.highlightStepTitle'))}"
          aria-label="${escapeHtml(t('graph.highlightStepAria', { name: step.name }))}"
        >
          <input
            type="checkbox"
            class="production-graph-step-mark-checkbox"
            data-step-id="${step.id}"
            ${isMarked ? 'checked' : ''}
          />
          <i class="fa-solid ${isMarked ? 'fa-xmark' : 'fa-check'}" aria-hidden="true"></i>
        </label>`
        }
        <div class="production-graph-node-icons">
          ${renderNodeIcon(item?.image, 'production-graph-item-icon', helpers)}
          ${renderNodeIcon(schema?.building_image, 'production-graph-building-icon', helpers)}
        </div>
        <div class="production-graph-node-body">
          <span class="production-graph-node-type">${helpers.escapeHtml(
            isSink ? t('graph.sink') : schema?.building_name || t('common.schema')
          )}</span>
          <strong class="production-graph-node-title">${helpers.escapeHtml(step.name)}</strong>
          ${bankLabel}
          ${helpers.renderBuildStatsBadge?.(buildInfo) || ''}
          ${renderStepIoSections(step, helpers)}
        </div>
      </div>`;
  }

  function renderGroupIoSections(group, helpers) {
    const inputHtml = group.inputs?.length
      ? `<div class="production-graph-node-io">
          <span class="production-graph-node-io-label">${escapeHtml(t('graph.mainInputs'))}</span>
          ${group.inputs.map((io) => renderIoRow(io, io.rate, helpers)).join('')}
        </div>`
      : '';

    const outputHtml = group.outputs?.length
      ? `<div class="production-graph-node-io">
          <span class="production-graph-node-io-label">${escapeHtml(t('graph.mainOutputs'))}</span>
          ${group.outputs.map((io) => renderIoRow(io, io.rate, helpers)).join('')}
        </div>`
      : '';

    return `${inputHtml}${outputHtml}`;
  }

  function renderGroupNode(node, helpers) {
    const group = node.data;
    const isMarked = Boolean(group.marked);
    const stepLabel =
      group.stepCount === 1
        ? t('graph.resourceStepOne')
        : t('graph.resourceStepMany', { count: group.stepCount });

    return `
      <div class="production-graph-node production-graph-node--group${isMarked ? ' production-graph-node--marked' : ''}" data-node-id="${node.id}" role="button" tabindex="0" aria-grabbed="false">
        <div class="production-graph-node-body">
          <span class="production-graph-node-type">${escapeHtml(t('graph.grouping'))}</span>
          <strong class="production-graph-node-title">${helpers.escapeHtml(group.name)}</strong>
          <span class="production-graph-node-rate">${helpers.escapeHtml(stepLabel)}</span>
          ${renderGroupIoSections(group, helpers)}
        </div>
      </div>`;
  }

  function renderObjectiveNode(node, helpers) {
    const objective = node.data;

    return `
      <div class="production-graph-node production-graph-node--objective" data-node-id="${node.id}" role="button" tabindex="0" aria-grabbed="false">
        <div class="production-graph-node-icons">
          ${renderNodeIcon(objective.item_image, 'production-graph-item-icon production-graph-item-icon--large', helpers)}
        </div>
        <div class="production-graph-node-body">
          <span class="production-graph-node-type">${escapeHtml(t('graph.objective'))}</span>
          <strong class="production-graph-node-title">${helpers.escapeHtml(objective.item_name)}</strong>
          <div class="production-graph-node-io">
            <span class="production-graph-node-io-label">${escapeHtml(t('common.output'))}</span>
            ${renderIoRow(objective, objective.rate, helpers)}
          </div>
        </div>
      </div>`;
  }

  function renderSupplyNode(node, helpers) {
    const supply = node.data;
    const unit = supply.is_fluid ? 'm³/min' : '/min';

    return `
      <div class="production-graph-node production-graph-node--supply" data-node-id="${node.id}" role="button" tabindex="0" aria-grabbed="false">
        <div class="production-graph-node-icons">
          ${renderNodeIcon(supply.item_image, 'production-graph-item-icon', helpers)}
        </div>
        <div class="production-graph-node-body">
          <span class="production-graph-node-type">${escapeHtml(t('graph.supply'))}</span>
          <strong class="production-graph-node-title">${helpers.escapeHtml(
            supply.producer_step_name || supply.item_name || supply.item_slug
          )}</strong>
          ${
            supply.producer_chain_name
              ? `<span class="production-graph-node-rate">${helpers.escapeHtml(supply.producer_chain_name)}</span>`
              : ''
          }
          <div class="production-graph-node-io">
            <span class="production-graph-node-io-label">${escapeHtml(t('common.output'))}</span>
            ${renderIoRow(
              {
                item_image: supply.item_image,
                item_name: supply.item_name || supply.item_slug,
                item_slug: supply.item_slug,
                is_fluid: supply.is_fluid,
                unit,
              },
              supply.rate,
              helpers
            )}
          </div>
        </div>
      </div>`;
  }

  function renderGeneratorNode(node, helpers) {
    const generator = node.data;
    const buildInfo =
      helpers.computeGeneratorBuildInfo?.(generator) ||
      {
        machines: generator.machine_count,
        overclock: generator.overclock,
        needsSplit: false,
        banks: [generator.machine_count],
        manifoldCount: 1,
      };

    const inputs = [];
    if ((generator.fuel_consumption ?? 0) > 0) {
      inputs.push({
        io: {
          item_image: generator.fuel_item?.image,
          item_name: generator.fuel_item?.name || generator.fuel_label || generator.fuel_item_slug,
          item_slug: generator.fuel_item_slug,
          is_fluid: Boolean(generator.fuel_is_fluid || generator.fuel_item?.is_fluid),
        },
        rate: generator.fuel_consumption,
      });
    }
    if ((generator.water_consumption ?? 0) > 0) {
      inputs.push({
        io: {
          item_image: generator.water_item?.image,
          item_name: generator.water_item?.name || 'water',
          item_slug: 'water',
          is_fluid: true,
        },
        rate: generator.water_consumption,
      });
    }

    const outputs = [
      {
        io: {
          item_slug: 'power',
          item_name: t('energy.totalPower'),
          item_image: null,
          unit: 'MW',
        },
        rate: generator.power_output_mw ?? 0,
      },
    ];
    if ((generator.waste_output ?? 0) > 0 && generator.waste_item_slug) {
      outputs.push({
        io: {
          item_image: generator.waste_item?.image,
          item_name: generator.waste_item?.name || generator.waste_label || generator.waste_item_slug,
          item_slug: generator.waste_item_slug,
          is_fluid: false,
        },
        rate: generator.waste_output,
      });
    }

    const inputHtml = inputs.length
      ? `<div class="production-graph-node-io">
          <span class="production-graph-node-io-label">${escapeHtml(t('common.input'))}</span>
          ${inputs.map(({ io, rate }) => renderIoRow(io, rate, helpers)).join('')}
        </div>`
      : '';
    const outputHtml = `<div class="production-graph-node-io">
          <span class="production-graph-node-io-label">${escapeHtml(t('common.output'))}</span>
          ${outputs.map(({ io, rate }) => renderIoRow(io, rate, helpers)).join('')}
        </div>`;

    return `
      <div class="production-graph-node production-graph-node--generator${
        helpers.treeDetailMode === 'complex' && buildInfo.needsSplit
          ? ' production-graph-node--manifold-split'
          : ''
      }" data-node-id="${node.id}" role="button" tabindex="0" aria-grabbed="false">
        <div class="production-graph-node-icons">
          ${renderNodeIcon(generator.fuel_item?.image, 'production-graph-item-icon', helpers)}
          ${renderNodeIcon(generator.building_image, 'production-graph-building-icon', helpers)}
        </div>
        <div class="production-graph-node-body">
          <span class="production-graph-node-type">${helpers.escapeHtml(
            generator.building_name || t('common.generator')
          )}</span>
          <strong class="production-graph-node-title">${helpers.escapeHtml(
            generator.fuel_item?.name || generator.fuel_label || generator.building_name
          )}</strong>
          ${helpers.renderBuildStatsBadge?.(buildInfo) || ''}
          ${inputHtml}
          ${outputHtml}
        </div>
      </div>`;
  }

  function renderNode(node, helpers, position) {
    const html =
      node.type === 'extraction'
        ? renderExtractionNode(node, helpers)
        : node.type === 'objective'
          ? renderObjectiveNode(node, helpers)
          : node.type === 'group'
            ? renderGroupNode(node, helpers)
            : node.type === 'generator'
              ? renderGeneratorNode(node, helpers)
              : node.type === 'supply'
                ? renderSupplyNode(node, helpers)
                : renderStepNode(node, helpers);

    return html.replace(
      '<div class="production-graph-node',
      `<div style="left:${position.x}px;top:${position.y}px" class="production-graph-node`
    );
  }

  function renderEdgeLabel(edge, helpers) {
    const img = edge.itemImage
      ? `<img class="production-graph-edge-icon" src="${helpers.escapeHtml(edge.itemImage)}" alt="" draggable="false" />`
      : `<span class="resource-img resource-img--placeholder production-graph-edge-icon"></span>`;

    const showTransport = Boolean(helpers.showEdgeTransport);
    const transport = showTransport ? helpers.describeEdgeTransport?.(edge) : null;
    const unit = edge.unit || (edge.isFluid ? 'm³/min' : '/min');
    const rateText = helpers.formatRateWithUnit
      ? helpers.formatRateWithUnit(edge.rate, unit)
      : `${edge.rate}${unit}`;
    let transportHtml = '';
    if (transport) {
      const key = transport.isFluid
        ? transport.over
          ? 'graph.pipeOver'
          : 'graph.pipeOk'
        : transport.over
          ? 'graph.beltOver'
          : 'graph.beltOk';
      transportHtml = `<span class="production-graph-edge-transport${
        transport.over ? ' production-graph-edge-transport--over' : ''
      }">${helpers.escapeHtml(
        t(key, {
          count: transport.count,
          mk: transport.mk,
          rate: helpers.formatDisplayNumber?.(transport.rate) ?? transport.rate,
          capacity: helpers.formatDisplayNumber?.(transport.capacity) ?? transport.capacity,
        })
      )}</span>`;
    }

    return `
      <div
        class="production-graph-edge-label production-graph-edge-label--${edge.kind}${
          transport ? ' production-graph-edge-label--with-transport' : ''
        }${transport?.over ? ' production-graph-edge-label--over' : ''}"
        data-edge-id="${helpers.escapeHtml(edge.id)}"
        title="${helpers.escapeHtml(
          [edge.itemName, rateText].filter(Boolean).join(' · ')
        )}"
      >
        ${img}
        <div class="production-graph-edge-body">
          <span class="production-graph-edge-name">${helpers.escapeHtml(edge.itemName)}</span>
          <span class="production-graph-edge-rate">${helpers.escapeHtml(rateText)}</span>
          ${transportHtml}
        </div>
      </div>`;
  }

  function updateStageSize(stage, nodesHost, scrollEl) {
    let maxX = PADDING;
    let maxY = PADDING;

    for (const node of nodesHost.querySelectorAll('.production-graph-node')) {
      const x = parseFloat(node.style.left) || 0;
      const y = parseFloat(node.style.top) || 0;
      maxX = Math.max(maxX, x + node.offsetWidth + PADDING);
      maxY = Math.max(maxY, y + node.offsetHeight + PADDING);
    }

    // Keep full layout width so columns are not crushed; scroll horizontally.
    const minWidth = scrollEl?.clientWidth || 0;
    stage.style.width = `${Math.max(maxX, minWidth)}px`;
    stage.style.height = `${maxY}px`;
  }

  function getNodeAnchor(el) {
    const left = el.offsetLeft;
    const top = el.offsetTop;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    return {
      left,
      right: left + width,
      centerY: top + height / 2,
    };
  }

  function cubicPoint(x1, y1, cx1, cy1, cx2, cy2, x2, y2, t) {
    const u = 1 - t;
    return {
      x: u * u * u * x1 + 3 * u * u * t * cx1 + 3 * u * t * t * cx2 + t * t * t * x2,
      y: u * u * u * y1 + 3 * u * u * t * cy1 + 3 * u * t * t * cy2 + t * t * t * y2,
    };
  }

  function drawEdges(stage, svg, labelsHost, edges) {
    const width = stage.offsetWidth;
    const height = stage.offsetHeight;

    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const pairCounts = new Map();
    const pairIndexes = new Map();
    for (const edge of edges) {
      const key = `${edge.from}|${edge.to}`;
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
    }

    const LABEL_SPREAD = 52;
    const paths = [];
    edges.forEach((edge) => {
      const fromEl = stage.querySelector(`[data-node-id="${edge.from}"]`);
      const toEl = stage.querySelector(`[data-node-id="${edge.to}"]`);
      const labelEl = labelsHost.querySelector(`[data-edge-id="${edge.id}"]`);
      if (!fromEl || !toEl) return;

      const fromRect = getNodeAnchor(fromEl);
      const toRect = getNodeAnchor(toEl);

      const x1 = fromRect.right;
      const y1 = fromRect.centerY;
      const x2 = toRect.left;
      const y2 = toRect.centerY;
      const cx = (x1 + x2) / 2;

      const pairKey = `${edge.from}|${edge.to}`;
      const pairCount = pairCounts.get(pairKey) ?? 1;
      const pairIndex = pairIndexes.get(pairKey) ?? 0;
      pairIndexes.set(pairKey, pairIndex + 1);
      const bendOffset =
        pairCount > 1 ? (pairIndex - (pairCount - 1) / 2) * LABEL_SPREAD : 0;

      const cy1 = y1 + bendOffset;
      const cy2 = y2 + bendOffset;
      const pathD = `M ${x1} ${y1} C ${cx} ${cy1}, ${cx} ${cy2}, ${x2} ${y2}`;
      paths.push(
        `<path class="production-graph-edge production-graph-edge--${edge.kind}" d="${pathD}" data-edge-id="${edge.id}" />`
      );

      if (labelEl) {
        const point = cubicPoint(x1, y1, cx, cy1, cx, cy2, x2, y2, 0.5);
        labelEl.style.left = `${point.x}px`;
        labelEl.style.top = `${point.y}px`;
      }
    });

    svg.innerHTML = paths.join('');
  }

  function collectPositions(nodesHost) {
    const positions = {};
    for (const node of nodesHost.querySelectorAll('.production-graph-node')) {
      positions[node.dataset.nodeId] = {
        x: parseFloat(node.style.left) || 0,
        y: parseFloat(node.style.top) || 0,
      };
    }
    return positions;
  }

  function setupNodeDragging(
    stage,
    nodesHost,
    chainId,
    scrollEl,
    onChange,
    layoutOptions = {},
    getScale = () => 1,
    camera = null
  ) {
    let dragState = null;

    const finishDrag = (e) => {
      if (!dragState || dragState.pointerId !== e.pointerId) return;

      const { node } = dragState;
      try {
        node.releasePointerCapture(e.pointerId);
      } catch {
        /* già rilasciato */
      }

      node.classList.remove('production-graph-node--dragging');
      node.setAttribute('aria-grabbed', 'false');
      dragState = null;

      updateStageSize(stage, nodesHost, scrollEl);
      saveLayout(chainId, collectPositions(nodesHost), layoutOptions);
      onChange();
    };

    nodesHost.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.production-graph-step-mark-btn, .production-graph-step-mark-checkbox')) {
        return;
      }
      const node = e.target.closest('.production-graph-node');
      if (!node || e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();
      dragState = {
        node,
        pointerId: e.pointerId,
        startLeft: parseFloat(node.style.left) || 0,
        startTop: parseFloat(node.style.top) || 0,
        originClientX: e.clientX,
        originClientY: e.clientY,
      };

      node.setPointerCapture(e.pointerId);
      node.classList.add('production-graph-node--dragging');
      node.setAttribute('aria-grabbed', 'true');
    });

    nodesHost.addEventListener('pointermove', (e) => {
      if (!dragState || dragState.pointerId !== e.pointerId) return;

      const scale = Math.max(0.05, Number(getScale()) || 1);
      let x = dragState.startLeft + (e.clientX - dragState.originClientX) / scale;
      let y = dragState.startTop + (e.clientY - dragState.originClientY) / scale;

      // Grow the stage up/left when dragging past the origin: shift peers and
      // nudge the camera so the box stays under the cursor.
      const shiftX = x < 0 ? -x : 0;
      const shiftY = y < 0 ? -y : 0;
      if (shiftX || shiftY) {
        for (const n of nodesHost.querySelectorAll('.production-graph-node')) {
          n.style.left = `${(parseFloat(n.style.left) || 0) + shiftX}px`;
          n.style.top = `${(parseFloat(n.style.top) || 0) + shiftY}px`;
        }
        dragState.startLeft += shiftX;
        dragState.startTop += shiftY;
        x += shiftX;
        y += shiftY;
        camera?.nudgePan?.(shiftX * scale, shiftY * scale);
      }

      dragState.node.style.left = `${Math.max(0, x)}px`;
      dragState.node.style.top = `${Math.max(0, y)}px`;
      onChange();
    });

    nodesHost.addEventListener('pointerup', finishDrag);
    nodesHost.addEventListener('pointercancel', finishDrag);
  }

  function renderGraphZoomControls(escapeHtml) {
    return `
      <div class="production-graph-zoom" role="group" aria-label="${escapeHtml(t('graph.zoomAria'))}">
        <button type="button" class="production-graph-zoom-btn" data-graph-zoom="out" title="${escapeHtml(
          t('graph.zoomOut')
        )}" aria-label="${escapeHtml(t('graph.zoomOut'))}">−</button>
        <button type="button" class="production-graph-zoom-btn production-graph-zoom-label" data-graph-zoom="reset" title="${escapeHtml(
          t('graph.zoomReset')
        )}">100%</button>
        <button type="button" class="production-graph-zoom-btn" data-graph-zoom="in" title="${escapeHtml(
          t('graph.zoomIn')
        )}" aria-label="${escapeHtml(t('graph.zoomIn'))}">+</button>
        <button type="button" class="production-graph-zoom-btn" data-graph-zoom="fit" title="${escapeHtml(
          t('graph.zoomFitTitle')
        )}">${escapeHtml(t('graph.zoomFit'))}</button>
        <button
          type="button"
          class="production-graph-zoom-btn"
          data-graph-zoom="fullscreen"
          title="${escapeHtml(t('graph.fullscreenTitle'))}"
          aria-label="${escapeHtml(t('graph.fullscreen'))}"
          aria-pressed="false"
        >
          <i class="fa-solid fa-expand" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="production-graph-zoom-btn"
          data-graph-zoom="export"
          title="${escapeHtml(t('graph.exportPngTitle'))}"
          aria-label="${escapeHtml(t('graph.exportPng'))}"
        >
          <i class="fa-solid fa-image" aria-hidden="true"></i>
        </button>
      </div>`;
  }

  function renderEdgeTransportToggle(escapeHtml, enabled) {
    const on = Boolean(enabled);
    return `
      <button
        type="button"
        class="production-graph-detail-btn production-graph-transport-btn${on ? ' is-active' : ''}"
        data-tree-edge-transport="${on ? '0' : '1'}"
        title="${escapeHtml(on ? t('graph.edgeTransportHideTitle') : t('graph.edgeTransportShowTitle'))}"
        aria-pressed="${on ? 'true' : 'false'}"
        aria-label="${escapeHtml(t('graph.edgeTransportAria'))}"
      >${escapeHtml(t('graph.edgeTransport'))}</button>`;
  }

  function setupGraphCamera(scrollEl, panEl, worldEl, stage, nodesHost, zoomLabelEl) {
    const MIN_SCALE = 0.25;
    const MAX_SCALE = 2.5;
    let scale = 1;
    let panX = 16;
    let panY = 16;
    let panState = null;

    const apply = () => {
      // Pan with transform (screen px); zoom with CSS zoom so text/nodes stay sharp.
      panEl.style.transform = `translate(${panX}px, ${panY}px)`;
      worldEl.style.zoom = String(scale);
      if (zoomLabelEl) {
        zoomLabelEl.textContent = `${Math.round(scale * 100)}%`;
      }
    };

    const clampScale = (value) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

    const zoomAt = (nextScale, clientX, clientY) => {
      const rect = scrollEl.getBoundingClientRect();
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const worldX = (mx - panX) / scale;
      const worldY = (my - panY) / scale;
      scale = clampScale(nextScale);
      panX = mx - worldX * scale;
      panY = my - worldY * scale;
      apply();
    };

    const fit = () => {
      const nodes = [...nodesHost.querySelectorAll('.production-graph-node')];
      if (!nodes.length) {
        scale = 1;
        panX = 16;
        panY = 16;
        apply();
        return;
      }

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const node of nodes) {
        const x = parseFloat(node.style.left) || 0;
        const y = parseFloat(node.style.top) || 0;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + node.offsetWidth);
        maxY = Math.max(maxY, y + node.offsetHeight);
      }

      const contentW = Math.max(1, maxX - minX);
      const contentH = Math.max(1, maxY - minY);
      const viewW = Math.max(1, scrollEl.clientWidth);
      const viewH = Math.max(1, scrollEl.clientHeight);
      const pad = 48;
      const next = clampScale(Math.min((viewW - pad * 2) / contentW, (viewH - pad * 2) / contentH, 1));
      scale = next;
      panX = (viewW - contentW * scale) / 2 - minX * scale;
      panY = (viewH - contentH * scale) / 2 - minY * scale;
      apply();
    };

    const onWheel = (event) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
      zoomAt(scale * factor, event.clientX, event.clientY);
    };

    const onPointerDown = (event) => {
      if (event.target.closest('.production-graph-node')) return;
      if (event.button !== 0 && event.button !== 1) return;
      event.preventDefault();
      panState = {
        pointerId: event.pointerId,
        originX: event.clientX,
        originY: event.clientY,
        startPanX: panX,
        startPanY: panY,
      };
      scrollEl.classList.add('is-panning');
      scrollEl.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event) => {
      if (!panState || panState.pointerId !== event.pointerId) return;
      panX = panState.startPanX + (event.clientX - panState.originX);
      panY = panState.startPanY + (event.clientY - panState.originY);
      apply();
    };

    const onPointerUp = (event) => {
      if (!panState || panState.pointerId !== event.pointerId) return;
      panState = null;
      scrollEl.classList.remove('is-panning');
      try {
        scrollEl.releasePointerCapture(event.pointerId);
      } catch {
        /* already released */
      }
    };

    scrollEl.addEventListener('wheel', onWheel, { passive: false });
    scrollEl.addEventListener('pointerdown', onPointerDown);
    scrollEl.addEventListener('pointermove', onPointerMove);
    scrollEl.addEventListener('pointerup', onPointerUp);
    scrollEl.addEventListener('pointercancel', onPointerUp);

    apply();

    return {
      getScale: () => scale,
      zoomBy: (factor) => {
        const rect = scrollEl.getBoundingClientRect();
        zoomAt(scale * factor, rect.left + rect.width / 2, rect.top + rect.height / 2);
      },
      reset: () => {
        scale = 1;
        panX = 16;
        panY = 16;
        apply();
      },
      fit,
      apply,
      snapshot: () => ({ scale, panX, panY }),
      restore: (state) => {
        if (!state) return;
        scale = clampScale(Number(state.scale) || 1);
        panX = Number(state.panX) || 0;
        panY = Number(state.panY) || 0;
        apply();
      },
      prepareForExport: () => {
        scale = 1;
        panX = 0;
        panY = 0;
        apply();
      },
      nudgePan: (dx, dy) => {
        panX += Number(dx) || 0;
        panY += Number(dy) || 0;
        apply();
      },
      destroy: () => {
        scrollEl.removeEventListener('wheel', onWheel);
        scrollEl.removeEventListener('pointerdown', onPointerDown);
        scrollEl.removeEventListener('pointermove', onPointerMove);
        scrollEl.removeEventListener('pointerup', onPointerUp);
        scrollEl.removeEventListener('pointercancel', onPointerUp);
      },
    };
  }

  function isGraphFullscreen(graphEl) {
    return Boolean(
      graphEl?.classList.contains('production-graph--fullscreen') ||
        document.fullscreenElement === graphEl
    );
  }

  function syncFullscreenButton(graphEl) {
    const btn = graphEl?.querySelector('[data-graph-zoom="fullscreen"]');
    if (!btn) return;
    const active = isGraphFullscreen(graphEl);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.title = active ? t('graph.fullscreenExitTitle') : t('graph.fullscreenTitle');
    btn.setAttribute('aria-label', active ? t('graph.fullscreenExit') : t('graph.fullscreen'));
    const icon = btn.querySelector('i');
    if (icon) {
      icon.className = `fa-solid ${active ? 'fa-compress' : 'fa-expand'}`;
    }
  }

  async function toggleGraphFullscreen(graphEl) {
    if (!graphEl) return;
    const active = isGraphFullscreen(graphEl);

    if (active) {
      graphEl.classList.remove('production-graph--fullscreen');
      if (document.fullscreenElement === graphEl && document.exitFullscreen) {
        try {
          await document.exitFullscreen();
        } catch {
          /* ignore */
        }
      }
    } else {
      graphEl.classList.add('production-graph--fullscreen');
      if (graphEl.requestFullscreen) {
        try {
          await graphEl.requestFullscreen();
        } catch {
          /* CSS fallback still covers the window */
        }
      }
    }
    syncFullscreenButton(graphEl);
  }

  function setupGraphFullscreen(graphEl, onChange) {
    const onFullscreenChange = () => {
      if (document.fullscreenElement !== graphEl) {
        graphEl.classList.remove('production-graph--fullscreen');
      } else {
        graphEl.classList.add('production-graph--fullscreen');
      }
      syncFullscreenButton(graphEl);
      onChange?.();
    };

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (!graphEl.classList.contains('production-graph--fullscreen')) return;
      if (document.fullscreenElement === graphEl) return;
      graphEl.classList.remove('production-graph--fullscreen');
      syncFullscreenButton(graphEl);
      onChange?.();
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('keydown', onKeyDown);
    syncFullscreenButton(graphEl);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('keydown', onKeyDown);
      graphEl.classList.remove('production-graph--fullscreen');
    };
  }

  function waitNextFrames(count = 2) {
    return new Promise((resolve) => {
      let left = Math.max(1, count);
      const tick = () => {
        left -= 1;
        if (left <= 0) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  function resolveGraphBackgroundColor() {
    const root = document.documentElement;
    const fromVar = getComputedStyle(root).getPropertyValue('--bg-main').trim();
    if (fromVar) return fromVar;
    return '#0f1419';
  }

  /**
   * html-to-image often drops CSS `stroke` on <path> elements. Bake solid
   * colors + width as SVG presentation attributes for a reliable PNG.
   */
  function applyInlineEdgeStrokesForExport(stage) {
    const svg = stage?.querySelector('.production-graph-edges');
    if (!svg) return () => {};

    const strokeByKind = {
      'step-link': '#ffb347',
      'group-link': '#ffb347',
      'extraction-link': '#5ad48a',
      'objective-link': '#c5d4e4',
      'power-link': '#7ec8ff',
      default: '#ffb347',
    };

    const touched = [];
    for (const path of svg.querySelectorAll('path.production-graph-edge')) {
      const kindClass = [...path.classList].find((c) => c.startsWith('production-graph-edge--'));
      const kind = kindClass ? kindClass.replace('production-graph-edge--', '') : 'default';
      const stroke = strokeByKind[kind] || strokeByKind.default;
      touched.push({
        path,
        stroke: path.getAttribute('stroke'),
        strokeWidth: path.getAttribute('stroke-width'),
        fill: path.getAttribute('fill'),
        opacity: path.getAttribute('opacity'),
        strokeLinecap: path.getAttribute('stroke-linecap'),
        strokeLinejoin: path.getAttribute('stroke-linejoin'),
      });
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', stroke);
      path.setAttribute('stroke-width', '5');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('opacity', '1');
      path.style.stroke = stroke;
      path.style.strokeWidth = '5px';
      path.style.fill = 'none';
      path.style.opacity = '1';
    }

    return () => {
      for (const entry of touched) {
        const { path } = entry;
        const restoreAttr = (name, value) => {
          if (value == null) path.removeAttribute(name);
          else path.setAttribute(name, value);
        };
        restoreAttr('stroke', entry.stroke);
        restoreAttr('stroke-width', entry.strokeWidth);
        restoreAttr('fill', entry.fill);
        restoreAttr('opacity', entry.opacity);
        restoreAttr('stroke-linecap', entry.strokeLinecap);
        restoreAttr('stroke-linejoin', entry.strokeLinejoin);
        path.style.stroke = '';
        path.style.strokeWidth = '';
        path.style.fill = '';
        path.style.opacity = '';
      }
    };
  }

  function sanitizePngFileName(name) {
    const cleaned = String(name ?? 'factory-tree')
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
      .replace(/\s+/g, ' ')
      .replace(/[. ]+$/g, '')
      .slice(0, 120);
    return cleaned || 'factory-tree';
  }

  async function exportGraphStageAsPng({ stage, camera, graphEl, defaultName, button }) {
    const toPng = window.htmlToImage?.toPng;
    if (typeof toPng !== 'function') {
      throw new Error(t('graph.exportPngUnavailable'));
    }
    if (typeof window.satisfactory?.savePngFile !== 'function') {
      throw new Error(t('graph.exportPngUnavailable'));
    }

    if (button) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    }

    const snapshot = camera?.snapshot?.();
    camera?.prepareForExport?.();
    graphEl?.classList.add('production-graph--exporting');
    const restoreEdgeStrokes = applyInlineEdgeStrokesForExport(stage);
    await waitNextFrames(2);

    try {
      const width = Math.max(1, stage.scrollWidth || stage.offsetWidth || 1);
      const height = Math.max(1, stage.scrollHeight || stage.offsetHeight || 1);
      const maxSide = 4096;
      const pixelRatio = Math.min(2, maxSide / Math.max(width, height));

      const dataUrl = await toPng(stage, {
        backgroundColor: resolveGraphBackgroundColor(),
        pixelRatio: Math.max(0.5, pixelRatio),
        width,
        height,
        cacheBust: true,
        // Skip interactive chrome that isn't part of the tree picture
        filter: (node) => {
          if (!(node instanceof Element)) return true;
          return !node.classList?.contains('production-graph-step-mark-btn');
        },
      });

      return await window.satisfactory.savePngFile(sanitizePngFileName(defaultName), dataUrl);
    } finally {
      restoreEdgeStrokes();
      graphEl?.classList.remove('production-graph--exporting');
      camera?.restore?.(snapshot);
      if (button) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    }
  }

  function bindGraphZoomButtons(root, camera, graphEl, exportContext = null) {
    root?.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-graph-zoom]');
      if (!btn || btn.disabled) return;
      const action = btn.getAttribute('data-graph-zoom');
      if (action === 'fullscreen') {
        toggleGraphFullscreen(graphEl).then(() => {
          requestAnimationFrame(() => camera?.fit?.());
        });
        return;
      }
      if (action === 'export') {
        const stage = exportContext?.stage;
        if (!stage || !camera) return;
        exportGraphStageAsPng({
          stage,
          camera,
          graphEl,
          defaultName: exportContext?.defaultName || 'factory-tree',
          button: btn,
        }).catch(async (err) => {
          console.error('Graph PNG export error:', err);
          if (typeof window.showAlert === 'function') {
            await window.showAlert({
              title: t('graph.exportPngErrorTitle'),
              message: err?.message || t('graph.exportPngError'),
            });
          }
        });
        return;
      }
      if (!camera) return;
      if (action === 'in') camera.zoomBy(1.15);
      else if (action === 'out') camera.zoomBy(1 / 1.15);
      else if (action === 'reset') camera.reset();
      else if (action === 'fit') camera.fit();
    });
  }

  function renderProductionGraph(container, detail, helpers, options = {}) {
    const groupKey = options.groupKey ?? null;
    const groupLabel = options.groupLabel ?? null;
    const collapseGroups = Boolean(options.collapseGroups);
    const layoutOptions = {
      groupKey: collapseGroups ? null : groupKey,
      collapseGroups,
      detailMode: helpers.treeDetailMode === 'complex' ? 'complex' : 'simple',
    };
    const graph = collapseGroups
      ? buildCollapsedGroupGraph(detail, helpers)
      : buildProductionGraph(detail, helpers, { groupKey });

    if (!graph.nodes.length) {
      const emptyMessage = collapseGroups
        ? t('graph.emptyGroups')
        : groupKey
          ? t('graph.emptyGroup', { name: groupLabel || groupKey })
          : t('graph.emptyTree');
      container.innerHTML = `<p class="detail-empty production-graph-empty">${helpers.escapeHtml(emptyMessage)}</p>`;
      return null;
    }

    graph.edges.forEach((edge, index) => {
      edge.id = edge.id ?? `edge-${index}`;
    });

    const chainId = helpers.chainId;
    const savedLayout = loadSavedLayout(chainId, layoutOptions);
    const layerCount = Math.max(...graph.nodes.map((node) => node.layer), 0) + 1;

    const hintText = collapseGroups
      ? t('graph.hintGroups')
      : groupLabel
        ? t('graph.hintGroup', { name: groupLabel })
        : t('graph.hint');

    const detailMode = helpers.treeDetailMode === 'complex' ? 'complex' : 'simple';

    container.innerHTML = `
      <div class="production-graph${groupKey ? ' production-graph--group' : ''}${
        collapseGroups ? ' production-graph--groups' : ''
      }" data-detail-mode="${detailMode}">
        <div class="production-graph-toolbar">
          <p class="production-graph-hint">${helpers.escapeHtml(hintText)}</p>
          <div class="production-graph-toolbar-actions">
            ${renderGraphZoomControls(helpers.escapeHtml)}
            <div class="production-graph-detail-toggle" role="group" aria-label="${helpers.escapeHtml(
              t('graph.detailModeAria')
            )}">
              <button
                type="button"
                class="production-graph-detail-btn${detailMode === 'simple' ? ' is-active' : ''}"
                data-tree-detail-mode="simple"
                title="${helpers.escapeHtml(t('graph.detailSimpleTitle'))}"
                aria-pressed="${detailMode === 'simple' ? 'true' : 'false'}"
              >${helpers.escapeHtml(t('graph.detailSimple'))}</button>
              <button
                type="button"
                class="production-graph-detail-btn${detailMode === 'complex' ? ' is-active' : ''}"
                data-tree-detail-mode="complex"
                title="${helpers.escapeHtml(t('graph.detailComplexTitle'))}"
                aria-pressed="${detailMode === 'complex' ? 'true' : 'false'}"
              >${helpers.escapeHtml(t('graph.detailComplex'))}</button>
            </div>
            <div class="production-graph-detail-toggle" role="group" aria-label="${helpers.escapeHtml(
              t('graph.edgeTransportAria')
            )}">
              ${renderEdgeTransportToggle(helpers.escapeHtml, helpers.showEdgeTransport)}
            </div>
          </div>
        </div>
        <div class="production-graph-scroll">
          <div class="production-graph-pan">
            <div class="production-graph-world">
              <div class="production-graph-stage">
                <svg class="production-graph-edges" aria-hidden="true"></svg>
                <div class="production-graph-nodes"></div>
                <div class="production-graph-edge-labels"></div>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    const scrollEl = container.querySelector('.production-graph-scroll');
    const panEl = container.querySelector('.production-graph-pan');
    const worldEl = container.querySelector('.production-graph-world');
    const stage = container.querySelector('.production-graph-stage');
    const svg = container.querySelector('.production-graph-edges');
    const nodesHost = container.querySelector('.production-graph-nodes');
    const labelsHost = container.querySelector('.production-graph-edge-labels');
    const toolbar = container.querySelector('.production-graph-toolbar');
    const zoomLabelEl = container.querySelector('[data-graph-zoom="reset"]');
    const graphEl = container.querySelector('.production-graph');

    toolbar?.addEventListener('click', (event) => {
      const transportBtn = event.target.closest('[data-tree-edge-transport]');
      if (transportBtn) {
        const next = transportBtn.getAttribute('data-tree-edge-transport') === '1';
        if (next === getProductionTreeEdgeTransport()) return;
        setProductionTreeEdgeTransport(next);
        helpers.showEdgeTransport = next;
        labelsHost.innerHTML = graph.edges
          .map((edge) => renderEdgeLabel(edge, helpers))
          .join('');
        drawEdges(stage, svg, labelsHost, graph.edges);
        transportBtn.classList.toggle('is-active', next);
        transportBtn.setAttribute('aria-pressed', next ? 'true' : 'false');
        transportBtn.setAttribute('data-tree-edge-transport', next ? '0' : '1');
        transportBtn.title = next
          ? t('graph.edgeTransportHideTitle')
          : t('graph.edgeTransportShowTitle');
        return;
      }
      const btn = event.target.closest('[data-tree-detail-mode]');
      if (!btn) return;
      const next = btn.getAttribute('data-tree-detail-mode');
      if (!next || next === getProductionTreeDetailMode()) return;
      setProductionTreeDetailMode(next);
      if (activeProductionDetail) {
        renderProductionDetailContent(activeProductionDetail);
      }
    });

    const camera = setupGraphCamera(scrollEl, panEl, worldEl, stage, nodesHost, zoomLabelEl);
    bindGraphZoomButtons(toolbar, camera, graphEl, {
      stage,
      defaultName: helpers.chainName || 'factory-tree',
    });

    const layoutGraph = () => {
      const availableWidth = scrollEl.clientWidth || container.clientWidth || 960;
      const layerGap = computeLayerGap(layerCount, availableWidth);
      const positions = computeAutoLayout(graph.nodes, graph.edges, savedLayout, layerGap, helpers);
      const hasSavedPositions = graph.nodes.some(
        (node) => resolveSavedNodePosition(node.id, savedLayout) != null
      );

      nodesHost.innerHTML = graph.nodes
        .map((node) => renderNode(node, helpers, positions[node.id]))
        .join('');

      // Only pack columns on a fresh auto-layout. Reflow would overwrite
      // user drag positions (saved Y) every time the tree is rebuilt.
      if (!hasSavedPositions) {
        reflowLayerPositions(nodesHost);
      }
      updateStageSize(stage, nodesHost, scrollEl);
      drawEdges(stage, svg, labelsHost, graph.edges);
      camera.fit();
    };

    const onResize = () => {
      updateStageSize(stage, nodesHost, scrollEl);
      drawEdges(stage, svg, labelsHost, graph.edges);
    };

    labelsHost.innerHTML = graph.edges.map((edge) => renderEdgeLabel(edge, helpers)).join('');

    layoutGraph();

    setupNodeDragging(
      stage,
      nodesHost,
      chainId,
      scrollEl,
      () => {
        updateStageSize(stage, nodesHost, scrollEl);
        drawEdges(stage, svg, labelsHost, graph.edges);
      },
      layoutOptions,
      camera.getScale,
      camera
    );

    const teardownFullscreen = setupGraphFullscreen(graphEl, () => {
      onResize();
      requestAnimationFrame(() => camera.fit());
    });

    const observer = new ResizeObserver(() => {
      if (!nodesHost.querySelector('.production-graph-node')) return;
      onResize();
    });
    observer.observe(scrollEl);

    const syncTransportToggleButton = () => {
      const btn = toolbar?.querySelector('[data-tree-edge-transport]');
      if (!btn) return;
      const on = Boolean(helpers.showEdgeTransport);
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('data-tree-edge-transport', on ? '0' : '1');
      btn.title = on ? t('graph.edgeTransportHideTitle') : t('graph.edgeTransportShowTitle');
    };

    return {
      disconnect: () => {
        observer.disconnect();
        camera.destroy();
        teardownFullscreen();
      },
      redraw: () => drawEdges(stage, svg, labelsHost, graph.edges),
      setShowEdgeTransport: (enabled) => {
        helpers.showEdgeTransport = Boolean(enabled);
        labelsHost.innerHTML = graph.edges.map((edge) => renderEdgeLabel(edge, helpers)).join('');
        drawEdges(stage, svg, labelsHost, graph.edges);
        syncTransportToggleButton();
      },
    };
  }

  function buildEnergyGraph(detail, helpers) {
    const extractions = detail.extractions ?? [];
    const generators = detail.generators ?? [];
    const nodes = [];
    const edges = [];
    const edgeKeys = new Set();
    const round = (value) => helpers.roundProduction?.(value) ?? value;

    const addEdge = (edge) => {
      const key = `${edge.from}|${edge.to}|${edge.itemSlug}|${edge.rate}|${edge.kind}`;
      if (edgeKeys.has(key)) return;
      edgeKeys.add(key);
      edges.push(edge);
    };

    for (const generator of generators) {
      nodes.push({
        id: `gen-${generator.id}`,
        type: 'generator',
        layer: null,
        data: generator,
      });

      for (const [itemSlug, links] of Object.entries(generator.input_links ?? {})) {
        for (const link of links) {
          const extraction = extractions.find(
            (candidate) => candidate.id === link.producer_extraction_id
          );
          if (!extraction) continue;
          const rate = round(link.producer_rate ?? extraction.output_rate ?? 0);
          if (!(rate > 0)) continue;
          const isFluid =
            itemSlug === 'water' ||
            Boolean(extraction.item?.is_fluid) ||
            extraction.extraction_kind === 'water';
          addEdge({
            from: `ext-${extraction.id}`,
            to: `gen-${generator.id}`,
            itemSlug,
            itemName: extraction.item?.name ?? link.producer_name ?? itemSlug,
            itemImage: extraction.item?.image ?? null,
            isFluid,
            rate,
            kind: 'extraction-link',
          });
        }
      }

      for (const [itemSlug, links] of Object.entries(generator.production_input_links ?? {})) {
        for (const link of links) {
          const rate = round(link.producer_rate ?? 0);
          if (!(rate > 0)) continue;
          const supplyId = `supply-${link.producer_production_step_id}-${itemSlug}`;
          if (!nodes.some((node) => node.id === supplyId)) {
            const isFluid = Boolean(
              generator.fuel_item_slug === itemSlug &&
                (generator.fuel_is_fluid || generator.fuel_item?.is_fluid)
            );
            nodes.push({
              id: supplyId,
              type: 'supply',
              layer: 0,
              data: {
                item_slug: itemSlug,
                item_name:
                  generator.fuel_item_slug === itemSlug
                    ? generator.fuel_item?.name || generator.fuel_label || itemSlug
                    : itemSlug,
                item_image:
                  generator.fuel_item_slug === itemSlug ? generator.fuel_item?.image ?? null : null,
                is_fluid: isFluid,
                rate,
                producer_step_name: link.producer_step_name,
                producer_chain_name: link.producer_chain_name,
                producer_production_step_id: link.producer_production_step_id,
              },
            });
          }
          addEdge({
            from: supplyId,
            to: `gen-${generator.id}`,
            itemSlug,
            itemName:
              generator.fuel_item_slug === itemSlug
                ? generator.fuel_item?.name || generator.fuel_label || itemSlug
                : itemSlug,
            itemImage:
              generator.fuel_item_slug === itemSlug ? generator.fuel_item?.image ?? null : null,
            isFluid: Boolean(
              generator.fuel_item_slug === itemSlug &&
                (generator.fuel_is_fluid || generator.fuel_item?.is_fluid)
            ),
            rate,
            kind: 'supply-link',
          });
        }
      }
    }

    for (const extraction of extractions) {
      nodes.unshift({
        id: `ext-${extraction.id}`,
        type: 'extraction',
        layer: 0,
        data: extraction,
      });
    }

    const totalPower = round(
      generators.reduce((sum, generator) => sum + (Number(generator.power_output_mw) || 0), 0)
    );
    if (generators.length) {
      nodes.push({
        id: 'obj-power',
        type: 'objective',
        layer: null,
        data: {
          item_slug: 'power',
          item_name: t('energy.totalPower'),
          item_image: null,
          rate: totalPower,
          unit: 'MW',
        },
      });
      for (const generator of generators) {
        const mw = round(Number(generator.power_output_mw) || 0);
        if (!(mw > 0)) continue;
        addEdge({
          from: `gen-${generator.id}`,
          to: 'obj-power',
          itemSlug: 'power',
          itemName: t('energy.totalPower'),
          itemImage: null,
          isFluid: false,
          unit: 'MW',
          rate: mw,
          kind: 'power-link',
        });
      }
    }

    assignLayers(nodes, edges);
    compactLayers(nodes);
    return { nodes, edges };
  }

  function renderEnergyGraph(container, detail, helpers, options = {}) {
    const graph = buildEnergyGraph(detail, helpers);

    if (!graph.nodes.length) {
      container.innerHTML = `<p class="detail-empty production-graph-empty">${helpers.escapeHtml(
        t('graph.emptyEnergyTree')
      )}</p>`;
      return null;
    }

    graph.edges.forEach((edge, index) => {
      edge.id = edge.id ?? `edge-${index}`;
    });

    const chainId = helpers.chainId;
    const detailMode = helpers.treeDetailMode === 'complex' ? 'complex' : 'simple';
    const layoutOptions = { detailMode };
    const savedLayout = loadSavedLayout(chainId, layoutOptions);
    const layerCount = Math.max(...graph.nodes.map((node) => node.layer), 0) + 1;

    container.innerHTML = `
      <div class="production-graph" data-detail-mode="${detailMode}">
        <div class="production-graph-toolbar">
          <p class="production-graph-hint">${helpers.escapeHtml(t('graph.hint'))}</p>
          <div class="production-graph-toolbar-actions">
            ${renderGraphZoomControls(helpers.escapeHtml)}
            <div class="production-graph-detail-toggle" role="group" aria-label="${helpers.escapeHtml(
              t('graph.detailModeAria')
            )}">
              <button
                type="button"
                class="production-graph-detail-btn${detailMode === 'simple' ? ' is-active' : ''}"
                data-tree-detail-mode="simple"
                title="${helpers.escapeHtml(t('graph.detailSimpleTitle'))}"
                aria-pressed="${detailMode === 'simple' ? 'true' : 'false'}"
              >${helpers.escapeHtml(t('graph.detailSimple'))}</button>
              <button
                type="button"
                class="production-graph-detail-btn${detailMode === 'complex' ? ' is-active' : ''}"
                data-tree-detail-mode="complex"
                title="${helpers.escapeHtml(t('graph.detailComplexTitle'))}"
                aria-pressed="${detailMode === 'complex' ? 'true' : 'false'}"
              >${helpers.escapeHtml(t('graph.detailComplex'))}</button>
            </div>
            <div class="production-graph-detail-toggle" role="group" aria-label="${helpers.escapeHtml(
              t('graph.edgeTransportAria')
            )}">
              ${renderEdgeTransportToggle(helpers.escapeHtml, helpers.showEdgeTransport)}
            </div>
          </div>
        </div>
        <div class="production-graph-scroll">
          <div class="production-graph-pan">
            <div class="production-graph-world">
              <div class="production-graph-stage">
                <svg class="production-graph-edges" aria-hidden="true"></svg>
                <div class="production-graph-nodes"></div>
                <div class="production-graph-edge-labels"></div>
              </div>
            </div>
          </div>
        </div>
      </div>`;

    const scrollEl = container.querySelector('.production-graph-scroll');
    const panEl = container.querySelector('.production-graph-pan');
    const worldEl = container.querySelector('.production-graph-world');
    const stage = container.querySelector('.production-graph-stage');
    const svg = container.querySelector('.production-graph-edges');
    const nodesHost = container.querySelector('.production-graph-nodes');
    const labelsHost = container.querySelector('.production-graph-edge-labels');
    const toolbar = container.querySelector('.production-graph-toolbar');
    const zoomLabelEl = container.querySelector('[data-graph-zoom="reset"]');
    const graphEl = container.querySelector('.production-graph');

    toolbar?.addEventListener('click', (event) => {
      const transportBtn = event.target.closest('[data-tree-edge-transport]');
      if (transportBtn) {
        const next = transportBtn.getAttribute('data-tree-edge-transport') === '1';
        if (next === getProductionTreeEdgeTransport()) return;
        setProductionTreeEdgeTransport(next);
        helpers.showEdgeTransport = next;
        labelsHost.innerHTML = graph.edges
          .map((edge) => renderEdgeLabel(edge, helpers))
          .join('');
        drawEdges(stage, svg, labelsHost, graph.edges);
        transportBtn.classList.toggle('is-active', next);
        transportBtn.setAttribute('aria-pressed', next ? 'true' : 'false');
        transportBtn.setAttribute('data-tree-edge-transport', next ? '0' : '1');
        transportBtn.title = next
          ? t('graph.edgeTransportHideTitle')
          : t('graph.edgeTransportShowTitle');
        return;
      }
      const btn = event.target.closest('[data-tree-detail-mode]');
      if (!btn) return;
      const next = btn.getAttribute('data-tree-detail-mode');
      if (!next || next === getProductionTreeDetailMode()) return;
      setProductionTreeDetailMode(next);
      if (typeof options.onDetailModeChange === 'function') {
        options.onDetailModeChange(next);
      }
    });

    const camera = setupGraphCamera(scrollEl, panEl, worldEl, stage, nodesHost, zoomLabelEl);
    bindGraphZoomButtons(toolbar, camera, graphEl, {
      stage,
      defaultName: helpers.chainName || 'factory-tree',
    });

    const layoutGraph = () => {
      const availableWidth = scrollEl.clientWidth || container.clientWidth || 960;
      const layerGap = computeLayerGap(layerCount, availableWidth);
      const positions = computeAutoLayout(graph.nodes, graph.edges, savedLayout, layerGap, helpers);
      const hasSavedPositions = graph.nodes.some(
        (node) => resolveSavedNodePosition(node.id, savedLayout) != null
      );

      nodesHost.innerHTML = graph.nodes
        .map((node) => renderNode(node, helpers, positions[node.id]))
        .join('');

      if (!hasSavedPositions) {
        reflowLayerPositions(nodesHost);
      }
      updateStageSize(stage, nodesHost, scrollEl);
      drawEdges(stage, svg, labelsHost, graph.edges);
      camera.fit();
    };

    const onResize = () => {
      updateStageSize(stage, nodesHost, scrollEl);
      drawEdges(stage, svg, labelsHost, graph.edges);
    };

    labelsHost.innerHTML = graph.edges.map((edge) => renderEdgeLabel(edge, helpers)).join('');

    layoutGraph();

    setupNodeDragging(
      stage,
      nodesHost,
      chainId,
      scrollEl,
      () => {
        updateStageSize(stage, nodesHost, scrollEl);
        drawEdges(stage, svg, labelsHost, graph.edges);
      },
      layoutOptions,
      camera.getScale,
      camera
    );

    const teardownFullscreen = setupGraphFullscreen(graphEl, () => {
      onResize();
      requestAnimationFrame(() => camera.fit());
    });

    const observer = new ResizeObserver(() => {
      if (!nodesHost.querySelector('.production-graph-node')) return;
      onResize();
    });
    observer.observe(scrollEl);

    return {
      disconnect: () => {
        observer.disconnect();
        camera.destroy();
        teardownFullscreen();
      },
      redraw: () => drawEdges(stage, svg, labelsHost, graph.edges),
      setShowEdgeTransport: (enabled) => {
        helpers.showEdgeTransport = Boolean(enabled);
        labelsHost.innerHTML = graph.edges.map((edge) => renderEdgeLabel(edge, helpers)).join('');
        drawEdges(stage, svg, labelsHost, graph.edges);
      },
    };
  }

  window.ProductionGraph = {
    buildProductionGraph,
    buildCollapsedGroupGraph,
    buildEnergyGraph,
    renderProductionGraph,
    renderEnergyGraph,
  };
})();
