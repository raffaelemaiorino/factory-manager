const { getVehicleBySlug, getTransportVehicles, normalizeVehicleSlug } = require('./seeds/vehicles');
const { calculateTransportNeed } = require('./transport-calc');

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

function ensureTransportPlansTables(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS transport_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      vehicle_slug TEXT NOT NULL,
      one_way_minutes REAL NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transport_plan_cargo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      item_slug TEXT NOT NULL,
      rate REAL NOT NULL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (plan_id) REFERENCES transport_plans(id) ON DELETE CASCADE
    );
  `);

  const cargoInfo = db.exec('PRAGMA table_info(transport_plan_cargo)')[0]?.values ?? [];
  const cargoCols = new Set(cargoInfo.map((row) => row[1]));
  if (!cargoCols.has('allow_mix')) {
    db.run('ALTER TABLE transport_plan_cargo ADD COLUMN allow_mix INTEGER NOT NULL DEFAULT 0');
  }

  // Unifica vagoni fluidi legacy nel vagone generico (mixed)
  db.run(
    `UPDATE transport_plans SET vehicle_slug = 'freight-wagon'
     WHERE vehicle_slug = 'freight-wagon-fluid'`
  );

  const planInfo = db.exec('PRAGMA table_info(transport_plans)')[0]?.values ?? [];
  const planCols = new Set(planInfo.map((row) => row[1]));
  if (!planCols.has('outbound_minutes')) {
    db.run('ALTER TABLE transport_plans ADD COLUMN outbound_minutes REAL');
  }
  if (!planCols.has('return_minutes')) {
    db.run('ALTER TABLE transport_plans ADD COLUMN return_minutes REAL');
  }
  // Migrazione da one_way_minutes: andata = ritorno = andata legacy
  db.run(`
    UPDATE transport_plans
    SET outbound_minutes = COALESCE(outbound_minutes, one_way_minutes, 1),
        return_minutes = COALESCE(return_minutes, one_way_minutes, 1)
    WHERE outbound_minutes IS NULL OR return_minutes IS NULL
  `);
}

function listItemBySlug(db, slug, getItemById) {
  const row = queryOne(db, 'SELECT id FROM items WHERE slug = ?', [slug]);
  if (!row) return null;
  const item = getItemById(db, row.id);
  if (!item) return null;
  return {
    ...item,
    is_fluid: item.stack_size == null ? 1 : 0,
  };
}

function loadCargo(db, planId, getItemById) {
  const rows = queryAll(
    db,
    `SELECT id, plan_id, item_slug, rate, sort_order, COALESCE(allow_mix, 0) AS allow_mix
     FROM transport_plan_cargo
     WHERE plan_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [planId]
  );

  return rows.map((row) => {
    const item = listItemBySlug(db, row.item_slug, getItemById);
    const isFluid = item ? item.stack_size == null : false;
    return {
      ...row,
      allow_mix: isFluid ? 0 : Number(row.allow_mix) ? 1 : 0,
      item,
      stack_size: item?.stack_size ?? null,
      is_fluid: isFluid,
      name: item?.name ?? row.item_slug,
      image: item?.image ?? null,
    };
  });
}

function attachCalculation(plan, cargo) {
  const vehicle = getVehicleBySlug(plan.vehicle_slug);
  const calcCargo = cargo.map((line) => ({
    item_slug: line.item_slug,
    rate: line.rate,
    stack_size: line.stack_size,
    is_fluid: line.is_fluid,
    allow_mix: Boolean(line.allow_mix),
  }));
  const outbound = Number(plan.outbound_minutes);
  const ret = Number(plan.return_minutes);
  const calculation = calculateTransportNeed(vehicle, calcCargo, outbound, ret);
  return {
    ...plan,
    outbound_minutes: outbound,
    return_minutes: ret,
    vehicle,
    cargo,
    calculation,
  };
}

function insertCargoLines(db, planId, cargoLines) {
  (cargoLines || []).forEach((line, index) => {
    const slug = String(line.item_slug ?? '').trim();
    const rate = Number(line.rate);
    if (!slug || !Number.isFinite(rate) || rate <= 0) return;
    const allowMix = line.allow_mix ? 1 : 0;
    db.run(
      `INSERT INTO transport_plan_cargo (plan_id, item_slug, rate, sort_order, allow_mix)
       VALUES (?, ?, ?, ?, ?)`,
      [planId, slug, rate, index, allowMix]
    );
  });
}

function listTransportPlans(db, getItemById) {
  ensureTransportPlansTables(db);
  const plans = queryAll(
    db,
    `SELECT id, name, vehicle_slug,
            COALESCE(outbound_minutes, one_way_minutes, 1) AS outbound_minutes,
            COALESCE(return_minutes, one_way_minutes, 1) AS return_minutes,
            one_way_minutes, notes, created_at, updated_at
     FROM transport_plans
     ORDER BY updated_at DESC, id DESC`
  );

  return plans.map((plan) => {
    const cargo = loadCargo(db, plan.id, getItemById);
    return attachCalculation(plan, cargo);
  });
}

