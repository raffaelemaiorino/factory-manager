function renderProductionChains() {
  const container = document.getElementById('production-container');

  if (!productionChains.length) {
    container.innerHTML = `
      <section class="card production-empty">
        <p class="empty-state">${escapeHtml(t('production.emptyList'))}</p>
        <p class="production-empty-hint">${escapeHtml(t('production.emptyListHint'))}</p>
      </section>`;
    return;
  }

  container.innerHTML = `
    <section class="card">
      <div class="production-list">
        ${productionChains.map(renderProductionChainCard).join('')}
      </div>
    </section>`;
}

function renderProductionChainCard(chain) {
  const detail = productionChainSummaries.get(chain.id);
  const steps = detail?.steps ?? [];
  const extractions = detail?.extractions ?? [];
  const summaryHtml =
    steps.length || extractions.length
      ? renderProductionExternalSummary(steps, extractions)
      : '';

  return `
    <article class="production-card" data-id="${chain.id}">
      <div class="production-card-body" role="button" tabindex="0" data-id="${chain.id}">
        <div class="production-card-info">
          <h3>${escapeHtml(chain.name)}</h3>
          <p class="production-card-meta">${escapeHtml(t('production.cardCreated', { when: formatDateTime(chain.created_at) }))}</p>
        </div>
        ${
          summaryHtml
            ? `<div class="production-card-summary production-external-summary">${summaryHtml}</div>`
            : ''
        }
      </div>
      <div class="production-card-actions">
        <button
          type="button"
          class="production-edit-btn"
          data-id="${chain.id}"
          aria-label="${escapeHtml(t('actions.renameAria', { name: chain.name }))}"
          title="${escapeHtml(t('actions.rename'))}"
        >${EDIT_ICON}</button>
        <button
          type="button"
          class="production-duplicate-btn"
          data-id="${chain.id}"
          aria-label="${escapeHtml(t('production.duplicateAria', { name: chain.name }))}"
          title="${escapeHtml(t('production.duplicate'))}"
        >${DUPLICATE_ICON}</button>
        <button
          type="button"
          class="production-export-btn"
          data-id="${chain.id}"
          aria-label="${escapeHtml(t('actions.exportAria', { name: chain.name }))}"
          title="${escapeHtml(t('actions.exportPlan'))}"
        >${EXPORT_ICON}</button>
        <button
          type="button"
          class="production-delete-btn"
          data-id="${chain.id}"
          aria-label="${escapeHtml(t('actions.deleteAria', { name: chain.name }))}"
        >${DELETE_ICON}</button>
      </div>
    </article>`;
}

async function loadProductionChainSummaries() {
  await ensurePickerResourcesData();

  const summaries = await Promise.all(
    productionChains.map((chain) =>
      window.satisfactory.getProductionChainDetail(chain.id).catch((err) => {
        console.error('Production summary load error:', chain.id, err);
        return null;
      })
    )
  );

  productionChainSummaries = new Map();
  productionChains.forEach((chain, index) => {
    const detail = summaries[index];
    if (detail) productionChainSummaries.set(chain.id, detail);
  });
}

function getOutputSliderMax(step) {
  return window.ProductionScale.computeMaxTargetOutput(
    step.base_per_min,
    step.machine_count,
    step.somersloop_mask ?? 0,
    step.schema
  );
}

function getOutputSliderMin(step) {
  return window.ProductionScale.computeMinTargetOutput(
    step.base_per_min,
    step.machine_count,
    step.somersloop_mask ?? 0,
    step.schema
  );
}

function usesFractionalProductionOutput(step) {
  if (!step) return false;
  const min = getOutputSliderMin(step);
  const max = getOutputSliderMax(step);
  return min < 1 - 0.0005 || max < 1 - 0.0005;
}

function getProductionOutputSliderStep(step) {
  return usesFractionalProductionOutput(step) ? 0.001 : 1;
}

function getMachinesSliderMax(step, currentCount = step.machine_count) {
  const fromValue = Math.round(Number(currentCount) || 1);
  return Math.max(getConfiguredMaxMachines(), fromValue, 1);
}

function getNodesSliderMax(nodeCount = 1, extractionOrKind = null) {
  const fromValue = Math.round(Number(nodeCount) || 1);
  let kind = extractionOrKind;
  if (extractionOrKind && typeof extractionOrKind === 'object') {
    kind = getExtractionKind(extractionOrKind);
  }
  const cap = kind === 'water' ? WATER_NODES_SLIDER_MAX : NODES_SLIDER_MAX;
  return Math.max(cap, fromValue, 1);
}

function getExtractionOutputSliderMax(extraction) {
  if (extraction?.max_target_output != null) {
    return extraction.max_target_output;
  }
  const basePerNode =
    extraction?.base_per_node ??
    window.ExtractionScale.getBaseExtractionPerNode(
      extraction.miner_slug,
      extraction.purity,
      extraction.item
    );
  return window.ExtractionScale.computeMaxExtractionOutput(
    basePerNode,
    extraction?.node_count ?? 1
  );
}

function getExtractionOutputSliderMin(extraction) {
  if (extraction?.min_target_output != null) {
    return extraction.min_target_output;
  }
  const basePerNode =
    extraction?.base_per_node ??
    window.ExtractionScale.getBaseExtractionPerNode(
      extraction.miner_slug,
      extraction.purity,
      extraction.item
    );
  return window.ExtractionScale.computeMinExtractionOutput(
    basePerNode,
    extraction?.node_count ?? 1
  );
}

function usesFractionalExtractionOutput(extraction) {
  if (!extraction) return false;
  if (getExtractionKind(extraction) === 'water') return true;
  const min = getExtractionOutputSliderMin(extraction);
  if (min < 1 - 0.0005) return true;
  return !window.ProductionScale.isIntegerOverclock(extraction.overclock ?? 100);
}

function getExtractionOutputSliderStep(extraction) {
  return usesFractionalExtractionOutput(extraction) ? 0.001 : 1;
}

function getExtractionOverclockForConfigInput(input) {
  const root = input?.closest?.('[data-extraction-id]');
  if (!root) return null;
  const ocInput = root.querySelector('.production-extraction-overclock-input');
  if (ocInput?.value) {
    const parsed = parseConfigNumberInput(ocInput.value);
    if (Number.isFinite(parsed)) return parsed;
  }
  const extractionId = Number(root.dataset.extractionId);
  const extraction = activeProductionDetail?.extractions?.find((item) => item.id === extractionId);
  return extraction?.overclock ?? null;
}

function getStepOutputRateForItem(step, itemSlug) {
  const io = (step.scaled_outputs ?? []).find((output) => output.item_slug === itemSlug);
  if (!io || !step.schema?.duration) return 0;
  return window.ProductionScale.roundProduction(
    window.ProductionScale.outputPerMinute(io.amount, step.schema.duration)
  );
}

function getStepInputRateForItem(step, itemSlug) {
  const io = (step.scaled_inputs ?? []).find((input) => input.item_slug === itemSlug);
  if (!io || !step.schema?.duration) return 0;
  return window.ProductionScale.roundProduction(
    window.ProductionScale.outputPerMinute(io.amount, step.schema.duration)
  );
}

function linkTargetsProducer(link, producerStepId) {
  return Number(link?.producer_step_id) === Number(producerStepId);
}

function linkTargetsExtraction(link, extractionId) {
  return Number(link?.producer_extraction_id) === Number(extractionId);
}

function hasManualExtractionLinks(step, itemSlug) {
  return (step.input_links?.[itemSlug] ?? []).some((link) => link.producer_extraction_id);
}

function isExtractionLinkedToConsumer(consumer, extractionId, itemSlug) {
  return (consumer?.input_links?.[itemSlug] ?? []).some((link) =>
    linkTargetsExtraction(link, extractionId)
  );
}

function isProducerLinkedToConsumer(consumer, producerStepId, itemSlug) {
  return (consumer?.input_links?.[itemSlug] ?? []).some((link) =>
    linkTargetsProducer(link, producerStepId)
  );
}

