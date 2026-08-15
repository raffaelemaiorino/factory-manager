const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  sizeGeneratorsForTargetMw,
  sizeGeneratorsForTargetFuel,
  applyGeneratorChange,
  computeMaxTargetFuel,
  computeMachinesForTargetFuel,
} = require('../src/database/energy-scale');

describe('energy-scale auto sizing', () => {
  it('sizes coal generators for target MW', () => {
    const sized = sizeGeneratorsForTargetMw({
      building_slug: 'generator-coal',
      fuel_slug: 'coal',
      target_mw: 750,
      prefer100oc: true,
    });
    assert.equal(sized.machine_count, 10);
    assert.equal(sized.overclock, 100);
    assert.ok(sized.power_output_mw + 1e-9 >= 750);
    assert.equal(sized.fuel_consumption, 150);
  });

  it('sizes coal generators for compacted-coal fuel rate', () => {
    const sized = sizeGeneratorsForTargetFuel({
      building_slug: 'generator-coal',
      fuel_slug: 'compacted-coal',
      target_fuel_rate: 200,
      prefer100oc: true,
    });
    // 200 / (50/7) = 28 machines @ 100%
    assert.equal(sized.machine_count, 28);
    assert.equal(sized.overclock, 100);
    assert.ok(sized.fuel_consumption + 1e-9 >= 200);
    assert.ok(Math.abs(sized.power_output_mw - 2100) < 1e-6);
  });

  it('fuel and MW sizing stay consistent for the same ratio', () => {
    const byFuel = sizeGeneratorsForTargetFuel({
      building_slug: 'generator-coal',
      fuel_slug: 'coal',
      target_fuel_rate: 150,
      prefer100oc: true,
    });
    const byMw = sizeGeneratorsForTargetMw({
      building_slug: 'generator-coal',
      fuel_slug: 'coal',
      target_mw: byFuel.power_output_mw,
      prefer100oc: true,
    });
    assert.equal(byMw.machine_count, byFuel.machine_count);
    assert.equal(byMw.overclock, byFuel.overclock);
  });
});

describe('energy-scale applyGeneratorChange drivers', () => {
  const baseCoal = {
    fuel_slug: 'coal',
    machine_count: 1,
    overclock: 100,
    target_fuel_input: 15,
  };

  it('bumps machine count when fuel exceeds max at 250% OC', () => {
    // 1 machine max fuel @ 250% = 15 * 2.5 = 37.5
    assert.equal(computeMaxTargetFuel(15, 1), 37.5);
    const resolved = applyGeneratorChange('generator-coal', baseCoal, 'fuel', 75);
    assert.ok(resolved);
    assert.ok(resolved.machine_count >= 2);
    assert.ok(resolved.fuel_consumption + 1e-6 >= 75 - 1e-6);
    assert.ok(resolved.overclock <= 250 + 1e-9);
  });

  it('computeMachinesForTargetFuel matches fuel overshoot needs', () => {
    const machines = computeMachinesForTargetFuel(75, 15);
    assert.equal(machines, 2); // 75 / 37.5 = 2
  });

  it('water driver scales fuel and power on coal generators', () => {
    // At 100% with 1 machine: water 45, fuel 15, power 75
    // Target water 90 → 2× scale → fuel 30, power 150 (or equivalent OC/machines)
    const resolved = applyGeneratorChange('generator-coal', baseCoal, 'water', 90);
    assert.ok(resolved);
    assert.ok(Math.abs(resolved.water_consumption - 90) < 0.05);
    assert.ok(Math.abs(resolved.fuel_consumption - 30) < 0.05);
    assert.ok(Math.abs(resolved.power_output_mw - 150) < 0.05);
  });

  it('rejects water driver on fuel generators', () => {
    const fuelGen = {
      fuel_slug: 'liquid-fuel',
      machine_count: 1,
      overclock: 100,
      target_fuel_input: 20,
    };
    assert.equal(applyGeneratorChange('generator-fuel', fuelGen, 'water', 45), null);
  });

  it('power driver scales fuel consumption', () => {
    const resolved = applyGeneratorChange('generator-coal', baseCoal, 'power', 150);
    assert.ok(resolved);
    assert.ok(Math.abs(resolved.power_output_mw - 150) < 0.05);
    assert.ok(Math.abs(resolved.fuel_consumption - 30) < 0.05);
  });

  it('waste driver scales nuclear fuel rods', () => {
    const nuclear = {
      fuel_slug: 'nuclear-fuel-rod',
      machine_count: 1,
      overclock: 100,
      target_fuel_input: 0.2,
    };
    // wastePerRod 50 → waste 100 ⇒ fuel 2 ⇒ 10× scale from 0.2
    const resolved = applyGeneratorChange('generator-nuclear', nuclear, 'waste', 100);
    assert.ok(resolved);
    assert.ok(Math.abs(resolved.waste_output - 100) < 0.05);
    assert.ok(Math.abs(resolved.fuel_consumption - 2) < 0.05);
  });

  it('rejects waste driver when fuel has no waste', () => {
    assert.equal(applyGeneratorChange('generator-coal', baseCoal, 'waste', 10), null);
  });
});
