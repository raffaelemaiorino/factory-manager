'use strict';

const fs = require('fs');
const path = require('path');
const en = require('../_en-flat.json');
const uk = require('./uk');

const labels = { ar: 'العربية', he: 'עברית', fa: 'فارسی' };

for (const code of ['ar', 'he', 'fa']) {
  const sense = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'sense', `${code}.json`), 'utf8')
  );
  const keys = Object.keys(en).filter((k) => !k.startsWith('legal.'));
  const out = {};
  for (const k of keys) {
    if (uk[k] === en[k]) out[k] = en[k];
    else out[k] = sense[k];
  }
  out['app.localeLabel'] = labels[code];
  fs.writeFileSync(
    path.join(__dirname, `${code}.js`),
    `module.exports = ${JSON.stringify(out, null, 2)};\n`
  );
  console.log(`${code}.js`, Object.keys(out).length);
}
