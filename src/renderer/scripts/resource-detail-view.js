function populateCategorySelect(selectedSlug) {
  const select = document.getElementById('edit-item-category');
  select.innerHTML = categoryOptions
    .map(
      (cat) =>
        `<option value="${escapeHtml(cat.slug)}" ${cat.slug === selectedSlug ? 'selected' : ''}>${escapeHtml(cat.name)}</option>`
    )
    .join('');
}

function showFormError(message) {
  editFormError.textContent = message;
  editFormError.classList.remove('hidden');
}

function hideFormError() {
  editFormError.textContent = '';
  editFormError.classList.add('hidden');
}

async function openEditModal(itemId) {
  hideFormError();

  let item = null;
  for (const cat of resourcesData) {
    item = cat.items.find((i) => i.id === itemId);
    if (item) break;
  }

  if (!item) {
    item = await window.satisfactory.getResource(itemId);
  }

  if (!item) return;

  if (!categoryOptions.length) {
    categoryOptions = await window.satisfactory.getResourceCategories();
  }

  document.getElementById('edit-item-id').value = item.id;
  document.getElementById('edit-item-name').value = item.name;
  populateCategorySelect(item.category);

  editModal.classList.remove('hidden');
  editModal.setAttribute('aria-hidden', 'false');
  document.getElementById('edit-item-name').focus();
}

function closeEditModal() {
  editModal.classList.add('hidden');
  editModal.setAttribute('aria-hidden', 'true');
  hideFormError();
}

function formatIoAmount(io) {
  const n = Number(io.amount);
  if (!Number.isFinite(n)) return '0';
  const formatted = formatProductionValue(n);
  return io.is_fluid ? `${formatted} m³` : `${formatted}x`;
}

function formatIoPerMinute(io, duration) {
  const perMin = window.ProductionScale.outputPerMinute(io.amount, duration);
  const unit = io.is_fluid ? 'm³/min' : '/min';
  if (!Number.isFinite(perMin)) return formatRateWithUnit(0, unit);
  return formatRateWithUnit(perMin, unit);
}

function productionIoRenderOptions(schema) {
  return { perMinute: true, duration: schema?.duration ?? 1 };
}

function formatProductionValue(value) {
  return window.NumberFormat.formatDisplayNumber(value);
}

function formatDisplayInteger(value) {
  return window.NumberFormat.formatDisplayInteger(value);
}

function formatRateWithUnit(value, unit) {
  const formatted = formatProductionValue(value);
  const normalized = String(unit ?? '').trim();
  if (!normalized) return formatted;
  if (normalized.toUpperCase() === 'MW') {
    return `${formatted} MW`;
  }
  return `${formatted}${normalized}`;
}

function parseConfigNumberInput(raw) {
  if (window.NumberFormat?.parseLocalizedNumber) {
    return window.NumberFormat.parseLocalizedNumber(raw);
  }
  if (raw == null || raw === '') return NaN;
  if (typeof raw === 'number') return raw;
  let s = String(raw).trim().replace(/\s/g, '');
  if (!s) return NaN;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    s = s.replace(',', '.');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function formatExtractionOutputInputValue(value, overclock = null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return formatOutputInputValue(n, overclock);
}

function formatWaterExtractionOutputInputValue(value) {
  return formatExtractionOutputInputValue(value);
}

function formatOutputInputValue(value, overclock = null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (
    window.ProductionScale.isIntegerOverclock(overclock ?? 100) &&
    n >= 1 - 0.0005 &&
    Math.abs(n - Math.round(n)) < 0.0005
  ) {
    return String(Math.round(n));
  }
  const formatted = String(window.ProductionScale.roundProduction(n));
  if (window.NumberFormat?.formatPlainDecimal) {
    return window.NumberFormat.formatPlainDecimal(formatted);
  }
  return formatted.includes('.') ? formatted.replace('.', ',') : formatted;
}

function formatOverclockInputValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const clamped = Math.min(
    window.ProductionScale.OVERCLOCK_MAX,
    Math.max(window.ProductionScale.OVERCLOCK_MIN, n)
  );
  const nearest = Math.round(clamped);
  if (Math.abs(clamped - nearest) < 0.0005) return String(nearest);
  return String(window.ProductionScale.roundProduction(clamped));
}

