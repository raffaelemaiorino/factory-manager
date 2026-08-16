/**
 * Calcolo mezzi/vagoni necessari per un piano di trasporto.
 *
 * Tempi interni in **secondi**; la portata è /min → quantità/viaggio = rate × (RtD_s / 60).
 * ...
 */

const {
  clampBeltMk,
  clampPipeMk,
  getBeltRate,
  getPipeRate,
  DEFAULT_MAX_BELT_MK,
  DEFAULT_MAX_PIPE_MK,
} = require('./transport');

const DEFAULT_TRANSPORT_BELT_MK = 5;
const DEFAULT_TRANSPORT_PIPE_MK = DEFAULT_MAX_PIPE_MK;
const PORTS_PER_STATION = 2;
const DEFAULT_TIME_UNIT = 'min'; // 'min' | 'sec' — solo preferenza UI

function ceilPositive(value) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.ceil(value - 1e-12);
}

function isFluidItem(item) {
  if (!item) return false;
  if (item.is_fluid === 1 || item.is_fluid === true) return true;
  if (item.is_fluid === 0 || item.is_fluid === false) return false;
  if (item.stack_size == null) return true;
  return false;
}

function roundTripSeconds(outboundSeconds, returnSeconds) {
  const outbound = Number(outboundSeconds);
  const ret = Number(returnSeconds);
  if (!Number.isFinite(outbound) || outbound <= 0) return null;
  if (!Number.isFinite(ret) || ret <= 0) return null;
  return outbound + ret;
}

/** @deprecated Usa roundTripSeconds; tenuto per compat test/chiamate legacy in minuti. */
function roundTripMinutes(outboundMinutes, returnMinutes) {
  const outbound = Number(outboundMinutes);
  const ret = Number(returnMinutes);
  if (!Number.isFinite(outbound) || outbound <= 0) return null;
  if (!Number.isFinite(ret) || ret <= 0) return null;
  return outbound + ret;
}

function minutesFromSeconds(seconds) {
  const s = Number(seconds);
  if (!Number.isFinite(s)) return null;
  return s / 60;
}

function secondsFromMinutes(minutes) {
  const m = Number(minutes);
  if (!Number.isFinite(m)) return null;
  return m * 60;
}

function normalizeTimeUnit(unit) {
  return String(unit || DEFAULT_TIME_UNIT).toLowerCase() === 'sec' ? 'sec' : 'min';
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

function vehicleUsesStationPorts(vehicle) {
  const slug = String(vehicle?.slug || '');
  return slug !== 'drone-transport';
}

/** Solo freight-wagon (treno): numero di convogli sulla tratta. */
function isTrainVehicle(vehicle) {
  return String(vehicle?.slug || '') === 'freight-wagon';
}

function normalizeTrainCount(value, vehicle) {
  if (!isTrainVehicle(vehicle)) return 1;
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 99);
}

function resolveTransportMkOptions(options = {}) {
  const beltMk = clampBeltMk(
    options.belt_mk != null ? options.belt_mk : DEFAULT_TRANSPORT_BELT_MK,
    DEFAULT_TRANSPORT_BELT_MK
  );
  const pipeMk = clampPipeMk(
    options.pipe_mk != null ? options.pipe_mk : DEFAULT_TRANSPORT_PIPE_MK,
    DEFAULT_TRANSPORT_PIPE_MK
  );
  const stationBeltMks = Array.isArray(options.station_belt_mks)
    ? options.station_belt_mks.map((mk) => clampBeltMk(mk, beltMk))
    : [];
  return { beltMk, pipeMk, stationBeltMks };
}

function stationThroughputSolid(beltMk) {
  return PORTS_PER_STATION * getBeltRate(beltMk);
}

function stationThroughputFluid(pipeMk) {
  return PORTS_PER_STATION * getPipeRate(pipeMk);
}

function limitingFactor(carsFromCapacity, stationsNeeded) {
  if (stationsNeeded > carsFromCapacity) return 'station';
  return 'capacity';
}

/**
 * Ripartisce `total` in `parts` quote il più uniformi possibile, ciascuna ≤ maxPerPart.
 */
