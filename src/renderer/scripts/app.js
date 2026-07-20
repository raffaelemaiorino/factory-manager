const views = {
  dashboard: document.getElementById('view-dashboard'),
  resources: document.getElementById('view-resources'),
  production: document.getElementById('view-production'),
  'production-detail': document.getElementById('view-production-detail'),
  energy: document.getElementById('view-energy'),
  'energy-detail': document.getElementById('view-energy-detail'),
  settings: document.getElementById('view-settings'),
};

const EDIT_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.83H5v-.92l9.06-9.06.92.92L5.92 20.08zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
const DUPLICATE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>`;
const EXPORT_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67 2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/></svg>`;
const DELETE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
const RESET_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>`;
const ADD_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`;
const DRAG_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h2v2H9V5zm0 6h2v2H9v-2zm0 6h2v2H9v-2zm4-12h2v2h-2V5zm0 6h2v2h-2v-2zm0 6h2v2h-2v-2z"/></svg>`;

const EXTRACTION_LIQUID_SLUGS = ['liquid-oil', 'water'];

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

let activeLocale = 'it';
let availableLocales = [];

function formatUiResultsCount(n) {
  const count = formatDisplayInteger(n);
  return n === 1 ? t('common.resultsOne', { count }) : t('common.resultsMany', { count });
}

function formatUiResourcesCount(n) {
  const count = formatDisplayInteger(n);
  return n === 1 ? t('common.resourcesOne', { count }) : t('common.resourcesMany', { count });
}

function formatProductionDetailMeta(extractionsCount, stepsCount) {
  const extPart =
    extractionsCount === 1
      ? t('production.metaExtractionsOne', { count: extractionsCount })
      : t('production.metaExtractionsMany', { count: extractionsCount });
  const stepPart =
    stepsCount === 1
      ? t('production.metaStepsOne', { count: stepsCount })
      : t('production.metaStepsMany', { count: stepsCount });
  let suffix = '';
  if (productionDetailViewMode === 'group-tree') {
    suffix = t('production.metaTreeGroups');
  } else if (productionDetailViewMode === 'tree' && productionTreeGroupKey) {
    suffix = t('production.metaTreeGroup', { name: getProductionGroupLabel(productionTreeGroupKey) });
  }
  return `${extPart}, ${stepPart}${suffix}`;
}

function deficitHealthLabel(deficitCount) {
  return deficitCount === 1
    ? t('health.deficitOne')
    : t('health.deficitMany', { count: deficitCount });
}

const NODES_SLIDER_MAX = 25;
const WATER_NODES_SLIDER_MAX = 500;
const LINK_BALANCE_TOLERANCE = 0.05;

let resourcesData = [];
let categoryOptions = [];
let activeCategory = null;
let isSearchActive = false;
let hideWithoutSchemas = true;
let productionChains = [];
let productionChainSummaries = new Map();
let activeProductionChainId = null;
let activeProductionDetail = null;
let productionDetailViewMode = 'editor';
let productionTreeGroupKey = null;
let productionGraphHandle = null;
let productionStepDragState = null;
let productionGroupDragState = null;
let pickerResourcesData = [];
let pendingPickerItemId = null;
let pendingInsertAfterStepId = null;
let resourcePickerMode = 'step';
const stepOutputDebounce = new Map();
const extractionConfigDebounce = new Map();
const productionStepViewStates = new Map();
const productionGroupViewStates = new Map();
const PRODUCTION_GROUP_KEY_UNGROUPED = '__ungrouped__';
const PRODUCTION_UI_STATE_KEY = 'satisfactory-production-ui';
let productionUiStateCache = {};

function normalizeProductionStepId(stepId) {
  const id = Number(stepId);
  return Number.isFinite(id) ? id : null;
}

function isCollapsedProductionViewState(value) {
  return value === 'collapsed' || value === 'compressed';
}

function loadAllProductionUiStates() {
  return productionUiStateCache;
}

function saveAllProductionUiStates(all) {
  productionUiStateCache = all && typeof all === 'object' ? all : {};

  try {
    window.satisfactory?.saveProductionUiState?.(productionUiStateCache);
  } catch {
    /* salvataggio disabilitato o IPC non disponibile */
  }
}

async function initProductionUiStateStore() {
  let data = {};

  try {
    data = window.satisfactory?.loadProductionUiState?.() ?? {};
    if (!data || typeof data !== 'object') data = {};
  } catch {
    data = {};
  }

  if (!Object.keys(data).length) {
    try {
      const raw = localStorage.getItem(PRODUCTION_UI_STATE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          data = parsed;
          saveAllProductionUiStates(data);
          localStorage.removeItem(PRODUCTION_UI_STATE_KEY);
        }
      }
    } catch {
      /* migrazione da localStorage non riuscita */
    }
  }

  productionUiStateCache = data;
}

function getProductionUiStateForChain(chainId) {
  if (!chainId) return { groups: {}, steps: {} };
  const chain = loadAllProductionUiStates()[String(chainId)];
  return {
    groups: chain?.groups && typeof chain.groups === 'object' ? chain.groups : {},
    steps: chain?.steps && typeof chain.steps === 'object' ? chain.steps : {},
  };
}

function persistProductionUiState(chainId = activeProductionChainId) {
  if (!chainId) return;

  const groups = {};
  for (const [key, value] of productionGroupViewStates) {
    if (value === 'collapsed') groups[key] = value;
  }

  const steps = {};
  for (const [key, value] of productionStepViewStates) {
    if (value === 'collapsed') steps[String(key)] = value;
  }

  const all = loadAllProductionUiStates();
  if (!Object.keys(groups).length && !Object.keys(steps).length) {
    delete all[String(chainId)];
  } else {
    all[String(chainId)] = { groups, steps };
  }

  try {
    saveAllProductionUiStates(all);
  } catch {
    /* storage pieno o disabilitato */
  }
}

function hydrateProductionUiStateMaps(chainId) {
  productionGroupViewStates.clear();
  productionStepViewStates.clear();

  const saved = getProductionUiStateForChain(chainId);
  for (const [key, value] of Object.entries(saved.groups)) {
    if (isCollapsedProductionViewState(value)) productionGroupViewStates.set(key, 'collapsed');
  }
  for (const [key, value] of Object.entries(saved.steps)) {
    const stepId = normalizeProductionStepId(key);
    if (stepId && isCollapsedProductionViewState(value)) {
      productionStepViewStates.set(stepId, 'collapsed');
    }
  }
}

function migrateProductionGroupPersistedKeys(chainId, oldKey, newKey) {
  if (!chainId || !oldKey || !newKey || oldKey === newKey) return;

  if (productionGroupViewStates.has(oldKey)) {
    productionGroupViewStates.set(newKey, productionGroupViewStates.get(oldKey));
    productionGroupViewStates.delete(oldKey);
    persistProductionUiState(chainId);
  }

  const all = loadAllProductionUiStates();
  const chainKey = String(chainId);
  if (all[chainKey]?.groups?.[oldKey]) {
    all[chainKey].groups[newKey] = all[chainKey].groups[oldKey];
    delete all[chainKey].groups[oldKey];
    try {
      saveAllProductionUiStates(all);
    } catch {
      /* storage pieno o disabilitato */
    }
  }

  const graphPrefix = 'satisfactory-graph-layout-';
  const oldLayoutKey = `${graphPrefix}${chainId}::group::${oldKey}`;
  const newLayoutKey = `${graphPrefix}${chainId}::group::${newKey}`;
  try {
    const layout = localStorage.getItem(oldLayoutKey);
    if (layout) {
      localStorage.setItem(newLayoutKey, layout);
      localStorage.removeItem(oldLayoutKey);
    }
  } catch {
    /* storage pieno o disabilitato */
  }

  if (productionTreeGroupKey === oldKey) {
    productionTreeGroupKey = newKey;
  }
}

const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-item-form');
const editFormError = document.getElementById('edit-form-error');
const detailModal = document.getElementById('detail-modal');
const detailModalBody = document.getElementById('detail-modal-body');
const confirmModal = document.getElementById('confirm-modal');
const productionCreateModal = document.getElementById('production-create-modal');
const productionCreateForm = document.getElementById('production-create-form');
const productionCreateError = document.getElementById('production-create-error');
const schemaRenameModal = document.getElementById('schema-rename-modal');
const schemaRenameForm = document.getElementById('schema-rename-form');
const schemaRenameError = document.getElementById('schema-rename-error');
const productionDetailBody = document.getElementById('production-detail-body');
const resourcePickerModal = document.getElementById('resource-picker-modal');
const schemaPickerModal = document.getElementById('schema-picker-modal');

let confirmResolve = null;
let schemaRenameOnSaved = null;
let schemaRenameGroupKey = null;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function switchView(viewName) {
  document.getElementById('app').dataset.view = viewName;

  let navView = viewName;
  if (viewName === 'production-detail') navView = 'production';
  if (viewName === 'energy-detail') navView = 'energy';
  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === navView);
  });

  Object.entries(views).forEach(([name, el]) => {
    el.classList.toggle('view-active', name === viewName);
  });

  if (viewName !== 'production-detail' && activeProductionChainId) {
    persistProductionUiState(activeProductionChainId);
  }

  if (viewName === 'resources' && resourcesData.length === 0) {
    loadResources();
  }

  if (viewName === 'production') {
    activeProductionChainId = null;
    activeProductionDetail = null;
    loadProductionChains();
  }

  if (viewName === 'energy' && window.EnergyUI) {
    window.EnergyUI.loadEnergyChains();
  }

  if (viewName === 'settings') {
    loadSettings();
  }

  if (viewName === 'dashboard') {
    initDashboard();
  }
}

window.switchView = switchView;

window.ProductionUI = {
  renderItemImage,
  renderThemeSelect,
  renderBuildingPanel,
  formatProductionValue,
  formatDisplayInteger,
  formatRateWithUnit,
  formatExtractionOutputInputValue,
  formatWaterExtractionOutputInputValue,
  parseConfigNumberInput,
  getEditableConfigInput,
  resolveConfigNumberInput,
  formatOutputInputValue,
  formatOverclockInputValue,
  formatMachineCountInput,
  computeTotalPowerShards,
  formatExtractionBuildingConfigContent,
  getExtractionOutputUnit,
  getExtractionSubtitle,
  computeClientExtractionRate,
  getExtractionOutputSliderMin,
  getExtractionOutputSliderMax,
  usesFractionalExtractionOutput,
  getExtractionOutputSliderStep,
  lockConfigSlidersIn,
  isConfigSlider,
  isConfigSliderLocked,
  activateConfigSlider,
  deactivateConfigSlider,
  lockActiveConfigSlidersOutsidePointer,
  lockConfigNumberInputsIn,
  activateConfigNumberInput,
  lockConfigNumberInput,
  rememberConfigInputValue,
  getConfigInputField,
  applyConfigInputNudge,
  normalizeConfigInputSpinnerStep,
  nudgeConfigNumberInput,
  closeAllThemeSelects,
  toggleThemeSelect,
  MINER_OPTIONS,
  PURITY_OPTIONS,
  getLinkBalanceState,
  getLinkStateClass,
  resolveInputLinkBalance,
  normalizeLinkDelta,
  LINK_BALANCE_TOLERANCE,
  isExternalSummarySlug,
};

