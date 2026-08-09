async function initDashboard() {
  try {
    const appInfo = await window.satisfactory.getAppInfo();
    document.getElementById('env-electron').textContent = appInfo.electron ?? '—';
    document.getElementById('env-node').textContent = appInfo.node ?? '—';
    if (appInfo.version) {
      document.getElementById('app-version').textContent =
        `FACTORY MANAGER v${appInfo.version}`;
    }
  } catch (err) {
    document.getElementById('env-electron').textContent = '—';
    document.getElementById('env-node').textContent = '—';
    console.error('App info error:', err);
  }

  try {
    const status = await window.satisfactory.getDbStatus();
    renderEnvironmentStats(status);
    await renderDashboardProjects(status);
  } catch (err) {
    console.error('Dashboard load error:', err);
    document.getElementById('dashboard-projects').innerHTML =
      `<p class="dashboard-empty">${escapeHtml(t('dashboard.errorLoad'))}</p>`;
    document.getElementById('dashboard-alerts').innerHTML =
      `<p class="dashboard-empty">${escapeHtml(t('dashboard.errorAlerts'))}</p>`;
    document.getElementById('dashboard-chart-deficits').innerHTML =
      `<p class="dashboard-empty">${escapeHtml(t('dashboard.errorCharts'))}</p>`;
    document.getElementById('dashboard-chart-objectives').innerHTML = '';
    document.getElementById('dashboard-chart-power').innerHTML = '';
    const balanceChart = document.getElementById('dashboard-chart-balance');
    if (balanceChart) balanceChart.innerHTML = '';
    const transportFleet = document.getElementById('dashboard-transport-fleet');
    if (transportFleet) {
      transportFleet.innerHTML = `<p class="dashboard-empty">${escapeHtml(t('dashboard.errorLoad'))}</p>`;
    }
    const transportChart = document.getElementById('dashboard-chart-transport');
    if (transportChart) transportChart.innerHTML = '';
  }
}

function renderEnvironmentStats(status) {
  const connectedEl = document.getElementById('env-db-connected');
  if (connectedEl) {
    connectedEl.textContent = status.connected ? t('common.connected') : t('common.disconnected');
    connectedEl.classList.toggle('ok', status.connected);
  }

  const itemsEl = document.getElementById('env-count-items');
  if (itemsEl) itemsEl.textContent = formatDisplayInteger(status.counts?.items ?? 0);

  const buildingsEl = document.getElementById('env-count-buildings');
  if (buildingsEl) buildingsEl.textContent = formatDisplayInteger(status.counts?.buildings ?? 0);

  const schemasEl = document.getElementById('env-count-schemas');
  if (schemasEl) schemasEl.textContent = formatDisplayInteger(status.counts?.schemas ?? 0);

  document.getElementById('env-schema').textContent =
    status.schemaVersion != null ? `v${status.schemaVersion}` : '—';
  document.getElementById('env-db-path').textContent = status.connected
    ? t('settings.envDbLocal')
    : '—';
}

function computeChainMachineCount(steps = []) {
  return steps.reduce((sum, step) => sum + Math.max(0, Math.round(Number(step.machine_count) || 0)), 0);
}

function computeChainPowerShards(steps = []) {
  return steps.reduce(
    (sum, step) => sum + computeTotalPowerShards(step.overclock, step.machine_count),
    0
  );
}

function getStepPowerBaseMw(step) {
  return (
    Number(step?.schema?.power_consumption) ||
    Number(step?.power_consumption) ||
    0
  );
}

function getStepSomersloopMult(step) {
  const schema = step?.schema;
  const slots = window.ProductionScale.getSomersloopSlots(schema);
  return window.ProductionScale.computeSomersloopMultiplier(slots, step?.somersloop_mask ?? 0);
}

function computeStepPowerMw(step) {
  return window.ProductionScale.roundPowerMw(
    window.ProductionScale.computeMachinePowerMw(
      getStepPowerBaseMw(step),
      step?.overclock,
      step?.machine_count,
      getStepSomersloopMult(step)
    )
  );
}

function computeExtractionPowerMw(extraction) {
  return window.ProductionScale.roundPowerMw(
    window.ProductionScale.computeMachinePowerMw(
      Number(extraction?.power_consumption) || 0,
      extraction?.overclock,
      extraction?.node_count ?? 1,
      1
    )
  );
}

function computeChainPowerMw(steps = []) {
  return window.ProductionScale.roundPowerMw(
    steps.reduce((sum, step) => sum + computeStepPowerMw(step), 0)
  );
}

function computeExtractionsPowerMw(extractions = []) {
  return window.ProductionScale.roundPowerMw(
    extractions.reduce((sum, extraction) => sum + computeExtractionPowerMw(extraction), 0)
  );
}

function computeDetailPowerMw(machines = [], extractions = []) {
  return window.ProductionScale.roundPowerMw(
    computeChainPowerMw(machines) + computeExtractionsPowerMw(extractions)
  );
}

function computeExtractionsPowerShards(extractions = []) {
  return extractions.reduce(
    (sum, extraction) =>
      sum + computeTotalPowerShards(extraction.overclock, extraction.node_count ?? 1),
    0
  );
}

function computeDetailPowerShards(machines = [], extractions = []) {
  return computeChainPowerShards(machines) + computeExtractionsPowerShards(extractions);
}

function computeDetailSomersloops(steps = []) {
  return (steps ?? []).reduce(
    (sum, step) =>
      sum +
      computeTotalSomersloops(step.schema, step.somersloop_mask ?? 0, step.machine_count ?? 1),
    0
  );
}

function computeChainNodeCount(extractions = []) {
  return computeExtractionNodeGroups(extractions).reduce((sum, group) => sum + group.node_count, 0);
}

function countProductionDeficits(steps, extractions) {
  return computeChainResourceBalance(steps, extractions).filter(
    (entry) => entry.missing > LINK_BALANCE_TOLERANCE
  ).length;
}

function getProductionChainHealth(steps, extractions) {
  if (!steps.length && !extractions.length) {
    return { status: 'empty', deficitCount: 0, label: t('common.empty') };
  }

  const deficitCount = countProductionDeficits(steps, extractions);
  if (deficitCount > 0) {
    return {
      status: 'error',
      deficitCount,
      label: deficitHealthLabel(deficitCount),
    };
  }

  return { status: 'ok', deficitCount: 0, label: t('common.balanced') };
}

