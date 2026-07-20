'use strict';

const fs = require('fs');
const path = require('path');
const { collectStringKeys } = require('../src/locales/ui/format');

const uiDir = path.join(__dirname, '..', 'src', 'locales', 'ui');
const enFlat = require('./_en-flat.json');
const it = JSON.parse(fs.readFileSync(path.join(uiDir, 'it.json'), 'utf8'));
const { legalDe, legalFr, legalEs, legalPl, legalPt, legalNl } = require('./ui-legal-locales');

const overlayDir = path.join(__dirname, 'ui-locale-overlays');

function flatToNested(node, flat, prefix = '') {
  if (typeof node === 'string') {
    const v = flat[prefix];
    if (typeof v !== 'string') {
      throw new Error(`Missing flat key: ${prefix}`);
    }
    return v;
  }
  const out = {};
  for (const [key, val] of Object.entries(node)) {
    if (key === '_meta') continue;
    const pathKey = prefix ? `${prefix}.${key}` : key;
    if (typeof val === 'string') {
      out[key] = flat[pathKey];
    } else if (val && typeof val === 'object') {
      out[key] = flatToNested(val, flat, pathKey);
    }
  }
  return out;
}

function legalToFlat(legalFn) {
  const o = {};
  for (const [k, v] of Object.entries(legalFn())) {
    o[`legal.${k}`] = v;
  }
  return o;
}

function loadOverlay(code) {
  const p = path.join(overlayDir, `${code}.json`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function buildFlat(code, legalFn) {
  return { ...enFlat, ...loadOverlay(code), ...legalToFlat(legalFn) };
}

const configs = [
  ['de', { locale: 'de', note: 'App-UI-Texte (kein Satisfactory-Katalog). Sinngemäße Übersetzung.' }, legalDe],
  ['fr', { locale: 'fr', note: 'Textes UI (pas le catalogue Satisfactory). Traduction orientée sens.' }, legalFr],
  ['es', { locale: 'es', note: 'Textos de la UI (no catálogo Satisfactory). Traducción por sentido.' }, legalEs],
  ['pl', { locale: 'pl', note: 'Teksty UI (nie katalog Satisfactory). Tłumaczenie sensu.' }, legalPl],
  ['pt', { locale: 'pt', note: 'Textos da UI (não catálogo Satisfactory). Tradução por sentido.' }, legalPt],
  ['nl', { locale: 'nl', note: 'UI-teksten (geen Satisfactory-catalogus). Vertaling op betekenis.' }, legalNl],
];

const itKeys = collectStringKeys(it).sort();

for (const [code, meta, legalFn] of configs) {
  const flat = buildFlat(code, legalFn);
  const obj = flatToNested(it, flat);
  obj._meta = meta;

  const keys = collectStringKeys(obj).sort();
  const missing = itKeys.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !itKeys.includes(k));
  if (missing.length || extra.length) {
    console.error(`${code}: parity fail missing=${missing.length} extra=${extra.length}`);
    if (missing.length) console.error(missing.slice(0, 6).join(', '));
    process.exitCode = 1;
    continue;
  }

  fs.writeFileSync(path.join(uiDir, `${code}.json`), `${JSON.stringify(obj, null, 2)}\n`);
  console.log(`${code}: ${keys.length} keys OK`);
}

module.exports = { buildFlat, flatToNested };
