/**
 * Calcolo mezzi/vagoni necessari per un piano di trasporto.
 *
 * RtD = tempo andata + tempo ritorno (minuti)
 * Solidi: capienza = slot × stack_size
 * Fluidi: capienza = fluid_capacity (m³)
 *
 * Per ogni cargo solido: allow_mix
 * - false → vagoni dedicati solo a quell'item
 * - true  → condivide gli slot con gli altri solidi in mix
 * Fluidi: sempre dedicati (un fluido per vagone)
 */

function ceilPositive(value) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.ceil(value - 1e-12);
}

function isFluidItem(item) {
  if (!item) return false;
  if (item.is_fluid === 1 || item.is_fluid === true) return true;
  if (item.stack_size == null) return true;
  return false;
}

function roundTripMinutes(outboundMinutes, returnMinutes) {
  const outbound = Number(outboundMinutes);
  const ret = Number(returnMinutes);
  if (!Number.isFinite(outbound) || outbound <= 0) return null;
  if (!Number.isFinite(ret) || ret <= 0) return null;
  return outbound + ret;
}

function vehicleAllowsSolid(vehicle) {
  const kind = vehicle?.cargo_kind || 'solid';
  return kind === 'solid' || kind === 'mixed';
}

function vehicleAllowsFluid(vehicle) {
  const kind = vehicle?.cargo_kind || 'solid';
  return kind === 'fluid' || kind === 'mixed';
}

function normalizeAllowMix(line, fluid) {
  if (fluid) return false;
  return Boolean(line.allow_mix);
}

/**
 * Pack a solid cargo amount into dedicated cars (one stack per inventory slot).
 * @returns {Array<Array<object|null>>} cars → slots
 */
function packSolidAmountAcrossCars(itemSlug, amount, stackSize, slotsPerCar, carCount) {
  const cars = [];
  let remaining = Number(amount) || 0;
  const stack = Number(stackSize);
  const slots = Number(slotsPerCar);
  const nCars = Number(carCount);
  if (!(stack > 0) || !(slots > 0) || !(nCars > 0)) return cars;

  for (let c = 0; c < nCars; c++) {
    const grid = [];
    for (let s = 0; s < slots; s++) {
      if (remaining <= 1e-9) {
        grid.push(null);
        continue;
      }
      const qty = Math.min(stack, remaining);
      grid.push({
        item_slug: itemSlug,
        amount: qty,
        stack_size: stack,
        fill_ratio: qty / stack,
        is_fluid: false,
      });
      remaining -= qty;
    }
    cars.push(grid);
  }
  return cars;
}

/**
 * Pack mixed solids across shared cars in cargo order.
 */
function packMixedAcrossCars(items, slotsPerCar, carCount) {
  const slots = Number(slotsPerCar);
  const nCars = Number(carCount);
  if (!(slots > 0) || !(nCars > 0)) return [];

  const cars = Array.from({ length: nCars }, () => Array(slots).fill(null));
  let carIdx = 0;
  let slotIdx = 0;

  for (const item of items || []) {
    const stack = Number(item.stack_size);
    let remaining = Number(item.amount_per_trip) || 0;
    if (!(stack > 0) || remaining <= 0) continue;

    while (remaining > 1e-9 && carIdx < nCars) {
      const qty = Math.min(stack, remaining);
      cars[carIdx][slotIdx] = {
        item_slug: item.item_slug,
        amount: qty,
        stack_size: stack,
        fill_ratio: qty / stack,
        is_fluid: false,
      };
      remaining -= qty;
      slotIdx += 1;
      if (slotIdx >= slots) {
        slotIdx = 0;
        carIdx += 1;
      }
    }
  }
  return cars;
}

/**
 * Pack fluid into dedicated tank cars (one slot = whole tank).
 */
