const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
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
const {
  assertSchemaFileSize,
  MAX_UI_STATE_BYTES,
} = require('../src/database/schema-import-guard');

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

const APP_INDEX_HTML = path.join(__dirname, '../src/renderer/index.html');

function assertFromMainWindow(event) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    throw new Error('Finestra principale non disponibile');
  }
  if (event.sender !== mainWindow.webContents) {
    throw new Error('Richiesta IPC non autorizzata');
  }
}

function withMainWindow(handler) {
  return (event, ...args) => {
    assertFromMainWindow(event);
    return handler(event, ...args);
  };
}

function hardenWebContents(contents, { allowAppIndex = false } = {}) {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const allowedIndexUrl = pathToFileURL(APP_INDEX_HTML).href.toLowerCase();
  contents.on('will-navigate', (event, url) => {
    if (!allowAppIndex) {
      event.preventDefault();
      return;
    }
    try {
      const target = String(url).split('#')[0].split('?')[0].toLowerCase();
      if (target !== allowedIndexUrl) {
        event.preventDefault();
      }
    } catch {
      event.preventDefault();
    }
  });
}

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
      sandbox: true,
    },
  });

  hardenWebContents(splash.webContents, { allowAppIndex: false });

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
    icon: path.join(__dirname, '../src/renderer/assets/icon.ico'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  hardenWebContents(mainWindow.webContents, { allowAppIndex: true });
  mainWindow.loadFile(APP_INDEX_HTML);

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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('app:info', withMainWindow(() => ({
  electron: process.versions.electron,
  node: process.versions.node,
  version: appVersion,
})));

ipcMain.on('production-ui-state:load', (event) => {
  try {
    assertFromMainWindow(event);
    event.returnValue = loadProductionUiState(userDataPath);
  } catch {
    event.returnValue = {};
  }
});

ipcMain.on('production-ui-state:save', (event, data) => {
  try {
    assertFromMainWindow(event);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      event.returnValue = false;
      return;
    }
    let serialized;
    try {
      serialized = JSON.stringify(data);
    } catch {
      event.returnValue = false;
      return;
    }
    if (serialized.length > MAX_UI_STATE_BYTES) {
      event.returnValue = false;
      return;
    }
    saveProductionUiState(userDataPath, data);
    event.returnValue = true;
  } catch {
    event.returnValue = false;
  }
});
ipcMain.handle('db:status', withMainWindow(() => getDbStatus()));
ipcMain.handle('resources:all', withMainWindow(() => getResourcesGrouped()));
ipcMain.handle('resources:categories', withMainWindow(() => getResourceCategories()));
ipcMain.handle('resources:search', withMainWindow((_event, query) => findResources(query)));
ipcMain.handle('resources:get', withMainWindow((_event, id) => getResourceById(id)));
ipcMain.handle('resources:detail', withMainWindow((_event, id) => getResourceDetail(id)));
ipcMain.handle(
  'resources:update',
  withMainWindow((_event, id, data) => saveResource(id, data))
);
ipcMain.handle(
  'db:restore-default-resources',
  withMainWindow(() => restoreDefaultResources())
);
ipcMain.handle('db:resources-info', withMainWindow(() => getResourcesDataInfo()));
ipcMain.handle('i18n:info', withMainWindow(() => getI18nInfo()));
ipcMain.handle('i18n:get-locale', withMainWindow(() => getAppLocale()));
ipcMain.handle('i18n:set-locale', withMainWindow((_event, locale) => setAppLocale(locale)));
ipcMain.handle('i18n:list-locales', withMainWindow(() => listAvailableLocales()));
ipcMain.handle('i18n:ui-messages', withMainWindow((_event, locale) => loadUiMessages(locale)));
ipcMain.handle('settings:get', withMainWindow(() => getAppSettings()));
ipcMain.handle('settings:set', withMainWindow((_event, partial) => setAppSettings(partial)));
function sanitizeExportFileName(name) {
  let cleaned = String(name ?? 'schema')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .slice(0, 120);
  // Nomi dispositivo riservati Windows (CON, PRN, AUX, NUL, COM1…, LPT9…)
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(cleaned)) {
    cleaned = `schema_${cleaned}`;
  }
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
  assertSchemaFileSize(filePath);
  let payload;
  try {
    payload = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err && err.message && /troppo grande/i.test(err.message)) throw err;
    throw new Error('File JSON non valido');
  }

  return { canceled: false, filePath, payload };
}