window.showConfirm = showConfirm;

function setupNavigation() {
  document.getElementById('main-nav').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-view]');
    if (!btn || btn.disabled) return;
    switchView(btn.dataset.view);
  });

  document.querySelector('.brand--compact')?.addEventListener('click', () => {
    switchView('dashboard');
  });

  document.querySelectorAll('[data-goto]').forEach((el) => {
    el.addEventListener('click', () => switchView(el.dataset.goto));
  });
}

const legalInfoModal = document.getElementById('legal-info-modal');

function openLegalInfoModal() {
  if (!legalInfoModal) return;
  legalInfoModal.classList.remove('hidden');
  legalInfoModal.setAttribute('aria-hidden', 'false');
  document.getElementById('legal-info-modal-body')?.focus();
}

function closeLegalInfoModal() {
  if (!legalInfoModal) return;
  legalInfoModal.classList.add('hidden');
  legalInfoModal.setAttribute('aria-hidden', 'true');
}

function setupLegalInfoModal() {
  document.getElementById('legal-info-btn')?.addEventListener('click', openLegalInfoModal);
  document.getElementById('legal-info-modal-close')?.addEventListener('click', closeLegalInfoModal);

  legalInfoModal?.addEventListener('click', (e) => {
    if (e.target === legalInfoModal) closeLegalInfoModal();
  });
}

function renderLocaleSelect() {
  const menu = document.getElementById('locale-select-menu');
  const valueEl = document.getElementById('locale-select-value');
  const trigger = document.getElementById('locale-select-trigger');
  if (!menu || !valueEl || !trigger) return;

  const current =
    availableLocales.find((locale) => locale.code === activeLocale) ||
    availableLocales[0] ||
    { code: 'it', name: 'Italiano' };

  valueEl.textContent = String(current.code || 'it').toUpperCase();
  trigger.title = t('topbar.languageTitle');
  trigger.setAttribute(
    'aria-label',
    t('topbar.languageAria', { name: current.name || current.code })
  );

  menu.innerHTML = availableLocales
    .map((locale) => {
      const code = String(locale.code || '').toUpperCase();
      const isActive = locale.code === activeLocale;
      return `<li
        class="theme-select-option locale-select-option ${isActive ? 'theme-select-option--active' : ''}"
        role="option"
        tabindex="-1"
        data-value="${escapeHtml(locale.code)}"
        aria-selected="${isActive ? 'true' : 'false'}"
      >
        <span class="locale-select-option-name">${escapeHtml(locale.name)}</span>
        <span class="locale-select-option-code">${escapeHtml(code)}</span>
      </li>`;
    })
    .join('');
}

async function refreshAfterLocaleChange() {
  syncLocaleDependentLabels();
  pickerResourcesData = [];
  window.EnergyUI?.clearLocaleCaches?.();

  const app = document.getElementById('app');
  const currentView = app?.dataset.view || 'dashboard';

  if (currentView === 'resources' || resourcesData.length) {
    try {
      await refreshResourcesView();
    } catch (err) {
      console.error('Locale resources refresh error:', err);
    }
  }

  if (currentView === 'production') {
    try {
      await loadProductionChains();
    } catch (err) {
      console.error('Locale production refresh error:', err);
    }
  }

  if (currentView === 'production-detail' && activeProductionChainId) {
    try {
      activeProductionDetail = await window.satisfactory.getProductionChainDetail(
        activeProductionChainId
      );
      renderProductionDetailContent(activeProductionDetail);
    } catch (err) {
      console.error('Locale production detail refresh error:', err);
    }
  }

  if (currentView === 'energy' && window.EnergyUI) {
    try {
      await window.EnergyUI.loadEnergyChains();
    } catch (err) {
      console.error('Locale energy refresh error:', err);
    }
  }

  if (currentView === 'energy-detail' && window.EnergyUI?.reloadActiveDetail) {
    try {
      await window.EnergyUI.reloadActiveDetail();
    } catch (err) {
      console.error('Locale energy detail refresh error:', err);
    }
  }

  if (currentView === 'dashboard') {
    try {
      await initDashboard();
    } catch (err) {
      console.error('Locale dashboard refresh error:', err);
    }
  }

  if (currentView === 'settings') {
    try {
      await loadSettings();
    } catch (err) {
      console.error('Locale settings refresh error:', err);
    }
  }
}

async function setUiLocale(localeCode, { persist = true } = {}) {
  const next = String(localeCode || 'it').toLowerCase();
  if (persist) {
    await window.satisfactory.setAppLocale(next);
  }
  activeLocale = next;
  if (window.I18nUI?.loadLocale) {
    await window.I18nUI.loadLocale(activeLocale);
  } else {
    document.documentElement.lang = activeLocale;
  }
  syncLocaleDependentLabels();
  renderLocaleSelect();
  if (persist) {
    await refreshAfterLocaleChange();
  }
}

async function initLocaleSelector() {
  try {
    const info = await window.satisfactory.getI18nInfo();
    availableLocales = info.availableLocales?.length
      ? info.availableLocales
      : info.locales || [
          { code: 'it', name: 'Italiano' },
          { code: 'en', name: 'English' },
        ];
    activeLocale = info.activeLocale || 'it';
  } catch (err) {
    console.error('Locale init error:', err);
    availableLocales = [
      { code: 'it', name: 'Italiano' },
      { code: 'en', name: 'English' },
    ];
    activeLocale = 'it';
  }

  if (window.I18nUI?.loadLocale) {
    await window.I18nUI.loadLocale(activeLocale);
  } else {
    document.documentElement.lang = activeLocale;
  }
  syncLocaleDependentLabels();
  renderLocaleSelect();
}

function setupLocaleSelector() {
  const root = document.getElementById('locale-select');
  if (!root) return;

  root.addEventListener('click', async (e) => {
    const option = e.target.closest('.locale-select-option');
    if (option) {
      e.preventDefault();
      e.stopPropagation();
      const next = option.dataset.value;
      closeAllThemeSelects();
      if (!next || next === activeLocale) return;
      try {
        await setUiLocale(next);
      } catch (err) {
        console.error('Locale change error:', err);
      }
      return;
    }

    const trigger = e.target.closest('#locale-select-trigger');
    if (trigger) {
      e.preventDefault();
      e.stopPropagation();
      toggleThemeSelect(root);
    }
  });
}

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
  document.getElementById('env-db-path').textContent = status.path ?? '—';
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
  const powerShards = computeChainPowerShards(steps);

  const metrics = [];
  if (machines > 0) metrics.push(t('dashboard.metricsMachines', { count: machines }));
  if (nodes > 0) metrics.push(t('dashboard.metricsNodes', { count: nodes }));
  if (powerShards > 0) metrics.push(t('dashboard.metricsPowerShards', { count: powerShards }));

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

