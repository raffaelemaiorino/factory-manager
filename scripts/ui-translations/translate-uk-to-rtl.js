'use strict';

const fs = require('fs');
const path = require('path');

const uk = require('./uk');
const en = require('../_en-flat.json');
const keys = Object.keys(en).filter((k) => !k.startsWith('legal.'));

const TARGETS = {
  ar: 'en|ar',
  he: 'en|he',
  fa: 'en|fa',
};

async function translate(q, pair) {
  for (let a = 0; a < 8; a++) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${pair}`;
    const res = await fetch(url);
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 5000 * (a + 1)));
      continue;
    }
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    return data.responseData?.translatedText ?? q;
  }
  throw new Error('rate limited');
}

async function buildLocale(code, pair) {
  const partialDir = path.join(__dirname, 'partial');
  fs.mkdirSync(partialDir, { recursive: true });
  const partialPath = path.join(partialDir, `${code}.json`);
  let out = {};
  if (fs.existsSync(partialPath)) out = JSON.parse(fs.readFileSync(partialPath, 'utf8'));

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (typeof out[key] === 'string' && out[key].length) continue;
    const src = uk[key] || en[key];
    out[key] = await translate(src, pair);
    if ((i + 1) % 5 === 0) {
      fs.writeFileSync(partialPath, `${JSON.stringify(out, null, 2)}\n`);
      console.log(`${code}: ${i + 1}/${keys.length}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  fs.writeFileSync(partialPath, `${JSON.stringify(out, null, 2)}\n`);
  fs.writeFileSync(
    path.join(__dirname, `${code}.js`),
    `module.exports = ${JSON.stringify(out, null, 2)};\n`
  );
  console.log(`${code}.js done`);
}

async function main() {
  const only = process.argv[2];
  const list = only ? [only] : Object.keys(TARGETS);
  for (const code of list) {
    await buildLocale(code, TARGETS[code]);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
