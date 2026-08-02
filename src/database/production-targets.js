/**
 * Multi-target production goals for a chain (item + rate/min).
 * Legacy single columns target_item_slug / target_rate stay mirrored to the first target.
 */

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

function ensureProductionChainTargetsTable(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS production_chain_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chain_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      target_rate REAL NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE (chain_id, item_id),
      FOREIGN KEY (chain_id) REFERENCES production_chains(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id)
    );
  `);

  migrateLegacyChainTargets(db);
}

function migrateLegacyChainTargets(db) {
  const chains = queryAll(
    db,
    `SELECT id, target_item_slug, target_rate
     FROM production_chains
     WHERE target_item_slug IS NOT NULL AND TRIM(target_item_slug) != ''`
  );

  for (const chain of chains) {
    const existing = queryOne(
      db,
      'SELECT id FROM production_chain_targets WHERE chain_id = ? LIMIT 1',
      [chain.id]
    );
    if (existing) continue;

    const item = queryOne(db, 'SELECT id FROM items WHERE slug = ?', [
      String(chain.target_item_slug).trim(),
    ]);
    if (!item) continue;

    const rate = Number(chain.target_rate);
    db.run(
      `INSERT INTO production_chain_targets (chain_id, item_id, target_rate, sort_order)
       VALUES (?, ?, ?, 0)`,
      [chain.id, item.id, Number.isFinite(rate) && rate > 0 ? rate : 60]
    );
  }
}

function normalizeTargetEntries(rawTargets = []) {
  const byItemId = new Map();

  for (const entry of rawTargets) {
    const itemId = Number(entry?.item_id ?? entry?.id);
    const rate = Number(entry?.target_rate ?? entry?.rate);
    if (!Number.isFinite(itemId) || itemId <= 0) continue;
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error('Rate non valido');
    }
    byItemId.set(itemId, rate);
  }

  return [...byItemId.entries()].map(([item_id, target_rate], index) => ({
    item_id,
    target_rate,
    sort_order: index,
  }));
}

function loadChainTargets(db, chainId, getItemById) {
  ensureProductionChainTargetsTable(db);
  const rows = queryAll(
    db,
    `SELECT id, chain_id, item_id, target_rate, sort_order
     FROM production_chain_targets
     WHERE chain_id = ?
     ORDER BY sort_order ASC, id ASC`,
    [chainId]
  );

  return rows
    .map((row) => {
      const item = getItemById(db, row.item_id);
      if (!item) return null;
      return {
        id: row.id,
        chain_id: row.chain_id,
        item_id: row.item_id,
        target_rate: Number(row.target_rate),
        sort_order: row.sort_order,
        item,
        item_slug: item.slug,
        item_name: item.name,
        item_image: item.image,
      };
    })
    .filter(Boolean);
}

function mirrorLegacyTargetColumns(db, chainId, targets) {
  const first = targets[0] ?? null;
  db.run(
    `UPDATE production_chains
     SET target_item_slug = ?, target_rate = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [first?.item_slug ?? first?.item?.slug ?? null, first?.target_rate ?? null, chainId]
  );
}

function replaceChainTargets(db, persist, chainId, rawTargets, getItemById) {
  ensureProductionChainTargetsTable(db);
  const normalized = normalizeTargetEntries(rawTargets);

  for (const entry of normalized) {
    const item = getItemById(db, entry.item_id);
    if (!item) {
      throw new Error('Risorsa non trovata');
    }
  }

  db.run('DELETE FROM production_chain_targets WHERE chain_id = ?', [chainId]);

  for (const entry of normalized) {
    db.run(
      `INSERT INTO production_chain_targets (chain_id, item_id, target_rate, sort_order)
       VALUES (?, ?, ?, ?)`,
      [chainId, entry.item_id, entry.target_rate, entry.sort_order]
    );
  }

  const targets = loadChainTargets(db, chainId, getItemById);
  mirrorLegacyTargetColumns(db, chainId, targets);
  persist();
  return targets;
}

module.exports = {
  ensureProductionChainTargetsTable,
  loadChainTargets,
  replaceChainTargets,
  normalizeTargetEntries,
  mirrorLegacyTargetColumns,
};
