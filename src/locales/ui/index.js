/**
 * Stringhe UI dell'app (separate dal catalogo di gioco in database/i18n.js).
 * Uso futuro: t('app.name') dopo aver caricato il locale attivo.
 */

const fs = require('fs');
const path = require('path');
const { interpolate, collectStringKeys } = require('./format');

const DEFAULT_LOCALE = 'it';
const cache = new Map();

function normalizeLocale(locale) {
  if (!locale || typeof locale !== 'string') return DEFAULT_LOCALE;
  return locale.trim().toLowerCase().split(/[_-]/)[0] || DEFAULT_LOCALE;
}

function loadUiMessages(locale = DEFAULT_LOCALE) {
  const code = normalizeLocale(locale);
  if (cache.has(code)) return cache.get(code);

  const filePath = path.join(__dirname, `${code}.json`);
  const enPath = path.join(__dirname, 'en.json');
  const fallbackPath = path.join(__dirname, `${DEFAULT_LOCALE}.json`);

  let target = fallbackPath;
  if (fs.existsSync(filePath)) target = filePath;
  else if (code !== 'en' && fs.existsSync(enPath)) target = enPath;

  const messages = JSON.parse(fs.readFileSync(target, 'utf8'));
  cache.set(code, messages);
  return messages;
}

function clearUiMessagesCache() {
  cache.clear();
}

function hasUiLocalePack(locale) {
  const code = normalizeLocale(locale);
  return fs.existsSync(path.join(__dirname, `${code}.json`));
}

function listUiLocalePacks() {
  return fs
    .readdirSync(__dirname)
    .filter((name) => name.endsWith('.json') && name !== 'package.json')
    .map((name) => name.replace(/\.json$/, ''))
    .filter((code) => code !== '_meta');
}

function getByPath(obj, keyPath) {
  if (obj == null || typeof keyPath !== 'string' || !keyPath) return undefined;

  // Chiave piatta esatta (es. legal["sectionAbout.title"])
  if (Object.prototype.hasOwnProperty.call(obj, keyPath)) {
    return obj[keyPath];
  }

  const parts = keyPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length; i++) {
    if (cur == null || typeof cur !== 'object') return undefined;
    const rest = parts.slice(i).join('.');
    if (Object.prototype.hasOwnProperty.call(cur, rest)) {
      return cur[rest];
    }
    const part = parts[i];
    if (!Object.prototype.hasOwnProperty.call(cur, part)) return undefined;
    cur = cur[part];
  }
  return cur;
}

function t(key, locale = DEFAULT_LOCALE, vars) {
  const messages = loadUiMessages(locale);
  let value = getByPath(messages, key);
  if (typeof value !== 'string' && normalizeLocale(locale) !== DEFAULT_LOCALE) {
    value = getByPath(loadUiMessages(DEFAULT_LOCALE), key);
  }
  if (typeof value === 'string') {
    return vars && typeof vars === 'object' ? interpolate(value, vars) : value;
  }
  return key;
}

module.exports = {
  DEFAULT_LOCALE,
  loadUiMessages,
  clearUiMessagesCache,
  hasUiLocalePack,
  listUiLocalePacks,
  t,
  interpolate,
  collectStringKeys,
};
