const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calculateTransportNeed } = require('../src/database/transport-calc');
const { getVehicleBySlug } = require('../src/database/seeds/vehicles');

describe('transport-calc', () => {
  it('Filorapido 3000/min, andata 3 + ritorno 3 → 2 vagoni (RtD 6)', () => {
    const vehicle = getVehicleBySlug('freight-wagon');
    const result = calculateTransportNeed(
      vehicle,
      [{ item_slug: 'high-speed-wire', rate: 3000, stack_size: 500 }],
      3,
      3
    );
    assert.equal(result.ok, true);
    assert.equal(result.round_trip_minutes, 6);
    assert.equal(result.vehicles_needed, 2);
    assert.equal(result.breakdown[0].trip_capacity, 16000);
  });

  it('Filorapido 3000/min, andata 1.5 + ritorno 1.5 → 1 vagone (RtD 3)', () => {
    const vehicle = getVehicleBySlug('freight-wagon');
    const result = calculateTransportNeed(
      vehicle,
      [{ item_slug: 'high-speed-wire', rate: 3000, stack_size: 500 }],
      1.5,
      1.5
    );
    assert.equal(result.vehicles_needed, 1);
  });

  it('andata e ritorno asimmetrici: 2 + 4 = RtD 6', () => {
    const vehicle = getVehicleBySlug('freight-wagon');
    const result = calculateTransportNeed(
      vehicle,
      [{ item_slug: 'high-speed-wire', rate: 3000, stack_size: 500 }],
      2,
      4
    );
    assert.equal(result.round_trip_minutes, 6);
    assert.equal(result.vehicles_needed, 2);
  });

  it('fluido su vagone generico usa 2400 m³', () => {
    const vehicle = getVehicleBySlug('freight-wagon');
    const result = calculateTransportNeed(
      vehicle,
      [{ item_slug: 'water', rate: 600, stack_size: null, is_fluid: true }],
      3,
      3
    );
    assert.equal(result.ok, true);
    assert.equal(result.vehicles_needed, 2); // 600*6/2400 = 1.5 → 2
  });

  it('vagone mixed somma solidi + fluidi (default separati)', () => {
    const vehicle = getVehicleBySlug('freight-wagon');
    assert.equal(vehicle.cargo_kind, 'mixed');
    const result = calculateTransportNeed(
      vehicle,
      [
        { item_slug: 'high-speed-wire', rate: 3000, stack_size: 500 },
        { item_slug: 'water', rate: 600, stack_size: null, is_fluid: true },
      ],
      3,
      3
    );
    // 2 solidi + 2 fluidi
    assert.equal(result.ok, true);
    assert.equal(result.vehicles_needed, 4);
    assert.equal(result.breakdown.length, 2);
    assert.equal(result.composition.length, 2);
  });

  it('alias freight-wagon-fluid → freight-wagon', () => {
    const vehicle = getVehicleBySlug('freight-wagon-fluid');
    assert.ok(vehicle);
    assert.equal(vehicle.slug, 'freight-wagon');
  });

  it('default: cargo solidi separati (vagoni dedicati)', () => {
    const vehicle = getVehicleBySlug('truck');
    const result = calculateTransportNeed(
      vehicle,
      [
        { item_slug: 'iron-plate', rate: 400, stack_size: 100 },
        { item_slug: 'iron-rod', rate: 400, stack_size: 100 },
      ],
      3,
      3
    );
    assert.equal(result.mode, 'per_cargo_mix');
    assert.equal(result.vehicles_needed, 2);
    assert.equal(result.composition.every((c) => c.kind === 'dedicated'), true);
  });

  it('allow_mix: solidi condividono gli slot', () => {
    const vehicle = getVehicleBySlug('truck');
    const result = calculateTransportNeed(
      vehicle,
      [
        { item_slug: 'iron-plate', rate: 400, stack_size: 100, allow_mix: true },
        { item_slug: 'iron-rod', rate: 400, stack_size: 100, allow_mix: true },
      ],
      3,
      3
    );
    assert.equal(result.vehicles_needed, 1);
    assert.equal(result.breakdown.every((b) => b.mix_group === true), true);
    assert.equal(result.composition.length, 1);
    assert.equal(result.composition[0].kind, 'mixed');
    assert.equal(result.composition[0].count, 1);
  });

  it('mix + dedicato + fluido nella composizione', () => {
    const vehicle = getVehicleBySlug('freight-wagon');
    const result = calculateTransportNeed(
      vehicle,
      [
        { item_slug: 'iron-plate', rate: 100, stack_size: 100, allow_mix: true },
        { item_slug: 'iron-rod', rate: 100, stack_size: 100, allow_mix: true },
        { item_slug: 'high-speed-wire', rate: 3000, stack_size: 500, allow_mix: false },
        { item_slug: 'water', rate: 600, stack_size: null, is_fluid: true, allow_mix: true },
      ],
      3,
      3
    );
    // mix: (600+600)/100 = 12 stack → 1 vagone; wire: 2; water: 2 (fluido ignora allow_mix)
    assert.equal(result.ok, true);
    assert.equal(result.vehicles_needed, 5);
    const mixed = result.composition.find((c) => c.kind === 'mixed');
    assert.ok(mixed);
    assert.equal(mixed.count, 1);
    assert.deepEqual(mixed.item_slugs, ['iron-plate', 'iron-rod']);
    const water = result.breakdown.find((b) => b.item_slug === 'water');
    assert.equal(water.allow_mix, false);
  });

  it('slot_views: Filorapido riempie 32 slot × 2 vagoni', () => {
    const vehicle = getVehicleBySlug('freight-wagon');
    const result = calculateTransportNeed(
      vehicle,
      [{ item_slug: 'high-speed-wire', rate: 3000, stack_size: 500 }],
      3,
      3
    );
    assert.equal(result.slot_views.length, 1);
    const cars = result.slot_views[0].cars;
    assert.equal(cars.length, 2);
    assert.equal(cars[0].length, 32);
    assert.equal(cars[0].every((s) => s && s.amount === 500), true);
    // secondo vagone: 18000 - 16000 = 2000 → 4 stack da 500
    const filled = cars[1].filter(Boolean);
    assert.equal(filled.length, 4);
    assert.equal(filled.every((s) => s.amount === 500), true);
    assert.equal(cars[1].slice(4).every((s) => s == null), true);
  });

  it('slot_views misti: stack in ordine nei slot condivisi', () => {
    const vehicle = getVehicleBySlug('truck');
    const result = calculateTransportNeed(
      vehicle,
      [
        { item_slug: 'iron-plate', rate: 400, stack_size: 100, allow_mix: true },
        { item_slug: 'iron-rod', rate: 400, stack_size: 100, allow_mix: true },
      ],
      3,
      3
    );
    const car = result.slot_views[0].cars[0];
    assert.equal(car.length, 48);
    assert.equal(car.filter((s) => s?.item_slug === 'iron-plate').length, 24);
    assert.equal(car.filter((s) => s?.item_slug === 'iron-rod').length, 24);
  });
});
