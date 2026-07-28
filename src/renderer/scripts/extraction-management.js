function formatExtractionBuildingConfigContent(extraction, outputUnit) {
  const nodeCount = extraction.node_count ?? 1;
  const basePerNode =
    extraction.base_per_node ??
    window.ExtractionScale.getBaseExtractionPerNode(
      extraction.miner_slug,
      extraction.purity,
      extraction.item
    );
  const perNode = window.ExtractionScale.computeExtractionTargetOutput(
    basePerNode,
    1,
    extraction.overclock
  );
  return `<strong>${escapeHtml(formatRateWithUnit(perNode, outputUnit))}</strong> ${formatMachineCountLabel(nodeCount)}× @ ${formatOverclockLabel(extraction.overclock)}%`;
}

function getExtractionDisplayName(extraction, allExtractions = []) {
  const baseName = extraction.item?.name || t('common.mineral');
  const sameMineral = allExtractions
    .filter((item) => item.item_id === extraction.item_id)
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

  if (sameMineral.length <= 1) return baseName;

  const index = sameMineral.findIndex((item) => item.id === extraction.id);
  return index >= 0 ? `${baseName} #${index + 1}` : baseName;
}

function buildExtractionLinkUi(extraction, allExtractions, allSteps) {
  const itemSlug = extraction.item?.slug ?? null;
  const outputUnit = getExtractionOutputUnit(extraction.item, getExtractionKind(extraction));
  const outputRate = extraction.output_rate ?? extraction.target_output ?? 0;

  const linkedConsumers =
    itemSlug && isExternalSummarySlug(itemSlug)
      ? getLinkedConsumersForExtraction(extraction, allSteps)
      : [];
  const consumerCandidates =
    itemSlug && isExternalSummarySlug(itemSlug)
      ? getExtractionConsumerCandidates(extraction, allSteps)
      : [];
  const totalLinkedNeed =
    itemSlug && isExternalSummarySlug(itemSlug)
      ? getTotalLinkedConsumerDemand(extraction, itemSlug, allSteps)
      : 0;
  const linkedShortfall = normalizeLinkDelta(totalLinkedNeed - outputRate, totalLinkedNeed);
  const unlinkedExcess = normalizeLinkDelta(outputRate - totalLinkedNeed, outputRate);
  const hasLinkedConsumers = linkedConsumers.length > 0;
  const showLinkVisual =
    Boolean(itemSlug && isExternalSummarySlug(itemSlug)) && outputRate > LINK_BALANCE_TOLERANCE;
  const linkState = showLinkVisual
    ? hasLinkedConsumers
      ? getLinkBalanceState(outputRate, totalLinkedNeed)
      : 'excess'
    : null;
  const linkStateClass = getExtractionLinkStateClass(
    linkState,
    showLinkVisual && (hasLinkedConsumers || unlinkedExcess > LINK_BALANCE_TOLERANCE)
  );

  const linkedStatusMessage =
    linkState === 'balanced'
      ? `<span class="production-link-covered">${escapeHtml(t('production.linkFullyUsed'))}</span>`
      : linkState === 'excess' && unlinkedExcess > LINK_BALANCE_TOLERANCE
        ? `<span class="production-link-external">${escapeHtml(t('production.linkExcess', { rate: formatRateWithUnit(unlinkedExcess, outputUnit) }))}</span>`
        : linkState === 'deficit' && linkedShortfall > LINK_BALANCE_TOLERANCE
          ? `<span class="production-link-deficit">${escapeHtml(t('production.linkMissingForLinked', { rate: formatRateWithUnit(linkedShortfall, outputUnit) }))}</span>`
          : '';

  const html =
    linkedConsumers.length > 0 || consumerCandidates.length > 0 || linkedStatusMessage
      ? `<div class="production-extraction-links">
          ${
            linkedConsumers.length > 0 || linkedStatusMessage
              ? `<div class="production-extraction-linked">
                  ${linkedConsumers
                    .map((consumer) => {
                      const partial =
                        consumer.required_rate > LINK_BALANCE_TOLERANCE &&
                        consumer.allocated_rate + LINK_BALANCE_TOLERANCE < consumer.required_rate;
                      return `<span class="production-link-badge production-link-badge--consumer${
                        partial ? ' production-link-badge--partial' : ''
                      }">→ ${escapeHtml(consumer.consumer_name)} (${formatLinkedConsumerBadgeRate(consumer, outputUnit)})</span>`;
                    })
                    .join('')}
                  ${linkedStatusMessage}
                </div>`
              : ''
          }
          ${
            consumerCandidates.length > 0
              ? `<div class="production-input-links">
                  <span class="production-input-links-label">${escapeHtml(t('production.linkToStep'))}</span>
                  <div class="production-link-options">
                    ${consumerCandidates
                      .map((consumer) => {
                        const checked = isExtractionLinkedToConsumer(
                          consumer,
                          extraction.id,
                          itemSlug
                        );
                        const rateLabel = formatExtractionConsumerLinkOptionRate(
                          consumer,
                          extraction,
                          itemSlug,
                          allSteps,
                          outputUnit
                        );
                        return `
                          <label class="production-link-option">
                            <input
                              type="checkbox"
                              class="production-extraction-consumer-link-checkbox"
                              data-consumer-step-id="${consumer.id}"
                              data-extraction-id="${extraction.id}"
                              data-item-slug="${itemSlug}"
                              ${checked ? 'checked' : ''}
                            />
                            <span>${escapeHtml(consumer.name)}</span>
                            <span class="production-link-rate">(${rateLabel})</span>
                          </label>`;
                      })
                      .join('')}
                  </div>
                </div>`
              : ''
          }
        </div>`
      : '';

  return { linkStateClass, html };
}

