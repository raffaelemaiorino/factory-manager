/**
 * Validazione e sanitizzazione import schema JSON (produzione / energia).
 */

const { statSync } = require('fs');

const MAX_SCHEMA_FILE_BYTES = 2 * 1024 * 1024;
const MAX_EXTRACTIONS = 500;
const MAX_STEPS = 500;
const MAX_GENERATORS = 500;
const MAX_LINKS = 2000;
const MAX_GROUP_MARKS = 200;

const MAX_NAME_LEN = 200;
const MAX_NOTES_LEN = 500;
const MAX_SLUG_LEN = 200;
const MAX_REF_LEN = 100;
const MAX_GROUP_NAME_LEN = 200;

const MIN_OVERCLOCK = 1;
const MAX_OVERCLOCK = 250;
const MAX_MACHINE_COUNT = 10_000;
const MAX_NODE_COUNT = 10_000;
const MAX_TARGET = 1e9;

const ALLOWED_MINER_SLUGS = new Set([
  'miner-mk1',
  'miner-mk2',
  'miner-mk3',
  'oil-pump',
  'water-pump',
]);
const ALLOWED_PURITY = new Set(['impure', 'normal', 'pure']);

const SUPPORTED_SCHEMA_VERSIONS = new Set([1]);

const PRODUCTION_SCHEMA_FORMATS = new Set([
  'factory-manager-production-schema',
  'satisfactory-manager-production-schema',
]);

const ENERGY_SCHEMA_FORMATS = new Set([
  'factory-manager-energy-schema',
  'satisfactory-manager-energy-schema',
]);

function detectSchemaImportKind(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (PRODUCTION_SCHEMA_FORMATS.has(payload.format)) return 'production';
  if (ENERGY_SCHEMA_FORMATS.has(payload.format)) return 'energy';
  return null;
}

function assertSupportedSchemaVersion(payload) {
  const version = Number(payload.version);
  if (!SUPPORTED_SCHEMA_VERSIONS.has(version)) {
    throw new Error(
      `Versione schema non supportata (${payload.version ?? 'assente'}). Questo software importa solo versioni: ${[...SUPPORTED_SCHEMA_VERSIONS].join(', ')}.`
    );
  }
}

function assertProductionImportIdentity(payload) {
  assertPlainObject(payload, 'File schema');
  const kind = detectSchemaImportKind(payload);
  if (kind === 'energy') {
    throw new Error(
      'Questo file è uno schema energia di Factory Manager. Importalo dalla sezione Energia, non da Produzione.'
    );
  }
  if (kind !== 'production') {
    throw new Error(
      'File non riconosciuto: non è un export Factory Manager di produzione (campo "format" assente o sconosciuto).'
    );
  }
  assertSupportedSchemaVersion(payload);
}

function assertEnergyImportIdentity(payload) {
  assertPlainObject(payload, 'File schema');
  const kind = detectSchemaImportKind(payload);
  if (kind === 'production') {
    throw new Error(
      'Questo file è uno schema di produzione di Factory Manager. Importalo dalla sezione Produzione, non da Energia.'
    );
  }
  if (kind !== 'energy') {
    throw new Error(
      'File non riconosciuto: non è un export Factory Manager di energia (campo "format" assente o sconosciuto).'
    );
  }
  assertSupportedSchemaVersion(payload);
}

function throwImportIssues(issues, maxShow = 8) {
  const list = (issues || []).filter(Boolean);
  if (!list.length) return;
  const shown = list.slice(0, maxShow);
  const more = list.length > maxShow ? `\n… e altri ${list.length - maxShow} problemi.` : '';
  throw new Error(
    `Import non possibile: il file non è importabile così com’è.\n- ${shown.join('\n- ')}${more}`
  );
}

function assertUniqueRefs(entries, label) {
  const seen = new Set();
  const issues = [];
  for (const entry of entries) {
    const ref = String(entry.ref ?? '');
    if (!ref) {
      issues.push(`${label}: riferimento (ref) vuoto`);
      continue;
    }
    if (seen.has(ref)) {
      issues.push(`${label}: riferimento duplicato «${ref}»`);
    }
    seen.add(ref);
  }
  return issues;
}

function assertSchemaFileSize(filePath) {
  let size;
  try {
    size = statSync(filePath).size;
  } catch {
    throw new Error('Impossibile leggere il file schema');
  }
  if (size > MAX_SCHEMA_FILE_BYTES) {
    throw new Error('File schema troppo grande (max 2 MB)');
  }
  return size;
}

function sanitizeImportString(value, maxLen) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLen);
}

