/**
 * Validazione e clamp per import schemi JSON (produzione / energia).
 */

const {
  clampOverclock,
  DEFAULT_OVERCLOCK,
  DEFAULT_MACHINE_COUNT,
} = require('./production-scale');

const MAX_SCHEMA_JSON_BYTES = 5 * 1024 * 1024;
const MAX_IMPORT_ARRAY_ITEMS = 2000;
const MAX_NAME_LEN = 200;
const MAX_NOTES_LEN = 4000;
const MAX_SLUG_LEN = 120;
const MAX_REF_LEN = 64;
const MAX_GROUP_NAME_LEN = 120;
const MAX_IMPORT_MACHINES = 10_000;
const MAX_IMPORT_NODES = 500;
const MAX_IMPORT_SORT = 1_000_000;

const PRODUCTION_SCHEMA_FORMATS = new Set([
  'factory-manager-production-schema',
  'satisfactory-manager-production-schema',
]);

const ENERGY_SCHEMA_FORMATS = new Set([
  'factory-manager-energy-schema',
  'satisfactory-manager-energy-schema',
]);

/** @returns {'production' | 'energy' | null} */
function detectSchemaFormatKind(payload) {
  const format = payload?.format;
  if (PRODUCTION_SCHEMA_FORMATS.has(format)) return 'production';
  if (ENERGY_SCHEMA_FORMATS.has(format)) return 'energy';
  return null;
}

const ALLOWED_MINER_SLUGS = new Set([
  'miner-mk1',
  'miner-mk2',
  'miner-mk3',
  'oil-pump',
  'water-pump',
]);

const ALLOWED_PURITIES = new Set(['impure', 'normal', 'pure']);

function assertSchemaFileSize(byteLength) {
  const size = Number(byteLength);
  if (!Number.isFinite(size) || size < 0) {
    throw new Error('File schema non valido');
  }
  if (size > MAX_SCHEMA_JSON_BYTES) {
    throw new Error(
      `File troppo grande (max ${Math.round(MAX_SCHEMA_JSON_BYTES / (1024 * 1024))} MB)`
    );
  }
}

function assertImportArrayBudget(...arrays) {
  let total = 0;
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    total += arr.length;
  }
  if (total > MAX_IMPORT_ARRAY_ITEMS) {
    throw new Error(
      `Schema troppo grande (max ${MAX_IMPORT_ARRAY_ITEMS} elementi tra estrazioni, schemi, generatori e collegamenti)`
    );
  }
}

function sanitizeImportString(value, maxLen) {
  if (value == null) return '';
  const text = String(value).trim();
  if (!text) return '';
  return text.slice(0, maxLen);
}

