const {
  roundProduction,
  roundConfigOutput,
  clampOverclock,
  clampMachineCount,
  isIntegerOverclock,
  roundTargetOutput,
  DEFAULT_OVERCLOCK,
  DEFAULT_MACHINE_COUNT,
  OVERCLOCK_MIN,
  OVERCLOCK_MAX,
} = require('./production-scale');

const ENERGY_MACHINE_SLIDER_MAX = 600;

const GENERATOR_DEFINITIONS = {
  'generator-coal': {
    slug: 'generator-coal',
    basePowerMw: 75,
    waterPerMin: 45,
    fuelOptions: [
      { slug: 'coal', label: 'Carbone', ratePerMin: 15 },
      { slug: 'compacted-coal', label: 'Carbone compatto', ratePerMin: 50 / 7 },
      { slug: 'petroleum-coke', label: 'Coke petrolifero', ratePerMin: 25 },
    ],
  },
  'generator-fuel': {
    slug: 'generator-fuel',
    basePowerMw: 250,
    waterPerMin: 0,
    fuelIsFluid: true,
    fuelOptions: [
      { slug: 'ionized-fuel', label: 'Carburante ionizzato', ratePerMin: 3 },
      { slug: 'rocket-fuel', label: 'Carburante per razzi', ratePerMin: 4.17 },
      { slug: 'liquid-turbo-fuel', label: 'Turbocarburante', ratePerMin: 7.5 },
      { slug: 'liquid-biofuel', label: 'Biocarburante liquido', ratePerMin: 20 },
      { slug: 'liquid-fuel', label: 'Carburante', ratePerMin: 20 },
    ],
  },
  'generator-nuclear': {
    slug: 'generator-nuclear',
    basePowerMw: 2500,
    waterPerMin: 240,
    fuelOptions: [
      { slug: 'plutonium-fuel-rod', label: 'Barra di combustibile di plutonio', ratePerMin: 0.1, wasteSlug: 'plutonium-waste', wasteLabel: 'Scorie di plutonio', wastePerRod: 10 },
      { slug: 'nuclear-fuel-rod', label: 'Barra di combustibile di uranio', ratePerMin: 0.2, wasteSlug: 'nuclear-waste', wasteLabel: 'Scorie di uranio', wastePerRod: 50 },
      { slug: 'ficsonium-fuel-rod', label: 'Barra di combustibile di ficsonio', ratePerMin: 1 },
    ],
  },
};

const SUPPORTED_GENERATOR_SLUGS = Object.keys(GENERATOR_DEFINITIONS);

function getGeneratorDefinition(buildingSlug) {
  return GENERATOR_DEFINITIONS[buildingSlug] ?? null;
}

function getSupportedGenerators() {
  return SUPPORTED_GENERATOR_SLUGS.map((slug) => ({
    slug,
    ...GENERATOR_DEFINITIONS[slug],
  }));
}

function getFuelOption(definition, fuelSlug) {
  if (!definition) return null;
  const match = definition.fuelOptions.find((option) => option.slug === fuelSlug);
  return match ?? definition.fuelOptions[0] ?? null;
}

function getDefaultFuelSlug(definition) {
  return definition?.fuelOptions?.[0]?.slug ?? 'coal';
}

function getBasePowerPerMachine(definition) {
  return Number(definition?.basePowerMw) || 0;
}

function computeMaxTargetFuel(fuelRatePerMin, machineCount) {
  const rate = Number(fuelRatePerMin);
  const machines = clampMachineCount(machineCount);
  if (!rate || !machines) return 1;
  return rate * machines * (OVERCLOCK_MAX / 100);
}

function computeMinTargetFuel(fuelRatePerMin, machineCount) {
  return computeFuelConsumption(fuelRatePerMin, machineCount, OVERCLOCK_MIN);
}

function clampTargetFuelToRange(targetFuel, fuelRatePerMin, machineCount) {
  const max = computeMaxTargetFuel(fuelRatePerMin, machineCount);
  const min = computeMinTargetFuel(fuelRatePerMin, machineCount);
  return Math.min(max, Math.max(min, Number(targetFuel)));
}

