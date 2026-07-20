/**
 * Visualizzazione ad albero della catena di produzione (sinistra → destra).
 * Layout libero con posizionamento assoluto e drag & drop.
 */
(function () {
  const t = (key, vars) => window.t(key, vars);

  const NODE_WIDTH = 228;
  const MIN_LAYER_GAP_X = 48;
  const MAX_LAYER_GAP_X = 220;
  const NODE_GAP_Y = 40;
  const PADDING = 32;
  const LAYOUT_STORAGE_PREFIX = 'satisfactory-graph-layout-';

  function buildProductionGraph(detail, helpers, options = {}) {
    const allSteps = detail.steps ?? [];
    const extractions = detail.extractions ?? [];
    const groupKey = options.groupKey ?? null;
    const visibleSteps = groupKey
      ? allSteps.filter((step) => helpers.getProductionGroupKey(step.group_name) === groupKey)
      : allSteps;
    const visibleStepIds = new Set(visibleSteps.map((step) => step.id));

    if (groupKey && !visibleSteps.length) {
      return { nodes: [], edges: [] };
    }

    const nodes = [];
    const edges = [];
    const edgeKeys = new Set();

    const addEdge = (edge) => {
      const key = `${edge.from}|${edge.to}|${edge.itemSlug}|${edge.rate}`;
      if (edgeKeys.has(key)) return;
      edgeKeys.add(key);
      edges.push(edge);
    };

    for (const step of visibleSteps) {
      nodes.push({
        id: `step-${step.id}`,
        type: 'step',
        layer: null,
        data: step,
      });
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
      for (const [itemSlug, links] of Object.entries(step.input_links ?? {})) {
        for (const link of links) {
          const producer = allSteps.find((candidate) => candidate.id === link.producer_step_id);
          if (!producer || !visibleStepIds.has(producer.id)) continue;

          const io = (step.scaled_inputs ?? []).find((input) => input.item_slug === itemSlug);
          const rate = helpers.getProducerAttributedDemand(producer, step, itemSlug, allSteps);
          if (!rate) continue;

          addEdge({
            from: `step-${producer.id}`,
            to: `step-${step.id}`,
            itemSlug,
            itemName: io?.item_name ?? itemSlug,
            itemImage: io?.item_image ?? null,
            isFluid: Boolean(io?.is_fluid),
            rate,
            kind: 'step-link',
          });
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

            addEdge({
              from: `ext-${extraction.id}`,
              to: `step-${step.id}`,
              itemSlug: io.item_slug,
              itemName: io.item_name ?? io.item_slug,
              itemImage: io.item_image ?? null,
              isFluid: Boolean(io.is_fluid),
              rate,
              kind: 'extraction-link',
            });
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

          addEdge({
            from: `ext-${extraction.id}`,
            to: `step-${step.id}`,
            itemSlug: io.item_slug,
            itemName: io.item_name ?? io.item_slug,
            itemImage: io.item_image ?? null,
            isFluid: Boolean(io.is_fluid),
            rate,
            kind: 'extraction-link',
          });
        }
      }
    }

    for (const objective of objectives) {
      addEdge({
        from: `step-${objective.step_id}`,
        to: `obj-${objective.step_id}-${objective.item_slug}`,
        itemSlug: objective.item_slug,
        itemName: objective.item_name,
        itemImage: objective.item_image,
        isFluid: Boolean(objective.is_fluid),
        rate: objective.rate,
        kind: 'objective-link',
      });
    }

    const usedExtractionIds = new Set(
      edges
        .filter((edge) => edge.from.startsWith('ext-'))
        .map((edge) => Number(edge.from.replace('ext-', '')))
    );
    for (const extraction of extractions) {
      if (groupKey && !usedExtractionIds.has(extraction.id)) continue;
      nodes.unshift({
        id: `ext-${extraction.id}`,
        type: 'extraction',
        layer: 0,
        data: extraction,
      });
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
      if (!nodeId.startsWith('step-')) return null;
      const stepId = Number(nodeId.slice(5));
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
      if (node.type !== 'step' && node.type !== 'group') continue;
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

      if (a.type === 'group' && b.type === 'group') {
        return String(a.data.name ?? '').localeCompare(String(b.data.name ?? ''), 'it');
      }

      const order = { extraction: 0, group: 1, step: 1, objective: 2 };
      return (order[a.type] ?? 1) - (order[b.type] ?? 1);
    });
  }

  function getLayoutStorageKey(chainId, options = {}) {
    if (!chainId) return null;
    if (options.collapseGroups) return `${LAYOUT_STORAGE_PREFIX}${chainId}::groups`;
    if (options.groupKey) return `${LAYOUT_STORAGE_PREFIX}${chainId}::group::${options.groupKey}`;
    return `${LAYOUT_STORAGE_PREFIX}${chainId}`;
  }

  function loadSavedLayout(chainId, options = {}) {
    const storageKey = getLayoutStorageKey(chainId, options);
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
    return Math.max(MIN_LAYER_GAP_X, Math.min(MAX_LAYER_GAP_X, gap));
  }

  function fitLayoutToWidth(positions, availableWidth) {
    let maxX = PADDING;
    for (const pos of Object.values(positions)) {
      maxX = Math.max(maxX, pos.x + NODE_WIDTH);
    }

    const limit = Math.max(320, availableWidth - PADDING);
    if (maxX <= limit) return positions;

    const scale = limit / maxX;
    const fitted = {};
    for (const [id, pos] of Object.entries(positions)) {
      fitted[id] = {
        x: Math.round(pos.x * scale),
        y: pos.y,
      };
    }
    return fitted;
  }

  function estimateNodeHeight(node, helpers) {
    const base = 78;
    if (node.type === 'extraction' || node.type === 'objective') return base + 22;

    if (node.type === 'group') {
      const inputCount = node.data.inputs?.length ?? 0;
      const outputCount = node.data.outputs?.length ?? 0;
      let height = base + 18;
      if (inputCount) height += 16 + inputCount * 22;
      if (outputCount) height += 16 + outputCount * 22;
      return height;
    }

    const step = node.data;
    const inputCount = (step.scaled_inputs ?? []).filter(
      (io) => helpers.getStepInputRateForItem(step, io.item_slug) > 0
    ).length;
    const outputCount = (step.scaled_outputs ?? []).filter(
      (io) => helpers.getStepOutputRateForItem(step, io.item_slug) > 0
    ).length;

    let height = base;
    if (inputCount) height += 16 + inputCount * 22;
    if (outputCount) height += 16 + outputCount * 22;
    return height;
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

        const saved = savedLayout[node.id];
        if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
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
    const unit = io.is_fluid ? 'm³/min' : '/min';
    return `
      <div class="production-graph-node-io-row">
        ${renderNodeIcon(io.item_image, 'production-graph-node-io-icon', helpers)}
        <span class="production-graph-node-io-name">${helpers.escapeHtml(io.item_name || io.item_slug)}</span>
        <span class="production-graph-node-io-rate">${helpers.formatRateWithUnit(rate, unit)}</span>
      </div>`;
  }

  function renderStepIoSections(step, helpers) {
    const inputs = (step.scaled_inputs ?? [])
      .map((io) => ({
        io,
        rate: helpers.getStepInputRateForItem(step, io.item_slug),
      }))
      .filter(({ rate }) => rate > 0);

    const outputs = (step.scaled_outputs ?? [])
      .map((io) => ({
        io,
        rate: helpers.getStepOutputRateForItem(step, io.item_slug),
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
    const displayName = helpers.getExtractionDisplayName(extraction, helpers.extractions);
    const item = extraction.item;
    const rate = helpers.getExtractionOutputRate(extraction);

    return `
      <div class="production-graph-node production-graph-node--extraction" data-node-id="${node.id}" role="button" tabindex="0" aria-grabbed="false">
        <div class="production-graph-node-icons">
          ${renderNodeIcon(item?.image, 'production-graph-item-icon', helpers)}
          ${renderNodeIcon(extraction.building_image, 'production-graph-building-icon', helpers)}
        </div>
        <div class="production-graph-node-body">
          <span class="production-graph-node-type">${escapeHtml(t('graph.extraction'))}</span>
          <strong class="production-graph-node-title">${helpers.escapeHtml(displayName)}</strong>
          <div class="production-graph-node-io">
            <span class="production-graph-node-io-label">${escapeHtml(t('common.output'))}</span>
            ${renderIoRow({ item_image: item?.image, item_name: item?.name || displayName, item_slug: item?.slug, is_fluid: item?.is_fluid }, rate, helpers)}
          </div>
        </div>
      </div>`;
  }

  function renderStepNode(node, helpers) {
    const step = node.data;
    const item = step.item;
    const schema = step.schema;
    const isMarked = Number(step.marked) === 1;

    return `
      <div class="production-graph-node production-graph-node--step${isMarked ? ' production-graph-node--marked' : ''}" data-node-id="${node.id}" role="button" tabindex="0" aria-grabbed="false">
        <label
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
        </label>
        <div class="production-graph-node-icons">
          ${renderNodeIcon(item?.image, 'production-graph-item-icon', helpers)}
          ${renderNodeIcon(schema?.building_image, 'production-graph-building-icon', helpers)}
        </div>
        <div class="production-graph-node-body">
          <span class="production-graph-node-type">${helpers.escapeHtml(schema?.building_name || t('common.schema'))}</span>
          <strong class="production-graph-node-title">${helpers.escapeHtml(step.name)}</strong>
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

  function renderNode(node, helpers, position) {
    const html =
      node.type === 'extraction'
        ? renderExtractionNode(node, helpers)
        : node.type === 'objective'
          ? renderObjectiveNode(node, helpers)
          : node.type === 'group'
            ? renderGroupNode(node, helpers)
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

    return `
      <div
        class="production-graph-edge-label production-graph-edge-label--${edge.kind}"
        data-edge-id="${helpers.escapeHtml(edge.id)}"
      >
        ${img}
        <span class="production-graph-edge-name">${helpers.escapeHtml(edge.itemName)}</span>
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

    const widthLimit = scrollEl?.clientWidth;
    stage.style.width = widthLimit ? `${Math.min(maxX, widthLimit)}px` : `${maxX}px`;
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

  function setupNodeDragging(stage, nodesHost, chainId, scrollEl, onChange, layoutOptions = {}) {
    let dragState = null;

    const maxNodeX = (node) =>
      Math.max(PADDING, (scrollEl?.clientWidth ?? stage.offsetWidth) - node.offsetWidth - PADDING);

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

      const x = dragState.startLeft + (e.clientX - dragState.originClientX);
      const y = dragState.startTop + (e.clientY - dragState.originClientY);

      dragState.node.style.left = `${Math.min(maxNodeX(dragState.node), Math.max(0, x))}px`;
      dragState.node.style.top = `${Math.max(0, y)}px`;
      onChange();
    });

    nodesHost.addEventListener('pointerup', finishDrag);
    nodesHost.addEventListener('pointercancel', finishDrag);
  }

  function renderProductionGraph(container, detail, helpers, options = {}) {
    const groupKey = options.groupKey ?? null;
    const groupLabel = options.groupLabel ?? null;
    const collapseGroups = Boolean(options.collapseGroups);
    const layoutOptions = { groupKey: collapseGroups ? null : groupKey, collapseGroups };
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

    const hintLead = collapseGroups
      ? 'Albero per gruppi: solo input/output principali tra raggruppamenti. '
      : groupLabel
        ? `Raggruppamento «${groupLabel}». `
        : '';
    const hintText = `${hintLead}Trascina i box per sistemare il layout. Le posizioni vengono ricordate automaticamente per questo progetto${
      collapseGroups ? ' (vista gruppi)' : groupLabel ? ' e raggruppamento' : ''
    }.`;

    container.innerHTML = `
      <div class="production-graph${groupKey ? ' production-graph--group' : ''}${
        collapseGroups ? ' production-graph--groups' : ''
      }">
        <p class="production-graph-hint">${helpers.escapeHtml(hintText)}</p>
        <div class="production-graph-scroll">
          <div class="production-graph-stage">
            <svg class="production-graph-edges" aria-hidden="true"></svg>
            <div class="production-graph-nodes"></div>
            <div class="production-graph-edge-labels"></div>
          </div>
        </div>
      </div>`;

    const scrollEl = container.querySelector('.production-graph-scroll');
    const stage = container.querySelector('.production-graph-stage');
    const svg = container.querySelector('.production-graph-edges');
    const nodesHost = container.querySelector('.production-graph-nodes');
    const labelsHost = container.querySelector('.production-graph-edge-labels');

    const layoutGraph = () => {
      const availableWidth = scrollEl.clientWidth || container.clientWidth || 960;
      const layerGap = computeLayerGap(layerCount, availableWidth);
      let positions = computeAutoLayout(graph.nodes, graph.edges, savedLayout, layerGap, helpers);
      positions = fitLayoutToWidth(positions, availableWidth);

      nodesHost.innerHTML = graph.nodes
        .map((node) => renderNode(node, helpers, positions[node.id]))
        .join('');

      updateStageSize(stage, nodesHost, scrollEl);
      drawEdges(stage, svg, labelsHost, graph.edges);
    };

    const fitGraphWidth = () => {
      const availableWidth = scrollEl.clientWidth || container.clientWidth || 960;
      const positions = fitLayoutToWidth(collectPositions(nodesHost), availableWidth);
      for (const node of nodesHost.querySelectorAll('.production-graph-node')) {
        const pos = positions[node.dataset.nodeId];
        if (!pos) continue;
        node.style.left = `${pos.x}px`;
      }
      updateStageSize(stage, nodesHost, scrollEl);
      drawEdges(stage, svg, labelsHost, graph.edges);
    };

    labelsHost.innerHTML = graph.edges.map((edge) => renderEdgeLabel(edge, helpers)).join('');

    layoutGraph();

    setupNodeDragging(stage, nodesHost, chainId, scrollEl, () => {
      updateStageSize(stage, nodesHost, scrollEl);
      drawEdges(stage, svg, labelsHost, graph.edges);
    }, layoutOptions);

    const observer = new ResizeObserver(() => {
      if (!nodesHost.querySelector('.production-graph-node')) return;
      fitGraphWidth();
    });
    observer.observe(scrollEl);

    return { disconnect: () => observer.disconnect(), redraw: () => drawEdges(stage, svg, labelsHost, graph.edges) };
  }

  window.ProductionGraph = {
    buildProductionGraph,
    buildCollapsedGroupGraph,
    renderProductionGraph,
  };
})();
