const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const {
  createProductionChain,
  addProductionChainStep,
  addSinkProductionChainStep,
  renameProductionStep,
} = require('../src/database/production-chains');
const { getItemSchemas } = require('../src/database/schemas');
const {
  getSharedTestDatabase,
  findItemBySlug,
  getItemById,
} = require('./helpers/test-db');

describe('production step display names', () => {
  let db;
  const noop = () => {};

  before(async () => {
    db = await getSharedTestDatabase();
  });

  it('numbers steps by output item across different recipes', () => {
    const ingot = findItemBySlug(db, 'iron-ingot');
    assert.ok(ingot);

    const schemas = getItemSchemas(db, ingot.id);
    const base = schemas.find((s) => !s.is_alternative) || schemas[0];
    const alloy = schemas.find((s) =>
      (s.inputs || []).some((io) => io.item_slug === 'ore-copper')
    );
    assert.ok(base && alloy);
    assert.notEqual(base.id, alloy.id);

    const chain = createProductionChain(db, noop, {
      name: `Step names by output ${Date.now()}`,
    });

    const first = addProductionChainStep(
      db,
      noop,
      chain.id,
      { item_id: ingot.id, item_schema_id: alloy.id },
      getItemById
    );
    const second = addProductionChainStep(
      db,
      noop,
      chain.id,
      { item_id: ingot.id, item_schema_id: base.id },
      getItemById
    );

    assert.equal(first.name, `${ingot.name} #1`);
    assert.equal(second.name, `${ingot.name} #2`);
  });

  it('does not count AWESOME sinks toward production step numbers', () => {
    const plate = findItemBySlug(db, 'iron-plate');
    assert.ok(plate);
    const schema = (getItemSchemas(db, plate.id) || []).find((s) => !s.is_alternative)
      || getItemSchemas(db, plate.id)[0];
    assert.ok(schema);

    const chain = createProductionChain(db, noop, {
      name: `Step names ignore sink ${Date.now()}`,
    });

    addSinkProductionChainStep(
      db,
      noop,
      chain.id,
      { item_id: plate.id, target_output: 10, machine_count: 1 },
      getItemById
    );

    const step = addProductionChainStep(
      db,
      noop,
      chain.id,
      { item_id: plate.id, item_schema_id: schema.id },
      getItemById
    );

    assert.equal(step.name, `${plate.name} #1`);
  });

  it('renames a production step display name', () => {
    const plate = findItemBySlug(db, 'iron-plate');
    assert.ok(plate);
    const schema = (getItemSchemas(db, plate.id) || []).find((s) => !s.is_alternative)
      || getItemSchemas(db, plate.id)[0];
    assert.ok(schema);

    const chain = createProductionChain(db, noop, {
      name: `Rename step ${Date.now()}`,
    });
    const step = addProductionChainStep(
      db,
      noop,
      chain.id,
      { item_id: plate.id, item_schema_id: schema.id },
      getItemById
    );

    const detail = renameProductionStep(db, noop, step.id, 'Linea piastre A', getItemById);
    const renamed = detail.steps.find((item) => item.id === step.id);
    assert.ok(renamed);
    assert.equal(renamed.name, 'Linea piastre A');
  });
});