function distributeEvenly(total, parts, maxPerPart = Infinity) {
  const n = Math.max(0, Math.floor(Number(parts)) || 0);
  const amount = Math.max(0, Number(total) || 0);
  if (n <= 0) return [];
  const shares = Array(n).fill(0);
  if (amount <= 0) return shares;

  const base = amount / n;
  let allocated = 0;
  for (let i = 0; i < n; i++) {
    const ideal = i === n - 1 ? amount - allocated : base;
    const qty = Math.min(maxPerPart, Math.max(0, ideal));
    shares[i] = qty;
    allocated += qty;
  }
  // Se il tetto maxPerPart ha lasciato residuo, non lo spingiamo oltre (carCount dovrebbe bastare)
  return shares;
}

function packSolidIntoOneCar(itemSlug, amount, stackSize, slotsPerCar) {
  const stack = Number(stackSize);
  const slots = Number(slotsPerCar);
  const grid = [];
  let remaining = Math.max(0, Number(amount) || 0);
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
  return grid;
}

/**
 * Pack solidi: ripartizione uniforme sui vagoni (non riempie il primo e lascia vuoti gli altri).
 */
function packSolidAmountAcrossCars(itemSlug, amount, stackSize, slotsPerCar, carCount) {
  const stack = Number(stackSize);
  const slots = Number(slotsPerCar);
  const nCars = Number(carCount);
  if (!(stack > 0) || !(slots > 0) || !(nCars > 0)) return [];
  const tripCap = slots * stack;
  const shares = distributeEvenly(amount, nCars, tripCap);
  return shares.map((share) => packSolidIntoOneCar(itemSlug, share, stack, slots));
}

/**
 * Mix: ogni item ripartito uniformemente sui vagoni condivisi, poi pack per slot.
 */
function packMixedAcrossCars(items, slotsPerCar, carCount) {
  const slots = Number(slotsPerCar);
  const nCars = Number(carCount);
  if (!(slots > 0) || !(nCars > 0)) return [];

  const perCarItems = Array.from({ length: nCars }, () => []);
  for (const item of items || []) {
    const stack = Number(item.stack_size);
    const amount = Number(item.amount_per_trip) || 0;
    if (!(stack > 0) || amount <= 0) continue;
    const tripCap = slots * stack;
    const shares = distributeEvenly(amount, nCars, tripCap);
    shares.forEach((share, idx) => {
      if (share > 1e-9) {
        perCarItems[idx].push({
          item_slug: item.item_slug,
          amount_per_trip: share,
          stack_size: stack,
        });
      }
    });
  }

  return perCarItems.map((carItems) => {
    const grid = Array(slots).fill(null);
    let slotIdx = 0;
    for (const item of carItems) {
      let remaining = Number(item.amount_per_trip) || 0;
      const stack = Number(item.stack_size);
      while (remaining > 1e-9 && slotIdx < slots) {
        const qty = Math.min(stack, remaining);
        grid[slotIdx] = {
          item_slug: item.item_slug,
          amount: qty,
          stack_size: stack,
          fill_ratio: qty / stack,
          is_fluid: false,
        };
        remaining -= qty;
        slotIdx += 1;
      }
    }
    return grid;
  });
}

/**
 * Fluidi: ripartizione uniforme tra i serbatoi.
 */