function clampTargetFuelToMax(targetFuel, fuelRatePerMin, machineCount) {
  return clampTargetFuelToRange(targetFuel, fuelRatePerMin, machineCount);
}

function normalizeGeneratorOverclock(rawOverclock) {
  const n = Number(rawOverclock);
  if (!Number.isFinite(n)) return DEFAULT_OVERCLOCK;
  const nearestInt = Math.round(n);
  if (Math.abs(n - nearestInt) < 0.01) {
    return Math.min(OVERCLOCK_MAX, Math.max(OVERCLOCK_MIN, nearestInt));
  }
  return clampOverclock(n);
}

function computeWasteOutput(fuelConsumption, wastePerRod) {
  const fuel = Number(fuelConsumption);
  const perRod = Number(wastePerRod);
  if (!fuel || !perRod) return 0;
  return roundProduction(fuel * perRod);
}

function buildWasteFields(fuelOption, fuelConsumption) {
  if (!fuelOption?.wasteSlug || !fuelOption?.wastePerRod) {
    return {
      waste_item_slug: null,
      waste_label: null,
      waste_per_rod: 0,
      waste_output: 0,
    };
  }
  return {
    waste_item_slug: fuelOption.wasteSlug,
    waste_label: fuelOption.wasteLabel ?? fuelOption.wasteSlug,
    waste_per_rod: fuelOption.wastePerRod,
    waste_output: computeWasteOutput(fuelConsumption, fuelOption.wastePerRod),
  };
}

function buildGeneratorProductionResult(buildingSlug, definition, fuelOption, basePower, state) {
  const machineCount = clampMachineCount(state.machine_count);
  const overclock = normalizeGeneratorOverclock(state.overclock);
  const targetFuel = state.fuelFromInput
    ? Number(state.target_fuel_input)
    : computeFuelConsumption(fuelOption.ratePerMin, machineCount, overclock);
  const powerOutputMw = computeTargetPower(basePower, machineCount, overclock);
  const waterConsumption = computeWaterConsumption(definition.waterPerMin, machineCount, overclock);

  return {
    building_slug: buildingSlug,
    fuel_slug: state.fuel_slug ?? fuelOption.slug,
    machine_count: machineCount,
    overclock,
    target_fuel_input: targetFuel,
    target_power: powerOutputMw,
    base_power_per_machine: basePower,
    max_target_fuel: computeMaxTargetFuel(fuelOption.ratePerMin, machineCount),
    max_target_power: computeMaxTargetPower(basePower, machineCount),
    power_output_mw: powerOutputMw,
    fuel_consumption: targetFuel,
    water_consumption: waterConsumption,
    fuel_item_slug: fuelOption.slug,
    fuel_label: fuelOption.label,
    fuel_rate_base: fuelOption.ratePerMin,
    water_rate_base: definition.waterPerMin,
    ...buildWasteFields(fuelOption, targetFuel),
  };
}

function applyGeneratorChange(buildingSlug, current, changedField, rawValue) {
  const definition = getGeneratorDefinition(buildingSlug);
  if (!definition) return null;

  const basePower = getBasePowerPerMachine(definition);
  const fuelOption = getFuelOption(definition, current.fuel_slug);
  if (!fuelOption) return null;

  const rate = fuelOption.ratePerMin;
  let machine_count = clampMachineCount(current.machine_count);
  let overclock = clampOverclock(current.overclock);
  let target_fuel_input = Number(current.target_fuel_input);

  if (changedField === 'fuel' || changedField === 'target_fuel_input') {
    target_fuel_input = Number(rawValue);
    if (!Number.isFinite(target_fuel_input) || target_fuel_input <= 0) return null;
    target_fuel_input = clampTargetFuelToRange(target_fuel_input, rate, machine_count);
    overclock = computeGeneratorOverclockFromFuel(target_fuel_input, rate, machine_count);
  } else if (changedField === 'machines') {
    machine_count = clampMachineCount(rawValue);
    target_fuel_input = computeFuelConsumption(rate, machine_count, overclock);
    target_fuel_input = clampTargetFuelToMax(target_fuel_input, rate, machine_count);
  } else if (changedField === 'overclock' || changedField === 'overclock-slider') {
    overclock =
      changedField === 'overclock-slider'
        ? clampOverclock(Math.round(Number(rawValue)))
        : clampOverclock(rawValue);
    target_fuel_input = computeFuelConsumption(rate, machine_count, overclock);
    target_fuel_input = clampTargetFuelToMax(target_fuel_input, rate, machine_count);
  } else {
    return null;
  }

  return buildGeneratorProductionResult(buildingSlug, definition, fuelOption, basePower, {
    fuel_slug: current.fuel_slug,
    machine_count,
    overclock,
    target_fuel_input,
    fuelFromInput: changedField === 'fuel' || changedField === 'target_fuel_input',
  });
}

