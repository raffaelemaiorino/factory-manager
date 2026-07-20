/**
 * Schemi di produzione — Lingotti
 * Fonte: https://satisfactory-calculator.com/it/items
 */

const IRON_INGOT_SCHEMAS = [
  {
    name: 'Lingotto di ferro',
    is_alternative: 0,
    building_name: 'Fonderia',
    building_slug: 'smelter',
    duration: 2,
    sort_order: 0,
    inputs: [{ slot: 1, item_slug: 'ore-iron', amount: 1, is_fluid: 0 }],
    outputs: [{ slot: 1, item_slug: 'iron-ingot', amount: 1, is_fluid: 0 }],
  },
  {
    name: 'Alternativo: Lingotto di ferro basilare',
    is_alternative: 1,
    building_name: 'Fucina',
    building_slug: 'foundry',
    duration: 4,
    sort_order: 1,
    inputs: [
      { slot: 1, item_slug: 'ore-iron', amount: 5, is_fluid: 0 },
      { slot: 2, item_slug: 'stone', amount: 8, is_fluid: 0 },
    ],
    outputs: [{ slot: 1, item_slug: 'iron-ingot', amount: 10, is_fluid: 0 }],
  },
  {
    name: 'Alternativo: Lingotto di ferro con infiltrazioni',
    is_alternative: 1,
    building_name: 'Raffineria',
    building_slug: 'refinery',
    duration: 4,
    sort_order: 2,
    inputs: [
      { slot: 1, item_slug: 'ore-iron', amount: 5, is_fluid: 0 },
      { slot: 2, item_slug: 'sulfuric-acid', amount: 1, is_fluid: 1 },
    ],
    outputs: [{ slot: 1, item_slug: 'iron-ingot', amount: 10, is_fluid: 0 }],
  },
  {
    name: 'Alternativo: Lingotto di ferro puro',
    is_alternative: 1,
    building_name: 'Raffineria',
    building_slug: 'refinery',
    duration: 4,
    sort_order: 3,
    inputs: [
      { slot: 1, item_slug: 'ore-iron', amount: 7, is_fluid: 0 },
      { slot: 2, item_slug: 'water', amount: 4, is_fluid: 1 },
    ],
    outputs: [{ slot: 1, item_slug: 'iron-ingot', amount: 13, is_fluid: 0 }],
  },
  {
    name: 'Alternativo: Lingotto in lega di ferro',
    is_alternative: 1,
    building_name: 'Fucina',
    building_slug: 'foundry',
    duration: 4,
    sort_order: 4,
    inputs: [
      { slot: 1, item_slug: 'ore-iron', amount: 8, is_fluid: 0 },
      { slot: 2, item_slug: 'ore-copper', amount: 2, is_fluid: 0 },
    ],
    outputs: [{ slot: 1, item_slug: 'iron-ingot', amount: 15, is_fluid: 0 }],
  },
];

const COPPER_INGOT_SCHEMAS = [
  {
    name: 'Lingotto di rame',
    is_alternative: 0,
    building_name: 'Fonderia',
    building_slug: 'smelter',
    duration: 2,
    sort_order: 0,
    inputs: [{ slot: 1, item_slug: 'ore-copper', amount: 1, is_fluid: 0 }],
    outputs: [{ slot: 1, item_slug: 'copper-ingot', amount: 1, is_fluid: 0 }],
  },
  {
    name: 'Alternativo: Lingotto di rame con infiltrazioni',
    is_alternative: 1,
    building_name: 'Raffineria',
    building_slug: 'refinery',
    duration: 4,
    sort_order: 1,
    inputs: [
      { slot: 1, item_slug: 'ore-copper', amount: 9, is_fluid: 0 },
      { slot: 2, item_slug: 'sulfuric-acid', amount: 5, is_fluid: 1 },
    ],
    outputs: [{ slot: 1, item_slug: 'copper-ingot', amount: 22, is_fluid: 0 }],
  },
  {
    name: 'Alternativo: Lingotto di rame puro',
    is_alternative: 1,
    building_name: 'Raffineria',
    building_slug: 'refinery',
    duration: 4,
    sort_order: 2,
    inputs: [
      { slot: 1, item_slug: 'ore-copper', amount: 6, is_fluid: 0 },
      { slot: 2, item_slug: 'water', amount: 4, is_fluid: 1 },
    ],
    outputs: [{ slot: 1, item_slug: 'copper-ingot', amount: 15, is_fluid: 0 }],
  },
  {
    name: 'Alternativo: Lingotto di rame temperato',
    is_alternative: 1,
    building_name: 'Fucina',
    building_slug: 'foundry',
    duration: 4,
    sort_order: 3,
    inputs: [
      { slot: 1, item_slug: 'ore-copper', amount: 5, is_fluid: 0 },
      { slot: 2, item_slug: 'petroleum-coke', amount: 8, is_fluid: 0 },
    ],
    outputs: [{ slot: 1, item_slug: 'copper-ingot', amount: 12, is_fluid: 0 }],
  },
  {
    name: 'Alternativo: Lingotto in lega di rame',
    is_alternative: 1,
    building_name: 'Fucina',
    building_slug: 'foundry',
    duration: 4,
    sort_order: 4,
    inputs: [
      { slot: 1, item_slug: 'ore-copper', amount: 5, is_fluid: 0 },
      { slot: 2, item_slug: 'ore-iron', amount: 5, is_fluid: 0 },
    ],
    outputs: [{ slot: 1, item_slug: 'copper-ingot', amount: 10, is_fluid: 0 }],
  },
];

