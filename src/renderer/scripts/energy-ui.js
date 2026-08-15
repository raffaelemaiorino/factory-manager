(() => {
  const t = (key, vars) => window.t(key, vars);

  const DELETE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
  const EDIT_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.83H5v-.92l9.06-9.06.92.92L5.92 20.08zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
  const EXPORT_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67 2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/></svg>`;
  const RESET_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`;
  const ADD_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;

  const ENERGY_EXTRACTION_SLUGS = ['coal', 'water'];
  const MINER_OPTIONS = [
    { slug: 'miner-mk1', label: 'Miner Mk.1' },
    { slug: 'miner-mk2', label: 'Miner Mk.2' },
    { slug: 'miner-mk3', label: 'Miner Mk.3' },
  ];
  const PURITY_OPTIONS = [
    { value: 'impure', label: 'Impure' },
    { value: 'normal', label: 'Normal' },
    { value: 'pure', label: 'Pure' },
  ];

  function localizedMinerOptions() {
    const fromUi = productionUi()?.MINER_OPTIONS;
    if (fromUi?.length) return fromUi;
    return [
      { slug: 'miner-mk1', label: t('miners.mk1') },
      { slug: 'miner-mk2', label: t('miners.mk2') },
      { slug: 'miner-mk3', label: t('miners.mk3') },
    ];
  }

  function localizedPurityOptions() {
    const fromUi = productionUi()?.PURITY_OPTIONS;
    if (fromUi?.length) return fromUi;
    return [
      { value: 'impure', label: t('purity.impure') },
      { value: 'normal', label: t('purity.normal') },
      { value: 'pure', label: t('purity.pure') },
    ];
  }
  const NODES_SLIDER_MAX = 25;
  const WATER_NODES_SLIDER_MAX = 2000;

  let energyChains = [];
  let energyChainSummaries = new Map();
  let activeEnergyChainId = null;
  let activeEnergyDetail = null;
  let energyDetailViewMode = 'editor';
  let energyGraphHandle = null;
  let energyExtractionItems = [];
  let energyGeneratorCatalog = [];
  let itemNameBySlug = new Map();
  const extractionConfigDebounce = new Map();
  const generatorConfigDebounce = new Map();

  const energyCreateModal = document.getElementById('energy-create-modal');
  const energyCreateForm = document.getElementById('energy-create-form');
  const energyCreateError = document.getElementById('energy-create-error');
  const energyDetailBody = document.getElementById('energy-detail-body');
  const energyExtractionPickerModal = document.getElementById('energy-extraction-picker-modal');
  const energyGeneratorPickerModal = document.getElementById('energy-generator-picker-modal');

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    const date = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
    if (Number.isNaN(date.getTime())) return iso;
    const locale = window.I18nUI?.getLocale?.() || 'it';
    return date.toLocaleString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatProductionValue(value) {
    const UI = productionUi();
    if (UI.formatProductionValue) return UI.formatProductionValue(value);
    return window.NumberFormat.formatDisplayNumber(value);
  }

  function formatEnergyFuelInputValue(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    if (Math.abs(n - Math.round(n)) < 0.0005) {
      return String(Math.max(1, Math.round(n)));
    }
    return n.toFixed(6).replace(/\.?0+$/, '');
  }

  function formatMw(value) {
    return (productionUi().formatRateWithUnit ?? formatProductionValue)(value, 'MW');
  }

  function formatEnergyIoRateInputValue(rate, overclock = null) {
    const UI = productionUi();
    if (UI.formatOutputInputValue) {
      return UI.formatOutputInputValue(rate, overclock);
    }
    return formatEnergyFuelInputValue(rate);
  }

  function renderEnergyGeneratorIoRateInput(generator, kind, rate, unit, label) {
    const value = formatEnergyIoRateInputValue(rate, generator?.overclock);
    return `
      <span class="production-io-rate">
        <input
          type="text"
          class="production-config-input production-config-decimal-input energy-generator-io-rate-input"
          inputmode="decimal"
          readonly
          data-generator-id="${generator.id}"
          data-io-kind="${escapeHtml(kind)}"
          value="${escapeHtml(value)}"
          aria-label="${escapeHtml(label)} (${escapeHtml(unit)})"
        />
        <span class="production-io-rate-unit">${escapeHtml(unit)}</span>
      </span>`;
  }

  function generatorUsesWater(generator) {
    const definition = window.EnergyScale.getGeneratorDefinition(generator?.building_slug);
    return (definition?.waterPerMin ?? 0) > 0;
  }

  function getGeneratorFuelUnit(generator) {
    return generator?.fuel_is_fluid || generator?.fuel_item?.is_fluid ? 'm³/min' : '/min';
  }

  function formatGeneratorFuelRate(generator, value) {
    const UI = productionUi();
    const unit = getGeneratorFuelUnit(generator);
    return (UI.formatRateWithUnit ?? formatProductionValue)(value, unit);
  }

  function formatGeneratorSubtitle(generator) {
    return `${formatMw(generator.power_output_mw)} · ${formatGeneratorFuelRate(generator, generator.fuel_consumption)} ${generator.fuel_label ?? ''}`.trim();
  }

  function renderGeneratorInputsHtml(generator) {
    const inputs = [
      renderEnergyGeneratorInputWithLinks(generator, generator.fuel_item_slug, {
        name: generator.fuel_item?.name ?? generator.fuel_label ?? t('common.fuel'),
        image: generator.fuel_item?.image ?? null,
        is_fluid: Boolean(generator.fuel_is_fluid || generator.fuel_item?.is_fluid),
      }),
    ];

    if (generatorUsesWater(generator)) {
      inputs.push(
        renderEnergyGeneratorInputWithLinks(generator, 'water', {
          name: generator.water_item?.name ?? t('common.water'),
          image: generator.water_item?.image ?? null,
          is_fluid: true,
        })
      );
    }

    return inputs.join('');
  }

  function showConfirm({ title, message, confirmLabel = t('common.confirm') }) {
    if (typeof window.showConfirm === 'function') {
      return window.showConfirm({ title, message, confirmLabel });
    }
    return Promise.resolve(window.confirm(message));
  }

  function showAlert({ title, message, okLabel = t('common.close') }) {
    if (typeof window.showAlert === 'function') {
      return window.showAlert({ title, message, okLabel });
    }
    window.alert?.(message);
    return Promise.resolve();
  }

  function showImportTypeMismatchAlert(typeMismatch) {
    const { expected, actual } = typeMismatch || {};
    let messageKey = 'errors.importFailed';
    if (expected === 'production' && actual === 'energy') {
      messageKey = 'errors.importEnergyIntoProduction';
    } else if (expected === 'energy' && actual === 'production') {
      messageKey = 'errors.importProductionIntoEnergy';
    }
    return showAlert({
      title: t('errors.importTypeMismatchTitle'),
      message: t(messageKey),
    });
  }

  function getExtractionKind(extraction) {
    return extraction.extraction_kind ?? (extraction.item?.slug === 'water' ? 'water' : 'coal');
  }

  function getExtractionOutputUnit(item, kind) {
    if (kind === 'water') return 'm³/min';
    return 'min';
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
    if (extraction?.max_target_output != null) return extraction.max_target_output;
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

  function getGeneratorFuelSliderMax(generator) {
    if (generator?.max_target_fuel != null) return generator.max_target_fuel;
    const definition = window.EnergyScale.getGeneratorDefinition(generator.building_slug);
    const fuelRate = definition?.fuelOptions?.find((o) => o.slug === generator.fuel_slug)?.ratePerMin ?? 15;
    return window.EnergyScale.computeMaxTargetFuel(fuelRate, generator.machine_count ?? 1);
  }

  function getGeneratorFuelSliderMin(generator) {
    const fuelRate = generator.fuel_rate_base ?? 15;
    return window.EnergyScale.computeMinTargetFuel(fuelRate, generator.machine_count ?? 1);
  }

  function getMachinesSliderMax(generator) {
    const fromValue = Math.round(Number(generator.machine_count) || 1);
    const configured =
      typeof window.getConfiguredMaxEnergyGenerators === 'function'
        ? window.getConfiguredMaxEnergyGenerators()
        : window.EnergyScale?.ENERGY_MACHINE_SLIDER_MAX ?? 600;
    return Math.max(configured, fromValue, 1);
  }

  function productionUi() {
    return window.ProductionUI ?? {};
  }

  function syncEnergyBalanceCache() {
    if (!activeEnergyDetail) return;
    activeEnergyDetail.chainBalanceBySlug = new Map(
      computeEnergyResourceBalance(
        activeEnergyDetail.generators ?? [],
        activeEnergyDetail.extractions ?? []
      ).map((entry) => [entry.item_slug, entry])
    );
  }

  function getEnergyBalanceEntry(itemSlug) {
    return activeEnergyDetail?.chainBalanceBySlug?.get(itemSlug) ?? null;
  }

  function isEnergyBalanceSlug(slug) {
    const UI = productionUi();
    if (UI.isExternalSummarySlug?.(slug)) return true;
    return slug === 'water' || slug === 'coal';
  }

  function getEnergyDemandForProductionStep(stepId, itemSlug) {
    const round = (value) => window.ProductionScale.roundProduction(value);
    let demand = 0;
    const seen = new Set();

    for (const generator of activeEnergyDetail?.generators ?? []) {
      for (const link of getLinkedProductionForInput(generator, itemSlug)) {
        if (Number(link.producer_production_step_id) !== Number(stepId)) continue;
        const key = Number(generator.id);
        if (seen.has(key)) continue;
        seen.add(key);
        if (itemSlug === 'water') {
          demand += generator.water_consumption ?? 0;
        } else {
          demand += generator.fuel_consumption ?? generator.target_fuel_input ?? 0;
        }
      }
    }

    return round(demand);
  }

  function formatEnergyProductionLinkRate(objective, generator, itemSlug) {
    const UI = productionUi();
    const unit = objective.is_fluid ? 'm³/min' : '/min';
    const formatRate = (value) => (UI.formatRateWithUnit ?? formatProductionValue)(value, unit);
    const linkedHere = getLinkedProductionForInput(generator, itemSlug).some(
      (link) => Number(link.producer_production_step_id) === Number(objective.step_id)
    );
    if (linkedHere) {
      return formatRate(objective.rate);
    }

    // excess_rate already subtracts other production + energy outbound demand
    const available = objective.excess_rate ?? objective.rate ?? 0;
    if (
      available > 0 &&
      available + (UI.LINK_BALANCE_TOLERANCE ?? 0.05) < objective.rate
    ) {
      return `${formatRate(available)} liberi`;
    }

    return formatRate(objective.rate);
  }

  function getProductionObjectivesForSlug(itemSlug, generator) {
    const fromObjectives = (activeEnergyDetail?.production_objectives ?? []).filter(
      (objective) => objective.item_slug === itemSlug
    );

    const seen = new Set(fromObjectives.map((objective) => Number(objective.step_id)));
    const fromLinks = getLinkedProductionForInput(generator, itemSlug)
      .filter((link) => !seen.has(Number(link.producer_production_step_id)))
      .map((link) => ({
        step_id: link.producer_production_step_id,
        chain_name: link.producer_chain_name,
        step_name: link.producer_step_name,
        item_slug: itemSlug,
        rate: link.producer_rate,
        excess_rate: 0,
        is_fluid: itemSlug === 'water',
      }));

    return [...fromObjectives, ...fromLinks];
  }

  function getLinkedProductionForInput(generator, itemSlug) {
    return generator.production_input_links?.[itemSlug] ?? [];
  }

  function getLinkedProductionRate(generator, itemSlug) {
    const UI = productionUi();
    const round = (value) => window.ProductionScale.roundProduction(value);
    return round(
      getLinkedProductionForInput(generator, itemSlug).reduce(
        (sum, link) => sum + (link.producer_rate ?? 0),
        0
      )
    );
  }

  function getUniqueLinkedProductionSupply(generators = [], itemSlug) {
    const UI = productionUi();
    const round = (value) => window.ProductionScale.roundProduction(value);
    const seen = new Set();
    let total = 0;

    for (const generator of generators) {
      for (const link of getLinkedProductionForInput(generator, itemSlug)) {
        const key = link.producer_production_step_id;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        total += link.producer_rate ?? 0;
      }
    }

    return round(total);
  }

  function computeEnergyResourceBalance(generators = [], extractions = []) {
    const UI = productionUi();
    const normalize = UI.normalizeLinkDelta ?? ((delta) => Math.max(0, Number(delta) || 0));
    const round = (value) => window.ProductionScale.roundProduction(value);
    const balance = new Map();

    const ensureEntry = (slug, meta = {}) => {
      if (!slug) return null;
      if (!balance.has(slug)) {
        balance.set(slug, {
          item_slug: slug,
          item_name: meta.item_name ?? slug,
          item_image: meta.item_image ?? null,
          is_fluid: Boolean(meta.is_fluid),
          demand: 0,
          produced: 0,
        });
      }
      const entry = balance.get(slug);
      if (meta.item_name) entry.item_name = meta.item_name;
      if (meta.item_image) entry.item_image = meta.item_image;
      if (meta.is_fluid) entry.is_fluid = true;
      return entry;
    };

    for (const generator of generators) {
      if ((generator.water_consumption ?? 0) > 0) {
        const waterEntry = ensureEntry('water', {
          item_name: generator.water_item?.name ?? t('common.water'),
          item_image: generator.water_item?.image ?? null,
          is_fluid: true,
        });
        if (waterEntry) {
          waterEntry.demand = round(waterEntry.demand + generator.water_consumption);
        }
      }

      const fuelSlug = generator.fuel_item_slug;
      if (fuelSlug) {
        const fuelEntry = ensureEntry(fuelSlug, {
          item_name: generator.fuel_item?.name ?? generator.fuel_label ?? fuelSlug,
          item_image: generator.fuel_item?.image ?? null,
          is_fluid: Boolean(generator.fuel_is_fluid || generator.fuel_item?.is_fluid),
        });
        if (fuelEntry) {
          fuelEntry.demand = round(fuelEntry.demand + (generator.fuel_consumption ?? 0));
        }
      }

      if ((generator.waste_output ?? 0) > 0 && generator.waste_item_slug) {
        const wasteEntry = ensureEntry(generator.waste_item_slug, {
          item_name: generator.waste_item?.name ?? generator.waste_label ?? generator.waste_item_slug,
          item_image: generator.waste_item?.image ?? null,
        });
        if (wasteEntry) {
          wasteEntry.produced = round(wasteEntry.produced + generator.waste_output);
        }
      }
    }

    for (const extraction of extractions) {
      const slug = extraction.item?.slug;
      const entry = ensureEntry(slug, {
        item_name: extraction.item?.name,
        item_image: extraction.item?.image ?? null,
        is_fluid: slug === 'water',
      });
      if (entry) {
        entry.produced = round(entry.produced + (extraction.output_rate ?? 0));
      }
    }

    for (const entry of balance.values()) {
      const productionSupply = getUniqueLinkedProductionSupply(generators, entry.item_slug);
      if (productionSupply > 0) {
        entry.produced = round(entry.produced + productionSupply);
      }
    }

    return [...balance.values()]
      .map((entry) => ({
        ...entry,
        missing: normalize(
          entry.demand - entry.produced,
          Math.max(entry.demand, entry.produced)
        ),
      }))
      .filter((entry) => entry.demand > 0.05 || entry.produced > 0.05);
  }

  function renderEnergyGeneratorInputWithLinks(generator, itemSlug, itemMeta) {
    const UI = productionUi();
    const unit = itemMeta.is_fluid ? 'm³/min' : '/min';
    const requiredRate =
      itemSlug === 'water' ? generator.water_consumption ?? 0 : generator.fuel_consumption ?? 0;

    const linkedProduction = getLinkedProductionForInput(generator, itemSlug);
    const linkedProductionRate = getLinkedProductionRate(generator, itemSlug);
    const productionCandidates = getProductionObjectivesForSlug(itemSlug, generator);

    let linkState = null;
    let linkStateClass = '';
    let externalRate = 0;
    let linkedExcessRate = 0;
    let externalCovered = false;

    if (linkedProduction.length > 0) {
      const resolved = UI.resolveInputLinkBalance?.(
        generator,
        itemSlug,
        linkedProductionRate,
        requiredRate
      ) ?? { state: 'balanced', externalRate: 0, linkedExcessRate: 0, externalCovered: false };
      linkState = resolved.state;
      externalRate = resolved.externalRate;
      linkedExcessRate = resolved.linkedExcessRate;
      externalCovered = resolved.externalCovered;

      if (linkState === 'deficit' && externalRate > 0 && isEnergyBalanceSlug(itemSlug)) {
        const chainBalanceEntry = getEnergyBalanceEntry(itemSlug);
        const tolerance = UI.LINK_BALANCE_TOLERANCE ?? 0.05;
        if (chainBalanceEntry && chainBalanceEntry.missing <= tolerance) {
          const chainState = UI.getLinkBalanceState?.(
            chainBalanceEntry.produced,
            chainBalanceEntry.demand
          );
          const chainExcess =
            UI.normalizeLinkDelta?.(
              chainBalanceEntry.produced - chainBalanceEntry.demand,
              chainBalanceEntry.produced
            ) ?? 0;
          if (chainState === 'excess' && chainExcess > tolerance) {
            linkState = 'excess';
            linkedExcessRate = chainExcess;
            externalCovered = true;
          } else {
            linkState = 'balanced';
            externalCovered = true;
          }
        }
      }

      linkStateClass = UI.getLinkStateClass?.(linkState, true) ?? '';
    } else {
      const chainBalanceEntry = isEnergyBalanceSlug(itemSlug) ? getEnergyBalanceEntry(itemSlug) : null;
      if (chainBalanceEntry && chainBalanceEntry.demand > (UI.LINK_BALANCE_TOLERANCE ?? 0.05)) {
        linkState = UI.getLinkBalanceState?.(chainBalanceEntry.produced, chainBalanceEntry.demand);
        linkStateClass = UI.getLinkStateClass?.(linkState, true) ?? '';
      }
    }

    const formatRate = (value) => (UI.formatRateWithUnit ?? formatProductionValue)(value, unit);

    const img = itemMeta.image
      ? `<img src="${escapeHtml(itemMeta.image)}" alt="" />`
      : '<span class="resource-img resource-img--placeholder" style="width:28px;height:28px"></span>';

    const ioKind = itemSlug === 'water' ? 'water' : 'fuel';
    const rateInput = renderEnergyGeneratorIoRateInput(
      generator,
      ioKind,
      requiredRate,
      unit,
      itemMeta.name ?? itemSlug
    );

    const chainBalanceEntry = isEnergyBalanceSlug(itemSlug) ? getEnergyBalanceEntry(itemSlug) : null;

    const linkedBadge =
      linkedProduction.length > 0
        ? `<div class="production-input-linked">
            ${linkedProduction
              .map(
                (link) =>
                  `<span class="production-link-badge">← ${escapeHtml(link.producer_chain_name)} (${formatRate(link.producer_rate)})</span>`
              )
              .join('')}
            ${
              linkState === 'balanced' && externalCovered && externalRate > 0
                ? `<span class="production-link-covered">${escapeHtml(t('production.linkFromExtractionRate', { rate: formatRate(externalRate) }))}</span>
                   <span class="production-link-covered">${escapeHtml(t('production.linkFullyCovered'))}</span>`
                : linkState === 'excess' && externalCovered && externalRate > 0
                  ? `<span class="production-link-covered">${escapeHtml(t('production.linkFromExtractionRate', { rate: formatRate(externalRate) }))}</span>
                     <span class="production-link-external">${escapeHtml(t('production.linkChainExcess', { rate: formatRate(linkedExcessRate) }))}</span>`
                  : linkState === 'balanced'
                    ? `<span class="production-link-covered">${escapeHtml(t('production.linkFullyCovered'))}</span>`
                    : linkState === 'excess'
                      ? `<span class="production-link-external">${escapeHtml(t('production.linkExcessLinked', { rate: formatRate(linkedExcessRate) }))}</span>`
                      : externalRate > 0
                        ? `<span class="production-link-deficit">${escapeHtml(t('production.linkExternal', { rate: formatRate(externalRate) }))}</span>`
                        : `<span class="production-link-deficit">${escapeHtml(t('production.linkMissing', { rate: formatRate(Math.max(0, requiredRate - linkedProductionRate)) }))}</span>`
            }
          </div>`
        : chainBalanceEntry && linkState
          ? `<div class="production-input-linked">
              ${
                linkState === 'balanced'
                  ? `<span class="production-link-covered">${escapeHtml(t('production.linkCoveredByExtractions'))}</span>`
                  : linkState === 'excess'
                    ? `<span class="production-link-external">${escapeHtml(
                        t('production.linkChainExcess', {
                          rate: formatRate(
                            UI.normalizeLinkDelta?.(
                              chainBalanceEntry.produced - chainBalanceEntry.demand,
                              chainBalanceEntry.produced
                            ) ?? 0
                          ),
                        })
                      )}</span>`
                    : `<span class="production-link-deficit">${escapeHtml(t('production.linkMissingInChain', { rate: formatRate(chainBalanceEntry.missing) }))}</span>`
              }
            </div>`
          : '';

    const productionLinkSection =
      productionCandidates.length > 0
        ? `<div class="production-input-links">
            <span class="production-input-links-label">${escapeHtml(t('production.linkFromProduction'))}</span>
            <div class="production-link-options">
              ${productionCandidates
                .map((objective) => {
                  const checked = linkedProduction.some(
                    (link) => link.producer_production_step_id === objective.step_id
                  );
                  return `
                  <label class="production-link-option">
                    <input
                      type="checkbox"
                      class="energy-production-link-checkbox"
                      data-generator-id="${generator.id}"
                      data-item-slug="${escapeHtml(itemSlug)}"
                      data-producer-step-id="${objective.step_id}"
                      ${checked ? 'checked' : ''}
                    />
                    <span>${escapeHtml(objective.chain_name)}</span>
                    <span class="production-link-rate">(${formatEnergyProductionLinkRate(objective, generator, itemSlug)})</span>
                  </label>`;
                })
                .join('')}
            </div>
          </div>`
        : '';

    const allExtractions = activeEnergyDetail?.extractions ?? [];
    const linkedExtractionEntries = generator.input_links?.[itemSlug] ?? [];
    const extractionCandidates = allExtractions.filter((extraction) => {
      if (extraction.item?.slug !== itemSlug) return false;
      if (isExtractionLinkedToGenerator(generator, extraction.id, itemSlug)) return true;
      return getEnergyExtractionConsumerCandidates(
        extraction,
        activeEnergyDetail?.generators ?? [],
        allExtractions
      ).some((candidate) => Number(candidate.id) === Number(generator.id));
    });

    const extractionBadges =
      linkedExtractionEntries.length > 0
        ? linkedExtractionEntries
            .map((link) => {
              const extraction = allExtractions.find(
                (item) => Number(item.id) === Number(link.producer_extraction_id)
              );
              const name = extraction
                ? getExtractionDisplayName(extraction, allExtractions)
                : link.producer_name || itemSlug;
              const rate = extraction?.output_rate ?? link.producer_rate ?? 0;
              return `<span class="production-link-badge">← ${escapeHtml(name)} (${formatRate(rate)})</span>`;
            })
            .join('')
        : '';

    const extractionLinkSection =
      extractionCandidates.length > 0
        ? `<div class="production-input-links">
            <span class="production-input-links-label">${escapeHtml(t('production.linkFromExtraction'))}</span>
            <div class="production-link-options">
              ${extractionCandidates
                .map((extraction) => {
                  const checked = isExtractionLinkedToGenerator(
                    generator,
                    extraction.id,
                    itemSlug
                  );
                  const rateLabel = formatEnergyExtractionConsumerLinkRate(
                    generator,
                    extraction,
                    itemSlug,
                    allExtractions,
                    unit
                  );
                  return `
                  <label class="production-link-option">
                    <input
                      type="checkbox"
                      class="energy-extraction-link-checkbox"
                      data-generator-id="${generator.id}"
                      data-extraction-id="${extraction.id}"
                      data-item-slug="${escapeHtml(itemSlug)}"
                      ${checked ? 'checked' : ''}
                    />
                    <span>${escapeHtml(getExtractionDisplayName(extraction, allExtractions))}</span>
                    <span class="production-link-rate">(${rateLabel})</span>
                  </label>`;
                })
                .join('')}
            </div>
          </div>`
        : '';

    return `
      <div class="craft-io-item craft-io-item--with-links ${linkStateClass}" data-item-slug="${escapeHtml(itemSlug)}">
        <div class="production-input-add-trigger production-input-static">
          ${img}
          <span>${escapeHtml(itemMeta.name ?? itemSlug)}</span>
          ${rateInput}
        </div>
        ${
          extractionBadges
            ? `<div class="production-input-linked">${extractionBadges}</div>`
            : ''
        }
        ${linkedBadge}
        ${extractionLinkSection}
        ${productionLinkSection}
      </div>`;
  }

  function renderEnergyGeneratorOutputs(generator) {
    const powerLabel = 'Elettricità';
    const parts = [
      `
      <div class="craft-io-item">
        <span class="craft-io-icon" aria-hidden="true">⚡</span>
        <span>${escapeHtml(powerLabel)}</span>
        ${renderEnergyGeneratorIoRateInput(
          generator,
          'power',
          generator.power_output_mw ?? 0,
          'MW',
          powerLabel
        )}
      </div>`,
    ];

    if ((generator.waste_output ?? 0) > 0 && generator.waste_item_slug) {
      const wasteName =
        generator.waste_item?.name ?? generator.waste_label ?? generator.waste_item_slug;
      const img = generator.waste_item?.image
        ? `<img src="${escapeHtml(generator.waste_item.image)}" alt="" />`
        : '<span class="resource-img resource-img--placeholder" style="width:28px;height:28px"></span>';
      parts.push(`
      <div class="craft-io-item">
        ${img}
        <span>${escapeHtml(wasteName)}</span>
        ${renderEnergyGeneratorIoRateInput(
          generator,
          'waste',
          generator.waste_output ?? 0,
          '/min',
          wasteName
        )}
      </div>`);
    }

    return parts.join('');
  }

  function getExtractionDisplayName(extraction, allExtractions = []) {
    const baseName = extraction.item?.name || t('common.resource');
    const sameItem = allExtractions
      .filter((item) => item.item_id === extraction.item_id)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    if (sameItem.length <= 1) return baseName;
    const index = sameItem.findIndex((item) => item.id === extraction.id);
    return index >= 0 ? `${baseName} #${index + 1}` : baseName;
  }

  /**
   * Explicit extraction→generator links (same idea as production extraction→step).
   * When no links exist on this extraction, unused output is treated as excess.
   */
  function getGeneratorDemandForSlug(generator, itemSlug) {
    if (!generator || !itemSlug) return 0;
    if (itemSlug === 'water') return generator.water_consumption ?? 0;
    if (itemSlug === generator.fuel_item_slug) return generator.fuel_consumption ?? 0;
    return 0;
  }

  function getGeneratorRemainingNeedFromExtraction(generator, itemSlug) {
    const UI = productionUi();
    const normalize = UI.normalizeLinkDelta ?? ((delta) => Math.max(0, Number(delta) || 0));
    const need = getGeneratorDemandForSlug(generator, itemSlug);
    const fromProduction = getLinkedProductionRate(generator, itemSlug);
    return normalize(need - fromProduction, need);
  }

  function isExtractionLinkedToGenerator(generator, extractionId, itemSlug) {
    return (generator.input_links?.[itemSlug] ?? []).some(
      (link) => Number(link.producer_extraction_id) === Number(extractionId)
    );
  }

  function getGeneratorDisplayName(generator, allGenerators = []) {
    const base = generator.building_name || generator.building_slug || t('common.generator');
    const same = allGenerators
      .filter((item) => item.building_slug === generator.building_slug)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    if (same.length <= 1) return `${base} (${formatMw(generator.power_output_mw)})`;
    const index = same.findIndex((item) => item.id === generator.id);
    const suffix = index >= 0 ? ` #${index + 1}` : '';
    return `${base}${suffix} (${formatMw(generator.power_output_mw)})`;
  }

  function getLinkedGeneratorsForExtraction(
    extraction,
    generators = activeEnergyDetail?.generators ?? []
  ) {
    const itemSlug = extraction.item?.slug;
    if (!itemSlug) return [];
    return generators.filter((generator) =>
      isExtractionLinkedToGenerator(generator, extraction.id, itemSlug)
    );
  }

  function getEnergyExtractionAttributedDemand(
    extraction,
    generators = activeEnergyDetail?.generators ?? [],
    allExtractions = activeEnergyDetail?.extractions ?? []
  ) {
    const UI = productionUi();
    const round = (value) => window.ProductionScale.roundProduction(value);
    const itemSlug = extraction.item?.slug;
    if (!itemSlug) return 0;

    let demand = 0;
    for (const generator of getLinkedGeneratorsForExtraction(extraction, generators)) {
      const remaining = getGeneratorRemainingNeedFromExtraction(generator, itemSlug);
      const linkedExtractions = allExtractions.filter((candidate) =>
        isExtractionLinkedToGenerator(generator, candidate.id, itemSlug)
      );
      const totalOutput = linkedExtractions.reduce(
        (sum, candidate) => sum + (candidate.output_rate ?? candidate.target_output ?? 0),
        0
      );
      const outputRate = extraction.output_rate ?? extraction.target_output ?? 0;
      const share =
        totalOutput > 0 ? (outputRate / totalOutput) * remaining : remaining / Math.max(1, linkedExtractions.length);
      demand = round(demand + share);
    }
    return demand;
  }

  function getEnergyExtractionOutputSurplus(extraction, generators, allExtractions) {
    const UI = productionUi();
    const normalize = UI.normalizeLinkDelta ?? ((delta) => Math.max(0, Number(delta) || 0));
    const outputRate = extraction.output_rate ?? extraction.target_output ?? 0;
    const demand = getEnergyExtractionAttributedDemand(extraction, generators, allExtractions);
    return normalize(outputRate - demand, outputRate);
  }

  function getEnergyExtractionLinkedShortfall(extraction, generators, allExtractions) {
    const UI = productionUi();
    const normalize = UI.normalizeLinkDelta ?? ((delta) => Math.max(0, Number(delta) || 0));
    const itemSlug = extraction.item?.slug;
    if (!itemSlug) return 0;

    let shortfall = 0;
    for (const generator of getLinkedGeneratorsForExtraction(extraction, generators)) {
      const remaining = getGeneratorRemainingNeedFromExtraction(generator, itemSlug);
      const linkedExtractions = allExtractions.filter((candidate) =>
        isExtractionLinkedToGenerator(generator, candidate.id, itemSlug)
      );
      const covered = linkedExtractions.reduce(
        (sum, candidate) => sum + (candidate.output_rate ?? candidate.target_output ?? 0),
        0
      );
      shortfall += normalize(remaining - covered, remaining);
    }
    return shortfall;
  }

  function getEnergyExtractionConsumerCandidates(
    extraction,
    generators = activeEnergyDetail?.generators ?? [],
    allExtractions = activeEnergyDetail?.extractions ?? []
  ) {
    const UI = productionUi();
    const tolerance = UI.LINK_BALANCE_TOLERANCE ?? 0.05;
    const itemSlug = extraction.item?.slug;
    if (!itemSlug || !isEnergyBalanceSlug(itemSlug)) return [];

    return generators.filter((generator) => {
      const demand = getGeneratorDemandForSlug(generator, itemSlug);
      if (demand <= tolerance) return false;
      if (isExtractionLinkedToGenerator(generator, extraction.id, itemSlug)) return true;

      const remaining = getGeneratorRemainingNeedFromExtraction(generator, itemSlug);
      if (remaining <= tolerance) return false;

      const linkedExtractions = allExtractions.filter((candidate) =>
        isExtractionLinkedToGenerator(generator, candidate.id, itemSlug)
      );
      const covered = linkedExtractions.reduce(
        (sum, candidate) => sum + (candidate.output_rate ?? candidate.target_output ?? 0),
        0
      );
      if (covered + tolerance >= remaining) return false;

      const surplus = getEnergyExtractionOutputSurplus(extraction, generators, allExtractions);
      const hasNoLinks = getLinkedGeneratorsForExtraction(extraction, generators).length === 0;
      return hasNoLinks || surplus > tolerance;
    });
  }

  function formatEnergyExtractionConsumerLinkRate(
    generator,
    extraction,
    itemSlug,
    allExtractions,
    unit
  ) {
    const UI = productionUi();
    const formatRate = (value) =>
      (UI.formatRateWithUnit ?? formatProductionValue)(value, unit);
    const remaining = getGeneratorRemainingNeedFromExtraction(generator, itemSlug);
    if (isExtractionLinkedToGenerator(generator, extraction.id, itemSlug)) {
      const linkedExtractions = allExtractions.filter((candidate) =>
        isExtractionLinkedToGenerator(generator, candidate.id, itemSlug)
      );
      const totalOutput = linkedExtractions.reduce(
        (sum, candidate) => sum + (candidate.output_rate ?? candidate.target_output ?? 0),
        0
      );
      const outputRate = extraction.output_rate ?? extraction.target_output ?? 0;
      const share =
        totalOutput > 0 ? (outputRate / totalOutput) * remaining : remaining;
      if (share + (UI.LINK_BALANCE_TOLERANCE ?? 0.05) < remaining && linkedExtractions.length > 1) {
        return t('production.linkPartialRate', {
          allocated: formatRate(share),
          required: formatRate(remaining),
        });
      }
      return formatRate(share > 0 ? share : remaining);
    }

    const surplus = getEnergyExtractionOutputSurplus(
      extraction,
      activeEnergyDetail?.generators ?? [],
      allExtractions
    );
    if (surplus + (UI.LINK_BALANCE_TOLERANCE ?? 0.05) < remaining) {
      return t('production.surplusFree', { rate: formatRate(surplus) });
    }
    return formatRate(remaining);
  }

  function buildEnergyExtractionLinkUi(
    extraction,
    allExtractions = [],
    generators = activeEnergyDetail?.generators ?? []
  ) {
    const UI = productionUi();
    const tolerance = UI.LINK_BALANCE_TOLERANCE ?? 0.05;
    const item = extraction.item;
    const itemSlug = item?.slug ?? null;
    const kind = getExtractionKind(extraction);
    const outputUnit = UI.getExtractionOutputUnit?.(item, kind) ?? getExtractionOutputUnit(item, kind);
    const formatRate = (value) =>
      (UI.formatRateWithUnit ?? formatProductionValue)(value, outputUnit);
    const outputRate = extraction.output_rate ?? extraction.target_output ?? 0;

    const linkedGenerators = itemSlug ? getLinkedGeneratorsForExtraction(extraction, generators) : [];
    const consumerCandidates = itemSlug
      ? getEnergyExtractionConsumerCandidates(extraction, generators, allExtractions)
      : [];
    const unlinkedExcess = itemSlug
      ? linkedGenerators.length === 0
        ? outputRate
        : getEnergyExtractionOutputSurplus(extraction, generators, allExtractions)
      : 0;
    const linkedShortfall =
      itemSlug && linkedGenerators.length > 0
        ? getEnergyExtractionLinkedShortfall(extraction, generators, allExtractions)
        : 0;

    const showLinkVisual =
      Boolean(itemSlug && isEnergyBalanceSlug(itemSlug)) && outputRate > tolerance;

    let linkState = null;
    if (showLinkVisual) {
      if (linkedGenerators.length === 0) {
        linkState = 'excess';
      } else if (linkedShortfall > tolerance) {
        linkState = 'deficit';
      } else if (unlinkedExcess > tolerance) {
        linkState = 'excess';
      } else {
        linkState = 'balanced';
      }
    }

    const linkStateClass =
      UI.getExtractionLinkStateClass?.(
        linkState,
        showLinkVisual && (linkedGenerators.length > 0 || unlinkedExcess > tolerance)
      ) ??
      (linkState === 'balanced'
        ? 'production-extraction--linked-full'
        : linkState === 'deficit'
          ? 'production-extraction--linked-deficit'
          : linkState === 'excess'
            ? 'production-extraction--linked-partial'
            : '');

    const statusMessage =
      linkState === 'balanced'
        ? `<span class="production-link-covered">${escapeHtml(t('production.linkFullyUsed'))}</span>`
        : linkState === 'excess' && unlinkedExcess > tolerance
          ? `<span class="production-link-external">${escapeHtml(t('production.linkExcess', { rate: formatRate(unlinkedExcess) }))}</span>`
          : linkState === 'deficit' && linkedShortfall > tolerance
            ? `<span class="production-link-deficit">${escapeHtml(t('production.linkMissingForLinked', { rate: formatRate(linkedShortfall) }))}</span>`
            : '';

    const html =
      linkedGenerators.length > 0 || consumerCandidates.length > 0 || statusMessage
        ? `<div class="production-extraction-links">
            ${
              linkedGenerators.length > 0 || statusMessage
                ? `<div class="production-extraction-linked">
                    ${linkedGenerators
                      .map((generator) => {
                        const remaining = getGeneratorRemainingNeedFromExtraction(
                          generator,
                          itemSlug
                        );
                        const linkedExtractions = allExtractions.filter((candidate) =>
                          isExtractionLinkedToGenerator(generator, candidate.id, itemSlug)
                        );
                        const totalOutput = linkedExtractions.reduce(
                          (sum, candidate) =>
                            sum + (candidate.output_rate ?? candidate.target_output ?? 0),
                          0
                        );
                        const output = extraction.output_rate ?? extraction.target_output ?? 0;
                        const allocated =
                          totalOutput > 0 ? (output / totalOutput) * remaining : remaining;
                        const partial =
                          allocated + tolerance < remaining && remaining > tolerance;
                        const rateLabel = formatRate(allocated);
                        return `<span class="production-link-badge production-link-badge--consumer${
                          partial ? ' production-link-badge--partial' : ''
                        }">→ ${escapeHtml(getGeneratorDisplayName(generator, generators))} (${rateLabel})</span>`;
                      })
                      .join('')}
                    ${statusMessage}
                  </div>`
                : ''
            }
            ${
              consumerCandidates.length > 0
                ? `<div class="production-input-links">
                    <span class="production-input-links-label">${escapeHtml(t('energy.linkToGenerator'))}</span>
                    <div class="production-link-options">
                      ${consumerCandidates
                        .map((generator) => {
                          const checked = isExtractionLinkedToGenerator(
                            generator,
                            extraction.id,
                            itemSlug
                          );
                          const rateLabel = formatEnergyExtractionConsumerLinkRate(
                            generator,
                            extraction,
                            itemSlug,
                            allExtractions,
                            outputUnit
                          );
                          return `
                            <label class="production-link-option">
                              <input
                                type="checkbox"
                                class="energy-extraction-generator-link-checkbox"
                                data-generator-id="${generator.id}"
                                data-extraction-id="${extraction.id}"
                                data-item-slug="${escapeHtml(itemSlug)}"
                                ${checked ? 'checked' : ''}
                              />
                              <span>${escapeHtml(getGeneratorDisplayName(generator, generators))}</span>
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

  function updateEnergyExtractionBalanceDisplay(extractionEl, extraction, allExtractions) {
    const { linkStateClass, html } = buildEnergyExtractionLinkUi(
      extraction,
      allExtractions,
      activeEnergyDetail?.generators ?? []
    );

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

  function refreshAllEnergyExtractionBalanceDisplays() {
    const extractions = activeEnergyDetail?.extractions ?? [];
    for (const extraction of extractions) {
      const extractionEl = energyDetailBody?.querySelector?.(
        `[data-extraction-id="${extraction.id}"]`
      );
      if (extractionEl) {
        updateEnergyExtractionBalanceDisplay(extractionEl, extraction, extractions);
      }
    }
  }

  function renderEnergySummary(detail) {
    const generators = detail?.generators ?? [];
    const extractions = detail?.extractions ?? [];
    if (!generators.length && !extractions.length) return '';

    const UI = productionUi();
    const tolerance = UI.LINK_BALANCE_TOLERANCE ?? 0.05;
    const totalMw = generators.reduce((sum, gen) => sum + (gen.power_output_mw ?? 0), 0);
    const balance = computeEnergyResourceBalance(generators, extractions).sort((a, b) =>
      (a.item_name || a.item_slug).localeCompare(b.item_name || b.item_slug, 'it')
    );

    const rows = [];
    if (generators.length && totalMw > 0) {
      const inputsBalanced = balance.every((entry) => entry.missing <= tolerance);
      rows.push(`
        <tr${inputsBalanced ? ' class="production-external-row--balanced"' : ''}>
          <td>${escapeHtml(t('energy.totalPower'))}</td>
          <td class="production-external-rate"></td>
          <td class="production-external-rate">${formatMw(totalMw)}</td>
          <td class="production-external-rate"></td>
        </tr>`);
    }

    for (const entry of balance) {
      const coverageState = UI.getLinkBalanceState?.(entry.produced, entry.demand) ?? 'balanced';
      let rowClass = '';
      if (coverageState === 'balanced') rowClass = 'production-external-row--balanced';
      else if (coverageState === 'deficit') rowClass = 'production-external-row--deficit';
      else if (coverageState === 'excess') rowClass = 'production-external-row--partial';

      const img = entry.item_image
        ? `<img class="production-external-icon" src="${escapeHtml(entry.item_image)}" alt="" />`
        : '<span class="resource-img resource-img--placeholder production-external-icon"></span>';
      const unit = entry.is_fluid ? 'm³/min' : '/min';
      const formatQty = (value) =>
        (UI.formatRateWithUnit ?? ((v, u) => `${formatProductionValue(v)}${u}`))(value, unit);
      const missingCell = entry.missing > tolerance ? formatQty(entry.missing) : '';

      rows.push(`
        <tr${rowClass ? ` class="${rowClass}"` : ''}>
          <td class="production-external-resource">
            ${img}
            <span>${escapeHtml(entry.item_name || entry.item_slug)}</span>
          </td>
          <td class="production-external-rate">${formatQty(entry.demand)}</td>
          <td class="production-external-rate">${formatQty(entry.produced)}</td>
          <td class="production-external-rate">${missingCell}</td>
        </tr>`);
    }

    const powerShardsHtml =
      UI.renderPowerShardsSummary?.(
        UI.computeDetailPowerShards?.(generators, extractions) ?? 0,
        UI.computeExtractionsPowerMw?.(extractions) ?? 0
      ) ??
      '';

    if (!rows.length && !powerShardsHtml) return '';

    const mineralsHtml = rows.length
      ? `
      <div class="production-external-summary-inner production-external-summary-inner--minerals">
        <table class="production-external-table production-external-table--resources">
          <thead>
            <tr>
              <th>${escapeHtml(t('common.resource'))}</th>
              <th class="production-external-rate">${escapeHtml(t('energy.summaryRequired'))}</th>
              <th class="production-external-rate">${escapeHtml(t('energy.summaryProduced'))}</th>
              <th class="production-external-rate">${escapeHtml(t('energy.summaryMissing'))}</th>
            </tr>
          </thead>
          <tbody>${rows.join('')}</tbody>
        </table>
      </div>`
      : '';

    return `<div class="production-external-summary-stack">${powerShardsHtml}${mineralsHtml}</div>`;
  }

  function renderEnergyChains() {
    const container = document.getElementById('energy-container');
    if (!energyChains.length) {
      container.innerHTML = `
        <section class="card production-empty">
          <p class="empty-state">${escapeHtml(t('energy.emptyList'))}</p>
          <p class="production-empty-hint">${escapeHtml(t('energy.emptyListHint'))}</p>
        </section>`;
      return;
    }

    container.innerHTML = `
      <section class="card">
        <div class="production-list">
          ${energyChains.map(renderEnergyChainCard).join('')}
        </div>
      </section>`;
  }

  function renderEnergyChainCard(chain) {
    const detail = energyChainSummaries.get(chain.id);
    const summaryHtml = detail ? renderEnergySummary(detail) : '';

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

  async function loadEnergyChainSummaries() {
    const summaries = await Promise.all(
      energyChains.map((chain) =>
        window.satisfactory.getEnergyChainDetail(chain.id).catch((err) => {
          console.error('Energy summary load error:', chain.id, err);
          return null;
        })
      )
    );

    energyChainSummaries = new Map();
    energyChains.forEach((chain, index) => {
      const detail = summaries[index];
      if (detail) energyChainSummaries.set(chain.id, detail);
    });
  }

  async function loadEnergyChains() {
    const container = document.getElementById('energy-container');
    const hasRenderedList = Boolean(
      container.querySelector('.production-list, .production-empty')
    );
    if (!hasRenderedList) {
      container.innerHTML = `<p class="loading">${escapeHtml(t('common.loadingSchemas'))}</p>`;
    }

    try {
      energyChains = await window.satisfactory.getEnergyChains();
      renderEnergyChains();
      await loadEnergyChainSummaries();
      renderEnergyChains();
    } catch (err) {
      container.innerHTML = `<p class="empty-state">${escapeHtml(t('energy.errorLoadList'))}</p>`;
      console.error('Energy load error:', err);
    }
  }

  function renderEnergyExtraction(extraction, allExtractions = []) {
    const UI = productionUi();
    const displayName = getExtractionDisplayName(extraction, allExtractions);
    const item = extraction.item;
    const kind = getExtractionKind(extraction);
    const itemSlug = item?.slug ?? null;
    const outputUnit = UI.getExtractionOutputUnit?.(item, kind) ?? getExtractionOutputUnit(item, kind);
    const nodeCount = extraction.node_count ?? 1;
    const nodesSliderMax = getNodesSliderMax(nodeCount, extraction);
    const targetOutput =
      extraction.target_output ??
      extraction.output_rate ??
      UI.computeClientExtractionRate?.(
        extraction.miner_slug,
        extraction.purity,
        extraction.overclock,
        nodeCount,
        itemSlug
      ) ??
      0;
    const outputRate = extraction.output_rate ?? targetOutput;
    const outputSliderMax = UI.getExtractionOutputSliderMax?.(extraction) ?? getExtractionOutputSliderMax(extraction);
    const outputSliderMin = UI.getExtractionOutputSliderMin?.(extraction) ?? 1;
    const outputSliderStep = UI.getExtractionOutputSliderStep?.(extraction) ?? 1;
    const fractionalExtractionOutput = UI.usesFractionalExtractionOutput?.(extraction) ?? false;
    const outputDisplayValue =
      UI.formatExtractionOutputInputValue?.(targetOutput, extraction.overclock) ??
      String(Math.round(targetOutput));
    const defaultBuildingName =
      kind === 'water' ? t('energy.defaultWaterExtractor') : t('energy.defaultMiner');

    const img = item?.image
      ? `<img class="production-extraction-image" src="${escapeHtml(item.image)}" alt="" />`
      : '<span class="resource-img resource-img--placeholder production-extraction-image"></span>';
    const buildingImg = extraction.building_image
      ? `<img src="${escapeHtml(extraction.building_image)}" alt="" />`
      : '<span class="resource-img resource-img--placeholder"></span>';

    const minerField =
      kind === 'coal'
        ? `
            <div class="production-config-field production-config-field--select">
              <span class="production-config-label">${escapeHtml(t('production.configMiner'))}</span>
              ${UI.renderThemeSelect({
                id: `energy-extraction-miner-${extraction.id}`,
                options: localizedMinerOptions().map((miner) => ({
                  value: miner.slug,
                  label: miner.label,
                })),
                selectedValue: extraction.miner_slug,
                dataset: { extractionId: extraction.id, field: 'miner' },
              })}
            </div>`
        : '';

    const purityField =
      kind === 'coal'
        ? `
            <div class="production-config-field production-config-field--select">
              <span class="production-config-label">${escapeHtml(t('production.configPurity'))}</span>
              ${UI.renderThemeSelect({
                id: `energy-extraction-purity-${extraction.id}`,
                options: localizedPurityOptions().map((purity) => ({
                  value: purity.value,
                  label: purity.label,
                })),
                selectedValue: extraction.purity,
                dataset: { extractionId: extraction.id, field: 'purity' },
              })}
            </div>`
        : '';

    const nodesLabel = kind === 'water' ? t('production.configExtractors') : t('production.configNodes');
    const subtitle =
      kind === 'water'
        ? t('extraction.water')
        : extraction.item?.slug === 'coal'
          ? t('extraction.coal')
          : UI.getExtractionSubtitle?.('mineral') ?? t('energy.extractionCoal');
    const { linkStateClass, html: balanceSection } = buildEnergyExtractionLinkUi(
      extraction,
      allExtractions,
      activeEnergyDetail?.generators ?? []
    );

    return `
      <article class="production-extraction ${linkStateClass}" data-extraction-id="${extraction.id}">
        <div class="production-extraction-layout">
          <div class="production-extraction-main">
            <header class="production-extraction-header">
              ${img}
              <div class="production-extraction-title">
                <h4>${escapeHtml(displayName)}</h4>
                <p>${escapeHtml(subtitle)}</p>
              </div>
              <div class="production-step-actions">
                <button type="button" class="production-step-reset-btn energy-extraction-duplicate-btn" data-item-id="${extraction.item_id}" aria-label="${escapeHtml(t('production.duplicateExtraction'))}" title="${escapeHtml(t('production.addAnotherExtraction'))}">${ADD_ICON}</button>
                <button type="button" class="production-step-reset-btn energy-extraction-reset-btn" data-extraction-id="${extraction.id}" aria-label="${escapeHtml(t('actions.reset'))}" title="${escapeHtml(t('production.resetDefaults'))}">${RESET_ICON}</button>
                <button type="button" class="production-step-delete-btn energy-extraction-delete-btn" data-extraction-id="${extraction.id}" aria-label="${escapeHtml(t('actions.delete'))}">${DELETE_ICON}</button>
              </div>
            </header>
            <div class="production-config-grid">
              ${minerField}
              ${purityField}
              <div class="production-config-field">
                <label class="production-config-label" for="energy-extraction-output-${extraction.id}">Output (${outputUnit})</label>
                <input type="text" class="production-config-input production-extraction-output-input production-config-decimal-input" id="energy-extraction-output-${extraction.id}" data-extraction-id="${extraction.id}" min="${outputSliderMin}" max="${outputSliderMax}" inputmode="decimal" readonly value="${outputDisplayValue}" />
                <input type="range" class="production-config-slider production-extraction-output-slider" data-extraction-id="${extraction.id}" min="${outputSliderMin}" max="${outputSliderMax}" step="${outputSliderStep}" value="${fractionalExtractionOutput ? targetOutput : Math.round(targetOutput)}" aria-label="${escapeHtml(t('production.adjustExtractionOutput'))}" />
              </div>
              <div class="production-config-field">
                <label class="production-config-label" for="energy-extraction-overclock-${extraction.id}">${escapeHtml(t('production.configOverclock'))}</label>
                <input type="number" class="production-config-input production-extraction-overclock-input" id="energy-extraction-overclock-${extraction.id}" data-extraction-id="${extraction.id}" min="${window.EnergyScale.OVERCLOCK_MIN}" max="${window.EnergyScale.OVERCLOCK_MAX}" step="1" readonly value="${UI.formatOverclockInputValue?.(extraction.overclock) ?? Math.round(extraction.overclock)}" />
                <input type="range" class="production-config-slider production-extraction-overclock-slider" data-extraction-id="${extraction.id}" min="${window.EnergyScale.OVERCLOCK_MIN}" max="${window.EnergyScale.OVERCLOCK_MAX}" step="1" value="${Math.round(extraction.overclock)}" aria-label="${escapeHtml(t('production.adjustExtractionOverclock'))}" />
              </div>
              <div class="production-config-field">
                <label class="production-config-label" for="energy-extraction-nodes-${extraction.id}">${nodesLabel}</label>
                <input type="number" class="production-config-input production-extraction-nodes-input" id="energy-extraction-nodes-${extraction.id}" data-extraction-id="${extraction.id}" min="1" max="${nodesSliderMax}" step="1" readonly value="${UI.formatMachineCountInput?.(nodeCount) ?? nodeCount}" />
                <input type="range" class="production-config-slider production-extraction-nodes-slider" data-extraction-id="${extraction.id}" min="1" max="${nodesSliderMax}" step="1" value="${Math.round(nodeCount)}" aria-label="${escapeHtml(t('production.adjustNodes', { nodes: nodesLabel.toLowerCase() }))}" />
              </div>
              <div class="production-config-field">
                <label class="production-config-label" for="energy-extraction-power-${extraction.id}">${escapeHtml(t('production.configPowerShard'))}</label>
                <input type="text" class="production-config-input production-config-readonly production-extraction-power-shards" id="energy-extraction-power-${extraction.id}" readonly tabindex="-1" value="${UI.computeTotalPowerShards?.(extraction.overclock, nodeCount) ?? 0}" />
              </div>
              <div class="production-config-field">
                <label class="production-config-label" for="energy-extraction-power-mw-${extraction.id}">${escapeHtml(t('production.configPowerConsumption'))}</label>
                <input type="text" class="production-config-input production-config-readonly production-extraction-power-mw" id="energy-extraction-power-mw-${extraction.id}" readonly tabindex="-1" value="${(UI.formatRateWithUnit ?? ((v, u) => `${v} ${u}`))(window.ProductionScale.roundPowerMw(window.ProductionScale.computeMachinePowerMw(Number(extraction.power_consumption) || 0, extraction.overclock, nodeCount, 1)), 'MW')}" />
              </div>
            </div>
            ${balanceSection}
          </div>
          <aside class="production-extraction-building">
            ${buildingImg}
            <span class="production-extraction-building-name">${escapeHtml(extraction.building_name || defaultBuildingName)}</span>
            <span class="production-extraction-building-config">${UI.formatExtractionBuildingConfigContent?.(extraction, outputUnit) ?? ''}</span>
            <span class="production-extraction-output">${(UI.formatRateWithUnit ?? formatProductionValue)(outputRate, outputUnit)}</span>
            ${
              UI.renderBuildingPowerShards?.({
                overclock: extraction.overclock,
                machine_count: nodeCount,
                power_consumption: extraction.power_consumption,
              }) ?? ''
            }
          </aside>
        </div>
      </article>`;
  }

  function getGeneratorBuildingInputRates(generator) {
    const round = (value) => window.ProductionScale.roundProduction(value);
    const machines = Math.max(1, Math.round(Number(generator.machine_count) || 1));
    const rates = [];

    if (generator.fuel_item_slug && generator.fuel_rate_base != null) {
      rates.push({
        item_slug: generator.fuel_item_slug,
        item_name: generator.fuel_item?.name ?? generator.fuel_label ?? generator.fuel_item_slug,
        item_image: generator.fuel_item?.image ?? null,
        is_fluid: Boolean(generator.fuel_is_fluid || generator.fuel_item?.is_fluid),
        base_per_min: generator.fuel_rate_base,
        current_per_min: round((generator.fuel_consumption ?? 0) / machines),
      });
    }

    if ((generator.water_rate_base ?? 0) > 0) {
      rates.push({
        item_slug: 'water',
        item_name: generator.water_item?.name ?? t('common.water'),
        item_image: generator.water_item?.image ?? null,
        is_fluid: true,
        base_per_min: generator.water_rate_base,
        current_per_min: round((generator.water_consumption ?? 0) / machines),
      });
    }

    return rates;
  }

  function getGeneratorBuildingOutputRates(generator) {
    const round = (value) => window.ProductionScale.roundProduction(value);
    const machines = Math.max(1, Math.round(Number(generator.machine_count) || 1));
    const rates = [
      {
        item_slug: 'power',
        item_name: t('energy.title'),
        item_image: null,
        unit: 'MW',
        base_per_min: generator.base_power_per_machine ?? 0,
        current_per_min: round((generator.power_output_mw ?? 0) / machines),
      },
    ];

    if ((generator.waste_output ?? 0) > 0 && generator.waste_item_slug) {
      const wasteBase =
        (Number(generator.fuel_rate_base) || 0) * (Number(generator.waste_per_rod) || 0);
      rates.push({
        item_slug: generator.waste_item_slug,
        item_name: generator.waste_item?.name ?? generator.waste_label ?? generator.waste_item_slug,
        item_image: generator.waste_item?.image ?? null,
        is_fluid: false,
        base_per_min: wasteBase,
        current_per_min: round((generator.waste_output ?? 0) / machines),
      });
    }

    return rates;
  }

  function buildGeneratorBuildingConfig(generator) {
    return {
      machine_count: generator.machine_count,
      overclock: generator.overclock,
      base_per_min: generator.base_power_per_machine,
      target_output: generator.power_output_mw,
      output_unit: 'MW',
      input_rates: getGeneratorBuildingInputRates(generator),
      output_rates: getGeneratorBuildingOutputRates(generator),
    };
  }

  function renderEnergyGenerator(generator) {
    const UI = productionUi();
    const definition = window.EnergyScale.getGeneratorDefinition(generator.building_slug);
    const fuelOptions = definition?.fuelOptions ?? [];
    const fuelSliderMax = getGeneratorFuelSliderMax(generator);
    const fuelSliderMin = getGeneratorFuelSliderMin(generator);
    const machinesSliderMax = getMachinesSliderMax(generator);
    const targetFuel = generator.target_fuel_input ?? generator.fuel_consumption ?? 0;
    const fuelUnit = getGeneratorFuelUnit(generator);

    const headerImg = generator.building_image
      ? `<img class="production-step-image" src="${escapeHtml(generator.building_image)}" alt="" />`
      : '<span class="resource-img resource-img--placeholder production-step-image"></span>';

    const configGrid = `
      <div class="production-config-grid production-config-grid--energy-generator">
        <div class="production-config-field">
          <label class="production-config-label" for="energy-generator-fuel-input-${generator.id}">${escapeHtml(t('energy.configFuel', { unit: fuelUnit }))}</label>
          <input type="number" class="production-config-input energy-generator-fuel-input" id="energy-generator-fuel-input-${generator.id}" data-generator-id="${generator.id}" min="${fuelSliderMin}" max="${fuelSliderMax}" step="0.001" readonly value="${formatEnergyFuelInputValue(targetFuel)}" />
          <input type="range" class="production-config-slider energy-generator-fuel-slider" data-generator-id="${generator.id}" min="${fuelSliderMin}" max="${fuelSliderMax}" step="0.001" value="${targetFuel}" aria-label="${escapeHtml(t('energy.adjustFuel'))}" />
        </div>
        <div class="production-config-oc-machines">
          <div class="production-config-field">
            <label class="production-config-label" for="energy-generator-overclock-${generator.id}">${escapeHtml(t('production.configOverclock'))}</label>
            <input type="number" class="production-config-input energy-generator-overclock-input" id="energy-generator-overclock-${generator.id}" data-generator-id="${generator.id}" min="${window.EnergyScale.OVERCLOCK_MIN}" max="${window.EnergyScale.OVERCLOCK_MAX}" step="1" readonly value="${UI.formatOverclockInputValue?.(generator.overclock) ?? Math.round(generator.overclock)}" />
            <input type="range" class="production-config-slider energy-generator-overclock-slider" data-generator-id="${generator.id}" min="${window.EnergyScale.OVERCLOCK_MIN}" max="${window.EnergyScale.OVERCLOCK_MAX}" step="1" value="${Math.round(generator.overclock)}" aria-label="${escapeHtml(t('energy.adjustGeneratorOverclock'))}" />
          </div>
          <div class="production-config-field">
            <label class="production-config-label" for="energy-generator-machines-${generator.id}">${escapeHtml(t('energy.sectionGenerators'))}</label>
            <input type="number" class="production-config-input energy-generator-machines-input" id="energy-generator-machines-${generator.id}" data-generator-id="${generator.id}" min="1" step="1" readonly value="${UI.formatMachineCountInput?.(generator.machine_count) ?? Math.round(generator.machine_count)}" />
            <input type="range" class="production-config-slider energy-generator-machines-slider" data-generator-id="${generator.id}" min="1" max="${machinesSliderMax}" step="1" value="${Math.round(generator.machine_count)}" aria-label="${escapeHtml(t('energy.adjustGeneratorCount'))}" />
          </div>
        </div>
        <div class="production-config-field">
          <label class="production-config-label" for="energy-generator-power-shards-${generator.id}">${escapeHtml(t('production.configPowerShard'))}</label>
          <input type="text" class="production-config-input production-config-readonly" id="energy-generator-power-shards-${generator.id}" readonly tabindex="-1" value="${UI.computeTotalPowerShards?.(generator.overclock, generator.machine_count) ?? 0}" />
        </div>
        <div class="production-config-field production-config-field--select">
          <span class="production-config-label">${escapeHtml(t('energy.configFuelType'))}</span>
          ${UI.renderThemeSelect({
            id: `energy-generator-fuel-${generator.id}`,
            options: fuelOptions.map((option) => ({
              value: option.slug,
              label: resolveFuelOptionLabel(option),
            })),
            selectedValue: generator.fuel_slug,
            dataset: { generatorId: generator.id, field: 'fuel' },
          })}
        </div>
      </div>`;

    const inputsHtml = renderGeneratorInputsHtml(generator);

    const buildingSchema = {
      building_name: generator.building_name,
      building_image: generator.building_image,
    };
    const buildingConfig = buildGeneratorBuildingConfig(generator);

    return `
      <article class="production-step energy-generator" data-generator-id="${generator.id}">
        <header class="production-step-header">
          ${headerImg}
          <div class="production-step-title">
            <h4>${escapeHtml(generator.building_name ?? t('common.generator'))}</h4>
            <p class="production-step-resource">${escapeHtml(formatGeneratorSubtitle(generator))}</p>
          </div>
          <div class="production-step-actions">
            <button type="button" class="production-step-reset-btn energy-generator-reset-btn" data-generator-id="${generator.id}" aria-label="${escapeHtml(t('actions.reset'))}" title="${escapeHtml(t('production.resetDefaults'))}">${RESET_ICON}</button>
            <button type="button" class="production-step-delete-btn energy-generator-delete-btn" data-generator-id="${generator.id}" aria-label="${escapeHtml(t('actions.delete'))}">${DELETE_ICON}</button>
          </div>
        </header>
        <article class="craft-schema production-step-editor">
          <div class="craft-schema-layout">
            <div class="craft-schema-body">
              ${configGrid}
              <div class="craft-io-grid">
                <div class="craft-io-col craft-io-col--inputs">
                  <h5>Input</h5>
                  <div class="craft-io-list">${inputsHtml}</div>
                </div>
                <div class="craft-arrow" aria-hidden="true">→</div>
                <div class="craft-io-col craft-io-col--outputs">
                  <h5>Output</h5>
                  <div class="craft-io-list">${renderEnergyGeneratorOutputs(generator)}</div>
                </div>
              </div>
            </div>
            ${UI.renderBuildingPanel?.(buildingSchema, buildingConfig) ?? ''}
          </div>
        </article>
      </article>`;
  }

  function disposeEnergyGraph() {
    if (energyGraphHandle?.disconnect) {
      energyGraphHandle.disconnect();
    }
    energyGraphHandle = null;
  }

  function isEnergyTreeViewMode() {
    return energyDetailViewMode === 'tree';
  }

  function updateEnergyTreeButtonState() {
    const btn = document.getElementById('btn-energy-tree-view');
    const addExtractionBtn = document.getElementById('btn-add-energy-extraction');
    const addGeneratorBtn = document.getElementById('btn-add-energy-generator');
    const actionsEl = document.querySelector('#view-energy-detail .production-detail-actions');
    if (!btn) return;

    const isTree = isEnergyTreeViewMode();
    const iconClass = isTree ? 'fa-align-right' : 'fa-code-fork';
    const label = isTree ? t('production.backToEditor') : t('energy.treeView');
    btn.classList.toggle('btn-tree--active', isTree);
    btn.innerHTML = `<i class="fa-solid ${iconClass}" aria-hidden="true"></i><span>${escapeHtml(label)}</span>`;
    btn.setAttribute('aria-pressed', isTree ? 'true' : 'false');
    btn.title = isTree ? t('production.backToEditorPlan') : t('energy.treeViewTitle');

    actionsEl?.classList.toggle('production-detail-actions--tree-view', isTree);
    addExtractionBtn?.toggleAttribute('hidden', isTree);
    addGeneratorBtn?.toggleAttribute('hidden', isTree);
    document.getElementById('view-energy-detail')?.classList.toggle('view--tree-mode', isTree);
  }

  function toggleEnergyTreeView() {
    energyDetailViewMode = isEnergyTreeViewMode() ? 'editor' : 'tree';
    updateEnergyTreeButtonState();
    if (activeEnergyDetail) {
      renderEnergyDetailContent(activeEnergyDetail);
    }
  }

  function computeGeneratorBuildInfo(generator) {
    const machines = Math.max(1, Math.round(Number(generator?.machine_count) || 1));
    const overclock = Number(generator?.overclock) || 100;
    const chain = { max_belt_mk: 6, max_pipe_mk: 2 };
    const inputs = [];
    if ((generator.fuel_consumption ?? 0) > 0) {
      inputs.push({
        item_slug: generator.fuel_item_slug,
        item_name: generator.fuel_item?.name || generator.fuel_label,
        is_fluid: Boolean(generator.fuel_is_fluid || generator.fuel_item?.is_fluid),
        rate: generator.fuel_consumption,
      });
    }
    if ((generator.water_consumption ?? 0) > 0) {
      inputs.push({
        item_slug: 'water',
        item_name: generator.water_item?.name || 'water',
        is_fluid: true,
        rate: generator.water_consumption,
      });
    }

    if (typeof getPlanTransportCapacity === 'function' && typeof distributeMachinesAcrossManifolds === 'function') {
      let manifoldsNeeded = 1;
      const limiting = [];
      for (const io of inputs) {
        if (!(io.rate > 0)) continue;
        const transport = getPlanTransportCapacity(Boolean(io.is_fluid), chain);
        const lines = Math.max(1, Math.ceil(io.rate / transport.capacity - 1e-9));
        if (lines > manifoldsNeeded) {
          manifoldsNeeded = lines;
          limiting.length = 0;
          limiting.push({ ...io, direction: 'input', ...transport, lines });
        }
      }
      manifoldsNeeded = Math.min(machines, manifoldsNeeded);
      const banks = distributeMachinesAcrossManifolds(machines, manifoldsNeeded);
      return {
        machines,
        overclock,
        buildingName: generator.building_name || t('common.generator'),
        buildingSlug: generator.building_slug,
        buildingImage: generator.building_image,
        manifoldCount: banks.length,
        banks,
        needsSplit: banks.length > 1,
        limiting,
      };
    }

    return {
      machines,
      overclock,
      buildingName: generator.building_name || t('common.generator'),
      buildingSlug: generator.building_slug,
      buildingImage: generator.building_image,
      manifoldCount: 1,
      banks: [machines],
      needsSplit: false,
      limiting: [],
    };
  }

  function getEnergyGraphHelpers(detail) {
    const UI = productionUi();
    const chain = detail.chain ?? {};
    const maxBeltMk = 6;
    const maxPipeMk = 2;
    const beltRates = { 1: 60, 2: 120, 3: 270, 4: 480, 5: 780, 6: 1200 };
    const pipeRates = { 1: 300, 2: 600 };

    return {
      chainId: `energy-${chain.id ?? 'x'}`,
      chainName: chain.name ?? null,
      escapeHtml,
      formatProductionValue: UI.formatProductionValue ?? ((v) => String(v)),
      formatRateWithUnit: UI.formatRateWithUnit ?? ((v, u) => `${v}${u}`),
      formatDisplayNumber: UI.formatDisplayInteger ?? ((v) => String(v)),
      getExtractionOutputRate: (extraction) => Number(extraction?.output_rate) || 0,
      getExtractionDisplayName: (extraction, all) => getExtractionDisplayName(extraction, all),
      computeExtractionBuildInfo: (extraction) =>
        typeof computeExtractionBuildInfo === 'function'
          ? computeExtractionBuildInfo(extraction, { max_belt_mk: maxBeltMk, max_pipe_mk: maxPipeMk })
          : {
              machines: extraction.node_count,
              overclock: extraction.overclock,
              isExtraction: true,
              needsSplit: false,
              banks: [extraction.node_count],
              manifoldCount: 1,
            },
      computeGeneratorBuildInfo,
      renderBuildStatsBadge: (info, options) =>
        typeof renderBuildStatsBadge === 'function'
          ? renderBuildStatsBadge(info, {
              ...options,
              detailMode: getProductionTreeDetailMode(),
            })
          : '',
      treeDetailMode: getProductionTreeDetailMode(),
      showEdgeTransport: getProductionTreeEdgeTransport(),
      roundProduction: (value) => window.ProductionScale.roundProduction(value),
      linkTolerance: UI.LINK_BALANCE_TOLERANCE ?? 0.05,
      extractions: detail.extractions ?? [],
      describeEdgeTransport: (edge) => {
        if (edge.kind === 'power-link' || edge.kind === 'objective-link' || !(edge.rate > 0)) {
          return null;
        }
        const isFluid = Boolean(edge.isFluid);
        const mk = isFluid ? maxPipeMk : maxBeltMk;
        const capacity = isFluid ? pipeRates[mk] || 600 : beltRates[mk] || 1200;
        const rate = Number(edge.rate) || 0;
        const count = Math.max(1, Math.ceil(rate / capacity - 1e-9));
        return {
          isFluid,
          mk,
          capacity,
          rate,
          count,
          over: rate > capacity + 1e-9,
        };
      },
    };
  }

  function readEnergyPowerShardLimitFromUi(prefix) {
    const mode = document.getElementById(`${prefix}-power-shard-mode`)?.value || 'limited';
    const budgetRaw = document.getElementById(`${prefix}-power-shard-budget`)?.value;
    return mode === 'unlimited' ? -1 : Math.max(0, Math.round(Number(budgetRaw) || 0));
  }

  function renderEnergyPowerShardControls(chain = {}, { idPrefix = 'energy-plan' } = {}) {
    const shardLimit = chain.power_shard_limit;
    const shardUnlimited = shardLimit == null || Number(shardLimit) < 0;
    return `
      <div class="production-plan-constraint">
        <label for="${idPrefix}-power-shard-mode">${escapeHtml(t('production.powerShardsLimit'))}</label>
        <div class="production-plan-constraint-controls">
          <select id="${idPrefix}-power-shard-mode" data-energy-setting="power-shard-mode">
            <option value="limited" ${!shardUnlimited ? 'selected' : ''}>${escapeHtml(t('production.powerShardsLimited'))}</option>
            <option value="unlimited" ${shardUnlimited ? 'selected' : ''}>${escapeHtml(t('production.powerShardsUnlimited'))}</option>
          </select>
          <input
            type="number"
            id="${idPrefix}-power-shard-budget"
            class="production-target-rate-input"
            data-energy-setting="power-shard-budget"
            min="0"
            step="1"
            value="${escapeHtml(String(shardUnlimited ? 0 : Math.max(0, Number(shardLimit) || 0)))}"
            ${shardUnlimited ? 'disabled' : ''}
            aria-label="${escapeHtml(t('production.powerShardsBudgetAria'))}"
          />
        </div>
      </div>`;
  }

  function bindEnergyPowerShardControls(root = document) {
    const modeEl = root.querySelector?.(
      '#energy-plan-power-shard-mode, #energy-create-power-shard-mode, [data-energy-setting="power-shard-mode"]'
    );
    const budgetEl = root.querySelector?.(
      '#energy-plan-power-shard-budget, #energy-create-power-shard-budget, [data-energy-setting="power-shard-budget"]'
    );
    if (!modeEl || !budgetEl) return;
    const sync = () => {
      budgetEl.disabled = modeEl.value === 'unlimited';
    };
    modeEl.onchange = sync;
    sync();
  }

  function renderEnergyDetailContent(detail) {
    disposeEnergyGraph();

    if (!detail?.chain) {
      energyDetailBody.innerHTML = `<section class="card production-detail-main"><p class="detail-empty">${escapeHtml(t('energy.notFound'))}</p></section>`;
      document.getElementById('energy-detail-external-summary').innerHTML = '';
      updateEnergyTreeButtonState();
      return;
    }

    const extractions = detail.extractions ?? [];
    const generators = detail.generators ?? [];

    document.getElementById('energy-detail-heading').textContent = detail.chain.name;
    document.getElementById('energy-detail-breadcrumb').textContent = detail.chain.name;
    const extPart =
      extractions.length === 1
        ? t('energy.metaExtractionsOne', { count: extractions.length })
        : t('energy.metaExtractionsMany', { count: extractions.length });
    const genPart =
      generators.length === 1
        ? t('energy.metaGeneratorsOne', { count: generators.length })
        : t('energy.metaGeneratorsMany', { count: generators.length });
    document.getElementById('energy-detail-meta').textContent = `${extPart}, ${genPart}`;
    syncEnergyBalanceCache();
    document.getElementById('energy-detail-external-summary').innerHTML = renderEnergySummary(detail);
    updateEnergyTreeButtonState();

    if (isEnergyTreeViewMode()) {
      energyDetailBody.innerHTML =
        '<section class="card production-detail-main production-tree-card"></section>';
      const treeHost = energyDetailBody.querySelector('.production-tree-card');
      energyGraphHandle = window.ProductionGraph.renderEnergyGraph(
        treeHost,
        detail,
        getEnergyGraphHelpers(detail),
        {
          onDetailModeChange: () => {
            if (activeEnergyDetail) renderEnergyDetailContent(activeEnergyDetail);
          },
        }
      );
      return;
    }

    const extractionsHtml = extractions.length
      ? extractions.map((ext) => renderEnergyExtraction(ext, extractions)).join('')
      : `<p class="detail-empty production-extractions-empty">${escapeHtml(t('energy.emptyExtractions'))}</p>`;

    const generatorsHtml = generators.length
      ? `<div class="production-steps-list">${generators.map((gen) => renderEnergyGenerator(gen)).join('')}</div>`
      : `<p class="detail-empty production-schemas-empty">${escapeHtml(t('energy.emptyGenerators'))}</p>`;

    energyDetailBody.innerHTML = `
      <section class="card production-detail-main production-targets-card">
        ${renderEnergyTargetsEditor(detail.chain)}
      </section>
      <section class="card production-detail-main production-columns-card">
        <div class="production-detail-columns">
          <section class="production-extractions-section">
            <h3 class="production-section-header">${escapeHtml(t('energy.sectionExtractions'))}</h3>
            <div class="production-extractions-list">${extractionsHtml}</div>
          </section>
          <section class="production-schemas-section">
            <h3 class="production-section-header">${escapeHtml(t('energy.sectionGenerators'))}</h3>
            ${generatorsHtml}
          </section>
        </div>
      </section>`;

    productionUi().lockConfigNumberInputsIn?.(energyDetailBody);
    productionUi().lockConfigSlidersIn?.(energyDetailBody);
    bindEnergyPowerShardControls(energyDetailBody);

    const planGen = document.getElementById('energy-plan-generator');
    const planFuel = document.getElementById('energy-plan-fuel');
    if (planGen && planFuel) {
      planGen.addEventListener('change', () => {
        const def = window.EnergyScale?.getGeneratorDefinition?.(planGen.value);
        planFuel.innerHTML = (def?.fuelOptions || [])
          .map(
            (opt) =>
              `<option value="${escapeHtml(opt.slug)}">${escapeHtml(resolveFuelOptionLabel(opt))}</option>`
          )
          .join('');
      });
    }
    const planMode = document.getElementById('energy-plan-target-mode');
    const planValue = document.getElementById('energy-plan-target-value');
    if (planMode && planValue) {
      planMode.addEventListener('change', () => {
        const nextMode = planMode.value === 'fuel' ? 'fuel' : 'mw';
        const stored =
          nextMode === 'fuel'
            ? planValue.dataset.fuelValue || ''
            : planValue.dataset.mwValue || '';
        planValue.value = stored;
      });
      planValue.addEventListener('input', () => {
        const mode = planMode.value === 'fuel' ? 'fuel' : 'mw';
        if (mode === 'fuel') planValue.dataset.fuelValue = planValue.value;
        else planValue.dataset.mwValue = planValue.value;
      });
    }
    document.getElementById('btn-energy-replan')?.addEventListener('click', () => {
      applyEnergyPlanTargetsFromUi();
    });
  }

  async function openEnergyDetail(chainId) {
    activeEnergyChainId = chainId;
    activeEnergyDetail = null;
    energyDetailViewMode = 'editor';
    disposeEnergyGraph();
    energyDetailBody.innerHTML = `<section class="card production-detail-main"><p class="loading">${escapeHtml(t('common.loading'))}</p></section>`;
    document.getElementById('energy-detail-heading').textContent = '—';
    document.getElementById('energy-detail-breadcrumb').textContent = '—';
    document.getElementById('energy-detail-meta').textContent = '';
    document.getElementById('energy-detail-external-summary').innerHTML = '';
    updateEnergyTreeButtonState();
    window.switchView('energy-detail');

    try {
      await ensureItemNameCache();
      activeEnergyDetail = await window.satisfactory.getEnergyChainDetail(chainId, {
        includeProductionObjectives: true,
      });
      renderEnergyDetailContent(activeEnergyDetail);
    } catch (err) {
      energyDetailBody.innerHTML = `<section class="card production-detail-main"><p class="detail-empty">${escapeHtml(t('energy.errorDetailLoad'))}</p></section>`;
      console.error('Energy detail error:', err);
    }
  }

  function closeEnergyDetail() {
    disposeEnergyGraph();
    energyDetailViewMode = 'editor';
    updateEnergyTreeButtonState();
    window.switchView('energy');
    loadEnergyChainSummaries().then(() => renderEnergyChains()).catch(console.error);
  }

  async function ensureItemNameCache() {
    if (itemNameBySlug.size) return;
    const grouped = await window.satisfactory.getResources();
    const map = new Map();
    for (const cat of grouped) {
      for (const item of cat.items ?? []) {
        if (item?.slug) map.set(item.slug, item.name);
      }
    }
    itemNameBySlug = map;
  }

  function resolveFuelOptionLabel(option) {
    return itemNameBySlug.get(option.slug) || option.label || option.slug;
  }

  async function ensureEnergyExtractionItems() {
    if (energyExtractionItems.length) return;
    await ensureItemNameCache();
    const grouped = await window.satisfactory.getResources();
    const allItems = grouped.flatMap((cat) => cat.items ?? []);
    energyExtractionItems = allItems.filter((item) => ENERGY_EXTRACTION_SLUGS.includes(item.slug));
  }

  async function ensureEnergyGeneratorCatalog() {
    if (energyGeneratorCatalog.length) return;
    energyGeneratorCatalog = await window.satisfactory.getEnergyGeneratorCatalog();
  }

  function openEnergyExtractionPickerModal() {
    ensureEnergyExtractionItems()
      .then(() => {
        const list = document.getElementById('energy-extraction-picker-list');
        if (!energyExtractionItems.length) {
          list.innerHTML = `<p class="empty-state">${escapeHtml(t('energy.pickerNoResources'))}</p>`;
        } else {
          list.innerHTML = `
            <div class="picker-grid">
              ${energyExtractionItems
                .map(
                  (item) => `
                <button type="button" class="picker-item" data-id="${item.id}">
                  ${productionUi().renderItemImage?.(item) ?? ''}
                  <span>${escapeHtml(item.name)}</span>
                </button>`
                )
                .join('')}
            </div>`;
        }
        energyExtractionPickerModal.classList.remove('hidden');
        energyExtractionPickerModal.setAttribute('aria-hidden', 'false');
      })
      .catch(console.error);
  }

  function closeEnergyExtractionPickerModal() {
    energyExtractionPickerModal.classList.add('hidden');
    energyExtractionPickerModal.setAttribute('aria-hidden', 'true');
  }

  function openEnergyGeneratorPickerModal() {
    ensureEnergyGeneratorCatalog()
      .then(() => {
        const list = document.getElementById('energy-generator-picker-list');
        if (!energyGeneratorCatalog.length) {
          list.innerHTML = `<p class="empty-state">${escapeHtml(t('energy.pickerNoGenerators'))}</p>`;
        } else {
          list.innerHTML = `
            <div class="picker-grid">
              ${energyGeneratorCatalog
                .map(
                  (gen) => `
                <button type="button" class="picker-item" data-slug="${escapeHtml(gen.slug)}">
                  ${
                    gen.image
                      ? `<img class="resource-img" src="${escapeHtml(gen.image)}" alt="${escapeHtml(gen.name)}" loading="lazy" />`
                      : '<div class="resource-img resource-img--placeholder"></div>'
                  }
                  <span>${escapeHtml(gen.name)}</span>
                  <span class="picker-item-note">${formatMw(gen.basePowerMw)}</span>
                </button>`
                )
                .join('')}
            </div>`;
        }
        energyGeneratorPickerModal.classList.remove('hidden');
        energyGeneratorPickerModal.setAttribute('aria-hidden', 'false');
      })
      .catch(console.error);
  }

  function closeEnergyGeneratorPickerModal() {
    energyGeneratorPickerModal.classList.add('hidden');
    energyGeneratorPickerModal.setAttribute('aria-hidden', 'true');
  }

  function debounceExtractionSave(extractionId, config) {
    const key = String(extractionId);
    if (extractionConfigDebounce.has(key)) {
      clearTimeout(extractionConfigDebounce.get(key));
    }
    extractionConfigDebounce.set(
      key,
      setTimeout(async () => {
        extractionConfigDebounce.delete(key);
        try {
          activeEnergyDetail = await window.satisfactory.updateEnergyExtraction(extractionId, config);
          refreshAllEnergyGeneratorInputDisplays();
          refreshAllEnergyExtractionBalanceDisplays();
          const extraction = activeEnergyDetail?.extractions?.find((item) => item.id === extractionId);
          const extractionEl = energyDetailBody.querySelector(`[data-extraction-id="${extractionId}"]`);
          if (extraction && extractionEl) {
            productionUi().updateExtractionConfigDisplay?.(extractionEl, extraction);
            updateEnergyExtractionBalanceDisplay(
              extractionEl,
              extraction,
              activeEnergyDetail?.extractions ?? []
            );
          }
          document.getElementById('energy-detail-external-summary').innerHTML = renderEnergySummary(
            activeEnergyDetail
          );
        } catch (err) {
          console.error('Energy extraction update error:', err);
        }
      }, 400)
    );
  }

  async function saveEnergyExtractionConfig(extractionId, config, { immediate = false } = {}) {
    const key = String(extractionId);
    if (immediate) {
      clearTimeout(extractionConfigDebounce.get(key));
      extractionConfigDebounce.delete(key);
      try {
        activeEnergyDetail = await window.satisfactory.updateEnergyExtraction(extractionId, config);
        renderEnergyDetailContent(activeEnergyDetail);
      } catch (err) {
        console.error('Energy extraction update error:', err);
      }
      return;
    }

    debounceExtractionSave(extractionId, config);
  }

  function refreshAllEnergyGeneratorInputDisplays() {
    syncEnergyBalanceCache();
    for (const generator of activeEnergyDetail?.generators ?? []) {
      updateGeneratorDomFromState(generator.id);
    }
  }

  function handleEnergyExtractionConfigChange(extractionId, field, rawValue) {
    const UI = productionUi();
    const extraction = activeEnergyDetail?.extractions?.find((item) => item.id === extractionId);
    if (!extraction) return;

    const changeField =
      field === 'overclock-slider'
        ? 'overclock-slider'
        : field === 'overclock'
          ? 'overclock'
          : field;

    const parsedValue =
      changeField === 'output' ? UI.parseConfigNumberInput?.(rawValue) ?? Number(rawValue) : rawValue;
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

    syncEnergyBalanceCache();

    const extractionEl = energyDetailBody.querySelector(`[data-extraction-id="${extractionId}"]`);
    if (extractionEl) UI.updateExtractionConfigDisplay?.(extractionEl, extraction);
    refreshAllEnergyExtractionBalanceDisplays();
    refreshAllEnergyGeneratorInputDisplays();

    document.getElementById('energy-detail-external-summary').innerHTML = renderEnergySummary(
      activeEnergyDetail
    );

    const config = {
      miner_slug: updated.miner_slug,
      purity: updated.purity,
      overclock: updated.overclock,
      node_count: updated.node_count,
      target_output: updated.target_output,
    };

    saveEnergyExtractionConfig(extractionId, config, {
      immediate: field === 'miner' || field === 'purity',
    });
  }

  function debounceGeneratorSave(generatorId, payload) {
    const key = String(generatorId);
    if (generatorConfigDebounce.has(key)) {
      clearTimeout(generatorConfigDebounce.get(key));
    }
    generatorConfigDebounce.set(
      key,
      setTimeout(async () => {
        generatorConfigDebounce.delete(key);
        try {
          activeEnergyDetail = await window.satisfactory.updateEnergyGenerator(generatorId, payload);
        } catch (err) {
          console.error('Energy generator update error:', err);
          if (activeEnergyChainId) {
            try {
              activeEnergyDetail = await window.satisfactory.getEnergyChainDetail(
                activeEnergyChainId,
                { includeProductionObjectives: true }
              );
              renderEnergyDetailContent(activeEnergyDetail);
            } catch (reloadErr) {
              console.error('Energy generator reload error:', reloadErr);
            }
          }
        }
      }, 400)
    );
  }

  function applyResolvedToGenerator(generator, resolved) {
    generator.fuel_slug = resolved.fuel_slug;
    generator.machine_count = resolved.machine_count;
    generator.overclock = resolved.overclock;
    generator.target_fuel_input = resolved.target_fuel_input;
    generator.target_power = resolved.target_power;
    generator.base_power_per_machine = resolved.base_power_per_machine;
    generator.max_target_fuel = resolved.max_target_fuel;
    generator.max_target_power = resolved.max_target_power;
    generator.power_output_mw = resolved.power_output_mw;
    generator.fuel_consumption = resolved.fuel_consumption;
    generator.water_consumption = resolved.water_consumption;
    generator.fuel_item_slug = resolved.fuel_item_slug;
    generator.fuel_label = resolved.fuel_label;
    generator.fuel_rate_base = resolved.fuel_rate_base;
    generator.water_rate_base = resolved.water_rate_base;
    generator.waste_item_slug = resolved.waste_item_slug;
    generator.waste_label = resolved.waste_label;
    generator.waste_output = resolved.waste_output;
    generator.waste_per_rod = resolved.waste_per_rod;
    if (!resolved.waste_item_slug) {
      generator.waste_item = null;
    } else if (generator.waste_item?.slug !== resolved.waste_item_slug) {
      generator.waste_item = {
        slug: resolved.waste_item_slug,
        name: resolved.waste_label ?? resolved.waste_item_slug,
        image: null,
        is_fluid: false,
      };
    }
  }

  function getEnergyGeneratorElement(generatorId) {
    return energyDetailBody.querySelector(
      `.energy-generator[data-generator-id="${generatorId}"]`
    );
  }

  function updateGeneratorDomFromState(generatorId) {
    const generator = activeEnergyDetail?.generators?.find((item) => item.id === generatorId);
    if (!generator) return;

    const UI = productionUi();
    const card = getEnergyGeneratorElement(generatorId);
    if (!card) return;

    syncEnergyBalanceCache();

    const subtitle = card.querySelector('.production-step-resource');
    if (subtitle) {
      subtitle.textContent = formatGeneratorSubtitle(generator);
    }

    const fuelSliderMax = getGeneratorFuelSliderMax(generator);
    const fuelSliderMin = getGeneratorFuelSliderMin(generator);
    const machinesSliderMax = getMachinesSliderMax(generator);
    const targetFuel = generator.target_fuel_input ?? generator.fuel_consumption ?? 0;

    const fuelInput = card.querySelector('.energy-generator-fuel-input');
    const fuelSlider = card.querySelector('.energy-generator-fuel-slider');
    if (fuelInput && document.activeElement !== fuelInput) {
      fuelInput.min = String(fuelSliderMin);
      fuelInput.max = String(fuelSliderMax);
      fuelInput.value = formatEnergyFuelInputValue(targetFuel);
      UI.rememberConfigInputValue?.(fuelInput);
    }
    if (fuelSlider) {
      fuelSlider.min = String(fuelSliderMin);
      fuelSlider.max = String(fuelSliderMax);
      fuelSlider.step = '0.001';
      fuelSlider.value = String(targetFuel);
    }

    const overclockInput = card.querySelector('.energy-generator-overclock-input');
    const overclockSlider = card.querySelector('.energy-generator-overclock-slider');
    if (overclockInput && document.activeElement !== overclockInput) {
      overclockInput.value =
        UI.formatOverclockInputValue?.(generator.overclock) ?? Math.round(generator.overclock);
      UI.rememberConfigInputValue?.(overclockInput);
    }
    if (overclockSlider) {
      overclockSlider.value = String(Math.round(generator.overclock));
    }

    const machinesInput = card.querySelector('.energy-generator-machines-input');
    const machinesSlider = card.querySelector('.energy-generator-machines-slider');
    if (machinesInput && document.activeElement !== machinesInput) {
      machinesInput.value =
        UI.formatMachineCountInput?.(generator.machine_count) ?? Math.round(generator.machine_count);
      UI.rememberConfigInputValue?.(machinesInput);
    }
    if (machinesSlider) {
      machinesSlider.max = String(machinesSliderMax);
      machinesSlider.value = String(Math.round(generator.machine_count));
    }

    const shards = card.querySelector(`#energy-generator-power-shards-${generatorId}`);
    if (shards) {
      shards.value = String(
        UI.computeTotalPowerShards?.(generator.overclock, generator.machine_count) ?? 0
      );
    }

    const inputsList = card.querySelector('.craft-io-col--inputs .craft-io-list');
    if (inputsList) {
      inputsList.innerHTML = renderGeneratorInputsHtml(generator);
    }

    const outputsList = card.querySelector('.craft-io-col--outputs .craft-io-list');
    if (outputsList) {
      outputsList.innerHTML = renderEnergyGeneratorOutputs(generator);
    }

    const buildingAside = card.querySelector('.craft-schema-building');
    if (buildingAside) {
      buildingAside.outerHTML =
        UI.renderBuildingPanel?.(
          {
            building_name: generator.building_name,
            building_image: generator.building_image,
          },
          buildGeneratorBuildingConfig(generator)
        ) ?? buildingAside.outerHTML;
    }

    document.getElementById('energy-detail-external-summary').innerHTML = renderEnergySummary(
      activeEnergyDetail
    );
    refreshAllEnergyExtractionBalanceDisplays();
    UI.lockConfigNumberInputsIn?.(card, { skipFocused: true });
  }

  function buildGeneratorSavePayload(generator) {
    return {
      fuel_slug: generator.fuel_slug,
      machine_count: generator.machine_count,
      overclock: generator.overclock,
      target_fuel_input: generator.target_fuel_input,
    };
  }

  function handleGeneratorConfigChange(generatorId, field, rawValue) {
    const generator = activeEnergyDetail?.generators?.find((item) => item.id === generatorId);
    if (!generator) return;

    const changeField =
      field === 'fuel' || field === 'energy-fuel'
        ? 'fuel'
        : field === 'water'
          ? 'water'
          : field === 'power' || field === 'mw'
            ? 'power'
            : field === 'waste'
              ? 'waste'
              : field === 'machines' || field === 'energy-machines'
                ? 'machines'
                : field === 'overclock-slider'
                  ? 'overclock-slider'
                  : field === 'overclock' || field === 'energy-overclock'
                    ? 'overclock'
                    : null;

    if (!changeField) return;

    const resolved = window.EnergyScale.applyGeneratorChange(
      generator.building_slug,
      generator,
      changeField,
      rawValue
    );
    if (!resolved) return;

    applyResolvedToGenerator(generator, resolved);
    updateGeneratorDomFromState(generatorId);
    debounceGeneratorSave(generatorId, buildGeneratorSavePayload(generator));
  }

  function commitEnergyConfigInputChange(input, field, value) {
    if (field === 'extraction-output') {
      handleEnergyExtractionConfigChange(Number(input.dataset.extractionId), 'output', value);
      return;
    }
    if (field === 'extraction-overclock') {
      handleEnergyExtractionConfigChange(Number(input.dataset.extractionId), 'overclock', value);
      return;
    }
    if (field === 'extraction-nodes') {
      handleEnergyExtractionConfigChange(Number(input.dataset.extractionId), 'nodes', value);
      return;
    }
    if (field === 'energy-io-rate') {
      const kind = input.dataset.ioKind;
      if (!kind) return;
      handleGeneratorConfigChange(Number(input.dataset.generatorId), kind, value);
      return;
    }
    if (field === 'energy-fuel') {
      handleGeneratorConfigChange(Number(input.dataset.generatorId), 'energy-fuel', value);
      return;
    }
    if (field === 'energy-overclock') {
      handleGeneratorConfigChange(Number(input.dataset.generatorId), 'energy-overclock', value);
      return;
    }
    if (field === 'energy-machines') {
      handleGeneratorConfigChange(Number(input.dataset.generatorId), 'energy-machines', value);
    }
  }

  function commitEnergyConfigInputFromField(input, field) {
    const UI = productionUi();
    const value =
      field === 'extraction-output' || field === 'energy-fuel' || field === 'energy-io-rate'
        ? input.classList.contains('production-config-decimal-input')
          ? UI.parseConfigNumberInput?.(input.value)
          : Number(input.value)
        : Number(input.value);
    commitEnergyConfigInputChange(input, field, value);
  }

  function handleEnergyConfigInputKeydown(e) {
    const UI = productionUi();
    const input = UI.resolveConfigNumberInput?.(e.target);
    const field = input ? UI.getConfigInputField?.(input) : null;
    if (!field) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      commitEnergyConfigInputFromField(input, field);
      UI.rememberConfigInputValue?.(input);
      input.blur();
      return;
    }

    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    UI.applyConfigInputNudge?.(input, field, ['ArrowUp', 'ArrowRight'].includes(e.key) ? 1 : -1, commitEnergyConfigInputChange);
  }

  function handleExtractionSliderInput(slider, field) {
    const UI = productionUi();
    const value = UI.snapProductionSliderValue?.(slider);
    if (value == null) return;

    const extractionId = Number(slider.dataset.extractionId);
    const extractionEl = energyDetailBody.querySelector(`[data-extraction-id="${extractionId}"]`);

    if (field === 'output') {
      const input = extractionEl?.querySelector('.production-extraction-output-input');
      const extraction = activeEnergyDetail?.extractions?.find((item) => item.id === extractionId);
      if (input) {
        input.value =
          UI.formatExtractionOutputInputValue?.(value, extraction?.overclock) ?? String(Math.round(value));
      }
      handleEnergyExtractionConfigChange(extractionId, 'output', value);
      return;
    }

    if (field === 'overclock') {
      const input = extractionEl?.querySelector('.production-extraction-overclock-input');
      if (input) input.value = UI.formatOverclockInputValue?.(value) ?? String(value);
      handleEnergyExtractionConfigChange(extractionId, 'overclock-slider', value);
      return;
    }

    if (field === 'nodes') {
      const input = extractionEl?.querySelector('.production-extraction-nodes-input');
      if (input) input.value = UI.formatMachineCountInput?.(value) ?? String(value);
      handleEnergyExtractionConfigChange(extractionId, 'nodes', value);
    }
  }

  function handleGeneratorSliderInput(slider, field) {
    const generatorId = Number(slider.dataset.generatorId);
    handleGeneratorConfigChange(generatorId, field === 'overclock' ? 'overclock-slider' : field, Number(slider.value));
  }

  function showEnergyCreateError(message) {
    energyCreateError.textContent = message;
    energyCreateError.classList.remove('hidden');
  }

  function hideEnergyCreateError() {
    energyCreateError.textContent = '';
    energyCreateError.classList.add('hidden');
  }

  function populateEnergyCreateGeneratorSelects() {
    const genSelect = document.getElementById('energy-create-generator');
    const fuelSelect = document.getElementById('energy-create-fuel');
    if (!genSelect || !fuelSelect) return;

    const catalog = window.EnergyScale?.getSupportedGenerators?.() || [];
    genSelect.innerHTML = catalog
      .map((gen) => {
        const label =
          gen.slug === 'generator-coal'
            ? t('energy.generatorCoal')
            : gen.slug === 'generator-fuel'
              ? t('energy.generatorFuel')
              : gen.slug === 'generator-nuclear'
                ? t('energy.generatorNuclear')
                : gen.slug;
        return `<option value="${escapeHtml(gen.slug)}">${escapeHtml(label)}</option>`;
      })
      .join('');

    const syncFuels = () => {
      const def = window.EnergyScale?.getGeneratorDefinition?.(genSelect.value);
      const options = def?.fuelOptions || [];
      fuelSelect.innerHTML = options
        .map(
          (opt) =>
            `<option value="${escapeHtml(opt.slug)}">${escapeHtml(resolveFuelOptionLabel(opt))}</option>`
        )
        .join('');
    };
    genSelect.onchange = syncFuels;
    if (!genSelect.value && catalog[0]) genSelect.value = catalog[0].slug;
    syncFuels();
  }

  function syncEnergyCreateTargetPlaceholder() {
    const mode = document.getElementById('energy-create-target-mode')?.value || 'mw';
    const input = document.getElementById('energy-create-target-value');
    if (!input) return;
    input.placeholder = mode === 'fuel' ? '200' : '750';
  }

  function renderEnergyTargetsEditor(chain = {}) {
    const catalog = window.EnergyScale?.getSupportedGenerators?.() || [];
    const buildingSlug = chain.target_building_slug || catalog[0]?.slug || 'generator-coal';
    const def = window.EnergyScale?.getGeneratorDefinition?.(buildingSlug);
    const fuelSlug = chain.target_fuel_slug || def?.fuelOptions?.[0]?.slug || 'coal';
    const targetMode = chain.target_mode === 'fuel' ? 'fuel' : 'mw';
    const genOptions = catalog
      .map((gen) => {
        const label =
          gen.slug === 'generator-coal'
            ? t('energy.generatorCoal')
            : gen.slug === 'generator-fuel'
              ? t('energy.generatorFuel')
              : gen.slug === 'generator-nuclear'
                ? t('energy.generatorNuclear')
                : gen.slug;
        return `<option value="${escapeHtml(gen.slug)}" ${
          gen.slug === buildingSlug ? 'selected' : ''
        }>${escapeHtml(label)}</option>`;
      })
      .join('');
    const fuelOptions = (def?.fuelOptions || [])
      .map(
        (opt) =>
          `<option value="${escapeHtml(opt.slug)}" ${
            opt.slug === fuelSlug ? 'selected' : ''
          }>${escapeHtml(resolveFuelOptionLabel(opt))}</option>`
      )
      .join('');
    const mwValue =
      chain.target_power_mw != null && Number(chain.target_power_mw) > 0
        ? String(chain.target_power_mw)
        : '';
    const fuelRateValue =
      chain.target_fuel_rate != null && Number(chain.target_fuel_rate) > 0
        ? String(chain.target_fuel_rate)
        : '';
    const targetValue = targetMode === 'fuel' ? fuelRateValue : mwValue;

    return `
      <section class="production-targets-section energy-targets-section">
        <div class="production-section-header-row">
          <h3 class="production-section-header">${escapeHtml(t('energy.sectionTarget'))}</h3>
          <button type="button" class="btn btn-primary" id="btn-energy-replan">
            ${escapeHtml(t('energy.replan'))}
          </button>
        </div>
        <div class="production-plan-constraints">
          <div class="production-plan-constraint">
            <label for="energy-plan-target-mode">${escapeHtml(t('energy.targetMode'))}</label>
            <div class="production-plan-constraint-controls">
              <select id="energy-plan-target-mode">
                <option value="mw" ${targetMode === 'mw' ? 'selected' : ''}>${escapeHtml(t('energy.targetModeMw'))}</option>
                <option value="fuel" ${targetMode === 'fuel' ? 'selected' : ''}>${escapeHtml(t('energy.targetModeFuel'))}</option>
              </select>
              <input
                type="text"
                id="energy-plan-target-value"
                class="production-target-rate-input production-config-decimal-input"
                inputmode="decimal"
                value="${escapeHtml(targetValue)}"
                data-mw-value="${escapeHtml(mwValue)}"
                data-fuel-value="${escapeHtml(fuelRateValue)}"
              />
            </div>
          </div>
          <div class="production-plan-constraint">
            <label for="energy-plan-generator">${escapeHtml(t('energy.generatorType'))}</label>
            <select id="energy-plan-generator">${genOptions}</select>
          </div>
          <div class="production-plan-constraint">
            <label for="energy-plan-fuel">${escapeHtml(t('common.fuel'))}</label>
            <select id="energy-plan-fuel">${fuelOptions}</select>
          </div>
          ${renderEnergyPowerShardControls(chain, { idPrefix: 'energy-plan' })}
        </div>
        <div class="form-option energy-plan-link-fuel-option">
          <label class="form-option-label" for="energy-plan-link-fuel-production">
            <input
              type="checkbox"
              id="energy-plan-link-fuel-production"
              ${chain.linked_production_chain_id ? 'checked' : ''}
            />
            <span class="form-option-copy">
              <span class="form-option-title">${escapeHtml(t('energy.linkFuelProduction'))}</span>
              <span class="form-option-hint">${escapeHtml(t('energy.linkFuelProductionHint'))}</span>
            </span>
          </label>
        </div>
        <p class="production-targets-hint">${escapeHtml(t('energy.targetsHint'))}</p>
      </section>`;
  }

  async function applyEnergyPlanTargetsFromUi() {
    if (!activeEnergyChainId) return;
    const mode = document.getElementById('energy-plan-target-mode')?.value === 'fuel' ? 'fuel' : 'mw';
    const valueRaw = document.getElementById('energy-plan-target-value')?.value;
    const buildingSlug = document.getElementById('energy-plan-generator')?.value;
    const fuelSlug = document.getElementById('energy-plan-fuel')?.value;
    const powerShardLimit = readEnergyPowerShardLimitFromUi('energy-plan');
    const linkFuelProduction = Boolean(
      document.getElementById('energy-plan-link-fuel-production')?.checked
    );
    const targetValue = Number(String(valueRaw ?? '').replace(',', '.'));
    if (!Number.isFinite(targetValue) || targetValue <= 0) {
      await window.showAlert?.({
        title: t('errors.saveFailed'),
        message: mode === 'fuel' ? t('energy.invalidTargetFuel') : t('energy.invalidTargetMw'),
      });
      return;
    }
    try {
      const payload = {
        target_mode: mode,
        target_building_slug: buildingSlug,
        target_fuel_slug: fuelSlug,
        power_shard_limit: powerShardLimit,
        link_fuel_production: linkFuelProduction,
      };
      if (mode === 'fuel') {
        payload.target_fuel_rate = targetValue;
      } else {
        payload.target_power_mw = targetValue;
      }
      activeEnergyDetail = await window.satisfactory.setEnergyChainTargets(activeEnergyChainId, payload);
      renderEnergyDetailContent(activeEnergyDetail);
      loadEnergyChains().catch(console.error);
    } catch (err) {
      console.error('Energy replan error:', err);
      await window.showAlert?.({
        title: t('errors.saveFailed'),
        message: err.message || t('errors.saveFailed'),
      });
    }
  }

  function openEnergyCreateModal() {
    hideEnergyCreateError();
    energyCreateForm.reset();
    const modeSelect = document.getElementById('energy-create-target-mode');
    if (modeSelect) modeSelect.value = 'mw';
    syncEnergyCreateTargetPlaceholder();
    ensureItemNameCache()
      .then(() => populateEnergyCreateGeneratorSelects())
      .catch(() => populateEnergyCreateGeneratorSelects());
    bindEnergyPowerShardControls(energyCreateModal);
    const linkFuelEl = document.getElementById('energy-create-link-fuel-production');
    if (linkFuelEl) linkFuelEl.checked = true;
    energyCreateModal.classList.remove('hidden');
    energyCreateModal.setAttribute('aria-hidden', 'false');
    document.getElementById('energy-chain-name').focus();
  }

  function closeEnergyCreateModal() {
    energyCreateModal.classList.add('hidden');
    energyCreateModal.setAttribute('aria-hidden', 'true');
    hideEnergyCreateError();
  }

  async function handleEnergyProductionLinkChange(checkbox) {
    const generatorId = Number(checkbox.dataset.generatorId);
    const itemSlug = checkbox.dataset.itemSlug;
    const stepId = Number(checkbox.dataset.producerStepId);
    if (!generatorId || !itemSlug || !stepId) return;

    const generator = activeEnergyDetail?.generators?.find((item) => item.id === generatorId);
    if (!generator) return;

    const currentIds = getLinkedProductionForInput(generator, itemSlug)
      .map((link) => Number(link.producer_production_step_id))
      .filter(Boolean);

    let nextIds;
    if (checkbox.checked) {
      nextIds = [...new Set([...currentIds, stepId])];
    } else {
      nextIds = currentIds.filter((id) => id !== stepId);
    }

    try {
      activeEnergyDetail = await window.satisfactory.setEnergyGeneratorProductionLinks(
        generatorId,
        itemSlug,
        nextIds
      );
      renderEnergyDetailContent(activeEnergyDetail);
    } catch (err) {
      checkbox.checked = !checkbox.checked;
      console.error('Set energy production links error:', err);
    }
  }

  async function handleEnergyExtractionLinkChange(checkbox) {
    const generatorId = Number(checkbox.dataset.generatorId);
    const itemSlug = checkbox.dataset.itemSlug;
    const extractionId = Number(checkbox.dataset.extractionId);
    if (!generatorId || !itemSlug || !extractionId) return;

    const generator = activeEnergyDetail?.generators?.find((item) => item.id === generatorId);
    if (!generator) return;

    const currentIds = (generator.input_links?.[itemSlug] ?? [])
      .map((link) => Number(link.producer_extraction_id))
      .filter(Boolean);

    let nextIds;
    if (checkbox.checked) {
      nextIds = [...new Set([...currentIds, extractionId])];
    } else {
      nextIds = currentIds.filter((id) => id !== extractionId);
    }

    try {
      activeEnergyDetail = await window.satisfactory.setEnergyGeneratorInputLinks(
        generatorId,
        itemSlug,
        nextIds
      );
      renderEnergyDetailContent(activeEnergyDetail);
    } catch (err) {
      checkbox.checked = !checkbox.checked;
      console.error('Set energy extraction links error:', err);
    }
  }

  function setupEnergy() {
    document.getElementById('btn-new-energy').addEventListener('click', openEnergyCreateModal);
    document.getElementById('btn-import-energy').addEventListener('click', async () => {
      try {
        const result = await window.satisfactory.importEnergyChain();
        if (result?.canceled) return;
        if (result?.typeMismatch) {
          await showImportTypeMismatchAlert(result.typeMismatch);
          return;
        }
        if (!result?.chain) return;
        energyChains = [result.chain, ...energyChains.filter((item) => item.id !== result.chain.id)];
        await loadEnergyChainSummaries();
        renderEnergyChains();
      } catch (err) {
        console.error('Energy import error:', err);
        await showAlert({
          title: t('errors.importFailed'),
          message: err.message || t('errors.importFailed'),
        });
      }
    });
    document.getElementById('energy-create-modal-close').addEventListener('click', closeEnergyCreateModal);
    document.getElementById('energy-create-cancel').addEventListener('click', closeEnergyCreateModal);
    document.getElementById('energy-create-target-mode')?.addEventListener('change', syncEnergyCreateTargetPlaceholder);
    document.getElementById('energy-detail-back').addEventListener('click', closeEnergyDetail);
    document.getElementById('btn-add-energy-extraction').addEventListener('click', openEnergyExtractionPickerModal);
    document.getElementById('btn-add-energy-generator').addEventListener('click', openEnergyGeneratorPickerModal);
    document.getElementById('btn-energy-tree-view')?.addEventListener('click', toggleEnergyTreeView);

    energyCreateModal.addEventListener('click', (e) => {
      if (e.target === energyCreateModal) closeEnergyCreateModal();
    });
    energyExtractionPickerModal.addEventListener('click', (e) => {
      if (e.target === energyExtractionPickerModal) closeEnergyExtractionPickerModal();
    });
    energyGeneratorPickerModal.addEventListener('click', (e) => {
      if (e.target === energyGeneratorPickerModal) closeEnergyGeneratorPickerModal();
    });

    document.getElementById('energy-extraction-picker-close').addEventListener('click', closeEnergyExtractionPickerModal);
    document.getElementById('energy-generator-picker-close').addEventListener('click', closeEnergyGeneratorPickerModal);

    energyCreateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideEnergyCreateError();
      const name = document.getElementById('energy-chain-name').value.trim();
      if (!name) {
        showEnergyCreateError(t('errors.nameRequired'));
        return;
      }
      const mode =
        document.getElementById('energy-create-target-mode')?.value === 'fuel' ? 'fuel' : 'mw';
      const valueRaw = document.getElementById('energy-create-target-value')?.value?.trim() || '';
      const buildingSlug = document.getElementById('energy-create-generator')?.value || '';
      const fuelSlug = document.getElementById('energy-create-fuel')?.value || '';
      const powerShardLimit = readEnergyPowerShardLimitFromUi('energy-create');
      const payload = { name, power_shard_limit: powerShardLimit, target_mode: mode };
      if (valueRaw) {
        const targetValue = Number(String(valueRaw).replace(',', '.'));
        if (!Number.isFinite(targetValue) || targetValue <= 0) {
          showEnergyCreateError(
            mode === 'fuel' ? t('energy.invalidTargetFuel') : t('energy.invalidTargetMw')
          );
          return;
        }
        if (!buildingSlug || !fuelSlug) {
          showEnergyCreateError(t('energy.invalidGeneratorFuel'));
          return;
        }
        payload.auto_plan = true;
        payload.target_building_slug = buildingSlug;
        payload.target_fuel_slug = fuelSlug;
        payload.link_fuel_production = Boolean(
          document.getElementById('energy-create-link-fuel-production')?.checked
        );
        if (mode === 'fuel') {
          payload.target_fuel_rate = targetValue;
        } else {
          payload.target_power_mw = targetValue;
        }
      }
      try {
        const chain = await window.satisfactory.createEnergyChain(payload);
        closeEnergyCreateModal();
        energyChains.unshift(chain);
        renderEnergyChains();
        openEnergyDetail(chain.id);
      } catch (err) {
        showEnergyCreateError(err.message || t('errors.createFailed'));
      }
    });

    document.getElementById('energy-container').addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.production-edit-btn');
      if (editBtn) {
        e.preventDefault();
        e.stopPropagation();
        const chainId = Number(editBtn.dataset.id);
        const chain = energyChains.find((item) => item.id === chainId);
        if (!chain) return;
        window.openSchemaRenameModal?.({
          kind: 'energy',
          id: chainId,
          name: chain.name,
          onSaved: (updated) => {
            const index = energyChains.findIndex((item) => item.id === chainId);
            if (index >= 0) energyChains[index] = updated;
            if (activeEnergyDetail?.chain?.id === chainId) {
              activeEnergyDetail.chain.name = updated.name;
              document.getElementById('energy-detail-heading').textContent = updated.name;
              document.getElementById('energy-detail-breadcrumb').textContent = updated.name;
            }
            renderEnergyChains();
          },
        });
        return;
      }

      const exportBtn = e.target.closest('.production-export-btn');
      if (exportBtn) {
        e.preventDefault();
        e.stopPropagation();
        const chainId = Number(exportBtn.dataset.id);
        const chain = energyChains.find((item) => item.id === chainId);
        if (!chain) return;
        try {
          await window.satisfactory.exportEnergyChain(chainId);
        } catch (err) {
          console.error('Energy export error:', err);
        }
        return;
      }

      const deleteBtn = e.target.closest('.production-delete-btn');
      if (deleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        const chainId = Number(deleteBtn.dataset.id);
        const chain = energyChains.find((item) => item.id === chainId);
        if (!chain) return;
        const confirmed = await showConfirm({
          title: t('confirm.deleteEnergyPlanTitle'),
          message: t('confirm.deleteEnergyPlanMessage', { name: chain.name }),
          confirmLabel: t('actions.delete'),
        });
        if (!confirmed) return;
        try {
          await window.satisfactory.deleteEnergyChain(chainId);
          energyChains = energyChains.filter((item) => item.id !== chainId);
          energyChainSummaries.delete(chainId);
          renderEnergyChains();
        } catch (err) {
          console.error('Energy delete error:', err);
        }
        return;
      }

      const openTarget = e.target.closest('.production-card-body');
      if (openTarget) {
        openEnergyDetail(Number(openTarget.dataset.id));
      }
    });

    document.getElementById('energy-extraction-picker-list').addEventListener('click', async (e) => {
      const btn = e.target.closest('.picker-item');
      if (!btn || !activeEnergyChainId) return;
      try {
        activeEnergyDetail = await window.satisfactory.addEnergyExtraction(activeEnergyChainId, {
          item_id: Number(btn.dataset.id),
        });
        closeEnergyExtractionPickerModal();
        renderEnergyDetailContent(activeEnergyDetail);
      } catch (err) {
        console.error('Energy add extraction error:', err);
      }
    });

    document.getElementById('energy-generator-picker-list').addEventListener('click', async (e) => {
      const btn = e.target.closest('.picker-item');
      if (!btn || !activeEnergyChainId) return;
      try {
        activeEnergyDetail = await window.satisfactory.addEnergyGenerator(activeEnergyChainId, {
          building_slug: btn.dataset.slug,
        });
        closeEnergyGeneratorPickerModal();
        renderEnergyDetailContent(activeEnergyDetail);
      } catch (err) {
        console.error('Energy add generator error:', err);
      }
    });

    energyDetailBody.addEventListener('focusin', (e) => {
      const UI = productionUi();
      const slider = e.target.closest('.production-config-slider');
      if (slider && UI.isConfigSlider?.(slider)) {
        UI.activateConfigSlider?.(slider);
        return;
      }
      const input = UI.getEditableConfigInput?.(e.target);
      if (!input) return;
      UI.rememberConfigInputValue?.(input);
      UI.activateConfigNumberInput?.(input);
    });

    energyDetailBody.addEventListener('focusout', (e) => {
      const UI = productionUi();
      const slider = e.target.closest('.production-config-slider');
      if (slider && UI.isConfigSlider?.(slider)) {
        window.setTimeout(() => {
          if (document.activeElement === slider) return;
          UI.deactivateConfigSlider?.(slider);
        }, 0);
        return;
      }
      const input = UI.getEditableConfigInput?.(e.target);
      const field = input ? UI.getConfigInputField?.(input) : null;
      if (!input || !field) return;
      window.setTimeout(() => {
        if (document.activeElement === input) return;
        const prev = input.dataset.configInputPrev;
        if (prev != null && prev !== input.value) {
          commitEnergyConfigInputFromField(input, field);
          UI.rememberConfigInputValue?.(input);
        }
        UI.lockConfigNumberInput?.(input);
      }, 0);
    });

    energyDetailBody.addEventListener('keydown', handleEnergyConfigInputKeydown);

    energyDetailBody.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const UI = productionUi();
      const slider = e.target.closest('.production-config-slider');
      if (slider && UI.isConfigSlider?.(slider) && UI.isConfigSliderLocked?.(slider)) {
        UI.activateConfigSlider?.(slider);
      }
    });

    energyDetailBody.addEventListener('pointerup', (e) => {
      if (e.button !== 0) return;
      productionUi().lockActiveConfigSlidersOutsidePointer?.(
        e.clientX,
        e.clientY,
        energyDetailBody
      );
    });

    energyDetailBody.addEventListener('pointerleave', (e) => {
      const UI = productionUi();
      const field = e.target.closest('.production-config-field');
      if (!field || e.target !== field) return;
      const slider = field.querySelector('.production-config-slider');
      if (!slider || !UI.isConfigSlider?.(slider)) return;
      if (e.buttons !== 0) return;
      if (field.contains(e.relatedTarget)) return;
      UI.deactivateConfigSlider?.(slider);
    });

    energyDetailBody.addEventListener('input', (e) => {
      const UI = productionUi();
      const configInput = UI.resolveConfigNumberInput?.(e.target);
      if (configInput && UI.normalizeConfigInputSpinnerStep?.(configInput, e, commitEnergyConfigInputChange)) return;

      const outputSlider = e.target.closest('.production-extraction-output-slider');
      if (outputSlider) {
        UI.guardConfigSliderInput?.(outputSlider, () => handleExtractionSliderInput(outputSlider, 'output'));
        return;
      }
      const overclockSlider = e.target.closest('.production-extraction-overclock-slider');
      if (overclockSlider) {
        UI.guardConfigSliderInput?.(overclockSlider, () =>
          handleExtractionSliderInput(overclockSlider, 'overclock')
        );
        return;
      }
      const nodesSlider = e.target.closest('.production-extraction-nodes-slider');
      if (nodesSlider) {
        UI.guardConfigSliderInput?.(nodesSlider, () => handleExtractionSliderInput(nodesSlider, 'nodes'));
        return;
      }
      const powerSlider = e.target.closest('.energy-generator-fuel-slider');
      if (powerSlider) {
        UI.guardConfigSliderInput?.(powerSlider, () => handleGeneratorSliderInput(powerSlider, 'fuel'));
        return;
      }
      const machinesSlider = e.target.closest('.energy-generator-machines-slider');
      if (machinesSlider) {
        UI.guardConfigSliderInput?.(machinesSlider, () =>
          handleGeneratorSliderInput(machinesSlider, 'machines')
        );
        return;
      }
      const genOverclockSlider = e.target.closest('.energy-generator-overclock-slider');
      if (genOverclockSlider) {
        UI.guardConfigSliderInput?.(genOverclockSlider, () =>
          handleGeneratorSliderInput(genOverclockSlider, 'overclock')
        );
      }
    });

    energyDetailBody.addEventListener('change', async (e) => {
      const productionLinkCheckbox = e.target.closest('.energy-production-link-checkbox');
      if (productionLinkCheckbox) {
        await handleEnergyProductionLinkChange(productionLinkCheckbox);
        return;
      }

      const extractionLinkCheckbox = e.target.closest(
        '.energy-extraction-link-checkbox, .energy-extraction-generator-link-checkbox'
      );
      if (extractionLinkCheckbox) {
        await handleEnergyExtractionLinkChange(extractionLinkCheckbox);
        return;
      }

      const UI = productionUi();
      const configInput = UI.resolveConfigNumberInput?.(e.target);
      const field = configInput ? UI.getConfigInputField?.(configInput) : null;
      if (field) {
        commitEnergyConfigInputFromField(configInput, field);
        UI.rememberConfigInputValue?.(configInput);
      }
    });

    energyDetailBody.addEventListener('click', async (e) => {
      const UI = productionUi();
      const themeSelectOption = e.target.closest('.theme-select-option');
      if (themeSelectOption) {
        e.preventDefault();
        e.stopPropagation();
        const select = themeSelectOption.closest('.theme-select');
        if (select?.dataset.extractionId && select.dataset.field) {
          const extractionId = Number(select.dataset.extractionId);
          const field = select.dataset.field;
          handleEnergyExtractionConfigChange(extractionId, field, themeSelectOption.dataset.value);
          UI.closeAllThemeSelects?.();
          return;
        }
        if (select?.dataset.generatorId && select.dataset.field === 'fuel') {
          const generatorId = Number(select.dataset.generatorId);
          const debounceKey = String(generatorId);
          if (generatorConfigDebounce.has(debounceKey)) {
            clearTimeout(generatorConfigDebounce.get(debounceKey));
            generatorConfigDebounce.delete(debounceKey);
          }
          try {
            activeEnergyDetail = await window.satisfactory.updateEnergyGenerator(generatorId, {
              fuel_slug: themeSelectOption.dataset.value,
            });
            renderEnergyDetailContent(activeEnergyDetail);
          } catch (err) {
            console.error('Energy generator fuel error:', err);
          }
          UI.closeAllThemeSelects?.();
          return;
        }
      }

      const themeSelectTrigger = e.target.closest('.theme-select-trigger');
      if (themeSelectTrigger) {
        e.preventDefault();
        e.stopPropagation();
        UI.toggleThemeSelect?.(themeSelectTrigger.closest('.theme-select'));
        return;
      }

      if (!e.target.closest('.theme-select')) {
        UI.closeAllThemeSelects?.();
      }

      const duplicateBtn = e.target.closest('.energy-extraction-duplicate-btn');
      if (duplicateBtn) {
        try {
          activeEnergyDetail = await window.satisfactory.addEnergyExtraction(activeEnergyChainId, {
            item_id: Number(duplicateBtn.dataset.itemId),
          });
          renderEnergyDetailContent(activeEnergyDetail);
        } catch (err) {
          console.error('Energy duplicate extraction error:', err);
        }
        return;
      }

      const resetExtractionBtn = e.target.closest('.energy-extraction-reset-btn');
      if (resetExtractionBtn) {
        try {
          activeEnergyDetail = await window.satisfactory.resetEnergyExtraction(
            Number(resetExtractionBtn.dataset.extractionId)
          );
          renderEnergyDetailContent(activeEnergyDetail);
        } catch (err) {
          console.error('Energy reset extraction error:', err);
        }
        return;
      }

      const deleteExtractionBtn = e.target.closest('.energy-extraction-delete-btn');
      if (deleteExtractionBtn) {
        try {
          activeEnergyDetail = await window.satisfactory.deleteEnergyExtraction(
            Number(deleteExtractionBtn.dataset.extractionId)
          );
          renderEnergyDetailContent(activeEnergyDetail);
        } catch (err) {
          console.error('Energy delete extraction error:', err);
        }
        return;
      }

      const resetGeneratorBtn = e.target.closest('.energy-generator-reset-btn');
      if (resetGeneratorBtn) {
        try {
          activeEnergyDetail = await window.satisfactory.resetEnergyGenerator(
            Number(resetGeneratorBtn.dataset.generatorId)
          );
          renderEnergyDetailContent(activeEnergyDetail);
        } catch (err) {
          console.error('Energy reset generator error:', err);
        }
        return;
      }

      const deleteGeneratorBtn = e.target.closest('.energy-generator-delete-btn');
      if (deleteGeneratorBtn) {
        try {
          activeEnergyDetail = await window.satisfactory.deleteEnergyGenerator(
            Number(deleteGeneratorBtn.dataset.generatorId)
          );
          renderEnergyDetailContent(activeEnergyDetail);
        } catch (err) {
          console.error('Energy delete generator error:', err);
        }
      }
    });
  }

  window.EnergyUI = {
    setupEnergy,
    loadEnergyChains,
    openEnergyDetail,
    closeEnergyDetail,
    computeEnergyResourceBalance,
    commitEnergyConfigInputChange,
    clearLocaleCaches: () => {
      energyExtractionItems = [];
      energyGeneratorCatalog = [];
      itemNameBySlug = new Map();
    },
    reloadActiveDetail: async () => {
      if (!activeEnergyChainId) return null;
      await ensureItemNameCache();
      activeEnergyDetail = await window.satisfactory.getEnergyChainDetail(activeEnergyChainId, {
        includeProductionObjectives: true,
      });
      renderEnergyDetailContent(activeEnergyDetail);
      return activeEnergyDetail;
    },
  };

  setupEnergy();
  if (typeof initDashboard === 'function') {
    initDashboard();
  }
})();