function getEnergyChainHealth(detail) {
  const generators = detail?.generators ?? [];
  const extractions = detail?.extractions ?? [];
  if (!generators.length && !extractions.length) {
    return { status: 'empty', deficitCount: 0, label: t('common.empty') };
  }

  const computeBalance = window.EnergyUI?.computeEnergyResourceBalance;
  if (!computeBalance) {
    return { status: 'ok', deficitCount: 0, label: t('common.balanced') };
  }

  const deficitCount = computeBalance(generators, extractions).filter(
    (entry) => entry.missing > LINK_BALANCE_TOLERANCE
  ).length;

  if (deficitCount > 0) {
    return {
      status: 'error',
      deficitCount,
      label: deficitHealthLabel(deficitCount),
    };
  }

  return { status: 'ok', deficitCount: 0, label: t('common.balanced') };
}

function formatDashboardRelativeTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t('common.now');
  if (diffMin < 60) return t('time.minutesAgo', { count: diffMin });
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return t('time.hoursAgo', { count: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return t('time.daysAgo', { count: diffDays });
  return formatDateTime(iso);
}

function buildProductionProjectSummary(chain, detail) {
  const steps = detail?.steps ?? [];
  const extractions = detail?.extractions ?? [];
  const health = getProductionChainHealth(steps, extractions);
  const machines = computeChainMachineCount(steps);
  const nodes = computeChainNodeCount(extractions);
  const powerShards = computeDetailPowerShards(steps, extractions);
  const powerMw = computeDetailPowerMw(steps, extractions);

  const metrics = [];
  if (machines > 0) metrics.push(t('dashboard.metricsMachines', { count: machines }));
  if (nodes > 0) metrics.push(t('dashboard.metricsNodes', { count: nodes }));
  if (powerShards > 0) metrics.push(t('dashboard.metricsPowerShards', { count: powerShards }));
  if (powerMw > 0) {
    metrics.push(t('dashboard.metricsMw', { value: formatProductionValue(powerMw) }));
  }

  return {
    id: chain.id,
    type: 'production',
    name: chain.name,
    updated_at: chain.updated_at || chain.created_at,
    health,
    metricsText: metrics.join(' · ') || t('dashboard.metricsNoPlan'),
    detail,
  };
}

function buildEnergyProjectSummary(chain, detail) {
  const generators = detail?.generators ?? [];
  const extractions = detail?.extractions ?? [];
  const health = getEnergyChainHealth(detail);
  const machines = generators.reduce(
    (sum, gen) => sum + Math.max(0, Math.round(Number(gen.machine_count) || 0)),
    0
  );
  const totalMw = generators.reduce((sum, gen) => sum + (gen.power_output_mw ?? 0), 0);

  const metrics = [];
  if (machines > 0) metrics.push(t('dashboard.metricsGenerators', { count: machines }));
  if (totalMw > 0) metrics.push(t('dashboard.metricsMw', { value: formatProductionValue(totalMw) }));

  return {
    id: chain.id,
    type: 'energy',
    name: chain.name,
    updated_at: chain.updated_at || chain.created_at,
    health,
    metricsText: metrics.join(' · ') || t('dashboard.metricsNoGenerators'),
    detail,
  };
}

function dashboardAssetSrc(image) {
  if (!image) return '';
  return image.startsWith('assets/') ? image : `assets/${image}`;
}

function getTransportPlanHealth(plan) {
  const cargo = plan?.cargo ?? [];
  const calc = plan?.calculation || {};
  if (!cargo.length) {
    return { status: 'empty', deficitCount: 0, label: t('common.empty') };
  }
  if (calc.ok === false || calc.error) {
    return {
      status: 'error',
      deficitCount: 1,
      label: t('dashboard.transportNeedsFix'),
    };
  }
  return { status: 'ok', deficitCount: 0, label: t('common.balanced') };
}

function vehicleDisplayName(vehicle) {
  if (!vehicle) return '';
  const locale = (window.I18nUI?.getLocale?.() || 'it').toLowerCase();
  if (locale.startsWith('it')) {
    return vehicle.name_it || vehicle.name || vehicle.slug || '';
  }
  return vehicle.name_en || vehicle.name || vehicle.slug || '';
}

function formatTransportUnitLabel(vehicle, count) {
  const locale = (window.I18nUI?.getLocale?.() || 'it').toLowerCase();
  const isIt = locale.startsWith('it');
  const unit = isIt
    ? vehicle?.unit_label_it || vehicleDisplayName(vehicle) || t('transport.unitsGeneric', { count: '' }).trim()
    : vehicle?.unit_label_en || vehicleDisplayName(vehicle) || t('transport.unitsGeneric', { count: '' }).trim();
  if (vehicle?.unit_label_it || vehicle?.unit_label_en || vehicle?.name || vehicle?.name_en || vehicle?.name_it) {
    return `${count} ${unit}`;
  }
  return t('transport.unitsGeneric', { count });
}

function buildTransportProjectSummary(plan) {
  const calc = plan.calculation || {};
  const vehicle = plan.vehicle || {};
  const cargoCount = plan.cargo?.length ?? 0;
  const vehiclesNeeded = Number(calc.vehicles_needed) || 0;
  const health = getTransportPlanHealth(plan);

  const metrics = [];
  const vehicleName = vehicleDisplayName(vehicle);
  if (vehicleName) metrics.push(vehicleName);
  if (vehiclesNeeded > 0) metrics.push(formatTransportUnitLabel(vehicle, vehiclesNeeded));
  if (cargoCount > 0) metrics.push(t('transport.metaCargo', { count: cargoCount }));
  if (calc.round_trip_minutes != null) {
    metrics.push(t('transport.roundTrip', { minutes: calc.round_trip_minutes }));
  }

  return {
    id: plan.id,
    type: 'transport',
    name: plan.name,
    updated_at: plan.updated_at || plan.created_at,
    health,
    metricsText: metrics.join(' · ') || t('dashboard.metricsNoTransport'),
    detail: plan,
    vehicle,
    vehiclesNeeded,
    cargoCount,
    outbound_minutes: plan.outbound_minutes,
    return_minutes: plan.return_minutes,
    round_trip_minutes: calc.round_trip_minutes,
  };
}

function collectDashboardAlerts(projects) {
  const alerts = [];
  const powerTotals = computeDashboardPowerTotals(projects);

  if (powerTotals.consumedMw > 0 && powerTotals.balanceMw < -0.001) {
    const shortfall = window.ProductionScale.roundPowerMw(Math.abs(powerTotals.balanceMw));
    alerts.push({
      projectId: null,
      projectType: null,
      projectName: t('dashboard.alertPowerBalanceProject'),
      itemName: t('dashboard.alertPowerShortfall'),
      missing: shortfall,
      missingText: formatRateWithUnit(shortfall, 'MW'),
      sortValue: shortfall,
      kind: 'power',
    });
  }

  for (const project of projects) {
    if (project.type === 'production') {
      const steps = project.detail?.steps ?? [];
      const extractions = project.detail?.extractions ?? [];
      for (const entry of computeChainResourceBalance(steps, extractions)) {
        if (entry.missing <= LINK_BALANCE_TOLERANCE) continue;
        const unit = entry.is_fluid ? 'm³/min' : '/min';
        alerts.push({
          projectId: project.id,
          projectType: 'production',
          projectName: project.name,
          itemName: entry.item_name || entry.item_slug,
          missing: entry.missing,
          missingText: formatRateWithUnit(entry.missing, unit),
          sortValue: entry.missing,
        });
      }
      continue;
    }

    if (project.type === 'transport') {
      const cargo = project.detail?.cargo ?? [];
      const calc = project.detail?.calculation || {};
      if (!cargo.length) {
        alerts.push({
          projectId: project.id,
          projectType: 'transport',
          projectName: project.name,
          itemName: t('dashboard.alertTransportEmptyCargo'),
          missing: 1,
          missingText: t('dashboard.alertTransportEmptyHint'),
          sortValue: 50,
          kind: 'transport',
        });
      } else if (calc.ok === false || calc.error) {
        alerts.push({
          projectId: project.id,
          projectType: 'transport',
          projectName: project.name,
          itemName: t('dashboard.alertTransportInvalid'),
          missing: 1,
          missingText: t('dashboard.transportNeedsFix'),
          sortValue: 80,
          kind: 'transport',
        });
      }
      continue;
    }

    if (project.type !== 'energy') continue;

    const computeBalance = window.EnergyUI?.computeEnergyResourceBalance;
    if (!computeBalance) continue;

    const generators = project.detail?.generators ?? [];
    const extractions = project.detail?.extractions ?? [];
    for (const entry of computeBalance(generators, extractions)) {
      if (entry.missing <= LINK_BALANCE_TOLERANCE) continue;
      const unit = entry.is_fluid ? 'm³/min' : '/min';
      alerts.push({
        projectId: project.id,
        projectType: 'energy',
        projectName: project.name,
        itemName: entry.item_name || entry.item_slug,
        missing: entry.missing,
        missingText: formatRateWithUnit(entry.missing, unit),
        sortValue: entry.missing,
      });
    }
  }

  return alerts.sort((a, b) => b.sortValue - a.sortValue);
}

const DASHBOARD_GENERATOR_LABELS = {
  'generator-coal': 'Coal',
  'generator-fuel': 'Fuel',
  'generator-nuclear': 'Nuclear',
};

function syncLocaleDependentLabels() {
  MINER_OPTIONS.splice(
    0,
    MINER_OPTIONS.length,
    { slug: 'miner-mk1', label: t('miners.mk1') },
    { slug: 'miner-mk2', label: t('miners.mk2') },
    { slug: 'miner-mk3', label: t('miners.mk3') }
  );

  PURITY_OPTIONS.splice(
    0,
    PURITY_OPTIONS.length,
    { value: 'impure', label: t('purity.impure') },
    { value: 'normal', label: t('purity.normal') },
    { value: 'pure', label: t('purity.pure') }
  );

  Object.keys(DASHBOARD_GENERATOR_LABELS).forEach((key) => {
    delete DASHBOARD_GENERATOR_LABELS[key];
  });
  Object.assign(DASHBOARD_GENERATOR_LABELS, {
    'generator-coal': t('generators.coal'),
    'generator-fuel': t('generators.fuel'),
    'generator-nuclear': t('generators.nuclear'),
  });

  refreshUpdateBannerText();
}

const UPDATE_DISMISS_KEY = 'factory-manager:update-dismissed-version';
let pendingUpdateInfo = null;

function getDismissedUpdateVersion() {
  try {
    return localStorage.getItem(UPDATE_DISMISS_KEY) || '';
  } catch {
    return '';
  }
}

function setDismissedUpdateVersion(version) {
  try {
    localStorage.setItem(UPDATE_DISMISS_KEY, String(version || ''));
  } catch {
    /* ignore quota / private mode */
  }
}

function refreshUpdateBannerText() {
  const textEl = document.getElementById('update-banner-text');
  if (!textEl || !pendingUpdateInfo?.updateAvailable) return;
  textEl.textContent = t('update.available', {
    latest: pendingUpdateInfo.latestVersion,
    current: pendingUpdateInfo.currentVersion,
  });
}

function hideUpdateBanner() {
  const banner = document.getElementById('update-banner');
  if (!banner) return;
  banner.classList.add('hidden');
  banner.hidden = true;
}

function showUpdateBanner(info) {
  const banner = document.getElementById('update-banner');
  if (!banner || !info?.updateAvailable || !info.htmlUrl) return;

  pendingUpdateInfo = info;
  refreshUpdateBannerText();
  banner.classList.remove('hidden');
  banner.hidden = false;
}

function setupUpdateBanner() {
  const downloadBtn = document.getElementById('update-banner-download');
  const dismissBtn = document.getElementById('update-banner-dismiss');

  downloadBtn?.addEventListener('click', async () => {
    const url = pendingUpdateInfo?.htmlUrl;
    if (!url) return;
    try {
      await window.satisfactory.openExternal(url);
    } catch (err) {
      console.error('Open release page error:', err);
    }
  });

  dismissBtn?.addEventListener('click', () => {
    if (pendingUpdateInfo?.latestVersion) {
      setDismissedUpdateVersion(pendingUpdateInfo.latestVersion);
    }
    hideUpdateBanner();
  });
}

async function checkAppUpdateOnBoot() {
  if (typeof window.satisfactory?.checkForUpdate !== 'function') return;
  try {
    const info = await window.satisfactory.checkForUpdate();
    if (!info?.updateAvailable) return;
    if (getDismissedUpdateVersion() === info.latestVersion) return;
    showUpdateBanner(info);
  } catch (err) {
    console.error('Update check error:', err);
  }
}

const DASHBOARD_GENERATOR_ICONS = {
  'generator-coal': 'fa-fire',
  'generator-fuel': 'fa-bolt',
  'generator-nuclear': 'fa-radiation',
};

function collectTopDeficits(projects) {
  const aggregated = new Map();

  const addDeficit = (entry) => {
    if (entry.missing <= LINK_BALANCE_TOLERANCE) return;
    const key = entry.item_slug;
    if (!key) return;

    const existing = aggregated.get(key) ?? {
      item_slug: key,
      item_name: entry.item_name || key,
      item_image: entry.item_image ?? null,
      is_fluid: Boolean(entry.is_fluid),
      missing: 0,
    };
    existing.missing = window.ProductionScale.roundProduction(existing.missing + entry.missing);
    if (entry.item_name) existing.item_name = entry.item_name;
    if (entry.item_image) existing.item_image = entry.item_image;
    if (entry.is_fluid) existing.is_fluid = true;
    aggregated.set(key, existing);
  };

  for (const project of projects) {
    if (project.type === 'production') {
      const steps = project.detail?.steps ?? [];
      const extractions = project.detail?.extractions ?? [];
      for (const entry of computeChainResourceBalance(steps, extractions)) {
        addDeficit(entry);
      }
      continue;
    }

    const computeBalance = window.EnergyUI?.computeEnergyResourceBalance;
    if (!computeBalance) continue;

    const generators = project.detail?.generators ?? [];
    const extractions = project.detail?.extractions ?? [];
    for (const entry of computeBalance(generators, extractions)) {
      addDeficit(entry);
    }
  }

  return [...aggregated.values()].sort((a, b) => b.missing - a.missing).slice(0, 5);
}

function collectProductionObjectivesChart(projects) {
  const rows = [];

  for (const project of projects) {
    if (project.type !== 'production') continue;
    const steps = project.detail?.steps ?? [];
    for (const objective of computeProductionObjectives(steps)) {
      rows.push({
        projectId: project.id,
        projectName: project.name,
        item_slug: objective.item_slug,
        item_name: objective.item_name,
        item_image: objective.item_image,
        is_fluid: objective.is_fluid,
        rate: objective.rate,
      });
    }
  }

  return rows.sort((a, b) => b.rate - a.rate).slice(0, 8);
}

function collectGeneratorMwMix(projects) {
  const mix = new Map();

  for (const project of projects) {
    if (project.type !== 'energy') continue;
    for (const generator of project.detail?.generators ?? []) {
      const slug = generator.building_slug;
      if (!slug) continue;
      const mw = generator.power_output_mw ?? 0;
      if (mw <= 0) continue;

      const existing = mix.get(slug) ?? {
        slug,
        label: DASHBOARD_GENERATOR_LABELS[slug] ?? generator.building_name ?? slug,
        mw: 0,
      };
      existing.mw += mw;
      mix.set(slug, existing);
    }
  }

  return [...mix.values()].sort((a, b) => b.mw - a.mw);
}

function renderDashboardBarRow({
  label,
  sublabel = '',
  value,
  max,
  valueText,
  image = null,
  iconEmoji = '',
  iconClass = '',
  fillClass = '',
  interactive = false,
  projectType = '',
  projectId = '',
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  let icon = '';
  if (image) {
    icon = `<img class="dashboard-bar-icon" src="${escapeHtml(image)}" alt="" />`;
  } else if (iconClass) {
    icon = `<span class="dashboard-bar-icon dashboard-bar-icon--fa" aria-hidden="true"><i class="fa-solid ${escapeHtml(iconClass)}"></i></span>`;
  } else if (iconEmoji) {
    icon = `<span class="dashboard-bar-icon dashboard-bar-icon--emoji" aria-hidden="true">${iconEmoji}</span>`;
  }

  const tag = interactive ? 'button' : 'div';
  const attrs = interactive
    ? ` type="button" class="dashboard-bar-row dashboard-bar-row--interactive" data-project-type="${projectType}" data-project-id="${projectId}"`
    : ` class="dashboard-bar-row"`;

  const sublabelHtml = sublabel
    ? `<span class="dashboard-bar-sublabel">${escapeHtml(sublabel)}</span>`
    : '';

  return `
    <${tag}${attrs}>
      <span class="dashboard-bar-label">
        ${icon}
        <span class="dashboard-bar-label-text">
          <span class="dashboard-bar-name">${escapeHtml(label)}</span>
          ${sublabelHtml}
        </span>
      </span>
      <span class="dashboard-bar-track" aria-hidden="true">
        <span class="dashboard-bar-fill ${fillClass}" style="width: ${pct}%"></span>
      </span>
      <span class="dashboard-bar-value">${escapeHtml(valueText)}</span>
    </${tag}>`;
}

function renderDashboardDeficitsChart(deficits) {
  const container = document.getElementById('dashboard-chart-deficits');
  if (!deficits.length) {
    container.innerHTML =
      '<p class="dashboard-empty dashboard-empty--ok"><i class="fa-solid fa-circle-check" aria-hidden="true"></i> ' +
      `${escapeHtml(t('dashboard.emptyNoResourceDeficits'))}</p>`;
    return;
  }

  const max = deficits[0].missing;
  container.innerHTML = deficits
    .map((entry) => {
      const unit = entry.is_fluid ? 'm³/min' : '/min';
      return renderDashboardBarRow({
        label: entry.item_name || entry.item_slug,
        value: entry.missing,
        max,
        valueText: `−${formatRateWithUnit(entry.missing, unit)}`,
        image: entry.item_image,
        fillClass: 'dashboard-bar-fill--deficit',
      });
    })
    .join('');
}

function renderDashboardObjectivesChart(objectives) {
  const container = document.getElementById('dashboard-chart-objectives');
  if (!objectives.length) {
    container.innerHTML =
      `<p class="dashboard-empty">${escapeHtml(t('dashboard.emptyNoObjectives'))}</p>`;
    return;
  }

  const max = objectives[0].rate;
  container.innerHTML = objectives
    .map((entry) => {
      const unit = entry.is_fluid ? 'm³/min' : '/min';
      return renderDashboardBarRow({
        label: entry.item_name || entry.item_slug,
        sublabel: entry.projectName,
        value: entry.rate,
        max,
        valueText: formatRateWithUnit(entry.rate, unit),
        image: entry.item_image,
        fillClass: 'dashboard-bar-fill--objective',
        interactive: true,
        projectType: 'production',
        projectId: entry.projectId,
      });
    })
    .join('');
}

function renderDashboardPowerChart(mix) {
  const container = document.getElementById('dashboard-chart-power');
  if (!mix.length) {
    container.innerHTML = `<p class="dashboard-empty">${escapeHtml(t('dashboard.emptyNoGenerators'))}</p>`;
    return;
  }

  const max = mix[0].mw;
  const fillClassBySlug = {
    'generator-coal': 'dashboard-bar-fill--coal',
    'generator-fuel': 'dashboard-bar-fill--fuel',
    'generator-nuclear': 'dashboard-bar-fill--nuclear',
  };

  container.innerHTML = mix
    .map((entry) =>
      renderDashboardBarRow({
        label: entry.label,
        value: entry.mw,
        max,
        valueText: formatRateWithUnit(entry.mw, 'MW'),
        iconClass: DASHBOARD_GENERATOR_ICONS[entry.slug] ?? 'fa-bolt',
        fillClass: fillClassBySlug[entry.slug] ?? 'dashboard-bar-fill--power',
      })
    )
    .join('');
}

function computeDashboardPowerTotals(projects) {
  let producedMw = 0;
  let consumedMw = 0;
  const consumptionByProject = [];

  for (const project of projects) {
    if (project.type === 'production') {
      const steps = project.detail?.steps ?? [];
      const extractions = project.detail?.extractions ?? [];
      const mw = computeDetailPowerMw(steps, extractions);
      consumedMw += mw;
      if (mw > 0) {
        consumptionByProject.push({
          projectId: project.id,
          projectName: project.name,
          mw,
        });
      }
      continue;
    }

    if (project.type !== 'energy') continue;

    const generators = project.detail?.generators ?? [];
    const extractions = project.detail?.extractions ?? [];
    producedMw += generators.reduce((sum, gen) => sum + (gen.power_output_mw ?? 0), 0);
    consumedMw += computeExtractionsPowerMw(extractions);
  }

  return {
    producedMw: window.ProductionScale.roundPowerMw(producedMw),
    consumedMw: window.ProductionScale.roundPowerMw(consumedMw),
    balanceMw: window.ProductionScale.roundPowerMw(producedMw - consumedMw),
    consumptionByProject: consumptionByProject.sort((a, b) => b.mw - a.mw).slice(0, 5),
  };
}

function getDashboardPowerCoverage(totals) {
  const producedMw = Number(totals?.producedMw) || 0;
  const consumedMw = Number(totals?.consumedMw) || 0;
  const balanceMw = Number(totals?.balanceMw) || 0;

  if (producedMw <= 0 && consumedMw <= 0) {
    return {
      status: 'empty',
      label: '—',
      summary: '',
      kpiText: '—',
    };
  }

  if (producedMw <= 0 && consumedMw > 0) {
    return {
      status: 'deficit',
      label: t('dashboard.powerUncovered'),
      summary: t('dashboard.powerCoverageShortfall', {
        mw: formatRateWithUnit(consumedMw, 'MW'),
      }),
      kpiText: t('dashboard.powerUncovered'),
    };
  }

  if (balanceMw >= -0.001) {
    const margin = balanceMw > 0.001 ? balanceMw : 0;
    return {
      status: 'ok',
      label: t('dashboard.powerCovered'),
      summary:
        margin > 0
          ? t('dashboard.powerCoverageSurplus', {
              mw: formatRateWithUnit(margin, 'MW'),
            })
          : t('dashboard.powerCoverageExact'),
      kpiText: t('dashboard.powerCovered'),
    };
  }

  const shortfall = window.ProductionScale.roundPowerMw(Math.abs(balanceMw));
  return {
    status: 'deficit',
    label: t('dashboard.powerDeficit'),
    summary: t('dashboard.powerCoverageShortfall', {
      mw: formatRateWithUnit(shortfall, 'MW'),
    }),
    kpiText: t('dashboard.powerDeficit'),
  };
}

function renderDashboardBalanceChart(projects) {
  const container = document.getElementById('dashboard-chart-balance');
  if (!container) return;

  const totals = computeDashboardPowerTotals(projects);
  if (totals.producedMw <= 0 && totals.consumedMw <= 0) {
    container.innerHTML = `<p class="dashboard-empty">${escapeHtml(t('dashboard.emptyNoPowerBalance'))}</p>`;
    return;
  }

  const coverage = getDashboardPowerCoverage(totals);
  const coverageHtml = `
    <div class="dashboard-power-coverage dashboard-power-coverage--${coverage.status}">
      <span class="dashboard-badge dashboard-badge--${
        coverage.status === 'ok' ? 'ok' : 'error'
      }">${escapeHtml(coverage.label)}</span>
      <span class="dashboard-power-coverage-text">
        <span>${escapeHtml(
          t('dashboard.powerCoverageCompare', {
            produced: formatRateWithUnit(totals.producedMw, 'MW'),
            consumed: formatRateWithUnit(totals.consumedMw, 'MW'),
          })
        )}</span>
        <strong>${escapeHtml(coverage.summary)}</strong>
      </span>
    </div>`;

  const max = Math.max(totals.producedMw, totals.consumedMw, 0.001);
  const summaryRows = [
    renderDashboardBarRow({
      label: t('dashboard.balanceProduced'),
      value: totals.producedMw,
      max,
      valueText: formatRateWithUnit(totals.producedMw, 'MW'),
      iconClass: 'fa-bolt',
      fillClass: 'dashboard-bar-fill--produced',
    }),
    renderDashboardBarRow({
      label: t('dashboard.balanceConsumed'),
      value: totals.consumedMw,
      max,
      valueText: formatRateWithUnit(totals.consumedMw, 'MW'),
      iconClass: 'fa-bolt',
      fillClass: 'dashboard-bar-fill--consumed',
    }),
  ];

  const projectRows = totals.consumptionByProject.length
    ? `<p class="dashboard-chart-section-label">${escapeHtml(t('dashboard.balanceTopConsumers'))}</p>${totals.consumptionByProject
        .map((entry) =>
          renderDashboardBarRow({
            label: entry.projectName,
            value: entry.mw,
            max: totals.consumptionByProject[0].mw,
            valueText: formatRateWithUnit(entry.mw, 'MW'),
            iconClass: 'fa-link',
            fillClass: 'dashboard-bar-fill--consumed',
            interactive: true,
            projectType: 'production',
            projectId: entry.projectId,
          })
        )
        .join('')}`
    : '';

  container.innerHTML = `${coverageHtml}${summaryRows.join('')}${projectRows}`;
}

function renderDashboardCharts(projects) {
  renderDashboardDeficitsChart(collectTopDeficits(projects));
  renderDashboardObjectivesChart(collectProductionObjectivesChart(projects));
  renderDashboardPowerChart(collectGeneratorMwMix(projects));
  renderDashboardBalanceChart(projects);
  renderDashboardTransportChart(projects);
}

function renderDashboardTransportChart(projects) {
  const container = document.getElementById('dashboard-chart-transport');
  if (!container) return;

  const rows = projects
    .filter((p) => p.type === 'transport' && (p.vehiclesNeeded || 0) > 0)
    .sort((a, b) => (b.vehiclesNeeded || 0) - (a.vehiclesNeeded || 0))
    .slice(0, 8);

  if (!rows.length) {
    container.innerHTML = `<p class="dashboard-empty">${escapeHtml(t('dashboard.emptyNoTransport'))}</p>`;
    return;
  }

  const max = Math.max(...rows.map((row) => row.vehiclesNeeded || 0), 1);
  container.innerHTML = rows
    .map((project) =>
      renderDashboardBarRow({
        label: project.name,
        sublabel: vehicleDisplayName(project.vehicle) || '',
        value: project.vehiclesNeeded || 0,
        max,
        valueText: formatTransportUnitLabel(project.vehicle, project.vehiclesNeeded || 0),
        image: dashboardAssetSrc(project.vehicle?.image),
        fillClass: 'dashboard-bar-fill--transport',
        interactive: true,
        projectType: 'transport',
        projectId: String(project.id),
      })
    )
    .join('');
}

function renderDashboardTransportFleet(projects) {
  const container = document.getElementById('dashboard-transport-fleet');
  if (!container) return;

  const plans = projects
    .filter((p) => p.type === 'transport')
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 6);

  if (!plans.length) {
    container.innerHTML = `
      <div class="dashboard-transport-empty">
        <p class="dashboard-empty">${escapeHtml(t('dashboard.emptyNoTransport'))}</p>
        <p class="dashboard-empty-hint">${escapeHtml(t('dashboard.emptyTransportHint'))}</p>
        <button type="button" class="btn btn-primary" data-goto="transport">${escapeHtml(t('transport.newPlan'))}</button>
      </div>`;
    return;
  }

  container.innerHTML = plans
    .map((project) => {
      const vehicleImg = dashboardAssetSrc(project.vehicle?.image);
      const cargo = project.detail?.cargo || [];
      const cargoIcons = cargo
        .slice(0, 5)
        .map((line) => {
          const img = dashboardAssetSrc(line.image);
          const title = `${line.name || line.item_slug}: ${line.rate}${line.is_fluid || line.stack_size == null ? ' m³/min' : '/min'}`;
          return img
            ? `<img class="dashboard-transport-cargo-icon" src="${escapeHtml(img)}" alt="" title="${escapeHtml(title)}" />`
            : '';
        })
        .join('');
      const moreCargo =
        cargo.length > 5
          ? `<span class="dashboard-transport-cargo-more">+${cargo.length - 5}</span>`
          : '';
      const vehiclesLabel = formatTransportUnitLabel(project.vehicle, project.vehiclesNeeded || 0);
      return `
        <button
          type="button"
          class="dashboard-transport-card"
          data-project-type="transport"
          data-project-id="${project.id}"
          data-project-open="1"
        >
          <div class="dashboard-transport-card-visual">
            ${
              vehicleImg
                ? `<img src="${escapeHtml(vehicleImg)}" alt="" />`
                : `<span class="dashboard-transport-card-fallback"><i class="fa-solid fa-train"></i></span>`
            }
          </div>
          <div class="dashboard-transport-card-body">
            <div class="dashboard-transport-card-top">
              <span class="dashboard-transport-card-name">${escapeHtml(project.name)}</span>
              <span class="dashboard-badge dashboard-badge--${project.health.status}">${escapeHtml(project.health.label)}</span>
            </div>
            <div class="dashboard-transport-card-vehicles">${escapeHtml(vehiclesLabel)}</div>
            <div class="dashboard-transport-card-meta">
              ${escapeHtml(vehicleDisplayName(project.vehicle) || '—')}
              · ${escapeHtml(
                t('transport.listTripTimes', {
                  outbound: String(project.outbound_minutes ?? '—'),
                  return: String(project.return_minutes ?? '—'),
                  total: String(project.round_trip_minutes ?? '—'),
                })
              )}
            </div>
            <div class="dashboard-transport-card-cargo">
              ${cargoIcons || `<span class="dashboard-transport-cargo-empty">${escapeHtml(t('dashboard.metricsNoTransportCargo'))}</span>`}
              ${moreCargo}
            </div>
          </div>
        </button>`;
    })
    .join('');
}

function renderDashboardKpis(status, projects) {
  const productionCount = projects.filter((p) => p.type === 'production').length;
  const energyCount = projects.filter((p) => p.type === 'energy').length;
  const transportCount = projects.filter((p) => p.type === 'transport').length;
  const transportVehicles = projects
    .filter((p) => p.type === 'transport')
    .reduce((sum, p) => sum + (p.vehiclesNeeded || 0), 0);

  let totalProductionMachines = 0;
  let totalGenerators = 0;
  let totalNodes = 0;
  let totalPowerShards = 0;

  for (const project of projects) {
    if (project.type === 'production') {
      const steps = project.detail?.steps ?? [];
      const extractions = project.detail?.extractions ?? [];
      totalProductionMachines += computeChainMachineCount(steps);
      totalNodes += computeChainNodeCount(extractions);
      totalPowerShards += computeDetailPowerShards(steps, extractions);
    } else if (project.type === 'energy') {
      const generators = project.detail?.generators ?? [];
      const extractions = project.detail?.extractions ?? [];
      totalGenerators += generators.reduce(
        (sum, gen) => sum + Math.max(0, Math.round(Number(gen.machine_count) || 0)),
        0
      );
      totalPowerShards += computeDetailPowerShards(generators, extractions);
    }
  }

  const powerTotals = computeDashboardPowerTotals(projects);
  const deficitCount = collectDashboardAlerts(projects).length;

  document.getElementById('kpi-production-chains').textContent = formatDisplayInteger(
    status.counts?.chains ?? productionCount
  );
  document.getElementById('kpi-energy-chains').textContent = formatDisplayInteger(
    status.counts?.energyChains ?? energyCount
  );

  const transportPlansEl = document.getElementById('kpi-transport-plans');
  if (transportPlansEl) transportPlansEl.textContent = formatDisplayInteger(transportCount);
  const transportVehiclesEl = document.getElementById('kpi-transport-vehicles');
  if (transportVehiclesEl) {
    transportVehiclesEl.textContent = formatDisplayInteger(transportVehicles);
    transportVehiclesEl.classList.toggle('ok', transportVehicles > 0);
  }

  const energyMwEl = document.getElementById('kpi-energy-mw');
  energyMwEl.textContent =
    powerTotals.producedMw > 0 ? formatRateWithUnit(powerTotals.producedMw, 'MW') : '—';
  energyMwEl.classList.toggle('ok', powerTotals.producedMw > 0);

  const consumptionEl = document.getElementById('kpi-consumption-mw');
  if (consumptionEl) {
    consumptionEl.textContent =
      powerTotals.consumedMw > 0 ? formatRateWithUnit(powerTotals.consumedMw, 'MW') : '—';
    consumptionEl.classList.toggle('ok', powerTotals.consumedMw > 0);
  }

  const balanceEl = document.getElementById('kpi-power-balance');
  if (balanceEl) {
    const coverage = getDashboardPowerCoverage(powerTotals);
    if (coverage.status === 'empty') {
      balanceEl.textContent = '—';
      balanceEl.classList.remove('ok', 'warn');
      balanceEl.title = '';
    } else {
      const sign = powerTotals.balanceMw > 0 ? '+' : '';
      const delta = `${sign}${formatRateWithUnit(powerTotals.balanceMw, 'MW')}`;
      balanceEl.textContent = `${coverage.kpiText} · ${delta}`;
      balanceEl.classList.toggle('ok', coverage.status === 'ok');
      balanceEl.classList.toggle('warn', coverage.status === 'deficit');
      balanceEl.title = t('dashboard.powerCoverageCompare', {
        produced: formatRateWithUnit(powerTotals.producedMw, 'MW'),
        consumed: formatRateWithUnit(powerTotals.consumedMw, 'MW'),
      });
    }
  }

  document.getElementById('kpi-machines').textContent = formatDisplayInteger(totalProductionMachines);
  document.getElementById('kpi-generators').textContent = formatDisplayInteger(totalGenerators);
  document.getElementById('kpi-nodes').textContent = formatDisplayInteger(totalNodes);
  document.getElementById('kpi-power-shards').textContent = formatDisplayInteger(totalPowerShards);

  const deficitsEl = document.getElementById('kpi-deficits');
  deficitsEl.textContent = formatDisplayInteger(deficitCount);
  deficitsEl.classList.toggle('ok', deficitCount === 0);
  deficitsEl.classList.toggle('warn', deficitCount > 0);

  const latest = projects[0];
  document.getElementById('kpi-last-updated').textContent = latest
    ? formatDashboardRelativeTime(latest.updated_at)
    : '—';
  document.getElementById('kpi-last-updated').title = latest?.name ?? '';
}

function renderDashboardProjectsList(projects) {
  const container = document.getElementById('dashboard-projects');
  if (!projects.length) {
    container.innerHTML = `
      <p class="dashboard-empty">${escapeHtml(t('dashboard.emptyNoProjects'))}</p>
      <p class="dashboard-empty-hint">${escapeHtml(t('dashboard.emptyProjectsHint'))}</p>`;
    return;
  }

  container.innerHTML = projects
    .slice(0, 8)
    .map((project) => {
      const typeLabel =
        project.type === 'production'
          ? t('dashboard.projectTypeProduction')
          : project.type === 'energy'
            ? t('dashboard.projectTypeEnergy')
            : t('dashboard.projectTypeTransport');
      const typeIcon =
        project.type === 'production'
          ? 'fa-link'
          : project.type === 'energy'
            ? 'fa-bolt'
            : 'fa-train';
      const vehicleImg =
        project.type === 'transport' ? dashboardAssetSrc(project.vehicle?.image) : '';
      const iconHtml = vehicleImg
        ? `<img class="dashboard-project-thumb" src="${escapeHtml(vehicleImg)}" alt="" />`
        : `<i class="fa-solid ${typeIcon}"></i>`;
      return `
        <div
          class="dashboard-project-row"
          data-project-type="${project.type}"
          data-project-id="${project.id}"
        >
          <button
            type="button"
            class="dashboard-project-main"
            data-project-open="1"
            data-project-type="${project.type}"
            data-project-id="${project.id}"
          >
            <span class="dashboard-project-icon" aria-hidden="true">
              ${iconHtml}
            </span>
            <span class="dashboard-project-body">
              <span class="dashboard-project-title">
                <span class="dashboard-project-name">${escapeHtml(project.name)}</span>
                <span class="dashboard-badge dashboard-badge--${project.health.status}">${escapeHtml(project.health.label)}</span>
              </span>
              <span class="dashboard-project-meta">
                <span>${typeLabel}</span>
                <span class="dashboard-project-sep">·</span>
                <span>${escapeHtml(project.metricsText)}</span>
              </span>
              <span class="dashboard-project-updated">${escapeHtml(t('time.updated', { when: formatDashboardRelativeTime(project.updated_at) }))}</span>
            </span>
          </button>
          <button
            type="button"
            class="dashboard-project-delete"
            data-project-delete="1"
            data-project-type="${project.type}"
            data-project-id="${project.id}"
            data-project-name="${escapeHtml(project.name)}"
            aria-label="${escapeHtml(t('actions.deleteAria', { name: project.name }))}"
            title="${escapeHtml(t('actions.delete'))}"
          >
            <i class="fa-solid fa-trash" aria-hidden="true"></i>
          </button>
        </div>`;
    })
    .join('');
}

function renderDashboardAlertsList(alerts) {
  const container = document.getElementById('dashboard-alerts');
  if (!alerts.length) {
    container.innerHTML = `
      <p class="dashboard-empty dashboard-empty--ok">
        <i class="fa-solid fa-circle-check" aria-hidden="true"></i>
        ${escapeHtml(t('dashboard.emptyAllOk'))}
      </p>`;
    return;
  }

  container.innerHTML = alerts
    .slice(0, 12)
    .map((alert) => {
      const isPower = alert.kind === 'power';
      const isTransport = alert.kind === 'transport';
      const attrs = isPower
        ? `data-dashboard-action="energy"`
        : `data-project-type="${alert.projectType}" data-project-id="${alert.projectId}"`;
      const icon = isPower ? 'fa-bolt' : isTransport ? 'fa-train' : 'fa-triangle-exclamation';
      return `
        <button
          type="button"
          class="dashboard-alert-row"
          ${attrs}
        >
          <span class="dashboard-alert-icon" aria-hidden="true">
            <i class="fa-solid ${icon}"></i>
          </span>
          <span class="dashboard-alert-body">
            <span class="dashboard-alert-title">
              ${escapeHtml(alert.itemName)}
              <span class="dashboard-alert-missing">${isTransport ? '' : '−'}${escapeHtml(alert.missingText)}</span>
            </span>
            <span class="dashboard-alert-project">${escapeHtml(alert.projectName)}</span>
          </span>
        </button>`;
    })
    .join('');
}

async function renderDashboardProjects(status) {
  const [productionChains, energyChains, transportPlans] = await Promise.all([
    window.satisfactory.getProductionChains(),
    window.satisfactory.getEnergyChains(),
    window.satisfactory.getTransportPlans().catch((err) => {
      console.error('Dashboard transport plans error:', err);
      return [];
    }),
  ]);

  const [productionDetails, energyDetails] = await Promise.all([
    Promise.all(
      productionChains.map((chain) =>
        window.satisfactory.getProductionChainDetail(chain.id).catch((err) => {
          console.error('Dashboard production detail error:', chain.id, err);
          return null;
        })
      )
    ),
    Promise.all(
      energyChains.map((chain) =>
        window.satisfactory.getEnergyChainDetail(chain.id).catch((err) => {
          console.error('Dashboard energy detail error:', chain.id, err);
          return null;
        })
      )
    ),
  ]);

  const projects = [
    ...productionChains
      .map((chain, index) =>
        productionDetails[index]
          ? buildProductionProjectSummary(chain, productionDetails[index])
          : null
      )
      .filter(Boolean),
    ...energyChains
      .map((chain, index) =>
        energyDetails[index] ? buildEnergyProjectSummary(chain, energyDetails[index]) : null
      )
      .filter(Boolean),
    ...transportPlans.map((plan) => buildTransportProjectSummary(plan)),
  ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  renderDashboardKpis(status, projects);
  renderDashboardProjectsList(projects);
  renderDashboardAlertsList(collectDashboardAlerts(projects));
  renderDashboardTransportFleet(projects);
  renderDashboardCharts(projects);
}

function openDashboardProject(type, id) {
  if (type === 'production') {
    openProductionDetail(id);
    return;
  }
  if (type === 'energy' && window.EnergyUI?.openEnergyDetail) {
    window.EnergyUI.openEnergyDetail(id);
    return;
  }
  if (type === 'transport' && window.TransportUI?.openTransportDetail) {
    window.TransportUI.openTransportDetail(id);
  }
}

function setupDashboard() {
  const projectsEl = document.getElementById('dashboard-projects');
  const alertsEl = document.getElementById('dashboard-alerts');
  const objectivesChartEl = document.getElementById('dashboard-chart-objectives');
  const balanceChartEl = document.getElementById('dashboard-chart-balance');
  const transportFleetEl = document.getElementById('dashboard-transport-fleet');
  const transportChartEl = document.getElementById('dashboard-chart-transport');

  const handleProjectClick = async (event) => {
    const energyAction = event.target.closest('[data-dashboard-action="energy"]');
    if (energyAction) {
      switchView('energy');
      return;
    }

    const deleteBtn = event.target.closest('[data-project-delete]');
    if (deleteBtn) {
      event.preventDefault();
      event.stopPropagation();
      const type = deleteBtn.dataset.projectType;
      const id = Number(deleteBtn.dataset.projectId);
      const name = deleteBtn.dataset.projectName || '';
      const confirmed = await showConfirm({
        title:
          type === 'energy'
            ? t('confirm.deleteEnergyPlanTitle')
            : type === 'transport'
              ? t('confirm.deleteTransportPlanTitle')
              : t('confirm.deletePlanTitle'),
        message:
          type === 'energy'
            ? t('confirm.deleteEnergyPlanMessage', { name })
            : type === 'transport'
              ? t('confirm.deleteTransportPlanMessage', { name })
              : t('confirm.deletePlanMessage', { name }),
        confirmLabel: t('actions.delete'),
      });
      if (!confirmed) return;
      try {
        if (type === 'production') {
          await window.satisfactory.deleteProductionChain(id);
        } else if (type === 'energy') {
          await window.satisfactory.deleteEnergyChain(id);
        } else if (type === 'transport') {
          await window.satisfactory.deleteTransportPlan(id);
        }
        await initDashboard();
      } catch (err) {
        console.error('Dashboard delete project error:', err);
        await showAlert({
          title: t('errors.saveFailed'),
          message: err.message || t('errors.saveFailed'),
        });
      }
      return;
    }

    const row = event.target.closest('[data-project-open], [data-project-type][data-project-id]');
    if (!row || row.dataset.projectDelete) return;
    openDashboardProject(row.dataset.projectType, Number(row.dataset.projectId));
  };

  projectsEl?.addEventListener('click', handleProjectClick);
  alertsEl?.addEventListener('click', handleProjectClick);
  objectivesChartEl?.addEventListener('click', handleProjectClick);
  balanceChartEl?.addEventListener('click', handleProjectClick);
  transportFleetEl?.addEventListener('click', handleProjectClick);
  transportChartEl?.addEventListener('click', handleProjectClick);
}