function clampImportNumber(value, { min, max, fallback, allowNull = false } = {}) {
  if (value == null || value === '') {
    return allowNull ? null : fallback;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return allowNull ? null : fallback;
  let out = n;
  if (min != null) out = Math.max(min, out);
  if (max != null) out = Math.min(max, out);
  return out;
}

function clampImportInt(value, opts) {
  const n = clampImportNumber(value, opts);
  if (n == null) return null;
  return Math.round(n);
}

function sanitizeExtractionForImport(raw, index) {
  let minerSlug =
    sanitizeImportString(raw?.miner_slug ?? 'miner-mk1', MAX_SLUG_LEN) || 'miner-mk1';
  if (!ALLOWED_MINER_SLUGS.has(minerSlug)) minerSlug = 'miner-mk1';

  let purity = sanitizeImportString(raw?.purity ?? 'normal', 32) || 'normal';
  if (!ALLOWED_PURITIES.has(purity)) purity = 'normal';

  return {
    ref: sanitizeImportString(raw?.ref ?? `e${index + 1}`, MAX_REF_LEN) || `e${index + 1}`,
    item_slug: sanitizeImportString(raw?.item_slug, MAX_SLUG_LEN),
    miner_slug: minerSlug,
    purity,
    overclock: clampOverclock(raw?.overclock ?? DEFAULT_OVERCLOCK),
    node_count: clampImportInt(raw?.node_count ?? 1, {
      min: 1,
      max: MAX_IMPORT_NODES,
      fallback: 1,
    }),
    target_output: clampImportNumber(raw?.target_output, {
      min: 0,
      max: 1e9,
      fallback: null,
      allowNull: true,
    }),
    sort_order: clampImportInt(raw?.sort_order ?? index, {
      min: 0,
      max: MAX_IMPORT_SORT,
      fallback: index,
    }),
  };
}

function sanitizeStepForImport(raw, index) {
  return {
    ref: sanitizeImportString(raw?.ref ?? `s${index + 1}`, MAX_REF_LEN) || `s${index + 1}`,
    name: sanitizeImportString(raw?.name, MAX_NAME_LEN),
    item_slug: sanitizeImportString(raw?.item_slug, MAX_SLUG_LEN),
    schema_name: sanitizeImportString(raw?.schema_name, MAX_NAME_LEN),
    schema_is_alternative: Boolean(raw?.schema_is_alternative),
    schema_building_slug: sanitizeImportString(raw?.schema_building_slug, MAX_SLUG_LEN),
    group_name: sanitizeImportString(raw?.group_name, MAX_GROUP_NAME_LEN) || null,
    sort_order: clampImportInt(raw?.sort_order ?? index, {
      min: 0,
      max: MAX_IMPORT_SORT,
      fallback: index,
    }),
    target_output: clampImportNumber(raw?.target_output, {
      min: 0,
      max: 1e9,
      fallback: null,
      allowNull: true,
    }),
    machine_count: clampImportInt(raw?.machine_count ?? DEFAULT_MACHINE_COUNT, {
      min: 1,
      max: MAX_IMPORT_MACHINES,
      fallback: DEFAULT_MACHINE_COUNT,
    }),
    overclock: clampOverclock(raw?.overclock ?? DEFAULT_OVERCLOCK),
    somersloop_mask: clampImportInt(raw?.somersloop_mask ?? 0, {
      min: 0,
      max: 0b1111,
      fallback: 0,
    }),
    oc_machines_linked: raw?.oc_machines_linked ? 1 : 0,
    marked: raw?.marked ? 1 : 0,
  };
}

function sanitizeLinkForImport(raw) {
  return {
    consumer_ref: sanitizeImportString(raw?.consumer_ref, MAX_REF_LEN),
    consumer_step_ref: sanitizeImportString(raw?.consumer_step_ref, MAX_REF_LEN),
    consumer_generator_ref: sanitizeImportString(raw?.consumer_generator_ref, MAX_REF_LEN),
    producer_step_ref: sanitizeImportString(raw?.producer_step_ref, MAX_REF_LEN),
    producer_extraction_ref: sanitizeImportString(raw?.producer_extraction_ref, MAX_REF_LEN),
    item_slug: sanitizeImportString(raw?.item_slug, MAX_SLUG_LEN),
  };
}

function sanitizeGeneratorForImport(raw, index, isSupportedBuildingSlug) {
  const buildingSlug = sanitizeImportString(raw?.building_slug, MAX_SLUG_LEN);
  if (!buildingSlug || !isSupportedBuildingSlug(buildingSlug)) {
    throw new Error(`Generatore non supportato: ${buildingSlug || '(vuoto)'}`);
  }

  return {
    ref: sanitizeImportString(raw?.ref ?? `g${index + 1}`, MAX_REF_LEN) || `g${index + 1}`,
    building_slug: buildingSlug,
    fuel_slug: sanitizeImportString(raw?.fuel_slug, MAX_SLUG_LEN) || 'coal',
    machine_count: clampImportInt(raw?.machine_count ?? DEFAULT_MACHINE_COUNT, {
      min: 1,
      max: MAX_IMPORT_MACHINES,
      fallback: DEFAULT_MACHINE_COUNT,
    }),
    overclock: clampOverclock(raw?.overclock ?? DEFAULT_OVERCLOCK),
    target_fuel_input: clampImportNumber(raw?.target_fuel_input, {
      min: 0,
      max: 1e9,
      fallback: null,
      allowNull: true,
    }),
    target_power: clampImportNumber(raw?.target_power, {
      min: 0,
      max: 1e9,
      fallback: null,
      allowNull: true,
    }),
    sort_order: clampImportInt(raw?.sort_order ?? index, {
      min: 0,
      max: MAX_IMPORT_SORT,
      fallback: index,
    }),
  };
}

function sanitizeGroupMarks(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = Object.create(null);
  for (const [key, marked] of Object.entries(raw)) {
    const name = sanitizeImportString(key, MAX_GROUP_NAME_LEN);
    if (!name || name === '__proto__' || name === 'constructor' || name === 'prototype') {
      continue;
    }
    out[name] = Number(marked) === 1 ? 1 : 0;
  }
  return out;
}

function prepareProductionImportSchema(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('File schema non valido');
  }

  const schema = payload.schema;
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error('Contenuto schema mancante');
  }

  const name = sanitizeImportString(schema.name, MAX_NAME_LEN);
  if (!name) {
    throw new Error('Il nome dello schema è obbligatorio');
  }

  const extractions = Array.isArray(schema.extractions) ? schema.extractions : [];
  const steps = Array.isArray(schema.steps) ? schema.steps : [];
  const links = Array.isArray(schema.links) ? schema.links : [];
  assertImportArrayBudget(extractions, steps, links);

  return {
    name,
    notes: sanitizeImportString(schema.notes, MAX_NOTES_LEN) || null,
    target_item_slug: sanitizeImportString(schema.target_item_slug, MAX_SLUG_LEN) || null,
    target_rate: clampImportNumber(schema.target_rate, {
      min: 0,
      max: 1e9,
      fallback: null,
      allowNull: true,
    }),
    extractions: extractions.map((row, index) => sanitizeExtractionForImport(row, index)),
    steps: steps.map((row, index) => sanitizeStepForImport(row, index)),
    links: links.map((row) => sanitizeLinkForImport(row)),
    group_marks: sanitizeGroupMarks(schema.group_marks),
  };
}

