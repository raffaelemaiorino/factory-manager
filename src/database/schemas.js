const { getSchemaSeeds } = require('./seeds/load-item-details');
const { ALUMINUM_SCRAP_SCHEMAS } = require('./seeds/aluminum-scrap-schemas');
const { ITEM_SCHEMA_SEEDS } = require('./seeds/ingots-schemas');
const { getBuildingBySlug } = require('./buildings');

function getAllSchemaSeeds() {
  const generated = getSchemaSeeds();
  if (generated.length) return generated;

  return [
    { game_id: 'Desc_AluminumScrap_C', schemas: ALUMINUM_SCRAP_SCHEMAS },
    ...ITEM_SCHEMA_SEEDS,
  ];
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

function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function ensureSchemaTables(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS item_schemas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      is_alternative INTEGER NOT NULL DEFAULT 0,
      building_name TEXT,
      building_slug TEXT,
      duration REAL NOT NULL DEFAULT 4,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS schema_io (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      schema_id INTEGER NOT NULL,
      slot INTEGER NOT NULL CHECK (slot >= 1 AND slot <= 4),
      is_output INTEGER NOT NULL DEFAULT 0,
      item_slug TEXT NOT NULL,
      amount REAL NOT NULL,
      is_fluid INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (schema_id) REFERENCES item_schemas(id) ON DELETE CASCADE,
      UNIQUE (schema_id, is_output, slot)
    );
  `);
}

function insertSchema(db, itemId, schemaDef) {
  db.run(
    `INSERT INTO item_schemas (item_id, name, is_alternative, building_name, building_slug, duration, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      itemId,
      schemaDef.name,
      schemaDef.is_alternative,
      schemaDef.building_name,
      schemaDef.building_slug,
      schemaDef.duration,
      schemaDef.sort_order,
    ]
  );

  const schemaId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

  for (const io of schemaDef.inputs) {
    db.run(
      `INSERT INTO schema_io (schema_id, slot, is_output, item_slug, amount, is_fluid)
       VALUES (?, ?, 0, ?, ?, ?)`,
      [schemaId, io.slot, io.item_slug, io.amount, io.is_fluid ? 1 : 0]
    );
  }

  for (const io of schemaDef.outputs) {
    db.run(
      `INSERT INTO schema_io (schema_id, slot, is_output, item_slug, amount, is_fluid)
       VALUES (?, ?, 1, ?, ?, ?)`,
      [schemaId, io.slot, io.item_slug, io.amount, io.is_fluid ? 1 : 0]
    );
  }
}

function seedSchemas(db, persist, { force = false } = {}) {
  ensureSchemaTables(db);

  let seededCount = 0;
  let itemsSeeded = 0;

  db.run('BEGIN TRANSACTION');
  try {
    if (force) {
      db.run('DELETE FROM schema_io');
      db.run('DELETE FROM item_schemas');
    }

    for (const entry of getAllSchemaSeeds()) {
      const item = queryOne(db, 'SELECT id FROM items WHERE game_id = ?', [entry.game_id]);
      if (!item) continue;

      if (!force) {
        const existing = queryOne(
          db,
          'SELECT id FROM item_schemas WHERE item_id = ? LIMIT 1',
          [item.id]
        );
        if (existing) continue;
      }

      for (const schemaDef of entry.schemas) {
        insertSchema(db, item.id, schemaDef);
        seededCount++;
      }
      itemsSeeded++;
    }

    db.run('COMMIT');
    if (seededCount > 0 || force) persist();
    return { seeded: seededCount > 0 || force, count: seededCount, items: itemsSeeded };
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }
}

function loadSchemaIo(db, schemaId, isOutput) {
  return queryAll(
    db,
    `SELECT sio.slot, sio.amount, sio.is_fluid,
            i.slug AS item_slug, i.name AS item_name, i.image AS item_image
     FROM schema_io sio
     LEFT JOIN items i ON i.slug = sio.item_slug
     WHERE sio.schema_id = ? AND sio.is_output = ?
     ORDER BY sio.slot ASC`,
    [schemaId, isOutput ? 1 : 0]
  );
}

function attachBuildingMeta(db, schema) {
  if (!schema) return schema;
  const building = getBuildingBySlug(db, schema.building_slug);
  return {
    ...schema,
    building_image: building?.image ?? null,
    somersloop_slots: building?.somersloop_slots ?? 0,
  };
}

function getItemSchemaById(db, schemaId) {
  const schema = queryOne(
    db,
    `SELECT id, item_id, name, is_alternative, building_name, building_slug, duration, sort_order
     FROM item_schemas
     WHERE id = ?`,
    [schemaId]
  );
  if (!schema) return null;

  return attachBuildingMeta(db, {
    ...schema,
    is_alternative: !!schema.is_alternative,
    inputs: loadSchemaIo(db, schema.id, false),
    outputs: loadSchemaIo(db, schema.id, true),
  });
}

function getItemSchemas(db, itemId) {
  const schemas = queryAll(
    db,
    `SELECT id, item_id, name, is_alternative, building_name, building_slug, duration, sort_order
     FROM item_schemas
     WHERE item_id = ?
     ORDER BY is_alternative ASC, sort_order ASC`,
    [itemId]
  );

  return schemas.map((schema) =>
    attachBuildingMeta(db, {
      ...schema,
      is_alternative: !!schema.is_alternative,
      inputs: loadSchemaIo(db, schema.id, false),
      outputs: loadSchemaIo(db, schema.id, true),
    })
  );
}

function getItemDetail(db, getItemByIdFn, itemId) {
  const item = getItemByIdFn(db, itemId);
  if (!item) return null;

  const schemas = getItemSchemas(db, itemId);
  const main = schemas.filter((s) => !s.is_alternative);
  const alternatives = schemas.filter((s) => s.is_alternative);

  return { item, schemas, main, alternatives };
}

module.exports = {
  ensureSchemaTables,
  seedSchemas,
  getItemDetail,
  getItemSchemas,
  getItemSchemaById,
};