function formatMachineCountInput(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return String(Math.max(1, Math.round(n)));
}

function formatMachineCountLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return formatDisplayInteger(Math.max(1, Math.round(n)));
}

function formatOverclockLabel(value) {
  return formatOverclockInputValue(value) || '—';
}

function computePowerShardsPerMachine(overclock) {
  const oc = Number(overclock);
  if (!Number.isFinite(oc) || oc <= 100) return 0;
  if (oc <= 150) return 1;
  if (oc <= 200) return 2;
  return 3;
}

function computeTotalPowerShards(overclock, machineCount) {
  const machines = Math.max(1, Math.round(Number(machineCount) || 1));
  return computePowerShardsPerMachine(overclock) * machines;
}

function renderBuildingPowerShards(overclockOrConfig, machineCount) {
  const config =
    overclockOrConfig != null && typeof overclockOrConfig === 'object'
      ? overclockOrConfig
      : { overclock: overclockOrConfig, machine_count: machineCount };

  const overclock = config.overclock;
  const machines = config.machine_count ?? 1;
  const count = formatDisplayInteger(computeTotalPowerShards(overclock, machines));
  const [before = '', after = ''] = t('production.powerShardsRequired', { count: '\u0000' }).split(
    '\u0000'
  );

  const slots = window.ProductionScale.getSomersloopSlots(config.schema);
  const somersloopMult = window.ProductionScale.computeSomersloopMultiplier(
    slots,
    config.somersloop_mask ?? 0
  );
  const powerMw = window.ProductionScale.roundPowerMw(
    window.ProductionScale.computeMachinePowerMw(
      Number(config.power_consumption) || Number(config.schema?.power_consumption) || 0,
      overclock,
      machines,
      somersloopMult
    )
  );
  const powerLine =
    powerMw > 0
      ? (() => {
          const mwText = formatRateWithUnit(powerMw, 'MW');
          const [mwBefore = '', mwAfter = ''] = t('production.powerConsumptionRequired', {
            mw: '\u0000',
          }).split('\u0000');
          return `<div class="craft-building-power-consumption">
      <i class="fa-solid fa-bolt craft-building-power-consumption-icon" aria-hidden="true"></i>
      <span class="craft-building-power-consumption-label">${escapeHtml(mwBefore)}<strong>${escapeHtml(
            mwText
          )}</strong>${escapeHtml(mwAfter)}</span>
    </div>`;
        })()
      : '';

  return `
    <div class="craft-building-power-shards">
      <img class="craft-building-power-shards-icon" src="${POWER_SHARD_IMAGE}" alt="" />
      <span class="craft-building-power-shards-label">${escapeHtml(before)}<strong>${escapeHtml(
        count
      )}</strong>${escapeHtml(after)}</span>
    </div>
    ${powerLine}`;
}

function updateBuildingPowerShardsEl(container, overclockOrConfig, machineCount) {
  if (!container) return;
  const existingShards = container.querySelector('.craft-building-power-shards');
  const existingPower = container.querySelector('.craft-building-power-consumption');
  const html = renderBuildingPowerShards(overclockOrConfig, machineCount);
  existingPower?.remove();
  if (existingShards) {
    existingShards.outerHTML = html;
    return;
  }
  const inputsPanel = container.querySelector('.craft-building-inputs-panel');
  if (inputsPanel) {
    inputsPanel.insertAdjacentHTML('afterend', html);
    return;
  }
  container.insertAdjacentHTML('beforeend', html);
}

