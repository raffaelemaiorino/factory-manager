const META_MAX_MACHINES = 'config_max_machines';
const META_MAX_ENERGY_GENERATORS = 'config_max_energy_generators';

const DEFAULT_MAX_MACHINES = 100;
const DEFAULT_MAX_ENERGY_GENERATORS = 600;
/** Tetto assoluto di sicurezza (DoS / valori estremi da IPC). */
const ABSOLUTE_MAX_MACHINES = 10_000;
const ABSOLUTE_MAX_ENERGY_GENERATORS = 10_000;

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

function parsePositiveInt(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(max, n);
}

function getAppSettings(db) {
  return {
    maxMachines: parsePositiveInt(
      getMeta(db, META_MAX_MACHINES),
      DEFAULT_MAX_MACHINES,
      ABSOLUTE_MAX_MACHINES
    ),
    maxEnergyGenerators: parsePositiveInt(
      getMeta(db, META_MAX_ENERGY_GENERATORS),
      DEFAULT_MAX_ENERGY_GENERATORS,
      ABSOLUTE_MAX_ENERGY_GENERATORS
    ),
  };
}

function setAppSettings(db, persist, partial = {}) {
  const current = getAppSettings(db);
  const next = {
    maxMachines:
      partial.maxMachines != null
        ? parsePositiveInt(partial.maxMachines, current.maxMachines, ABSOLUTE_MAX_MACHINES)
        : current.maxMachines,
    maxEnergyGenerators:
      partial.maxEnergyGenerators != null
        ? parsePositiveInt(
            partial.maxEnergyGenerators,
            current.maxEnergyGenerators,
            ABSOLUTE_MAX_ENERGY_GENERATORS
          )
        : current.maxEnergyGenerators,
  };

  setMeta(db, META_MAX_MACHINES, next.maxMachines);
  setMeta(db, META_MAX_ENERGY_GENERATORS, next.maxEnergyGenerators);
  if (persist) persist();
  return next;
}

module.exports = {
  DEFAULT_MAX_MACHINES,
  DEFAULT_MAX_ENERGY_GENERATORS,
  ABSOLUTE_MAX_MACHINES,
  ABSOLUTE_MAX_ENERGY_GENERATORS,
  getAppSettings,
  setAppSettings,
};
