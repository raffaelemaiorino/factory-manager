const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  statSync,
} = require('fs');
const {
  loadProductionUiState,
  saveProductionUiState,
} = require('./production-ui-state-store');
const { assertSchemaFileSize } = require('../src/database/schema-import-guard');
const { checkForAppUpdate, isAllowedReleaseUrl } = require('./update-check');

const { version: appVersion } = JSON.parse(
  readFileSync(path.join(__dirname, '../package.json'), 'utf8')
);

const USER_DATA_DIR_NAME = 'factory-manager';
const DB_FILE_NAME = 'factory-manager.db';
const UI_STATE_FILE = 'production-ui-state.json';
const LEGACY_USER_DATA_DIR_NAMES = [
  'satisfactory-manager',
  'Satisfactory Manager',
  'FACTORY MANAGER',
  'satisfactory-planner',
];
const LEGACY_DB_FILE_NAMES = ['satisfactory.db'];

// Deve essere impostato prima di app.ready
app.setPath('userData', path.join(app.getPath('appData'), USER_DATA_DIR_NAME));

function migrateLegacyUserData(targetPath) {
  const targetDb = path.join(targetPath, 'data', DB_FILE_NAME);
  if (existsSync(targetDb)) return;

  const appData = app.getPath('appData');
  let best = null;

  for (const dirName of LEGACY_USER_DATA_DIR_NAMES) {
    for (const dbName of LEGACY_DB_FILE_NAMES) {
      const dbPath = path.join(appData, dirName, 'data', dbName);
      if (!existsSync(dbPath)) continue;
      const mtime = statSync(dbPath).mtimeMs;
      if (!best || mtime > best.mtime) {
        best = {
          dbPath,
          mtime,
          uiStatePath: path.join(appData, dirName, UI_STATE_FILE),
        };
      }
    }
  }

  if (!best) return;

  mkdirSync(path.join(targetPath, 'data'), { recursive: true });
  copyFileSync(best.dbPath, targetDb);

  const targetUi = path.join(targetPath, UI_STATE_FILE);
  if (!existsSync(targetUi) && existsSync(best.uiStatePath)) {
    copyFileSync(best.uiStatePath, targetUi);
  }
}

const {
  initDatabase,
  getDbStatus,
  getResourcesGrouped,
  getResourceCategories,
  findResources,
  getResourceById,
  saveResource,
  getResourceDetail,
  restoreDefaultResources,
  getResourcesDataInfo,
  getProductionChains,
  saveProductionChain,
  updateProductionChain,
  removeProductionChain,
  duplicateProductionChain,
  exportProductionChain,
  importProductionChain,
  detectSchemaFormatKind,
  fetchProductionChainDetail,
  addProductionChainStep,
  updateProductionChainStep,
  setProductionStepMarked,
  setProductionGroupMarked,
  resetProductionChainStep,
  deleteProductionChainStep,
  reorderProductionChainSteps,
  reorderProductionChainStepsInGroup,
  reorderProductionChainGroups,
  setProductionStepGroupName,
  renameProductionStepGroup,
  setProductionStepInputLinks,
  setProductionStepExtractionLinks,
  addMineralExtraction,
  updateMineralExtraction,
  deleteMineralExtraction,
  resetMineralExtraction,
  getEnergyChains,
  saveEnergyChain,
  updateEnergyChain,
  removeEnergyChain,
  exportEnergyChain,
  importEnergyChain,
  fetchEnergyChainDetail,
  fetchEnergyGeneratorCatalog,
  addEnergyChainExtraction,
  updateEnergyChainExtraction,
  deleteEnergyChainExtraction,
  resetEnergyChainExtraction,
  addEnergyChainGenerator,
  updateEnergyChainGenerator,
  deleteEnergyChainGenerator,
  resetEnergyChainGenerator,
  setEnergyGeneratorInputLinks,
  setEnergyGeneratorProductionLinks,
  getI18nInfo,
  getAppLocale,
  setAppLocale,
  listAvailableLocales,
  getAppSettings,
  setAppSettings,
} = require('../src/database');
const { loadUiMessages } = require('../src/locales/ui');

let mainWindow;
let userDataPath;

