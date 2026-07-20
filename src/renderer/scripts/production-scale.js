(function () {
  const OVERCLOCK_MIN = 1;
  const OVERCLOCK_MAX = 250;
  const DEFAULT_OVERCLOCK = 100;
  const DEFAULT_MACHINE_COUNT = 1;
  const PRODUCTION_DECIMALS = 3;
  const PRODUCTION_FP_EPSILON = 1e-9;
  const MACHINE_SLIDER_MAX = 100;

  function getPrimaryOutput(schema, item) {
    if (!schema?.outputs?.length) return null;
    if (item?.slug) {
      const match = schema.outputs.find((output) => output.item_slug === item.slug);
      if (match) return match;
    }
    return schema.outputs[0];
  }

  function outputPerMinute(amount, duration) {
    const cycleSeconds = Number(duration);
    if (!cycleSeconds || cycleSeconds <= 0) return 0;
    return (Number(amount) / cycleSeconds) * 60;
  }

  function getBaseOutputPerMin(schema, item) {
    const primary = getPrimaryOutput(schema, item);
    if (!primary) return 0;
    return outputPerMinute(primary.amount, schema.duration);
  }

  function getDefaultTargetOutput(schema, item) {
    const base = getBaseOutputPerMin(schema, item);
    return base || 60;
  }

  function roundProduction(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    const factor = 10 ** PRODUCTION_DECIMALS;
    const scaled = n * factor;
    const nearest = Math.round(scaled);
    if (Math.abs(scaled - nearest) < PRODUCTION_FP_EPSILON) {
      return nearest / factor;
    }
    return Math.ceil(scaled - 1e-12) / factor;
  }

  function roundConfigOutput(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 1;
    if (n < 1) return roundProduction(n);
    return Math.max(1, Math.round(n));
  }

  function isIntegerOverclock(overclock) {
    const oc = Number(overclock);
    if (!Number.isFinite(oc)) return true;
    return Math.abs(oc - Math.round(oc)) < 0.0005;
  }

  function normalizeTargetOutput(value, overclock) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    if (
      isIntegerOverclock(overclock) &&
      n >= 1 - 0.0005 &&
      Math.abs(n - Math.round(n)) < 0.0005
    ) {
      return Math.round(n);
    }
    return roundProduction(n);
  }

  function roundTargetOutput(value, overclock) {
    return normalizeTargetOutput(value, overclock);
  }

  function clampOverclockSlider(value) {
    return clampOverclock(Math.round(Number(value)));
  }

  function roundMachineCount(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_MACHINE_COUNT;
    return Math.max(1, Math.round(n));
  }

  function clampOverclock(value) {
    const n = roundProduction(value);
    if (!Number.isFinite(n)) return DEFAULT_OVERCLOCK;
    return Math.min(OVERCLOCK_MAX, Math.max(OVERCLOCK_MIN, n));
  }

  function clampMachineCount(value) {
    return roundMachineCount(value);
  }

  function getSomersloopSlots(schema) {
    return Math.max(0, Math.min(4, Number(schema?.somersloop_slots) || 0));
  }

  function normalizeSomersloopMask(mask, slots) {
    if (!slots) return 0;
    return Number(mask) & ((1 << slots) - 1);
  }

  function countSomersloopChecked(mask, slots) {
    if (!slots) return 0;
    const validMask = normalizeSomersloopMask(mask, slots);
    let count = 0;
    for (let i = 0; i < slots; i++) {
      if (validMask & (1 << i)) count++;
    }
    return count;
  }

  function computeSomersloopMultiplier(slots, mask) {
    if (!slots) return 1;
    const checked = countSomersloopChecked(mask, slots);
    return 1 + checked / slots;
  }

  function computeMinTargetOutput(basePerMin, machineCount, somersloopMask = 0, schema = null) {
    const base = Number(basePerMin);
    const machines = clampMachineCount(machineCount);
    const slots = schema ? getSomersloopSlots(schema) : 0;
    const mult = computeSomersloopMultiplier(slots, somersloopMask);
    if (!base || !machines || !mult) return 1;
    const atMin = base * machines * (OVERCLOCK_MIN / 100) * mult;
    return atMin < 1 ? roundProduction(atMin) : Math.max(1, Math.round(atMin));
  }

  function computeMaxTargetOutput(basePerMin, machineCount, somersloopMask = 0, schema = null) {
    const base = Number(basePerMin);
    const machines = clampMachineCount(machineCount);
    const slots = schema ? getSomersloopSlots(schema) : 0;
    const mult = computeSomersloopMultiplier(slots, somersloopMask);
    if (!base || !machines || !mult) return 1;
    return roundConfigOutput(base * machines * (OVERCLOCK_MAX / 100) * mult);
  }

  function computeOverclock(
    targetOutput,
    basePerMin,
    machineCount,
    somersloopMask = 0,
    schema = null
  ) {
    const base = Number(basePerMin);
    const target = Number(targetOutput);
    const machines = clampMachineCount(machineCount);
    const slots = schema ? getSomersloopSlots(schema) : 0;
    const mult = computeSomersloopMultiplier(slots, somersloopMask);
    if (!base || !target || !machines || !mult) return DEFAULT_OVERCLOCK;
    return clampOverclock((target / (base * machines * mult)) * 100);
  }

  function computeTargetOutput(
    basePerMin,
    machineCount,
    overclock,
    somersloopMask = 0,
    schema = null
  ) {
    const base = Number(basePerMin);
    const machines = clampMachineCount(machineCount);
    const oc = clampOverclock(overclock);
    const slots = schema ? getSomersloopSlots(schema) : 0;
    const mult = computeSomersloopMultiplier(slots, somersloopMask);
    if (!base) return 0;
    return roundTargetOutput(base * machines * (oc / 100) * mult, oc);
  }

  function computeOutputPerMachine(targetOutput, machineCount, overclock = null) {
    const machines = clampMachineCount(machineCount);
    const target =
      overclock != null
        ? roundTargetOutput(targetOutput, overclock)
        : roundConfigOutput(targetOutput);
    if (!machines) return 0;
    return roundProduction(target / machines);
  }

  function clampTargetToMax(targetOutput, basePerMin, machineCount, somersloopMask, schema) {
    const max = computeMaxTargetOutput(basePerMin, machineCount, somersloopMask, schema);
    return Math.min(Number(targetOutput), max);
  }

  function clampTargetToRange(targetOutput, basePerMin, machineCount, somersloopMask, schema) {
    const min = computeMinTargetOutput(basePerMin, machineCount, somersloopMask, schema);
    const max = computeMaxTargetOutput(basePerMin, machineCount, somersloopMask, schema);
    return Math.min(max, Math.max(min, Number(targetOutput)));
  }

  function resolveStepProduction(schema, item, stored = {}) {
    const basePerMin = getBaseOutputPerMin(schema, item) || getDefaultTargetOutput(schema, item);
    const slots = getSomersloopSlots(schema);
    const somersloopMask = normalizeSomersloopMask(stored.somersloop_mask ?? 0, slots);
    const machineCount =
      stored.machine_count != null && stored.machine_count !== ''
        ? clampMachineCount(stored.machine_count)
        : DEFAULT_MACHINE_COUNT;
    let overclock =
      stored.overclock != null && stored.overclock !== ''
        ? clampOverclock(stored.overclock)
        : DEFAULT_OVERCLOCK;
    let targetOutput =
      stored.target_output != null && stored.target_output !== ''
        ? Number(stored.target_output)
        : computeTargetOutput(
            basePerMin,
            machineCount,
            overclock,
            somersloopMask,
            schema
          );

    if (!Number.isFinite(targetOutput) || targetOutput <= 0) {
      targetOutput = computeTargetOutput(
        basePerMin,
        machineCount,
        overclock,
        somersloopMask,
        schema
      );
    }

    targetOutput = clampTargetToRange(
      targetOutput,
      basePerMin,
      machineCount,
      somersloopMask,
      schema
    );
    targetOutput = normalizeTargetOutput(targetOutput, overclock);
    overclock = computeOverclock(
      targetOutput,
      basePerMin,
      machineCount,
      somersloopMask,
      schema
    );

    return {
      base_per_min: roundProduction(basePerMin),
      target_output: targetOutput,
      machine_count: machineCount,
      overclock,
      somersloop_mask: somersloopMask,
      output_per_machine: computeOutputPerMachine(targetOutput, machineCount, overclock),
      min_target_output: computeMinTargetOutput(
        basePerMin,
        machineCount,
        somersloopMask,
        schema
      ),
      max_target_output: computeMaxTargetOutput(
        basePerMin,
        machineCount,
        somersloopMask,
        schema
      ),
    };
  }

  function applyStepChange(schema, item, current, changedField, rawValue) {
    const basePerMin = getBaseOutputPerMin(schema, item) || getDefaultTargetOutput(schema, item);
    const slots = getSomersloopSlots(schema);
    let { target_output, machine_count, overclock, somersloop_mask } = { ...current };
    somersloop_mask = normalizeSomersloopMask(somersloop_mask ?? 0, slots);
    machine_count = clampMachineCount(machine_count);
    overclock = clampOverclock(overclock);
    target_output = roundTargetOutput(target_output, overclock);

    if (changedField === 'output') {
      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed) || parsed <= 0) return null;
      target_output = clampTargetToRange(
        parsed,
        basePerMin,
        machine_count,
        somersloop_mask,
        schema
      );
      target_output = normalizeTargetOutput(target_output, overclock);
      overclock = computeOverclock(
        target_output,
        basePerMin,
        machine_count,
        somersloop_mask,
        schema
      );
    } else if (changedField === 'machines') {
      machine_count = clampMachineCount(rawValue);
      target_output = computeTargetOutput(
        basePerMin,
        machine_count,
        overclock,
        somersloop_mask,
        schema
      );
      target_output = clampTargetToRange(
        target_output,
        basePerMin,
        machine_count,
        somersloop_mask,
        schema
      );
      target_output = normalizeTargetOutput(target_output, overclock);
    } else if (changedField === 'overclock' || changedField === 'overclock-slider') {
      overclock =
        changedField === 'overclock-slider'
          ? clampOverclockSlider(rawValue)
          : clampOverclock(rawValue);
      target_output = computeTargetOutput(
        basePerMin,
        machine_count,
        overclock,
        somersloop_mask,
        schema
      );
      target_output = clampTargetToRange(
        target_output,
        basePerMin,
        machine_count,
        somersloop_mask,
        schema
      );
      target_output = normalizeTargetOutput(target_output, overclock);
      if (
        target_output <
        computeTargetOutput(basePerMin, machine_count, overclock, somersloop_mask, schema)
      ) {
        overclock = computeOverclock(
          target_output,
          basePerMin,
          machine_count,
          somersloop_mask,
          schema
        );
      }
    } else if (changedField === 'somersloop') {
      somersloop_mask = normalizeSomersloopMask(rawValue, slots);
      target_output = computeTargetOutput(
        basePerMin,
        machine_count,
        overclock,
        somersloop_mask,
        schema
      );
      target_output = clampTargetToRange(
        target_output,
        basePerMin,
        machine_count,
        somersloop_mask,
        schema
      );
      target_output = normalizeTargetOutput(target_output, overclock);
      overclock = computeOverclock(
        target_output,
        basePerMin,
        machine_count,
        somersloop_mask,
        schema
      );
    } else {
      return null;
    }

    const minOutput = computeMinTargetOutput(basePerMin, machine_count, somersloop_mask, schema);

    return {
      base_per_min: roundProduction(basePerMin),
      target_output,
      machine_count,
      overclock,
      somersloop_mask,
      output_per_machine: computeOutputPerMachine(target_output, machine_count, overclock),
      min_target_output: minOutput,
      max_target_output: computeMaxTargetOutput(
        basePerMin,
        machine_count,
        somersloop_mask,
        schema
      ),
    };
  }

  function computeScaleFactor(schema, item, targetOutputPerMin) {
    const basePerMin = getBaseOutputPerMin(schema, item);
    if (!basePerMin) return 1;
    return Number(targetOutputPerMin) / basePerMin;
  }

  function scaleSchema(schema, item, targetOutputPerMin, somersloopMask = 0, overclock = DEFAULT_OVERCLOCK) {
    const basePerMin = getBaseOutputPerMin(schema, item);
    const target = roundTargetOutput(targetOutputPerMin, overclock);

    if (!basePerMin) {
      return {
        scale: 1,
        input_scale: 1,
        target_output: target,
        inputs: schema?.inputs ?? [],
        outputs: schema?.outputs ?? [],
      };
    }

    const outputScale = target / basePerMin;
    const somersloopMult = computeSomersloopMultiplier(getSomersloopSlots(schema), somersloopMask);
    const inputScale = somersloopMult > 0 ? outputScale / somersloopMult : outputScale;

    return {
      scale: roundProduction(outputScale),
      input_scale: roundProduction(inputScale),
      target_output: target,
      inputs: (schema?.inputs ?? []).map((io) => ({
        ...io,
        amount: roundProduction(io.amount * inputScale),
      })),
      outputs: (schema?.outputs ?? []).map((io) => ({
        ...io,
        amount: roundProduction(io.amount * outputScale),
      })),
    };
  }

  window.ProductionScale = {
    getPrimaryOutput,
    outputPerMinute,
    getBaseOutputPerMin,
    getDefaultTargetOutput,
    roundProduction,
    roundConfigOutput,
    isIntegerOverclock,
    normalizeTargetOutput,
    roundTargetOutput,
    computeMinTargetOutput,
    clampTargetToRange,
    clampOverclockSlider,
    roundMachineCount,
    clampOverclock,
    clampMachineCount,
    getSomersloopSlots,
    normalizeSomersloopMask,
    countSomersloopChecked,
    computeSomersloopMultiplier,
    computeMaxTargetOutput,
    computeOverclock,
    computeTargetOutput,
    computeOutputPerMachine,
    resolveStepProduction,
    applyStepChange,
    computeScaleFactor,
    scaleSchema,
    OVERCLOCK_MIN,
    OVERCLOCK_MAX,
    DEFAULT_OVERCLOCK,
    DEFAULT_MACHINE_COUNT,
    PRODUCTION_DECIMALS,
    MACHINE_SLIDER_MAX,
  };
})();
