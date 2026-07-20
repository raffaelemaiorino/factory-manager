'use strict';

const fs = require('fs');
const path = require('path');
const { collectStringKeys } = require('../src/locales/ui/format');
const enFlat = require('./_en-flat.json');
const { flatToNested } = require('./apply-ui-flats');
const {
  legalUk,
  legalTh,
  legalAr,
  legalHe,
  legalFa,
} = require('./ui-legal-locales-ext');

const uiDir = path.join(__dirname, '..', 'src', 'locales', 'ui');
const overlayDir = path.join(__dirname, 'ui-locale-overlays');
const it = JSON.parse(fs.readFileSync(path.join(uiDir, 'it.json'), 'utf8'));

function legalToFlat(legalFn) {
  const o = {};
  for (const [k, v] of Object.entries(legalFn())) {
    o[`legal.${k}`] = v;
  }
  return o;
}

function loadOverlay(code) {
  return JSON.parse(fs.readFileSync(path.join(overlayDir, `${code}.json`), 'utf8'));
}

function buildFlat(code, legalFn) {
  return { ...enFlat, ...loadOverlay(code), ...legalToFlat(legalFn) };
}

const configs = [
  [
    'uk',
    { locale: 'uk', note: 'Тексти інтерфейсу (не каталог Satisfactory). Переклад за змістом.' },
    legalUk,
  ],
  [
    'th',
    { locale: 'th', note: 'ข้อความ UI ของแอป (ไม่ใช่แคตตาล็อก Satisfactory) แปลตามความหมาย' },
    legalTh,
  ],
  [
    'ar',
    { locale: 'ar', note: 'نصوص واجهة التطبيق (ليست فهرس Satisfactory). ترجمة حسب المعنى.' },
    legalAr,
  ],
  [
    'he',
    { locale: 'he', note: 'מחרוזות ממשק (לא קטלוג Satisfactory). תרגום לפי משמעות.' },
    legalHe,
  ],
  [
    'fa',
    { locale: 'fa', note: 'متن‌های رابط (فهرس Satisfactory نیست). ترجمه بر اساس معنا.' },
    legalFa,
  ],
];

const itKeys = collectStringKeys(it).sort();
const counts = {};

for (const [code, meta, legalFn] of configs) {
  const flat = buildFlat(code, legalFn);
  for (const k of itKeys) {
    if (typeof flat[k] !== 'string') {
      throw new Error(`${code}: missing flat key ${k}`);
    }
  }
  const obj = flatToNested(it, flat);
  obj._meta = meta;
  const keys = collectStringKeys(obj).sort();
  const missing = itKeys.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !itKeys.includes(k));
  if (missing.length || extra.length) {
    throw new Error(`${code}: parity fail missing=${missing.length} extra=${extra.length}`);
  }
  fs.writeFileSync(path.join(uiDir, `${code}.json`), `${JSON.stringify(obj, null, 2)}\n`);
  counts[code] = keys.length;
  console.log(`${code}: ${keys.length} keys OK`);
}

module.exports = { counts };