function collectDashboardAlerts(projects) {
  const alerts = [];

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

function renderDashboardCharts(projects) {
  renderDashboardDeficitsChart(collectTopDeficits(projects));
  renderDashboardObjectivesChart(collectProductionObjectivesChart(projects));
  renderDashboardPowerChart(collectGeneratorMwMix(projects));
}

function renderDashboardKpis(status, projects) {
  const productionCount = status.counts?.chains ?? 0;
  const energyCount = status.counts?.energyChains ?? 0;

  let totalProductionMachines = 0;
  let totalGenerators = 0;
  let totalNodes = 0;
  let totalPowerShards = 0;
  let totalEnergyMw = 0;

  for (const project of projects) {
    if (project.type === 'production') {
      const steps = project.detail?.steps ?? [];
      const extractions = project.detail?.extractions ?? [];
      totalProductionMachines += computeChainMachineCount(steps);
      totalNodes += computeChainNodeCount(extractions);
      totalPowerShards += computeChainPowerShards(steps);
    } else {
      const generators = project.detail?.generators ?? [];
      totalGenerators += generators.reduce(
        (sum, gen) => sum + Math.max(0, Math.round(Number(gen.machine_count) || 0)),
        0
      );
      totalEnergyMw += generators.reduce((sum, gen) => sum + (gen.power_output_mw ?? 0), 0);
    }
  }

  const deficitCount = collectDashboardAlerts(projects).length;

  document.getElementById('kpi-production-chains').textContent = formatDisplayInteger(productionCount);
  document.getElementById('kpi-energy-chains').textContent = formatDisplayInteger(energyCount);

  const energyMwEl = document.getElementById('kpi-energy-mw');
  energyMwEl.textContent = totalEnergyMw > 0 ? formatRateWithUnit(totalEnergyMw, 'MW') : '—';
  energyMwEl.classList.toggle('ok', totalEnergyMw > 0);

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
          : t('dashboard.projectTypeEnergy');
      const typeIcon = project.type === 'production' ? 'fa-link' : 'fa-bolt';
      return `
        <button
          type="button"
          class="dashboard-project-row"
          data-project-type="${project.type}"
          data-project-id="${project.id}"
        >
          <span class="dashboard-project-icon" aria-hidden="true">
            <i class="fa-solid ${typeIcon}"></i>
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
        </button>`;
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
    .map(
      (alert) => `
        <button
          type="button"
          class="dashboard-alert-row"
          data-project-type="${alert.projectType}"
          data-project-id="${alert.projectId}"
        >
          <span class="dashboard-alert-icon" aria-hidden="true">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </span>
          <span class="dashboard-alert-body">
            <span class="dashboard-alert-title">
              ${escapeHtml(alert.itemName)}
              <span class="dashboard-alert-missing">−${escapeHtml(alert.missingText)}</span>
            </span>
            <span class="dashboard-alert-project">${escapeHtml(alert.projectName)}</span>
          </span>
        </button>`
    )
    .join('');
}

async function renderDashboardProjects(status) {
  const [productionChains, energyChains] = await Promise.all([
    window.satisfactory.getProductionChains(),
    window.satisfactory.getEnergyChains(),
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
  ].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  renderDashboardKpis(status, projects);
  renderDashboardProjectsList(projects);
  renderDashboardAlertsList(collectDashboardAlerts(projects));
  renderDashboardCharts(projects);
}

function openDashboardProject(type, id) {
  if (type === 'production') {
    openProductionDetail(id);
    return;
  }
  if (type === 'energy' && window.EnergyUI?.openEnergyDetail) {
    window.EnergyUI.openEnergyDetail(id);
  }
}

function setupDashboard() {
  const projectsEl = document.getElementById('dashboard-projects');
  const alertsEl = document.getElementById('dashboard-alerts');
  const objectivesChartEl = document.getElementById('dashboard-chart-objectives');

  const handleProjectClick = (event) => {
    const row = event.target.closest('[data-project-type][data-project-id]');
    if (!row) return;
    openDashboardProject(row.dataset.projectType, Number(row.dataset.projectId));
  };

  projectsEl?.addEventListener('click', handleProjectClick);
  alertsEl?.addEventListener('click', handleProjectClick);
  objectivesChartEl?.addEventListener('click', handleProjectClick);
}

function itemHasSchemas(item) {
  return Number(item.schema_count) > 0;
}

function applySchemaFilter(categories) {
  if (!hideWithoutSchemas) return categories;

  return categories
    .map((cat) => {
      const items = cat.items.filter(itemHasSchemas);
      return { ...cat, items, item_count: items.length };
    })
    .filter((cat) => cat.items.length > 0);
}

function filterItemsList(items) {
  if (!hideWithoutSchemas) return items;
  return items.filter(itemHasSchemas);
}

function renderCategorySidebar(categories) {
  const list = document.getElementById('category-list');
  const visible = applySchemaFilter(categories);
  list.innerHTML = visible
    .map(
      (cat) => `
    <li>
      <button
        type="button"
        class="category-btn ${cat.slug === activeCategory ? 'active' : ''}"
        data-category="${cat.slug}"
      >
        <span class="category-btn-text">
          <span class="category-btn-name">${escapeHtml(cat.name)}</span>
          <span class="category-btn-count">${formatDisplayInteger(cat.item_count)} oggetti</span>
        </span>
      </button>
    </li>`
    )
    .join('');

  list.querySelectorAll('.category-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.category;
      renderCategorySidebar(resourcesData);
      renderResources();
      document.getElementById(`cat-${activeCategory}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  });

  if (activeCategory && !visible.some((cat) => cat.slug === activeCategory)) {
    activeCategory = null;
  }
}

function renderItemImage(item) {
  if (item.image) {
    return `<img class="resource-img" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" />`;
  }
  return `<div class="resource-img resource-img--placeholder"></div>`;
}

function renderItemCard(item) {
  return `
    <article class="resource-card" data-id="${item.id}">
      <button
        type="button"
        class="resource-edit-btn"
        data-id="${item.id}"
        aria-label="${escapeHtml(t('resources.editAria', { name: item.name }))}"
      >${EDIT_ICON}</button>
      ${renderItemImage(item)}
      <div class="resource-info">
        <h4>${escapeHtml(item.name)}</h4>
      </div>
    </article>`;
}

function renderCategorySection(category) {
  if (!category.items.length) return '';

  return `
    <section class="card resource-category" id="cat-${category.slug}">
      <header class="resource-category-header">
        <div>
          <h3>${escapeHtml(category.name)}</h3>
          <span class="resource-category-count">${formatUiResourcesCount(category.items.length)}</span>
        </div>
      </header>
      <div class="resource-grid">
        ${category.items.map(renderItemCard).join('')}
      </div>
    </section>`;
}

function renderSearchResults(items) {
  const container = document.getElementById('resources-container');
  const countEl = document.getElementById('search-count');
  const filtered = filterItemsList(items);

  if (!filtered.length) {
    container.innerHTML = `<p class="empty-state">${escapeHtml(t('resources.emptySearch'))}</p>`;
    countEl.textContent = formatUiResultsCount(0);
    return;
  }

  countEl.textContent = formatUiResultsCount(filtered.length);

  const grouped = filtered.reduce((acc, item) => {
    const key = item.category;
    if (!acc[key]) {
      acc[key] = { slug: key, name: item.category_name, items: [] };
    }
    acc[key].items.push(item);
    return acc;
  }, {});

  container.innerHTML = Object.values(grouped).map(renderCategorySection).join('');
}

function renderResources() {
  const container = document.getElementById('resources-container');
  const countEl = document.getElementById('search-count');
  countEl.textContent = '';
  isSearchActive = false;

  let categories = applySchemaFilter(resourcesData);

  if (activeCategory) {
    categories = categories.filter((c) => c.slug === activeCategory);
  }

  const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0);

  if (!totalItems) {
    container.innerHTML = `<p class="empty-state">${escapeHtml(t('resources.emptyCategory'))}</p>`;
    return;
  }

  container.innerHTML = categories.map(renderCategorySection).join('');
}

async function refreshResourcesView() {
  resourcesData = await window.satisfactory.getResources();
  categoryOptions = await window.satisfactory.getResourceCategories();
  renderCategorySidebar(resourcesData);

  const searchQuery = document.getElementById('resource-search').value.trim();
  if (searchQuery) {
    isSearchActive = true;
    const results = await window.satisfactory.searchResources(searchQuery);
    renderSearchResults(results);
  } else {
    renderResources();
  }
}

async function loadResources() {
  const container = document.getElementById('resources-container');
  container.innerHTML = `<p class="loading">${escapeHtml(t('common.loadingResources'))}</p>`;

  try {
    await refreshResourcesView();
  } catch (err) {
    container.innerHTML = `<p class="empty-state">${escapeHtml(t('resources.errorLoad'))}</p>`;
    console.error('Resources load error:', err);
  }
}

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
  return Math.max(window.ProductionScale.MACHINE_SLIDER_MAX, fromValue, 1);
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

function isProducerAvailableForLink(producer, consumerStepId, itemSlug, allSteps) {
  if (Number(producer.id) === Number(consumerStepId)) return false;
  if (!(producer.scaled_outputs ?? []).some((output) => output.item_slug === itemSlug)) {
    return false;
  }

  const consumer = allSteps.find((step) => Number(step.id) === Number(consumerStepId));
  if (isProducerLinkedToConsumer(consumer, producer.id, itemSlug)) return true;

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

function getProducerCandidates(allSteps, consumerStepId, itemSlug) {
  return allSteps.filter((candidate) =>
    isProducerAvailableForLink(candidate, consumerStepId, itemSlug, allSteps)
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

function isExtractionAvailableForLink(extraction, consumerStepId, itemSlug, allSteps) {
  if (extraction.item?.slug !== itemSlug || !isExternalSummarySlug(itemSlug)) return false;

  const consumer = allSteps.find((step) => Number(step.id) === Number(consumerStepId));
  if (isExtractionLinkedToConsumer(consumer, extraction.id, itemSlug)) return true;

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
    isExtractionAvailableForLink(candidate, consumerStepId, itemSlug, allSteps)
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

function getExtractionConsumerCandidates(extraction, allSteps) {
  const itemSlug = extraction.item?.slug;
  if (!itemSlug || !isExternalSummarySlug(itemSlug)) return [];

  return allSteps.filter((consumer) =>
    isExtractionConsumerAvailableForLink(consumer, extraction, itemSlug, allSteps)
  );
}

function isExtractionConsumerAvailableForLink(consumer, extraction, itemSlug, allSteps) {
  if (!(consumer.scaled_inputs ?? []).some((io) => io.item_slug === itemSlug)) return false;
  if (isExtractionLinkedToConsumer(consumer, extraction.id, itemSlug)) return true;

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

function renderProductionExternalSummary(steps, extractions = []) {
  const nodesHtml = renderProductionNodesSummary(extractions);
  const mineralsHtml = renderProductionMineralsSummary(steps, extractions);
  const objectivesHtml = steps.length ? renderProductionObjectivesSummary(steps) : '';

  if (!nodesHtml && !mineralsHtml && !objectivesHtml) return '';

  return `<div class="production-external-summary-stack">${objectivesHtml}${nodesHtml}${mineralsHtml}</div>`;
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
    return Math.max(window.ProductionScale?.MACHINE_SLIDER_MAX ?? 100, fromValue, 1);
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
  } else if (field === 'output' || field === 'extraction-output' || field === 'energy-fuel') {
    const fractionalOutput =
      (field === 'output' || field === 'extraction-output') &&
      input.classList.contains('production-config-decimal-input');
    const nudgeStep =
      field === 'output' || field === 'extraction-output'
        ? fractionalOutput
          ? 0.001
          : 1
        : stepSize;
    value = (Number(parseConfigNumberInput(input.value)) || Number(input.value) || 0) + delta * nudgeStep;
    if (!Number.isFinite(value)) value = Math.max(1, delta > 0 ? 1 : 0);
    if (field === 'output' || field === 'extraction-output') {
      value = fractionalOutput
        ? window.ProductionScale.roundProduction(value)
        : Math.round(value);
    }
    if (Number.isFinite(min)) value = Math.max(min, value);
    const max = getConfigInputNudgeMax(input, field, value);
    if (max != null) value = Math.min(max, value);
    formatted =
      field === 'output'
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
          </div>
          ${linkedConsumersSection}
        </div>
        <aside class="production-extraction-building">
          ${buildingImg}
          <span class="production-extraction-building-name">${escapeHtml(extraction.building_name || defaultBuildingName)}</span>
          <span class="production-extraction-building-config">${formatExtractionBuildingConfigContent(extraction, outputUnit)}</span>
          <span class="production-extraction-output">${formatRateWithUnit(outputRate, outputUnit)}</span>
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

  updateExtractionThemeSelects(extractionEl, extraction);
  lockConfigNumberInputsIn(extractionEl, { skipFocused: true });
  lockConfigSlidersIn(extractionEl, { skipFocused: true });
}

Object.assign(window.ProductionUI, {
  updateExtractionConfigDisplay,
  snapProductionSliderValue,
  guardConfigSliderInput,
  getEditableConfigInput,
});

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

function renderProductionDetailContent(detail) {
  cleanupProductionDragArtifacts();
  disposeProductionGraph();

  if (!detail?.chain) {
    productionDetailBody.innerHTML = `<p class="detail-empty">${escapeHtml(t('production.notFound'))}</p>`;
    document.getElementById('production-detail-external-summary').innerHTML = '';
    return;
  }

  const extractions = detail.extractions ?? [];
  const steps = detail.steps ?? [];

  document.getElementById('production-detail-heading').textContent = detail.chain.name;
  document.getElementById('production-detail-breadcrumb').textContent = detail.chain.name;
  document.getElementById('production-detail-meta').textContent = formatProductionDetailMeta(
    extractions.length,
    steps.length
  );
  updateProductionDetailExternalSummary();
  updateProductionGroupTreeButtonVisibility(detail);
  updateProductionTreeButtonState();

  if (isProductionTreeViewMode()) {
    syncChainResourceBalanceCache();
    productionGraphHandle = window.ProductionGraph.renderProductionGraph(
      productionDetailBody,
      detail,
      getProductionGraphHelpers(detail),
      {
        collapseGroups: productionDetailViewMode === 'group-tree',
        groupKey: productionDetailViewMode === 'tree' ? productionTreeGroupKey : null,
        groupLabel:
          productionDetailViewMode === 'tree' && productionTreeGroupKey
            ? getProductionGroupLabel(productionTreeGroupKey)
            : null,
      }
    );
    return;
  }

  const extractionsHtml = renderProductionExtractionsList(extractions, steps);

  const stepsHtml = renderProductionStepsList(steps, steps, detail.group_marks ?? {});

  productionDetailBody.innerHTML = `
    <div class="production-detail-columns">
      <section class="production-extractions-section">
        <h3 class="production-section-header">${escapeHtml(t('production.sectionExtractions'))}</h3>
        ${extractionsHtml}
      </section>
      <section class="production-schemas-section">
        <div class="production-section-header-row">
          <h3 class="production-section-header">${escapeHtml(t('production.sectionResourceSteps'))}</h3>
          <p class="production-group-reorder-hint" hidden>
            ${escapeHtml(t('production.groupReorderHint'))}
          </p>
        </div>
        ${stepsHtml}
      </section>
    </div>`;

  lockConfigNumberInputsIn(productionDetailBody);
  lockConfigSlidersIn(productionDetailBody);
  applyAllProductionGroupViewStates();
  applyAllProductionStepViewStates();
}

function moveProductionGroupAtPointer(movingEl, list, clientY) {
  const without = [...list.querySelectorAll('.production-step-group, .production-step-group-placeholder')].filter(
    (el) => el !== movingEl
  );

  for (const target of without) {
    const rect = target.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      if (movingEl !== target && movingEl.nextElementSibling !== target) {
        list.insertBefore(movingEl, target);
      }
      return target;
    }
  }

  const last = without[without.length - 1];
  if (last && movingEl !== last.nextElementSibling) {
    list.appendChild(movingEl);
  }
  return last ?? null;
}

function updateProductionGroupDropTarget(list, movingEl, clientY) {
  list.querySelectorAll('.production-step-group, .production-step-group-placeholder').forEach((el) => {
    el.classList.remove('production-step-group--drop-target', 'production-step-group--drop-after');
  });

  const without = [...list.querySelectorAll('.production-step-group, .production-step-group-placeholder')].filter(
    (el) => el !== movingEl
  );

  for (const target of without) {
    if (!target.classList.contains('production-step-group')) continue;
    const rect = target.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      target.classList.add('production-step-group--drop-target');
      return;
    }
  }

  const lastGroup = [...without].reverse().find((el) => el.classList.contains('production-step-group'));
  if (lastGroup) {
    lastGroup.classList.add('production-step-group--drop-target', 'production-step-group--drop-after');
  }
}

function startProductionGroupDrag(groupEl, list, handle, e) {
  const rect = groupEl.getBoundingClientRect();

  const placeholder = document.createElement('div');
  placeholder.className = 'production-step-group-placeholder';
  placeholder.style.height = `${rect.height}px`;
  list.insertBefore(placeholder, groupEl);

  const clone = groupEl.cloneNode(true);
  clone.classList.add('production-step-group-clone');
  clone.setAttribute('aria-hidden', 'true');
  clone.style.width = `${rect.width}px`;
  clone.style.left = `${rect.left}px`;
  clone.style.top = `${rect.top}px`;
  document.body.appendChild(clone);

  groupEl.classList.add('production-step-group--drag-hidden');

  productionGroupDragState = {
    groupEl,
    list,
    handle,
    placeholder,
    clone,
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    didMove: false,
  };

  document.body.classList.add('production-step-drag-active');
  handle.setPointerCapture(e.pointerId);
}

function updateProductionGroupDrag(e) {
  if (!productionGroupDragState || productionGroupDragState.pointerId !== e.pointerId) return;

  const { clone, placeholder, list, startX, startY } = productionGroupDragState;
  const deltaX = e.clientX - startX;
  const deltaY = e.clientY - startY;

  if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
    productionGroupDragState.didMove = true;
  }

  clone.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
  moveProductionGroupAtPointer(placeholder, list, e.clientY);
  updateProductionGroupDropTarget(list, placeholder, e.clientY);
}

async function saveProductionGroupOrder(list) {
  const groupKeys = [...list.querySelectorAll('.production-step-group')].map(
    (el) => el.dataset.groupKey
  );
  if (!activeProductionChainId || groupKeys.length < 2) return;

  try {
    activeProductionDetail = await window.satisfactory.reorderProductionChainGroups(
      activeProductionChainId,
      groupKeys
    );
  } catch (err) {
    console.error('Reorder production groups error:', err);
    await refreshProductionDetail();
  }
}

function moveProductionStepAtPointer(movingEl, list, clientY) {
  const without = [...list.querySelectorAll('.production-step, .production-step-placeholder')].filter(
    (el) => el !== movingEl
  );

  for (const target of without) {
    const rect = target.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      if (movingEl !== target && movingEl.nextElementSibling !== target) {
        list.insertBefore(movingEl, target);
      }
      return target;
    }
  }

  const last = without[without.length - 1];
  if (last && movingEl !== last.nextElementSibling) {
    list.appendChild(movingEl);
  }
  return last ?? null;
}

function updateProductionDropTarget(list, movingEl, clientY) {
  list.querySelectorAll('.production-step, .production-step-placeholder').forEach((el) => {
    el.classList.remove('production-step--drop-target', 'production-step--drop-after');
  });

  const without = [...list.querySelectorAll('.production-step, .production-step-placeholder')].filter(
    (el) => el !== movingEl
  );

  for (const target of without) {
    if (!target.classList.contains('production-step')) continue;
    const rect = target.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      target.classList.add('production-step--drop-target');
      return;
    }
  }

  const lastStep = [...without].reverse().find((el) => el.classList.contains('production-step'));
  if (lastStep) {
    lastStep.classList.add('production-step--drop-target', 'production-step--drop-after');
  }
}

function startProductionStepDrag(stepEl, list, handle, e) {
  const rect = stepEl.getBoundingClientRect();

  const placeholder = document.createElement('div');
  placeholder.className = 'production-step-placeholder';
  placeholder.style.height = `${rect.height}px`;
  list.insertBefore(placeholder, stepEl);

  const clone = stepEl.cloneNode(true);
  clone.classList.add('production-step-clone');
  clone.setAttribute('aria-hidden', 'true');
  clone.style.width = `${rect.width}px`;
  clone.style.left = `${rect.left}px`;
  clone.style.top = `${rect.top}px`;
  document.body.appendChild(clone);

  stepEl.classList.add('production-step--drag-hidden');

  productionStepDragState = {
    stepEl,
    list,
    handle,
    placeholder,
    clone,
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    didMove: false,
  };

  document.body.classList.add('production-step-drag-active');
  handle.setPointerCapture(e.pointerId);
}

function updateProductionStepDrag(e) {
  if (!productionStepDragState || productionStepDragState.pointerId !== e.pointerId) return;

  const { clone, placeholder, list, startX, startY } = productionStepDragState;
  const deltaX = e.clientX - startX;
  const deltaY = e.clientY - startY;

  if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
    productionStepDragState.didMove = true;
  }

  clone.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
  moveProductionStepAtPointer(placeholder, list, e.clientY);
  updateProductionDropTarget(list, placeholder, e.clientY);
}

async function saveProductionStepOrder(list) {
  const groupEl = list.closest('.production-step-group');
  const groupKey =
    groupEl?.dataset.groupKey ??
    list.dataset.groupKey ??
    PRODUCTION_GROUP_KEY_UNGROUPED;
  const groupName = groupKey === PRODUCTION_GROUP_KEY_UNGROUPED ? null : groupKey;

  const stepIds = [...list.querySelectorAll('.production-step')].map((el) =>
    Number(el.dataset.stepId)
  );
  if (!activeProductionChainId || !stepIds.length) return;

  try {
    activeProductionDetail = await window.satisfactory.reorderProductionChainStepsInGroup(
      activeProductionChainId,
      groupName,
      stepIds
    );
    activeProductionDetail.steps.forEach((step) => {
      const el = list.querySelector(`.production-step[data-step-id="${step.id}"]`);
      if (el) el.dataset.sortOrder = step.sort_order;
    });
  } catch (err) {
    console.error('Reorder production steps error:', err);
    await refreshProductionDetail();
  }
}

async function handleProductionStepGroupRename(groupKey, newName) {
  if (!activeProductionChainId || !groupKey) return;

  const normalizedNew = normalizeProductionGroupName(newName);
  if (!normalizedNew) {
    throw new Error(t('errors.groupNameRequired'));
  }

  activeProductionDetail = await window.satisfactory.renameProductionStepGroup(
    activeProductionChainId,
    groupKey,
    normalizedNew
  );
  migrateProductionGroupPersistedKeys(activeProductionChainId, groupKey, normalizedNew);
  renderProductionDetailContent(activeProductionDetail);
}

async function handleProductionStepGroupChange(stepId, value) {
  if (value === '__new__') {
    openSchemaRenameModal({
      kind: 'step-group',
      id: stepId,
      name: '',
      title: t('confirm.newGroupTitle'),
    });
    return;
  }

  try {
    activeProductionDetail = await window.satisfactory.setProductionStepGroupName(
      stepId,
      value || null
    );
    renderProductionDetailContent(activeProductionDetail);
  } catch (err) {
    console.error('Set production step group error:', err);
  }
}

async function handleStepLinkChange(checkbox) {
  const consumerStepId = Number(checkbox.dataset.consumerStepId);
  const itemSlug = checkbox.dataset.itemSlug;
  const stepEl = getProductionStepElement(consumerStepId);
  if (!stepEl) return;

  const checkboxes = stepEl.querySelectorAll('.production-link-checkbox');
  const producerIds = [...checkboxes]
    .filter((input) => input.dataset.itemSlug === itemSlug && input.checked)
    .map((input) => Number(input.dataset.producerStepId));

  try {
    activeProductionDetail = await window.satisfactory.setProductionStepInputLinks(
      consumerStepId,
      itemSlug,
      producerIds
    );
    renderProductionDetailContent(activeProductionDetail);
  } catch (err) {
    checkbox.checked = !checkbox.checked;
    console.error('Set step links error:', err);
  }
}

async function handleExtractionConsumerLinkChange(checkbox) {
  const consumerStepId = Number(checkbox.dataset.consumerStepId);
  const extractionId = Number(checkbox.dataset.extractionId);
  const itemSlug = checkbox.dataset.itemSlug;

  const consumer = activeProductionDetail?.steps?.find(
    (step) => Number(step.id) === consumerStepId
  );
  const currentIds = (consumer?.input_links?.[itemSlug] ?? [])
    .filter((link) => link.producer_extraction_id)
    .map((link) => Number(link.producer_extraction_id));

  const nextIds = checkbox.checked
    ? [...new Set([...currentIds, extractionId])]
    : currentIds.filter((id) => id !== extractionId);

  try {
    activeProductionDetail = await window.satisfactory.setProductionStepExtractionLinks(
      consumerStepId,
      itemSlug,
      nextIds
    );
    renderProductionDetailContent(activeProductionDetail);
  } catch (err) {
    checkbox.checked = !checkbox.checked;
    console.error('Set extraction consumer links error:', err);
  }
}

async function handleExtractionLinkChange(checkbox) {
  const consumerStepId = Number(checkbox.dataset.consumerStepId);
  const itemSlug = checkbox.dataset.itemSlug;
  const stepEl = getProductionStepElement(consumerStepId);
  if (!stepEl) return;

  const checkboxes = stepEl.querySelectorAll('.production-extraction-link-checkbox');
  const extractionIds = [...checkboxes]
    .filter((input) => input.dataset.itemSlug === itemSlug && input.checked)
    .map((input) => Number(input.dataset.producerExtractionId));

  try {
    activeProductionDetail = await window.satisfactory.setProductionStepExtractionLinks(
      consumerStepId,
      itemSlug,
      extractionIds
    );
    renderProductionDetailContent(activeProductionDetail);
  } catch (err) {
    checkbox.checked = !checkbox.checked;
    console.error('Set extraction links error:', err);
  }
}

async function openProductionDetail(chainId) {
  activeProductionChainId = chainId;
  activeProductionDetail = null;
  productionDetailViewMode = 'editor';
  productionTreeGroupKey = null;
  hydrateProductionUiStateMaps(chainId);
  productionDetailBody.innerHTML = `<p class="loading">${escapeHtml(t('common.loading'))}</p>`;
  document.getElementById('production-detail-heading').textContent = '—';
  document.getElementById('production-detail-breadcrumb').textContent = '—';
  document.getElementById('production-detail-meta').textContent = '';
  document.getElementById('production-detail-external-summary').innerHTML = '';
  switchView('production-detail');

  try {
    if (!pickerResourcesData.length) {
      await ensurePickerResourcesData();
    }
    activeProductionDetail = await window.satisfactory.getProductionChainDetail(chainId);
    renderProductionDetailContent(activeProductionDetail);
  } catch (err) {
    productionDetailBody.innerHTML = `<p class="detail-empty">${escapeHtml(t('production.errorDetailLoad'))}</p>`;
    console.error('Production detail error:', err);
  }
}

function closeProductionDetail() {
  cleanupProductionDragArtifacts();
  disposeProductionGraph();
  persistProductionUiState(activeProductionChainId);
  productionDetailViewMode = 'editor';
  productionTreeGroupKey = null;
  switchView('production');
  loadProductionChainSummaries()
    .then(() => renderProductionChains())
    .catch(console.error);
}

function renderExtractionPickerItem(item) {
  return `
    <button type="button" class="picker-item" data-id="${item.id}">
      ${renderItemImage(item)}
      <span>${escapeHtml(item.name)}</span>
    </button>`;
}

function renderExtractionPickerList(categories) {
  const mineralCategory = categories.find((cat) => cat.slug === 'minerali');
  const liquidiCategory = categories.find((cat) => cat.slug === 'liquidi');
  const mineralItems = mineralCategory?.items ?? [];
  const liquidItems = (liquidiCategory?.items ?? []).filter((item) =>
    EXTRACTION_LIQUID_SLUGS.includes(item.slug)
  );
  const total = mineralItems.length + liquidItems.length;
  const countEl = document.getElementById('resource-picker-count');
  countEl.textContent = formatUiResourcesCount(total);

  if (!total) {
    document.getElementById('resource-picker-list').innerHTML =
      `<p class="empty-state">${escapeHtml(t('errors.pickerExtractEmpty'))}</p>`;
    return;
  }

  const sections = [];

  if (mineralItems.length) {
    sections.push(`
      <section class="picker-category">
        <h4>${escapeHtml(mineralCategory.name)}</h4>
        <div class="picker-grid">
          ${mineralItems.map(renderExtractionPickerItem).join('')}
        </div>
      </section>`);
  }

  if (liquidItems.length) {
    sections.push(`
      <section class="picker-category">
        <h4>${escapeHtml(t('production.groupLiquids'))}</h4>
        <div class="picker-grid">
          ${liquidItems.map(renderExtractionPickerItem).join('')}
        </div>
      </section>`);
  }

  document.getElementById('resource-picker-list').innerHTML = sections.join('');
}

function renderMineralPickerItem(item) {
  return renderExtractionPickerItem(item);
}

function renderMineralPickerList(categories) {
  renderExtractionPickerList(categories);
}

function renderResourcePickerItem(item) {
  const hasSchemas = Number(item.schema_count) > 0;
  return `
    <button
      type="button"
      class="picker-item ${hasSchemas ? '' : 'picker-item--disabled'}"
      data-id="${item.id}"
      ${hasSchemas ? '' : 'disabled'}
    >
      ${renderItemImage(item)}
      <span>${escapeHtml(item.name)}</span>
      ${hasSchemas ? '' : `<span class="picker-item-note">${escapeHtml(t('modals.pickerNoSchema'))}</span>`}
    </button>`;
}

function renderResourcePickerCategories(categories) {
  const countEl = document.getElementById('resource-picker-count');
  const total = categories.reduce((sum, cat) => sum + cat.items.length, 0);
  countEl.textContent = `${total} risorse`;

  if (!total) {
    return `<p class="empty-state">${escapeHtml(t('picker.noResources'))}</p>`;
  }

  return categories
    .filter((cat) => cat.items.length)
    .map(
      (cat) => `
      <section class="picker-category">
        <h4>${escapeHtml(cat.name)}</h4>
        <div class="picker-grid">
          ${cat.items.map(renderResourcePickerItem).join('')}
        </div>
      </section>`
    )
    .join('');
}

function renderResourcePickerSearchResults(items) {
  const countEl = document.getElementById('resource-picker-count');
  countEl.textContent = formatUiResultsCount(items.length);

  if (!items.length) {
    return `<p class="empty-state">${escapeHtml(t('picker.noResources'))}</p>`;
  }

  const grouped = items.reduce((acc, item) => {
    const key = item.category;
    if (!acc[key]) {
      acc[key] = { name: item.category_name || key, items: [] };
    }
    acc[key].items.push(item);
    return acc;
  }, {});

  return Object.values(grouped)
    .map(
      (cat) => `
      <section class="picker-category">
        <h4>${escapeHtml(cat.name)}</h4>
        <div class="picker-grid">
          ${cat.items.map(renderResourcePickerItem).join('')}
        </div>
      </section>`
    )
    .join('');
}

function renderMineralPickerList(categories) {
  renderExtractionPickerList(categories);
}

function renderResourcePickerList(categories) {
  if (resourcePickerMode === 'extraction') {
    renderExtractionPickerList(categories);
    return;
  }

  document.getElementById('resource-picker-list').innerHTML =
    renderResourcePickerCategories(categories);
}

async function openExtractionPickerModal() {
  resourcePickerMode = 'extraction';
  document.getElementById('resource-picker-modal-title').textContent = t('modals.selectResourceExtract');
  document.getElementById('resource-picker-search').value = '';
  document.getElementById('resource-picker-count').textContent = '';
  document.getElementById('resource-picker-list').innerHTML =
    `<p class="loading">${escapeHtml(t('common.loadingResources'))}</p>`;
  resourcePickerModal.classList.remove('hidden');
  resourcePickerModal.setAttribute('aria-hidden', 'false');

  try {
    if (!pickerResourcesData.length) {
      pickerResourcesData = await window.satisfactory.getResources();
    }
    renderExtractionPickerList(pickerResourcesData);
    document.getElementById('resource-picker-search').focus();
  } catch (err) {
    document.getElementById('resource-picker-list').innerHTML =
      `<p class="empty-state">${escapeHtml(t('resources.errorLoad'))}</p>`;
    console.error('Extraction picker load error:', err);
  }
}

async function openMineralPickerModal() {
  openExtractionPickerModal();
}

async function openResourcePickerModal() {
  pendingInsertAfterStepId = null;
  resourcePickerMode = 'step';
  document.getElementById('resource-picker-modal-title').textContent = t('modals.selectResource');
  document.getElementById('resource-picker-search').value = '';
  document.getElementById('resource-picker-count').textContent = '';
  document.getElementById('resource-picker-list').innerHTML =
    `<p class="loading">${escapeHtml(t('common.loadingResources'))}</p>`;
  resourcePickerModal.classList.remove('hidden');
  resourcePickerModal.setAttribute('aria-hidden', 'false');

  try {
    if (!pickerResourcesData.length) {
      pickerResourcesData = await window.satisfactory.getResources();
    }
    renderResourcePickerList(pickerResourcesData);
    document.getElementById('resource-picker-search').focus();
  } catch (err) {
    document.getElementById('resource-picker-list').innerHTML =
      `<p class="empty-state">${escapeHtml(t('resources.errorLoad'))}</p>`;
    console.error('Resource picker load error:', err);
  }
}

function closeResourcePickerModal() {
  resourcePickerModal.classList.add('hidden');
  resourcePickerModal.setAttribute('aria-hidden', 'true');
  pendingPickerItemId = null;
  resourcePickerMode = 'step';
}

function renderSelectableCraftSchema(schema) {
  return `
    <button type="button" class="picker-schema-btn" data-schema-id="${schema.id}">
      ${renderCraftSchema(schema, schema.is_alternative, { compact: true })}
    </button>`;
}

function openSchemaPickerModal(item, schemas) {
  pendingPickerItemId = item.id;
  document.getElementById('schema-picker-modal-title').textContent = t('modals.selectSchemaFor', {
    name: item.name,
  });
  document.getElementById('schema-picker-item-meta').textContent = t('modals.selectSchemaAltHint');

  const imgEl = document.getElementById('schema-picker-item-image');
  if (item.image) {
    imgEl.src = item.image;
    imgEl.alt = item.name;
    imgEl.hidden = false;
  } else {
    imgEl.hidden = true;
  }

  document.getElementById('schema-picker-list').innerHTML = schemas
    .map(renderSelectableCraftSchema)
    .join('');
  schemaPickerModal.classList.remove('hidden');
  schemaPickerModal.setAttribute('aria-hidden', 'false');
}

function closeSchemaPickerModal() {
  schemaPickerModal.classList.add('hidden');
  schemaPickerModal.setAttribute('aria-hidden', 'true');
  pendingPickerItemId = null;
  pendingInsertAfterStepId = null;
}

async function refreshProductionDetail() {
  if (!activeProductionChainId) return;

  activeProductionDetail = await window.satisfactory.getProductionChainDetail(
    activeProductionChainId
  );
  renderProductionDetailContent(activeProductionDetail);
}

async function addProductionStep(itemId, schemaId) {
  if (!activeProductionChainId) return;

  const insertAfterStepId = pendingInsertAfterStepId;
  pendingInsertAfterStepId = null;
  const sourceStep = insertAfterStepId
    ? activeProductionDetail?.steps?.find((step) => step.id === insertAfterStepId)
    : null;

  try {
    const newStep = await window.satisfactory.addProductionChainStep(activeProductionChainId, {
      item_id: itemId,
      item_schema_id: schemaId,
      group_name: sourceStep?.group_name ?? null,
    });

    if (insertAfterStepId && newStep?.id && activeProductionDetail?.steps?.length) {
      const currentIds = activeProductionDetail.steps.map((step) => step.id);
      const insertIndex = currentIds.indexOf(insertAfterStepId);
      if (insertIndex >= 0) {
        const newOrder = [
          ...currentIds.slice(0, insertIndex + 1),
          newStep.id,
          ...currentIds.slice(insertIndex + 1),
        ];
        await window.satisfactory.reorderProductionChainSteps(activeProductionChainId, newOrder);
      }
    }

    closeSchemaPickerModal();
    closeResourcePickerModal();
    await refreshProductionDetail();
  } catch (err) {
    console.error('Add production step error:', err);
  }
}

async function handleResourceSelection(itemId) {
  if (resourcePickerMode === 'extraction') {
    await addMineralExtractionFromPicker(itemId);
    return;
  }

  try {
    await addProductionStepForItem(itemId);
  } catch (err) {
    console.error('Resource selection error:', err);
  }
}

async function loadProductionChains() {
  const container = document.getElementById('production-container');
  container.innerHTML = `<p class="loading">${escapeHtml(t('common.loadingSchemas'))}</p>`;

  try {
    productionChains = await window.satisfactory.getProductionChains();
    await loadProductionChainSummaries();
    renderProductionChains();
  } catch (err) {
    container.innerHTML =
      `<p class="empty-state">${escapeHtml(t('production.errorLoadList'))}</p>`;
    console.error('Production load error:', err);
  }
}

function showProductionCreateError(message) {
  productionCreateError.textContent = message;
  productionCreateError.classList.remove('hidden');
}

function hideProductionCreateError() {
  productionCreateError.textContent = '';
  productionCreateError.classList.add('hidden');
}

function openProductionCreateModal() {
  hideProductionCreateError();
  productionCreateForm.reset();
  productionCreateModal.classList.remove('hidden');
  productionCreateModal.setAttribute('aria-hidden', 'false');
  document.getElementById('production-chain-name').focus();
}

function closeProductionCreateModal() {
  productionCreateModal.classList.add('hidden');
  productionCreateModal.setAttribute('aria-hidden', 'true');
  hideProductionCreateError();
}

function showSchemaRenameError(message) {
  schemaRenameError.textContent = message;
  schemaRenameError.classList.remove('hidden');
}

function hideSchemaRenameError() {
  schemaRenameError.textContent = '';
  schemaRenameError.classList.add('hidden');
}

function openSchemaRenameModal({ kind, id, name, title, onSaved, groupKey }) {
  hideSchemaRenameError();
  document.getElementById('schema-rename-id').value = String(id);
  document.getElementById('schema-rename-kind').value = kind;
  document.getElementById('schema-rename-name').value = name ?? '';
  document.getElementById('schema-rename-modal-title').textContent =
    title ??
    (kind === 'energy'
      ? t('modals.renameEnergyPlan')
      : kind === 'step-group' || kind === 'rename-step-group'
        ? t('modals.renameGroup')
        : t('modals.renameProductionPlan'));
  schemaRenameOnSaved = typeof onSaved === 'function' ? onSaved : null;
  schemaRenameGroupKey = groupKey ?? null;
  schemaRenameModal.classList.remove('hidden');
  schemaRenameModal.setAttribute('aria-hidden', 'false');
  document.getElementById('schema-rename-name').focus();
  document.getElementById('schema-rename-name').select();
}

function closeSchemaRenameModal() {
  schemaRenameModal.classList.add('hidden');
  schemaRenameModal.setAttribute('aria-hidden', 'true');
  hideSchemaRenameError();
  schemaRenameOnSaved = null;
  schemaRenameGroupKey = null;
}

function setupSchemaRenameModal() {
  document.getElementById('schema-rename-modal-close').addEventListener('click', closeSchemaRenameModal);
  document.getElementById('schema-rename-cancel').addEventListener('click', closeSchemaRenameModal);
  schemaRenameModal.addEventListener('click', (e) => {
    if (e.target === schemaRenameModal) closeSchemaRenameModal();
  });

  schemaRenameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideSchemaRenameError();

    const kind = document.getElementById('schema-rename-kind').value;
    const id = Number(document.getElementById('schema-rename-id').value);
    const name = document.getElementById('schema-rename-name').value.trim();
    if (!name) {
      showSchemaRenameError(t('errors.nameRequired'));
      return;
    }

    try {
      if (kind === 'step-group') {
        activeProductionDetail = await window.satisfactory.setProductionStepGroupName(id, name);
        renderProductionDetailContent(activeProductionDetail);
        schemaRenameOnSaved?.(activeProductionDetail);
        closeSchemaRenameModal();
        return;
      }

      if (kind === 'rename-step-group') {
        await handleProductionStepGroupRename(schemaRenameGroupKey, name);
        schemaRenameOnSaved?.(activeProductionDetail);
        closeSchemaRenameModal();
        return;
      }

      const updated =
        kind === 'energy'
          ? await window.satisfactory.updateEnergyChain(id, { name })
          : await window.satisfactory.updateProductionChain(id, { name });
      schemaRenameOnSaved?.(updated);
      closeSchemaRenameModal();
    } catch (err) {
      showSchemaRenameError(err.message || t('errors.saveFailed'));
    }
  });
}

