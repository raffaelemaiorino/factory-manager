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

function getSchemaIo(schema, kind, itemSlug) {
  const list = kind === 'input' ? schema?.inputs : schema?.outputs;
  if (!list?.length || !itemSlug) return null;
  return list.find((io) => io.item_slug === itemSlug) || null;
}

function getBaseIoPerMin(schema, kind, itemSlug) {
  const io = getSchemaIo(schema, kind, itemSlug);
  if (!io) return 0;
  return outputPerMinute(io.amount, schema.duration);
}

/**
 * Converte un rate /min di un input o output (anche secondario) nel target_output primario.
 * Gli input tengono conto del moltiplicatore Somersloop (input_scale = output_scale / mult).
 */
function computeTargetOutputFromIoRate(
  schema,
  item,
  kind,
  itemSlug,
  ratePerMin,
  somersloopMask = 0
) {
  const rate = Number(ratePerMin);
  if (!Number.isFinite(rate) || rate <= 0) return null;

  const primary = getPrimaryOutput(schema, item);
  if (kind === 'output' && primary && itemSlug === primary.item_slug) {
    return rate;
  }

  const baseIo = getBaseIoPerMin(schema, kind, itemSlug);
  const basePrimary = getBaseOutputPerMin(schema, item);
  if (!(baseIo > 0) || !(basePrimary > 0)) return null;

  if (kind === 'input') {
    const slots = getSomersloopSlots(schema);
    const mult = computeSomersloopMultiplier(slots, somersloopMask);
    if (!(mult > 0)) return null;
    return rate * (basePrimary / baseIo) * mult;
  }

  if (kind === 'output') {
    return rate * (basePrimary / baseIo);
  }

  return null;
}

function getDefaultTargetOutput(schema, item) {
  const base = getBaseOutputPerMin(schema, item);
  return base || 60;
}

const OVERCLOCK_MIN = 1;
const OVERCLOCK_MAX = 250;
const DEFAULT_OVERCLOCK = 100;
const DEFAULT_MACHINE_COUNT = 1;
const PRODUCTION_DECIMALS = 3;
const PRODUCTION_FP_EPSILON = 1e-9;
const MACHINE_SLIDER_MAX = 100;

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

/**
 * Rate /min da scala ricetta: preferisce interi esatti (es. 200) ed evita
 * che amount*scale periodici (13.333…) finiscano in 13.334 → 200.01/min.
 * Soglia 0.005: cattura residui tipo 800.002 / 200.001 da OC arrotondato.
 */
function normalizeIoRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const nearestInt = Math.round(n);
  if (Math.abs(n - nearestInt) <= 0.005) return nearestInt;
  const factor = 10 ** PRODUCTION_DECIMALS;
  const scaled = n * factor;
  const nearest = Math.round(scaled);
  if (Math.abs(scaled - nearest) < 1e-6) {
    return nearest / factor;
  }
  return roundProduction(n);
}

