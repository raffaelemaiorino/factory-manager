const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  outputPerMinute,
  getBaseOutputPerMin,
  computeMachinesForTargetAtOverclock,
  computeTargetOutput,
  applyStepChange,
} = require('../src/database/production-scale');

const IRON_PLATE_SCHEMA = {
  duration: 6,
  building_slug: 'constructor',
  inputs: [{ item_slug: 'iron-ingot', amount: 3, is_fluid: 0 }],
  outputs: [{ item_slug: 'iron-plate', amount: 2, is_fluid: 0 }],
};

const IRON_PLATE_ITEM = { slug: 'iron-plate' };

const IRON_INGOT_SCHEMA = {
  duration: 2,
  building_slug: 'smelter',
  inputs: [{ item_slug: 'ore-iron', amount: 1, is_fluid: 0 }],
  outputs: [{ item_slug: 'iron-ingot', amount: 1, is_fluid: 0 }],
};

describe('production-scale', () => {
  it('outputPerMinute and base rates for iron plate / ingot', () => {
    assert.equal(outputPerMinute(2, 6), 20);
    assert.equal(getBaseOutputPerMin(IRON_PLATE_SCHEMA, IRON_PLATE_ITEM), 20);
    assert.equal(getBaseOutputPerMin(IRON_INGOT_SCHEMA, { slug: 'iron-ingot' }), 30);
  });

  it('sizes machines at 100% for 60 iron plate/min (prefer even count)', () => {
    const base = getBaseOutputPerMin(IRON_PLATE_SCHEMA, IRON_PLATE_ITEM);
    // 60/20 = 3 → roundUpPreferEven → 4
    const machines = computeMachinesForTargetAtOverclock(60, base, 100, 0, IRON_PLATE_SCHEMA);
    assert.equal(machines, 4);
    const target = computeTargetOutput(base, machines, 100, 0, IRON_PLATE_SCHEMA);
    assert.ok(target + 1e-9 >= 60);
  });

  it('applyStepChange keeps 100% when preferring machine count', () => {
    const config = applyStepChange(
      IRON_PLATE_SCHEMA,
      IRON_PLATE_ITEM,
      { target_output: 60, machine_count: 4, overclock: 100, somersloop_mask: 0 },
      'machines',
      4
    );
    assert.ok(config);
    assert.equal(config.machine_count, 4);
    assert.equal(config.overclock, 100);
    assert.ok(config.target_output + 1e-9 >= 60);
  });
});