function getProducerAllocations(producer, itemSlug, allSteps) {
  const outputRate = getStepOutputRateForItem(producer, itemSlug);
  if (!outputRate) return new Map();

  const consumers = allSteps
    .filter((candidate) => Number(candidate.id) !== Number(producer.id))
    .filter((candidate) =>
      (candidate.input_links?.[itemSlug] ?? []).some((link) =>
        linkTargetsProducer(link, producer.id)
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
    const take = window.ProductionScale.roundProduction(Math.min(remaining, required));
    if (take <= 0) {
      allocations.set(consumer.id, 0);
      continue;
    }

    allocations.set(consumer.id, take);
    remaining = window.ProductionScale.roundProduction(Math.max(0, remaining - take));
    if (remaining <= LINK_BALANCE_TOLERANCE) break;
  }

  return allocations;
}

function getProducerOutputSurplus(producer, itemSlug, allSteps) {
  const outputRate = getStepOutputRateForItem(producer, itemSlug);
  if (!outputRate) return 0;

  const totalDemand = getTotalDemandForOutput(producer, itemSlug, allSteps);
  return normalizeLinkDelta(outputRate - totalDemand, outputRate);
}

function getConsumerLinkedInputRate(consumer, itemSlug, allSteps, allExtractions = []) {
  if (!consumer) return 0;

  let total = 0;
  for (const link of consumer.input_links?.[itemSlug] ?? []) {
    if (link.producer_step_id) {
      const producer = allSteps.find(
        (step) => Number(step.id) === Number(link.producer_step_id)
      );
      if (producer) {
        total += getProducerAttributedDemand(producer, consumer, itemSlug, allSteps);
      }
      continue;
    }

    if (link.producer_extraction_id) {
      const extraction = allExtractions.find(
        (candidate) => Number(candidate.id) === Number(link.producer_extraction_id)
      );
      if (extraction) {
        total += getExtractionAttributedDemand(extraction, consumer, itemSlug, allSteps);
      } else {
        total += Number(link.producer_rate) || 0;
      }
    }
  }

  return window.ProductionScale.roundProduction(total);
}

function isConsumerInputFullyCovered(consumer, itemSlug, allSteps, allExtractions = []) {
  const required = getStepInputRateForItem(consumer, itemSlug);
  if (required <= LINK_BALANCE_TOLERANCE) return true;
  const linked = getConsumerLinkedInputRate(consumer, itemSlug, allSteps, allExtractions);
  return linked + LINK_BALANCE_TOLERANCE >= required;
}

function isProducerAvailableForLink(producer, consumerStepId, itemSlug, allSteps, allExtractions = []) {
  if (Number(producer.id) === Number(consumerStepId)) return false;
  if (!(producer.scaled_outputs ?? []).some((output) => output.item_slug === itemSlug)) {
    return false;
  }

  const consumer = allSteps.find((step) => Number(step.id) === Number(consumerStepId));
  if (isProducerLinkedToConsumer(consumer, producer.id, itemSlug)) return true;
  if (isConsumerInputFullyCovered(consumer, itemSlug, allSteps, allExtractions)) return false;

  return getProducerOutputSurplus(producer, itemSlug, allSteps) > 0;
}

function formatProducerLinkOptionRate(producer, consumerStepId, itemSlug, allSteps, unit) {
  const outputRate = getStepOutputRateForItem(producer, itemSlug);
  const consumer = allSteps.find((step) => Number(step.id) === Number(consumerStepId));
  if (isProducerLinkedToConsumer(consumer, producer.id, itemSlug)) {
    return formatRateWithUnit(outputRate, unit);
  }

  const surplus = getProducerOutputSurplus(producer, itemSlug, allSteps);
  const linkedElsewhere = getLinkedConsumersForOutput(producer, itemSlug, allSteps).length > 0;
  if (linkedElsewhere && surplus > 0 && surplus + LINK_BALANCE_TOLERANCE < outputRate) {
    return t('production.surplusFree', { rate: formatRateWithUnit(surplus, unit) });
  }

  return formatRateWithUnit(outputRate, unit);
}

function getProducerCandidates(allSteps, consumerStepId, itemSlug, allExtractions = []) {
  return allSteps.filter((candidate) =>
    isProducerAvailableForLink(candidate, consumerStepId, itemSlug, allSteps, allExtractions)
  );
}

function getTotalLinkedConsumerDemand(extraction, itemSlug, allSteps) {
  if (!itemSlug) return 0;

  return window.ProductionScale.roundProduction(
    allSteps
      .filter((step) => isExtractionLinkedToConsumer(step, extraction.id, itemSlug))
      .reduce((sum, step) => sum + getStepInputRateForItem(step, itemSlug), 0)
  );
}

function formatLinkedConsumerBadgeRate(consumer, unit) {
  const allocated = consumer.allocated_rate ?? 0;
  const required = consumer.required_rate ?? 0;
  if (required > LINK_BALANCE_TOLERANCE && allocated + LINK_BALANCE_TOLERANCE < required) {
    return `${formatRateWithUnit(allocated, unit)}/${formatRateWithUnit(required, unit)}`;
  }
  return formatRateWithUnit(allocated, unit);
}

function getExtractionAllocations(extraction, itemSlug, allSteps) {
  const outputRate = getExtractionOutputRate(extraction);
  if (!outputRate) return new Map();

  const slug = extraction.item?.slug;
  if (slug !== itemSlug) return new Map();

  const consumers = allSteps
    .filter((candidate) =>
      (candidate.input_links?.[itemSlug] ?? []).some((link) =>
        linkTargetsExtraction(link, extraction.id)
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
    const take = window.ProductionScale.roundProduction(Math.min(remaining, required));
    if (take <= 0) {
      allocations.set(consumer.id, 0);
      continue;
    }

    allocations.set(consumer.id, take);
    remaining = window.ProductionScale.roundProduction(Math.max(0, remaining - take));
    if (remaining <= LINK_BALANCE_TOLERANCE) break;
  }

  return allocations;
}

function getExtractionOutputSurplus(extraction, itemSlug, allSteps) {
  const outputRate = getExtractionOutputRate(extraction);
  if (!outputRate || extraction.item?.slug !== itemSlug) return 0;

  let demand = 0;
  for (const take of getExtractionAllocations(extraction, itemSlug, allSteps).values()) {
    demand += take;
  }
  return normalizeLinkDelta(outputRate - demand, outputRate);
}

function isExtractionAvailableForLink(
  extraction,
  consumerStepId,
  itemSlug,
  allSteps,
  allExtractions = []
) {
  if (extraction.item?.slug !== itemSlug || !isExternalSummarySlug(itemSlug)) return false;

  const consumer = allSteps.find((step) => Number(step.id) === Number(consumerStepId));
  if (isExtractionLinkedToConsumer(consumer, extraction.id, itemSlug)) return true;
  if (isConsumerInputFullyCovered(consumer, itemSlug, allSteps, allExtractions)) return false;

  const surplus = getExtractionOutputSurplus(extraction, itemSlug, allSteps);
  return surplus > LINK_BALANCE_TOLERANCE;
}

function formatExtractionLinkOptionRate(extraction, consumerStepId, itemSlug, allSteps, unit) {
  const consumer = allSteps.find((step) => Number(step.id) === Number(consumerStepId));
  if (isExtractionLinkedToConsumer(consumer, extraction.id, itemSlug)) {
    const allocated = getExtractionAttributedDemand(extraction, consumer, itemSlug, allSteps);
    const required = getStepInputRateForItem(consumer, itemSlug);
    if (allocated + LINK_BALANCE_TOLERANCE < required) {
      return `${formatRateWithUnit(allocated, unit)}/${formatRateWithUnit(required, unit)}`;
    }
    return formatRateWithUnit(allocated, unit);
  }

  const required = getStepInputRateForItem(consumer, itemSlug);
  const surplus = getExtractionOutputSurplus(extraction, itemSlug, allSteps);
  if (surplus + LINK_BALANCE_TOLERANCE < required) {
    return t('production.surplusFree', { rate: formatRateWithUnit(surplus, unit) });
  }

  return formatRateWithUnit(required, unit);
}

function getExtractionCandidates(allExtractions, consumerStepId, itemSlug, allSteps) {
  return allExtractions.filter((candidate) =>
    isExtractionAvailableForLink(candidate, consumerStepId, itemSlug, allSteps, allExtractions)
  );
}

function getLinkedConsumersForExtraction(extraction, allSteps) {
  const itemSlug = extraction.item?.slug;
  if (!itemSlug) return [];

  const allocations = getExtractionAllocations(extraction, itemSlug, allSteps);

  return allSteps
    .filter((step) => isExtractionLinkedToConsumer(step, extraction.id, itemSlug))
    .map((step) => ({
      consumer_step_id: step.id,
      consumer_name: step.name,
      allocated_rate: allocations.get(step.id) ?? 0,
      required_rate: getStepInputRateForItem(step, itemSlug),
    }));
}

function getExtractionConsumerCandidates(extraction, allSteps, allExtractions = []) {
  const itemSlug = extraction.item?.slug;
  if (!itemSlug || !isExternalSummarySlug(itemSlug)) return [];

  return allSteps.filter((consumer) =>
    isExtractionConsumerAvailableForLink(
      consumer,
      extraction,
      itemSlug,
      allSteps,
      allExtractions
    )
  );
}

function isExtractionConsumerAvailableForLink(
  consumer,
  extraction,
  itemSlug,
  allSteps,
  allExtractions = []
) {
  if (!(consumer.scaled_inputs ?? []).some((io) => io.item_slug === itemSlug)) return false;
  if (isExtractionLinkedToConsumer(consumer, extraction.id, itemSlug)) return true;
  if (isConsumerInputFullyCovered(consumer, itemSlug, allSteps, allExtractions)) return false;

  const surplus = getExtractionOutputSurplus(extraction, itemSlug, allSteps);
  return surplus > LINK_BALANCE_TOLERANCE;
}

function formatExtractionConsumerLinkOptionRate(consumer, extraction, itemSlug, allSteps, unit) {
  const requiredRate = getStepInputRateForItem(consumer, itemSlug);
  if (isExtractionLinkedToConsumer(consumer, extraction.id, itemSlug)) {
    const allocated = getExtractionAttributedDemand(extraction, consumer, itemSlug, allSteps);
    if (allocated + LINK_BALANCE_TOLERANCE < requiredRate) {
      return `${formatRateWithUnit(allocated, unit)}/${formatRateWithUnit(requiredRate, unit)}`;
    }
    return formatRateWithUnit(requiredRate, unit);
  }

  const surplus = getExtractionOutputSurplus(extraction, itemSlug, allSteps);
  if (surplus + LINK_BALANCE_TOLERANCE < requiredRate) {
    return t('production.surplusFree', { rate: formatRateWithUnit(surplus, unit) });
  }

  return formatRateWithUnit(requiredRate, unit);
}

function getExtractionLinkStateClass(state, hasLinks) {
  if (!hasLinks || !state) return '';
  if (state === 'balanced') return 'production-extraction--linked-full';
  if (state === 'deficit') return 'production-extraction--linked-deficit';
  if (state === 'excess') return 'production-extraction--linked-partial';
  return '';
}

function getExtractionAttributedDemand(extraction, consumer, itemSlug, allSteps) {
  return getExtractionAllocations(extraction, itemSlug, allSteps).get(consumer.id) ?? 0;
}

function getLinkedExtractionsForInput(step, itemSlug, allExtractions, allSteps) {
  const links = (step.input_links?.[itemSlug] ?? []).filter((link) => link.producer_extraction_id);
  return links.map((link) => {
    const extraction = allExtractions.find(
      (candidate) => Number(candidate.id) === Number(link.producer_extraction_id)
    );
    return {
      ...link,
      producer_name: extraction
        ? getExtractionDisplayName(extraction, allExtractions)
        : link.producer_name,
      producer_rate: extraction
        ? getExtractionAttributedDemand(extraction, step, itemSlug, allSteps)
        : link.producer_rate,
    };
  });
}

function getLinkedProducersForInput(step, itemSlug, allSteps) {
  const links = (step.input_links?.[itemSlug] ?? []).filter((link) => link.producer_step_id);
  return links.map((link) => {
    const producer = allSteps.find((candidate) => candidate.id === link.producer_step_id);
    return {
      ...link,
      producer_name: producer?.name ?? link.producer_name,
      producer_rate: producer
        ? getProducerAttributedDemand(producer, step, itemSlug, allSteps)
        : link.producer_rate,
    };
  });
}

function normalizeLinkDelta(rawDelta, referenceRate = 0) {
  const delta = window.ProductionScale.roundProduction(Math.max(0, Number(rawDelta)));
  if (!Number.isFinite(delta) || delta <= 0) return 0;
  const ref = Math.max(Number(referenceRate) || 0, 0);
  const tolerance = Math.max(LINK_BALANCE_TOLERANCE, ref * 0.001);
  return delta <= tolerance ? 0 : delta;
}

function getLinkBalanceState(supply, demand) {
  const supplied = Number(supply);
  const needed = Number(demand);
  if (!Number.isFinite(supplied) || !Number.isFinite(needed)) return 'balanced';

  const reference = Math.max(supplied, needed, 0);
  const excess = normalizeLinkDelta(supplied - needed, reference);
  const deficit = normalizeLinkDelta(needed - supplied, reference);

  if (deficit > 0) return 'deficit';
  if (excess > 0) return 'excess';
  return 'balanced';
}

function getLinkStateClass(state, hasLinks) {
  if (!hasLinks || !state) return '';
  if (state === 'balanced') return 'craft-io-item--linked-full';
  if (state === 'deficit') return 'craft-io-item--linked-deficit';
  if (state === 'excess') return 'craft-io-item--linked-partial';
  return '';
}

function getProducerAttributedDemand(producer, consumer, itemSlug, allSteps) {
  return getProducerAllocations(producer, itemSlug, allSteps).get(consumer.id) ?? 0;
}

function resolveInputLinkBalance(step, itemSlug, linkedRate, requiredRate) {
  const externalRate = normalizeLinkDelta(requiredRate - linkedRate, requiredRate);
  const linkedExcessRate = normalizeLinkDelta(linkedRate - requiredRate, linkedRate);

  return {
    state: getLinkBalanceState(linkedRate, requiredRate),
    externalRate,
    linkedExcessRate,
    externalCovered: false,
  };
}

function getTotalDemandForOutput(producer, itemSlug, allSteps) {
  let demand = 0;
  for (const take of getProducerAllocations(producer, itemSlug, allSteps).values()) {
    demand += take;
  }
  return window.ProductionScale.roundProduction(demand);
}

function getLinkedConsumersForOutput(producer, itemSlug, allSteps) {
  const allocations = getProducerAllocations(producer, itemSlug, allSteps);

  return allSteps
    .filter((consumer) => Number(consumer.id) !== Number(producer.id))
    .filter((consumer) => allocations.has(consumer.id))
    .map((consumer) => ({
      consumer_step_id: consumer.id,
      consumer_name: consumer.name,
      required_rate: allocations.get(consumer.id) ?? 0,
    }))
    .filter((consumer) => consumer.required_rate > 0);
}

function stepLinksToProducer(step, producerStepId) {
  return Object.values(step.input_links ?? {})
    .flat()
    .some((link) => linkTargetsProducer(link, producerStepId));
}

function stepLinksToExtraction(step, extractionId) {
  return Object.values(step.input_links ?? {})
    .flat()
    .some((link) => linkTargetsExtraction(link, extractionId));
}

function getProductionStepElement(stepId) {
  return productionDetailBody.querySelector(`.production-step[data-step-id="${stepId}"]`);
}

function getProductionStepViewState(stepId) {
  const id = normalizeProductionStepId(stepId);
  if (!id) return 'expanded';
  const state = productionStepViewStates.get(id) ?? 'expanded';
  return isCollapsedProductionViewState(state) ? 'collapsed' : state;
}

function setProductionStepViewState(stepId, state) {
  const id = normalizeProductionStepId(stepId);
  if (!id) return;

  if (state === 'collapsed') {
    productionStepViewStates.set(id, 'collapsed');
  } else {
    productionStepViewStates.delete(id);
  }
  persistProductionUiState();
}

function cycleProductionStepViewState(stepId) {
  const next = getProductionStepViewState(stepId) === 'collapsed' ? 'expanded' : 'collapsed';
  setProductionStepViewState(stepId, next);
  return next;
}

function updateProductionStepToggleButton(stepEl, state) {
  const btn = stepEl?.querySelector('.production-step-toggle-btn');
  if (!btn) return;

  const configByState = {
    expanded: { icon: 'fa-chevron-up', label: t('production.collapseStep') },
    collapsed: { icon: 'fa-chevron-down', label: t('production.expandStep') },
  };
  const config = configByState[state] ?? configByState.expanded;

  btn.innerHTML = `<i class="fa-solid ${config.icon}" aria-hidden="true"></i>`;
  btn.title = config.label;
  btn.setAttribute('aria-label', config.label);
  btn.setAttribute('aria-expanded', state === 'collapsed' ? 'false' : 'true');
}

function applyProductionStepViewState(stepEl, state) {
  if (!stepEl) return;

  stepEl.dataset.viewState = state;
  stepEl.classList.toggle('production-step--collapsed', state === 'collapsed');
  updateProductionStepToggleButton(stepEl, state);
}

function applyAllProductionStepViewStates() {
  productionDetailBody.querySelectorAll('.production-step[data-step-id]').forEach((stepEl) => {
    applyProductionStepViewState(
      stepEl,
      getProductionStepViewState(normalizeProductionStepId(stepEl.dataset.stepId))
    );
  });
}

function updateProductionGroupToggleButton(groupEl, state) {
  const btn = groupEl?.querySelector('.production-step-group-toggle-btn');
  if (!btn) return;

  btn.setAttribute('aria-expanded', state === 'collapsed' ? 'false' : 'true');
  btn.title = state === 'collapsed' ? t('production.expandGroup') : t('production.collapseGroup');
  btn.setAttribute(
    'aria-label',
    state === 'collapsed' ? t('production.expandGroup') : t('production.collapseGroup')
  );

  const icon = btn.querySelector('i');
  if (icon) {
    icon.className = `fa-solid ${state === 'collapsed' ? 'fa-chevron-down' : 'fa-chevron-up'}`;
  }
}

function applyProductionGroupViewState(groupEl, state) {
  if (!groupEl) return;

  groupEl.classList.toggle('production-step-group--collapsed', state === 'collapsed');
  updateProductionGroupToggleButton(groupEl, state);
}

function applyAllProductionGroupViewStates() {
  productionDetailBody.querySelectorAll('.production-step-group[data-group-key]').forEach((groupEl) => {
    applyProductionGroupViewState(groupEl, getProductionGroupViewState(groupEl.dataset.groupKey));
  });
  updateProductionGroupReorderUi();
}

function refreshAllStepIoDisplays() {
  syncChainResourceBalanceCache();
  const allSteps = activeProductionDetail?.steps ?? [];

  for (const step of allSteps) {
    const stepEl = getProductionStepElement(step.id);
    if (!stepEl || !step?.schema) continue;

    updateStepIoDisplay(
      stepEl,
      { inputs: step.scaled_inputs, outputs: step.scaled_outputs },
      step.schema,
      step,
      allSteps
    );
  }
}

function refreshRelatedStepIoDisplays(changedStepId) {
  syncChainResourceBalanceCache();
  const allSteps = activeProductionDetail?.steps ?? [];
  const stepsToRefresh = new Set([changedStepId]);
  const changedStep = allSteps.find((item) => Number(item.id) === Number(changedStepId));
  const changedOutputSlugs = new Set((changedStep?.scaled_outputs ?? []).map((io) => io.item_slug));

  for (const step of allSteps) {
    if (stepLinksToProducer(step, changedStepId)) {
      stepsToRefresh.add(step.id);
    }

    if (
      changedOutputSlugs.size > 0 &&
      (step.scaled_inputs ?? []).some((io) => changedOutputSlugs.has(io.item_slug))
    ) {
      stepsToRefresh.add(step.id);
    }

    if (Number(step.id) !== Number(changedStepId)) continue;

    for (const links of Object.values(step.input_links ?? {})) {
      for (const link of links) {
        stepsToRefresh.add(link.producer_step_id);
      }
    }
  }

  for (const stepId of stepsToRefresh) {
    const step = allSteps.find((item) => item.id === stepId);
    const stepEl = getProductionStepElement(stepId);
    if (!stepEl || !step?.schema) continue;

    updateStepIoDisplay(
      stepEl,
      { inputs: step.scaled_inputs, outputs: step.scaled_outputs },
      step.schema,
      step,
      allSteps
    );
  }
}

function syncChainResourceBalanceCache() {
  if (!activeProductionDetail) return;
  const steps = activeProductionDetail.steps ?? [];
  const extractions = activeProductionDetail.extractions ?? [];
  activeProductionDetail.chainBalanceBySlug = new Map(
    computeChainResourceBalance(steps, extractions).map((entry) => [entry.item_slug, entry])
  );
}

function findResourceItemIdBySlug(slug) {
  if (!slug) return null;
  for (const cat of pickerResourcesData) {
    for (const item of cat.items) {
      if (item.slug === slug) return item.id;
    }
  }
  return null;
}

async function ensurePickerResourcesData() {
  if (pickerResourcesData.length) return;
  pickerResourcesData = await window.satisfactory.getResources();
}

async function addProductionStepForItem(itemId) {
  const detail = await window.satisfactory.getResourceDetail(itemId);
  if (!detail?.item) {
    pendingInsertAfterStepId = null;
    return;
  }

  const schemas = [...(detail.main ?? []), ...(detail.alternatives ?? [])];
  if (!schemas.length) {
    pendingInsertAfterStepId = null;
    return;
  }

  if (schemas.length === 1) {
    await addProductionStep(itemId, schemas[0].id);
    return;
  }

  openSchemaPickerModal(detail.item, schemas);
}

async function addProductionStepForInputSlug(itemSlug) {
  if (!itemSlug || !activeProductionChainId) return;

  try {
    if (!pickerResourcesData.length) {
      await ensurePickerResourcesData();
    }

    const itemId = findResourceItemIdBySlug(itemSlug);
    if (!itemId) {
      console.warn('Resource not found:', itemSlug);
      return;
    }

    await addProductionStepForItem(itemId);
  } catch (err) {
    pendingInsertAfterStepId = null;
    console.error('Add production step from input error:', err);
  }
}

function getChainBalanceEntry(itemSlug) {
  return activeProductionDetail?.chainBalanceBySlug?.get(itemSlug) ?? null;
}

function getMineralSlugs() {
  const slugs = new Set();
  for (const cat of pickerResourcesData) {
    if (cat.slug === 'minerali') {
      cat.items.forEach((item) => slugs.add(item.slug));
    }
  }
  return slugs;
}

function computeClientExtractionRate(
  extractorSlug,
  purity,
  overclock,
  nodeCount = 1,
  itemOrSlug = null
) {
  const item =
    itemOrSlug && typeof itemOrSlug === 'object'
      ? itemOrSlug
      : itemOrSlug != null
        ? { slug: itemOrSlug }
        : null;
  return window.ExtractionScale.computeExtractionRate(
    extractorSlug,
    purity,
    overclock,
    nodeCount,
    item
  );
}

function getExtractionOutputRate(extraction) {
  if (extraction.output_rate != null) return extraction.output_rate;

  const itemSlug = extraction.item?.slug ?? null;
  return computeClientExtractionRate(
    extraction.miner_slug,
    extraction.purity,
    extraction.overclock,
    extraction.node_count ?? 1,
    itemSlug
  );
}

function disposeProductionGraph() {
  productionGraphHandle?.disconnect?.();
  productionGraphHandle = null;
}

function cleanupProductionDragArtifacts() {
  if (productionGroupDragState) {
    productionGroupDragState.clone?.remove();
    productionGroupDragState.placeholder?.remove();
    productionGroupDragState.groupEl?.classList.remove('production-step-group--drag-hidden');
    productionGroupDragState = null;
  }

  if (productionStepDragState) {
    productionStepDragState.clone?.remove();
    productionStepDragState.placeholder?.remove();
    productionStepDragState.stepEl?.classList.remove(
      'production-step--dragging',
      'production-step--drag-hidden'
    );
    productionStepDragState = null;
  }

  document.body.classList.remove('production-step-drag-active');
  document.querySelectorAll('.production-step-clone, .production-step-group-clone').forEach((el) => {
    el.remove();
  });
}

function getProductionGraphHelpers(detail) {
  return {
    chainId: detail.chain?.id ?? null,
    escapeHtml,
    formatProductionValue,
    formatRateWithUnit,
    computeProductionObjectives,
    getStepInputRateForItem,
    getStepOutputRateForItem,
    getProducerAttributedDemand,
    getExtractionAttributedDemand,
    hasManualExtractionLinks,
    isExternalSummarySlug,
    getExtractionOutputRate,
    getExtractionDisplayName,
    getExtractionKind,
    getExtractionOutputUnit,
    getProductionGroupKey,
    getProductionGroupLabel,
    roundProduction: (value) => window.ProductionScale.roundProduction(value),
    linkTolerance: LINK_BALANCE_TOLERANCE,
    extractions: detail.extractions ?? [],
  };
}

function getProductionGroupLabel(groupKey) {
  if (!groupKey || groupKey === PRODUCTION_GROUP_KEY_UNGROUPED) return t('common.ungrouped');
  return groupKey;
}

function isProductionTreeViewMode() {
  return productionDetailViewMode === 'tree' || productionDetailViewMode === 'group-tree';
}

function updateProductionTreeButtonState() {
  const btn = document.getElementById('btn-production-tree-view');
  const groupBtn = document.getElementById('btn-production-group-tree-view');
  const addExtractionBtn = document.getElementById('btn-add-extraction');
  const addResourceStepBtn = document.getElementById('btn-add-resource-step');
  const actionsEl = document.querySelector('#view-production-detail .production-detail-actions');
  if (!btn) return;

  const isTree = productionDetailViewMode === 'tree';
  const isGroupTree = productionDetailViewMode === 'group-tree';
  const isAnyTree = isTree || isGroupTree;

  const iconClass = isTree ? 'fa-align-right' : 'fa-code-fork';
  const label = isTree ? t('production.backToEditor') : t('production.treeView');
  btn.classList.toggle('btn-tree--active', isTree);
  btn.innerHTML = `<i class="fa-solid ${iconClass}" aria-hidden="true"></i>${escapeHtml(label)}`;
  btn.setAttribute('aria-pressed', isTree ? 'true' : 'false');
  btn.title = isTree
    ? productionTreeGroupKey
      ? t('production.treeViewOfGroup', { name: getProductionGroupLabel(productionTreeGroupKey) })
      : t('production.backToEditorPlan')
    : t('production.treeViewTitle');

  if (groupBtn) {
    const groupIconClass = isGroupTree ? 'fa-align-right' : 'fa-layer-group';
    const groupLabel = isGroupTree ? t('production.backToEditor') : t('production.treeViewGroups');
    groupBtn.classList.toggle('btn-tree--active', isGroupTree);
    groupBtn.innerHTML = `<i class="fa-solid ${groupIconClass}" aria-hidden="true"></i>${escapeHtml(groupLabel)}`;
    groupBtn.setAttribute('aria-pressed', isGroupTree ? 'true' : 'false');
    groupBtn.title = isGroupTree
      ? t('production.backToEditorPlan')
      : t('production.treeViewGroupsTitle');
  }

  actionsEl?.classList.toggle('production-detail-actions--tree-view', isAnyTree);
  addExtractionBtn?.toggleAttribute('hidden', isAnyTree);
  addResourceStepBtn?.toggleAttribute('hidden', isAnyTree);
}

function updateProductionGroupTreeButtonVisibility(detail) {
  const groupBtn = document.getElementById('btn-production-group-tree-view');
  if (!groupBtn) return;
  const hasNamedGroups = collectProductionGroupNames(detail?.steps ?? []).length > 0;
  groupBtn.hidden = !hasNamedGroups;
  if (!hasNamedGroups && productionDetailViewMode === 'group-tree') {
    productionDetailViewMode = 'editor';
    updateProductionTreeButtonState();
  }
}

function openProductionGroupTreeView(groupKey) {
  if (!groupKey) return;
  productionDetailViewMode = 'tree';
  productionTreeGroupKey = groupKey;
  updateProductionTreeButtonState();
  if (activeProductionDetail) {
    renderProductionDetailContent(activeProductionDetail);
  }
}

function toggleProductionTreeView() {
  if (productionDetailViewMode === 'tree') {
    productionDetailViewMode = 'editor';
    productionTreeGroupKey = null;
  } else {
    productionDetailViewMode = 'tree';
    productionTreeGroupKey = null;
  }
  updateProductionTreeButtonState();
  if (activeProductionDetail) {
    renderProductionDetailContent(activeProductionDetail);
  }
}

function toggleProductionGroupTreeView() {
  if (productionDetailViewMode === 'group-tree') {
    productionDetailViewMode = 'editor';
  } else {
    productionDetailViewMode = 'group-tree';
    productionTreeGroupKey = null;
  }
  updateProductionTreeButtonState();
  if (activeProductionDetail) {
    renderProductionDetailContent(activeProductionDetail);
  }
}

function getExtractionKind(extraction) {
  if (extraction?.extraction_kind) return extraction.extraction_kind;
  const slug = extraction?.item?.slug;
  if (slug === 'liquid-oil') return 'oil';
  if (slug === 'water') return 'water';
  return 'mineral';
}

function getExtractionSubtitle(kind) {
  switch (kind) {
    case 'oil':
      return t('extraction.oil');
    case 'water':
      return t('extraction.water');
    case 'coal':
      return t('extraction.coal');
    default:
      return t('extraction.mineral');
  }
}

function isExtractionPickerItem(item) {
  return item.category === 'minerali' || EXTRACTION_LIQUID_SLUGS.includes(item.slug);
}

function getExtractionOutputUnit(item, kind = null) {
  const resolvedKind = kind ?? (item ? getExtractionKind({ item }) : 'mineral');
  if (resolvedKind === 'oil' || resolvedKind === 'water' || item?.category === 'liquidi') {
    return 'm³/min';
  }
  return item?.is_fluid ? 'm³/min' : '/min';
}

function isExternalSummarySlug(slug) {
  const mineralSlugs = getMineralSlugs();
  if (mineralSlugs.has(slug)) return true;
  return EXTRACTION_LIQUID_SLUGS.includes(slug);
}

function computeChainResourceBalance(allSteps, extractions = []) {
  const balance = new Map();

  const ensureEntry = (io, fallback = {}) => {
    const slug = io.item_slug ?? fallback.slug;
    if (!slug || !isExternalSummarySlug(slug)) return null;

    if (!balance.has(slug)) {
      balance.set(slug, {
        item_slug: slug,
        item_name: io.item_name ?? fallback.item_name ?? slug,
        item_image: io.item_image ?? fallback.item_image ?? null,
        is_fluid: Boolean(io.is_fluid ?? fallback.is_fluid),
        demand: 0,
        produced: 0,
      });
    }

    const entry = balance.get(slug);
    if (!entry.item_name && io.item_name) entry.item_name = io.item_name;
    if (!entry.item_image && io.item_image) entry.item_image = io.item_image;
    if (io.is_fluid) entry.is_fluid = true;
    return entry;
  };

  for (const step of allSteps) {
    for (const io of step.scaled_inputs ?? []) {
      const entry = ensureEntry(io);
      if (!entry) continue;
      entry.demand = window.ProductionScale.roundProduction(
        entry.demand + getStepInputRateForItem(step, io.item_slug)
      );
    }

    for (const io of step.scaled_outputs ?? []) {
      const entry = ensureEntry(io);
      if (!entry) continue;
      entry.produced = window.ProductionScale.roundProduction(
        entry.produced + getStepOutputRateForItem(step, io.item_slug)
      );
    }
  }

  for (const extraction of extractions) {
    const slug = extraction.item?.slug;
    if (!slug || !isExternalSummarySlug(slug)) continue;

    const provided =
      extraction.output_rate ??
      computeClientExtractionRate(
        extraction.miner_slug,
        extraction.purity,
        extraction.overclock,
        extraction.node_count,
        slug
      );

    if (!balance.has(slug)) {
      balance.set(slug, {
        item_slug: slug,
        item_name: extraction.item?.name || slug,
        item_image: extraction.item?.image ?? null,
        is_fluid: Boolean(extraction.item?.is_fluid),
        demand: 0,
        produced: 0,
      });
    }

    balance.get(slug).produced = window.ProductionScale.roundProduction(
      balance.get(slug).produced + provided
    );
  }

  return [...balance.values()]
    .map((entry) => ({
      ...entry,
      missing: normalizeLinkDelta(
        entry.demand - entry.produced,
        Math.max(entry.demand, entry.produced)
      ),
    }))
    .filter(
      (entry) =>
        entry.demand > LINK_BALANCE_TOLERANCE || entry.produced > LINK_BALANCE_TOLERANCE
    )
    .sort((a, b) =>
      (a.item_name || a.item_slug).localeCompare(b.item_name || b.item_slug, activeLocale || 'it')
    );
}

function getPurityLabel(purity) {
  return PURITY_OPTIONS.find((option) => option.value === purity)?.label ?? purity;
}

const PURITY_SORT_ORDER = { impure: 0, normal: 1, pure: 2 };

function computeExtractionNodeGroups(extractions = []) {
  const groups = new Map();

  for (const extraction of extractions) {
    const slug = extraction.item?.slug;
    if (!slug) continue;

    const kind = getExtractionKind(extraction);
    const purity = kind === 'water' ? 'water' : extraction.purity || 'normal';
    const key = kind === 'water' ? `${slug}:water` : `${slug}:${purity}`;
    const existing = groups.get(key) ?? {
      item_slug: slug,
      item_name: extraction.item?.name || slug,
      item_image: extraction.item?.image,
      purity: kind === 'water' ? null : purity,
      node_count: 0,
    };

    existing.node_count += Math.max(1, Math.round(Number(extraction.node_count) || 1));
    groups.set(key, existing);
  }

  return [...groups.values()].sort((a, b) => {
    const nameCmp = (a.item_name || a.item_slug).localeCompare(
      b.item_name || b.item_slug,
      activeLocale || 'it'
    );
    if (nameCmp !== 0) return nameCmp;
    return (PURITY_SORT_ORDER[a.purity] ?? 1) - (PURITY_SORT_ORDER[b.purity] ?? 1);
  });
}

function renderProductionNodesSummary(extractions = []) {
  const groups = computeExtractionNodeGroups(extractions);
  if (!groups.length) return '';

  const rows = groups
    .map((group) => {
      const img = group.item_image
        ? `<img class="production-external-icon" src="${escapeHtml(group.item_image)}" alt="" />`
        : '<span class="resource-img resource-img--placeholder production-external-icon"></span>';

      return `
        <tr>
          <td class="production-external-resource">
            ${img}
            <span class="production-node-label">
              ${escapeHtml(group.item_name || group.item_slug)}${
                group.purity
                  ? `<span class="production-node-purity">${escapeHtml(getPurityLabel(group.purity))}</span>`
                  : ''
              }
            </span>
          </td>
          <td class="production-external-rate">${formatDisplayInteger(group.node_count)}</td>
        </tr>`;
    })
    .join('');

  return `
    <div class="production-external-summary-inner production-external-summary-inner--nodes">
      <table class="production-external-table">
        <thead>
          <tr>
            <th>${escapeHtml(t('production.summaryNode'))}</th>
            <th>${escapeHtml(t('production.summaryCount'))}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderProductionMineralsSummary(steps, extractions = []) {
  const items = computeChainResourceBalance(steps, extractions);
  if (!items.length) return '';

  const rows = items
    .map((item) => {
      const required = item.demand;
      const produced = item.produced;
      const coverageState = getLinkBalanceState(produced, required);
      let rowClass = '';
      if (coverageState === 'balanced') rowClass = 'production-external-row--balanced';
      else if (coverageState === 'deficit') rowClass = 'production-external-row--deficit';
      else if (coverageState === 'excess') rowClass = 'production-external-row--partial';

      const img = item.item_image
        ? `<img class="production-external-icon" src="${escapeHtml(item.item_image)}" alt="" />`
        : '<span class="resource-img resource-img--placeholder production-external-icon"></span>';
      const unit =
        item.is_fluid || EXTRACTION_LIQUID_SLUGS.includes(item.item_slug) ? 'm³/min' : '/min';
      const formatQty = (value) => formatRateWithUnit(value, unit);
      const missingCell =
        item.missing > LINK_BALANCE_TOLERANCE ? formatQty(item.missing) : '';

      return `
        <tr${rowClass ? ` class="${rowClass}"` : ''}>
          <td class="production-external-resource">
            ${img}
            <span>${escapeHtml(item.item_name || item.item_slug)}</span>
          </td>
          <td class="production-external-rate">${formatQty(required)}</td>
          <td class="production-external-rate">${formatQty(produced)}</td>
          <td class="production-external-rate">${missingCell}</td>
        </tr>`;
    })
    .join('');

  return `
    <div class="production-external-summary-inner production-external-summary-inner--minerals">
      <table class="production-external-table production-external-table--resources">
        <thead>
          <tr>
            <th>${escapeHtml(t('production.summaryResource'))}</th>
            <th class="production-external-rate">${escapeHtml(t('production.summaryRequired'))}</th>
            <th class="production-external-rate">${escapeHtml(t('production.summaryProduced'))}</th>
            <th class="production-external-rate">${escapeHtml(t('production.summaryMissing'))}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function computeProductionObjectives(steps = []) {
  const objectives = [];

  for (const step of steps) {
    for (const io of step.scaled_outputs ?? []) {
      const linkedConsumers = getLinkedConsumersForOutput(step, io.item_slug, steps);
      if (linkedConsumers.length > 0) continue;

      const rate = getStepOutputRateForItem(step, io.item_slug);
      if (!rate) continue;

      objectives.push({
        step_id: step.id,
        step_name: step.name,
        item_slug: io.item_slug,
        item_name: io.item_name || io.item_slug,
        item_image: io.item_image,
        is_fluid: Boolean(io.is_fluid),
        rate,
      });
    }
  }

  return objectives.sort((a, b) => {
    const stepA = steps.find((step) => step.id === a.step_id);
    const stepB = steps.find((step) => step.id === b.step_id);
    const orderCmp = (stepA?.sort_order ?? 0) - (stepB?.sort_order ?? 0);
    if (orderCmp !== 0) return orderCmp;
    return a.item_name.localeCompare(b.item_name, activeLocale || 'it');
  });
}

function renderProductionObjectivesSummary(steps = []) {
  const objectives = computeProductionObjectives(steps);

  const rows = objectives
    .map((objective) => {
      const img = objective.item_image
        ? `<img class="production-external-icon" src="${escapeHtml(objective.item_image)}" alt="" />`
        : '<span class="resource-img resource-img--placeholder production-external-icon"></span>';
      const unit = objective.is_fluid ? 'm³/min' : '/min';

      return `
        <tr>
          <td class="production-external-resource">
            ${img}
            <span>${escapeHtml(objective.item_name)}</span>
          </td>
          <td class="production-external-rate production-objective-rate">${formatRateWithUnit(objective.rate, unit)}</td>
          <td class="production-objective-source">${escapeHtml(objective.step_name)}</td>
        </tr>`;
    })
    .join('');

  const body = objectives.length
    ? rows
    : `<tr><td colspan="3" class="production-external-empty">${escapeHtml(t('production.noProductionObjectives'))}</td></tr>`;

  return `
    <div class="production-external-summary-inner production-external-summary-inner--objectives">
      <table class="production-external-table production-external-table--objectives">
        <thead>
          <tr>
            <th>${escapeHtml(t('production.summaryResource'))}</th>
            <th class="production-external-rate">${escapeHtml(t('production.summaryObjective'))}</th>
            <th>${escapeHtml(t('production.summaryStep'))}</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

function renderPowerShardsSummary(totalShards, totalMw = 0, totalSomersloops = 0) {
  const mw = Number(totalMw) || 0;
  const somersloops = Math.max(0, Math.round(Number(totalSomersloops) || 0));
  const mwRow =
    mw > 0
      ? `
          <tr>
            <td class="production-external-resource">
              <i class="fa-solid fa-bolt production-external-icon production-external-icon--bolt" aria-hidden="true"></i>
              <span>${escapeHtml(t('production.totalPowerConsumption'))}</span>
            </td>
            <td class="production-external-rate">${escapeHtml(formatRateWithUnit(mw, 'MW'))}</td>
          </tr>`
      : '';
  const somersloopRow =
    somersloops > 0
      ? `
          <tr>
            <td class="production-external-resource">
              <img class="production-external-icon" src="${SOMERSLOOP_IMAGE}" alt="" />
              <span>${escapeHtml(t('production.totalSomersloops'))}</span>
            </td>
            <td class="production-external-rate">${formatDisplayInteger(somersloops)}</td>
          </tr>`
      : '';

  return `
    <div class="production-external-summary-inner production-external-summary-inner--power-shards">
      <table class="production-external-table">
        <thead>
          <tr>
            <th>${escapeHtml(t('production.summaryInfo'))}</th>
            <th class="production-external-rate">${escapeHtml(t('production.summaryCount'))}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="production-external-resource">
              <img class="production-external-icon" src="${POWER_SHARD_IMAGE}" alt="" />
              <span>${escapeHtml(t('production.totalPowerShards'))}</span>
            </td>
            <td class="production-external-rate">${formatDisplayInteger(totalShards)}</td>
          </tr>
          ${somersloopRow}
          ${mwRow}
        </tbody>
      </table>
    </div>`;
}

function renderProductionExternalSummary(steps, extractions = []) {
  const nodesHtml = renderProductionNodesSummary(extractions);
  const mineralsHtml = renderProductionMineralsSummary(steps, extractions);
  const objectivesHtml = steps.length ? renderProductionObjectivesSummary(steps) : '';
  const powerShardsHtml =
    steps.length || extractions.length
      ? renderPowerShardsSummary(
          computeDetailPowerShards(steps, extractions),
          computeDetailPowerMw(steps, extractions),
          computeDetailSomersloops(steps)
        )
      : '';

  if (!nodesHtml && !mineralsHtml && !objectivesHtml && !powerShardsHtml) return '';

  const leadColumnHtml =
    objectivesHtml || powerShardsHtml
      ? `<div class="production-external-summary-lead">${objectivesHtml}${powerShardsHtml}</div>`
      : '';

  return `<div class="production-external-summary-stack">${leadColumnHtml}${nodesHtml}${mineralsHtml}</div>`;
}

function updateProductionDetailExternalSummary() {
  const el = document.getElementById('production-detail-external-summary');
  if (!el) return;

  syncChainResourceBalanceCache();

  const steps = activeProductionDetail?.steps ?? [];
  const extractions = activeProductionDetail?.extractions ?? [];
  el.innerHTML =
    steps.length || extractions.length ? renderProductionExternalSummary(steps, extractions) : '';
}

function normalizeProductionGroupName(name) {
  const trimmed = String(name ?? '').trim();
  return trimmed ? trimmed.toLocaleUpperCase('it') : null;
}

function getProductionGroupKey(groupName) {
  return normalizeProductionGroupName(groupName) ?? PRODUCTION_GROUP_KEY_UNGROUPED;
}

function getProductionGroupViewState(groupKey) {
  const state = productionGroupViewStates.get(groupKey) ?? 'expanded';
  return isCollapsedProductionViewState(state) ? 'collapsed' : state;
}

function setProductionGroupViewState(groupKey, state) {
  if (!groupKey) return;

  if (state === 'collapsed') {
    productionGroupViewStates.set(groupKey, 'collapsed');
  } else {
    productionGroupViewStates.delete(groupKey);
  }
  persistProductionUiState();
}

function toggleProductionGroupViewState(groupKey) {
  const next = getProductionGroupViewState(groupKey) === 'collapsed' ? 'expanded' : 'collapsed';
  setProductionGroupViewState(groupKey, next);
  return next;
}

function getProductionGroupsListElement() {
  return productionDetailBody.querySelector('#production-steps-list');
}

function canReorderProductionGroups() {
  const list = getProductionGroupsListElement();
  if (!list) return false;
  const groups = list.querySelectorAll('.production-step-group');
  if (groups.length < 2) return false;
  return [...groups].every((group) => group.classList.contains('production-step-group--collapsed'));
}

function updateProductionGroupReorderUi() {
  const list = getProductionGroupsListElement();
  if (!list) return;

  const groups = list.querySelectorAll('.production-step-group');
  const canReorder = canReorderProductionGroups();
  list.classList.toggle('production-steps-list--group-reorder', canReorder);

  groups.forEach((group) => {
    const handle = group.querySelector('.production-step-group-drag-handle');
    if (handle) {
      handle.setAttribute('aria-hidden', canReorder ? 'false' : 'true');
      handle.tabIndex = canReorder ? 0 : -1;
    }
  });

  const hint = productionDetailBody.querySelector('.production-group-reorder-hint');
  if (hint) {
    hint.hidden = groups.length < 2 || canReorder;
  }
}

function collectProductionGroupNames(steps = []) {
  const names = new Set();
  for (const step of steps) {
    const name = normalizeProductionGroupName(step.group_name);
    if (name) names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b, activeLocale || 'it'));
}

function buildProductionStepGroups(steps = [], groupMarks = {}) {
  const groups = new Map();

  for (const step of steps) {
    const key = getProductionGroupKey(step.group_name);
    const existing = groups.get(key) ?? {
      key,
      name: key === PRODUCTION_GROUP_KEY_UNGROUPED ? null : key,
      steps: [],
      minOrder: step.sort_order,
      marked: key !== PRODUCTION_GROUP_KEY_UNGROUPED && Number(groupMarks[key]) === 1,
    };
    existing.steps.push(step);
    existing.minOrder = Math.min(existing.minOrder, step.sort_order);
    groups.set(key, existing);
  }

  return [...groups.values()]
    .sort((a, b) => {
      if (a.minOrder !== b.minOrder) return a.minOrder - b.minOrder;
      if (a.key === PRODUCTION_GROUP_KEY_UNGROUPED) return 1;
      if (b.key === PRODUCTION_GROUP_KEY_UNGROUPED) return -1;
      return a.key.localeCompare(b.key, activeLocale || 'it');
    })
    .map((group) => ({
      ...group,
      steps: group.steps.sort(
        (a, b) => a.sort_order - b.sort_order || Number(a.id) - Number(b.id)
      ),
    }));
}

function renderProductionStepGroupSelect(step, allSteps = []) {
  const groups = collectProductionGroupNames(allSteps);
  const current = normalizeProductionGroupName(step.group_name) ?? '';
  const options = [
    { value: '', label: t('common.ungrouped') },
    ...groups.map((name) => ({ value: name, label: name })),
    { value: '__new__', label: t('production.newGroupOption') },
  ];

  return `
    <div class="production-step-group-select">
      ${renderThemeSelect({
        id: `production-step-group-${step.id}`,
        options,
        selectedValue: current,
        dataset: { field: 'step-group', stepId: step.id },
      })}
    </div>`;
}

function getProductionMarkIconClass(marked) {
  return marked ? 'fa-xmark' : 'fa-check';
}

function syncProductionMarkButton(btn, marked, activeClass) {
  if (!btn) return;
  if (activeClass) btn.classList.toggle(activeClass, marked);
  const icon = btn.querySelector('i');
  if (!icon) return;
  icon.classList.remove('fa-check', 'fa-xmark');
  icon.classList.add(getProductionMarkIconClass(marked));
}

function renderProductionStepGroup(group, allSteps = []) {
  const state = getProductionGroupViewState(group.key);
  const label = group.name ?? t('common.ungrouped');
  const stepsHtml = group.steps.map((step) => renderProductionStep(step, allSteps)).join('');
  const isGroupMarked = Boolean(group.marked);
  const markBtn =
    group.name !== null
      ? `
        <label
          class="production-step-group-mark-btn${isGroupMarked ? ' production-step-group-mark-btn--active' : ''}"
          title="${escapeHtml(t('production.highlightGroupTitle'))}"
          aria-label="${escapeHtml(t('production.highlightGroup'))} ${escapeHtml(label)}"
        >
          <input
            type="checkbox"
            class="production-step-group-mark-checkbox"
            data-group-key="${escapeHtml(group.key)}"
            ${isGroupMarked ? 'checked' : ''}
          />
          <i class="fa-solid ${getProductionMarkIconClass(isGroupMarked)}" aria-hidden="true"></i>
        </label>`
      : '';
  const renameBtn =
    group.name !== null
      ? `
        <button
          type="button"
          class="production-step-group-rename-btn"
          data-group-key="${escapeHtml(group.key)}"
          title="${escapeHtml(t('production.renameGroup'))}"
          aria-label="${escapeHtml(t('production.renameGroupAria', { name: label }))}"
        ><i class="fa-solid fa-pen" aria-hidden="true"></i></button>`
      : '';

  return `
    <section
      class="production-step-group${state === 'collapsed' ? ' production-step-group--collapsed' : ''}${isGroupMarked ? ' production-step-group--marked' : ''}"
      data-group-key="${escapeHtml(group.key)}"
    >
      <header class="production-step-group-header">
        <div
          class="production-step-group-drag-handle production-step-drag-handle"
          role="button"
          tabindex="-1"
          aria-hidden="true"
          aria-label="${escapeHtml(t('production.dragReorder'))}"
        >${DRAG_ICON}</div>
        <button
          type="button"
          class="production-step-group-toggle-btn"
          data-group-key="${escapeHtml(group.key)}"
          aria-expanded="${state !== 'collapsed' ? 'true' : 'false'}"
          title="${escapeHtml(state === 'collapsed' ? t('production.expandGroup') : t('production.collapseGroup'))}"
          aria-label="${escapeHtml(state === 'collapsed' ? t('production.expandGroup') : t('production.collapseGroup'))}"
        ><i class="fa-solid ${state === 'collapsed' ? 'fa-chevron-down' : 'fa-chevron-up'}" aria-hidden="true"></i></button>
        <h4 class="production-step-group-title">${escapeHtml(label)}</h4>
        <div class="production-step-group-header-actions">
          ${markBtn}
          ${renameBtn}
        </div>
        <button
          type="button"
          class="btn btn-tree production-step-group-tree-btn"
          data-group-key="${escapeHtml(group.key)}"
          title="${escapeHtml(t('production.treeViewOfGroup', { name: label }))}"
          aria-label="${escapeHtml(t('production.treeViewOfGroup', { name: label }))}"
        ><i class="fa-solid fa-code-fork" aria-hidden="true"></i>${escapeHtml(t('production.treeViewButton'))}</button>
        <span class="production-step-group-count">${formatDisplayInteger(group.steps.length)}</span>
      </header>
      <div class="production-step-group-body">
        ${stepsHtml}
      </div>
    </section>`;
}

function renderProductionStepsList(steps = [], allSteps = steps, groupMarks = {}) {
  if (!steps.length) {
    return `<p class="detail-empty production-schemas-empty">${escapeHtml(t('production.emptyResourceSteps'))}</p>`;
  }

  const groups = buildProductionStepGroups(steps, groupMarks);
  const hasNamedGroups = groups.some((group) => group.name !== null);

  if (!hasNamedGroups) {
    return `<div class="production-steps-list" id="production-steps-list">
      <div
        class="production-step-group-body production-step-group-body--flat"
        data-group-key="${PRODUCTION_GROUP_KEY_UNGROUPED}"
      >
        ${steps.map((step) => renderProductionStep(step, allSteps)).join('')}
      </div>
    </div>`;
  }

  return `<div class="production-steps-list" id="production-steps-list">
    ${groups.map((group) => renderProductionStepGroup(group, allSteps)).join('')}
  </div>`;
}

function renderProductionStep(step, allSteps = []) {
  const item = step.item;
  const schema = step.schema;
  const scaledInputs = step.scaled_inputs ?? [];
  const scaledOutputs = step.scaled_outputs ?? [];
  const primaryOutput = window.ProductionScale.getPrimaryOutput(schema, item);
  const outputUnit = primaryOutput?.is_fluid ? 'm³/min' : '/min';

  const img = item?.image
    ? `<img class="production-step-image" src="${escapeHtml(item.image)}" alt="" />`
    : '<span class="resource-img resource-img--placeholder production-step-image"></span>';

  const outputSliderMin = getOutputSliderMin(step);
  const outputSliderMax = getOutputSliderMax(step);
  const fractionalOutput = usesFractionalProductionOutput(step);
  const outputSliderStep = getProductionOutputSliderStep(step);
  const machinesSliderMax = getMachinesSliderMax(step);
  const isMarked = Number(step.marked) === 1;

  const outputControl = `
        <div class="production-config-grid">
          <div class="production-config-field">
            <label class="production-config-label" for="production-output-${step.id}">
              ${escapeHtml(t('production.configOutput', { unit: outputUnit }))}
            </label>
            <input
              type="${fractionalOutput ? 'text' : 'number'}"
              class="production-config-input production-output-input${fractionalOutput ? ' production-config-decimal-input' : ''}"
              id="production-output-${step.id}"
              data-step-id="${step.id}"
              min="${outputSliderMin}"
              max="${outputSliderMax}"
              ${fractionalOutput ? 'inputmode="decimal"' : 'step="1"'}
              readonly
              value="${formatOutputInputValue(step.target_output, step.overclock)}"
            />
            <input
              type="range"
              class="production-config-slider production-output-slider"
              data-step-id="${step.id}"
              min="${outputSliderMin}"
              max="${outputSliderMax}"
              step="${outputSliderStep}"
              value="${fractionalOutput ? step.target_output : Math.round(step.target_output)}"
              aria-label="${escapeHtml(t('production.adjustOutput'))}"
            />
          </div>
          <div class="production-config-oc-machines">
            <div class="production-config-field">
              <label class="production-config-label" for="production-overclock-${step.id}">
                ${escapeHtml(t('production.configOverclock'))}
              </label>
              <input
                type="number"
                class="production-config-input production-overclock-input"
                id="production-overclock-${step.id}"
                data-step-id="${step.id}"
                min="${window.ProductionScale.OVERCLOCK_MIN}"
                max="${window.ProductionScale.OVERCLOCK_MAX}"
                step="1"
                readonly
                value="${formatOverclockInputValue(step.overclock)}"
              />
              <input
                type="range"
                class="production-config-slider production-overclock-slider"
                data-step-id="${step.id}"
                min="${window.ProductionScale.OVERCLOCK_MIN}"
                max="${window.ProductionScale.OVERCLOCK_MAX}"
                step="1"
                value="${Math.round(step.overclock)}"
                aria-label="${escapeHtml(t('production.adjustOverclock'))}"
              />
            </div>
            <div class="production-config-field">
              <label class="production-config-label" for="production-machines-${step.id}">
                ${escapeHtml(t('production.configMachines'))}
              </label>
              <input
                type="number"
                class="production-config-input production-machines-input"
                id="production-machines-${step.id}"
                data-step-id="${step.id}"
                min="1"
                max="${machinesSliderMax}"
                step="1"
                readonly
                value="${formatMachineCountInput(step.machine_count)}"
              />
              <input
                type="range"
                class="production-config-slider production-machines-slider"
                data-step-id="${step.id}"
                min="1"
                max="${machinesSliderMax}"
                step="1"
                value="${Math.round(step.machine_count)}"
                aria-label="${escapeHtml(t('production.adjustMachines'))}"
              />
            </div>
          </div>
          <div class="production-config-oc-machines">
            <div class="production-config-field">
              <label class="production-config-label" for="production-power-shards-${step.id}">
                ${escapeHtml(t('production.configPowerShard'))}
              </label>
              <input
                type="text"
                class="production-config-input production-config-readonly production-power-shards"
                id="production-power-shards-${step.id}"
                readonly
                tabindex="-1"
                value="${computeTotalPowerShards(step.overclock, step.machine_count)}"
              />
            </div>
            <div class="production-config-field">
              <label class="production-config-label" for="production-power-mw-${step.id}">
                ${escapeHtml(t('production.configPowerConsumption'))}
              </label>
              <input
                type="text"
                class="production-config-input production-config-readonly production-power-mw"
                id="production-power-mw-${step.id}"
                readonly
                tabindex="-1"
                value="${formatRateWithUnit(computeStepPowerMw(step), 'MW')}"
              />
            </div>
          </div>
          <div class="production-config-field production-somersloop-field">
            <label class="production-config-label">Somersloop</label>
            ${renderSomersloopCheckboxes(step)}
          </div>
        </div>`;

  const scaledSchema = {
    ...schema,
    inputs: scaledInputs,
    outputs: scaledOutputs,
  };

  return `
    <article
      class="production-step${isMarked ? ' production-step--marked' : ''}"
      data-step-id="${step.id}"
      data-sort-order="${step.sort_order}"
    >
      <header class="production-step-header">
        <div
          class="production-step-drag-handle"
          role="button"
          tabindex="0"
              aria-label="${escapeHtml(t('production.dragReorder'))}"
        >${DRAG_ICON}</div>
        ${img}
        <div class="production-step-title">
          <div class="production-step-title-row">
            <h4>${escapeHtml(step.name)}</h4>
            ${renderProductionStepGroupSelect(step, allSteps)}
            <div class="production-step-actions">
              <label
                class="production-step-mark-btn${isMarked ? ' production-step-mark-btn--active' : ''}"
                title="${escapeHtml(t('production.highlightStepTitle'))}"
                aria-label="${escapeHtml(t('production.highlightStep'))}"
              >
                <input
                  type="checkbox"
                  class="production-step-mark-checkbox"
                  data-step-id="${step.id}"
                  ${isMarked ? 'checked' : ''}
                />
                <i class="fa-solid ${getProductionMarkIconClass(isMarked)}" aria-hidden="true"></i>
              </label>
              <button
                type="button"
                class="production-step-toggle-btn"
                data-step-id="${step.id}"
                aria-label="${escapeHtml(t('production.collapseStep'))}"
                aria-expanded="true"
                title="${escapeHtml(t('production.collapseStep'))}"
              ><i class="fa-solid fa-chevron-up" aria-hidden="true"></i></button>
              <button
                type="button"
                class="production-step-reset-btn"
                data-step-id="${step.id}"
                aria-label="${escapeHtml(t('actions.reset'))} ${escapeHtml(step.name)}"
                title="${escapeHtml(t('production.resetDefaults'))}"
              >${RESET_ICON}</button>
              <button
                type="button"
                class="production-step-delete-btn"
                data-step-id="${step.id}"
                aria-label="${escapeHtml(t('production.deleteStep', { name: step.name }))}"
              >${DELETE_ICON}</button>
            </div>
          </div>
          <p class="production-step-resource">${escapeHtml(item?.name || t('common.resource'))}</p>
        </div>
      </header>
      ${renderCraftSchema(scaledSchema, schema?.is_alternative, {
        extraContent: outputControl,
        className: 'production-step-editor',
        ioRenderOptions: productionIoRenderOptions(schema),
        buildingConfig: {
          machine_count: step.machine_count,
          overclock: step.overclock,
          base_per_min: step.base_per_min,
          target_output: step.target_output,
          output_unit: outputUnit,
          schema,
          scaled_inputs: scaledInputs,
          somersloop_mask: step.somersloop_mask,
          power_consumption: schema?.power_consumption,
        },
        hideSchemaHeader: true,
        inputItemRenderer: (io) =>
          renderProductionInputWithLinks(step, io, productionIoRenderOptions(schema), allSteps),
        outputItemRenderer: (io) =>
          renderProductionOutputWithLinks(step, io, productionIoRenderOptions(schema), allSteps),
      })}
    </article>`;
}

async function handleStepMarkedChange(stepId, marked) {
  const stepEl = getProductionStepElement(stepId);
  try {
    activeProductionDetail = await window.satisfactory.setProductionStepMarked(stepId, marked);
    const step = activeProductionDetail?.steps?.find((item) => Number(item.id) === Number(stepId));
    if (step) step.marked = marked ? 1 : 0;
    if (stepEl) {
      stepEl.classList.toggle('production-step--marked', marked);
      syncProductionMarkButton(
        stepEl.querySelector('.production-step-mark-btn'),
        marked,
        'production-step-mark-btn--active'
      );
    }

    const graphNode = productionDetailBody.querySelector(
      `.production-graph-node--step[data-node-id="step-${stepId}"]`
    );
    if (graphNode) {
      graphNode.classList.toggle('production-graph-node--marked', marked);
      syncProductionMarkButton(
        graphNode.querySelector('.production-graph-step-mark-btn'),
        marked,
        'production-graph-step-mark-btn--active'
      );
      const graphCheckbox = graphNode.querySelector('.production-graph-step-mark-checkbox');
      if (graphCheckbox) graphCheckbox.checked = marked;
    }

    const groupKey = getProductionGroupKey(step?.group_name);
    if (groupKey !== PRODUCTION_GROUP_KEY_UNGROUPED) {
      const groupEl = productionDetailBody.querySelector(
        `.production-step-group[data-group-key="${CSS.escape(groupKey)}"]`
      );
      const groupMarked = Number(activeProductionDetail?.group_marks?.[groupKey]) === 1;
      groupEl?.classList.toggle('production-step-group--marked', groupMarked);
      syncProductionMarkButton(
        groupEl?.querySelector('.production-step-group-mark-btn'),
        groupMarked,
        'production-step-group-mark-btn--active'
      );
      const groupCheckbox = groupEl?.querySelector('.production-step-group-mark-checkbox');
      if (groupCheckbox) groupCheckbox.checked = groupMarked;
    }
  } catch (err) {
    console.error('Set step marked error:', err);
    const checkbox = stepEl?.querySelector('.production-step-mark-checkbox');
    if (checkbox) checkbox.checked = !marked;
    const graphCheckbox = productionDetailBody.querySelector(
      `.production-graph-step-mark-checkbox[data-step-id="${stepId}"]`
    );
    if (graphCheckbox) graphCheckbox.checked = !marked;
  }
}

async function handleProductionGroupMarkedChange(groupKey, marked) {
  if (!activeProductionChainId || groupKey === PRODUCTION_GROUP_KEY_UNGROUPED) return;

  const groupEl = productionDetailBody.querySelector(
    `.production-step-group[data-group-key="${CSS.escape(groupKey)}"]`
  );
  const checkbox = groupEl?.querySelector('.production-step-group-mark-checkbox');

  try {
    activeProductionDetail = await window.satisfactory.setProductionGroupMarked(
      activeProductionChainId,
      groupKey,
      marked
    );
    renderProductionDetailContent(activeProductionDetail);
  } catch (err) {
    console.error('Set group marked error:', err);
    if (checkbox) checkbox.checked = !marked;
  }
}

function scheduleStepConfigSave(stepId, config) {
  clearTimeout(stepOutputDebounce.get(stepId));
  stepOutputDebounce.set(
    stepId,
    setTimeout(async () => {
      try {
        await window.satisfactory.updateProductionChainStep(stepId, {
          target_output: config.target_output,
          machine_count: config.machine_count,
          overclock: config.overclock,
          somersloop_mask: config.somersloop_mask ?? 0,
        });
      } catch (err) {
        console.error('Update step config error:', err);
      }
    }, 400)
  );
}

function updateStepIoDisplay(stepEl, scaled, schema, step, allSteps) {
  const inputsEl = stepEl.querySelector('.craft-io-col--inputs .craft-io-list');
  const outputsEl = stepEl.querySelector('.craft-io-col--outputs .craft-io-list');
  const ioOptions = productionIoRenderOptions(schema);
  if (inputsEl) {
    inputsEl.innerHTML =
      scaled.inputs
        .map((io) => renderProductionInputWithLinks(step, io, ioOptions, allSteps))
        .join('') || '<p class="detail-empty">—</p>';
  }
  if (outputsEl) {
    outputsEl.innerHTML =
      scaled.outputs
        .map((io) => renderProductionOutputWithLinks(step, io, ioOptions, allSteps))
        .join('') || '<p class="detail-empty">—</p>';
  }
}

function updateStepConfigInputs(stepEl, config, step) {
  const outputInput = stepEl.querySelector('.production-output-input');
  const overclockInput = stepEl.querySelector('.production-overclock-input');
  const machinesInput = stepEl.querySelector('.production-machines-input');
  const outputSlider = stepEl.querySelector('.production-output-slider');
  const overclockSlider = stepEl.querySelector('.production-overclock-slider');
  const machinesSlider = stepEl.querySelector('.production-machines-slider');
  const configEl = stepEl.querySelector('.craft-building-config');

  if (outputInput) {
    const fractional = step ? usesFractionalProductionOutput(step) : false;
    outputInput.step = fractional ? '0.001' : '1';
    outputInput.value = formatOutputInputValue(config.target_output, config.overclock);
    if (step) {
      outputInput.min = String(getOutputSliderMin(step));
      outputInput.max = String(getOutputSliderMax(step));
    }
    rememberConfigInputValue(outputInput);
  }
  if (overclockInput) {
    overclockInput.value = formatOverclockInputValue(config.overclock);
    rememberConfigInputValue(overclockInput);
  }
  if (machinesInput) {
    const roundedMachines = Math.max(1, Math.round(config.machine_count));
    machinesInput.max = String(getMachinesSliderMax(step ?? {}, roundedMachines));
    machinesInput.value = formatMachineCountInput(config.machine_count);
    rememberConfigInputValue(machinesInput);
  }

  if (outputSlider && step) {
    const fractional = usesFractionalProductionOutput(step);
    const stepSize = getProductionOutputSliderStep(step);
    const minOutput = getOutputSliderMin(step);
    const maxOutput = getOutputSliderMax(step);
    outputSlider.min = String(minOutput);
    outputSlider.max = String(maxOutput);
    outputSlider.step = String(stepSize);
    const value = fractional
      ? window.ProductionScale.roundProduction(config.target_output)
      : Math.round(config.target_output);
    outputSlider.value = String(Math.min(Math.max(value, minOutput), maxOutput));
  }
  if (overclockSlider) {
    overclockSlider.value = String(Math.round(config.overclock));
  }
  if (machinesSlider) {
    const rounded = Math.max(1, Math.round(config.machine_count));
    machinesSlider.max = String(getMachinesSliderMax(step ?? {}, config.machine_count));
    machinesSlider.value = String(rounded);
  }

  if (configEl) {
    const unit = step?.schema
      ? window.ProductionScale.getPrimaryOutput(step.schema, step.item)?.is_fluid
        ? 'm³/min'
        : '/min'
      : '/min';
    configEl.innerHTML = formatBuildingConfigContent(
      {
        machine_count: config.machine_count,
        overclock: config.overclock,
        target_output: config.target_output,
        output_unit: unit,
      },
      unit
    );
  }

  const powerShardsInput = stepEl.querySelector('.production-power-shards');
  if (powerShardsInput) {
    powerShardsInput.value = String(computeTotalPowerShards(config.overclock, config.machine_count));
  }

  const powerMwInput = stepEl.querySelector('.production-power-mw');
  if (powerMwInput && step) {
    powerMwInput.value = formatRateWithUnit(
      computeStepPowerMw({
        ...step,
        overclock: config.overclock,
        machine_count: config.machine_count,
        somersloop_mask: config.somersloop_mask ?? step.somersloop_mask,
      }),
      'MW'
    );
  }

  const baseHintEl = stepEl.querySelector('.craft-building-base');
  if (baseHintEl && step?.schema) {
    const primary = window.ProductionScale.getPrimaryOutput(step.schema, step.item);
    const unit = primary?.is_fluid ? 'm³/min' : '/min';
    baseHintEl.textContent = `${t('common.base')}: ${formatRateWithUnit(config.base_per_min, unit)}`;
  }

  const inputsPanelEl = stepEl.querySelector('.craft-building-inputs-panel');
  if (inputsPanelEl && step?.schema) {
    inputsPanelEl.innerHTML = renderBuildingInputsContent({
      schema: step.schema,
      scaled_inputs: step.scaled_inputs,
      machine_count: config.machine_count,
    });
  }

  const buildingAside = stepEl.querySelector('.craft-schema-building');
  if (buildingAside) {
    updateBuildingPowerShardsEl(buildingAside, {
      overclock: config.overclock,
      machine_count: config.machine_count,
      power_consumption: getStepPowerBaseMw(step),
      somersloop_mask: config.somersloop_mask ?? step?.somersloop_mask,
      schema: step?.schema,
    });
  }

  const totalOutputEl = stepEl.querySelector('.craft-building-total-output');
  if (totalOutputEl && config.target_output != null) {
    const unit = step?.schema
      ? window.ProductionScale.getPrimaryOutput(step.schema, step.item)?.is_fluid
        ? 'm³/min'
        : '/min'
      : '/min';
    totalOutputEl.textContent = formatRateWithUnit(config.target_output, unit);
  }

  lockConfigNumberInputsIn(stepEl, { skipFocused: true });
  lockConfigSlidersIn(stepEl, { skipFocused: true });
}

function lockConfigNumberInput(input) {
  if (!input || !getConfigInputField(input)) return;
  bindConfigInputKeydown(input);
  input.setAttribute('readonly', '');
}

function activateConfigNumberInput(input) {
  if (!input || !getConfigInputField(input)) return;
  bindConfigInputKeydown(input);
  const wasLocked = input.hasAttribute('readonly');
  input.removeAttribute('readonly');
  if (wasLocked) {
    input.select();
  }
}

function lockConfigNumberInputsIn(container, { skipFocused = false } = {}) {
  if (!container) return;
  container
    .querySelectorAll(
      '.production-config-input[type="number"], .production-config-input.production-config-decimal-input'
    )
    .forEach((input) => {
      bindConfigInputKeydown(input);
      if (skipFocused && document.activeElement === input) return;
      lockConfigNumberInput(input);
    });
}

function getEditableConfigInput(target) {
  const input = target?.closest?.('.production-config-input');
  if (!input || input.classList.contains('production-config-readonly')) return null;
  return getConfigInputField(input) ? input : null;
}

function resolveConfigNumberInput(target) {
  const input = target?.closest?.('.production-config-input');
  if (!(input instanceof HTMLInputElement)) return null;
  if (input.classList.contains('production-config-readonly')) return null;
  if (input.type !== 'number' && !input.classList.contains('production-config-decimal-input')) return null;
  return getConfigInputField(input) ? input : null;
}

function bindConfigInputKeydown(input) {
  if (!input || input.dataset.configKeydownBound === '1') return;
  const field = getConfigInputField(input);
  if (!field || field.startsWith('energy-')) return;
  input.dataset.configKeydownBound = '1';
  input.addEventListener('keydown', handleConfigInputKeydown);
}

function getConfigInputNudgeMax(input, field, candidateValue) {
  if (field === 'machines' && input.dataset.stepId) {
    const step = activeProductionDetail?.steps?.find(
      (item) => item.id === Number(input.dataset.stepId)
    );
    return getMachinesSliderMax(step ?? {}, candidateValue);
  }
  if (field === 'extraction-nodes' && input.dataset.extractionId) {
    const extraction = activeProductionDetail?.extractions?.find(
      (item) => item.id === Number(input.dataset.extractionId)
    );
    return getNodesSliderMax(candidateValue, extraction);
  }
  if (field === 'energy-machines') {
    const fromValue = Math.round(Number(candidateValue) || 1);
    return Math.max(getConfiguredMaxEnergyGenerators(), fromValue, 1);
  }
  const max = Number(input.max);
  return Number.isFinite(max) ? max : null;
}

function isConfigSlider(slider) {
  return (
    slider?.classList?.contains('production-config-slider') &&
    (slider.dataset.stepId != null ||
      slider.dataset.extractionId != null ||
      slider.dataset.generatorId != null)
  );
}

function isConfigSliderLocked(slider) {
  return slider?.dataset.configSliderLocked === 'true';
}

function lockConfigSlider(slider) {
  if (!isConfigSlider(slider)) return;
  slider.dataset.configSliderLocked = 'true';
  slider.dataset.configSliderLockedValue = slider.value;
}

function activateConfigSlider(slider) {
  if (!isConfigSlider(slider)) return;
  delete slider.dataset.configSliderLocked;
  delete slider.dataset.configSliderLockedValue;
}

function deactivateConfigSlider(slider) {
  if (!isConfigSlider(slider) || isConfigSliderLocked(slider)) return;
  lockConfigSlider(slider);
  if (document.activeElement === slider) slider.blur();
}

function isPointerOverElement(el, clientX, clientY) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return (
    clientX >= rect.left &&
    clientX <= rect.right &&
    clientY >= rect.top &&
    clientY <= rect.bottom
  );
}

function lockActiveConfigSlidersOutsidePointer(clientX, clientY, container = productionDetailBody) {
  if (!container) return;
  container.querySelectorAll('.production-config-slider').forEach((slider) => {
    if (isConfigSliderLocked(slider)) return;
    const field = slider.closest('.production-config-field');
    const hoverTarget = field || slider;
    if (!isPointerOverElement(hoverTarget, clientX, clientY)) {
      deactivateConfigSlider(slider);
    }
  });
}

function lockConfigSlidersIn(container, { skipFocused = false } = {}) {
  if (!container) return;
  container.querySelectorAll('.production-config-slider').forEach((slider) => {
    if (skipFocused && document.activeElement === slider) return;
    lockConfigSlider(slider);
  });
}

function guardConfigSliderInput(slider, callback) {
  if (isConfigSliderLocked(slider)) {
    const lockedValue = slider.dataset.configSliderLockedValue;
    if (lockedValue != null) slider.value = lockedValue;
    return;
  }
  callback();
}

function snapProductionSliderValue(slider) {
  const min = Number(slider.min);
  const max = Number(slider.max);
  const step = Number(slider.step) || 1;
  const fractional = step < 1;
  let value = Number(slider.value);
  if (!Number.isFinite(value)) return null;
  if (fractional) {
    value = window.ProductionScale.roundProduction(value);
  } else {
    value = Math.round(value);
  }
  if (Number.isFinite(min)) value = Math.max(min, value);
  if (Number.isFinite(max)) value = Math.min(max, value);
  slider.value = String(value);
  return value;
}

function getConfigInputField(input) {
  if (input.classList.contains('production-output-input')) return 'output';
  if (input.classList.contains('production-extraction-output-input')) return 'extraction-output';
  if (input.classList.contains('production-overclock-input')) return 'overclock';
  if (input.classList.contains('production-machines-input')) return 'machines';
  if (input.classList.contains('production-extraction-overclock-input')) return 'extraction-overclock';
  if (input.classList.contains('production-extraction-nodes-input')) return 'extraction-nodes';
  if (input.classList.contains('production-io-rate-input')) return 'io-rate';
  if (input.classList.contains('energy-generator-fuel-input')) return 'energy-fuel';
  if (input.classList.contains('energy-generator-overclock-input')) return 'energy-overclock';
  if (input.classList.contains('energy-generator-machines-input')) return 'energy-machines';
  return null;
}

function rememberConfigInputValue(input) {
  if (!input || !getConfigInputField(input)) return;
  input.dataset.configInputPrev = input.value;
}

function applyConfigInputNudge(input, field, delta, commit = commitConfigInputChange) {
  const min = Number(input.min);
  const stepSize = Number(input.step) || 1;
  let value;
  let formatted;

  if (field === 'overclock' || field === 'extraction-overclock' || field === 'energy-overclock') {
    value = window.ProductionScale.clampOverclock((Number(input.value) || 0) + delta * stepSize);
    const max = getConfigInputNudgeMax(input, field, value);
    if (max != null) value = Math.min(max, value);
    formatted = formatOverclockInputValue(value);
  } else if (field === 'output' || field === 'extraction-output' || field === 'energy-fuel' || field === 'io-rate') {
    const fractionalOutput =
      (field === 'output' || field === 'extraction-output' || field === 'io-rate') &&
      input.classList.contains('production-config-decimal-input');
    const nudgeStep =
      field === 'output' || field === 'extraction-output' || field === 'io-rate'
        ? fractionalOutput
          ? 0.001
          : 1
        : stepSize;
    value = (Number(parseConfigNumberInput(input.value)) || Number(input.value) || 0) + delta * nudgeStep;
    if (!Number.isFinite(value)) value = Math.max(1, delta > 0 ? 1 : 0);
    if (field === 'output' || field === 'extraction-output' || field === 'io-rate') {
      value = fractionalOutput
        ? window.ProductionScale.roundProduction(value)
        : Math.round(value);
    }
    if (Number.isFinite(min)) value = Math.max(min, value);
    const max = getConfigInputNudgeMax(input, field, value);
    if (max != null) value = Math.min(max, value);
    formatted =
      field === 'output' || field === 'io-rate'
        ? formatOutputInputValue(value)
        : field === 'extraction-output'
          ? formatExtractionOutputInputValue(value, getExtractionOverclockForConfigInput(input))
          : String(value);
  } else {
    value = Math.round(Number(input.value) || 0) + delta;
    if (!Number.isFinite(value)) value = 1;
    if (Number.isFinite(min)) value = Math.max(min, value);
    const max = getConfigInputNudgeMax(input, field, value);
    if (max != null) value = Math.min(max, value);
    if (field === 'machines' || field === 'extraction-nodes' || field === 'energy-machines') {
      value = Math.max(1, Math.round(value));
      formatted = formatMachineCountInput(value);
      if (max != null) input.max = String(max);
    } else {
      formatted = String(value);
    }
  }

  input.value = formatted;
  input.dataset.configInputPrev = formatted;
  commit(input, field, value);
}

function commitConfigInputFromField(input, field) {
  if (!input || !field) return;

  if (field === 'io-rate') {
    handleStepIoRateChange(
      Number(input.dataset.stepId),
      input.dataset.ioKind,
      input.dataset.itemSlug,
      parseConfigNumberInput(input.value)
    );
    return;
  }
  if (field === 'output' || field === 'machines') {
    handleStepConfigChange(
      Number(input.dataset.stepId),
      field,
      field === 'output' ? parseConfigNumberInput(input.value) : input.value
    );
    return;
  }
  if (field === 'overclock') {
    handleStepConfigChange(Number(input.dataset.stepId), 'overclock', input.value);
    return;
  }
  if (field === 'extraction-output') {
    handleExtractionConfigChange(
      Number(input.dataset.extractionId),
      'output',
      parseConfigNumberInput(input.value)
    );
    return;
  }
  if (field === 'extraction-overclock') {
    handleExtractionConfigChange(Number(input.dataset.extractionId), 'overclock', input.value);
    return;
  }
  if (field === 'extraction-nodes') {
    handleExtractionConfigChange(Number(input.dataset.extractionId), 'nodes', input.value);
  }
}

function commitConfigInputChange(input, field, value) {
  if (field === 'io-rate') {
    handleStepIoRateChange(
      Number(input.dataset.stepId),
      input.dataset.ioKind,
      input.dataset.itemSlug,
      value
    );
    return;
  }
  if (field === 'output' || field === 'machines') {
    handleStepConfigChange(Number(input.dataset.stepId), field, value);
    return;
  }
  if (field === 'overclock') {
    handleStepConfigChange(Number(input.dataset.stepId), 'overclock-slider', value);
    return;
  }
  if (field === 'extraction-output') {
    handleExtractionConfigChange(Number(input.dataset.extractionId), 'output', value);
    return;
  }
  if (field === 'extraction-overclock') {
    handleExtractionConfigChange(Number(input.dataset.extractionId), 'overclock-slider', value);
    return;
  }
  if (field === 'extraction-nodes') {
    handleExtractionConfigChange(Number(input.dataset.extractionId), 'nodes', value);
  }
}

function normalizeConfigInputSpinnerStep(input, event, commit = commitConfigInputChange) {
  const field = getConfigInputField(input);
  if (!field) return false;
  if (event?.inputType !== 'increment' && event?.inputType !== 'decrement') return false;

  const direction = event.inputType === 'increment' ? 1 : -1;
  applyConfigInputNudge(input, field, direction, commit);
  return true;
}

function nudgeConfigNumberInput(input, delta) {
  const field = getConfigInputField(input);
  if (!field) return;
  applyConfigInputNudge(input, field, delta);
}

function handleConfigInputKeydown(e) {
  const input = resolveConfigNumberInput(e.target);
  const field = input ? getConfigInputField(input) : null;
  if (!field) return;

  if (e.key === 'Enter') {
    e.preventDefault();
    commitConfigInputFromField(input, field);
    rememberConfigInputValue(input);
    input.blur();
    return;
  }

  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  e.preventDefault();
  nudgeConfigNumberInput(input, ['ArrowUp', 'ArrowRight'].includes(e.key) ? 1 : -1);
}

function handleProductionSliderInput(slider, field) {
  const value = snapProductionSliderValue(slider);
  if (value == null) return;
  if (field === 'overclock') {
    handleStepConfigChange(Number(slider.dataset.stepId), 'overclock-slider', value);
    return;
  }
  handleStepConfigChange(Number(slider.dataset.stepId), field, value);
}

function nudgeProductionSlider(slider, delta) {
  const current = snapProductionSliderValue(slider);
  if (current == null) return;
  const min = Number(slider.min);
  const max = Number(slider.max);
  const step = Number(slider.step) || 1;
  const fractional = step < 1;
  let next = current + delta * step;
  if (fractional) {
    next = window.ProductionScale.roundProduction(next);
  } else {
    next = Math.round(next);
  }
  next = Math.min(Number.isFinite(max) ? max : next, Math.max(Number.isFinite(min) ? min : step, next));
  if (next === current) return;
  slider.value = String(next);
  slider.dispatchEvent(new Event('input', { bubbles: true }));
}

function handleSomersloopChange(stepId) {
  const step = activeProductionDetail?.steps.find((item) => item.id === stepId);
  if (!step?.schema) return;

  const stepEl = getProductionStepElement(stepId);
  if (!stepEl) return;

  const slots = window.ProductionScale.getSomersloopSlots(step.schema);
  if (!slots) return;

  let mask = 0;
  stepEl.querySelectorAll('.production-somersloop-checkbox').forEach((checkbox) => {
    if (checkbox.checked) {
      mask |= 1 << Number(checkbox.dataset.slot);
    }
  });

  handleStepConfigChange(stepId, 'somersloop', mask);
}

function handleStepConfigChange(stepId, field, rawValue) {
  const step = activeProductionDetail?.steps.find((item) => item.id === stepId);
  if (!step?.schema) return;

  const updated = window.ProductionScale.applyStepChange(
    step.schema,
    step.item,
    {
      target_output: step.target_output,
      machine_count: step.machine_count,
      overclock: step.overclock,
      somersloop_mask: step.somersloop_mask ?? 0,
    },
    field,
    rawValue
  );
  if (!updated) return;

  const scaled = window.ProductionScale.scaleSchema(
    step.schema,
    step.item,
    updated.target_output,
    updated.somersloop_mask,
    updated.overclock
  );
  step.base_per_min = updated.base_per_min;
  step.target_output = updated.target_output;
  step.machine_count = updated.machine_count;
  step.overclock = updated.overclock;
  step.somersloop_mask = updated.somersloop_mask;
  step.scaled_inputs = scaled.inputs;
  step.scaled_outputs = scaled.outputs;

  const stepEl = getProductionStepElement(stepId);
  if (!stepEl) return;

  syncChainResourceBalanceCache();
  updateStepIoDisplay(stepEl, scaled, step.schema, step, activeProductionDetail?.steps ?? []);
  updateStepConfigInputs(stepEl, updated, step);
  refreshRelatedStepIoDisplays(stepId);
  updateProductionDetailExternalSummary();
  scheduleStepConfigSave(stepId, updated);
}

function handleStepIoRateChange(stepId, kind, itemSlug, ratePerMin) {
  const step = activeProductionDetail?.steps?.find((item) => item.id === stepId);
  if (!step?.schema) return;

  const target = window.ProductionScale.computeTargetOutputFromIoRate(
    step.schema,
    step.item,
    kind,
    itemSlug,
    ratePerMin,
    step.somersloop_mask ?? 0
  );
  if (target == null || !Number.isFinite(target) || target <= 0) return;

  handleStepConfigChange(stepId, 'output', target);
}

async function resetProductionStep(stepId) {
  const step = activeProductionDetail?.steps.find((item) => item.id === stepId);
  if (!step) return;

  clearTimeout(stepOutputDebounce.get(stepId));
  stepOutputDebounce.delete(stepId);

  try {
    activeProductionDetail = await window.satisfactory.resetProductionChainStep(stepId);
    renderProductionDetailContent(activeProductionDetail);
  } catch (err) {
    console.error('Reset step error:', err);
  }
}

async function deleteProductionStep(stepId) {
  const step = activeProductionDetail?.steps.find((item) => item.id === stepId);
  if (!step) return;

  const confirmed = await showConfirm({
    title: t('confirm.deleteResourceStepTitle'),
    message: t('confirm.deleteResourceStepMessage', { name: step.name }),
    confirmLabel: t('actions.delete'),
  });
  if (!confirmed) return;

  try {
    await window.satisfactory.deleteProductionChainStep(stepId);
    const normalizedStepId = normalizeProductionStepId(stepId);
    if (normalizedStepId) productionStepViewStates.delete(normalizedStepId);
    persistProductionUiState();
    await refreshProductionDetail();
  } catch (err) {
    console.error('Delete production step error:', err);
  }
}

function toDataAttributeName(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

function renderThemeSelect({ id, options, selectedValue, dataset = {} }) {
  const selectedOption = options.find((option) => option.value === selectedValue);
  const selectedLabel = selectedOption?.label ?? selectedValue;
  const datasetAttrs = Object.entries(dataset)
    .map(([key, value]) => `data-${toDataAttributeName(key)}="${escapeHtml(String(value))}"`)
    .join(' ');

  return `
    <div class="theme-select" ${datasetAttrs}>
      <button
        type="button"
        class="theme-select-trigger production-config-input"
        id="${id}"
        aria-haspopup="listbox"
        aria-expanded="false"
      >
        <span class="theme-select-value">${escapeHtml(selectedLabel)}</span>
        <span class="theme-select-chevron" aria-hidden="true"></span>
      </button>
      <ul class="theme-select-menu hidden" role="listbox" aria-labelledby="${id}">
        ${options
          .map(
            (option) => `
          <li
            role="option"
            class="theme-select-option ${option.value === selectedValue ? 'theme-select-option--active' : ''}"
            data-value="${escapeHtml(option.value)}"
            aria-selected="${option.value === selectedValue ? 'true' : 'false'}"
          >${escapeHtml(option.label)}</li>`
          )
          .join('')}
      </ul>
    </div>`;
}

function closeAllThemeSelects() {
  document.querySelectorAll('.theme-select').forEach((select) => {
    const menu = select.querySelector('.theme-select-menu');
    const trigger = select.querySelector('.theme-select-trigger');
    menu?.classList.add('hidden');
    trigger?.setAttribute('aria-expanded', 'false');
    select.closest('.production-config-field--select')?.classList.remove('theme-select-field--open');
    select.closest('.production-step-group-select')?.classList.remove('production-step-group-select--open');
  });
}

function handleThemeSelectOutsidePointer(e) {
  if (!document.querySelector('.theme-select-menu:not(.hidden)')) return;
  if (e.target.closest('.theme-select')) return;
  closeAllThemeSelects();
}

function toggleThemeSelect(themeSelect) {
  const menu = themeSelect.querySelector('.theme-select-menu');
  const trigger = themeSelect.querySelector('.theme-select-trigger');
  if (!menu || !trigger) return;

  const isOpen = !menu.classList.contains('hidden');
  closeAllThemeSelects();
  if (!isOpen) {
    menu.classList.remove('hidden');
    trigger.setAttribute('aria-expanded', 'true');
    themeSelect.closest('.production-config-field--select')?.classList.add('theme-select-field--open');
    themeSelect.closest('.production-step-group-select')?.classList.add('production-step-group-select--open');
  }
}

