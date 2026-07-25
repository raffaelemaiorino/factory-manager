const fs = require('fs');
const path = require('path');

const FILE_NAME = 'production-ui-state.json';
const MAX_UI_STATE_BYTES = 512 * 1024;
const MAX_CHAIN_KEYS = 500;
const MAX_NESTED_KEYS = 2000;

function getFilePath(userDataPath) {
  return path.join(userDataPath, FILE_NAME);
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeViewMap(raw, maxKeys) {
  if (!isPlainObject(raw)) return {};
  const out = Object.create(null);
  let count = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (count >= maxKeys) break;
    const safeKey = String(key).slice(0, 120);
    if (!safeKey || safeKey === '__proto__' || safeKey === 'constructor') continue;
    if (value === 'collapsed' || value === 'compressed') {
      out[safeKey] = value;
      count += 1;
    }
  }
  return out;
}

function sanitizeProductionUiState(data) {
  if (!isPlainObject(data)) return {};

  const out = Object.create(null);
  let chainCount = 0;
  for (const [chainId, chainState] of Object.entries(data)) {
    if (chainCount >= MAX_CHAIN_KEYS) break;
    const safeId = String(chainId).slice(0, 64);
    if (!safeId || safeId === '__proto__' || safeId === 'constructor') continue;
    if (!isPlainObject(chainState)) continue;

    const groups = sanitizeViewMap(chainState.groups, MAX_NESTED_KEYS);
    const steps = sanitizeViewMap(chainState.steps, MAX_NESTED_KEYS);
    if (!Object.keys(groups).length && !Object.keys(steps).length) continue;

    out[safeId] = { groups, steps };
    chainCount += 1;
  }
  return out;
}

function loadProductionUiState(userDataPath) {
  if (!userDataPath) return {};

  try {
    const filePath = getFilePath(userDataPath);
    const size = fs.statSync(filePath).size;
    if (size > MAX_UI_STATE_BYTES) return {};

    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return sanitizeProductionUiState(parsed);
  } catch (err) {
    if (err && err.code === 'ENOENT') return {};
    return {};
  }
}

function saveProductionUiState(userDataPath, data) {
  if (!userDataPath) return;

  const filePath = getFilePath(userDataPath);
  const payload = sanitizeProductionUiState(data);

  if (!Object.keys(payload).length) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      if (!err || err.code !== 'ENOENT') throw err;
    }
    return;
  }

  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_UI_STATE_BYTES) {
    return;
  }

  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, serialized, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

module.exports = {
  loadProductionUiState,
  saveProductionUiState,
  sanitizeProductionUiState,
};
