'use strict';

/**
 * Build ar/he/fa flat modules from complete uk.js + sense tables.
 * Keys where uk matches en (brands/units) stay as en.
 */
const fs = require('fs');
const path = require('path');
const en = require('../_en-flat.json');
const uk = require('./uk');
const { arSense, heSense, faSense } = require('./rtl-sense-maps');

const keys = Object.keys(en).filter((k) => !k.startsWith('legal.'));

function build(sense, localeLabel) {
  const out = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(sense, k)) {
      out[k] = sense[k];
    } else if (uk[k] === en[k]) {
      out[k] = en[k];
    } else {
      throw new Error(`Missing sense translation: ${k}`);
    }
  }
  out['app.localeLabel'] = localeLabel;
  return out;
}

const dir = __dirname;
for (const [code, sense, label] of [
  ['ar', arSense, 'العربية'],
  ['he', heSense, 'עברית'],
  ['fa', faSense, 'فارسی'],
]) {
  const obj = build(sense, label);
  fs.writeFileSync(path.join(dir, `${code}.js`), `module.exports = ${JSON.stringify(obj, null, 2)};\n`);
  console.log(code, 'keys', Object.keys(obj).length);
}
