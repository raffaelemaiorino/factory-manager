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
const POWER_SHARD_IMAGE = 'assets/items/Desc_CrystalShard_C.png';
const SOMERSLOOP_IMAGE = 'assets/items/Somersloop.png';
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

let activeLocale = 'en';
let availableLocales = [];

const DEFAULT_APP_SETTINGS = {
  maxMachines: 100,
  maxEnergyGenerators: 600,
  numberFormat: 'en-US',
};

let appSettings = { ...DEFAULT_APP_SETTINGS };

function getConfiguredMaxMachines() {
  return Math.max(1, Math.round(Number(appSettings.maxMachines) || DEFAULT_APP_SETTINGS.maxMachines));
}

function getConfiguredMaxEnergyGenerators() {
  return Math.max(
    1,
    Math.round(Number(appSettings.maxEnergyGenerators) || DEFAULT_APP_SETTINGS.maxEnergyGenerators)
  );
}

function applyAppSettings(settings) {
  const numberFormat =
    window.NumberFormat?.normalizeFormat?.(settings?.numberFormat) ||
    DEFAULT_APP_SETTINGS.numberFormat;
  appSettings = {
    maxMachines: Math.max(
      1,
      Math.round(Number(settings?.maxMachines) || DEFAULT_APP_SETTINGS.maxMachines)
    ),
    maxEnergyGenerators: Math.max(
      1,
      Math.round(
        Number(settings?.maxEnergyGenerators) || DEFAULT_APP_SETTINGS.maxEnergyGenerators
      )
    ),
    numberFormat,
  };
  window.NumberFormat?.setFormat?.(numberFormat);
  window.Calculator?.syncNumberFormat?.();
  return appSettings;
}

async function initAppSettings() {
  try {
    const settings = await window.satisfactory.getAppSettings();
    applyAppSettings(settings);
  } catch (err) {
    console.error('App settings init error:', err);
    applyAppSettings(DEFAULT_APP_SETTINGS);
  }
}

window.getConfiguredMaxMachines = getConfiguredMaxMachines;
window.getConfiguredMaxEnergyGenerators = getConfiguredMaxEnergyGenerators;

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
const PRODUCTION_TREE_DETAIL_MODE_KEY = 'satisfactory-tree-detail-mode';
let productionTreeDetailMode = 'simple';
let productionUiStateCache = {};

function normalizeTreeDetailMode(value) {
  return value === 'complex' ? 'complex' : 'simple';
}

function getProductionTreeDetailMode() {
  return normalizeTreeDetailMode(productionTreeDetailMode);
}

function setProductionTreeDetailMode(mode) {
  productionTreeDetailMode = normalizeTreeDetailMode(mode);
  try {
    localStorage.setItem(PRODUCTION_TREE_DETAIL_MODE_KEY, productionTreeDetailMode);
  } catch {
    /* storage pieno o disabilitato */
  }
  return productionTreeDetailMode;
}

function initProductionTreeDetailMode() {
  try {
    productionTreeDetailMode = normalizeTreeDetailMode(
      localStorage.getItem(PRODUCTION_TREE_DETAIL_MODE_KEY)
    );
  } catch {
    productionTreeDetailMode = 'simple';
  }
  return productionTreeDetailMode;
}

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
const alertModal = document.getElementById('alert-modal');
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
let alertResolve = null;
let schemaRenameOnSaved = null;
let schemaRenameGroupKey = null;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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