function packFluidAcrossCars(itemSlug, amount, fluidCap, carCount) {
  const cap = Number(fluidCap);
  const nCars = Number(carCount);
  if (!(cap > 0) || !(nCars > 0)) return [];
  const shares = distributeEvenly(amount, nCars, cap);
  return shares.map((qty) => [
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

/**
 * Quante stazioni servono per la portata, usando i Mk già scelti (se presenti) poi il default.
 */
function allocateStationsForRate(rate, {
  applyStationLimit,
  isFluid,
  defaultBeltMk,
  pipeMk,
  preferredBelts,
  startIndex,
}) {
  if (!applyStationLimit) {
    return { count: 0, mks: [], nextIndex: startIndex };
  }
  const target = Number(rate) || 0;
  if (target <= 0) return { count: 0, mks: [], nextIndex: startIndex };

  let covered = 0;
  const mks = [];
  let idx = startIndex;
  while (covered + 1e-9 < target) {
    const mk = isFluid
      ? clampPipeMk(
          preferredBelts[idx] != null ? preferredBelts[idx] : pipeMk,
          pipeMk
        )
      : clampBeltMk(
          preferredBelts[idx] != null ? preferredBelts[idx] : defaultBeltMk,
          defaultBeltMk
        );
    const thr = isFluid ? stationThroughputFluid(mk) : stationThroughputSolid(mk);
    mks.push(mk);
    covered += thr;
    idx += 1;
    if (mks.length > 200) break;
  }
  return { count: mks.length, mks, nextIndex: idx };
}

function padStationMks(mks, needed, defaultMk) {
  const out = [...(mks || [])];
  while (out.length < needed) out.push(defaultMk);
  return out.slice(0, needed);
}

function tripTimeMeta(rtdSeconds) {
  if (rtdSeconds == null) {
    return { round_trip_seconds: null, round_trip_minutes: null };
  }
  return {
    round_trip_seconds: rtdSeconds,
    round_trip_minutes: rtdSeconds / 60,
  };
}

function emptyResult(extra = {}) {
  return {
    ok: false,
    error: null,
    round_trip_seconds: null,
    round_trip_minutes: null,
    train_count: 1,
    vehicles_needed: 0,
    vehicles_needed_fleet: 0,
    stations_needed: 0,
    belts_or_pipes_needed: 0,
    ports_per_station: PORTS_PER_STATION,
    belt_mk: DEFAULT_TRANSPORT_BELT_MK,
    pipe_mk: DEFAULT_TRANSPORT_PIPE_MK,
    station_belt_mks: [],
    station_throughput_solid: stationThroughputSolid(DEFAULT_TRANSPORT_BELT_MK),
    station_throughput_fluid: stationThroughputFluid(DEFAULT_TRANSPORT_PIPE_MK),
    apply_station_limit: true,
    breakdown: [],
    composition: [],
    slot_views: [],
    ...extra,
  };
}

/**
 * @param {object} vehicle
 * @param {Array<object>} cargo
 * @param {number} outboundSeconds
 * @param {number} returnSeconds
 * @param {{ belt_mk?: number, pipe_mk?: number, station_belt_mks?: number[], train_count?: number }} [options]
 */
function calculateTransportNeed(vehicle, cargo, outboundSeconds, returnSeconds, options = {}) {
  const rtdSeconds = roundTripSeconds(outboundSeconds, returnSeconds);
  const rtdMinutes = rtdSeconds == null ? null : rtdSeconds / 60;
  const tripMeta = tripTimeMeta(rtdSeconds);
  const lines = Array.isArray(cargo) ? cargo : [];
  const { beltMk, pipeMk, stationBeltMks } = resolveTransportMkOptions(options);
  const applyStationLimit = vehicleUsesStationPorts(vehicle);
  const trainCount = normalizeTrainCount(options.train_count, vehicle);

  const mkMeta = {
    belt_mk: beltMk,
    pipe_mk: pipeMk,
    ports_per_station: PORTS_PER_STATION,
    station_throughput_solid: stationThroughputSolid(beltMk),
    station_throughput_fluid: stationThroughputFluid(pipeMk),
    apply_station_limit: applyStationLimit,
    train_count: trainCount,
  };

  if (!vehicle) {
    return emptyResult({
      error: 'vehicle_required',
      ...tripMeta,
      ...mkMeta,
    });
  }

  if (rtdSeconds == null || rtdMinutes == null) {
    return emptyResult({
      error: 'trip_times_required',
      ...tripTimeMeta(null),
      ...mkMeta,
    });
  }

  if (!lines.length) {
    return {
      ok: true,
      error: null,
      ...tripMeta,
      train_count: trainCount,
      vehicles_needed: 0,
      vehicles_needed_fleet: 0,
      stations_needed: 0,
      belts_or_pipes_needed: 0,
      station_belt_mks: [],
      breakdown: [],
      composition: [],
      slot_views: [],
      mode: 'per_cargo_mix',
      ...mkMeta,
    };
  }

  const slots = Number(vehicle.inventory_slots);
  const fluidCap = Number(vehicle.fluid_capacity);
  const breakdown = [];
  const incompatibilities = [];
  const mixPool = [];
  const composition = [];
  const slotViews = [];
  const flatStationBeltMks = [];
  let vehiclesNeeded = 0;

  const allocOpts = {
    applyStationLimit,
    defaultBeltMk: beltMk,
    pipeMk,
    preferredBelts: stationBeltMks,
  };

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

    const ratePerTrain = rate / trainCount;
    const amountPerTrip = ratePerTrain * rtdMinutes;
    const allowMix = normalizeAllowMix(line, fluid);

    if (fluid) {
      if (!Number.isFinite(fluidCap) || fluidCap <= 0) {
        incompatibilities.push({ item_slug: line.item_slug, error: 'no_fluid_capacity' });
        continue;
      }
      const carsFromCapacity = ceilPositive(amountPerTrip / fluidCap);
      const alloc = allocateStationsForRate(ratePerTrain, {
        ...allocOpts,
        isFluid: true,
        startIndex: flatStationBeltMks.length,
      });
      const needed = Math.max(carsFromCapacity, alloc.count);
      const mks = padStationMks(alloc.mks, needed, pipeMk);
      flatStationBeltMks.push(...mks);
      breakdown.push({
        item_slug: line.item_slug,
        rate,
        rate_per_train: ratePerTrain,
        is_fluid: true,
        allow_mix: false,
        stack_size: null,
        amount_per_trip: amountPerTrip,
        trip_capacity: fluidCap,
        cars_from_capacity: carsFromCapacity,
        stations_needed: alloc.count,
        units_needed: needed,
        limiting: limitingFactor(carsFromCapacity, alloc.count),
        mix_group: false,
        station_mks: mks,
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
          station_mks: mks,
        });
        slotViews.push({
          kind: 'dedicated',
          item_slug: line.item_slug,
          is_fluid: true,
          cars: packFluidAcrossCars(line.item_slug, amountPerTrip, fluidCap, needed),
          station_mks: mks,
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
        rate_per_train: ratePerTrain,
        stack_size: stack,
        amount_per_trip: amountPerTrip,
        trip_capacity: tripCapacity,
        stacks_per_trip: stacksNeeded,
      });
      continue;
    }

    const carsFromCapacity = ceilPositive(amountPerTrip / tripCapacity);
    const alloc = allocateStationsForRate(ratePerTrain, {
      ...allocOpts,
      isFluid: false,
      startIndex: flatStationBeltMks.length,
    });
    const needed = Math.max(carsFromCapacity, alloc.count);
    const mks = padStationMks(alloc.mks, needed, beltMk);
    flatStationBeltMks.push(...mks);

    breakdown.push({
      item_slug: line.item_slug,
      rate,
      rate_per_train: ratePerTrain,
      is_fluid: false,
      allow_mix: false,
      stack_size: stack,
      amount_per_trip: amountPerTrip,
      trip_capacity: tripCapacity,
      stacks_per_trip: stacksNeeded,
      cars_from_capacity: carsFromCapacity,
      stations_needed: alloc.count,
      units_needed: needed,
      limiting: limitingFactor(carsFromCapacity, alloc.count),
      mix_group: false,
      station_mks: mks,
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
        station_mks: mks,
      });
      slotViews.push({
        kind: 'dedicated',
        item_slug: line.item_slug,
        is_fluid: false,
        cars: packSolidAmountAcrossCars(line.item_slug, amountPerTrip, stack, slots, needed),
        station_mks: mks,
      });
    }
  }

  if (mixPool.length) {
    const totalStacks = mixPool.reduce((sum, row) => sum + row.stacks_per_trip, 0);
    const carsFromCapacity = slots > 0 ? ceilPositive(totalStacks / slots) : 0;
    const mixRate = mixPool.reduce((sum, row) => sum + (row.rate_per_train ?? row.rate), 0);
    const alloc = allocateStationsForRate(mixRate, {
      ...allocOpts,
      isFluid: false,
      startIndex: flatStationBeltMks.length,
    });
    const mixCars = Math.max(carsFromCapacity, alloc.count);
    const mks = padStationMks(alloc.mks, mixCars, beltMk);
    flatStationBeltMks.push(...mks);

    for (const row of mixPool) {
      breakdown.push({
        item_slug: row.item_slug,
        rate: row.rate,
        rate_per_train: row.rate_per_train ?? row.rate,
        is_fluid: false,
        allow_mix: true,
        stack_size: row.stack_size,
        amount_per_trip: row.amount_per_trip,
        trip_capacity: row.trip_capacity,
        stacks_per_trip: row.stacks_per_trip,
        cars_from_capacity: carsFromCapacity,
        stations_needed: alloc.count,
        units_needed: mixCars,
        limiting: limitingFactor(carsFromCapacity, alloc.count),
        mix_group: true,
        mix_group_units: mixCars,
        station_mks: mks,
      });
    }

    vehiclesNeeded += mixCars;
    if (mixCars > 0) {
      const viewIndex = slotViews.length;
      composition.push({
        kind: 'mixed',
        item_slugs: mixPool.map((row) => row.item_slug),
        is_fluid: false,
        count: mixCars,
        view_index: viewIndex,
        station_mks: mks,
      });
      slotViews.push({
        kind: 'mixed',
        item_slugs: mixPool.map((row) => row.item_slug),
        is_fluid: false,
        cars: packMixedAcrossCars(mixPool, slots, mixCars),
        station_mks: mks,
      });
    }
  }

  const stationsDisplay = applyStationLimit ? vehiclesNeeded : 0;
  const beltsOrPipesNeeded = applyStationLimit ? stationsDisplay * PORTS_PER_STATION : 0;

  if (incompatibilities.length && !breakdown.length) {
    return {
      ok: false,
      error: incompatibilities[0].error,
      incompatibilities,
      ...tripMeta,
      train_count: trainCount,
      vehicles_needed: 0,
      vehicles_needed_fleet: 0,
      stations_needed: 0,
      belts_or_pipes_needed: 0,
      station_belt_mks: [],
      breakdown: [],
      composition: [],
      slot_views: [],
      mode: 'per_cargo_mix',
      ...mkMeta,
    };
  }

  return {
    ok: incompatibilities.length === 0,
    error: incompatibilities.length ? incompatibilities[0].error : null,
    incompatibilities,
    ...tripMeta,
    train_count: trainCount,
    vehicles_needed: vehiclesNeeded,
    vehicles_needed_fleet: vehiclesNeeded * trainCount,
    stations_needed: stationsDisplay,
    belts_or_pipes_needed: beltsOrPipesNeeded,
    station_belt_mks: applyStationLimit ? flatStationBeltMks : [],
    mode: 'per_cargo_mix',
    vehicle_slug: vehicle.slug,
    inventory_slots: vehicle.inventory_slots ?? null,
    fluid_capacity: vehicle.fluid_capacity ?? null,
    breakdown,
    composition,
    slot_views: slotViews,
    ...mkMeta,
  };
}

module.exports = {
  calculateTransportNeed,
  roundTripSeconds,
  roundTripMinutes,
  minutesFromSeconds,
  secondsFromMinutes,
  normalizeTimeUnit,
  DEFAULT_TIME_UNIT,
  isFluidItem,
  ceilPositive,
  distributeEvenly,
  vehicleAllowsSolid,
  vehicleAllowsFluid,
  vehicleUsesStationPorts,
  isTrainVehicle,
  normalizeTrainCount,
  packSolidAmountAcrossCars,
  packMixedAcrossCars,
  packFluidAcrossCars,
  PORTS_PER_STATION,
  DEFAULT_TRANSPORT_BELT_MK,
  DEFAULT_TRANSPORT_PIPE_MK,
  DEFAULT_MAX_BELT_MK,
  DEFAULT_MAX_PIPE_MK,
};
