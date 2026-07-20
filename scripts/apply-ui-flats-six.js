'use strict';

const fs = require('fs');
const path = require('path');
const { collectStringKeys } = require('../src/locales/ui/format');
const { flatToNested } = require('./apply-ui-flats');
const {
  legalRu,
  legalJa,
  legalKo,
  legalZh,
  legalCs,
  legalDa,
} = require('./ui-legal-locales-rux');

const uiDir = path.join(__dirname, '..', 'src', 'locales', 'ui');
const it = JSON.parse(fs.readFileSync(path.join(uiDir, 'it.json'), 'utf8'));
const overlayDir = path.join(__dirname, 'ui-locale-overlays');

function loadOverlay(code) {
  return JSON.parse(fs.readFileSync(path.join(overlayDir, `${code}.json`), 'utf8'));
}

function legalToFlat(legalFn) {
  const o = {};
  for (const [k, v] of Object.entries(legalFn())) {
    o[`legal.${k}`] = v;
  }
  return o;
}

const configs = [
  ['ru', { locale: 'ru', note: 'Тексты интерфейса (не каталог Satisfactory). Перевод по смыслу.' }, legalRu],
  ['ja', { locale: 'ja', note: 'アプリUI文言（Satisfactoryカタログではありません）。意訳。' }, legalJa],
  ['ko', { locale: 'ko', note: '앱 UI 문자열(Satisfactory 카탈로그 아님). 의역.' }, legalKo],
  ['zh', { locale: 'zh', note: '应用界面文案（非 Satisfactory 物品目录）。意译。' }, legalZh],
  ['cs', { locale: 'cs', note: 'Texty UI (ne katalog Satisfactory). Překlad podle smyslu.' }, legalCs],
  ['da', { locale: 'da', note: 'UI-tekster (ikke Satisfactory-katalog). Meningsbaseret oversættelse.' }, legalDa],
];

const itKeys = collectStringKeys(it).sort();

for (const [code, meta, legalFn] of configs) {
  const enFlat = require('./_en-flat.json');
  const flat = { ...enFlat, ...loadOverlay(code), ...legalToFlat(legalFn) };
  const obj = flatToNested(it, flat);
  obj._meta = meta;

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
  console.log(`${code}: ${keys.length} keys OK`);
}
