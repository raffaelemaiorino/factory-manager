/**
 * Metadati item — generati da scripts/import-item-details.js
 * Fallback manuale se item-details.json non esiste ancora.
 */

const { getMetadataPatches } = require('./load-item-details');

const FALLBACK_PATCHES = [
  {
    game_id: 'Desc_AluminumScrap_C',
    description:
      "Raffinati dall'allumina. Possono essere fusi per creare lingotti di alluminio per utilizzo industriale.",
  },
];

const generated = getMetadataPatches();
const ITEM_METADATA_PATCHES = generated.length ? generated : FALLBACK_PATCHES;

module.exports = { ITEM_METADATA_PATCHES };
