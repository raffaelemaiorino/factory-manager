const fs = require('fs');
const path = require('path');

const DATA_VERSION = 2;
const seedPath = path.join(__dirname, 'items.json');

function loadSeedData() {
  const raw = fs.readFileSync(seedPath, 'utf8');
  return JSON.parse(raw);
}

module.exports = { loadSeedData, DATA_VERSION };