function packFluidAcrossCars(itemSlug, amount, fluidCap, carCount) {
  const cars = [];
  let remaining = Number(amount) || 0;
  const cap = Number(fluidCap);
  const nCars = Number(carCount);
  if (!(cap > 0) || !(nCars > 0)) return cars;

  for (let c = 0; c < nCars; c++) {
    const qty = Math.min(cap, Math.max(0, remaining));
    remaining -= qty;
    cars.push([
      {
        item_slug: itemSlug,
        amount: qty,
        stack_size: null,
        capacity: cap,
        fill_ratio: qty / cap,
        is_fluid: true,
      },
    ]);
  }
  return cars;
}

/**
 * @param {object} vehicle
 * @param {Array<{ item_slug: string, rate: number, stack_size?: number|null, is_fluid?: boolean, allow_mix?: boolean }>} cargo
 * @param {number} outboundMinutes
 * @param {number} returnMinutes
 */
function calculateTransportNeed(vehicle, cargo, outboundMinutes, returnMinutes) {
  const rtd = roundTripMinutes(outboundMinutes, returnMinutes);
  const lines = Array.isArray(cargo) ? cargo : [];

  if (!vehicle) {
    return {
      ok: false,
      error: 'vehicle_required',
      round_trip_minutes: rtd,
      vehicles_needed: 0,
      breakdown: [],
      composition: [],
      slot_views: [],
    };
  }

  if (rtd == null) {
    return {
      ok: false,
      error: 'trip_times_required',
      round_trip_minutes: null,
      vehicles_needed: 0,
      breakdown: [],
      composition: [],
      slot_views: [],
    };
  }

  if (!lines.length) {
    return {
      ok: true,
      error: null,
      round_trip_minutes: rtd,
      vehicles_needed: 0,
      breakdown: [],
      composition: [],
      slot_views: [],
      mode: 'per_cargo_mix',
    };
  }

  const slots = Number(vehicle.inventory_slots);
  const fluidCap = Number(vehicle.fluid_capacity);
  const breakdown = [];
  const incompatibilities = [];
  const mixPool = [];
  const composition = [];
  const slotViews = [];
  let vehiclesNeeded = 0;

  for (const line of lines) {
    const rate = Number(line.rate);
    const fluid = isFluidItem(line);
    if (!Number.isFinite(rate) || rate <= 0) {
      incompatibilities.push({ item_slug: line.item_slug, error: 'invalid_rate' });
      continue;
    }

    if (fluid && !vehicleAllowsFluid(vehicle)) {
      incompatibilities.push({ item_slug: line.item_slug, error: 'needs_fluid_vehicle' });
      continue;
    }
    if (!fluid && !vehicleAllowsSolid(vehicle)) {
      incompatibilities.push({ item_slug: line.item_slug, error: 'needs_solid_vehicle' });
      continue;
    }

    const amountPerTrip = rate * rtd;
    const allowMix = normalizeAllowMix(line, fluid);

    if (fluid) {
      if (!Number.isFinite(fluidCap) || fluidCap <= 0) {
        incompatibilities.push({ item_slug: line.item_slug, error: 'no_fluid_capacity' });
        continue;
      }
      const needed = ceilPositive(amountPerTrip / fluidCap);
      breakdown.push({
        item_slug: line.item_slug,
        rate,
        is_fluid: true,
        allow_mix: false,
        stack_size: null,
        amount_per_trip: amountPerTrip,
        trip_capacity: fluidCap,
        units_needed: needed,
        mix_group: false,
      });
      vehiclesNeeded += needed;
      if (needed > 0) {
        const viewIndex = slotViews.length;
        composition.push({
          kind: 'dedicated',
          item_slug: line.item_slug,
          is_fluid: true,
          count: needed,
          view_index: viewIndex,
        });
        slotViews.push({
          kind: 'dedicated',
          item_slug: line.item_slug,
          is_fluid: true,
          cars: packFluidAcrossCars(line.item_slug, amountPerTrip, fluidCap, needed),
        });
      }
      continue;
    }

    const stack = Number(line.stack_size);
    if (!Number.isFinite(stack) || stack <= 0) {
      incompatibilities.push({ item_slug: line.item_slug, error: 'missing_stack_size' });
      continue;
    }
    if (!Number.isFinite(slots) || slots <= 0) {
      incompatibilities.push({ item_slug: line.item_slug, error: 'no_inventory_slots' });
      continue;
    }

    const tripCapacity = slots * stack;
    const stacksNeeded = amountPerTrip / stack;

    if (allowMix) {
      mixPool.push({
        item_slug: line.item_slug,
        rate,
        stack_size: stack,
        amount_per_trip: amountPerTrip,
        trip_capacity: tripCapacity,
        stacks_per_trip: stacksNeeded,
      });
      continue;
    }

    const needed = ceilPositive(amountPerTrip / tripCapacity);
    breakdown.push({
      item_slug: line.item_slug,
      rate,
      is_fluid: false,
      allow_mix: false,
      stack_size: stack,
      amount_per_trip: amountPerTrip,
      trip_capacity: tripCapacity,
      stacks_per_trip: stacksNeeded,
      units_needed: needed,
      mix_group: false,
    });
    vehiclesNeeded += needed;
    if (needed > 0) {
      const viewIndex = slotViews.length;
      composition.push({
        kind: 'dedicated',
        item_slug: line.item_slug,
        is_fluid: false,
        count: needed,
        view_index: viewIndex,
      });
      slotViews.push({
        kind: 'dedicated',
        item_slug: line.item_slug,
        is_fluid: false,
        cars: packSolidAmountAcrossCars(line.item_slug, amountPerTrip, stack, slots, needed),
      });
    }
  }

  if (mixPool.length) {
    const totalStacks = mixPool.reduce((sum, row) => sum + row.stacks_per_trip, 0);
    const mixCars = slots > 0 ? ceilPositive(totalStacks / slots) : 0;
    vehiclesNeeded += mixCars;

    for (const row of mixPool) {
      breakdown.push({
        item_slug: row.item_slug,
        rate: row.rate,
        is_fluid: false,
        allow_mix: true,
        stack_size: row.stack_size,
        amount_per_trip: row.amount_per_trip,
        trip_capacity: row.trip_capacity,
        stacks_per_trip: row.stacks_per_trip,
        units_needed: mixCars,
        mix_group: true,
        mix_group_units: mixCars,
      });
    }

    if (mixCars > 0) {
      const viewIndex = slotViews.length;
      composition.push({
        kind: 'mixed',
        item_slugs: mixPool.map((row) => row.item_slug),
        is_fluid: false,
        count: mixCars,
        view_index: viewIndex,
      });
      slotViews.push({
        kind: 'mixed',
        item_slugs: mixPool.map((row) => row.item_slug),
        is_fluid: false,
        cars: packMixedAcrossCars(mixPool, slots, mixCars),
      });
    }
  }

  if (incompatibilities.length && !breakdown.length) {
    return {
      ok: false,
      error: incompatibilities[0].error,
      incompatibilities,
      round_trip_minutes: rtd,
      vehicles_needed: 0,
      breakdown: [],
      composition: [],
      slot_views: [],
      mode: 'per_cargo_mix',
    };
  }

  return {
    ok: incompatibilities.length === 0,
    error: incompatibilities.length ? incompatibilities[0].error : null,
    incompatibilities,
    round_trip_minutes: rtd,
    vehicles_needed: vehiclesNeeded,
    mode: 'per_cargo_mix',
    vehicle_slug: vehicle.slug,
    inventory_slots: vehicle.inventory_slots ?? null,
    fluid_capacity: vehicle.fluid_capacity ?? null,
    breakdown,
    composition,
    slot_views: slotViews,
  };
}

module.exports = {
  calculateTransportNeed,
  roundTripMinutes,
  isFluidItem,
  ceilPositive,
  vehicleAllowsSolid,
  vehicleAllowsFluid,
  packSolidAmountAcrossCars,
  packMixedAcrossCars,
  packFluidAcrossCars,
};