function updateExtractionLinkDisplay(extractionEl, extraction, allExtractions, allSteps) {
  const { linkStateClass, html } = buildExtractionLinkUi(extraction, allExtractions, allSteps);

  extractionEl.classList.remove(
    'production-extraction--linked-full',
    'production-extraction--linked-partial',
    'production-extraction--linked-deficit'
  );
  if (linkStateClass) {
    extractionEl.classList.add(linkStateClass);
  }

  const existingLinksEl = extractionEl.querySelector('.production-extraction-links');
  if (html) {
    if (existingLinksEl) {
      existingLinksEl.outerHTML = html;
    } else {
      extractionEl.querySelector('.production-extraction-main')?.insertAdjacentHTML('beforeend', html);
    }
  } else if (existingLinksEl) {
    existingLinksEl.remove();
  }
}

function refreshAllExtractionLinkDisplays() {
  const extractions = activeProductionDetail?.extractions ?? [];
  const allSteps = activeProductionDetail?.steps ?? [];

  for (const extraction of extractions) {
    const extractionEl = productionDetailBody.querySelector(
      `[data-extraction-id="${extraction.id}"]`
    );
    if (!extractionEl) continue;
    updateExtractionLinkDisplay(extractionEl, extraction, extractions, allSteps);
  }
}

function isLiquidExtraction(extraction) {
  const kind = getExtractionKind(extraction);
  return kind === 'water' || kind === 'oil';
}

function renderProductionExtractionsList(extractions = [], allSteps = []) {
  if (!extractions.length) {
    return `<p class="detail-empty production-extractions-empty">${escapeHtml(t('production.emptyExtractions'))}</p>`;
  }

  const minerals = extractions.filter((extraction) => !isLiquidExtraction(extraction));
  const liquids = extractions.filter((extraction) => isLiquidExtraction(extraction));

  const renderGroup = (items, title, groupKey) => {
    if (!items.length) return '';

    return `
      <div class="production-extraction-group" data-extraction-group="${groupKey}">
        <h4 class="production-extraction-group-header">${escapeHtml(title)}</h4>
        <div class="production-extractions-list">
          ${items
            .map((extraction) => renderProductionExtraction(extraction, extractions, allSteps))
            .join('')}
        </div>
      </div>`;
  };

  return `<div class="production-extractions-groups">
    ${renderGroup(minerals, t('production.groupMinerals'), 'minerals')}
    ${renderGroup(liquids, t('production.groupLiquids'), 'liquids')}
  </div>`;
}