function computeGeneratorOverclockFromFuel(targetFuel, fuelRatePerMin, machineCount) {
  const rate = Number(fuelRatePerMin);
  const target = Number(targetFuel);
  const machines = clampMachineCount(machineCount);
  if (!rate || !target || !machines) return DEFAULT_OVERCLOCK;
  return normalizeGeneratorOverclock((target / (rate * machines)) * 100);
}

function computeMaxTargetPower(basePower, machineCount) {
  const base = Number(basePower);
  const machines = clampMachineCount(machineCount);
  if (!base || !machines) return 1;
  return roundConfigOutput(base * machines * (OVERCLOCK_MAX / 100));
}

function computeTargetPower(basePower, machineCount, overclock) {
  const base = Number(basePower);
  const machines = clampMachineCount(machineCount);
  const oc = clampOverclock(overclock);
  if (!base) return 0;
  return roundTargetOutput(base * machines * (oc / 100), oc);
}

function computeFuelConsumption(fuelRatePerMin, machineCount, overclock) {
  const rate = Number(fuelRatePerMin);
  const machines = clampMachineCount(machineCount);
  const oc = clampOverclock(overclock);
  if (!rate || !machines) return 0;
  if (Math.abs(oc - DEFAULT_OVERCLOCK) < 0.0005) {
    return rate * machines;
  }
  return roundProduction(rate * machines * (oc / 100));
}

function computeWaterConsumption(waterRatePerMin, machineCount, overclock) {
  return computeFuelConsumption(waterRatePerMin, machineCount, overclock);
}

function resolveGeneratorProduction(buildingSlug, stored = {}) {
  const definition = getGeneratorDefinition(buildingSlug);
  if (!definition) {
    throw new Error('Generatore non supportato');
  }

  const basePower = getBasePowerPerMachine(definition);
  const fuelSlug =
    stored.fuel_slug && getFuelOption(definition, stored.fuel_slug)
      ? stored.fuel_slug
      : getDefaultFuelSlug(definition);
  const fuelOption = getFuelOption(definition, fuelSlug);
  const machineCount =
    stored.machine_count != null && stored.machine_count !== ''
      ? clampMachineCount(stored.machine_count)
      : DEFAULT_MACHINE_COUNT;

  let overclock =
    stored.overclock != null && stored.overclock !== ''
      ? clampOverclock(stored.overclock)
      : DEFAULT_OVERCLOCK;

  let targetFuel =
    stored.target_fuel_input != null && stored.target_fuel_input !== ''
      ? Number(stored.target_fuel_input)
      : computeFuelConsumption(fuelOption.ratePerMin, machineCount, overclock);

  if (!Number.isFinite(targetFuel) || targetFuel <= 0) {
    targetFuel = computeFuelConsumption(fuelOption.ratePerMin, machineCount, DEFAULT_OVERCLOCK);
  }

  targetFuel = clampTargetFuelToMax(targetFuel, fuelOption.ratePerMin, machineCount);
  overclock = computeGeneratorOverclockFromFuel(targetFuel, fuelOption.ratePerMin, machineCount);
  const fuelWasStored =
    stored.target_fuel_input != null && stored.target_fuel_input !== '';
  if (!fuelWasStored) {
    targetFuel = computeFuelConsumption(fuelOption.ratePerMin, machineCount, overclock);
  }

  const powerOutputMw = computeTargetPower(basePower, machineCount, overclock);
  const waterConsumption = computeWaterConsumption(definition.waterPerMin, machineCount, overclock);

  return {
    building_slug: buildingSlug,
    fuel_slug: fuelSlug,
    machine_count: machineCount,
    overclock,
    target_fuel_input: targetFuel,
    target_power: powerOutputMw,
    base_power_per_machine: basePower,
    max_target_fuel: computeMaxTargetFuel(fuelOption.ratePerMin, machineCount),
    max_target_power: computeMaxTargetPower(basePower, machineCount),
    power_output_mw: powerOutputMw,
    fuel_consumption: targetFuel,
    water_consumption: waterConsumption,
    fuel_item_slug: fuelOption.slug,
    fuel_label: fuelOption.label,
    fuel_rate_base: fuelOption.ratePerMin,
    water_rate_base: definition.waterPerMin,
    ...buildWasteFields(fuelOption, targetFuel),
  };
}

