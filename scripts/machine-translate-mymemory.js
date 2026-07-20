'use strict';

const fs = require('fs');
const path = require('path');

const enFlat = require('./_en-flat.json');
const keys = Object.keys(enFlat).filter((k) => !k.startsWith('legal.'));

const PAIRS = {
  th: 'en|th',
  ar: 'en|ar',
  he: 'en|he',
  fa: 'en|fa',
};

const partialDir = path.join(__dirname, 'ui-translations', 'partial');

async function translate(q, pair) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${pair}`;
    const res = await fetch(url);
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text = data.responseData?.translatedText;
    if (!text) throw new Error('no translation');
    return text;
  }
  throw new Error('rate limited');
}

async function build(code, pair) {
  fs.mkdirSync(partialDir, { recursive: true });
  const partialPath = path.join(partialDir, `${code}.json`);
  let out = {};
  if (fs.existsSync(partialPath)) {
    out = JSON.parse(fs.readFileSync(partialPath, 'utf8'));
  }
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (typeof out[key] === 'string' && out[key].length) continue;
    out[key] = await translate(enFlat[key], pair);
    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(partialPath, `${JSON.stringify(out, null, 2)}\n`);
      console.log(`${code}: ${i + 1}/${keys.length}`);
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  fs.writeFileSync(partialPath, `${JSON.stringify(out, null, 2)}\n`);
  return out;
}

async function main() {
  const tables = {};
  for (const code of Object.keys(PAIRS)) {
    console.log(`${code}: start`);
    tables[code] = await build(code, PAIRS[code]);
  }
  fs.writeFileSync(
    path.join(__dirname, 'ui-translations', 'locale-tables.js'),
    `module.exports = ${JSON.stringify(tables, null, 2)};\n`
  );
  console.log('wrote locale-tables.js');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
