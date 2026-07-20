'use strict';

const fs = require('fs');
const path = require('path');

const uiDir = path.join(__dirname, '..', 'src', 'locales', 'ui');
const en = JSON.parse(fs.readFileSync(path.join(uiDir, 'en.json'), 'utf8'));

function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

function deepAssign(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof target[k] === 'object') {
      deepAssign(target[k], v);
    } else {
      target[k] = v;
    }
  }
}

function makePack(meta, patch) {
  const o = clone(en);
  o._meta = meta;
  deepAssign(o, patch);
  return o;
}

module.exports = { en, clone, makePack, uiDir };