function renderSomersloopCheckboxes(step) {
  const slots = window.ProductionScale.getSomersloopSlots(step.schema);
  if (!slots) {
    return '<span class="production-somersloop-empty">—</span>';
  }

  const mask = step.somersloop_mask ?? 0;
  return `<div class="production-somersloop-slots" role="group" aria-label="Somersloop">
    ${Array.from({ length: slots }, (_, index) => {
      const checked = (mask >> index) & 1;
      return `<label class="production-somersloop-slot">
        <input
          type="checkbox"
          class="production-somersloop-checkbox"
          data-step-id="${step.id}"
          data-slot="${index}"
          ${checked ? 'checked' : ''}
        />
        <span>${index + 1}</span>
      </label>`;
    }).join('')}
  </div>`;
}

function renderProductionInputWithLinks(step, io, ioOptions, allSteps) {
  const itemSlug = io.item_slug;
  const allExtractions = activeProductionDetail?.extractions ?? [];
  const img = io.item_image
    ? `<img src="${escapeHtml(io.item_image)}" alt="" />`
    : '<span class="resource-img resource-img--placeholder" style="width:28px;height:28px"></span>';

  const amountLabel = ioOptions.perMinute
    ? formatIoPerMinute(io, ioOptions.duration)
    : formatIoAmount(io);

  const linkedProducers = getLinkedProducersForInput(step, itemSlug, allSteps);
  const linkedExtractions = getLinkedExtractionsForInput(step, itemSlug, allExtractions, allSteps);
  const candidates = getProducerCandidates(allSteps, step.id, itemSlug);
  const extractionCandidates = isExternalSummarySlug(itemSlug)
    ? getExtractionCandidates(allExtractions, step.id, itemSlug, allSteps)
    : [];
  const requiredRate = getStepInputRateForItem(step, itemSlug);
  const schemaLinkedRate = linkedProducers.reduce((sum, link) => sum + link.producer_rate, 0);
  const extractionLinkedRate = linkedExtractions.reduce((sum, link) => sum + link.producer_rate, 0);
  const linkedRate = window.ProductionScale.roundProduction(schemaLinkedRate + extractionLinkedRate);
  const unit = io.is_fluid ? 'm³/min' : '/min';
  let linkState = null;
  let linkStateClass = '';
  let externalRate = 0;
  let linkedExcessRate = 0;
  const hasExplicitLinks = linkedProducers.length > 0 || linkedExtractions.length > 0;

  if (hasExplicitLinks) {
    const resolved = resolveInputLinkBalance(step, itemSlug, linkedRate, requiredRate);
    linkState = resolved.state;
    externalRate = resolved.externalRate;
    linkedExcessRate = resolved.linkedExcessRate;
    linkStateClass = getLinkStateClass(linkState, true);
  }

  const linkedBadge = hasExplicitLinks
      ? `<div class="production-input-linked">
          ${linkedProducers
            .map(
              (link) =>
                `<span class="production-link-badge">← ${escapeHtml(link.producer_name)} (${formatRateWithUnit(link.producer_rate, unit)})</span>`
            )
            .join('')}
          ${linkedExtractions
            .map((link) => {
              const partial =
                requiredRate > LINK_BALANCE_TOLERANCE &&
                link.producer_rate + LINK_BALANCE_TOLERANCE < requiredRate;
              return `<span class="production-link-badge production-link-badge--extraction${
                partial ? ' production-link-badge--partial' : ''
              }">← ${escapeHtml(link.producer_name)} (${formatLinkedConsumerBadgeRate(
                { allocated_rate: link.producer_rate, required_rate: requiredRate },
                unit
              )})</span>`;
            })
            .join('')}
          ${
            linkState === 'balanced'
              ? `<span class="production-link-covered">${escapeHtml(t('production.linkFullyCovered'))}</span>`
              : linkState === 'excess'
                ? `<span class="production-link-external">${escapeHtml(t('production.linkExcessLinked', { rate: formatRateWithUnit(linkedExcessRate, unit) }))}</span>`
                : `<span class="production-link-deficit">${escapeHtml(t('production.linkExternal', { rate: formatRateWithUnit(externalRate, unit) }))}</span>`
          }
        </div>`
      : '';

  const linkSection =
    candidates.length > 0
      ? `<div class="production-input-links">
          <span class="production-input-links-label">${escapeHtml(t('production.linkFromProduction'))}</span>
          <div class="production-link-options">
            ${candidates
              .map((producer) => {
                const checked = linkedProducers.some((link) =>
                  linkTargetsProducer(link, producer.id)
                );
                const rateLabel = formatProducerLinkOptionRate(
                  producer,
                  step.id,
                  itemSlug,
                  allSteps,
                  unit
                );
                return `
                  <label class="production-link-option">
                    <input
                      type="checkbox"
                      class="production-link-checkbox"
                      data-consumer-step-id="${step.id}"
                      data-item-slug="${itemSlug}"
                      data-producer-step-id="${producer.id}"
                      ${checked ? 'checked' : ''}
                    />
                    <span>${escapeHtml(producer.name)}</span>
                    <span class="production-link-rate">(${rateLabel})</span>
                  </label>`;
              })
              .join('')}
          </div>
        </div>`
      : '';

  const extractionLinkSection =
    extractionCandidates.length > 0
      ? `<div class="production-input-links">
          <span class="production-input-links-label">${escapeHtml(t('production.linkFromExtraction'))}</span>
          <div class="production-link-options">
            ${extractionCandidates
              .map((extraction) => {
                const checked = linkedExtractions.some((link) =>
                  linkTargetsExtraction(link, extraction.id)
                );
                const rateLabel = formatExtractionLinkOptionRate(
                  extraction,
                  step.id,
                  itemSlug,
                  allSteps,
                  unit
                );
                const displayName = getExtractionDisplayName(extraction, allExtractions);
                return `
                  <label class="production-link-option">
                    <input
                      type="checkbox"
                      class="production-extraction-link-checkbox"
                      data-consumer-step-id="${step.id}"
                      data-item-slug="${itemSlug}"
                      data-producer-extraction-id="${extraction.id}"
                      ${checked ? 'checked' : ''}
                    />
                    <span>${escapeHtml(displayName)}</span>
                    <span class="production-link-rate">(${rateLabel})</span>
                  </label>`;
              })
              .join('')}
          </div>
        </div>`
      : '';

  return `
    <div class="craft-io-item craft-io-item--with-links ${linkStateClass}" data-item-slug="${escapeHtml(itemSlug)}">
      <button
        type="button"
        class="production-input-add-trigger"
        data-item-slug="${escapeHtml(itemSlug)}"
        title="${escapeHtml(t('production.addResourceStepFor', { name: io.item_name || itemSlug }))}"
        aria-label="${escapeHtml(t('production.addResourceStepFor', { name: io.item_name || itemSlug }))}"
      >
        ${img}
        <span>${escapeHtml(io.item_name || itemSlug)}</span>
        <span class="amount">${amountLabel}</span>
      </button>
      ${linkedBadge}
      ${linkSection}
      ${extractionLinkSection}
    </div>`;
}

