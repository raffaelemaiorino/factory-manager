const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { getSchemasByInputItem } = require('../src/database/schemas');
const { getSharedTestDatabase, findItemBySlug } = require('./helpers/test-db');

describe('getSchemasByInputItem', () => {
  let db;

  before(async () => {
    db = await getSharedTestDatabase();
  });

  it('returns recipes that consume nuclear-waste as input', () => {
    const item = findItemBySlug(db, 'nuclear-waste');
    assert.ok(item);
    assert.ok(Number(item.input_schema_count) > 0);

    const schemas = getSchemasByInputItem(db, item.id);
    assert.ok(schemas.length > 0);
    for (const schema of schemas) {
      const inputSlugs = (schema.inputs || []).map((io) => io.item_slug);
      assert.ok(
        inputSlugs.includes('nuclear-waste'),
        `expected nuclear-waste in inputs of ${schema.name}`
      );
      assert.ok(schema.item_id, 'schema must have primary item_id for step creation');
    }
  });

  it('dedupes byproduct-owned copies (water vs non-fissible-uranium)', () => {
    const item = findItemBySlug(db, 'nuclear-waste');
    assert.ok(item);
    const schemas = getSchemasByInputItem(db, item.id);
    const names = schemas.map((s) => s.name);
    assert.equal(new Set(names).size, names.length, `duplicate names: ${names.join(', ')}`);
    assert.equal(schemas.length, Number(item.input_schema_count));

    const ownerSlugs = new Set();
    for (const schema of schemas) {
      const primary = (schema.outputs || []).find((io) => Number(io.slot) === 1) || schema.outputs?.[0];
      assert.ok(primary, `schema ${schema.name} missing primary output`);
      const stmt = db.prepare('SELECT slug FROM items WHERE id = ?');
      stmt.bind([schema.item_id]);
      assert.ok(stmt.step());
      const owner = stmt.getAsObject();
      stmt.free();
      assert.equal(owner.slug, primary.item_slug);
      ownerSlugs.add(owner.slug);
    }
    assert.ok(ownerSlugs.has('non-fissible-uranium'));
    assert.ok(ownerSlugs.has('plutonium-pellet'));
    assert.equal(ownerSlugs.has('water'), false);
  });

  it('returns empty list for unknown item id', () => {
    assert.deepEqual(getSchemasByInputItem(db, -1), []);
  });
});