const CATERIUM_INGOT_SCHEMAS = [
  {
    name: 'Lingotto di caterium',
    is_alternative: 0,
    building_name: 'Fonderia',
    building_slug: 'smelter',
    duration: 4,
    sort_order: 0,
    inputs: [{ slot: 1, item_slug: 'ore-gold', amount: 3, is_fluid: 0 }],
    outputs: [{ slot: 1, item_slug: 'gold-ingot', amount: 1, is_fluid: 0 }],
  },
  {
    name: 'Alternativo: Lingotto di Caterium con infiltrazioni',
    is_alternative: 1,
    building_name: 'Raffineria',
    building_slug: 'refinery',
    duration: 4,
    sort_order: 1,
    inputs: [
      { slot: 1, item_slug: 'ore-gold', amount: 9, is_fluid: 0 },
      { slot: 2, item_slug: 'sulfuric-acid', amount: 5, is_fluid: 1 },
    ],
    outputs: [{ slot: 1, item_slug: 'gold-ingot', amount: 6, is_fluid: 0 }],
  },
  {
    name: 'Alternativo: Lingotto di Caterium temperato',
    is_alternative: 1,
    building_name: 'Fucina',
    building_slug: 'foundry',
    duration: 4,
    sort_order: 2,
    inputs: [
      { slot: 1, item_slug: 'ore-gold', amount: 6, is_fluid: 0 },
      { slot: 2, item_slug: 'petroleum-coke', amount: 2, is_fluid: 0 },
    ],
    outputs: [{ slot: 1, item_slug: 'gold-ingot', amount: 3, is_fluid: 0 }],
  },
  {
    name: 'Alternativo: Lingotto di caterium puro',
    is_alternative: 1,
    building_name: 'Raffineria',
    building_slug: 'refinery',
    duration: 4,
    sort_order: 3,
    inputs: [
      { slot: 1, item_slug: 'ore-gold', amount: 2, is_fluid: 0 },
      { slot: 2, item_slug: 'water', amount: 2, is_fluid: 1 },
    ],
    outputs: [{ slot: 1, item_slug: 'gold-ingot', amount: 1, is_fluid: 0 }],
  },
];

const STEEL_INGOT_SCHEMAS = [
  {
    name: 'Lingotto di acciaio',
    is_alternative: 0,
    building_name: 'Fucina',
    building_slug: 'foundry',
    duration: 4,
    sort_order: 0,
    inputs: [
      { slot: 1, item_slug: 'ore-iron', amount: 3, is_fluid: 0 },
      { slot: 2, item_slug: 'coal', amount: 3, is_fluid: 0 },
    ],
    outputs: [{ slot: 1, item_slug: 'steel-ingot', amount: 3, is_fluid: 0 }],
  },
  {
    name: 'Alternativo: Lingotto di acciaio compresso',
    is_alternative: 1,
    building_name: 'Fucina',
    building_slug: 'foundry',
    duration: 4,
    sort_order: 1,
    inputs: [
      { slot: 1, item_slug: 'ore-iron', amount: 2, is_fluid: 0 },
      { slot: 2, item_slug: 'compacted-coal', amount: 1, is_fluid: 0 },
    ],
    outputs: [{ slot: 1, item_slug: 'steel-ingot', amount: 4, is_fluid: 0 }],
  },
  {
    name: 'Alternativo: Lingotto di acciaio e coke',
    is_alternative: 1,
    building_name: 'Fucina',
    building_slug: 'foundry',
    duration: 4,
    sort_order: 2,
    inputs: [
      { slot: 1, item_slug: 'ore-iron', amount: 15, is_fluid: 0 },
      { slot: 2, item_slug: 'petroleum-coke', amount: 15, is_fluid: 0 },
    ],
    outputs: [{ slot: 1, item_slug: 'steel-ingot', amount: 20, is_fluid: 0 }],
  },
  {
    name: 'Alternativo: Lingotto di acciaio massiccio',
    is_alternative: 1,
    building_name: 'Fucina',
    building_slug: 'foundry',
    duration: 4,
    sort_order: 3,
    inputs: [
      { slot: 1, item_slug: 'iron-ingot', amount: 2, is_fluid: 0 },
      { slot: 2, item_slug: 'coal', amount: 2, is_fluid: 0 },
    ],
    outputs: [{ slot: 1, item_slug: 'steel-ingot', amount: 3, is_fluid: 0 }],
  },
];

