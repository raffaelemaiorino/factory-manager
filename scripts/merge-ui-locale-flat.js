'use strict';

const fs = require('fs');
const path = require('path');
const { collectStringKeys } = require('../src/locales/ui/format');

const uiDir = path.join(__dirname, '..', 'src', 'locales', 'ui');

function setByPath(obj, keyPath, value) {
  if (Object.prototype.hasOwnProperty.call(obj, keyPath)) {
    obj[keyPath] = value;
    return;
  }
  const parts = keyPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length; i++) {
    const rest = parts.slice(i).join('.');
    if (cur && typeof cur === 'object' && Object.prototype.hasOwnProperty.call(cur, rest)) {
      cur[rest] = value;
      return;
    }
    const part = parts[i];
    if (i === parts.length - 1) {
      cur[part] = value;
      return;
    }
    if (!cur[part] || typeof cur[part] !== 'object') cur[part] = {};
    cur = cur[part];
  }
}

function buildFromFlat(flat, meta) {
  const it = JSON.parse(fs.readFileSync(path.join(uiDir, 'it.json'), 'utf8'));
  const out = JSON.parse(JSON.stringify(it));
  out._meta = meta;
  for (const [keyPath, value] of Object.entries(flat)) {
    setByPath(out, keyPath, value);
  }
  return out;
}

function verify(code, obj) {
  const itKeys = collectStringKeys(JSON.parse(fs.readFileSync(path.join(uiDir, 'it.json'), 'utf8'))).sort();
  const keys = collectStringKeys(obj).sort();
  const missing = itKeys.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !itKeys.includes(k));
  if (missing.length || extra.length) {
    console.error(`${code}: missing ${missing.length}, extra ${extra.length}`);
    if (missing.length) console.error('  missing:', missing.slice(0, 5));
    if (extra.length) console.error('  extra:', extra.slice(0, 5));
    process.exitCode = 1;
  }
  console.log(`${code}: ${keys.length} keys`);
}

module.exports = { buildFromFlat, verify, uiDir };

if (require.main === module) {
  const code = process.argv[2];
  const flatPath = process.argv[3];
  if (!code || !flatPath) {
    console.error('Usage: node merge-ui-locale-flat.js <code> <flat.json>');
    process.exit(1);
  }
  const flat = JSON.parse(fs.readFileSync(flatPath, 'utf8'));
  const meta = flat._meta;
  delete flat._meta;
  const obj = buildFromFlat(flat, meta);
  fs.writeFileSync(path.join(uiDir, `${code}.json`), `${JSON.stringify(obj, null, 2)}\n`);
  verify(code, obj);
}
