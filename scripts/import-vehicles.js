/**
 * Scarica veicoli da satisfactory-calculator.com/it/vehicles
 * e genera seeds/vehicles.json + immagini in src/renderer/assets/vehicles/
 *
 * Uso: node scripts/import-vehicles.js
 */

const fs = require('fs');
const path = require('path');
const { fetchUrl, fetchBinary } = require('./scim-http');

const SOURCE_URL = 'https://satisfactory-calculator.com/it/vehicles';
const OUTPUT_JSON = path.join(__dirname, '../src/database/seeds/vehicles.json');
const IMAGES_DIR = path.join(__dirname, '../src/renderer/assets/vehicles');
const DATA_VERSION = 2;
const REQUEST_DELAY_MS = 250;

/** Capacità note da wiki/SCIM quando il parser non le trova */
const CAPACITY_FALLBACKS = {
  Desc_FreightWagon_C: { inventory_slots: 32, fluid_capacity: null, cargo_kind: 'solid' },
  // Fluid freight uses same vehicle model with fluid tank in-game; we expose a dedicated seed entry.
  Desc_Tractor_C: { inventory_slots: 25, fluid_capacity: null, cargo_kind: 'solid' },
  Desc_Truck_C: { inventory_slots: 48, fluid_capacity: null, cargo_kind: 'solid' },
  Desc_Explorer_C: { inventory_slots: 30, fluid_capacity: null, cargo_kind: 'solid' },
  Desc_GolfCart_C: { inventory_slots: 24, fluid_capacity: null, cargo_kind: 'solid' },
  Desc_GolfCartGold_C: { inventory_slots: 24, fluid_capacity: null, cargo_kind: 'solid' },
  Desc_DroneTransport_C: { inventory_slots: 9, fluid_capacity: null, cargo_kind: 'solid' },
  Desc_Locomotive_C: { inventory_slots: null, fluid_capacity: null, cargo_kind: 'none' },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeHtml(text) {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\'/g, "'");
}

function gameIdToSlug(gameId) {
  return gameId
    .replace(/^Desc_/, '')
    .replace(/_C$/, '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

function parseVehiclesPage(html) {
  const vehicles = [];
  const regex =
    /<a href="\/it\/vehicles\/detail\/id\/([^"]+)\/name\/[^"]*">\s*<img src="([^"]+)"[^>]*alt="([^"]*)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const gameId = match[1];
    vehicles.push({
      game_id: gameId,
      slug: gameIdToSlug(gameId),
      name: decodeHtml(match[3].trim()),
      image_url: match[2].split('?')[0],
      image: `assets/vehicles/${gameId}.png`,
    });
  }
  return vehicles;
}

function parseInventorySlots(html) {
  const patterns = [
    /Slot(?:s)?\s*(?:d'inventario|di inventario)?[^<]*<\/[^>]+>\s*<[^>]+><strong>(\d+)<\/strong>/i,
    /Ha slot d'inventario\s*(\d+)/i,
    /inventory slots?\s*(\d+)/i,
    /Slot<\/span>\s*<span[^>]*><strong>(\d+)<\/strong>/i,
    /<strong>Slot<\/strong>[\s\S]*?<strong>(\d+)<\/strong>/i,
    /Slot\s*<\/[^>]+>\s*<[^>]*>\s*<strong>(\d+)<\/strong>/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return parseInt(m[1], 10);
  }
  // SCIM list style: "Slot 48"
  const m2 = html.match(/>\s*Slot\s*(\d+)\s*</i);
  if (m2) return parseInt(m2[1], 10);
  return null;
}

function parseFluidCapacity(html) {
  const patterns = [
    /(\d[\d.]*)\s*m³/i,
    /capacità[^<]*fluid[^<]*(\d+)/i,
    /fluid capacity[^<]*(\d+)/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return Math.round(parseFloat(m[1].replace(',', '.')));
  }
  return null;
}

async function downloadImage(url, destPath) {
  if (fs.existsSync(destPath)) return false;
  const data = await fetchBinary(url);
  fs.writeFileSync(destPath, data);
  return true;
}

async function main() {
  console.log('Fetching', SOURCE_URL);
  const listHtml = await fetchUrl(SOURCE_URL);
  let vehicles = parseVehiclesPage(listHtml);
  console.log(`Trovati ${vehicles.length} veicoli`);

  if (vehicles.length < 5) {
    throw new Error(`Troppi pochi veicoli (${vehicles.length})`);
  }

  // Escludi path veicoli dalla lista cargo
  vehicles = vehicles.filter((v) => !/path/i.test(v.game_id) && !/path/i.test(v.slug));

  fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const results = [];
  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];
    process.stdout.write(`\r[${i + 1}/${vehicles.length}] ${v.name}`.padEnd(60));
    try {
      const detailUrl = `https://satisfactory-calculator.com/it/vehicles/detail/id/${v.game_id}/name/${encodeURIComponent(v.name).replace(/%20/g, '+')}`;
      const html = await fetchUrl(detailUrl);
      const fallback = CAPACITY_FALLBACKS[v.game_id] || {};
      let inventorySlots = parseInventorySlots(html);
      let fluidCapacity = parseFluidCapacity(html);
      if (inventorySlots == null) inventorySlots = fallback.inventory_slots ?? null;
      if (fluidCapacity == null) fluidCapacity = fallback.fluid_capacity ?? null;

      let cargoKind = fallback.cargo_kind || 'solid';
      if (fluidCapacity != null && inventorySlots == null) cargoKind = 'fluid';
      if (inventorySlots == null && fluidCapacity == null) cargoKind = fallback.cargo_kind || 'none';

      // Freight wagon: solid by default (fluid variant added below)
      if (v.game_id === 'Desc_FreightWagon_C') {
        cargoKind = 'solid';
        inventorySlots = 32;
        fluidCapacity = null;
      }

      const dest = path.join(IMAGES_DIR, `${v.game_id}.png`);
      try {
        await downloadImage(v.image_url, dest);
      } catch (err) {
        console.error(`\n  img ${v.game_id}: ${err.message}`);
      }

      results.push({
        game_id: v.game_id,
        slug: v.slug,
        name: v.name,
        image: v.image,
        inventory_slots: inventorySlots,
        fluid_capacity: fluidCapacity,
        cargo_kind: cargoKind,
        is_transport: cargoKind !== 'none',
      });
    } catch (err) {
      console.error(`\n  ✗ ${v.slug}: ${err.message}`);
    }
    if (i < vehicles.length - 1) await sleep(REQUEST_DELAY_MS);
  }

  // Vagone merci generico: solidi (32 stack) + fluidi (2400 m³) sullo stesso treno
  const freight = results.find((r) => r.game_id === 'Desc_FreightWagon_C');
  if (freight) {
    freight.slug = 'freight-wagon';
    freight.name = freight.name || 'Vagone merci';
    freight.inventory_slots = 32;
    freight.fluid_capacity = 2400;
    freight.cargo_kind = 'mixed';
    freight.is_transport = true;
  }

  const fluidTruck = results.find((r) => /fluid.?truck/i.test(r.name) || /fluid-truck/i.test(r.slug));
  if (fluidTruck) {
    fluidTruck.cargo_kind = 'fluid';
    fluidTruck.inventory_slots = null;
    if (fluidTruck.fluid_capacity == null) fluidTruck.fluid_capacity = 50;
    fluidTruck.is_transport = true;
  }

  // Solo mezzi utili al trasporto cargo (esclude locomotiva / path)
  const META = {
    tractor: {
      inventory_slots: 25,
      name_it: 'Trattore',
      name_en: 'Tractor',
      unit_label_it: 'trattori',
      unit_label_en: 'tractors',
    },
    truck: {
      inventory_slots: 48,
      name_it: 'Camion',
      name_en: 'Truck',
      unit_label_it: 'camion',
      unit_label_en: 'trucks',
    },
    'fluid-truck': {
      cargo_kind: 'fluid',
      inventory_slots: null,
      fluid_capacity: 50,
      aggregates_per_item: true,
      name_it: 'Fluid Truck',
      name_en: 'Fluid Freight Truck',
      unit_label_it: 'fluid truck',
      unit_label_en: 'fluid trucks',
    },
    explorer: {
      inventory_slots: 30,
      name_it: 'Esploratore',
      name_en: 'Explorer',
      unit_label_it: 'esploratori',
      unit_label_en: 'explorers',
    },
    'cyber-wagon': {
      inventory_slots: 24,
      name_it: 'Cibercarro',
      name_en: 'Cyber Wagon',
      unit_label_it: 'cibercarri',
      unit_label_en: 'cyber wagons',
    },
    'golf-cart': {
      inventory_slots: 24,
      name_it: 'Cibercarro',
      name_en: 'Cyber Wagon',
      unit_label_it: 'cibercarri',
      unit_label_en: 'cyber wagons',
    },
    'testa-bp-wb': {
      slug: 'cyber-wagon',
      inventory_slots: 24,
      name_it: 'Cibercarro',
      name_en: 'Cyber Wagon',
      unit_label_it: 'cibercarri',
      unit_label_en: 'cyber wagons',
    },
    'drone-transport': {
      inventory_slots: 9,
      name_it: 'Drone',
      name_en: 'Drone',
      unit_label_it: 'droni',
      unit_label_en: 'drones',
    },
    'freight-wagon': {
      inventory_slots: 32,
      fluid_capacity: 2400,
      cargo_kind: 'mixed',
      aggregates_per_item: true,
      name_it: 'Vagone merci',
      name_en: 'Freight Car',
      unit_label_it: 'vagoni',
      unit_label_en: 'freight cars',
    },
  };

  const transportVehicles = results
    .filter((r) => r.is_transport && r.cargo_kind !== 'none' && r.slug !== 'freight-wagon-fluid')
    .map((r) => {
      const meta = META[r.slug] || {};
      return {
        ...r,
        ...meta,
        slug: meta.slug || r.slug,
        name: meta.name_it || r.name,
        name_it: meta.name_it || r.name_it || r.name,
        name_en: meta.name_en || r.name_en || r.name,
        aggregates_per_item: meta.aggregates_per_item ?? r.aggregates_per_item ?? false,
      };
    });

  const payload = {
    dataVersion: DATA_VERSION,
    source: SOURCE_URL,
    importedAt: new Date().toISOString(),
    vehicles: transportVehicles,
  };

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(payload, null, 2) + '\n');

  console.log('\nImport veicoli completato!');
  console.log(`  JSON: ${OUTPUT_JSON}`);
  console.log(`  Trasporto: ${transportVehicles.length}`);
  for (const v of transportVehicles) {
    console.log(
      `  - ${v.slug}: kind=${v.cargo_kind} slots=${v.inventory_slots} fluid=${v.fluid_capacity}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