const ALUMINUM_INGOT_SCHEMAS = [
  {
    name: 'Lingotto di alluminio',
    is_alternative: 0,
    building_name: 'Fucina',
    building_slug: 'foundry',
    duration: 4,
    sort_order: 0,
    inputs: [
      { slot: 1, item_slug: 'aluminum-scrap', amount: 6, is_fluid: 0 },
      { slot: 2, item_slug: 'silica', amount: 5, is_fluid: 0 },
    ],
    outputs: [{ slot: 1, item_slug: 'aluminum-ingot', amount: 4, is_fluid: 0 }],
  },
  {
    name: 'Alternativo: Lingotto di alluminio puro',
    is_alternative: 1,
    building_name: 'Fonderia',
    building_slug: 'smelter',
    duration: 2,
    sort_order: 1,
    inputs: [{ slot: 1, item_slug: 'aluminum-scrap', amount: 2, is_fluid: 0 }],
    outputs: [{ slot: 1, item_slug: 'aluminum-ingot', amount: 1, is_fluid: 0 }],
  },
];

const FICSITE_INGOT_SCHEMAS = [
  {
    name: 'Lingotto di Ficsite (alluminio)',
    is_alternative: 0,
    building_name: 'Convertitore',
    building_slug: 'converter',
    duration: 4,
    sort_order: 0,
    inputs: [
      { slot: 1, item_slug: 'samingot', amount: 2, is_fluid: 0 },
      { slot: 2, item_slug: 'aluminum-ingot', amount: 4, is_fluid: 0 },
    ],
    outputs: [{ slot: 1, item_slug: 'ficsite-ingot', amount: 1, is_fluid: 0 }],
  },
  {
    name: 'Lingotto di Ficsite (caterium)',
    is_alternative: 0,
    building_name: 'Convertitore',
    building_slug: 'converter',
    duration: 4,
    sort_order: 1,
    inputs: [
      { slot: 1, item_slug: 'samingot', amount: 3, is_fluid: 0 },
      { slot: 2, item_slug: 'gold-ingot', amount: 4, is_fluid: 0 },
    ],
    outputs: [{ slot: 1, item_slug: 'ficsite-ingot', amount: 1, is_fluid: 0 }],
  },
  {
    name: 'Lingotto di Ficsite (ferro)',
    is_alternative: 0,
    building_name: 'Convertitore',
    building_slug: 'converter',
    duration: 4,
    sort_order: 2,
    inputs: [
      { slot: 1, item_slug: 'samingot', amount: 4, is_fluid: 0 },
      { slot: 2, item_slug: 'iron-ingot', amount: 24, is_fluid: 0 },
    ],
    outputs: [{ slot: 1, item_slug: 'ficsite-ingot', amount: 1, is_fluid: 0 }],
  },
];

const ITEM_SCHEMA_SEEDS = [
  { game_id: 'Desc_IronIngot_C', schemas: IRON_INGOT_SCHEMAS },
  { game_id: 'Desc_CopperIngot_C', schemas: COPPER_INGOT_SCHEMAS },
  { game_id: 'Desc_GoldIngot_C', schemas: CATERIUM_INGOT_SCHEMAS },
  { game_id: 'Desc_SteelIngot_C', schemas: STEEL_INGOT_SCHEMAS },
  { game_id: 'Desc_AluminumIngot_C', schemas: ALUMINUM_INGOT_SCHEMAS },
  { game_id: 'Desc_FicsiteIngot_C', schemas: FICSITE_INGOT_SCHEMAS },
];

module.exports = { ITEM_SCHEMA_SEEDS };
