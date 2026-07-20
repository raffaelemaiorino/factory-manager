/**
 * Parser pagine dettaglio SCIM
 * https://satisfactory-calculator.com/it/items/detail/id/{gameId}/name/...
 */

const { buildingIdToSlug } = require('../src/database/seeds/building-slugs');

function decodeHtml(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\'/g, "'");
}

function stripTags(html) {
  return decodeHtml(html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim())
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAmount(text) {
  return parseFloat(text.replace(',', '.'));
}

function parseDescription(html) {
  const match = html.match(
    /<blockquote class="blockquote[^"]*">[\s\S]*?<em>([\s\S]*?)<\/em>[\s\S]*?<\/blockquote>/
  );
  if (!match) return '';
  return stripTags(match[1]);
}

function parseStackSize(html) {
  const match = html.match(
    /Dimensione dello stack[\s\S]*?<strong>(\d+)<\/strong>/
  );
  return match ? parseInt(match[1], 10) : null;
}

function getRecipeArea(html) {
  const endMarkers = [
    '<strong>Usato per sbloccare</strong>',
    '<strong>Usato per costruire</strong>',
    'An AnthorNet platform',
  ];

  let end = html.length;
  for (const marker of endMarkers) {
    const idx = html.indexOf(marker);
    if (idx > 0 && idx < end) end = idx;
  }

  const schemiIdx = html.indexOf('<strong>Schemi</strong>');
  const altIdx = html.indexOf('<strong>Alternare ricette</strong>');
  const starts = [schemiIdx, altIdx].filter((i) => i >= 0);
  if (!starts.length) return '';

  const start = Math.min(...starts);
  const areaStart = html.lastIndexOf('<div class="row">', start);
  return html.slice(areaStart >= 0 ? areaStart : start, end);
}

function parseIoColumn(columnHtml) {
  const items = [];
  const regex =
    /<div><span class="ml-3 float-right"><em><small>\((\d+(?:,\d+)?)(m³)?\s*\/\s*min\)<\/small><\/em><\/span>(\d+(?:,\d+)?)(m³)?x?<img[^>]+>\s*<a href="\/it\/items\/detail\/id\/([^"]+)\/name\/[^"]*">/gi;

  let match;
  while ((match = regex.exec(columnHtml)) !== null) {
    items.push({
      ratePerMin: parseAmount(match[1]),
      amount: parseAmount(match[3]),
      game_id: match[5],
      is_fluid: match[2] === 'm³' || match[4] === 'm³' ? 1 : 0,
    });
  }

  return items;
}

function computeDuration(outputs, targetGameId) {
  const primary =
    outputs.find((o) => o.game_id === targetGameId) ?? outputs[0];
  if (!primary?.ratePerMin || !primary.amount) return 4;
  const duration = (60 * primary.amount) / primary.ratePerMin;
  return Math.round(duration * 100) / 100;
}

function mapIoEntries(entries, gameIdToSlug, isOutput) {
  return entries.map((entry, index) => ({
    slot: index + 1,
    item_slug: gameIdToSlug.get(entry.game_id) ?? entry.game_id,
    amount: entry.amount,
    is_fluid: entry.is_fluid,
    _game_id: entry.game_id,
    _isOutput: isOutput,
  }));
}

function parseIoRow(blockHtml) {
  const marker = '<div class="row align-items-center">';
  let searchFrom = 0;

  while (true) {
    const start = blockHtml.indexOf(marker, searchFrom);
    if (start < 0) break;

    const nextRow = blockHtml.indexOf(marker, start + marker.length);
    const end = nextRow > 0 ? nextRow : blockHtml.length;
    const rowHtml = blockHtml.slice(start, end);

    if (!rowHtml.includes('/it/items/detail/id/')) {
      searchFrom = start + marker.length;
      continue;
    }

    const colParts = rowHtml.split('<div class="col-6');
    if (colParts.length >= 3) {
      const inputs = parseIoColumn(colParts[1]);
      const outputs = parseIoColumn(colParts[2]);
      if (inputs.length && outputs.length) {
        return { inputs, outputs };
      }
    }

    searchFrom = start + marker.length;
  }

  return null;
}

