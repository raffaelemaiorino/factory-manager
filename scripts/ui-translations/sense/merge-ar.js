'use strict';

const fs = require('fs');
const path = require('path');

const partial = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'ar-partial.json'), 'utf8')
);
const pack = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'pack', 'need-ar-pack.json'), 'utf8')
);
fs.writeFileSync(
  path.join(__dirname, 'ar.json'),
  `${JSON.stringify({ ...partial, ...pack }, null, 2)}\n`
);
console.log('ar.json', Object.keys({ ...partial, ...pack }).length);
