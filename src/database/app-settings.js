const META_MAX_MACHINES = 'config_max_machines';
const META_MAX_ENERGY_GENERATORS = 'config_max_energy_generators';
const META_NUMBER_FORMAT = 'config_number_format';

const DEFAULT_MAX_MACHINES = 100;
const DEFAULT_MAX_ENERGY_GENERATORS = 600;
const DEFAULT_NUMBER_FORMAT = 'en-US';
const ABS_MAX_MACHINES = 10_000;
const ABS_MAX_ENERGY_GENERATORS = 50_000;

const ALLOWED_NUMBER_FORMATS = new Set(['it', 'en-US']);

function queryOne(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function ensureAppMetaTable(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function getMeta(db, key) {
  ensureAppMetaTable(db);
  const row = queryOne(db, 'SELECT value FROM app_meta WHERE key = ?', [key]);
  return row?.value ?? null;
}

function setMeta(db, key, value) {
  ensureAppMetaTable(db);
  db.run(
    `INSERT INTO app_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, String(value)]
  );
}

function parsePositiveInt(value, fallback, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return fallback;
  if (max != null) return Math.min(max, n);
  return n;
}

function parseNumberFormat(value, fallback = DEFAULT_NUMBER_FORMAT) {
  const raw = String(value ?? '').trim();
  if (raw === 'en' || raw === 'en_US' || raw === 'en-us') return 'en-US';
  if (ALLOWED_NUMBER_FORMATS.has(raw)) return raw;
  return fallback;
}

function getAppSettings(db) {
  return {
    maxMachines: parsePositiveInt(
      getMeta(db, META_MAX_MACHINES),
      DEFAULT_MAX_MACHINES,
      ABS_MAX_MACHINES
    ),
    maxEnergyGenerators: parsePositiveInt(
      getMeta(db, META_MAX_ENERGY_GENERATORS),
      DEFAULT_MAX_ENERGY_GENERATORS,
      ABS_MAX_ENERGY_GENERATORS
    ),
    numberFormat: parseNumberFormat(getMeta(db, META_NUMBER_FORMAT), DEFAULT_NUMBER_FORMAT),
  };
}

function setAppSettings(db, persist, partial = {}) {
  const current = getAppSettings(db);
  const next = {
    maxMachines:
      partial.maxMachines != null
        ? parsePositiveInt(partial.maxMachines, current.maxMachines, ABS_MAX_MACHINES)
        : current.maxMachines,
    maxEnergyGenerators:
      partial.maxEnergyGenerators != null
        ? parsePositiveInt(
            partial.maxEnergyGenerators,
            current.maxEnergyGenerators,
            ABS_MAX_ENERGY_GENERATORS
          )
        : current.maxEnergyGenerators,
    numberFormat:
      partial.numberFormat != null
        ? parseNumberFormat(partial.numberFormat, current.numberFormat)
        : current.numberFormat,
  };

  setMeta(db, META_MAX_MACHINES, next.maxMachines);
  setMeta(db, META_MAX_ENERGY_GENERATORS, next.maxEnergyGenerators);
  setMeta(db, META_NUMBER_FORMAT, next.numberFormat);
  if (persist) persist();
  return next;
}

module.exports = {
  DEFAULT_MAX_MACHINES,
  DEFAULT_MAX_ENERGY_GENERATORS,
  DEFAULT_NUMBER_FORMAT,
  ABS_MAX_MACHINES,
  ABS_MAX_ENERGY_GENERATORS,
  getAppSettings,
  setAppSettings,
};
