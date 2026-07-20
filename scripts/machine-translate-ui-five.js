'use strict';

const fs = require('fs');
const path = require('path');

const enFlat = require('./_en-flat.json');
const keys = Object.keys(enFlat).filter((k) => !k.startsWith('legal.'));

const ENDPOINT = 'https://libretranslate.com/translate';

async function translateText(text, target) {
  if (!text || !text.trim()) return text;
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source: 'en',
      target,
      format: 'text',
    }),
  });
  if (!res.ok) {
    throw new Error(`translate ${target} HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.translatedText ?? text;
}

async function buildLocale(target) {
  const out = {};
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const en = enFlat[key];
    out[key] = await translateText(en, target);
    if ((i + 1) % 20 === 0) {
      console.log(`${target}: ${i + 1}/${keys.length}`);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  return out;
}

async function main() {
  const dir = path.join(__dirname, 'ui-translations');
  fs.mkdirSync(dir, { recursive: true });
  const targets = [
    ['th', 'th'],
    ['ar', 'ar'],
    ['he', 'he'],
    ['fa', 'fa'],
  ];
  for (const [code, target] of targets) {
    const file = path.join(dir, `${code}.js`);
    if (fs.existsSync(file) && !process.env.FORCE_RETRANSLATE) {
      const cur = require(file);
      if (keys.every((k) => typeof cur[k] === 'string' && !cur[k].startsWith('__TODO__'))) {
        console.log(`${code}: skip (exists)`);
        continue;
      }
    }
    console.log(`${code}: translating…`);
    const out = await buildLocale(target);
    fs.writeFileSync(file, `module.exports = ${JSON.stringify(out, null, 2)};\n`);
    console.log(`${code}: done`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