function scaleGeneratorForUpdate(buildingSlug, existing, patch) {
  const definition = getGeneratorDefinition(buildingSlug);
  const fuelSlug = patch.fuel_slug ?? existing.fuel_slug;
  const fuelOption = getFuelOption(definition, fuelSlug);
  const machineCount =
    patch.machine_count != null && patch.machine_count !== ''
      ? patch.machine_count
      : existing.machine_count;

  const fuelChanged =
    patch.fuel_slug != null &&
    patch.fuel_slug !== '' &&
    patch.fuel_slug !== existing.fuel_slug;

  if (fuelChanged) {
    return resolveGeneratorProduction(buildingSlug, {
      fuel_slug: fuelSlug,
      machine_count: machineCount,
      overclock: DEFAULT_OVERCLOCK,
    });
  }

  if (
    patch.machine_count != null &&
    patch.machine_count !== '' &&
    patch.target_fuel_input == null &&
    patch.overclock == null
  ) {
    return applyGeneratorChange(buildingSlug, existing, 'machines', patch.machine_count);
  }

  if (
    patch.target_fuel_input != null &&
    patch.target_fuel_input !== '' &&
    patch.machine_count == null &&
    patch.overclock == null
  ) {
    return applyGeneratorChange(buildingSlug, existing, 'fuel', patch.target_fuel_input);
  }

  if (
    patch.overclock != null &&
    patch.overclock !== '' &&
    patch.target_fuel_input == null &&
    patch.machine_count == null
  ) {
    return applyGeneratorChange(buildingSlug, existing, 'overclock-slider', patch.overclock);
  }

  if (patch.target_fuel_input != null && patch.target_fuel_input !== '') {
    return resolveGeneratorProduction(buildingSlug, {
      fuel_slug: fuelSlug,
      machine_count: machineCount,
      target_fuel_input: patch.target_fuel_input,
    });
  }

  return resolveGeneratorProduction(buildingSlug, {
    fuel_slug: fuelSlug,
    machine_count: machineCount,
    overclock: patch.overclock ?? existing.overclock,
  });
}

module.exports = {
  GENERATOR_DEFINITIONS,
  SUPPORTED_GENERATOR_SLUGS,
  getGeneratorDefinition,
  getSupportedGenerators,
  getFuelOption,
  getDefaultFuelSlug,
  getBasePowerPerMachine,
  computeMaxTargetFuel,
  computeMinTargetFuel,
  computeMaxTargetPower,
  computeGeneratorOverclockFromFuel,
  computeTargetPower,
  computeFuelConsumption,
  computeWaterConsumption,
  computeWasteOutput,
  applyGeneratorChange,
  resolveGeneratorProduction,
  scaleGeneratorForUpdate,
  DEFAULT_OVERCLOCK,
  DEFAULT_MACHINE_COUNT,
  OVERCLOCK_MIN,
  OVERCLOCK_MAX,
  ENERGY_MACHINE_SLIDER_MAX,
};
