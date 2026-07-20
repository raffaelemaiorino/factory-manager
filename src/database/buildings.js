const { loadSeedData, DATA_VERSION } = require('./seeds/buildings');

const SOMERSLOOP_SLOTS_BY_SLUG = {
  smelter: 1,
  constructor: 1,
  assembler: 2,
  foundry: 2,
  refinery: 2,
  converter: 2,
  manufacturer: 4,
  blender: 4,
  'particle-accelerator': 4,
  'quantum-encoder': 4,
};

function getSomersloopSlotsForBuilding(building) {
  if (building?.somersloop_slots != null) {
    return Math.max(0, Number(building.somersloop_slots) || 0);
  }
  return SOMERSLOOP_SLOTS_BY_SLUG[building?.slug] ?? 0;
}

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

function ensureBuildingColumns(db) {
  const info = db.exec('PRAGMA table_info(buildings)')[0]?.values ?? [];
  const cols = new Set(info.map((row) => row[1]));

  if (!cols.has('game_id')) {
    db.run('ALTER TABLE buildings ADD COLUMN game_id TEXT');
  }
  if (!cols.has('image')) {
    db.run('ALTER TABLE buildings ADD COLUMN image TEXT');
  }
  if (!cols.has('somersloop_slots')) {
    db.run('ALTER TABLE buildings ADD COLUMN somersloop_slots INTEGER NOT NULL DEFAULT 0');
  }
}

function seedBuildings(db, persist, { force = false } = {}) {
  ensureBuildingColumns(db);

  const { buildings } = loadSeedData();
  if (!buildings.length) {
    return { seeded: false, count: 0 };
  }

  if (force) {
    db.run('DELETE FROM buildings');
  }

  for (const building of buildings) {
    const somersloopSlots = getSomersloopSlotsForBuilding(building);
    db.run(
      `INSERT INTO buildings (slug, name, category, game_id, image, somersloop_slots)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(slug) DO UPDATE SET
         name = excluded.name,
         category = excluded.category,
         game_id = excluded.game_id,
         image = excluded.image,
         somersloop_slots = excluded.somersloop_slots`,
      [
        building.slug,
        building.name,
        building.category,
        building.game_id,
        building.image,
        somersloopSlots,
      ]
    );
  }

  persist();
  return { seeded: true, count: buildings.length };
}

function getBuildingBySlug(db, slug) {
  if (!slug) return null;
  ensureBuildingColumns(db);
  return queryOne(
    db,
    `SELECT id, slug, name, category, game_id, image, power_consumption, somersloop_slots
     FROM buildings
     WHERE slug = ?`,
    [slug]
  );
}

function getAllBuildings(db) {
  ensureBuildingColumns(db);
  const stmt = db.prepare(
    `SELECT id, slug, name, category, game_id, image, power_consumption, somersloop_slots
     FROM buildings
     ORDER BY name ASC`
  );
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

module.exports = {
  loadSeedData,
  DATA_VERSION,
  seedBuildings,
  getBuildingBySlug,
  getAllBuildings,
  ensureBuildingColumns,
};