function amountFromPerMinute(perMin, duration) {
  const rate = Number(perMin);
  const cycleSeconds = Number(duration);
  if (!Number.isFinite(rate) || !(cycleSeconds > 0)) return 0;
  return (rate * cycleSeconds) / 60;
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
  return normalizeIoRate(n);
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

/** Arrotonda per eccesso a un numero pari (1 resta consentito). */
function roundUpPreferEven(machines) {
  const n = Math.max(1, Math.ceil(Number(machines) || 1));
  if (n <= 1) return 1;
  return n % 2 === 0 ? n : n + 1;
}

/**
 * Macchine minime (preferendo pari) per raggiungere targetOutput a ≤250% OC.
 */
function computeMachinesForTargetOutput(
  targetOutput,
  basePerMin,
  somersloopMask = 0,
  schema = null
) {
  const base = Number(basePerMin);
  const target = Number(targetOutput);
  const slots = schema ? getSomersloopSlots(schema) : 0;
  const mult = computeSomersloopMultiplier(slots, somersloopMask);
  if (!base || !target || !mult) return DEFAULT_MACHINE_COUNT;
  const perMachineMax = base * (OVERCLOCK_MAX / 100) * mult;
  if (!(perMachineMax > 0)) return DEFAULT_MACHINE_COUNT;
  let machines = roundUpPreferEven(target / perMachineMax);
  // Sicurezza FP: se il max arrotondato resta sotto target, aggiungi 2 (pari).
  while (computeMaxTargetOutput(base, machines, somersloopMask, schema) < target) {
    machines += machines === 1 ? 1 : 2;
    if (machines > 10000) break;
  }
  return machines;
}

/** Macchine minime per raggiungere target a un overclock fisso. */
function computeMachinesForTargetAtOverclock(
  targetOutput,
  basePerMin,
  overclock = DEFAULT_OVERCLOCK,
  somersloopMask = 0,
  schema = null
) {
  const base = Number(basePerMin);
  const target = Number(targetOutput);
  const oc = clampOverclock(overclock);
  const slots = schema ? getSomersloopSlots(schema) : 0;
  const mult = computeSomersloopMultiplier(slots, somersloopMask);
  if (!base || !target || !mult) return DEFAULT_MACHINE_COUNT;
  const perMachine = base * (oc / 100) * mult;
  if (!(perMachine > 0)) return DEFAULT_MACHINE_COUNT;
  let machines = roundUpPreferEven(target / perMachine);
  while (computeTargetOutput(base, machines, oc, somersloopMask, schema) + 1e-9 < target) {
    machines += machines === 1 ? 1 : 2;
    if (machines > 10000) break;
  }
  return machines;
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

/** Esponente ufficiale Satisfactory: log2(2.5) ≈ 1.321928 */
const POWER_CLOCK_EXPONENT = 1.321928;

/**
 * Consumo MW di macchine di produzione/estrazione (non generatori).
 * MW = base × (clock/100)^1.321928 × (moltiplicatore Somersloop)^2 × macchine
 */
function computeMachinePowerMw(
  baseMw,
  overclock,
  machineCount = 1,
  somersloopMult = 1
) {
  const base = Number(baseMw);
  if (!Number.isFinite(base) || base <= 0) return 0;
  const oc = clampOverclock(overclock) / 100;
  const machines = clampMachineCount(machineCount);
  const amp = Number(somersloopMult);
  const ampFactor = Number.isFinite(amp) && amp > 0 ? amp * amp : 1;
  return base * Math.pow(oc, POWER_CLOCK_EXPONENT) * ampFactor * machines;
}

function roundPowerMw(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 1000) / 1000;
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
    const maxAtCurrent = computeMaxTargetOutput(
      basePerMin,
      machine_count,
      somersloop_mask,
      schema
    );
    if (parsed > maxAtCurrent) {
      machine_count = computeMachinesForTargetOutput(
        parsed,
        basePerMin,
        somersloop_mask,
        schema
      );
    }
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
    const prevMult = computeSomersloopMultiplier(slots, somersloop_mask);
    somersloop_mask = normalizeSomersloopMask(rawValue, slots);
    const nextMult = computeSomersloopMultiplier(slots, somersloop_mask);
    if (prevMult > 0 && nextMult > 0) {
      // Scala l'output per rapporto moltiplicatori (evita drift da OC già arrotondato).
      target_output = normalizeIoRate(Number(target_output) * (nextMult / prevMult));
    } else {
      target_output = computeTargetOutput(
        basePerMin,
        machine_count,
        overclock,
        somersloop_mask,
        schema
      );
    }
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
    inputs: (schema?.inputs ?? []).map((io) => {
      const rate = normalizeIoRate(outputPerMinute(io.amount, schema.duration) * inputScale);
      return {
        ...io,
        amount: amountFromPerMinute(rate, schema.duration),
      };
    }),
    outputs: (schema?.outputs ?? []).map((io) => {
      const rate = normalizeIoRate(outputPerMinute(io.amount, schema.duration) * outputScale);
      return {
        ...io,
        amount: amountFromPerMinute(rate, schema.duration),
      };
    }),
  };
}

module.exports = {
  getPrimaryOutput,
  outputPerMinute,
  getBaseOutputPerMin,
  getSchemaIo,
  getBaseIoPerMin,
  computeTargetOutputFromIoRate,
  getDefaultTargetOutput,
  roundProduction,
  normalizeIoRate,
  amountFromPerMinute,
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
  roundUpPreferEven,
  computeMachinesForTargetOutput,
  computeMachinesForTargetAtOverclock,
  getSomersloopSlots,
  normalizeSomersloopMask,
  countSomersloopChecked,
  computeSomersloopMultiplier,
  computeMachinePowerMw,
  roundPowerMw,
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
  POWER_CLOCK_EXPONENT,
};
