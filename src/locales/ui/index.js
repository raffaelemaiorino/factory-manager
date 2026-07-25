/**
 * Stringhe UI dell'app (separate dal catalogo di gioco in database/i18n.js).
 * Uso futuro: t('app.name') dopo aver caricato il locale attivo.
 */

const fs = require('fs');
const path = require('path');
const { interpolate, collectStringKeys } = require('./format');

const DEFAULT_LOCALE = 'it';
const LOCALE_CODE_RE = /^[a-z]{2}$/;
const cache = new Map();
const UI_LOCALES_ROOT = path.resolve(__dirname);

function isSafeLocaleCode(code) {
  return typeof code === 'string' && LOCALE_CODE_RE.test(code);
}

function normalizeLocale(locale) {
  if (!locale || typeof locale !== 'string') return DEFAULT_LOCALE;
  const code = locale.trim().toLowerCase().split(/[_-]/)[0] || DEFAULT_LOCALE;
  return isSafeLocaleCode(code) ? code : DEFAULT_LOCALE;
}

/** Path confinato sotto la cartella UI; null se fuori o codice non valido. */
function resolveUiLocaleFile(code) {
  if (!isSafeLocaleCode(code)) return null;
  const filePath = path.resolve(UI_LOCALES_ROOT, `${code}.json`);
  const relative = path.relative(UI_LOCALES_ROOT, filePath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  return filePath;
}

function loadUiMessages(locale = DEFAULT_LOCALE) {
  const code = normalizeLocale(locale);
  if (cache.has(code)) return cache.get(code);

  const candidates = [
    resolveUiLocaleFile(code),
    code !== 'en' ? resolveUiLocaleFile('en') : null,
    resolveUiLocaleFile(DEFAULT_LOCALE),
  ].filter(Boolean);

  let target = null;
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      target = candidate;
      break;
    }
  }

  if (!target) {
    throw new Error('Pacchetti UI locale mancanti');
  }

  const messages = JSON.parse(fs.readFileSync(target, 'utf8'));
  cache.set(code, messages);
  return messages;
}

function clearUiMessagesCache() {
  cache.clear();
}

function hasUiLocalePack(locale) {
  const code = normalizeLocale(locale);
  const filePath = resolveUiLocaleFile(code);
  return Boolean(filePath && fs.existsSync(filePath));
}

function listUiLocalePacks() {
  return fs
    .readdirSync(__dirname)
    .filter((name) => name.endsWith('.json') && name !== 'package.json')
    .map((name) => name.replace(/\.json$/, ''))
    .filter((code) => code !== '_meta' && isSafeLocaleCode(code));
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
  normalizeLocale,
  isSafeLocaleCode,
  t,
  interpolate,
  collectStringKeys,
};
