'use strict';

const fs = require('fs');
const path = require('path');

const enFlat = require('./_en-flat.json');
const keys = Object.keys(enFlat).filter((k) => !k.startsWith('legal.'));
const partialDir = path.join(__dirname, 'ui-translations', 'partial');
const outPath = path.join(__dirname, 'ui-translations', 'ar.js');

async function translate(q, pair = 'en|ar') {
  for (let attempt = 0; attempt < 10; attempt++) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=${pair}`;
    const res = await fetch(url);
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.responseData?.translatedText ?? q;
  }
  throw new Error('rate limited');
}

async function main() {
  fs.mkdirSync(partialDir, { recursive: true });
  const partialPath = path.join(partialDir, 'ar.json');
  let out = {};
  if (fs.existsSync(partialPath)) {
    out = JSON.parse(fs.readFileSync(partialPath, 'utf8'));
  }
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (typeof out[key] === 'string' && out[key].length) continue;
    out[key] = await translate(enFlat[key]);
    if ((i + 1) % 5 === 0) {
      fs.writeFileSync(partialPath, `${JSON.stringify(out, null, 2)}\n`);
      console.log(`ar: ${i + 1}/${keys.length}`);
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  fs.writeFileSync(partialPath, `${JSON.stringify(out, null, 2)}\n`);
  fs.writeFileSync(outPath, `module.exports = ${JSON.stringify(out, null, 2)};\n`);
  console.log('ar.js written');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
