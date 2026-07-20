'use strict';

/**
 * Sostituisce placeholder {name} nei template UI.
 * @param {string} template
 * @param {Record<string, string|number>} [vars]
 */
function interpolate(template, vars = {}) {
  if (typeof template !== 'string') return '';
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match
  );
}

/** Elenco chiavi foglia stringa (escluso _meta) per validazione parità locale. */
function collectStringKeys(obj, prefix = '', out = []) {
  if (!obj || typeof obj !== 'object') return out;
  for (const [key, value] of Object.entries(obj)) {
    if (key === '_meta') continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      collectStringKeys(value, path, out);
    } else if (typeof value === 'string') {
      out.push(path);
    }
  }
  return out;
}

module.exports = {
  interpolate,
  collectStringKeys,
};