function renderProductionExtraction(extraction, allExtractions = [], allSteps = []) {
  const displayName = getExtractionDisplayName(extraction, allExtractions);
  const item = extraction.item;
  const kind = getExtractionKind(extraction);
  const itemSlug = item?.slug ?? null;
  const outputUnit = getExtractionOutputUnit(item, kind);
  const nodeCount = extraction.node_count ?? 1;
  const nodesSliderMax = getNodesSliderMax(nodeCount, extraction);
  const targetOutput =
    extraction.target_output ??
    extraction.output_rate ??
    computeClientExtractionRate(
      extraction.miner_slug,
      extraction.purity,
      extraction.overclock,
      nodeCount,
      itemSlug
    );
  const outputSliderMax = getExtractionOutputSliderMax(extraction);
  const outputSliderMin = getExtractionOutputSliderMin(extraction);
  const outputSliderStep = getExtractionOutputSliderStep(extraction);
  const fractionalExtractionOutput = usesFractionalExtractionOutput(extraction);
  const outputRate = extraction.output_rate ?? targetOutput;
  const outputDisplayValue = formatExtractionOutputInputValue(targetOutput, extraction.overclock);
  const img = item?.image
    ? `<img class="production-extraction-image" src="${escapeHtml(item.image)}" alt="" />`
    : '<span class="resource-img resource-img--placeholder production-extraction-image"></span>';

  const buildingImg = extraction.building_image
    ? `<img src="${escapeHtml(extraction.building_image)}" alt="" />`
    : '<span class="resource-img resource-img--placeholder"></span>';

  const defaultBuildingName =
    kind === 'oil'
      ? t('energy.defaultOilExtractor')
      : kind === 'water'
        ? t('energy.defaultWaterExtractor')
        : t('energy.defaultMiner');

  const minerField =
    kind === 'mineral'
      ? `
            <div class="production-config-field production-config-field--select">
              <span class="production-config-label">${escapeHtml(t('production.configMiner'))}</span>
              ${renderThemeSelect({
                id: `production-extraction-miner-${extraction.id}`,
                options: MINER_OPTIONS.map((miner) => ({ value: miner.slug, label: miner.label })),
                selectedValue: extraction.miner_slug,
                dataset: { extractionId: extraction.id, field: 'miner' },
              })}
            </div>`
      : '';

  const purityField =
    kind !== 'water'
      ? `
            <div class="production-config-field production-config-field--select">
              <span class="production-config-label">${escapeHtml(t('production.configPurity'))}</span>
              ${renderThemeSelect({
                id: `production-extraction-purity-${extraction.id}`,
                options: PURITY_OPTIONS.map((purity) => ({
                  value: purity.value,
                  label: purity.label,
                })),
                selectedValue: extraction.purity,
                dataset: { extractionId: extraction.id, field: 'purity' },
              })}
            </div>`
      : '';

  const nodesLabel = kind === 'water' ? t('production.configExtractors') : t('production.configNodes');

  const { linkStateClass, html: linkedConsumersSection } = buildExtractionLinkUi(
    extraction,
    allExtractions,
    allSteps
  );

  return `
    <article class="production-extraction ${linkStateClass}" data-extraction-id="${extraction.id}">
      <div class="production-extraction-layout">
        <div class="production-extraction-main">
          <header class="production-extraction-header">
            ${img}
            <div class="production-extraction-title">
              <h4>${escapeHtml(displayName)}</h4>
              <p>${escapeHtml(getExtractionSubtitle(kind))}</p>
            </div>
            <div class="production-step-actions">
              <button
                type="button"
                class="production-step-reset-btn production-extraction-duplicate-btn"
                data-item-id="${extraction.item_id}"
                aria-label="${escapeHtml(t('production.addAnotherExtractionAria', { name: displayName }))}"
                title="${escapeHtml(t('production.addAnotherExtraction'))}"
              >${ADD_ICON}</button>
              <button
                type="button"
                class="production-step-reset-btn"
                data-extraction-id="${extraction.id}"
                aria-label="${escapeHtml(t('production.resetExtraction'))}"
                title="${escapeHtml(t('production.resetDefaults'))}"
              >${RESET_ICON}</button>
              <button
                type="button"
                class="production-step-delete-btn"
                data-extraction-id="${extraction.id}"
                aria-label="${escapeHtml(t('production.deleteExtraction'))}"
              >${DELETE_ICON}</button>
            </div>
          </header>
          <div class="production-config-grid">
            ${minerField}
            ${purityField}
            <div class="production-config-field">
              <label class="production-config-label" for="production-extraction-output-${extraction.id}">
                ${escapeHtml(t('production.configOutput', { unit: outputUnit }))}
              </label>
              <input
                type="text"
                class="production-config-input production-extraction-output-input production-config-decimal-input"
                id="production-extraction-output-${extraction.id}"
                data-extraction-id="${extraction.id}"
                min="${outputSliderMin}"
                max="${outputSliderMax}"
                inputmode="decimal"
                readonly
                value="${outputDisplayValue}"
              />
              <input
                type="range"
                class="production-config-slider production-extraction-output-slider"
                data-extraction-id="${extraction.id}"
                min="${outputSliderMin}"
                max="${outputSliderMax}"
                step="${outputSliderStep}"
                value="${fractionalExtractionOutput ? targetOutput : Math.round(targetOutput)}"
                aria-label="${escapeHtml(t('production.adjustExtractionOutput'))}"
              />
            </div>
            <div class="production-config-field">
              <label class="production-config-label" for="production-extraction-overclock-${extraction.id}">
                ${escapeHtml(t('production.configOverclock'))}
              </label>
              <input
                type="number"
                class="production-config-input production-extraction-overclock-input"
                id="production-extraction-overclock-${extraction.id}"
                data-extraction-id="${extraction.id}"
                min="${window.ProductionScale.OVERCLOCK_MIN}"
                max="${window.ProductionScale.OVERCLOCK_MAX}"
                step="1"
                readonly
                value="${formatOverclockInputValue(extraction.overclock)}"
              />
              <input
                type="range"
                class="production-config-slider production-extraction-overclock-slider"
                data-extraction-id="${extraction.id}"
                min="${window.ProductionScale.OVERCLOCK_MIN}"
                max="${window.ProductionScale.OVERCLOCK_MAX}"
                step="1"
                value="${Math.round(extraction.overclock)}"
                aria-label="${escapeHtml(t('production.adjustExtractionOverclock'))}"
              />
            </div>
            <div class="production-config-field">
              <label class="production-config-label" for="production-extraction-nodes-${extraction.id}">
                ${nodesLabel}
              </label>
              <input
                type="number"
                class="production-config-input production-extraction-nodes-input"
                id="production-extraction-nodes-${extraction.id}"
                data-extraction-id="${extraction.id}"
                min="1"
                max="${nodesSliderMax}"
                step="1"
                readonly
                value="${formatMachineCountInput(nodeCount)}"
              />
              <input
                type="range"
                class="production-config-slider production-extraction-nodes-slider"
                data-extraction-id="${extraction.id}"
                min="1"
                max="${nodesSliderMax}"
                step="1"
                value="${Math.round(nodeCount)}"
                aria-label="${escapeHtml(t('production.adjustNodes', { nodes: nodesLabel.toLowerCase() }))}"
              />
            </div>
            <div class="production-config-field">
              <label class="production-config-label" for="production-extraction-power-${extraction.id}">
                ${escapeHtml(t('production.configPowerShard'))}
              </label>
              <input
                type="text"
                class="production-config-input production-config-readonly production-extraction-power-shards"
                id="production-extraction-power-${extraction.id}"
                readonly
                tabindex="-1"
                value="${computeTotalPowerShards(extraction.overclock, nodeCount)}"
              />
            </div>
            <div class="production-config-field">
              <label class="production-config-label" for="production-extraction-power-mw-${extraction.id}">
                ${escapeHtml(t('production.configPowerConsumption'))}
              </label>
              <input
                type="text"
                class="production-config-input production-config-readonly production-extraction-power-mw"
                id="production-extraction-power-mw-${extraction.id}"
                readonly
                tabindex="-1"
                value="${formatRateWithUnit(computeExtractionPowerMw(extraction), 'MW')}"
              />
            </div>
          </div>
          ${linkedConsumersSection}
        </div>
        <aside class="production-extraction-building">
          ${buildingImg}
          <span class="production-extraction-building-name">${escapeHtml(extraction.building_name || defaultBuildingName)}</span>
          <span class="production-extraction-building-config">${formatExtractionBuildingConfigContent(extraction, outputUnit)}</span>
          <span class="production-extraction-output">${formatRateWithUnit(outputRate, outputUnit)}</span>
          ${renderBuildingPowerShards({
            overclock: extraction.overclock,
            machine_count: nodeCount,
            power_consumption: extraction.power_consumption,
          })}
        </aside>
      </div>
    </article>`;
}