function renderProductionOutputWithLinks(step, io, ioOptions, allSteps) {
  const itemSlug = io.item_slug;
  const img = io.item_image
    ? `<img src="${escapeHtml(io.item_image)}" alt="" />`
    : '<span class="resource-img resource-img--placeholder" style="width:28px;height:28px"></span>';

  const amountLabel = ioOptions.perMinute
    ? formatIoPerMinute(io, ioOptions.duration)
    : formatIoAmount(io);

  const outputRate = getStepOutputRateForItem(step, itemSlug);
  const linkedConsumers = getLinkedConsumersForOutput(step, itemSlug, allSteps);
  const excessRate = getProducerOutputSurplus(step, itemSlug, allSteps);
  const totalDemand = window.ProductionScale.roundProduction(
    Math.max(0, outputRate - excessRate)
  );
  const deficitRate = normalizeLinkDelta(totalDemand - outputRate, totalDemand);
  const unit = io.is_fluid ? 'm³/min' : '/min';
  const linkState = linkedConsumers.length ? getLinkBalanceState(outputRate, totalDemand) : null;
  const linkStateClass = getLinkStateClass(linkState, linkedConsumers.length > 0);

  const linkedBadge =
    linkedConsumers.length > 0
      ? `<div class="production-output-linked">
          ${linkedConsumers
            .map(
              (consumer) =>
                `<span class="production-link-badge production-link-badge--consumer">→ ${escapeHtml(consumer.consumer_name)} (${formatRateWithUnit(consumer.required_rate, unit)})</span>`
            )
            .join('')}
          ${
            linkState === 'balanced'
              ? `<span class="production-link-covered">${escapeHtml(t('production.linkFullyUsed'))}</span>`
              : linkState === 'excess'
                ? `<span class="production-link-external">${escapeHtml(t('production.linkExcess', { rate: formatRateWithUnit(excessRate, unit) }))}</span>`
                : `<span class="production-link-deficit">${escapeHtml(t('production.linkInsufficient', { rate: formatRateWithUnit(deficitRate, unit) }))}</span>`
          }
        </div>`
      : '';

  return `
    <div class="craft-io-item craft-io-item--with-links ${linkStateClass}" data-item-slug="${escapeHtml(itemSlug)}">
      ${img}
      <span>${escapeHtml(io.item_name || io.item_slug)}</span>
      <span class="amount">${amountLabel}</span>
      ${linkedBadge}
    </div>`;
}

