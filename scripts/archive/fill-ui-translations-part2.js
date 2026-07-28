'use strict';

const fs = require('fs');
const path = require('path');
const enFlat = require('./_en-flat.json');
const { th, ar, he, fa } = require('./ui-translations/locale-tables');

const keys = Object.keys(enFlat).filter((k) => !k.startsWith('legal.'));
const dir = path.join(__dirname, 'ui-translations');

function writeLocale(code, table) {
  const out = {};
  for (const k of keys) {
    if (typeof table[k] !== 'string') {
      throw new Error(`${code}: missing ${k}`);
    }
    out[k] = table[k];
  }
  fs.writeFileSync(path.join(dir, `${code}.js`), `module.exports = ${JSON.stringify(out, null, 2)};\n`);
  console.log(`${code}: ${Object.keys(out).length} keys`);
}

writeLocale('th', th);
writeLocale('ar', ar);
writeLocale('he', he);
writeLocale('fa', fa);
