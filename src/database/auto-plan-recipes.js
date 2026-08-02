const { getItemSchemas } = require('./schemas');

function isPackagerSchema(schema) {
  return String(schema?.building_slug || '').toLowerCase() === 'packager';
}

/**
 * Choose a recipe for auto-plan / sink side-chains:
 * - Prefer the item as primary (first) output, not a byproduct
 * - Avoid Packager pack/unpack (demand loops)
 * - Avoid recipes that consume the same item (e.g. fracking nitrogen → nitrogen)
 * - Prefer non-alternative when scores tie
 */
function pickDefaultSchema(db, itemId, item = null) {
  const schemas = getItemSchemas(db, itemId);
  if (!schemas.length) return null;
  const slug = String(item?.slug || '').trim();

  const scoreSchema = (schema) => {
    let score = 0;
    if (isPackagerSchema(schema)) score -= 1000;
    if (schema.is_alternative) score -= 40;

    const outputs = schema.outputs || [];
    const inputs = schema.inputs || [];
    const building = String(schema.building_slug || '').toLowerCase();

    if (slug) {
      if (inputs.some((io) => io.item_slug === slug)) score -= 800;
      const firstOut = outputs[0]?.item_slug;
      if (firstOut === slug) score += 120;
      else if (outputs.some((io) => io.item_slug === slug)) score += 10; // byproduct-only
      else score -= 200;
      if (outputs.length === 1 && firstOut === slug) score += 40;
    } else if (!schema.is_alternative) {
      score += 50;
    }

    if (building === 'fracking-extractor') score -= 100;
    return score;
  };

  return [...schemas].sort((a, b) => {
    const diff = scoreSchema(b) - scoreSchema(a);
    if (diff !== 0) return diff;
    return Number(a.id) - Number(b.id);
  })[0];
}

module.exports = {
  isPackagerSchema,
  pickDefaultSchema,
};