function renderIoItem(io, options = {}) {
  const img = io.item_image
    ? `<img src="${escapeHtml(io.item_image)}" alt="" />`
    : '<span class="resource-img resource-img--placeholder" style="width:28px;height:28px"></span>';

  const amountLabel = options.perMinute
    ? formatIoPerMinute(io, options.duration)
    : formatIoAmount(io);

  return `
    <div class="craft-io-item">
      ${img}
      <span>${escapeHtml(io.item_name || io.item_slug)}</span>
      <span class="amount">${amountLabel}</span>
    </div>`;
}

function renderBuildingBadge(schema) {
  const image = schema?.building_image
    ? `<img class="craft-building-image" src="${escapeHtml(schema.building_image)}" alt="" />`
    : '';

  return `
    <span class="craft-building-info">
      ${image}
      <span class="craft-building">${escapeHtml(schema?.building_name || '—')}</span>
    </span>`;
}

function renderBuildingNameOnly(schema) {
  return `<span class="craft-building">${escapeHtml(schema?.building_name || '—')}</span>`;
}

function getBuildingInputRates(schema, scaledInputs, machineCount) {
  if (!schema?.inputs?.length) return [];

  const duration = schema.duration ?? 1;
  const machines = Math.max(1, Math.round(Number(machineCount) || 1));
  const scaledBySlug = new Map((scaledInputs ?? []).map((io) => [io.item_slug, io]));

  return schema.inputs.map((schemaIo) => {
    const scaledIo = scaledBySlug.get(schemaIo.item_slug) ?? schemaIo;
    const basePerMin = window.ProductionScale.outputPerMinute(schemaIo.amount, duration);
    const totalCurrent = window.ProductionScale.outputPerMinute(scaledIo.amount, duration);
    const currentPerMin = window.ProductionScale.roundProduction(totalCurrent / machines);

    return {
      item_slug: schemaIo.item_slug,
      item_name: schemaIo.item_name || schemaIo.item_slug,
      item_image: schemaIo.item_image ?? scaledIo.item_image ?? null,
      is_fluid: schemaIo.is_fluid,
      base_per_min: basePerMin,
      current_per_min: currentPerMin,
    };
  });
}

