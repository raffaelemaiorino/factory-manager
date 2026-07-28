'use strict';

const fs = require('fs');
const path = require('path');
const en = require('../_en-flat.json');
const uk = require('./uk');

const keys = Object.keys(en).filter((k) => !k.startsWith('legal.'));

const TARGETS = {
  ar: 'en|ar',
  he: 'en|he',
  fa: 'en|fa',
};

async function translate(q, pair) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q.slice(0, 500))}&langpair=${pair}`;
  for (let a = 0; a < 12; a++) {
    const res = await fetch(url);
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 4000 + a * 2000));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${q.slice(0, 40)}`);
    const data = await res.json();
    const t = data.responseData?.translatedText;
    if (t && t !== q) return t;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return q;
}

async function build(code, pair) {
  const existingPath = path.join(__dirname, `${code}.js`);
  let base = {};
  if (fs.existsSync(existingPath)) {
    base = require(existingPath);
  }
  const partialPath = path.join(__dirname, 'partial', `${code}-fill.json`);
  fs.mkdirSync(path.dirname(partialPath), { recursive: true });
  let partial = {};
  if (fs.existsSync(partialPath)) partial = JSON.parse(fs.readFileSync(partialPath, 'utf8'));

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (partial[key]) {
      base[key] = partial[key];
      continue;
    }
    const cur = base[key];
    const stillEn = cur === en[key];
    const stillUk = cur && /[\u0400-\u04FF]/.test(cur);
    if (!stillEn && !stillUk && cur) {
      partial[key] = cur;
      continue;
    }
    const src = en[key];
    if (src === base[key] && !stillUk && !stillEn) {
      partial[key] = base[key];
      continue;
    }
    if (!stillEn && !stillUk && cur) {
      partial[key] = cur;
      continue;
    }
    if (src === en[key] && !/[\u0400-\u04FF]/.test(src) && (stillEn || !cur)) {
      /* brand / unchanged English */
      if (
        !stillUk &&
        (key.includes('Miner') ||
          src === 'Factory Manager' ||
          src === 'FACTORY MANAGER' ||
          src === 'Dashboard' ||
          src === 'Info' ||
          src.startsWith('Miner Mk') ||
          src.includes('FICSIT') ||
          src.includes('Somersloop') ||
          src.includes('Electron') ||
          src.includes('Node.js') ||
          src === '/min' ||
          src === 'MW' ||
          src.includes('m³'))
      ) {
        base[key] = src;
        partial[key] = src;
        continue;
      }
    }
    const t = await translate(stillUk ? uk[key] || src : src, pair);
    base[key] = t;
    partial[key] = t;
    if ((i + 1) % 3 === 0) {
      fs.writeFileSync(partialPath, `${JSON.stringify(partial, null, 2)}\n`);
      console.log(`${code}: ${i + 1}/${keys.length}`);
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  fs.writeFileSync(partialPath, `${JSON.stringify(partial, null, 2)}\n`);
  fs.writeFileSync(existingPath, `module.exports = ${JSON.stringify(base, null, 2)};\n`);
  console.log(`${code} complete`);
}

const code = process.argv[2] || 'ar';
build(code, TARGETS[code]).catch((e) => {
  console.error(e);
  process.exit(1);
});