function clampImportNumber(value, { min, max, fallback, allowNull = false } = {}) {
  if (value == null || value === '') {
    return allowNull ? null : fallback;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return allowNull ? null : fallback;
  }
  const lo = min ?? -Infinity;
  const hi = max ?? Infinity;
  return Math.min(hi, Math.max(lo, n));
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} non valido`);
  }
}

function assertArrayMax(arr, max, label) {
  if (!Array.isArray(arr)) {
    throw new Error(`${label} deve essere un elenco`);
  }
  if (arr.length > max) {
    throw new Error(`${label}: troppi elementi (max ${max})`);
  }
}

function sanitizeExtraction(raw, index) {
  assertPlainObject(raw, `Estrazione #${index + 1}`);
  let minerSlug =
    sanitizeImportString(raw.miner_slug ?? 'miner-mk1', MAX_SLUG_LEN) || 'miner-mk1';
  if (!ALLOWED_MINER_SLUGS.has(minerSlug)) minerSlug = 'miner-mk1';
  let purity = sanitizeImportString(raw.purity ?? 'normal', 32) || 'normal';
  if (!ALLOWED_PURITY.has(purity)) purity = 'normal';
  return {
    ...raw,
    ref: sanitizeImportString(raw.ref ?? `e${index + 1}`, MAX_REF_LEN) || `e${index + 1}`,
    item_slug: sanitizeImportString(raw.item_slug, MAX_SLUG_LEN),
    miner_slug: minerSlug,
    purity,
    overclock: clampImportNumber(raw.overclock, {
      min: MIN_OVERCLOCK,
      max: MAX_OVERCLOCK,
      fallback: 100,
    }),
    node_count: clampImportNumber(raw.node_count, {
      min: 1,
      max: MAX_NODE_COUNT,
      fallback: 1,
    }),
    target_output: clampImportNumber(raw.target_output, {
      min: 0,
      max: MAX_TARGET,
      fallback: null,
      allowNull: true,
    }),
    sort_order: clampImportNumber(raw.sort_order, {
      min: 0,
      max: MAX_STEPS,
      fallback: index,
    }),
  };
}

function sanitizeProductionStep(raw, index) {
  assertPlainObject(raw, `Schema risorsa #${index + 1}`);
  return {
    ...raw,
    ref: sanitizeImportString(raw.ref ?? `s${index + 1}`, MAX_REF_LEN) || `s${index + 1}`,
    name: sanitizeImportString(raw.name, MAX_NAME_LEN),
    item_slug: sanitizeImportString(raw.item_slug, MAX_SLUG_LEN),
    schema_name: sanitizeImportString(raw.schema_name, MAX_NAME_LEN),
    group_name: sanitizeImportString(raw.group_name, MAX_GROUP_NAME_LEN) || null,
    machine_count: clampImportNumber(raw.machine_count, {
      min: 1,
      max: MAX_MACHINE_COUNT,
      fallback: 1,
    }),
    overclock: clampImportNumber(raw.overclock, {
      min: MIN_OVERCLOCK,
      max: MAX_OVERCLOCK,
      fallback: 100,
    }),
    target_output: clampImportNumber(raw.target_output, {
      min: 0,
      max: MAX_TARGET,
      fallback: null,
      allowNull: true,
    }),
    somersloop_mask: clampImportNumber(raw.somersloop_mask, {
      min: 0,
      max: 0xffff,
      fallback: 0,
    }),
    oc_machines_linked: Boolean(raw.oc_machines_linked),
    marked: Boolean(raw.marked),
    sort_order: clampImportNumber(raw.sort_order, {
      min: 0,
      max: MAX_STEPS,
      fallback: index,
    }),
  };
}

function sanitizeLink(raw, index) {
  assertPlainObject(raw, `Collegamento #${index + 1}`);
  return {
    ...raw,
    consumer_ref: sanitizeImportString(raw.consumer_ref, MAX_REF_LEN),
    consumer_step_ref: sanitizeImportString(raw.consumer_step_ref, MAX_REF_LEN),
    consumer_generator_ref: sanitizeImportString(raw.consumer_generator_ref, MAX_REF_LEN),
    producer_step_ref: sanitizeImportString(raw.producer_step_ref, MAX_REF_LEN),
    producer_extraction_ref: sanitizeImportString(raw.producer_extraction_ref, MAX_REF_LEN),
    item_slug: sanitizeImportString(raw.item_slug, MAX_SLUG_LEN),
  };
}

function sanitizeGenerator(raw, index) {
  assertPlainObject(raw, `Generatore #${index + 1}`);
  return {
    ...raw,
    ref: sanitizeImportString(raw.ref ?? `g${index + 1}`, MAX_REF_LEN) || `g${index + 1}`,
    building_slug: sanitizeImportString(raw.building_slug, MAX_SLUG_LEN),
    fuel_slug: sanitizeImportString(raw.fuel_slug, MAX_SLUG_LEN),
    machine_count: clampImportNumber(raw.machine_count, {
      min: 1,
      max: MAX_MACHINE_COUNT,
      fallback: 1,
    }),
    overclock: clampImportNumber(raw.overclock, {
      min: MIN_OVERCLOCK,
      max: MAX_OVERCLOCK,
      fallback: 100,
    }),
    target_fuel_input: clampImportNumber(raw.target_fuel_input, {
      min: 0,
      max: MAX_TARGET,
      fallback: null,
      allowNull: true,
    }),
    target_power: clampImportNumber(raw.target_power, {
      min: 0,
      max: MAX_TARGET,
      fallback: null,
      allowNull: true,
    }),
    sort_order: clampImportNumber(raw.sort_order, {
      min: 0,
      max: MAX_GENERATORS,
      fallback: index,
    }),
  };
}