function renderBuildingInputsContent(buildingConfig) {
  const rates = buildingConfig?.input_rates?.length
    ? buildingConfig.input_rates
    : getBuildingInputRates(
        buildingConfig?.schema,
        buildingConfig?.scaled_inputs,
        buildingConfig?.machine_count
      );
  if (!rates.length) return '';

  const items = rates
    .map((input) => {
      const unit = input.is_fluid ? 'm³/min' : '/min';
      const icon = input.item_image
        ? `<img class="craft-building-input-icon" src="${escapeHtml(input.item_image)}" alt="" />`
        : '<span class="craft-building-input-icon craft-building-input-icon--placeholder"></span>';

      return `
        <div class="craft-building-input-item">
          ${icon}
          <div class="craft-building-input-rates">
            <span class="craft-building-input-current"><strong>${escapeHtml(formatRateWithUnit(input.current_per_min, unit))}</strong></span>
            <span class="craft-building-input-base">${escapeHtml(t('common.base'))}: ${escapeHtml(formatRateWithUnit(input.base_per_min, unit))}</span>
          </div>
        </div>`;
    })
    .join('');

  return `
    <div class="craft-building-inputs">
      <span class="craft-building-inputs-label">${escapeHtml(t('production.inputsPerMachine'))}</span>
      ${items}
    </div>`;
}

function formatBuildingConfigContent(config, outputUnit = '/min') {
  const perMachine = window.ProductionScale.computeOutputPerMachine(
    config.target_output,
    config.machine_count,
    config.overclock
  );
  const unit = config.output_unit || outputUnit;
  return `<strong>${escapeHtml(formatRateWithUnit(perMachine, unit))}</strong> ${formatMachineCountLabel(config.machine_count)}× @ ${formatOverclockLabel(config.overclock)}%`;
}

function renderBuildingConfigLine(buildingConfig) {
  if (!buildingConfig) return '';
  return `<span class="craft-building-config">${formatBuildingConfigContent(buildingConfig)}</span>`;
}

function renderBuildingTotalOutput(buildingConfig) {
  if (buildingConfig?.target_output == null) return '';
  const unit = buildingConfig.output_unit || '/min';
  return `<span class="craft-building-total-output">${escapeHtml(formatRateWithUnit(buildingConfig.target_output, unit))}</span>`;
}

function renderBuildingPanel(schema, buildingConfig = null) {
  const configLine = renderBuildingConfigLine(buildingConfig);
  const totalOutputLine = renderBuildingTotalOutput(buildingConfig);
  const baseLine =
    buildingConfig?.base_per_min != null
      ? `<span class="craft-building-base">${escapeHtml(t('common.base'))}: ${escapeHtml(formatRateWithUnit(buildingConfig.base_per_min, buildingConfig.output_unit || '/min'))}</span>`
      : '';
  const inputsPanel = renderBuildingInputsContent(buildingConfig);
  const powerShards =
    buildingConfig != null
      ? renderBuildingPowerShards({
          overclock: buildingConfig.overclock,
          machine_count: buildingConfig.machine_count,
          power_consumption:
            buildingConfig.power_consumption ?? buildingConfig.schema?.power_consumption,
          somersloop_mask: buildingConfig.somersloop_mask,
          schema: buildingConfig.schema,
        })
      : '';

  if (!schema?.building_image) {
    return `
      <aside class="craft-schema-building craft-schema-building--empty">
        ${totalOutputLine}
        <div class="craft-schema-building-main">
          ${renderBuildingNameOnly(schema)}
          ${configLine}
          ${baseLine}
          <div class="craft-building-inputs-panel">${inputsPanel}</div>
          ${powerShards}
        </div>
      </aside>`;
  }

  return `
    <aside class="craft-schema-building">
      ${totalOutputLine}
      <div class="craft-schema-building-main">
        <img
          class="craft-building-image-large"
          src="${escapeHtml(schema.building_image)}"
          alt="${escapeHtml(schema.building_name || t('common.building'))}"
        />
        <span class="craft-building-name">${escapeHtml(schema.building_name || '—')}</span>
        ${configLine}
        ${baseLine}
        <div class="craft-building-inputs-panel">${inputsPanel}</div>
        ${powerShards}
      </div>
    </aside>`;
}

