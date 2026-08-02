const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { pickDefaultSchema, isPackagerSchema } = require('../src/database/auto-plan-recipes');
const { getItemSchemas } = require('../src/database/schemas');
const {
  getSharedTestDatabase,
  findItemBySlug,
} = require('./helpers/test-db');

describe('auto-plan-recipes', () => {
  let db;

  before(async () => {
    db = await getSharedTestDatabase();
  });

  it('isPackagerSchema detects packager building', () => {
    assert.equal(isPackagerSchema({ building_slug: 'packager' }), true);
    assert.equal(isPackagerSchema({ building_slug: 'refinery' }), false);
  });

  it('iron-plate picks non-alternative constructor recipe', () => {
    const item = findItemBySlug(db, 'iron-plate');
    assert.ok(item);
    const schema = pickDefaultSchema(db, item.id, item);
    assert.ok(schema);
    assert.equal(Boolean(schema.is_alternative), false);
    assert.equal(schema.building_slug, 'constructor');
    assert.equal(schema.outputs?.[0]?.item_slug, 'iron-plate');
  });

  it('iron-ingot prefers default smelter over alternatives', () => {
    const item = findItemBySlug(db, 'iron-ingot');
    assert.ok(item);
    const schema = pickDefaultSchema(db, item.id, item);
    assert.ok(schema);
    assert.equal(Boolean(schema.is_alternative), false);
    assert.equal(schema.building_slug, 'smelter');
  });

  it('aluminum-ingot does not pick a Packager recipe', () => {
    const item = findItemBySlug(db, 'aluminum-ingot');
    assert.ok(item);
    const all = getItemSchemas(db, item.id);
    assert.ok(all.length > 0);
    const schema = pickDefaultSchema(db, item.id, item);
    assert.ok(schema);
    assert.equal(isPackagerSchema(schema), false);
    assert.equal(schema.outputs?.[0]?.item_slug, 'aluminum-ingot');
  });

  it('aluminum-scrap prefers primary refinery recipe (not byproduct-only)', () => {
    const item = findItemBySlug(db, 'aluminum-scrap');
    assert.ok(item);
    const schema = pickDefaultSchema(db, item.id, item);
    assert.ok(schema);
    assert.equal(Boolean(schema.is_alternative), false);
    assert.equal(schema.building_slug, 'refinery');
    assert.equal(schema.outputs?.[0]?.item_slug, 'aluminum-scrap');
  });

  it('avoids recipes that consume the same item as input (self-feed)', () => {
    // Compacted coal / packaged fuels historically caused self-links; whatever
    // default is chosen must not list the product as an input.
    for (const slug of ['compacted-coal', 'packaged-fuel', 'aluminum-ingot']) {
      const item = findItemBySlug(db, slug);
      if (!item) continue;
      const schema = pickDefaultSchema(db, item.id, item);
      if (!schema) continue;
      const inputs = schema.inputs || [];
      assert.equal(
        inputs.some((io) => io.item_slug === slug),
        false,
        `${slug} default recipe must not consume itself`
      );
    }
  });
});
