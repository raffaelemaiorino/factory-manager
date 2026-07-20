'use strict';

const fs = require('fs');
const path = require('path');
const { collectStringKeys } = require('../src/locales/ui/format');
const { flatToNested } = require('./apply-ui-flats');
const enFlat = require('./_en-flat.json');
const it = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'locales', 'ui', 'it.json'), 'utf8')
);
const {
  legalFi,
  legalHu,
  legalNo,
  legalSk,
  legalSv,
  legalTr,
} = require('./ui-legal-locales-six');

const overlayDir = path.join(__dirname, 'ui-locale-overlays');
const uiDir = path.join(__dirname, '..', 'src', 'locales', 'ui');

function legalToFlat(legalFn) {
  const o = {};
  for (const [k, v] of Object.entries(legalFn())) {
    o[`legal.${k}`] = v;
  }
  return o;
}

function buildFlat(code, legalFn) {
  const overlay = JSON.parse(fs.readFileSync(path.join(overlayDir, `${code}.json`), 'utf8'));
  return { ...enFlat, ...overlay, ...legalToFlat(legalFn) };
}

const configs = [
  [
    'fi',
    { locale: 'fi', note: 'Sovelluksen UI-tekstit (ei Satisfactory-luetteloa). Merkityspohjainen käännös.' },
    legalFi,
  ],
  [
    'hu',
    { locale: 'hu', note: 'Alkalmazás UI szövegei (nem Satisfactory katalógus). Értelem szerinti fordítás.' },
    legalHu,
  ],
  [
    'no',
    { locale: 'no', note: 'UI-tekster for appen (ikke Satisfactory-katalog). Meningsbasert oversettelse.' },
    legalNo,
  ],
  [
    'sk',
    { locale: 'sk', note: 'Texty UI aplikácie (nie katalóg Satisfactory). Preklad podľa významu.' },
    legalSk,
  ],
  [
    'sv',
    { locale: 'sv', note: 'UI-texter för appen (inte Satisfactory-katalog). Meningsbaserad översättning.' },
    legalSv,
  ],
  [
    'tr',
    { locale: 'tr', note: 'Uygulama arayüz metinleri (Satisfactory kataloğu değil). Anlam odaklı çeviri.' },
    legalTr,
  ],
];

const itKeys = collectStringKeys(it).sort();
const counts = {};

for (const [code, meta, legalFn] of configs) {
  const flat = buildFlat(code, legalFn);
  const body = flatToNested(it, flat);
  const obj = { _meta: meta, ...body };

  const keys = collectStringKeys(obj).sort();
  const missing = itKeys.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !itKeys.includes(k));
  if (missing.length || extra.length) {
    console.error(`${code}: parity fail missing=${missing.length} extra=${extra.length}`);
    if (missing.length) console.error(missing.slice(0, 8).join(', '));
    process.exitCode = 1;
    continue;
  }

  fs.writeFileSync(path.join(uiDir, `${code}.json`), `${JSON.stringify(obj, null, 2)}\n`);
  counts[code] = keys.length;
  console.log(`${code}: ${keys.length} keys OK`);
}

if (!process.exitCode) {
  console.log('counts', JSON.stringify(counts));
}
