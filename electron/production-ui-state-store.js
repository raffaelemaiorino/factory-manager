const fs = require('fs');
const path = require('path');

const FILE_NAME = 'production-ui-state.json';

function getFilePath(userDataPath) {
  return path.join(userDataPath, FILE_NAME);
}

function loadProductionUiState(userDataPath) {
  if (!userDataPath) return {};

  try {
    const raw = fs.readFileSync(getFilePath(userDataPath), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    if (err && err.code === 'ENOENT') return {};
    return {};
  }
}

function saveProductionUiState(userDataPath, data) {
  if (!userDataPath) return;

  const filePath = getFilePath(userDataPath);
  const payload = data && typeof data === 'object' ? data : {};

  if (!Object.keys(payload).length) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      if (!err || err.code !== 'ENOENT') throw err;
    }
    return;
  }

  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(payload), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

module.exports = {
  loadProductionUiState,
  saveProductionUiState,
};