function getTransportPlanById(db, id, getItemById) {
  ensureTransportPlansTables(db);
  const plan = queryOne(
    db,
    `SELECT id, name, vehicle_slug,
            COALESCE(outbound_minutes, one_way_minutes, 1) AS outbound_minutes,
            COALESCE(return_minutes, one_way_minutes, 1) AS return_minutes,
            one_way_minutes, notes, created_at, updated_at
     FROM transport_plans WHERE id = ?`,
    [id]
  );
  if (!plan) return null;
  const cargo = loadCargo(db, id, getItemById);
  return attachCalculation(plan, cargo);
}

function parsePositiveMinutes(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(label);
  }
  return n;
}

function resolveTripTimes(data, existing = {}) {
  let outbound =
    existing.outbound_minutes != null
      ? Number(existing.outbound_minutes)
      : Number(existing.one_way_minutes);
  let ret =
    existing.return_minutes != null
      ? Number(existing.return_minutes)
      : Number(existing.one_way_minutes);

  if (data.outbound_minutes != null) {
    outbound = parsePositiveMinutes(data.outbound_minutes, 'Tempo di andata non valido');
  }
  if (data.return_minutes != null) {
    ret = parsePositiveMinutes(data.return_minutes, 'Tempo di ritorno non valido');
  }
  // Compat: un solo one_way → andata = ritorno
  if (
    data.one_way_minutes != null &&
    data.outbound_minutes == null &&
    data.return_minutes == null
  ) {
    outbound = parsePositiveMinutes(data.one_way_minutes, 'Tempo di andata non valido');
    ret = outbound;
  }

  if (!Number.isFinite(outbound) || outbound <= 0) {
    throw new Error('Tempo di andata non valido');
  }
  if (!Number.isFinite(ret) || ret <= 0) {
    throw new Error('Tempo di ritorno non valido');
  }
  return { outbound, returnMinutes: ret };
}

function createTransportPlan(db, persist, data = {}, getItemById) {
  ensureTransportPlansTables(db);
  const name = String(data.name ?? '').trim() || 'Nuovo trasporto';
  const vehicleSlug = normalizeVehicleSlug(String(data.vehicle_slug ?? '').trim());
  const vehicle = getVehicleBySlug(vehicleSlug);
  if (!vehicle) {
    throw new Error('Tipo di trasporto non valido');
  }

  const { outbound, returnMinutes } = resolveTripTimes(data);

  db.run(
    `INSERT INTO transport_plans (name, vehicle_slug, one_way_minutes, outbound_minutes, return_minutes, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [name, vehicleSlug, outbound, outbound, returnMinutes, data.notes ?? null]
  );
  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0];

  const cargoLines = Array.isArray(data.cargo) ? data.cargo : [];
  insertCargoLines(db, id, cargoLines);

  persist();
  return getTransportPlanById(db, id, getItemById);
}

function updateTransportPlan(db, persist, id, data = {}, getItemById) {
  ensureTransportPlansTables(db);
  const existing = getTransportPlanById(db, id, getItemById);
  if (!existing) throw new Error('Trasporto non trovato');

  const name =
    data.name != null ? String(data.name).trim() || existing.name : existing.name;
  let vehicleSlug = existing.vehicle_slug;
  if (data.vehicle_slug != null) {
    vehicleSlug = normalizeVehicleSlug(String(data.vehicle_slug).trim());
    if (!getVehicleBySlug(vehicleSlug)) {
      throw new Error('Tipo di trasporto non valido');
    }
  }

  const { outbound, returnMinutes } = resolveTripTimes(data, existing);
  const notes = data.notes !== undefined ? data.notes : existing.notes;

  db.run(
    `UPDATE transport_plans
     SET name = ?, vehicle_slug = ?, one_way_minutes = ?, outbound_minutes = ?, return_minutes = ?, notes = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
    [name, vehicleSlug, outbound, outbound, returnMinutes, notes ?? null, id]
  );

  if (Array.isArray(data.cargo)) {
    db.run('DELETE FROM transport_plan_cargo WHERE plan_id = ?', [id]);
    insertCargoLines(db, id, data.cargo);
  }

  persist();
  return getTransportPlanById(db, id, getItemById);
}

function deleteTransportPlan(db, persist, id) {
  ensureTransportPlansTables(db);
  db.run('DELETE FROM transport_plan_cargo WHERE plan_id = ?', [id]);
  db.run('DELETE FROM transport_plans WHERE id = ?', [id]);
  persist();
  return { deleted: true, id };
}

function duplicateTransportPlan(db, persist, id, getItemById) {
  const source = getTransportPlanById(db, id, getItemById);
  if (!source) throw new Error('Trasporto non trovato');
  return createTransportPlan(
    db,
    persist,
    {
      name: `${source.name} (copia)`,
      vehicle_slug: source.vehicle_slug,
      outbound_minutes: source.outbound_minutes,
      return_minutes: source.return_minutes,
      notes: source.notes,
      cargo: source.cargo.map((line) => ({
        item_slug: line.item_slug,
        rate: line.rate,
        allow_mix: Boolean(line.allow_mix),
      })),
    },
    getItemById
  );
}

function listVehiclesCatalog() {
  return getTransportVehicles();
}

module.exports = {
  ensureTransportPlansTables,
  listTransportPlans,
  getTransportPlanById,
  createTransportPlan,
  updateTransportPlan,
  deleteTransportPlan,
  duplicateTransportPlan,
  listVehiclesCatalog,
};