function sanitizeGroupMarks(raw) {
  if (raw == null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('group_marks non valido');
  }
  const entries = Object.entries(raw);
  if (entries.length > MAX_GROUP_MARKS) {
    throw new Error(`group_marks: troppi elementi (max ${MAX_GROUP_MARKS})`);
  }
  const out = Object.create(null);
  for (const [key, value] of entries) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    const name = sanitizeImportString(key, MAX_GROUP_NAME_LEN);
    if (!name) continue;
    out[name] = Number(value) === 1 ? 1 : 0;
  }
  return out;
}

function sanitizeProductionImportPayload(payload) {
  assertProductionImportIdentity(payload);
  assertPlainObject(payload.schema, 'Contenuto schema');

  const schema = payload.schema;
  const name = sanitizeImportString(schema.name, MAX_NAME_LEN);
  if (!name) {
    throw new Error('Il nome dello schema è obbligatorio');
  }

  const extractions = Array.isArray(schema.extractions) ? schema.extractions : [];
  const steps = Array.isArray(schema.steps) ? schema.steps : [];
  const links = Array.isArray(schema.links) ? schema.links : [];
  assertArrayMax(extractions, MAX_EXTRACTIONS, 'Estrazioni');
  assertArrayMax(steps, MAX_STEPS, 'Schemi risorsa');
  assertArrayMax(links, MAX_LINKS, 'Collegamenti');

  const sanitizedExtractions = extractions.map(sanitizeExtraction);
  const sanitizedSteps = steps.map(sanitizeProductionStep);
  const issues = [
    ...assertUniqueRefs(sanitizedExtractions, 'Estrazioni'),
    ...assertUniqueRefs(sanitizedSteps, 'Schemi risorsa'),
  ];
  throwImportIssues(issues);

  return {
    format: payload.format,
    version: Number(payload.version),
    schema: {
      name,
      notes: sanitizeImportString(schema.notes, MAX_NOTES_LEN) || null,
      target_item_slug: sanitizeImportString(schema.target_item_slug, MAX_SLUG_LEN) || null,
      target_rate: clampImportNumber(schema.target_rate, {
        min: 0,
        max: MAX_TARGET,
        fallback: null,
        allowNull: true,
      }),
      extractions: sanitizedExtractions,
      steps: sanitizedSteps,
      links: links.map(sanitizeLink),
      group_marks: sanitizeGroupMarks(schema.group_marks),
    },
  };
}

function sanitizeEnergyImportPayload(payload) {
  assertEnergyImportIdentity(payload);
  assertPlainObject(payload.schema, 'Contenuto schema');

  const schema = payload.schema;
  const name = sanitizeImportString(schema.name, MAX_NAME_LEN);
  if (!name) {
    throw new Error('Il nome dello schema è obbligatorio');
  }

  const extractions = Array.isArray(schema.extractions) ? schema.extractions : [];
  const generators = Array.isArray(schema.generators) ? schema.generators : [];
  const links = Array.isArray(schema.links) ? schema.links : [];
  assertArrayMax(extractions, MAX_EXTRACTIONS, 'Estrazioni');
  assertArrayMax(generators, MAX_GENERATORS, 'Generatori');
  assertArrayMax(links, MAX_LINKS, 'Collegamenti');

  const sanitizedExtractions = extractions.map(sanitizeExtraction);
  const sanitizedGenerators = generators.map(sanitizeGenerator);
  const issues = [
    ...assertUniqueRefs(sanitizedExtractions, 'Estrazioni'),
    ...assertUniqueRefs(sanitizedGenerators, 'Generatori'),
  ];
  throwImportIssues(issues);

  return {
    format: payload.format,
    version: Number(payload.version),
    schema: {
      name,
      notes: sanitizeImportString(schema.notes, MAX_NOTES_LEN) || null,
      extractions: sanitizedExtractions,
      generators: sanitizedGenerators,
      links: links.map(sanitizeLink),
    },
  };
}

module.exports = {
  MAX_SCHEMA_FILE_BYTES,
  MAX_UI_STATE_BYTES: 1024 * 1024,
  PRODUCTION_SCHEMA_FORMATS,
  ENERGY_SCHEMA_FORMATS,
  SUPPORTED_SCHEMA_VERSIONS,
  detectSchemaImportKind,
  assertSchemaFileSize,
  assertProductionImportIdentity,
  assertEnergyImportIdentity,
  sanitizeImportString,
  clampImportNumber,
  throwImportIssues,
  sanitizeProductionImportPayload,
  sanitizeEnergyImportPayload,
};
