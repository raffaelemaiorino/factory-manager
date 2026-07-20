/**
 * Schemi di crafting per item — seed di prova: Detriti di alluminio
 * Dati da https://satisfactory-calculator.com/it/items/detail/id/Desc_AluminumScrap_C
 */

const ALUMINUM_SCRAP_GAME_ID = 'Desc_AluminumScrap_C';

const ALUMINUM_SCRAP_SCHEMAS = [
  {
    name: 'Detriti di alluminio',
    is_alternative: 0,
    building_name: 'Raffineria',
    building_slug: 'refinery',
    duration: 4,
    sort_order: 0,
    inputs: [
      { slot: 1, item_slug: 'alumina-solution', amount: 4, is_fluid: 1 },
      { slot: 2, item_slug: 'coal', amount: 2, is_fluid: 0 },
    ],
    outputs: [
      { slot: 1, item_slug: 'aluminum-scrap', amount: 6, is_fluid: 0 },
      { slot: 2, item_slug: 'water', amount: 2, is_fluid: 1 },
    ],
  },
  {
    name: 'Alternativo: Detriti di alluminio a elettrodi',
    is_alternative: 1,
    building_name: 'Raffineria',
    building_slug: 'refinery',
    duration: 4,
    sort_order: 1,
    inputs: [
      { slot: 1, item_slug: 'alumina-solution', amount: 12, is_fluid: 1 },
      { slot: 2, item_slug: 'petroleum-coke', amount: 4, is_fluid: 0 },
    ],
    outputs: [
      { slot: 1, item_slug: 'aluminum-scrap', amount: 20, is_fluid: 0 },
      { slot: 2, item_slug: 'water', amount: 7, is_fluid: 1 },
    ],
  },
  {
    name: 'Alternativo: Detriti istantanei',
    is_alternative: 1,
    building_name: 'Miscelatore',
    building_slug: 'blender',
    duration: 4,
    sort_order: 2,
    inputs: [
      { slot: 1, item_slug: 'ore-bauxite', amount: 15, is_fluid: 0 },
      { slot: 2, item_slug: 'coal', amount: 10, is_fluid: 0 },
      { slot: 3, item_slug: 'sulfuric-acid', amount: 5, is_fluid: 1 },
      { slot: 4, item_slug: 'water', amount: 5, is_fluid: 1 },
    ],
    outputs: [
      { slot: 1, item_slug: 'aluminum-scrap', amount: 30, is_fluid: 0 },
      { slot: 2, item_slug: 'water', amount: 5, is_fluid: 1 },
    ],
  },
];

module.exports = { ALUMINUM_SCRAP_GAME_ID, ALUMINUM_SCRAP_SCHEMAS };