function createSplashWindow() {
  const splash = new BrowserWindow({
    width: 440,
    height: 200,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    center: true,
    backgroundColor: '#0f1419',
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const html = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <style>
    html, body {
      margin: 0;
      height: 100%;
      background: #0f1419;
      color: #e8eef5;
      font-family: "Segoe UI", system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
    }
    .box { text-align: center; padding: 24px; }
    .title {
      font-size: 15px;
      font-weight: 650;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin: 0 0 10px;
    }
    .msg { margin: 0; font-size: 13px; opacity: 0.75; }
  </style>
</head>
<body>
  <div class="box">
    <p class="title">Factory Manager</p>
    <p class="msg">Preparazione dati in corso…</p>
  </div>
</body>
</html>`;

  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  return splash;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1320,
    minWidth: 960,
    minHeight: 660,
    title: 'FACTORY MANAGER',
    backgroundColor: '#0f1419',
    // .ico is Windows-only; Electron's native image loader can't read it on
    // Linux/Mac (silently fails, window falls back to Electron's default icon).
    icon: path.join(
      __dirname,
      process.platform === 'win32'
        ? '../src/renderer/assets/icon.ico'
        : '../src/renderer/assets/app-icon.png'
    ),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../src/renderer/index.html'));

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Solo navigazione locale (file://); blocca http(s) e altri schemi
    if (!String(url).startsWith('file:')) {
      event.preventDefault();
    }
  });

  const reveal = () => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isVisible()) return;
    mainWindow.maximize();
    mainWindow.show();
  };

  mainWindow.once('ready-to-show', reveal);
  // Fallback se ready-to-show non arriva (AV / caricamento lento)
  setTimeout(reveal, 10000);

  mainWindow.webContents.on('did-fail-load', (_event, code, desc) => {
    dialog.showErrorBox(
      'FACTORY MANAGER — errore caricamento',
      `Impossibile caricare l'interfaccia (${code}): ${desc}`
    );
  });

  if (process.argv.includes('--enable-logging')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  app.setName('FACTORY MANAGER');
  Menu.setApplicationMenu(null);
  userDataPath = app.getPath('userData');

  const splash = createSplashWindow();

  try {
    migrateLegacyUserData(userDataPath);
    await initDatabase(userDataPath);
  } catch (err) {
    if (splash && !splash.isDestroyed()) splash.destroy();
    const detail = err?.stack || err?.message || String(err);
    dialog.showErrorBox(
      'FACTORY MANAGER — errore avvio',
      `Impossibile inizializzare l'applicazione.\n\n${detail}`
    );
    app.quit();
    return;
  }

  createWindow();
  if (splash && !splash.isDestroyed()) splash.destroy();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}).catch((err) => {
  // Safety net for anything outside the try/catch above (e.g. createWindow()
  // itself, or setup before the DB init try block) - without this, a failure
  // here is an unhandled rejection with no dialog shown to the user at all.
  const detail = err?.stack || err?.message || String(err);
  dialog.showErrorBox(
    'FACTORY MANAGER — errore avvio',
    `Errore imprevisto durante l'avvio.\n\n${detail}`
  );
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('app:info', () => ({
  electron: process.versions.electron,
  node: process.versions.node,
  version: appVersion,
}));

ipcMain.handle('app:check-update', () => checkForAppUpdate(appVersion));

ipcMain.handle('shell:open-external', async (_event, url) => {
  if (!isAllowedReleaseUrl(url)) {
    return { ok: false, reason: 'url_not_allowed' };
  }
  await shell.openExternal(String(url));
  return { ok: true };
});

ipcMain.on('production-ui-state:load', (event) => {
  event.returnValue = loadProductionUiState(userDataPath);
});

ipcMain.on('production-ui-state:save', (event, data) => {
  saveProductionUiState(userDataPath, data);
  event.returnValue = true;
});
ipcMain.handle('db:status', () => getDbStatus());
ipcMain.handle('resources:all', () => getResourcesGrouped());
ipcMain.handle('resources:categories', () => getResourceCategories());
ipcMain.handle('resources:search', (_event, query) => findResources(query));
ipcMain.handle('resources:get', (_event, id) => getResourceById(id));
ipcMain.handle('resources:detail', (_event, id) => getResourceDetail(id));
ipcMain.handle('resources:update', (_event, id, data) => saveResource(id, data));
ipcMain.handle('db:restore-default-resources', () => restoreDefaultResources());
ipcMain.handle('db:resources-info', () => getResourcesDataInfo());
ipcMain.handle('i18n:info', () => getI18nInfo());
ipcMain.handle('i18n:get-locale', () => getAppLocale());
ipcMain.handle('i18n:set-locale', (_event, locale) => setAppLocale(locale));
ipcMain.handle('i18n:list-locales', () => listAvailableLocales());
ipcMain.handle('i18n:ui-messages', (_event, locale) => loadUiMessages(locale));
ipcMain.handle('settings:get', () => getAppSettings());
ipcMain.handle('settings:set', (_event, partial) => setAppSettings(partial));
function sanitizeExportFileName(name) {
  const cleaned = String(name ?? 'schema')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .slice(0, 120);
  return cleaned || 'schema';
}

async function saveSchemaJsonFile(title, defaultName, payload) {
  const result = await dialog.showSaveDialog(mainWindow, {
    title,
    defaultPath: defaultName,
    filters: [
      { name: 'JSON', extensions: ['json'] },
      { name: 'Tutti i file', extensions: ['*'] },
    ],
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }

  let filePath = result.filePath;
  if (!/\.json$/i.test(filePath)) {
    filePath = `${filePath}.json`;
  }

  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return { canceled: false, filePath };
}

async function openSchemaJsonFile(title) {
  const result = await dialog.showOpenDialog(mainWindow, {
    title,
    filters: [
      { name: 'JSON', extensions: ['json'] },
      { name: 'Tutti i file', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || !result.filePaths?.[0]) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  let payload;
  try {
    const size = statSync(filePath).size;
    assertSchemaFileSize(size);
    payload = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err?.message && /troppo grande|max \d+ MB/i.test(err.message)) {
      throw err;
    }
    throw new Error('File JSON non valido');
  }

  return { canceled: false, filePath, payload };
}

ipcMain.handle('production:all', () => getProductionChains());
ipcMain.handle('production:create', (_event, data) => saveProductionChain(data));
ipcMain.handle('production:update', (_event, id, data) => updateProductionChain(id, data));
ipcMain.handle('production:delete', (_event, id) => removeProductionChain(id));
ipcMain.handle('production:duplicate', (_event, id) => duplicateProductionChain(id));
ipcMain.handle('production:export', async (_event, id) => {
  const payload = exportProductionChain(id, { appVersion });
  return saveSchemaJsonFile(
    'Esporta schema di produzione',
    `${sanitizeExportFileName(payload.schema?.name)}.json`,
    payload
  );
});
ipcMain.handle('production:import', async () => {
  const opened = await openSchemaJsonFile('Importa schema di produzione');
  if (opened.canceled) return { canceled: true };
  const actualKind = detectSchemaFormatKind(opened.payload);
  if (actualKind && actualKind !== 'production') {
    return {
      canceled: false,
      typeMismatch: { expected: 'production', actual: actualKind },
    };
  }
  const chain = importProductionChain(opened.payload);
  return { canceled: false, chain, filePath: opened.filePath };
});
ipcMain.handle('production:get', (_event, id) => fetchProductionChainDetail(id));
ipcMain.handle('production:add-step', (_event, chainId, data) =>
  addProductionChainStep(chainId, data)
);
ipcMain.handle('production:update-step', (_event, stepId, data) =>
  updateProductionChainStep(stepId, data)
);
ipcMain.handle('production:set-step-marked', (_event, stepId, marked) =>
  setProductionStepMarked(stepId, marked)
);
ipcMain.handle('production:set-group-marked', (_event, chainId, groupName, marked) =>
  setProductionGroupMarked(chainId, groupName, marked)
);
ipcMain.handle('production:reset-step', (_event, stepId) => resetProductionChainStep(stepId));
ipcMain.handle('production:delete-step', (_event, stepId) => deleteProductionChainStep(stepId));
ipcMain.handle('production:reorder-steps', (_event, chainId, stepIds) =>
  reorderProductionChainSteps(chainId, stepIds)
);
ipcMain.handle('production:reorder-steps-in-group', (_event, chainId, groupName, stepIds) =>
  reorderProductionChainStepsInGroup(chainId, groupName, stepIds)
);
ipcMain.handle('production:reorder-step-groups', (_event, chainId, groupKeys) =>
  reorderProductionChainGroups(chainId, groupKeys)
);
ipcMain.handle('production:set-step-group', (_event, stepId, groupName) =>
  setProductionStepGroupName(stepId, groupName)
);
ipcMain.handle('production:rename-step-group', (_event, chainId, oldGroupName, newGroupName) =>
  renameProductionStepGroup(chainId, oldGroupName, newGroupName)
);
ipcMain.handle('production:set-step-links', (_event, consumerStepId, itemSlug, producerStepIds) =>
  setProductionStepInputLinks(consumerStepId, itemSlug, producerStepIds)
);
ipcMain.handle(
  'production:set-extraction-links',
  (_event, consumerStepId, itemSlug, producerExtractionIds) =>
    setProductionStepExtractionLinks(consumerStepId, itemSlug, producerExtractionIds)
);
ipcMain.handle('production:add-extraction', (_event, chainId, data) =>
  addMineralExtraction(chainId, data)
);
ipcMain.handle('production:update-extraction', (_event, extractionId, data) =>
  updateMineralExtraction(extractionId, data)
);
ipcMain.handle('production:delete-extraction', (_event, extractionId) =>
  deleteMineralExtraction(extractionId)
);
ipcMain.handle('production:reset-extraction', (_event, extractionId) =>
  resetMineralExtraction(extractionId)
);
ipcMain.handle('energy:all', () => getEnergyChains());
ipcMain.handle('energy:create', (_event, data) => saveEnergyChain(data));
ipcMain.handle('energy:update', (_event, id, data) => updateEnergyChain(id, data));
ipcMain.handle('energy:delete', (_event, id) => removeEnergyChain(id));
ipcMain.handle('energy:export', async (_event, id) => {
  const payload = exportEnergyChain(id, { appVersion });
  return saveSchemaJsonFile(
    'Esporta schema energia',
    `${sanitizeExportFileName(payload.schema?.name)}.json`,
    payload
  );
});
ipcMain.handle('energy:import', async () => {
  const opened = await openSchemaJsonFile('Importa schema energia');
  if (opened.canceled) return { canceled: true };
  const actualKind = detectSchemaFormatKind(opened.payload);
  if (actualKind && actualKind !== 'energy') {
    return {
      canceled: false,
      typeMismatch: { expected: 'energy', actual: actualKind },
    };
  }
  const chain = importEnergyChain(opened.payload);
  return { canceled: false, chain, filePath: opened.filePath };
});
ipcMain.handle('energy:get', (_event, id) => fetchEnergyChainDetail(id));
ipcMain.handle('energy:generator-catalog', () => fetchEnergyGeneratorCatalog());
ipcMain.handle('energy:add-extraction', (_event, chainId, data) =>
  addEnergyChainExtraction(chainId, data)
);
ipcMain.handle('energy:update-extraction', (_event, extractionId, data) =>
  updateEnergyChainExtraction(extractionId, data)
);
ipcMain.handle('energy:delete-extraction', (_event, extractionId) =>
  deleteEnergyChainExtraction(extractionId)
);
ipcMain.handle('energy:reset-extraction', (_event, extractionId) =>
  resetEnergyChainExtraction(extractionId)
);
ipcMain.handle('energy:add-generator', (_event, chainId, data) =>
  addEnergyChainGenerator(chainId, data)
);
ipcMain.handle('energy:update-generator', (_event, generatorId, data) =>
  updateEnergyChainGenerator(generatorId, data)
);
ipcMain.handle('energy:delete-generator', (_event, generatorId) =>
  deleteEnergyChainGenerator(generatorId)
);
ipcMain.handle('energy:reset-generator', (_event, generatorId) =>
  resetEnergyChainGenerator(generatorId)
);
ipcMain.handle('energy:set-input-links', (_event, generatorId, itemSlug, extractionIds) =>
  setEnergyGeneratorInputLinks(generatorId, itemSlug, extractionIds)
);
ipcMain.handle('energy:set-production-links', (_event, generatorId, itemSlug, producerStepIds) =>
  setEnergyGeneratorProductionLinks(generatorId, itemSlug, producerStepIds)
);