function prepareEnergyImportSchema(payload, isSupportedBuildingSlug) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('File schema non valido');
  }

  const schema = payload.schema;
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error('Contenuto schema mancante');
  }

  const name = sanitizeImportString(schema.name, MAX_NAME_LEN);
  if (!name) {
    throw new Error('Il nome dello schema è obbligatorio');
  }

  const extractions = Array.isArray(schema.extractions) ? schema.extractions : [];
  const generators = Array.isArray(schema.generators) ? schema.generators : [];
  const links = Array.isArray(schema.links) ? schema.links : [];
  assertImportArrayBudget(extractions, generators, links);

  return {
    name,
    notes: sanitizeImportString(schema.notes, MAX_NOTES_LEN) || null,
    extractions: extractions.map((row, index) => sanitizeExtractionForImport(row, index)),
    generators: generators.map((row, index) =>
      sanitizeGeneratorForImport(row, index, isSupportedBuildingSlug)
    ),
    links: links.map((row) => sanitizeLinkForImport(row)),
  };
}

module.exports = {
  MAX_SCHEMA_JSON_BYTES,
  MAX_IMPORT_ARRAY_ITEMS,
  PRODUCTION_SCHEMA_FORMATS,
  ENERGY_SCHEMA_FORMATS,
  detectSchemaFormatKind,
  assertSchemaFileSize,
  assertImportArrayBudget,
  sanitizeImportString,
  prepareProductionImportSchema,
  prepareEnergyImportSchema,
};
