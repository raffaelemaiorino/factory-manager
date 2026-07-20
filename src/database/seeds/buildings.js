const fs = require('fs');
const path = require('path');

const DATA_VERSION = 3;
const seedPath = path.join(__dirname, 'buildings.json');

function loadSeedData() {
  if (!fs.existsSync(seedPath)) {
    return { dataVersion: 0, categories: [], buildings: [] };
  }
  return JSON.parse(fs.readFileSync(seedPath, 'utf8'));
}

module.exports = { loadSeedData, DATA_VERSION };
