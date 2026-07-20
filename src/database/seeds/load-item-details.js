const fs = require('fs');
const path = require('path');

const DETAILS_PATH = path.join(__dirname, 'item-details.json');

function loadItemDetails() {
  if (!fs.existsSync(DETAILS_PATH)) {
    return { dataVersion: 0, items: [] };
  }

  return JSON.parse(fs.readFileSync(DETAILS_PATH, 'utf8'));
}

function getMetadataPatches() {
  return loadItemDetails().items.map((item) => ({
    game_id: item.game_id,
    description: item.description,
  }));
}

function getSchemaSeeds() {
  return loadItemDetails()
    .items.filter((item) => item.schemas?.length)
    .map((item) => ({
      game_id: item.game_id,
      schemas: item.schemas,
    }));
}

module.exports = {
  loadItemDetails,
  getMetadataPatches,
  getSchemaSeeds,
  DETAILS_PATH,
};
