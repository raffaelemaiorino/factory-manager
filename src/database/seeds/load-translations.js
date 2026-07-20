const fs = require('fs');
const path = require('path');

const TRANSLATIONS_DIR = path.join(__dirname, 'translations');

function listBundledLocales() {
  if (!fs.existsSync(TRANSLATIONS_DIR)) return [];
  return fs
    .readdirSync(TRANSLATIONS_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.replace(/\.json$/, ''));
}

function loadLocalePack(locale) {
  const filePath = path.join(TRANSLATIONS_DIR, `${locale}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadAllLocalePacks() {
  return listBundledLocales()
    .map((locale) => loadLocalePack(locale))
    .filter(Boolean);
}

module.exports = {
  TRANSLATIONS_DIR,
  listBundledLocales,
  loadLocalePack,
  loadAllLocalePacks,
};
