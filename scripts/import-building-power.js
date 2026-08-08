/**
 * Scarica "Potenza usata" (MW) dalle pagine dettaglio SCIM e aggiorna buildings.json.
 * Ignora generatori, Particle Accelerator e edifici con potenza variabile (range).
 *
 * Uso:
 *   node scripts/import-building-power.js
 *   node scripts/import-building-power.js --slug constructor
 */

const fs = require('fs');
const path = require('path');
const { fetchUrl, buildBuildingDetailUrl } = require('./scim-http');

const BUILDINGS_JSON = path.join(__dirname, '../src/database/seeds/buildings.json');
const REQUEST_DELAY_MS = 250;
const DATA_VERSION = 4;

const SKIP_SLUGS = new Set([
  'particle-accelerator',
  'quantum-encoder',
  'converter', // potenza variabile: in seed usiamo il picco (400 MW)
]);
const SKIP_CATEGORIES = new Set(['generatori']);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseItalianNumber(raw) {
  const cleaned = String(raw).trim().replace(/\s/g, '');
  if (!cleaned) return null;
  // IT: 1.500,5 → 1500.5 ; EN-style 1,500.5 → 1500.5
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      return Number(cleaned.replace(/\./g, '').replace(',', '.'));
    }
    return Number(cleaned.replace(/,/g, ''));
  }
  if (cleaned.includes(',')) {
    return Number(cleaned.replace(',', '.'));
  }
  // Thousands with dots: 1.500
  if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    return Number(cleaned.replace(/\./g, ''));
  }
  return Number(cleaned);
}

/**
 * Estrae potenza base in MW da HTML dettaglio edificio.
 * Ritorna null se assente, range variabile, o solo "Potenza generata".
 */
function parsePowerConsumptionMw(html) {
  const text = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ');

  // Es. "Potenza usata 4 MW" (senza nome ricetta tra parentesi subito dopo)
  const simple = text.match(
    /Potenza\s+usata(?!\s*\()\s*([\d.,]+)\s*MW(?:\s*-\s*([\d.,]+)\s*MW)?/i
  );
  if (simple) {
    if (simple[2]) return null; // range sul valore base
    const value = parseItalianNumber(simple[1]);
    return Number.isFinite(value) ? value : null;
  }

  // Solo voci per-ricetta (es. Particle Accelerator / Quantum Encoder)
  const recipePower = /Potenza\s+usata\s*\([^)]+\)\s*([\d.,]+)\s*MW/i.test(text);
  if (recipePower) return null;

  return null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let slug = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--slug' && args[i + 1]) {
      slug = args[i + 1];
      i++;
    }
  }
  return { slug };
}

function shouldFetchPower(building) {
  if (SKIP_SLUGS.has(building.slug)) return false;
  if (SKIP_CATEGORIES.has(building.category)) return false;
  return building.category === 'estrazione' || building.category === 'produzione';
}

async function main() {
  const { slug } = parseArgs();
  const data = JSON.parse(fs.readFileSync(BUILDINGS_JSON, 'utf8'));
  let targets = data.buildings.filter(shouldFetchPower);
  if (slug) {
    targets = targets.filter((b) => b.slug === slug);
  }

  if (!targets.length) {
    throw new Error('Nessun edificio da aggiornare');
  }

  console.log(`Import potenza per ${targets.length} strutture...`);

  const bySlug = new Map(data.buildings.map((b) => [b.slug, b]));
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < targets.length; i++) {
    const building = targets[i];
    const url = buildBuildingDetailUrl(building.game_id, building.name, 'it');
    process.stdout.write(`\r  [${i + 1}/${targets.length}] ${building.slug}          `);

    try {
      const html = await fetchUrl(url);
      const mw = parsePowerConsumptionMw(html);
      const row = bySlug.get(building.slug);
      if (!row) continue;

      if (mw == null) {
        // Nessun valore fisso: non scrivere / lascia 0 implicito
        if ('power_consumption' in row) delete row.power_consumption;
        skipped++;
      } else {
        row.power_consumption = mw;
        updated++;
      }
    } catch (err) {
      errors++;
      console.error(`\n  ✗ ${building.slug}: ${err.message}`);
    }

    if (i < targets.length - 1) await sleep(REQUEST_DELAY_MS);
  }

  console.log('');

  data.dataVersion = Math.max(Number(data.dataVersion) || 0, DATA_VERSION);
  data.importedAt = new Date().toISOString();
  data.source = data.source || 'https://satisfactory-calculator.com/it/buildings';

  fs.writeFileSync(BUILDINGS_JSON, JSON.stringify(data, null, 2) + '\n');

  console.log('Completato.');
  console.log(`  Aggiornati: ${updated}, senza MW fisso: ${skipped}, errori: ${errors}`);
  console.log(`  JSON: ${BUILDINGS_JSON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
