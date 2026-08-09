const fs = require('fs');
const path = require('path');

const DATA_VERSION = 2;
const seedPath = path.join(__dirname, 'vehicles.json');

/** Alias legacy → slug corrente */
const VEHICLE_SLUG_ALIASES = {
  'freight-wagon-fluid': 'freight-wagon',
};

function normalizeVehicleSlug(slug) {
  const key = String(slug || '');
  return VEHICLE_SLUG_ALIASES[key] || key;
}

function loadVehiclesSeed() {
  const raw = fs.readFileSync(seedPath, 'utf8');
  return JSON.parse(raw);
}

function getTransportVehicles() {
  const { vehicles } = loadVehiclesSeed();
  return (vehicles || []).filter((v) => v.is_transport !== false);
}

function getVehicleBySlug(slug) {
  const normalized = normalizeVehicleSlug(slug);
  return getTransportVehicles().find((v) => v.slug === normalized) ?? null;
}

module.exports = {
  DATA_VERSION,
  VEHICLE_SLUG_ALIASES,
  normalizeVehicleSlug,
  loadVehiclesSeed,
  getTransportVehicles,
  getVehicleBySlug,
};
