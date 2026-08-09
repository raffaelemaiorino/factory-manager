(() => {
  const t = (key, vars) => window.t(key, vars);

  let transportPlans = [];
  let vehiclesCatalog = [];
  let activeTransportPlanId = null;
  let activeTransportDetail = null;
  let selectedVehicleSlug = null;

  const transportCreateModal = document.getElementById('transport-create-modal');
  const transportCreateForm = document.getElementById('transport-create-form');
  const transportCreateError = document.getElementById('transport-create-error');
  const transportSlotModal = document.getElementById('transport-slot-modal');
  const LOCOMOTIVE_IMAGE = 'assets/vehicles/Desc_Locomotive_C.png';

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

  function formatRate(value, isFluid) {
    const n = Number(value);
    const formatted = window.NumberFormat?.formatDisplayNumber?.(n) ?? String(n);
    return isFluid ? `${formatted} m³/min` : `${formatted}/min`;
  }

  function showConfirm({ title, message, confirmLabel = t('common.confirm') }) {
    if (typeof window.showConfirm === 'function') {
      return window.showConfirm({ title, message, confirmLabel });
    }
    return Promise.resolve(window.confirm(message));
  }

  function showAlert({ title, message }) {
    if (typeof window.showAlert === 'function') {
      return window.showAlert({ title, message });
    }
    window.alert?.(message);
    return Promise.resolve();
  }

  function localeIsIt() {
    return (window.I18nUI?.getLocale?.() || 'it').toLowerCase().startsWith('it');
  }

  /** IT → nome italiano; altre lingue → inglese (nomi ufficiali Satisfactory). */
  function vehicleDisplayName(vehicle) {
    if (!vehicle) return '';
    if (localeIsIt()) {
      return vehicle.name_it || vehicle.name || vehicle.slug || '';
    }
    return vehicle.name_en || vehicle.name || vehicle.slug || '';
  }

  function vehicleUnitLabel(vehicle, count) {
    if (!vehicle) return t('transport.unitsGeneric', { count });
    const label = localeIsIt()
      ? vehicle.unit_label_it || vehicleDisplayName(vehicle)
      : vehicle.unit_label_en || vehicleDisplayName(vehicle);
    return `${count} ${label}`;
  }

  function mkOptionsHtml(maxMk, selected) {
    const parts = [];
    for (let mk = 1; mk <= maxMk; mk += 1) {
      parts.push(
        `<option value="${mk}" ${Number(selected) === mk ? 'selected' : ''}>Mk.${mk}</option>`
      );
    }
    return parts.join('');
  }

  function calcIsStationLimited(calc) {
    return (calc?.breakdown || []).some((row) => row.limiting === 'station');
  }

  function formatStationsSummary(calc) {
    if (!calc?.apply_station_limit) return '';
    const stations = Number(calc.stations_needed) || 0;
    if (stations <= 0) return '';
    const ports = Number(calc.belts_or_pipes_needed) || stations * 2;
    return t('transport.stationsSummaryPerCar', {
      stations,
      ports,
    });
  }

  function vehicleImageSrc(vehicle) {
    if (!vehicle?.image) return '';
    return vehicle.image.startsWith('assets/') ? vehicle.image : `assets/${vehicle.image}`;
  }

  function itemImageSrc(item) {
    const image = item?.image;
    if (!image) return '';
    return image.startsWith('assets/') ? image : `assets/${image}`;
  }

  function showCreateError(message) {
    if (!transportCreateError) return;
    transportCreateError.textContent = message || '';
    transportCreateError.classList.toggle('hidden', !message);
  }

  async function ensureVehicles() {
    if (vehiclesCatalog.length) return vehiclesCatalog;
    vehiclesCatalog = await window.satisfactory.getTransportVehicles();
    return vehiclesCatalog;
  }

  async function loadTransportPlans() {
    const container = document.getElementById('transport-container');
    if (!container) return;
    container.innerHTML = `<p class="loading">${escapeHtml(t('common.loadingSchemas'))}</p>`;
    try {
      await ensureVehicles();
      transportPlans = await window.satisfactory.getTransportPlans();
      renderTransportList();
    } catch (err) {
      console.error(err);
      container.innerHTML = `<p class="empty-state">${escapeHtml(t('transport.errorLoadList'))}</p>`;
    }
  }

  function renderTransportList() {
    const container = document.getElementById('transport-container');
    if (!container) return;

    if (!transportPlans.length) {
      container.innerHTML = `
        <section class="card production-empty">
          <div class="empty-state">
            <p>${escapeHtml(t('transport.emptyList'))}</p>
            <p class="page-subtitle">${escapeHtml(t('transport.emptyListHint'))}</p>
          </div>
        </section>`;
      return;
    }

    const cards = transportPlans
      .map((plan) => {
        const vehicle = plan.vehicle || vehiclesCatalog.find((v) => v.slug === plan.vehicle_slug);
        const calc = plan.calculation || {};
        const needed = calc.vehicles_needed ?? 0;
        const rtd = calc.round_trip_minutes;
        const img = vehicleImageSrc(vehicle);
        const vehicleCap =
          vehicle?.cargo_kind === 'fluid'
            ? `${vehicle.fluid_capacity} m³`
            : vehicle?.cargo_kind === 'mixed'
              ? `${t('transport.slotsCount', { count: vehicle.inventory_slots })} · ${vehicle.fluid_capacity} m³`
              : vehicle?.inventory_slots != null
                ? t('transport.slotsCount', { count: vehicle.inventory_slots })
                : '';

        const cargoChips = (plan.cargo || [])
          .map((line) => {
            const itemImg = itemImageSrc(line);
            const isFluid = line.is_fluid || line.stack_size == null;
            const rateLabel = formatRate(line.rate, isFluid);
            const mixHint =
              !isFluid && line.allow_mix
                ? `<span class="transport-card-cargo-mix">${escapeHtml(t('transport.cardMixShort'))}</span>`
                : '';
            return `
              <div class="transport-card-cargo-chip" title="${escapeHtml(`${line.name || line.item_slug}: ${rateLabel}`)}">
                ${itemImg ? `<img src="${escapeHtml(itemImg)}" alt="" />` : ''}
                <div class="transport-card-cargo-text">
                  <span class="transport-card-cargo-name">${escapeHtml(line.name || line.item_slug)}</span>
                  <span class="transport-card-cargo-rate">${escapeHtml(rateLabel)}${mixHint}</span>
                </div>
              </div>`;
          })
          .join('');

        return `
          <article class="production-card transport-card" data-transport-id="${plan.id}">
            <div class="production-card-body transport-card-body" role="button" tabindex="0" data-transport-open="${plan.id}">
              <div class="transport-card-vehicle">
                ${
                  img
                    ? `<img class="transport-card-vehicle-img" src="${escapeHtml(img)}" alt="" />`
                    : `<div class="transport-card-vehicle-placeholder"></div>`
                }
              </div>
              <div class="transport-card-main">
                <div class="transport-card-heading">
                  <h3>${escapeHtml(plan.name)}</h3>
                  <p class="production-card-meta">
                    ${escapeHtml(vehicleDisplayName(vehicle) || plan.vehicle_slug)}${
                      vehicleCap ? ` · ${escapeHtml(vehicleCap)}` : ''
                    }
                  </p>
                </div>
                <div class="transport-card-stats">
                  <div class="transport-card-stat transport-card-stat--accent">
                    <span class="transport-card-stat-label">${escapeHtml(t('transport.cardVehicles'))}</span>
                    <span class="transport-card-stat-value">${escapeHtml(vehicleUnitLabel(vehicle, needed))}</span>
                  </div>
                  ${
                    calc.apply_station_limit && (calc.stations_needed || 0) > 0
                      ? `<div class="transport-card-stat">
                    <span class="transport-card-stat-label">${escapeHtml(t('transport.cardStations'))}</span>
                    <span class="transport-card-stat-value">${escapeHtml(String(calc.stations_needed))}</span>
                  </div>`
                      : ''
                  }
                  <div class="transport-card-stat">
                    <span class="transport-card-stat-label">${escapeHtml(t('transport.outboundMinutes'))}</span>
                    <span class="transport-card-stat-value">${escapeHtml(String(plan.outbound_minutes ?? '—'))} min</span>
                  </div>
                  <div class="transport-card-stat">
                    <span class="transport-card-stat-label">${escapeHtml(t('transport.returnMinutes'))}</span>
                    <span class="transport-card-stat-value">${escapeHtml(String(plan.return_minutes ?? '—'))} min</span>
                  </div>
                  <div class="transport-card-stat">
                    <span class="transport-card-stat-label">${escapeHtml(t('transport.cardRoundTrip'))}</span>
                    <span class="transport-card-stat-value">${escapeHtml(rtd != null ? `${rtd} min` : '—')}</span>
                  </div>
                </div>
                ${
                  calcIsStationLimited(calc)
                    ? `<p class="transport-card-station-limit">${escapeHtml(t('transport.limitingStation'))}</p>`
                    : ''
                }
                ${
                  cargoChips
                    ? `<div class="transport-card-cargo">${cargoChips}</div>`
                    : `<p class="transport-card-cargo-empty">${escapeHtml(t('transport.cargoEmptyHint'))}</p>`
                }
                <p class="transport-card-updated">${escapeHtml(
                  t('time.updated', { when: formatDateTime(plan.updated_at) })
                )}</p>
              </div>
            </div>
            <div class="production-card-actions">
              <button type="button" class="production-edit-btn" data-transport-rename="${plan.id}" title="${escapeHtml(t('actions.rename'))}" aria-label="${escapeHtml(t('actions.rename'))}">
                ${EDIT_ICON}
              </button>
              <button type="button" class="production-duplicate-btn" data-transport-duplicate="${plan.id}" title="${escapeHtml(t('production.duplicate'))}" aria-label="${escapeHtml(t('production.duplicate'))}">
                ${DUPLICATE_ICON}
              </button>
              <button type="button" class="production-delete-btn" data-transport-delete="${plan.id}" title="${escapeHtml(t('actions.delete'))}" aria-label="${escapeHtml(t('actions.delete'))}">
                ${DELETE_ICON}
              </button>
            </div>
          </article>`;
      })
      .join('');

    container.innerHTML = `<section class="card"><div class="production-list">${cards}</div></section>`;
  }

  function renderCreateVehicleGrid() {
    const grid = document.getElementById('transport-create-vehicle-grid');
    if (!grid) return;
    if (!selectedVehicleSlug && vehiclesCatalog.length) {
      selectedVehicleSlug = vehiclesCatalog[0].slug;
    }
    grid.innerHTML = vehiclesCatalog
      .map((vehicle) => {
        const selected = vehicle.slug === selectedVehicleSlug ? ' is-selected' : '';
        const img = vehicleImageSrc(vehicle);
        const cap =
          vehicle.cargo_kind === 'fluid'
            ? `${vehicle.fluid_capacity} m³`
            : vehicle.cargo_kind === 'mixed'
              ? `${t('transport.slotsCount', { count: vehicle.inventory_slots })} · ${vehicle.fluid_capacity} m³`
              : t('transport.slotsCount', { count: vehicle.inventory_slots });
        return `
          <button type="button" class="transport-vehicle-option${selected}" data-vehicle-slug="${escapeHtml(vehicle.slug)}">
            ${img ? `<img src="${escapeHtml(img)}" alt="" />` : ''}
            <span class="transport-vehicle-option-name">${escapeHtml(vehicleDisplayName(vehicle))}</span>
            <span class="transport-vehicle-option-cap">${escapeHtml(cap)}</span>
          </button>`;
      })
      .join('');
  }

  async function openTransportCreateModal() {
    await ensureVehicles();
    selectedVehicleSlug = vehiclesCatalog[0]?.slug || null;
    showCreateError('');
    const nameInput = document.getElementById('transport-plan-name');
    const outboundInput = document.getElementById('transport-create-outbound');
    const returnInput = document.getElementById('transport-create-return');
    const beltMkInput = document.getElementById('transport-create-belt-mk');
    const pipeMkInput = document.getElementById('transport-create-pipe-mk');
    if (nameInput) nameInput.value = '';
    if (outboundInput) outboundInput.value = '';
    if (returnInput) returnInput.value = '';
    if (beltMkInput) beltMkInput.value = '5';
    if (pipeMkInput) pipeMkInput.value = '2';
    renderCreateVehicleGrid();
    transportCreateModal?.classList.remove('hidden');
    transportCreateModal?.setAttribute('aria-hidden', 'false');
    nameInput?.focus();
  }

  function closeTransportCreateModal() {
    transportCreateModal?.classList.add('hidden');
    transportCreateModal?.setAttribute('aria-hidden', 'true');
    showCreateError('');
  }

  function onCargoPicked(item, mode) {
    const line = {
      item_slug: item.slug,
      name: item.name,
      image: item.image,
      stack_size: item.stack_size ?? null,
      rate: 60,
      allow_mix: 0,
    };
    if (mode === 'transport-detail-cargo' && activeTransportPlanId) {
      addCargoToActivePlan(line).catch((err) => {
        console.error(err);
        showAlert({ title: t('transport.title'), message: err.message || t('errors.saveFailed') });
      });
    }
  }

  function serializeCargo(cargoLines) {
    return (cargoLines || []).map((line) => ({
      item_slug: line.item_slug,
      rate: line.rate,
      allow_mix: Boolean(line.allow_mix) && !(line.is_fluid || line.stack_size == null),
    }));
  }

  async function addCargoToActivePlan(line) {
    const detail = activeTransportDetail;
    if (!detail) return;
    const cargo = [
      ...serializeCargo(detail.cargo),
      {
        item_slug: line.item_slug,
        rate: line.rate,
        allow_mix: false,
      },
    ];
    activeTransportDetail = await window.satisfactory.updateTransportPlan(detail.id, { cargo });
    renderTransportDetail();
    await loadTransportPlans();
  }

  async function submitCreate(event) {
    event.preventDefault();
    showCreateError('');
    const name = document.getElementById('transport-plan-name')?.value?.trim() || '';
    const outbound = Number(
      String(document.getElementById('transport-create-outbound')?.value || '').replace(',', '.')
    );
    const returnMinutes = Number(
      String(document.getElementById('transport-create-return')?.value || '').replace(',', '.')
    );
    const beltMk = Number(document.getElementById('transport-create-belt-mk')?.value || 5);
    const pipeMk = Number(document.getElementById('transport-create-pipe-mk')?.value || 2);
    if (!name) {
      showCreateError(t('errors.nameRequired') || t('common.name'));
      return;
    }
    if (!selectedVehicleSlug) {
      showCreateError(t('transport.vehicleRequired'));
      return;
    }
    if (!Number.isFinite(outbound) || outbound <= 0) {
      showCreateError(t('transport.outboundInvalid'));
      return;
    }
    if (!Number.isFinite(returnMinutes) || returnMinutes <= 0) {
      showCreateError(t('transport.returnInvalid'));
      return;
    }

    try {
      const plan = await window.satisfactory.createTransportPlan({
        name,
        vehicle_slug: selectedVehicleSlug,
        outbound_minutes: outbound,
        return_minutes: returnMinutes,
        belt_mk: beltMk,
        pipe_mk: pipeMk,
        cargo: [],
      });
      closeTransportCreateModal();
      await loadTransportPlans();
      await openTransportDetail(plan.id);
    } catch (err) {
      console.error(err);
      showCreateError(err.message || t('errors.createFailed'));
    }
  }

  async function openTransportDetail(id) {
    activeTransportPlanId = id;
    switchView('transport-detail');
    const body = document.getElementById('transport-detail-body');
    if (body) {
      body.innerHTML = `<section class="card production-detail-main"><p class="loading">${escapeHtml(t('common.loading'))}</p></section>`;
    }
    try {
      await ensureVehicles();
      activeTransportDetail = await window.satisfactory.getTransportPlanDetail(id);
      if (!activeTransportDetail) {
        throw new Error(t('transport.notFound'));
      }
      renderTransportDetail();
    } catch (err) {
      console.error(err);
      if (body) {
        body.innerHTML = `<section class="card"><p class="empty-state">${escapeHtml(err.message || t('transport.errorDetailLoad'))}</p></section>`;
      }
    }
  }

  function calcErrorMessage(code) {
    const map = {
      needs_fluid_vehicle: 'transport.errorNeedsFluid',
      needs_solid_vehicle: 'transport.errorNeedsSolid',
      missing_stack_size: 'transport.errorMissingStack',
      one_way_required: 'transport.outboundInvalid',
      trip_times_required: 'transport.tripTimesInvalid',
      vehicle_required: 'transport.vehicleRequired',
      invalid_rate: 'transport.errorInvalidRate',
    };
    return t(map[code] || 'transport.errorCalc');
  }

  function renderTransportDetail() {
    const plan = activeTransportDetail;
    if (!plan) return;
    const vehicle = plan.vehicle || vehiclesCatalog.find((v) => v.slug === plan.vehicle_slug);
    const calc = plan.calculation || {};
    const breakdownBySlug = new Map((calc.breakdown || []).map((row) => [row.item_slug, row]));
    const cargoBySlug = new Map((plan.cargo || []).map((line) => [line.item_slug, line]));

    document.getElementById('transport-detail-breadcrumb').textContent = plan.name;
    document.getElementById('transport-detail-heading').textContent = plan.name;
    document.getElementById('transport-detail-meta').textContent = [
      vehicleDisplayName(vehicle) || plan.vehicle_slug,
      t('transport.metaOutbound', { minutes: plan.outbound_minutes }),
      t('transport.metaReturn', { minutes: plan.return_minutes }),
      t('time.updated', { when: formatDateTime(plan.updated_at) }),
    ].join(' · ');

    const cargoBoxes = (plan.cargo || [])
      .map((line) => {
        const img = itemImageSrc(line);
        const isFluid = line.is_fluid || line.stack_size == null;
        const unit = isFluid ? 'm³/min' : '/min';
        const stackLabel = isFluid
          ? t('transport.fluidLabel')
          : t('transport.stackLabel', { size: line.stack_size });
        const row = breakdownBySlug.get(line.item_slug);
        const unitsNeeded = row?.units_needed ?? 0;
        const unitsLabel = row?.mix_group
          ? t('transport.cargoUnitsShared', {
              label: vehicleUnitLabel(vehicle, unitsNeeded),
            })
          : vehicleUnitLabel(vehicle, unitsNeeded);
        const allowMix = Boolean(line.allow_mix) && !isFluid;
        return `
          <article class="production-extraction transport-cargo-box" data-cargo-id="${line.id}">
            <div class="production-extraction-header">
              ${img ? `<img class="production-extraction-image" src="${escapeHtml(img)}" alt="" />` : ''}
              <div class="production-extraction-title">
                <h4>${escapeHtml(line.name || line.item_slug)}</h4>
                <p>${escapeHtml(stackLabel)}</p>
              </div>
              <button type="button" class="production-delete-btn" data-transport-cargo-remove="${line.id}" aria-label="${escapeHtml(t('actions.delete'))}" title="${escapeHtml(t('actions.delete'))}">
                ${DELETE_ICON}
              </button>
            </div>
            <div class="production-config-grid transport-cargo-config">
              <div class="production-config-field form-field">
                <label>${escapeHtml(t('transport.cargoRate'))}</label>
                <div class="transport-cargo-rate-row">
                  <input type="text" class="production-target-rate-input production-config-decimal-input" inputmode="decimal"
                    data-transport-rate="${line.id}" value="${escapeHtml(String(line.rate))}" />
                  <span class="transport-cargo-unit">${escapeHtml(unit)}</span>
                </div>
              </div>
              <div class="production-config-field form-field">
                <label>${escapeHtml(t('transport.cargoLoadMode'))}</label>
                ${
                  isFluid
                    ? `<p class="form-hint">${escapeHtml(t('transport.cargoLoadFluidOnly'))}</p>`
                    : `<select class="production-config-input" data-transport-mix="${line.id}">
                        <option value="0" ${!allowMix ? 'selected' : ''}>${escapeHtml(t('transport.cargoLoadSeparate'))}</option>
                        <option value="1" ${allowMix ? 'selected' : ''}>${escapeHtml(t('transport.cargoLoadMix'))}</option>
                      </select>`
                }
              </div>
              <div class="production-config-field form-field">
                <label>${escapeHtml(t('transport.cargoUnitsNeeded'))}</label>
                <p class="transport-cargo-units-value">${escapeHtml(unitsLabel)}</p>
              </div>
            </div>
          </article>`;
      })
      .join('');

    const compositionHtml = renderCompositionStrip(
      calc.composition || [],
      cargoBySlug,
      vehicle,
      plan.station_belt_mks || calc.station_belt_mks || []
    );
    const tripTotalsHtml = renderTripTotalsHtml(
      cargoBySlug,
      (plan.cargo || []).map((line) => {
        const row = breakdownBySlug.get(line.item_slug);
        return {
          item_slug: line.item_slug,
          amount_per_trip: row?.amount_per_trip,
          is_fluid: Boolean(row?.is_fluid || line.is_fluid || line.stack_size == null),
        };
      }).filter((row) => Number.isFinite(Number(row.amount_per_trip)))
    );
    const resultOk =
      calc.ok !== false || (calc.vehicles_needed > 0 && !(calc.incompatibilities || []).length);
    const resultClass = resultOk ? 'transport-result-ok' : 'transport-result-warn';

    const vehicleCap =
      vehicle?.cargo_kind === 'fluid'
        ? `${vehicle.fluid_capacity} m³`
        : vehicle?.cargo_kind === 'mixed'
          ? `${t('transport.slotsCount', { count: vehicle.inventory_slots })} · ${vehicle.fluid_capacity} m³`
          : t('transport.slotsCount', { count: vehicle?.inventory_slots ?? '—' });

    const stationsSummary = formatStationsSummary(calc);
    const stationLimited = calcIsStationLimited(calc);

    const body = document.getElementById('transport-detail-body');
    body.innerHTML = `
      <section class="card production-detail-main production-columns-card">
        <div class="production-detail-columns transport-detail-columns">
          <section class="transport-settings-section">
            <h3 class="production-section-header">${escapeHtml(t('transport.sectionConfig'))}</h3>
            <div class="transport-settings-fields">
              <div class="form-field production-config-field">
                <label for="transport-detail-outbound">${escapeHtml(t('transport.outboundMinutes'))}</label>
                <input type="text" id="transport-detail-outbound" class="production-config-decimal-input"
                  inputmode="decimal" value="${escapeHtml(String(plan.outbound_minutes))}" />
                <p class="form-hint">${escapeHtml(t('transport.outboundHint'))}</p>
              </div>
              <div class="form-field production-config-field">
                <label for="transport-detail-return">${escapeHtml(t('transport.returnMinutes'))}</label>
                <input type="text" id="transport-detail-return" class="production-config-decimal-input"
                  inputmode="decimal" value="${escapeHtml(String(plan.return_minutes))}" />
                <p class="form-hint">${escapeHtml(t('transport.returnHint'))}</p>
              </div>
              <div class="form-field production-config-field transport-settings-vehicle">
                <label for="transport-detail-vehicle">${escapeHtml(t('transport.vehicleType'))}</label>
                <select id="transport-detail-vehicle" class="production-config-input">
                  ${vehiclesCatalog
                    .map(
                      (v) =>
                        `<option value="${escapeHtml(v.slug)}" ${v.slug === plan.vehicle_slug ? 'selected' : ''}>${escapeHtml(vehicleDisplayName(v))}</option>`
                    )
                    .join('')}
                </select>
                <p class="form-hint">${escapeHtml(vehicleCap)}</p>
              </div>
            </div>

            <div class="transport-result-card ${resultClass}">
              <h3 class="production-section-header">${escapeHtml(t('transport.sectionResult'))}</h3>
              <div class="transport-result-main">
                <div class="transport-result-value">${escapeHtml(vehicleUnitLabel(vehicle, calc.vehicles_needed || 0))}</div>
                <p class="page-subtitle">
                  ${escapeHtml(t('transport.roundTrip', { minutes: calc.round_trip_minutes ?? '—' }))}
                </p>
                ${
                  stationsSummary
                    ? `<p class="page-subtitle transport-stations-summary">${escapeHtml(stationsSummary)}</p>`
                    : ''
                }
                ${
                  stationLimited
                    ? `<p class="form-hint transport-limiting-hint">${escapeHtml(t('transport.limitingStation'))}</p>`
                    : calc.apply_station_limit && (calc.vehicles_needed || 0) > 0
                      ? `<p class="form-hint transport-limiting-hint">${escapeHtml(t('transport.limitingCapacity'))}</p>`
                      : ''
                }
                ${
                  calc.apply_station_limit
                    ? `<p class="form-hint">${escapeHtml(t('transport.stationThroughputHint'))}</p>`
                    : ''
                }
              </div>
              ${
                calc.error
                  ? `<p class="form-error">${escapeHtml(calcErrorMessage(calc.error))}</p>`
                  : ''
              }
              ${compositionHtml}
              ${tripTotalsHtml}
              <p class="form-hint">${escapeHtml(t('transport.lockoutHint'))}</p>
            </div>
          </section>

          <section class="transport-cargo-section">
            <div class="production-section-header-row">
              <h3 class="production-section-header">${escapeHtml(t('transport.cargo'))}</h3>
            </div>
            <div id="transport-detail-cargo-list" class="transport-cargo-boxes">
              ${
                cargoBoxes ||
                `<p class="production-extractions-empty">${escapeHtml(t('transport.cargoEmptyHint'))}</p>`
              }
            </div>
          </section>
        </div>
      </section>`;
  }

  function renderCompositionStrip(composition, cargoBySlug, vehicle, stationBeltMks = []) {
    if (!composition.length) {
      return `<p class="form-hint">${escapeHtml(t('transport.compositionEmpty'))}</p>`;
    }

    const cells = [];
    const isTrain = vehicle?.slug === 'freight-wagon';
    if (isTrain) {
      cells.push(`
        <div class="transport-composition-car transport-composition-car--loco" title="${escapeHtml(t('transport.compositionLoco'))}">
          <img src="${escapeHtml(LOCOMOTIVE_IMAGE)}" alt="${escapeHtml(t('transport.compositionLoco'))}" />
        </div>`);
    }

    let stationIndex = 0;
    const applyStationLimit = vehicle?.slug !== 'drone-transport';

    for (const block of composition) {
      const viewIndex = block.view_index;
      const blockMks = block.station_mks || [];
      if (block.kind === 'mixed') {
        const icons = (block.item_slugs || [])
          .map((slug) => {
            const cargo = cargoBySlug.get(slug);
            const img = itemImageSrc(cargo);
            return img
              ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(cargo?.name || slug)}" />`
              : `<span>${escapeHtml((cargo?.name || slug).slice(0, 2))}</span>`;
          })
          .join('');
        for (let i = 0; i < block.count; i++) {
          const mk = stationBeltMks[stationIndex] ?? blockMks[i] ?? 5;
          const mkSelect = applyStationLimit
            ? `<label class="transport-station-mk">
                <span>${escapeHtml(t('transport.stationBeltShort'))}</span>
                <select data-station-belt-index="${stationIndex}" class="transport-station-mk-select" onclick="event.stopPropagation()">
                  ${mkOptionsHtml(6, mk)}
                </select>
              </label>`
            : '';
          cells.push(`
            <div class="transport-composition-unit">
              <button type="button" class="transport-composition-car transport-composition-car--mix transport-composition-car--clickable"
                data-transport-view-index="${viewIndex}" data-transport-car-index="${i}"
                title="${escapeHtml(t('transport.compositionMixed'))}">
                <div class="transport-composition-mix-icons">${icons}</div>
              </button>
              ${mkSelect}
            </div>`);
          stationIndex += 1;
        }
        continue;
      }

      const cargo = cargoBySlug.get(block.item_slug);
      const img = itemImageSrc(cargo);
      const name = cargo?.name || block.item_slug;
      const isFluid = Boolean(block.is_fluid);
      for (let i = 0; i < block.count; i++) {
        const mk = stationBeltMks[stationIndex] ?? blockMks[i] ?? (isFluid ? 2 : 5);
        const mkSelect = applyStationLimit
          ? `<label class="transport-station-mk">
              <span>${escapeHtml(
                isFluid ? t('transport.stationPipeShort') : t('transport.stationBeltShort')
              )}</span>
              <select data-station-belt-index="${stationIndex}" class="transport-station-mk-select" onclick="event.stopPropagation()">
                ${mkOptionsHtml(isFluid ? 2 : 6, mk)}
              </select>
            </label>`
          : '';
        cells.push(`
          <div class="transport-composition-unit">
            <button type="button" class="transport-composition-car transport-composition-car--clickable"
              data-transport-view-index="${viewIndex}" data-transport-car-index="${i}"
              title="${escapeHtml(name)}">
              ${img ? `<img src="${escapeHtml(img)}" alt="" />` : `<span>${escapeHtml(name.slice(0, 2))}</span>`}
            </button>
            ${mkSelect}
          </div>`);
        stationIndex += 1;
      }
    }

    return `
      <div class="transport-composition">
        <h4 class="transport-composition-title">${escapeHtml(t('transport.compositionTitle'))}</h4>
        <p class="form-hint">${escapeHtml(t('transport.stationBeltPerCarHint'))}</p>
        <div class="transport-composition-track">${cells.join('')}</div>
        <p class="form-hint">${escapeHtml(
          t('transport.compositionClickHint')
        )} · ${escapeHtml(vehicleUnitLabel(vehicle, composition.reduce((s, b) => s + b.count, 0)))}</p>
      </div>`;
  }

  function slotGridColumns(slotCount) {
    if (slotCount <= 1) return 1;
    if (slotCount <= 9) return 3;
    if (slotCount <= 25) return 5;
    return 8;
  }

  function formatSlotAmount(slot) {
    if (!slot) return '';
    const n = Number(slot.amount);
    const formatted = window.NumberFormat?.formatDisplayNumber?.(n) ?? String(Math.round(n * 100) / 100);
    if (slot.is_fluid) return `${formatted} m³`;
    return formatted;
  }

  function formatCargoQty(amount, isFluid) {
    const n = Number(amount);
    const formatted =
      window.NumberFormat?.formatDisplayNumber?.(n) ?? String(Math.round(n * 100) / 100);
    return isFluid ? `${formatted} m³` : formatted;
  }

  function sumCarByItem(car) {
    const totals = new Map();
    for (const slot of car || []) {
      if (!slot) continue;
      const prev = totals.get(slot.item_slug) || {
        item_slug: slot.item_slug,
        amount: 0,
        is_fluid: Boolean(slot.is_fluid),
      };
      prev.amount += Number(slot.amount) || 0;
      totals.set(slot.item_slug, prev);
    }
    return [...totals.values()];
  }

  /**
   * Riepilogo totali round-trip per item (icona + quantità).
   * @param {Map} cargoBySlug
   * @param {Array<{ item_slug: string, amount_per_trip?: number, is_fluid?: boolean }>} rows
   * @param {{ carTotals?: Map, multiCar?: boolean }} [opts]
   */
  function renderTripTotalsHtml(cargoBySlug, rows, opts = {}) {
    const list = (rows || []).filter((row) => row && row.item_slug);
    if (!list.length) return '';

    const carTotals = opts.carTotals || null;
    const multiCar = Boolean(opts.multiCar);
    const titleKey = carTotals ? 'transport.slotModalThisCarTitle' : 'transport.slotModalTotals';

    const htmlRows = list
      .map((row) => {
        const slug = row.item_slug;
        const cargo = cargoBySlug.get(slug);
        const carRow = carTotals?.get(slug);
        const isFluid = Boolean(row.is_fluid || carRow?.is_fluid || cargo?.stack_size == null);
        const tripAmount = Number(row.amount_per_trip);
        const carAmount = Number(carRow?.amount) || 0;
        const img = itemImageSrc(cargo);
        const name = cargo?.name || slug;
        const tripLabel = Number.isFinite(tripAmount)
          ? formatCargoQty(tripAmount, isFluid)
          : formatCargoQty(carAmount, isFluid);
        const carLabel = formatCargoQty(carAmount, isFluid);
        const showCarSplit =
          carTotals &&
          (multiCar || (Number.isFinite(tripAmount) && Math.abs(tripAmount - carAmount) > 1e-6));
        // Nel popup mezzo: quantità di questo vagone in grande, totale viaggio sotto
        const primaryLabel = showCarSplit ? carLabel : tripLabel;
        const secondaryHtml = showCarSplit
          ? `<span class="transport-slot-total-car">${escapeHtml(
              t('transport.slotModalTripTotal', { amount: tripLabel })
            )}</span>`
          : '';
        return `
          <div class="transport-slot-total-row">
            ${img ? `<img src="${escapeHtml(img)}" alt="" />` : ''}
            <div class="transport-slot-total-meta">
              <span class="transport-slot-total-name">${escapeHtml(name)}</span>
              ${secondaryHtml}
            </div>
            <span class="transport-slot-total-qty">${escapeHtml(primaryLabel)}</span>
          </div>`;
      })
      .join('');

    if (!htmlRows) return '';
    return `
      <div class="transport-slot-totals">
        <h4 class="transport-slot-totals-title">${escapeHtml(t(titleKey))}</h4>
        <div class="transport-slot-totals-list">${htmlRows}</div>
      </div>`;
  }

  function openSlotViewModal(viewIndex, carIndex) {
    const plan = activeTransportDetail;
    if (!plan) return;
    const views = plan.calculation?.slot_views || [];
    const view = views[viewIndex];
    const car = view?.cars?.[carIndex];
    if (!car) return;

    const cargoBySlug = new Map((plan.cargo || []).map((line) => [line.item_slug, line]));
    const breakdownBySlug = new Map(
      (plan.calculation?.breakdown || []).map((row) => [row.item_slug, row])
    );
    const titleEl = document.getElementById('transport-slot-modal-title');
    const subEl = document.getElementById('transport-slot-modal-subtitle');
    const hintEl = document.getElementById('transport-slot-modal-hint');
    const gridEl = document.getElementById('transport-slot-grid');
    const totalsEl = document.getElementById('transport-slot-totals');
    if (!gridEl) return;

    const carLabel = t('transport.slotModalCar', {
      index: carIndex + 1,
      total: view.cars.length,
    });
    let cargoLabel = t('transport.compositionMixed');
    if (view.kind === 'dedicated') {
      cargoLabel = cargoBySlug.get(view.item_slug)?.name || view.item_slug;
    } else if (view.item_slugs?.length) {
      cargoLabel = view.item_slugs
        .map((slug) => cargoBySlug.get(slug)?.name || slug)
        .join(' + ');
    }

    if (titleEl) titleEl.textContent = t('transport.slotModalTitle');
    if (subEl) subEl.textContent = `${carLabel} · ${cargoLabel}`;

    const cols = slotGridColumns(car.length);
    gridEl.style.setProperty('--slot-cols', String(cols));
    gridEl.classList.toggle('transport-slot-grid--fluid', Boolean(view.is_fluid));

    const filled = car.filter(Boolean).length;
    if (hintEl) {
      hintEl.textContent = view.is_fluid
        ? t('transport.slotModalFluidHint', {
            amount: formatSlotAmount(car[0]),
            capacity: car[0]?.capacity ?? '—',
          })
        : t('transport.slotModalSolidHint', {
            filled,
            total: car.length,
          });
    }

    gridEl.innerHTML = car
      .map((slot) => {
        if (!slot) {
          return `<div class="transport-slot-cell transport-slot-cell--empty" title="${escapeHtml(t('transport.slotEmpty'))}"></div>`;
        }
        const cargo = cargoBySlug.get(slot.item_slug);
        const img = itemImageSrc(cargo);
        const name = cargo?.name || slot.item_slug;
        const amount = formatSlotAmount(slot);
        const fillPct = Math.max(0, Math.min(100, Math.round((slot.fill_ratio || 0) * 100)));
        return `
          <div class="transport-slot-cell ${slot.is_fluid ? 'transport-slot-cell--fluid' : ''}"
            title="${escapeHtml(`${name}: ${amount}`)}"
            style="--slot-fill: ${fillPct}%">
            ${img ? `<img src="${escapeHtml(img)}" alt="" />` : `<span class="transport-slot-fallback">${escapeHtml(name.slice(0, 2))}</span>`}
            <span class="transport-slot-amount">${escapeHtml(amount)}</span>
          </div>`;
      })
      .join('');

    const itemSlugs =
      view.kind === 'mixed'
        ? view.item_slugs || []
        : view.item_slug
          ? [view.item_slug]
          : sumCarByItem(car).map((row) => row.item_slug);
    const carTotals = new Map(sumCarByItem(car).map((row) => [row.item_slug, row]));

    if (totalsEl) {
      const totalsHtml = renderTripTotalsHtml(
        cargoBySlug,
        itemSlugs.map((slug) => {
          const breakdown = breakdownBySlug.get(slug);
          return {
            item_slug: slug,
            amount_per_trip: breakdown?.amount_per_trip,
            is_fluid: Boolean(breakdown?.is_fluid || carTotals.get(slug)?.is_fluid),
          };
        }),
        { carTotals, multiCar: view.cars.length > 1 }
      );
      totalsEl.hidden = !totalsHtml;
      totalsEl.innerHTML = totalsHtml;
    }

    transportSlotModal?.classList.remove('hidden');
    transportSlotModal?.setAttribute('aria-hidden', 'false');
  }

  function closeSlotViewModal() {
    transportSlotModal?.classList.add('hidden');
    transportSlotModal?.setAttribute('aria-hidden', 'true');
  }

  async function persistDetailPatch(partial) {
    if (!activeTransportPlanId) return;
    activeTransportDetail = await window.satisfactory.updateTransportPlan(
      activeTransportPlanId,
      partial
    );
    renderTransportDetail();
    await loadTransportPlans();
  }

  async function handleListClick(event) {
    const openBtn = event.target.closest('[data-transport-open]');
    if (openBtn) {
      await openTransportDetail(Number(openBtn.dataset.transportOpen));
      return;
    }

    const renameBtn = event.target.closest('[data-transport-rename]');
    if (renameBtn) {
      const id = Number(renameBtn.dataset.transportRename);
      const plan = transportPlans.find((p) => p.id === id);
      const next = window.prompt(t('common.name'), plan?.name || '');
      if (next == null) return;
      const name = next.trim();
      if (!name) return;
      await window.satisfactory.updateTransportPlan(id, { name });
      await loadTransportPlans();
      return;
    }

    const dupBtn = event.target.closest('[data-transport-duplicate]');
    if (dupBtn) {
      await window.satisfactory.duplicateTransportPlan(Number(dupBtn.dataset.transportDuplicate));
      await loadTransportPlans();
      return;
    }

    const delBtn = event.target.closest('[data-transport-delete]');
    if (delBtn) {
      const id = Number(delBtn.dataset.transportDelete);
      const plan = transportPlans.find((p) => p.id === id);
      const ok = await showConfirm({
        title: t('transport.title'),
        message: t('transport.confirmDelete', { name: plan?.name || id }),
        confirmLabel: t('common.confirm'),
      });
      if (!ok) return;
      await window.satisfactory.deleteTransportPlan(id);
      await loadTransportPlans();
    }
  }

  function wireEvents() {
    document.getElementById('btn-new-transport')?.addEventListener('click', () => {
      openTransportCreateModal().catch(console.error);
    });
    document.getElementById('transport-create-modal-close')?.addEventListener('click', closeTransportCreateModal);
    document.getElementById('transport-create-cancel')?.addEventListener('click', closeTransportCreateModal);
    transportCreateForm?.addEventListener('submit', submitCreate);

    document.getElementById('transport-create-vehicle-grid')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-vehicle-slug]');
      if (!btn) return;
      selectedVehicleSlug = btn.dataset.vehicleSlug;
      renderCreateVehicleGrid();
    });

    document.getElementById('transport-container')?.addEventListener('click', (e) => {
      handleListClick(e).catch(console.error);
    });

    document.getElementById('transport-detail-back')?.addEventListener('click', () => {
      activeTransportPlanId = null;
      activeTransportDetail = null;
      switchView('transport');
    });

    document.getElementById('btn-transport-add-cargo')?.addEventListener('click', () => {
      window.openResourcePickerWithMode?.('transport-detail-cargo', 'modals.selectResource');
    });

    document.getElementById('transport-detail-body')?.addEventListener('change', (e) => {
      const outbound = e.target.closest('#transport-detail-outbound');
      if (outbound) {
        const value = Number(String(outbound.value).replace(',', '.'));
        if (!Number.isFinite(value) || value <= 0) return;
        persistDetailPatch({ outbound_minutes: value }).catch(console.error);
        return;
      }
      const returnInput = e.target.closest('#transport-detail-return');
      if (returnInput) {
        const value = Number(String(returnInput.value).replace(',', '.'));
        if (!Number.isFinite(value) || value <= 0) return;
        persistDetailPatch({ return_minutes: value }).catch(console.error);
        return;
      }
      const vehicle = e.target.closest('#transport-detail-vehicle');
      if (vehicle) {
        persistDetailPatch({ vehicle_slug: vehicle.value }).catch(console.error);
        return;
      }
      const stationBelt = e.target.closest('[data-station-belt-index]');
      if (stationBelt && activeTransportDetail) {
        const index = Number(stationBelt.dataset.stationBeltIndex);
        const mk = Number(stationBelt.value);
        if (!Number.isFinite(index) || index < 0 || !Number.isFinite(mk)) return;
        const current =
          activeTransportDetail.station_belt_mks ||
          activeTransportDetail.calculation?.station_belt_mks ||
          [];
        const next = current.slice();
        while (next.length <= index) {
          next.push(activeTransportDetail.belt_mk || 5);
        }
        next[index] = mk;
        persistDetailPatch({ station_belt_mks: next }).catch(console.error);
        return;
      }
      const rateInput = e.target.closest('[data-transport-rate]');
      if (rateInput && activeTransportDetail) {
        const cargoId = Number(rateInput.dataset.transportRate);
        const rate = Number(String(rateInput.value).replace(',', '.'));
        if (!Number.isFinite(rate) || rate <= 0) return;
        const cargo = (activeTransportDetail.cargo || []).map((line) =>
          line.id === cargoId
            ? { item_slug: line.item_slug, rate, allow_mix: Boolean(line.allow_mix) }
            : {
                item_slug: line.item_slug,
                rate: line.rate,
                allow_mix: Boolean(line.allow_mix),
              }
        );
        persistDetailPatch({ cargo }).catch(console.error);
        return;
      }
      const mixSelect = e.target.closest('[data-transport-mix]');
      if (mixSelect && activeTransportDetail) {
        const cargoId = Number(mixSelect.dataset.transportMix);
        const allowMix = mixSelect.value === '1';
        const cargo = (activeTransportDetail.cargo || []).map((line) =>
          line.id === cargoId
            ? { item_slug: line.item_slug, rate: line.rate, allow_mix: allowMix }
            : {
                item_slug: line.item_slug,
                rate: line.rate,
                allow_mix: Boolean(line.allow_mix),
              }
        );
        persistDetailPatch({ cargo }).catch(console.error);
      }
    });

    document.getElementById('transport-detail-body')?.addEventListener('click', (e) => {
      const slotBtn = e.target.closest('[data-transport-view-index]');
      if (slotBtn) {
        openSlotViewModal(
          Number(slotBtn.dataset.transportViewIndex),
          Number(slotBtn.dataset.transportCarIndex)
        );
        return;
      }
      const removeBtn = e.target.closest('[data-transport-cargo-remove]');
      if (!removeBtn || !activeTransportDetail) return;
      const cargoId = Number(removeBtn.dataset.transportCargoRemove);
      const cargo = (activeTransportDetail.cargo || [])
        .filter((line) => line.id !== cargoId)
        .map((line) => ({
          item_slug: line.item_slug,
          rate: line.rate,
          allow_mix: Boolean(line.allow_mix),
        }));
      persistDetailPatch({ cargo }).catch(console.error);
    });

    document.getElementById('transport-slot-modal-close')?.addEventListener('click', closeSlotViewModal);
    document.getElementById('transport-slot-modal-ok')?.addEventListener('click', closeSlotViewModal);
    transportSlotModal?.addEventListener('click', (e) => {
      if (e.target === transportSlotModal) closeSlotViewModal();
    });
  }

  wireEvents();

  window.TransportUI = {
    loadTransportPlans,
    openTransportDetail,
    onCargoPicked,
  };
})();
