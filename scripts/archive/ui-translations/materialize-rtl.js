'use strict';

const fs = require('fs');
const path = require('path');
const en = require('../_en-flat.json');
const uk = require('./uk');

const keys = Object.keys(en).filter((k) => !k.startsWith('legal.'));

function loadOverrides(code) {
  const p = path.join(__dirname, 'sense', `${code}.json`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function build(code, localeLabel) {
  const overrides = loadOverrides(code);
  const out = {};
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(overrides, k)) {
      out[k] = overrides[k];
    } else if (uk[k] === en[k]) {
      out[k] = en[k];
    } else {
      throw new Error(`${code}: missing override for ${k}`);
    }
  }
  out['app.localeLabel'] = localeLabel;
  const mod = path.join(__dirname, `${code}.js`);
  fs.writeFileSync(mod, `module.exports = ${JSON.stringify(out, null, 2)};\n`);
  console.log(code, Object.keys(out).length);
}

for (const [c, label] of [
  ['ar', 'العربية'],
  ['he', 'עברית'],
  ['fa', 'فارسی'],
]) {
  build(c, label);
}
