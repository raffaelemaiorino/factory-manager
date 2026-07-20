(() => {
  const GENERATOR_DEFINITIONS = {
    'generator-coal': {
      slug: 'generator-coal',
      basePowerMw: 75,
      waterPerMin: 45,
      fuelOptions: [
        { slug: 'coal', label: 'Coal', ratePerMin: 15 },
        { slug: 'compacted-coal', label: 'Compacted Coal', ratePerMin: 50 / 7 },
        { slug: 'petroleum-coke', label: 'Petroleum Coke', ratePerMin: 25 },
      ],
    },
    'generator-fuel': {
      slug: 'generator-fuel',
      basePowerMw: 250,
      waterPerMin: 0,
      fuelIsFluid: true,
      fuelOptions: [
        { slug: 'ionized-fuel', label: 'Ionized Fuel', ratePerMin: 3 },
        { slug: 'rocket-fuel', label: 'Rocket Fuel', ratePerMin: 4.17 },
        { slug: 'liquid-turbo-fuel', label: 'Turbofuel', ratePerMin: 7.5 },
        { slug: 'liquid-biofuel', label: 'Liquid Biofuel', ratePerMin: 20 },
        { slug: 'liquid-fuel', label: 'Fuel', ratePerMin: 20 },
      ],
    },
    'generator-nuclear': {
      slug: 'generator-nuclear',
      basePowerMw: 2500,
      waterPerMin: 240,
      fuelOptions: [
        { slug: 'plutonium-fuel-rod', label: 'Plutonium Fuel Rod', ratePerMin: 0.1, wasteSlug: 'plutonium-waste', wasteLabel: 'Plutonium Waste', wastePerRod: 10 },
        { slug: 'nuclear-fuel-rod', label: 'Uranium Fuel Rod', ratePerMin: 0.2, wasteSlug: 'nuclear-waste', wasteLabel: 'Uranium Waste', wastePerRod: 50 },
        { slug: 'ficsonium-fuel-rod', label: 'Ficsonium Fuel Rod', ratePerMin: 1 },
      ],
    },
  };

  const PS = () => window.ProductionScale;
  const ENERGY_MACHINE_SLIDER_MAX = 600;

  function getGeneratorDefinition(buildingSlug) {
    return GENERATOR_DEFINITIONS[buildingSlug] ?? null;
  }

  function getFuelOption(definition, fuelSlug) {
    if (!definition) return null;
    return definition.fuelOptions.find((option) => option.slug === fuelSlug) ?? definition.fuelOptions[0];
  }

  function computeMaxTargetFuel(fuelRatePerMin, machineCount) {
    const rate = Number(fuelRatePerMin);
    const machines = PS().clampMachineCount(machineCount);
    if (!rate || !machines) return 1;
    return rate * machines * (PS().OVERCLOCK_MAX / 100);
  }

  function computeMinTargetFuel(fuelRatePerMin, machineCount) {
    return computeFuelConsumption(fuelRatePerMin, machineCount, PS().OVERCLOCK_MIN);
  }

  function clampTargetFuelToRange(targetFuel, fuelRatePerMin, machineCount) {
    const max = computeMaxTargetFuel(fuelRatePerMin, machineCount);
    const min = computeMinTargetFuel(fuelRatePerMin, machineCount);
    return Math.min(max, Math.max(min, Number(targetFuel)));
  }

  function clampTargetFuelToMax(targetFuel, fuelRatePerMin, machineCount) {
    return clampTargetFuelToRange(targetFuel, fuelRatePerMin, machineCount);
  }

  function computeGeneratorOverclockFromFuel(targetFuel, fuelRatePerMin, machineCount) {
    const rate = Number(fuelRatePerMin);
    const target = Number(targetFuel);
    const machines = PS().clampMachineCount(machineCount);
    if (!rate || !target || !machines) return PS().DEFAULT_OVERCLOCK;
    return normalizeGeneratorOverclock((target / (rate * machines)) * 100);
  }

  function computeTargetPower(basePower, machineCount, overclock) {
    const base = Number(basePower);
    const machines = PS().clampMachineCount(machineCount);
    const oc = PS().clampOverclock(overclock);
    if (!base) return 0;
    return PS().roundTargetOutput(base * machines * (oc / 100), oc);
  }

  function computeFuelConsumption(fuelRatePerMin, machineCount, overclock) {
    const rate = Number(fuelRatePerMin);
    const machines = PS().clampMachineCount(machineCount);
    const oc = PS().clampOverclock(overclock);
    if (!rate || !machines) return 0;
    if (Math.abs(oc - PS().DEFAULT_OVERCLOCK) < 0.0005) {
      return rate * machines;
    }
    return PS().roundProduction(rate * machines * (oc / 100));
  }

  function computeMaxTargetPower(basePower, machineCount) {
    const base = Number(basePower);
    const machines = PS().clampMachineCount(machineCount);
    if (!base || !machines) return 1;
    return PS().roundConfigOutput(base * machines * (PS().OVERCLOCK_MAX / 100));
  }

  function normalizeGeneratorOverclock(rawOverclock) {
    const n = Number(rawOverclock);
    if (!Number.isFinite(n)) return PS().DEFAULT_OVERCLOCK;
    const nearestInt = Math.round(n);
    if (Math.abs(n - nearestInt) < 0.01) {
      return Math.min(PS().OVERCLOCK_MAX, Math.max(PS().OVERCLOCK_MIN, nearestInt));
    }
    return PS().clampOverclock(n);
  }

  function computeWasteOutput(fuelConsumption, wastePerRod) {
    const fuel = Number(fuelConsumption);
    const perRod = Number(wastePerRod);
    if (!fuel || !perRod) return 0;
    return PS().roundProduction(fuel * perRod);
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
    const machineCount = PS().clampMachineCount(state.machine_count);
    const overclock = normalizeGeneratorOverclock(state.overclock);
    const targetFuel = state.fuelFromInput
      ? Number(state.target_fuel_input)
      : computeFuelConsumption(fuelOption.ratePerMin, machineCount, overclock);
    const powerOutputMw = computeTargetPower(basePower, machineCount, overclock);

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
      water_consumption: computeFuelConsumption(definition.waterPerMin, machineCount, overclock),
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

    const basePower = definition.basePowerMw;
    const fuelOption = getFuelOption(definition, current.fuel_slug);
    if (!fuelOption) return null;

    const rate = fuelOption.ratePerMin;
    let machine_count = PS().clampMachineCount(current.machine_count);
    let overclock = PS().clampOverclock(current.overclock);
    let target_fuel_input = Number(current.target_fuel_input);

    if (changedField === 'fuel' || changedField === 'target_fuel_input') {
      target_fuel_input = Number(rawValue);
      if (!Number.isFinite(target_fuel_input) || target_fuel_input <= 0) return null;
      target_fuel_input = clampTargetFuelToRange(target_fuel_input, rate, machine_count);
      overclock = computeGeneratorOverclockFromFuel(target_fuel_input, rate, machine_count);
    } else if (changedField === 'machines') {
      machine_count = PS().clampMachineCount(rawValue);
      target_fuel_input = computeFuelConsumption(rate, machine_count, overclock);
      target_fuel_input = clampTargetFuelToMax(target_fuel_input, rate, machine_count);
    } else if (changedField === 'overclock' || changedField === 'overclock-slider') {
      overclock =
        changedField === 'overclock-slider'
          ? PS().clampOverclock(Math.round(Number(rawValue)))
          : PS().clampOverclock(rawValue);
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

  function resolveGeneratorProduction(buildingSlug, stored = {}) {
    const definition = getGeneratorDefinition(buildingSlug);
    if (!definition) throw new Error('Generatore non supportato');

    const basePower = definition.basePowerMw;
    const fuelSlug =
      stored.fuel_slug && getFuelOption(definition, stored.fuel_slug)
        ? stored.fuel_slug
        : definition.fuelOptions[0].slug;
    const fuelOption = getFuelOption(definition, fuelSlug);
    const machineCount =
      stored.machine_count != null && stored.machine_count !== ''
        ? PS().clampMachineCount(stored.machine_count)
        : PS().DEFAULT_MACHINE_COUNT;

    let targetFuel =
      stored.target_fuel_input != null && stored.target_fuel_input !== ''
        ? Number(stored.target_fuel_input)
        : computeFuelConsumption(fuelOption.ratePerMin, machineCount, PS().DEFAULT_OVERCLOCK);

    if (!Number.isFinite(targetFuel) || targetFuel <= 0) {
      targetFuel = computeFuelConsumption(fuelOption.ratePerMin, machineCount, PS().DEFAULT_OVERCLOCK);
    }

    targetFuel = clampTargetFuelToMax(targetFuel, fuelOption.ratePerMin, machineCount);
    const overclock = computeGeneratorOverclockFromFuel(targetFuel, fuelOption.ratePerMin, machineCount);
    const fuelWasStored =
      stored.target_fuel_input != null && stored.target_fuel_input !== '';
    if (!fuelWasStored) {
      targetFuel = computeFuelConsumption(fuelOption.ratePerMin, machineCount, overclock);
    }

    return {
      building_slug: buildingSlug,
      fuel_slug: fuelSlug,
      machine_count: machineCount,
      overclock,
      target_fuel_input: targetFuel,
      target_power: computeTargetPower(basePower, machineCount, overclock),
      base_power_per_machine: basePower,
      max_target_fuel: computeMaxTargetFuel(fuelOption.ratePerMin, machineCount),
      max_target_power: computeMaxTargetPower(basePower, machineCount),
      power_output_mw: computeTargetPower(basePower, machineCount, overclock),
      fuel_consumption: targetFuel,
      water_consumption: computeFuelConsumption(definition.waterPerMin, machineCount, overclock),
      fuel_item_slug: fuelOption.slug,
      fuel_label: fuelOption.label,
      fuel_rate_base: fuelOption.ratePerMin,
      water_rate_base: definition.waterPerMin,
      ...buildWasteFields(fuelOption, targetFuel),
    };
  }

  function scaleGeneratorForUpdate(existing, patch = {}) {
    const buildingSlug = existing.building_slug;
    const fuelSlug = patch.fuel_slug ?? existing.fuel_slug;
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
        overclock: PS().DEFAULT_OVERCLOCK,
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

  window.EnergyScale = {
    GENERATOR_DEFINITIONS,
    getGeneratorDefinition,
    getFuelOption,
    computeMaxTargetFuel,
    computeMinTargetFuel,
    computeGeneratorOverclockFromFuel,
    computeTargetPower,
    computeFuelConsumption,
    computeMaxTargetPower,
    applyGeneratorChange,
    resolveGeneratorProduction,
    scaleGeneratorForUpdate,
    DEFAULT_OVERCLOCK: PS().DEFAULT_OVERCLOCK,
    DEFAULT_MACHINE_COUNT: PS().DEFAULT_MACHINE_COUNT,
    OVERCLOCK_MIN: PS().OVERCLOCK_MIN,
    OVERCLOCK_MAX: PS().OVERCLOCK_MAX,
    ENERGY_MACHINE_SLIDER_MAX,
  };
})();
