/**
 * Carica messaggi UI con deep-merge su inglese come fallback.
 * Così le lingue incomplete non mostrano chiavi grezze (es. transport.roundTrip).
 */

const fs = require('fs');
const path = require('path');
const { interpolate, collectStringKeys } = require('./format');

const DEFAULT_LOCALE = 'it';
const FALLBACK_LOCALE = 'en';
const cache = new Map();

function normalizeLocale(locale) {
  if (!locale || typeof locale !== 'string') return DEFAULT_LOCALE;
  const code = locale.trim().toLowerCase().split(/[_-]/)[0];
  if (!/^[a-z]{2,3}$/.test(code)) return DEFAULT_LOCALE;
  return code || DEFAULT_LOCALE;
}

function deepMerge(base, override) {
  if (!override || typeof override !== 'object' || Array.isArray(override)) {
    return override === undefined ? base : override;
  }
  const out = { ...(base && typeof base === 'object' && !Array.isArray(base) ? base : {}) };
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function readLocaleFile(code) {
  const localesRoot = path.resolve(__dirname);
  const candidate = path.resolve(localesRoot, `${code}.json`);
  const relative = path.relative(localesRoot, candidate);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return null;
  }
  if (!fs.existsSync(candidate)) return null;
  return JSON.parse(fs.readFileSync(candidate, 'utf8'));
}

function loadUiMessages(locale = DEFAULT_LOCALE) {
  const code = normalizeLocale(locale);
  if (cache.has(code)) return cache.get(code);

  const english = readLocaleFile(FALLBACK_LOCALE) || {};
  if (code === FALLBACK_LOCALE) {
    cache.set(code, english);
    return english;
  }

  const local = readLocaleFile(code);
  // Priorità: lingua attiva sopra inglese (chiavi mancanti restano in EN)
  const messages = local ? deepMerge(english, local) : english;

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
  if (typeof value !== 'string' && normalizeLocale(locale) !== FALLBACK_LOCALE) {
    value = getByPath(loadUiMessages(FALLBACK_LOCALE), key);
  }
  if (typeof value === 'string') {
    return vars && typeof vars === 'object' ? interpolate(value, vars) : value;
  }
  return key;
}

module.exports = {
  DEFAULT_LOCALE,
  FALLBACK_LOCALE,
  loadUiMessages,
  clearUiMessagesCache,
  hasUiLocalePack,
  listUiLocalePacks,
  t,
  interpolate,
  collectStringKeys,
  deepMerge,
};
