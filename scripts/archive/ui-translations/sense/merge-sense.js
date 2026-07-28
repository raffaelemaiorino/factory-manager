'use strict';

const fs = require('fs');
const path = require('path');
const en = require('../../_en-flat.json');
const uk = require('../uk');
const th = require('../th');

const keys = Object.keys(en).filter((k) => !k.startsWith('legal.'));

/** Sense-based RTL strings for keys still missing from partial overlays. */
const NEED = require('./need-rtl-translations');

function mergeLocale(code, partial, needKey) {
  const need = NEED[needKey];
  const full = { ...partial, ...need };
  for (const k of keys) {
    if (uk[k] === en[k]) continue;
    if (!full[k]) {
      throw new Error(`${code}: missing ${k}`);
    }
  }
  return full;
}

const dir = __dirname;
const arPartial = JSON.parse(fs.readFileSync(path.join(dir, 'ar-partial.json'), 'utf8'));
const hePartial = JSON.parse(fs.readFileSync(path.join(dir, 'he-partial.json'), 'utf8'));
const faPartial = JSON.parse(fs.readFileSync(path.join(dir, 'fa-partial.json'), 'utf8'));

for (const [code, partial, needKey] of [
  ['ar', arPartial, 'ar'],
  ['he', hePartial, 'he'],
  ['fa', faPartial, 'fa'],
]) {
  const sense = mergeLocale(code, partial, needKey);
  fs.writeFileSync(path.join(dir, `${code}.json`), `${JSON.stringify(sense, null, 2)}\n`);
  console.log(code, Object.keys(sense).length);
}
