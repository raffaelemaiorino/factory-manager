const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { calculateTransportNeed, isFluidItem } = require('../src/database/transport-calc');
const { getVehicleBySlug } = require('../src/database/seeds/vehicles');

describe('transport-calc', () => {
  it('Filorapido 3000/min, andata 180s + ritorno 180s → 2 vagoni (RtD 6 min, capacità)', () => {
    const vehicle = getVehicleBySlug('freight-wagon');
    const result = calculateTransportNeed(
      vehicle,
      [{ item_slug: 'high-speed-wire', rate: 3000, stack_size: 500 }],
      180,
      180,
      { belt_mk: 5 }
    );
    assert.equal(result.ok, true);
    assert.equal(result.round_trip_seconds, 360);
    assert.equal(result.round_trip_minutes, 6);
    assert.equal(result.vehicles_needed, 2);
    assert.equal(result.breakdown[0].trip_capacity, 16000);
    assert.equal(result.breakdown[0].cars_from_capacity, 2);
    assert.equal(result.breakdown[0].stations_needed, 2);
  });

  it('Filorapido 3000/min RtD 4 min Mk.5 → 2 vagoni (stazioni, non solo capienza)', () => {
    const vehicle = getVehicleBySlug('freight-wagon');
    const result = calculateTransportNeed(
      vehicle,
      [{ item_slug: 'high-speed-wire', rate: 3000, stack_size: 500 }],
      120,
      120,
      { belt_mk: 5 }
    );
    // Capienza: 3000*4/16000 = 0.75 → 1; stazioni: ceil(3000/1560)=2
    assert.equal(result.breakdown[0].cars_from_capacity, 1);
    assert.equal(result.breakdown[0].stations_needed, 2);
    assert.equal(result.breakdown[0].limiting, 'station');
    assert.equal(result.vehicles_needed, 2);
    assert.equal(result.stations_needed, 2);
    assert.equal(result.belts_or_pipes_needed, 4);
    assert.equal(result.station_throughput_solid, 1560);
  });

  it('Filorapido 3000/min RtD 4 min Mk.6 → ancora 2 (ceil(3000/2400)=2)', () => {
    const vehicle = getVehicleBySlug('freight-wagon');
    const result = calculateTransportNeed(
      vehicle,
      [{ item_slug: 'high-speed-wire', rate: 3000, stack_size: 500 }],
      120,
      120,
      { belt_mk: 6 }
    );
    assert.equal(result.station_throughput_solid, 2400);
    assert.equal(result.breakdown[0].stations_needed, 2);
    assert.equal(result.vehicles_needed, 2);
  });

  it('Filorapido 2000/min RtD 4 min Mk.6 → 1 vagone (capienza e stazioni)', () => {
    const vehicle = getVehicleBySlug('freight-wagon');
    const result = calculateTransportNeed(
      vehicle,
      [{ item_slug: 'high-speed-wire', rate: 2000, stack_size: 500 }],
      120,
      120,
      { belt_mk: 6 }
    );
    assert.equal(result.breakdown[0].cars_from_capacity, 1);
    assert.equal(result.breakdown[0].stations_needed, 1);
    assert.equal(result.vehicles_needed, 1);
    assert.equal(result.breakdown[0].limiting, 'capacity');
  });

  it('andata e ritorno asimmetrici: 120s + 240s = RtD 6 min', () => {
    const vehicle = getVehicleBySlug('freight-wagon');
    const result = calculateTransportNeed(
      vehicle,
      [{ item_slug: 'high-speed-wire', rate: 3000, stack_size: 500 }],
      120,
      240,
      { belt_mk: 5 }
    );
    assert.equal(result.round_trip_seconds, 360);
    assert.equal(result.round_trip_minutes, 6);
    assert.equal(result.vehicles_needed, 2);
  });

  it('fluido su vagone generico usa 2400 m³', () => {
    const vehicle = getVehicleBySlug('freight-wagon');
    const result = calculateTransportNeed(
      vehicle,
      [{ item_slug: 'water', rate: 600, stack_size: null, is_fluid: true }],
      180,
      180,
      { pipe_mk: 2 }
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
      180,
      180,
      { belt_mk: 5, pipe_mk: 2 }
    );
    // 2 solidi + 2 fluidi
    assert.equal(result.ok, true);
    assert.equal(result.vehicles_needed, 4);
    assert.equal(result.breakdown.length, 2);
    assert.equal(result.composition.length, 2);
  });

  it('drone ignora vincolo porte stazione', () => {
    const vehicle = getVehicleBySlug('drone-transport');
    const result = calculateTransportNeed(
      vehicle,
      [{ item_slug: 'high-speed-wire', rate: 3000, stack_size: 500 }],
      120,
      120,
      { belt_mk: 5 }
    );
    assert.equal(result.apply_station_limit, false);
    // 3000*4 / (9*500) = 12000/4500 → 3
    assert.equal(result.breakdown[0].stations_needed, 0);
    assert.equal(result.vehicles_needed, 3);
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
      180,
      180,
      { belt_mk: 5 }
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
      180,
      180,
      { belt_mk: 5 }
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
      180,
      180,
      { belt_mk: 5, pipe_mk: 2 }
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

  it('slot_views: Filorapido ripartito uniformemente su 2 vagoni', () => {
    const vehicle = getVehicleBySlug('freight-wagon');
    const result = calculateTransportNeed(
      vehicle,
      [{ item_slug: 'high-speed-wire', rate: 3000, stack_size: 500 }],
      180,
      180,
      { belt_mk: 5 }
    );
    assert.equal(result.slot_views.length, 1);
    const cars = result.slot_views[0].cars;
    assert.equal(cars.length, 2);
    assert.equal(cars[0].length, 32);
    // 18000 / 2 = 9000 → 18 stack da 500 per vagone
    const filled0 = cars[0].filter(Boolean);
    const filled1 = cars[1].filter(Boolean);
    assert.equal(filled0.length, 18);
    assert.equal(filled1.length, 18);
    assert.equal(filled0.every((s) => s.amount === 500), true);
    assert.equal(filled1.every((s) => s.amount === 500), true);
  });

  it('slot_views: 12000 Filorapido su 2 stazioni → 6000+6000', () => {
    const vehicle = getVehicleBySlug('freight-wagon');
    const result = calculateTransportNeed(
      vehicle,
      [{ item_slug: 'high-speed-wire', rate: 3000, stack_size: 500 }],
      120,
      120,
      { belt_mk: 5 }
    );
    assert.equal(result.vehicles_needed, 2);
    const cars = result.slot_views[0].cars;
    const sum0 = cars[0].filter(Boolean).reduce((s, x) => s + x.amount, 0);
    const sum1 = cars[1].filter(Boolean).reduce((s, x) => s + x.amount, 0);
    assert.equal(sum0, 6000);
    assert.equal(sum1, 6000);
  });

  it('station_belt_mks: Mk.4 su entrambe richiede più di 2 stazioni per 3000/min', () => {
    const vehicle = getVehicleBySlug('freight-wagon');
    // Mk.4 = 480 → 960/stazione; 3000/960 = 4 stazioni
    const result = calculateTransportNeed(
      vehicle,
      [{ item_slug: 'high-speed-wire', rate: 3000, stack_size: 500 }],
      120,
      120,
      { belt_mk: 4, station_belt_mks: [4, 4, 4, 4] }
    );
    assert.equal(result.breakdown[0].stations_needed, 4);
    assert.equal(result.vehicles_needed, 4);
  });

  it('2 treni: Filorapido 3000/min RtD 4 Mk.5 → 1 vagone per treno (carico dimezzato)', () => {
    const vehicle = getVehicleBySlug('freight-wagon');
    const one = calculateTransportNeed(
      vehicle,
      [{ item_slug: 'high-speed-wire', rate: 3000, stack_size: 500 }],
      120,
      120,
      { belt_mk: 5, train_count: 1 }
    );
    const two = calculateTransportNeed(
      vehicle,
      [{ item_slug: 'high-speed-wire', rate: 3000, stack_size: 500 }],
      120,
      120,
      { belt_mk: 5, train_count: 2 }
    );
    assert.equal(one.vehicles_needed, 2);
    assert.equal(two.train_count, 2);
    assert.equal(two.vehicles_needed, 1);
    assert.equal(two.vehicles_needed_fleet, 2);
    assert.equal(two.breakdown[0].rate_per_train, 1500);
  });

  it('slot_views misti: stack in ordine nei slot condivisi', () => {
    const vehicle = getVehicleBySlug('truck');
    const result = calculateTransportNeed(
      vehicle,
      [
        { item_slug: 'iron-plate', rate: 400, stack_size: 100, allow_mix: true },
        { item_slug: 'iron-rod', rate: 400, stack_size: 100, allow_mix: true },
      ],
      180,
      180,
      { belt_mk: 5 }
    );
    const car = result.slot_views[0].cars[0];
    assert.equal(car.length, 48);
    assert.equal(car.filter((s) => s?.item_slug === 'iron-plate').length, 24);
    assert.equal(car.filter((s) => s?.item_slug === 'iron-rod').length, 24);
  });

  it('missing items are not treated as fluids', () => {
    assert.equal(isFluidItem({ stack_size: null, is_fluid: true }), true);
    assert.equal(isFluidItem({ stack_size: null, is_fluid: 1 }), true);
    assert.equal(isFluidItem({ stack_size: null, is_fluid: false }), false);
    assert.equal(isFluidItem({ stack_size: null, is_fluid: 0 }), false);
    assert.equal(isFluidItem({ stack_size: 100, is_fluid: false }), false);
    const missing = calculateTransportNeed(
      getVehicleBySlug('freight-wagon'),
      [{ item_slug: 'deleted-item', rate: 60, stack_size: null, is_fluid: false }],
      180,
      180,
      { belt_mk: 5 }
    );
    assert.equal(missing.ok, false);
    assert.ok(
      (missing.incompatibilities || []).some((row) => row.error === 'missing_stack_size')
    );
  });
});
