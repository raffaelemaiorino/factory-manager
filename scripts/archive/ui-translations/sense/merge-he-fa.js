'use strict';

const fs = require('fs');
const path = require('path');
const en = require('../../_en-flat.json');
const uk = require('../uk');

function merge(code, packName) {
  const partial = JSON.parse(
    fs.readFileSync(path.join(__dirname, `${code}-partial.json`), 'utf8')
  );
  const pack = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'pack', packName), 'utf8')
  );
  const sense = { ...partial, ...pack };
  fs.writeFileSync(
    path.join(__dirname, `${code}.json`),
    `${JSON.stringify(sense, null, 2)}\n`
  );
  const keys = Object.keys(en).filter((k) => !k.startsWith('legal.'));
  let need = 0;
  for (const k of keys) {
    if (uk[k] !== en[k] && !sense[k]) need++;
  }
  console.log(code, 'sense', Object.keys(sense).length, 'gaps', need);
}

merge('he', 'need-he-pack.json');
merge('fa', 'need-fa-pack.json');