window.openSchemaRenameModal = openSchemaRenameModal;

function setupProductionUiStatePersistence() {
  const flushProductionUiState = () => {
    persistProductionUiState(activeProductionChainId);
  };

  window.addEventListener('beforeunload', flushProductionUiState);
  window.addEventListener('pagehide', flushProductionUiState);
}

function setupProduction() {
  document.addEventListener('mousedown', handleThemeSelectOutsidePointer, true);

  document.getElementById('btn-new-production').addEventListener('click', openProductionCreateModal);
  document.getElementById('btn-import-production').addEventListener('click', async () => {
    try {
      const result = await window.satisfactory.importProductionChain();
      if (result?.canceled || !result?.chain) return;
      productionChains = [result.chain, ...productionChains.filter((item) => item.id !== result.chain.id)];
      await loadProductionChainSummaries();
      renderProductionChains();
    } catch (err) {
      console.error('Production import error:', err);
        window.alert?.(err.message || t('errors.importFailed'));
    }
  });
  document.getElementById('production-create-modal-close').addEventListener('click', closeProductionCreateModal);
  document.getElementById('production-create-cancel').addEventListener('click', closeProductionCreateModal);

  productionCreateModal.addEventListener('click', (e) => {
    if (e.target === productionCreateModal) closeProductionCreateModal();
  });

  document.getElementById('production-container').addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.production-edit-btn');
    if (editBtn) {
      e.preventDefault();
      e.stopPropagation();

      const chainId = Number(editBtn.dataset.id);
      const chain = productionChains.find((item) => item.id === chainId);
      if (!chain) return;

      openSchemaRenameModal({
        kind: 'production',
        id: chainId,
        name: chain.name,
        onSaved: (updated) => {
          const index = productionChains.findIndex((item) => item.id === chainId);
          if (index >= 0) productionChains[index] = updated;
          if (activeProductionDetail?.chain?.id === chainId) {
            activeProductionDetail.chain.name = updated.name;
            document.getElementById('production-detail-heading').textContent = updated.name;
            document.getElementById('production-detail-breadcrumb').textContent = updated.name;
          }
          renderProductionChains();
        },
      });
      return;
    }

    const duplicateBtn = e.target.closest('.production-duplicate-btn');
    if (duplicateBtn) {
      e.preventDefault();
      e.stopPropagation();

      const chainId = Number(duplicateBtn.dataset.id);
      const chain = productionChains.find((item) => item.id === chainId);
      if (!chain) return;

      try {
        const copied = await window.satisfactory.duplicateProductionChain(chainId);
        productionChains = [copied, ...productionChains.filter((item) => item.id !== copied.id)];
        await loadProductionChainSummaries();
        renderProductionChains();
      } catch (err) {
        console.error('Production duplicate error:', err);
      }
      return;
    }

    const exportBtn = e.target.closest('.production-export-btn');
    if (exportBtn) {
      e.preventDefault();
      e.stopPropagation();

      const chainId = Number(exportBtn.dataset.id);
      const chain = productionChains.find((item) => item.id === chainId);
      if (!chain) return;

      try {
        await window.satisfactory.exportProductionChain(chainId);
      } catch (err) {
        console.error('Production export error:', err);
      }
      return;
    }

    const deleteBtn = e.target.closest('.production-delete-btn');
    if (deleteBtn) {
      e.preventDefault();
      e.stopPropagation();

      const chainId = Number(deleteBtn.dataset.id);
      const chain = productionChains.find((item) => item.id === chainId);
      if (!chain) return;

      const confirmed = await showConfirm({
        title: t('confirm.deletePlanTitle'),
        message: t('confirm.deletePlanMessage', { name: chain.name }),
        confirmLabel: t('actions.delete'),
      });
      if (!confirmed) return;

      try {
        await window.satisfactory.deleteProductionChain(chainId);
        productionChains = productionChains.filter((item) => item.id !== chainId);
        productionChainSummaries.delete(chainId);
        renderProductionChains();
      } catch (err) {
        console.error('Production delete error:', err);
      }
      return;
    }

    const openTarget = e.target.closest('.production-card-body');
    if (openTarget) {
      openProductionDetail(Number(openTarget.dataset.id));
    }
  });

  document.getElementById('production-detail-back').addEventListener('click', closeProductionDetail);
  document.getElementById('btn-production-tree-view').addEventListener('click', toggleProductionTreeView);
  document
    .getElementById('btn-production-group-tree-view')
    .addEventListener('click', toggleProductionGroupTreeView);
  document.getElementById('btn-add-resource-step').addEventListener('click', openResourcePickerModal);
  document.getElementById('btn-add-extraction').addEventListener('click', openExtractionPickerModal);

  productionDetailBody.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;

    const slider = e.target.closest('.production-config-slider');
    if (slider && isConfigSlider(slider) && isConfigSliderLocked(slider)) {
      activateConfigSlider(slider);
      return;
    }

    const groupHandle = e.target.closest('.production-step-group-drag-handle');
    if (groupHandle && canReorderProductionGroups() && !productionGroupDragState && !productionStepDragState) {
      const groupEl = groupHandle.closest('.production-step-group');
      const list = groupEl?.closest('#production-steps-list');
      if (!groupEl || !list) return;

      e.preventDefault();
      startProductionGroupDrag(groupEl, list, groupHandle, e);
      return;
    }

    const handle = e.target.closest('.production-step-drag-handle:not(.production-step-group-drag-handle)');
    if (!handle) return;

    const stepEl = handle.closest('.production-step');
    const list = stepEl?.closest('.production-step-group-body');
    if (!stepEl || !list || productionStepDragState) return;

    e.preventDefault();
    startProductionStepDrag(stepEl, list, handle, e);
  });

  productionDetailBody.addEventListener('pointermove', (e) => {
    if (productionGroupDragState?.pointerId === e.pointerId) {
      e.preventDefault();
      updateProductionGroupDrag(e);
      return;
    }
    if (!productionStepDragState || productionStepDragState.pointerId !== e.pointerId) return;
    e.preventDefault();
    updateProductionStepDrag(e);
  });

  const finishProductionGroupDrag = async (e) => {
    if (!productionGroupDragState || productionGroupDragState.pointerId !== e.pointerId) return;

    const { groupEl, list, handle, placeholder, clone, didMove } = productionGroupDragState;

    try {
      handle.releasePointerCapture(e.pointerId);
    } catch (_) {
      /* pointer already released */
    }

    if (placeholder && groupEl) {
      list.insertBefore(groupEl, placeholder);
    }

    clone?.remove();
    placeholder?.remove();
    groupEl?.classList.remove('production-step-group--drag-hidden');

    list?.querySelectorAll('.production-step-group').forEach((el) => {
      el.classList.remove('production-step-group--drop-target', 'production-step-group--drop-after');
    });

    document.body.classList.remove('production-step-drag-active');
    productionGroupDragState = null;

    if (didMove && list) {
      await saveProductionGroupOrder(list);
    }

    updateProductionGroupReorderUi();
  };

  const finishProductionStepDrag = async (e) => {
    if (!productionStepDragState || productionStepDragState.pointerId !== e.pointerId) return;

    const { stepEl, list, handle, placeholder, clone, didMove } = productionStepDragState;

    try {
      handle.releasePointerCapture(e.pointerId);
    } catch (_) {
      /* pointer already released */
    }

    if (placeholder && stepEl) {
      list.insertBefore(stepEl, placeholder);
    }

    clone?.remove();
    placeholder?.remove();
    stepEl?.classList.remove('production-step--dragging', 'production-step--drag-hidden');

    list?.querySelectorAll('.production-step').forEach((el) => {
      el.classList.remove('production-step--drop-target', 'production-step--drop-after');
    });

    document.body.classList.remove('production-step-drag-active');
    productionStepDragState = null;

    if (didMove && list) {
      await saveProductionStepOrder(list);
    }
  };

  productionDetailBody.addEventListener('pointerup', finishProductionGroupDrag);
  productionDetailBody.addEventListener('pointercancel', finishProductionGroupDrag);
  productionDetailBody.addEventListener('pointerup', finishProductionStepDrag);
  productionDetailBody.addEventListener('pointercancel', finishProductionStepDrag);

  productionDetailBody.addEventListener('pointerup', (e) => {
    if (e.button !== 0) return;
    lockActiveConfigSlidersOutsidePointer(e.clientX, e.clientY);
  });

  productionDetailBody.addEventListener('pointerleave', (e) => {
    const field = e.target.closest('.production-config-field');
    if (!field || e.target !== field) return;
    const slider = field.querySelector('.production-config-slider');
    if (!slider || !isConfigSlider(slider)) return;
    if (e.buttons !== 0) return;
    if (field.contains(e.relatedTarget)) return;
    deactivateConfigSlider(slider);
  });

  productionDetailBody.addEventListener('focusin', (e) => {
    const slider = e.target.closest('.production-config-slider');
    if (slider && isConfigSlider(slider)) {
      activateConfigSlider(slider);
      return;
    }

    const input = getEditableConfigInput(e.target);
    if (!input) return;
    rememberConfigInputValue(input);
    activateConfigNumberInput(input);
  });

  productionDetailBody.addEventListener('focusout', (e) => {
    const slider = e.target.closest('.production-config-slider');
    if (slider && isConfigSlider(slider)) {
      window.setTimeout(() => {
        if (document.activeElement === slider) return;
        deactivateConfigSlider(slider);
      }, 0);
      return;
    }

    const input = getEditableConfigInput(e.target);
    if (!input) return;
    window.setTimeout(() => {
      if (document.activeElement === input) return;
      lockConfigNumberInput(input);
    }, 0);
  });

  productionDetailBody.addEventListener('input', (e) => {
    const configInput = resolveConfigNumberInput(e.target);
    if (configInput && normalizeConfigInputSpinnerStep(configInput, e)) return;

    const outputSlider = e.target.closest('.production-output-slider');
    if (outputSlider) {
      guardConfigSliderInput(outputSlider, () => handleProductionSliderInput(outputSlider, 'output'));
      return;
    }

    const overclockSlider = e.target.closest('.production-overclock-slider');
    if (overclockSlider) {
      guardConfigSliderInput(overclockSlider, () =>
        handleProductionSliderInput(overclockSlider, 'overclock')
      );
      return;
    }

    const machinesSlider = e.target.closest('.production-machines-slider');
    if (machinesSlider) {
      guardConfigSliderInput(machinesSlider, () =>
        handleProductionSliderInput(machinesSlider, 'machines')
      );
      return;
    }

    const extractionOverclockSlider = e.target.closest('.production-extraction-overclock-slider');
    if (extractionOverclockSlider) {
      guardConfigSliderInput(extractionOverclockSlider, () =>
        handleExtractionSliderInput(extractionOverclockSlider, 'overclock')
      );
      return;
    }

    const extractionOutputSlider = e.target.closest('.production-extraction-output-slider');
    if (extractionOutputSlider) {
      guardConfigSliderInput(extractionOutputSlider, () =>
        handleExtractionSliderInput(extractionOutputSlider, 'output')
      );
      return;
    }

    const extractionNodesSlider = e.target.closest('.production-extraction-nodes-slider');
    if (extractionNodesSlider) {
      guardConfigSliderInput(extractionNodesSlider, () =>
        handleExtractionSliderInput(extractionNodesSlider, 'nodes')
      );
    }
  });

  productionDetailBody.addEventListener('change', (e) => {
    const configInput = resolveConfigNumberInput(e.target);
    const field = configInput ? getConfigInputField(configInput) : null;
    if (field) {
      commitConfigInputFromField(configInput, field);
      rememberConfigInputValue(configInput);
      return;
    }
  });

  productionDetailBody.addEventListener(
    'wheel',
    (e) => {
      const slider = e.target.closest('.production-config-slider');
      if (!slider || !isConfigSlider(slider)) return;
      if (isConfigSliderLocked(slider) || document.activeElement !== slider) return;
      e.preventDefault();
      nudgeProductionSlider(slider, e.deltaY < 0 ? 1 : -1);
    },
    { passive: false }
  );

  productionDetailBody.addEventListener('change', (e) => {
    const somersloopCheckbox = e.target.closest('.production-somersloop-checkbox');
    if (somersloopCheckbox) {
      handleSomersloopChange(Number(somersloopCheckbox.dataset.stepId));
      return;
    }

    const stepMarkCheckbox = e.target.closest(
      '.production-step-mark-checkbox, .production-graph-step-mark-checkbox'
    );
    if (stepMarkCheckbox) {
      handleStepMarkedChange(Number(stepMarkCheckbox.dataset.stepId), stepMarkCheckbox.checked);
      return;
    }

    const groupMarkCheckbox = e.target.closest('.production-step-group-mark-checkbox');
    if (groupMarkCheckbox) {
      handleProductionGroupMarkedChange(groupMarkCheckbox.dataset.groupKey, groupMarkCheckbox.checked);
      return;
    }

    const checkbox = e.target.closest('.production-link-checkbox');
    if (checkbox) {
      handleStepLinkChange(checkbox);
      return;
    }

    const extractionCheckbox = e.target.closest('.production-extraction-link-checkbox');
    if (extractionCheckbox) {
      handleExtractionLinkChange(extractionCheckbox);
      return;
    }

    const extractionConsumerCheckbox = e.target.closest(
      '.production-extraction-consumer-link-checkbox'
    );
    if (extractionConsumerCheckbox) {
      handleExtractionConsumerLinkChange(extractionConsumerCheckbox);
    }
  });

  productionDetailBody.addEventListener('click', (e) => {
    const inputAddTrigger = e.target.closest('.production-input-add-trigger');
    if (inputAddTrigger) {
      e.preventDefault();
      e.stopPropagation();
      const sourceStepEl = inputAddTrigger.closest('.production-step');
      pendingInsertAfterStepId = sourceStepEl ? Number(sourceStepEl.dataset.stepId) : null;
      addProductionStepForInputSlug(inputAddTrigger.dataset.itemSlug);
      return;
    }

    const themeSelectOption = e.target.closest('.theme-select-option');
    if (themeSelectOption) {
      e.preventDefault();
      e.stopPropagation();
      const select = themeSelectOption.closest('.theme-select');
      if (select?.dataset.field === 'step-group' && select.dataset.stepId) {
        handleProductionStepGroupChange(
          Number(select.dataset.stepId),
          themeSelectOption.dataset.value
        );
        closeAllThemeSelects();
        return;
      }
      if (!select?.dataset.extractionId || !select.dataset.field) return;

      handleExtractionConfigChange(
        Number(select.dataset.extractionId),
        select.dataset.field,
        themeSelectOption.dataset.value
      );
      closeAllThemeSelects();
      return;
    }

    const themeSelectTrigger = e.target.closest('.theme-select-trigger');
    if (themeSelectTrigger) {
      e.preventDefault();
      e.stopPropagation();
      toggleThemeSelect(themeSelectTrigger.closest('.theme-select'));
      return;
    }

    if (!e.target.closest('.theme-select')) {
      closeAllThemeSelects();
    }

    const duplicateBtn = e.target.closest('.production-extraction-duplicate-btn');
    if (duplicateBtn) {
      e.preventDefault();
      e.stopPropagation();
      addMineralExtractionFromPicker(Number(duplicateBtn.dataset.itemId));
      return;
    }

    const extractionResetBtn = e.target.closest('.production-step-reset-btn[data-extraction-id]');
    if (extractionResetBtn) {
      e.preventDefault();
      e.stopPropagation();
      resetProductionExtraction(Number(extractionResetBtn.dataset.extractionId));
      return;
    }

    const extractionDeleteBtn = e.target.closest('.production-step-delete-btn[data-extraction-id]');
    if (extractionDeleteBtn) {
      e.preventDefault();
      e.stopPropagation();
      deleteProductionExtraction(Number(extractionDeleteBtn.dataset.extractionId));
      return;
    }

    const groupTreeBtn = e.target.closest('.production-step-group-tree-btn');
    if (groupTreeBtn) {
      e.preventDefault();
      e.stopPropagation();
      openProductionGroupTreeView(groupTreeBtn.dataset.groupKey);
      return;
    }

    const groupRenameBtn = e.target.closest('.production-step-group-rename-btn');
    if (groupRenameBtn) {
      e.preventDefault();
      e.stopPropagation();
      const groupKey = groupRenameBtn.dataset.groupKey;
      openSchemaRenameModal({
        kind: 'rename-step-group',
        id: activeProductionChainId,
        groupKey,
        name: groupKey,
        title: t('confirm.renameGroupTitle'),
      });
      return;
    }

    const groupToggleBtn = e.target.closest('.production-step-group-toggle-btn');
    if (groupToggleBtn) {
      e.preventDefault();
      e.stopPropagation();
      const groupKey = groupToggleBtn.dataset.groupKey;
      const groupEl = groupToggleBtn.closest('.production-step-group');
      const next = toggleProductionGroupViewState(groupKey);
      applyProductionGroupViewState(groupEl, next);
      return;
    }

    const toggleBtn = e.target.closest('.production-step-toggle-btn[data-step-id]');
    if (toggleBtn) {
      e.preventDefault();
      e.stopPropagation();
      const stepEl = toggleBtn.closest('.production-step');
      const stepId = normalizeProductionStepId(toggleBtn.dataset.stepId);
      if (!stepEl || !stepId) return;
      applyProductionStepViewState(stepEl, cycleProductionStepViewState(stepId));
      return;
    }

    const resetBtn = e.target.closest('.production-step-reset-btn[data-step-id]');
    if (resetBtn) {
      e.preventDefault();
      e.stopPropagation();
      resetProductionStep(Number(resetBtn.dataset.stepId));
      return;
    }

    const deleteBtn = e.target.closest('.production-step-delete-btn[data-step-id]');
    if (!deleteBtn) return;
    e.preventDefault();
    e.stopPropagation();
    deleteProductionStep(Number(deleteBtn.dataset.stepId));
  });

  document.getElementById('resource-picker-modal-close').addEventListener('click', closeResourcePickerModal);
  resourcePickerModal.addEventListener('click', (e) => {
    if (e.target === resourcePickerModal) closeResourcePickerModal();
  });

  document.getElementById('resource-picker-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.picker-item:not([disabled])');
    if (!btn) return;
    handleResourceSelection(Number(btn.dataset.id));
  });

  const pickerSearch = document.getElementById('resource-picker-search');
  let pickerDebounce;
  pickerSearch.addEventListener('input', () => {
    clearTimeout(pickerDebounce);
    pickerDebounce = setTimeout(async () => {
      const query = pickerSearch.value.trim();
      const listEl = document.getElementById('resource-picker-list');

      if (!query) {
        if (resourcePickerMode === 'extraction') {
          renderExtractionPickerList(pickerResourcesData);
        } else {
          renderResourcePickerList(pickerResourcesData);
        }
        return;
      }

      try {
        let results = await window.satisfactory.searchResources(query);
        if (resourcePickerMode === 'extraction') {
          results = results.filter(isExtractionPickerItem);
          const minerals = results.filter((item) => item.category === 'minerali');
          const liquids = results.filter((item) => EXTRACTION_LIQUID_SLUGS.includes(item.slug));

          if (!results.length) {
            listEl.innerHTML = `<p class="empty-state">${escapeHtml(t('errors.pickerExtractEmpty'))}</p>`;
          } else {
            const sections = [];
            if (minerals.length) {
              sections.push(`
                <section class="picker-category">
                  <h4>${escapeHtml(t('production.groupMinerals'))}</h4>
                  <div class="picker-grid">
                    ${minerals.map(renderExtractionPickerItem).join('')}
                  </div>
                </section>`);
            }
            if (liquids.length) {
              sections.push(`
                <section class="picker-category">
                  <h4>${escapeHtml(t('production.groupLiquids'))}</h4>
                  <div class="picker-grid">
                    ${liquids.map(renderExtractionPickerItem).join('')}
                  </div>
                </section>`);
            }
            listEl.innerHTML = sections.join('');
          }

          document.getElementById('resource-picker-count').textContent =
            `${formatUiResultsCount(results.length)}`;
        } else {
          listEl.innerHTML = renderResourcePickerSearchResults(results);
        }
      } catch (err) {
        console.error('Resource picker search error:', err);
      }
    }, 200);
  });

  document.getElementById('schema-picker-modal-close').addEventListener('click', closeSchemaPickerModal);
  schemaPickerModal.addEventListener('click', (e) => {
    if (e.target === schemaPickerModal) closeSchemaPickerModal();
  });

  document.getElementById('schema-picker-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.picker-schema-btn');
    if (!btn || !pendingPickerItemId) return;
    addProductionStep(pendingPickerItemId, Number(btn.dataset.schemaId));
  });

  productionCreateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideProductionCreateError();

    const name = document.getElementById('production-chain-name').value;

    try {
      const chain = await window.satisfactory.createProductionChain({ name });
      productionChains = [chain, ...productionChains.filter((item) => item.id !== chain.id)];
      closeProductionCreateModal();
      await loadProductionChainSummaries();
      renderProductionChains();
    } catch (err) {
      showProductionCreateError(err.message || t('errors.createFailed'));
    }
  });
}

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

  if (!schema?.building_image) {
    return `
      <aside class="craft-schema-building craft-schema-building--empty">
        ${totalOutputLine}
        <div class="craft-schema-building-main">
          ${renderBuildingNameOnly(schema)}
          ${configLine}
          ${baseLine}
          <div class="craft-building-inputs-panel">${inputsPanel}</div>
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

function setupDetailModal() {
  document.getElementById('detail-modal-close').addEventListener('click', closeDetailModal);

  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) closeDetailModal();
  });
}

function setupResourceActions() {
  document.getElementById('resources-container').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.resource-edit-btn');
    if (editBtn) {
      e.preventDefault();
      e.stopPropagation();
      openEditModal(Number(editBtn.dataset.id));
      return;
    }

    const card = e.target.closest('.resource-card');
    if (!card) return;
    openDetailModal(Number(card.dataset.id));
  });
}

function setupEditModal() {
  document.getElementById('edit-modal-close').addEventListener('click', closeEditModal);
  document.getElementById('edit-modal-cancel').addEventListener('click', closeEditModal);

  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!confirmModal.classList.contains('hidden')) closeConfirm(false);
    if (!editModal.classList.contains('hidden')) closeEditModal();
    if (!detailModal.classList.contains('hidden')) closeDetailModal();
    if (legalInfoModal && !legalInfoModal.classList.contains('hidden')) closeLegalInfoModal();
    if (!productionCreateModal.classList.contains('hidden')) closeProductionCreateModal();
    if (!schemaRenameModal.classList.contains('hidden')) closeSchemaRenameModal();
    if (!resourcePickerModal.classList.contains('hidden')) closeResourcePickerModal();
    if (!schemaPickerModal.classList.contains('hidden')) closeSchemaPickerModal();
    if (views['production-detail'].classList.contains('view-active')) closeProductionDetail();
  });

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideFormError();

    const id = Number(document.getElementById('edit-item-id').value);
    const data = {
      name: document.getElementById('edit-item-name').value,
      category: document.getElementById('edit-item-category').value,
    };

    try {
      await window.satisfactory.updateResource(id, data);
      closeEditModal();
      await refreshResourcesView();
    } catch (err) {
      showFormError(err.message || t('errors.saveFailed'));
    }
  });
}

function setupSearch() {
  const input = document.getElementById('resource-search');
  let debounce;

  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const searchQuery = input.value.trim();

      if (!searchQuery) {
        renderResources();
        document.getElementById('search-count').textContent = '';
        return;
      }

      try {
        isSearchActive = true;
        const results = await window.satisfactory.searchResources(searchQuery);
        renderSearchResults(results);
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 200);
  });
}

function formatDateTime(iso) {
  if (!iso) return t('common.never');
  try {
    return new Date(iso).toLocaleString(activeLocale || 'it');
  } catch {
    return iso;
  }
}

function showSettingsFeedback(message, type = 'success') {
  const el = document.getElementById('settings-feedback');
  el.textContent = message;
  el.className = `settings-feedback settings-feedback--${type}`;
  el.classList.remove('hidden');
}

function hideSettingsFeedback() {
  const el = document.getElementById('settings-feedback');
  el.textContent = '';
  el.classList.add('hidden');
}

function formatSettingsCountValue(value) {
  if (value == null || value === '—') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? formatDisplayInteger(n) : String(value);
}

function renderSettingsStats(info) {
  const counts = info?.counts ?? {};
  const expected = info?.expected ?? {};

  document.getElementById('settings-count-items').textContent =
    `${formatSettingsCountValue(counts.items ?? 0)} / ${formatSettingsCountValue(expected.items ?? '—')}`;
  document.getElementById('settings-count-buildings').textContent =
    `${formatSettingsCountValue(counts.buildings ?? 0)} / ${formatSettingsCountValue(expected.buildings ?? '—')}`;
  document.getElementById('settings-count-schemas').textContent =
    `${formatSettingsCountValue(counts.schemas ?? 0)} / ${formatSettingsCountValue(expected.schemas ?? '—')}`;
  document.getElementById('settings-count-somersloop-buildings').textContent =
    `${formatSettingsCountValue(counts.somersloopBuildings ?? 0)} / ${formatSettingsCountValue(expected.somersloopBuildings ?? '—')}`;
  document.getElementById('settings-bundled-version').textContent =
    info?.bundledVersion != null ? `v${info.bundledVersion}` : '—';
  document.getElementById('settings-stored-version').textContent =
    info?.storedVersion != null ? `v${info.storedVersion}` : t('common.notSet');
  document.getElementById('settings-last-reset').textContent = formatDateTime(info?.lastResetAt);
}

async function loadSettings() {
  hideSettingsFeedback();

  try {
    const [info, status] = await Promise.all([
      window.satisfactory.getResourcesDataInfo(),
      window.satisfactory.getDbStatus(),
    ]);
    renderSettingsStats(info);
    renderEnvironmentStats(status);
  } catch (err) {
    showSettingsFeedback(t('settings.errorLoadInfo'), 'error');
    console.error('Settings load error:', err);
  }
}

function showConfirm({ title, message, confirmLabel = t('common.confirm') }) {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-message').textContent = message;
    document.getElementById('confirm-modal-ok').textContent = confirmLabel;
    confirmModal.classList.remove('hidden');
    confirmModal.setAttribute('aria-hidden', 'false');
    document.getElementById('confirm-modal-cancel').focus();
  });
}

function closeConfirm(result) {
  confirmModal.classList.add('hidden');
  confirmModal.setAttribute('aria-hidden', 'true');
  if (confirmResolve) {
    confirmResolve(result);
    confirmResolve = null;
  }
}

function setupConfirmModal() {
  document.getElementById('confirm-modal-cancel').addEventListener('click', () => {
    closeConfirm(false);
  });
  document.getElementById('confirm-modal-ok').addEventListener('click', () => {
    closeConfirm(true);
  });
  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) closeConfirm(false);
  });
}

async function restoreDefaultResources() {
  const confirmed = await showConfirm({
    title: t('confirm.restoreDefaultsTitle'),
    message: t('confirm.restoreDefaultsMessage'),
    confirmLabel: t('confirm.restoreDefaultsConfirm'),
  });
  if (!confirmed) return;

  const btn = document.getElementById('btn-restore-resources');
  btn.disabled = true;
  hideSettingsFeedback();

  try {
    const result = await window.satisfactory.restoreDefaultResources();
    renderSettingsStats(result.status?.resources ?? result);
    await initDashboard();

    resourcesData = [];
    if (views.resources.classList.contains('view-active')) {
      await loadResources();
    }

    const items = result.status?.counts?.items ?? result.items?.count ?? '—';
    const schemas = result.status?.counts?.schemas ?? result.schemas?.count ?? '—';
    const buildings = result.status?.counts?.buildings ?? result.buildings?.count ?? '—';
    showSettingsFeedback(
      t('settings.restoreSuccess', {
        items: formatSettingsCountValue(items),
        buildings: formatSettingsCountValue(buildings),
        schemas: formatSettingsCountValue(schemas),
      }),
      'success'
    );
  } catch (err) {
    showSettingsFeedback(err.message || t('settings.errorRestore'), 'error');
    console.error('Restore error:', err);
  } finally {
    btn.disabled = false;
  }
}

function setupSettings() {
  document.getElementById('btn-restore-resources').addEventListener('click', restoreDefaultResources);
}

function setupNumberInputWheelBlock() {
  document.addEventListener(
    'wheel',
    (event) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement &&
        (target.type === 'number' || target.classList.contains('production-config-decimal-input')) &&
        target === document.activeElement
      ) {
        event.preventDefault();
        const field = getConfigInputField(target);
        if (field) {
          applyConfigInputNudge(target, field, event.deltaY < 0 ? 1 : -1);
        }
      }
    },
    { passive: false, capture: true }
  );
}

function setupSchemaFilter() {
  const checkbox = document.getElementById('hide-no-schemas');
  hideWithoutSchemas = checkbox.checked;

  checkbox.addEventListener('change', () => {
    hideWithoutSchemas = checkbox.checked;
    renderCategorySidebar(resourcesData);

    const searchQuery = document.getElementById('resource-search').value.trim();
    if (searchQuery) {
      window.satisfactory.searchResources(searchQuery).then(renderSearchResults).catch(console.error);
    } else {
      renderResources();
    }
  });
}

async function boot() {
  await initProductionUiStateStore();
  await initLocaleSelector();
  setupLocaleSelector();
  setupNavigation();
  setupLegalInfoModal();
  setupSearch();
  setupSchemaFilter();
  setupNumberInputWheelBlock();
  setupConfirmModal();
  setupSchemaRenameModal();
  setupSettings();
  setupProductionUiStatePersistence();
  setupProduction();
  setupResourceActions();
  setupEditModal();
  setupDetailModal();
  setupDashboard();
}

boot();