function extractRecipeCardHtml(html, cardTitle) {
  const marker = `<strong>${cardTitle}</strong>`;
  const idx = html.indexOf(marker);
  if (idx < 0) return '';

  const cardStart = html.lastIndexOf('<div class="card h-100">', idx);
  if (cardStart < 0) return '';

  const afterCard = html.slice(cardStart);
  const endMarkers = [
    afterCard.indexOf('<div class="col-lg-6 mb-3">', 20),
    afterCard.indexOf('<strong>Usato per'),
  ].filter((i) => i > 0);

  const end = endMarkers.length ? Math.min(...endMarkers) : afterCard.length;
  return afterCard.slice(0, end);
}

function parseSchemaBlocks(cardHtml, targetGameId, gameIdToSlug, isAlternative) {
  if (!cardHtml) return [];

  const blocks = cardHtml.split('<div class="card-body border-top">').slice(1);
  const schemas = [];

  blocks.forEach((block) => {
    const schema = parseRecipeBlock(block, targetGameId, gameIdToSlug, schemas.length, isAlternative);
    if (schema) schemas.push(schema);
  });

  return schemas;
}

function parseRecipeBlock(blockHtml, targetGameId, gameIdToSlug, sortOrder, isAlternativeSection) {
  const nameMatch = blockHtml.match(
    /<h5 class="card-title">\s*([\s\S]*?)\s*<\/h5>/
  );
  if (!nameMatch) return null;

  const name = stripTags(nameMatch[1]);
  const buildingMatch = blockHtml.match(
    /\/it\/buildings\/detail\/id\/([^"]+)\/name\/([^"]*)"/
  );

  const ioRow = parseIoRow(blockHtml);
  if (!ioRow) return null;

  const { inputs: inputEntries, outputs: outputEntries } = ioRow;

  const inputs = mapIoEntries(inputEntries, gameIdToSlug, false).map(
    ({ slot, item_slug, amount, is_fluid }) => ({
      slot,
      item_slug,
      amount,
      is_fluid,
    })
  );
  const outputs = mapIoEntries(outputEntries, gameIdToSlug, true).map(
    ({ slot, item_slug, amount, is_fluid }) => ({
      slot,
      item_slug,
      amount,
      is_fluid,
    })
  );

  const buildingId = buildingMatch?.[1] ?? '';
  const buildingName = decodeHtml(buildingMatch?.[2] ?? '').replace(/\+/g, ' ');

  return {
    name,
    is_alternative: isAlternativeSection || /^Alternativo:/i.test(name) ? 1 : 0,
    building_name: buildingName,
    building_slug: buildingIdToSlug(buildingId),
    duration: computeDuration(outputEntries, targetGameId),
    sort_order: sortOrder,
    inputs,
    outputs,
  };
}

function parseSchemas(html, targetGameId, gameIdToSlug) {
  const mainCard = extractRecipeCardHtml(html, 'Schemi');
  const altCard = extractRecipeCardHtml(html, 'Alternare ricette');

  const schemas = [
    ...parseSchemaBlocks(mainCard, targetGameId, gameIdToSlug, false),
    ...parseSchemaBlocks(altCard, targetGameId, gameIdToSlug, true),
  ];

  schemas.forEach((schema, index) => {
    schema.sort_order = index;
  });

  return schemas;
}

function parseItemDetailPage(html, targetGameId, gameIdToSlug, options = {}) {
  const { includeSchemas = true } = options;

  return {
    game_id: targetGameId,
    description: parseDescription(html),
    stack_size: parseStackSize(html),
    schemas: includeSchemas ? parseSchemas(html, targetGameId, gameIdToSlug) : [],
  };
}

module.exports = {
  parseItemDetailPage,
  parseDescription,
  parseStackSize,
  parseSchemas,
  getRecipeArea,
  decodeHtml,
  buildingIdToSlug,
};