function renderCraftSchema(
  schema,
  isAlt,
  {
    compact = false,
    extraContent = '',
    className = '',
    ioRenderOptions = null,
    buildingConfig = null,
    inputItemRenderer = null,
    outputItemRenderer = null,
    hideSchemaHeader = false,
  } = {}
) {
  const defaultRenderIo = (io) => renderIoItem(io, ioRenderOptions ?? {});
  const renderInput = inputItemRenderer ?? defaultRenderIo;
  const renderOutput = outputItemRenderer ?? defaultRenderIo;
  const inputs = schema.inputs.map(renderInput).join('') || '<p class="detail-empty">—</p>';
  const outputs = schema.outputs.map(renderOutput).join('') || '<p class="detail-empty">—</p>';
  const classes = ['craft-schema', isAlt ? 'alt' : '', className].filter(Boolean).join(' ');

  const schemaHeader = hideSchemaHeader
    ? ''
    : `
    <header class="craft-schema-header">
      <h4>${escapeHtml(schema.name)}</h4>
      ${compact ? renderBuildingBadge(schema) : ''}
    </header>`;

  const bodyContent = `
    ${schemaHeader}
    ${extraContent}
    <div class="craft-io-grid">
      <div class="craft-io-col craft-io-col--inputs">
        <h5>${escapeHtml(t('common.input'))}</h5>
        <div class="craft-io-list">${inputs}</div>
      </div>
      <div class="craft-arrow" aria-hidden="true">→</div>
      <div class="craft-io-col craft-io-col--outputs">
        <h5>${escapeHtml(t('common.output'))}</h5>
        <div class="craft-io-list">${outputs}</div>
      </div>
    </div>`;

  if (compact) {
    return `<article class="${classes}">${bodyContent}</article>`;
  }

  return `
    <article class="${classes}">
      <div class="craft-schema-layout">
        <div class="craft-schema-body">${bodyContent}</div>
        ${renderBuildingPanel(schema, buildingConfig)}
      </div>
    </article>`;
}

function renderDetailContent(detail) {
  const { item, main, alternatives } = detail;
  let html = '';

  if (main.length) {
    html += `<h4 class="detail-section-title">${escapeHtml(t('modals.detailMainSchema'))}</h4>`;
    html += main.map((s) => renderCraftSchema(s, false)).join('');
  }

  if (alternatives.length) {
    html += `<h4 class="detail-section-title alt">${escapeHtml(t('modals.detailAltSchemas', { count: alternatives.length }))}</h4>`;
    html += alternatives.map((s) => renderCraftSchema(s, true)).join('');
  }

  if (!main.length && !alternatives.length) {
    html = `<p class="detail-empty">${escapeHtml(t('modals.detailNoSchemas'))}</p>`;
  }

  return html;
}

async function openDetailModal(itemId) {
  const titleEl = document.getElementById('detail-modal-title');
  const metaEl = document.getElementById('detail-item-meta');
  const imgEl = document.getElementById('detail-item-image');

  detailModalBody.innerHTML = `<p class="loading">${escapeHtml(t('common.loading'))}</p>`;
  detailModal.classList.remove('hidden');
  detailModal.setAttribute('aria-hidden', 'false');

  try {
    const detail = await window.satisfactory.getResourceDetail(itemId);
    if (!detail?.item) {
      detailModalBody.innerHTML = `<p class="detail-empty">${escapeHtml(t('modals.resourceNotFound'))}</p>`;
      return;
    }

    const item = detail.item;
    titleEl.textContent = item.name;
    metaEl.textContent = item.category_name || item.category || '—';

    const descEl = document.getElementById('detail-item-description');
    if (item.description) {
      descEl.textContent = item.description;
      descEl.classList.remove('hidden');
    } else {
      descEl.textContent = '';
      descEl.classList.add('hidden');
    }

    if (item.image) {
      imgEl.src = item.image;
      imgEl.alt = item.name;
      imgEl.hidden = false;
    } else {
      imgEl.hidden = true;
    }

    detailModalBody.innerHTML = renderDetailContent(detail);
  } catch (err) {
    detailModalBody.innerHTML = `<p class="detail-empty">${escapeHtml(t('modals.detailLoadError'))}</p>`;
    console.error('Detail load error:', err);
  }
}

function closeDetailModal() {
  detailModal.classList.add('hidden');
  detailModal.setAttribute('aria-hidden', 'true');
}

