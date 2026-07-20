'use strict';

const fs = require('fs');
const path = require('path');
const enFlat = require('./_en-flat.json');
const overlayDir = path.join(__dirname, 'ui-locale-overlays');

const packs = ['uk', 'th', 'ar', 'he', 'fa'];

for (const code of packs) {
  const t = require(path.join(__dirname, 'ui-translations', `${code}.js`));
  const out = {};
  for (const key of Object.keys(enFlat)) {
    if (key.startsWith('legal.')) continue;
    if (typeof t[key] !== 'string') {
      throw new Error(`${code}: missing translation for ${key}`);
    }
    out[key] = t[key];
  }
  fs.writeFileSync(path.join(overlayDir, `${code}.json`), `${JSON.stringify(out, null, 2)}\n`);
  console.log(`${code}: ${Object.keys(out).length} overlay keys`);
}