function updateExtractionThemeSelects(extractionEl, extraction) {
  const kind = getExtractionKind(extraction);

  extractionEl.querySelectorAll('.theme-select').forEach((select) => {
    const field = select.dataset.field;
    if (field === 'miner' && kind !== 'mineral' && kind !== 'coal') return;
    if (field === 'purity' && kind === 'water') return;

    const value = field === 'miner' ? extraction.miner_slug : extraction.purity;
    const options = field === 'miner' ? MINER_OPTIONS : PURITY_OPTIONS;
    const label =
      field === 'miner'
        ? options.find((item) => item.slug === value)?.label
        : options.find((item) => item.value === value)?.label;

    const valueEl = select.querySelector('.theme-select-value');
    if (valueEl && label) valueEl.textContent = label;

    select.querySelectorAll('.theme-select-option').forEach((option) => {
      const isActive = option.dataset.value === value;
      option.classList.toggle('theme-select-option--active', isActive);
      option.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  });
}

function updateExtractionConfigDisplay(extractionEl, extraction) {
  const outputInput = extractionEl.querySelector('.production-extraction-output-input');
  const outputSlider = extractionEl.querySelector(
    '.production-extraction-output-slider, .energy-extraction-output-slider'
  );
  const overclockInput = extractionEl.querySelector('.production-extraction-overclock-input');
  const overclockSlider = extractionEl.querySelector(
    '.production-extraction-overclock-slider, .energy-extraction-overclock-slider'
  );
  const nodesInput = extractionEl.querySelector('.production-extraction-nodes-input');
  const nodesSlider = extractionEl.querySelector(
    '.production-extraction-nodes-slider, .energy-extraction-nodes-slider'
  );
  const outputEl = extractionEl.querySelector('.production-extraction-output');
  const buildingConfigEl = extractionEl.querySelector('.production-extraction-building-config');
  const powerShards = extractionEl.querySelector('.production-extraction-power-shards');
  const nodeCount = extraction.node_count ?? 1;
  const targetOutput = extraction.target_output ?? extraction.output_rate ?? 0;
  const outputSliderMax = getExtractionOutputSliderMax(extraction);
  const outputSliderMin = getExtractionOutputSliderMin(extraction);
  const outputSliderStep = getExtractionOutputSliderStep(extraction);
  const fractionalExtractionOutput = usesFractionalExtractionOutput(extraction);

  if (outputInput) {
    outputInput.type = 'text';
    outputInput.setAttribute('inputmode', 'decimal');
    outputInput.classList.add('production-config-decimal-input');
    outputInput.removeAttribute('step');
    outputInput.min = String(outputSliderMin);
    outputInput.max = String(outputSliderMax);
    outputInput.value = formatExtractionOutputInputValue(targetOutput, extraction.overclock);
    rememberConfigInputValue(outputInput);
  }
  if (outputSlider) {
    const value = fractionalExtractionOutput
      ? window.ProductionScale.roundProduction(targetOutput)
      : Math.max(1, Math.round(targetOutput));
    outputSlider.min = String(outputSliderMin);
    outputSlider.max = String(outputSliderMax);
    outputSlider.step = String(outputSliderStep);
    outputSlider.value = String(Math.min(Math.max(value, outputSliderMin), outputSliderMax));
  }
  if (overclockInput) {
    overclockInput.value = formatOverclockInputValue(extraction.overclock);
    rememberConfigInputValue(overclockInput);
  }
  if (overclockSlider) overclockSlider.value = String(Math.round(extraction.overclock));
  if (nodesInput) {
    const nodesMax = getNodesSliderMax(nodeCount, extraction);
    nodesInput.max = String(nodesMax);
    nodesInput.value = formatMachineCountInput(nodeCount);
    rememberConfigInputValue(nodesInput);
  }
  if (nodesSlider) {
    const rounded = Math.max(1, Math.round(nodeCount));
    nodesSlider.max = String(getNodesSliderMax(rounded, extraction));
    nodesSlider.value = String(rounded);
  }
  if (outputEl) {
    const unit = getExtractionOutputUnit(extraction.item, getExtractionKind(extraction));
    const rate = extraction.output_rate ?? targetOutput;
    outputEl.textContent = formatRateWithUnit(rate, unit);
  }
  if (buildingConfigEl) {
    const unit = getExtractionOutputUnit(extraction.item, getExtractionKind(extraction));
    buildingConfigEl.innerHTML = formatExtractionBuildingConfigContent(extraction, unit);
  }
  if (powerShards) {
    powerShards.value = String(computeTotalPowerShards(extraction.overclock, nodeCount));
  }

  const powerMw = extractionEl.querySelector('.production-extraction-power-mw');
  if (powerMw) {
    powerMw.value = formatRateWithUnit(computeExtractionPowerMw(extraction), 'MW');
  }

  const extractionBuilding = extractionEl.querySelector('.production-extraction-building');
  if (extractionBuilding) {
    updateBuildingPowerShardsEl(extractionBuilding, {
      overclock: extraction.overclock,
      machine_count: nodeCount,
      power_consumption: extraction.power_consumption,
    });
  }

  updateExtractionThemeSelects(extractionEl, extraction);
  lockConfigNumberInputsIn(extractionEl, { skipFocused: true });
  lockConfigSlidersIn(extractionEl, { skipFocused: true });
}

function scheduleExtractionConfigSave(extractionId, config) {
  clearTimeout(extractionConfigDebounce.get(extractionId));
  extractionConfigDebounce.set(
    extractionId,
    setTimeout(async () => {
      try {
        await window.satisfactory.updateMineralExtraction(extractionId, config);
      } catch (err) {
        console.error('Update extraction config error:', err);
      }
    }, 400)
  );
}

async function saveExtractionConfig(extractionId, config, { immediate = false } = {}) {
  if (immediate) {
    clearTimeout(extractionConfigDebounce.get(extractionId));
    try {
      activeProductionDetail = await window.satisfactory.updateMineralExtraction(extractionId, config);
      renderProductionDetailContent(activeProductionDetail);
    } catch (err) {
      console.error('Update extraction config error:', err);
    }
    return;
  }

  scheduleExtractionConfigSave(extractionId, config);
}

function handleExtractionConfigChange(extractionId, field, rawValue) {
  const extraction = activeProductionDetail?.extractions?.find((item) => item.id === extractionId);
  if (!extraction) return;

  const changeField =
    field === 'overclock-slider'
      ? 'overclock-slider'
      : field === 'overclock'
        ? 'overclock'
        : field;

  const parsedValue =
    changeField === 'output' ? parseConfigNumberInput(rawValue) : rawValue;
  if (changeField === 'output' && !Number.isFinite(parsedValue)) return;

  const updated = window.ExtractionScale.applyExtractionChange(
    extraction.item,
    {
      target_output: extraction.target_output ?? extraction.output_rate,
      node_count: extraction.node_count ?? 1,
      overclock: extraction.overclock,
      miner_slug: extraction.miner_slug,
      purity: extraction.purity,
    },
    changeField,
    parsedValue
  );
  if (!updated) return;

  extraction.miner_slug = updated.miner_slug;
  extraction.purity = updated.purity;
  extraction.overclock = updated.overclock;
  extraction.node_count = updated.node_count;
  extraction.target_output = updated.target_output;
  extraction.base_per_node = updated.base_per_node;
  extraction.max_target_output = updated.max_target_output;
  extraction.output_rate = updated.output_rate;

  refreshAllStepIoDisplays();
  refreshAllExtractionLinkDisplays();

  const extractionEl = productionDetailBody.querySelector(`[data-extraction-id="${extractionId}"]`);
  if (extractionEl) updateExtractionConfigDisplay(extractionEl, extraction);
  updateProductionDetailExternalSummary();

  const config = {
    miner_slug: updated.miner_slug,
    purity: updated.purity,
    overclock: updated.overclock,
    node_count: updated.node_count,
    target_output: updated.target_output,
  };

  const immediate = field === 'miner' || field === 'purity';
  saveExtractionConfig(extractionId, config, { immediate });
}

function handleExtractionSliderInput(slider, field) {
  const value = snapProductionSliderValue(slider);
  if (value == null) return;

  const extractionId = Number(slider.dataset.extractionId);
  const extractionEl = productionDetailBody.querySelector(`[data-extraction-id="${extractionId}"]`);

  if (field === 'output') {
    const input = extractionEl?.querySelector('.production-extraction-output-input');
    const extraction = activeProductionDetail?.extractions?.find((item) => item.id === extractionId);
    if (input) {
      input.value = formatExtractionOutputInputValue(value, extraction?.overclock);
    }
    handleExtractionConfigChange(extractionId, 'output', value);
    return;
  }

  if (field === 'overclock') {
    const input = extractionEl?.querySelector('.production-extraction-overclock-input');
    if (input) input.value = String(value);
    handleExtractionConfigChange(extractionId, 'overclock-slider', value);
    return;
  }

  if (field === 'nodes') {
    const input = extractionEl?.querySelector('.production-extraction-nodes-input');
    if (input) input.value = String(value);
    handleExtractionConfigChange(extractionId, 'nodes', value);
  }
}

async function resetProductionExtraction(extractionId) {
  clearTimeout(extractionConfigDebounce.get(extractionId));
  extractionConfigDebounce.delete(extractionId);

  try {
    activeProductionDetail = await window.satisfactory.resetMineralExtraction(extractionId);
    renderProductionDetailContent(activeProductionDetail);
  } catch (err) {
    console.error('Reset extraction error:', err);
  }
}

async function deleteProductionExtraction(extractionId) {
  const extraction = activeProductionDetail?.extractions?.find((item) => item.id === extractionId);
  if (!extraction) return;

  const displayName = getExtractionDisplayName(
    extraction,
    activeProductionDetail?.extractions ?? []
  );

  const confirmed = await showConfirm({
    title: t('confirm.deleteExtractionTitle'),
    message: t('confirm.deleteExtractionMessage', { name: displayName }),
    confirmLabel: t('actions.delete'),
  });
  if (!confirmed) return;

  clearTimeout(extractionConfigDebounce.get(extractionId));
  extractionConfigDebounce.delete(extractionId);

  try {
    activeProductionDetail = await window.satisfactory.deleteMineralExtraction(extractionId);
    renderProductionDetailContent(activeProductionDetail);
  } catch (err) {
    console.error('Delete extraction error:', err);
  }
}

async function addMineralExtractionFromPicker(itemId) {
  if (!activeProductionChainId) return;

  try {
    activeProductionDetail = await window.satisfactory.addMineralExtraction(activeProductionChainId, {
      item_id: itemId,
    });
    closeResourcePickerModal();
    renderProductionDetailContent(activeProductionDetail);
  } catch (err) {
    console.error('Add mineral extraction error:', err);
  }
}