ipcMain.handle('production:all', withMainWindow(() => getProductionChains()));
ipcMain.handle(
  'production:create',
  withMainWindow((_event, data) => saveProductionChain(data))
);
ipcMain.handle(
  'production:update',
  withMainWindow((_event, id, data) => updateProductionChain(id, data))
);
ipcMain.handle(
  'production:delete',
  withMainWindow((_event, id) => removeProductionChain(id))
);
ipcMain.handle(
  'production:duplicate',
  withMainWindow((_event, id) => duplicateProductionChain(id))
);
ipcMain.handle(
  'production:export',
  withMainWindow(async (_event, id) => {
    const payload = exportProductionChain(id, { appVersion });
    return saveSchemaJsonFile(
      'Esporta schema di produzione',
      `${sanitizeExportFileName(payload.schema?.name)}.json`,
      payload
    );
  })
);
ipcMain.handle(
  'production:import',
  withMainWindow(async () => {
    const opened = await openSchemaJsonFile('Importa schema di produzione');
    if (opened.canceled) return { canceled: true };
    const chain = importProductionChain(opened.payload);
    return { canceled: false, chain, filePath: opened.filePath };
  })
);
ipcMain.handle(
  'production:get',
  withMainWindow((_event, id) => fetchProductionChainDetail(id))
);
ipcMain.handle(
  'production:add-step',
  withMainWindow((_event, chainId, data) => addProductionChainStep(chainId, data))
);
ipcMain.handle(
  'production:update-step',
  withMainWindow((_event, stepId, data) => updateProductionChainStep(stepId, data))
);
ipcMain.handle(
  'production:set-step-marked',
  withMainWindow((_event, stepId, marked) => setProductionStepMarked(stepId, marked))
);
ipcMain.handle(
  'production:set-group-marked',
  withMainWindow((_event, chainId, groupName, marked) =>
    setProductionGroupMarked(chainId, groupName, marked)
  )
);
ipcMain.handle(
  'production:reset-step',
  withMainWindow((_event, stepId) => resetProductionChainStep(stepId))
);
ipcMain.handle(
  'production:delete-step',
  withMainWindow((_event, stepId) => deleteProductionChainStep(stepId))
);
ipcMain.handle(
  'production:reorder-steps',
  withMainWindow((_event, chainId, stepIds) => reorderProductionChainSteps(chainId, stepIds))
);
ipcMain.handle(
  'production:reorder-steps-in-group',
  withMainWindow((_event, chainId, groupName, stepIds) =>
    reorderProductionChainStepsInGroup(chainId, groupName, stepIds)
  )
);
ipcMain.handle(
  'production:reorder-step-groups',
  withMainWindow((_event, chainId, groupKeys) =>
    reorderProductionChainGroups(chainId, groupKeys)
  )
);
ipcMain.handle(
  'production:set-step-group',
  withMainWindow((_event, stepId, groupName) => setProductionStepGroupName(stepId, groupName))
);
ipcMain.handle(
  'production:rename-step-group',
  withMainWindow((_event, chainId, oldGroupName, newGroupName) =>
    renameProductionStepGroup(chainId, oldGroupName, newGroupName)
  )
);
ipcMain.handle(
  'production:set-step-links',
  withMainWindow((_event, consumerStepId, itemSlug, producerStepIds) =>
    setProductionStepInputLinks(consumerStepId, itemSlug, producerStepIds)
  )
);
ipcMain.handle(
  'production:set-extraction-links',
  withMainWindow((_event, consumerStepId, itemSlug, producerExtractionIds) =>
    setProductionStepExtractionLinks(consumerStepId, itemSlug, producerExtractionIds)
  )
);
ipcMain.handle(
  'production:add-extraction',
  withMainWindow((_event, chainId, data) => addMineralExtraction(chainId, data))
);
ipcMain.handle(
  'production:update-extraction',
  withMainWindow((_event, extractionId, data) => updateMineralExtraction(extractionId, data))
);
ipcMain.handle(
  'production:delete-extraction',
  withMainWindow((_event, extractionId) => deleteMineralExtraction(extractionId))
);
ipcMain.handle(
  'production:reset-extraction',
  withMainWindow((_event, extractionId) => resetMineralExtraction(extractionId))
);
ipcMain.handle('energy:all', withMainWindow(() => getEnergyChains()));
ipcMain.handle('energy:create', withMainWindow((_event, data) => saveEnergyChain(data)));
ipcMain.handle(
  'energy:update',
  withMainWindow((_event, id, data) => updateEnergyChain(id, data))
);
ipcMain.handle('energy:delete', withMainWindow((_event, id) => removeEnergyChain(id)));
ipcMain.handle(
  'energy:export',
  withMainWindow(async (_event, id) => {
    const payload = exportEnergyChain(id, { appVersion });
    return saveSchemaJsonFile(
      'Esporta schema energia',
      `${sanitizeExportFileName(payload.schema?.name)}.json`,
      payload
    );
  })
);
ipcMain.handle(
  'energy:import',
  withMainWindow(async () => {
    const opened = await openSchemaJsonFile('Importa schema energia');
    if (opened.canceled) return { canceled: true };
    const chain = importEnergyChain(opened.payload);
    return { canceled: false, chain, filePath: opened.filePath };
  })
);
ipcMain.handle('energy:get', withMainWindow((_event, id) => fetchEnergyChainDetail(id)));
ipcMain.handle('energy:generator-catalog', withMainWindow(() => fetchEnergyGeneratorCatalog()));
ipcMain.handle(
  'energy:add-extraction',
  withMainWindow((_event, chainId, data) => addEnergyChainExtraction(chainId, data))
);
ipcMain.handle(
  'energy:update-extraction',
  withMainWindow((_event, extractionId, data) =>
    updateEnergyChainExtraction(extractionId, data)
  )
);
ipcMain.handle(
  'energy:delete-extraction',
  withMainWindow((_event, extractionId) => deleteEnergyChainExtraction(extractionId))
);
ipcMain.handle(
  'energy:reset-extraction',
  withMainWindow((_event, extractionId) => resetEnergyChainExtraction(extractionId))
);
ipcMain.handle(
  'energy:add-generator',
  withMainWindow((_event, chainId, data) => addEnergyChainGenerator(chainId, data))
);
ipcMain.handle(
  'energy:update-generator',
  withMainWindow((_event, generatorId, data) =>
    updateEnergyChainGenerator(generatorId, data)
  )
);
ipcMain.handle(
  'energy:delete-generator',
  withMainWindow((_event, generatorId) => deleteEnergyChainGenerator(generatorId))
);
ipcMain.handle(
  'energy:reset-generator',
  withMainWindow((_event, generatorId) => resetEnergyChainGenerator(generatorId))
);
ipcMain.handle(
  'energy:set-input-links',
  withMainWindow((_event, generatorId, itemSlug, extractionIds) =>
    setEnergyGeneratorInputLinks(generatorId, itemSlug, extractionIds)
  )
);
ipcMain.handle(
  'energy:set-production-links',
  withMainWindow((_event, generatorId, itemSlug, producerStepIds) =>
    setEnergyGeneratorProductionLinks(generatorId, itemSlug, producerStepIds)
  )
);
