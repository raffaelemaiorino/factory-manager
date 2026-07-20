/**
 * Parser pagine dettaglio SCIM
 * https://satisfactory-calculator.com/{locale}/items/detail/id/{gameId}/name/...
 */

const { buildingIdToSlug } = require('../src/database/seeds/building-slugs');

const LOCALE_LABELS = {
  it: {
    stackSize: 'Dimensione dello stack',
    recipes: 'Schemi',
    alternateRecipes: 'Alternare ricette',
    usedToUnlock: 'Usato per sbloccare',
    usedToBuild: 'Usato per costruire',
    usedToCraft: 'Usato per craftare',
    alternatePrefix: /^(Alternativo|Alternate)\s*:/i,
  },
  en: {
    stackSize: 'Stack size',
    recipes: 'Recipes',
    alternateRecipes: 'Alternate recipes',
    usedToUnlock: 'Used to unlock',
    usedToBuild: 'Used to build',
    usedToCraft: 'Used to craft',
    alternatePrefix: /^Alternate\s*:/i,
  },
  de: {
    stackSize: 'Stapelgröße',
    recipes: 'Rezepte',
    alternateRecipes: 'Alternative Rezepte',
    usedToUnlock: 'Benutzt zum Freischalten',
    usedToBuild: 'Benutzt zum Bauen',
    usedToCraft: 'Benutzt zur Herstellung',
    alternatePrefix: /^(Alternativ|Alternate)\s*:/i,
  },
  fr: {
    stackSize: 'Taille de la pile',
    recipes: 'Formules',
    alternateRecipes: 'Recettes alternatives',
    usedToUnlock: 'Utilisé pour débloquer',
    usedToBuild: 'Utilisé pour construire',
    usedToCraft: 'Utilisé pour la fabrication',
    alternatePrefix: /^(Alternative|Alternate|Alternatif)\s*:/i,
  },
  es: {
    stackSize: 'Tamaño de pila',
    recipes: 'Recetas',
    alternateRecipes: 'Recetas alternativas',
    usedToUnlock: 'Usado para desbloquear',
    usedToBuild: 'Usado para construir',
    usedToCraft: 'Usado para fabricar',
    alternatePrefix: /^(Alternativ[oa]|Alternate)\s*:/i,
  },
  pl: {
    stackSize: 'Rozmiar stosu',
    recipes: 'Receptury',
    alternateRecipes: 'Receptury alternatywne',
    usedToUnlock: 'Używane do odblokowania',
    usedToBuild: 'Używane do budowy',
    usedToCraft: 'Używane do wytwarzania',
    alternatePrefix: /^(Alternatywna|Alternate)\s*:/i,
  },
  nl: {
    stackSize: 'Stapelgrootte',
    recipes: 'Recepten',
    alternateRecipes: 'Alternatieve recepten',
    usedToUnlock: 'Gebruikt om te ontgrendelen',
    usedToBuild: 'Gebruikt om te bouwen',
    usedToCraft: 'Gebruikt om te maken',
    alternatePrefix: /^(Alternatief|Alternate)\s*:/i,
  },
  pt: {
    stackSize: 'Tamanho da pilha',
    recipes: 'Receitas',
    alternateRecipes: 'Receitas alternativas',
    usedToUnlock: 'Usado para desbloquear',
    usedToBuild: 'Usado para construir',
    usedToCraft: 'Usado para fabricar',
    alternatePrefix: /^(Alternativ[oa]|Alternate)\s*:/i,
  },
  ru: {
    stackSize: 'Размер стопки',
    recipes: 'Рецепты',
    alternateRecipes: 'Альтернативные рецепты',
    usedToUnlock: 'Используется для разблокировки',
    usedToBuild: 'Используется для строительства',
    usedToCraft: 'Используется для производства',
    alternatePrefix: /^(Альтернативн\w*|Alternate)\s*:/i,
  },
  ja: {
    stackSize: 'スタックサイズ',
    recipes: 'レシピ',
    alternateRecipes: '代替レシピ',
    usedToUnlock: '解除に使用',
    usedToBuild: '建設に使用',
    usedToCraft: '製作に使用',
    alternatePrefix: /^(代替|Alternate)\s*:/i,
  },
  ko: {
    stackSize: '스택 크기',
    recipes: '레시피',
    alternateRecipes: '대체 레시피',
    usedToUnlock: '잠금 해제에 사용',
    usedToBuild: '건설에 사용',
    usedToCraft: '제작에 사용',
    alternatePrefix: /^(대체|Alternate)\s*:/i,
  },
  zh: {
    stackSize: '堆叠数量',
    recipes: '配方',
    alternateRecipes: '替代配方',
    usedToUnlock: '用于解锁',
    usedToBuild: '用于建造',
    usedToCraft: '用于制作',
    alternatePrefix: /^(替代|Alternate)\s*:/i,
  },
};

const ALTERNATE_NAME_RE =
  /^(Alternativo|Alternate|Alternativ\w*|Alternative|Alternatif|Alternatywna|Альтернативн\w*|代替|대체|替代)\s*:/i;

function getLocaleLabels(locale = 'it') {
  const code = String(locale || 'it').toLowerCase();
  return LOCALE_LABELS[code] || LOCALE_LABELS.en;
}

function labelCandidates(locale = 'it') {
  const code = String(locale || 'it').toLowerCase();
  const ordered = [code, 'en', 'it'];
  const seen = new Set();
  const list = [];
  for (const key of ordered) {
    if (seen.has(key) || !LOCALE_LABELS[key]) continue;
    seen.add(key);
    list.push(LOCALE_LABELS[key]);
  }
  return list;
}

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

function parseStackSize(html, locale = 'it') {
  for (const labels of labelCandidates(locale)) {
    const label = labels.stackSize.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = html.match(new RegExp(`${label}[\\s\\S]*?<strong>(\\d+)<\\/strong>`));
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

function getRecipeArea(html, locale = 'it') {
  const endMarkers = ['An AnthorNet platform'];
  for (const labels of labelCandidates(locale)) {
    endMarkers.push(
      `<strong>${labels.usedToUnlock}</strong>`,
      `<strong>${labels.usedToBuild}</strong>`,
      `<strong>${labels.usedToCraft}</strong>`
    );
  }

  let end = html.length;
  for (const marker of endMarkers) {
    const idx = html.indexOf(marker);
    if (idx > 0 && idx < end) end = idx;
  }

  let start = -1;
  for (const labels of labelCandidates(locale)) {
    const schemiIdx = html.indexOf(`<strong>${labels.recipes}</strong>`);
    const altIdx = html.indexOf(`<strong>${labels.alternateRecipes}</strong>`);
    const starts = [schemiIdx, altIdx].filter((i) => i >= 0);
    if (starts.length) {
      start = Math.min(...starts);
      break;
    }
  }
  if (start < 0) return '';

  const areaStart = html.lastIndexOf('<div class="row">', start);
  return html.slice(areaStart >= 0 ? areaStart : start, end);
}

function parseIoColumn(columnHtml, locale = 'it') {
  const items = [];
  const lang = String(locale || 'it');
  const regex = new RegExp(
    `<div><span class="ml-3 float-right"><em><small>\\((\\d+(?:,\\d+)?)(m³)?\\s*/\\s*min\\)</small></em></span>(\\d+(?:,\\d+)?)(m³)?x?<img[^>]+>\\s*<a href="/${lang}/items/detail/id/([^"]+)/name/[^"]*">`,
    'gi'
  );

  let match;
  while ((match = regex.exec(columnHtml)) !== null) {
    items.push({
      ratePerMin: parseAmount(match[1]),
      amount: parseAmount(match[3]),
      game_id: match[5],
      is_fluid: match[2] === 'm³' || match[4] === 'm³' ? 1 : 0,
    });
  }

  if (!items.length && lang !== 'en') {
    const fromEn = parseIoColumn(columnHtml, 'en');
    if (fromEn.length) return fromEn;
  }
  if (!items.length && lang !== 'it') {
    return parseIoColumn(columnHtml, 'it');
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

function parseIoRow(blockHtml, locale = 'it') {
  const marker = '<div class="row align-items-center">';
  let searchFrom = 0;

  while (true) {
    const start = blockHtml.indexOf(marker, searchFrom);
    if (start < 0) break;

    const nextRow = blockHtml.indexOf(marker, start + marker.length);
    const end = nextRow > 0 ? nextRow : blockHtml.length;
    const rowHtml = blockHtml.slice(start, end);

    if (!/\/[a-z]{2}\/items\/detail\/id\//.test(rowHtml)) {
      searchFrom = start + marker.length;
      continue;
    }

    const colParts = rowHtml.split('<div class="col-6');
    if (colParts.length >= 3) {
      const inputs = parseIoColumn(colParts[1], locale);
      const outputs = parseIoColumn(colParts[2], locale);
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
    afterCard.indexOf('<strong>Used to'),
    afterCard.indexOf('<strong>Benutzt'),
    afterCard.indexOf('<strong>Utilisé'),
    afterCard.indexOf('<strong>Usado'),
  ].filter((i) => i > 0);

  const end = endMarkers.length ? Math.min(...endMarkers) : afterCard.length;
  return afterCard.slice(0, end);
}

function parseSchemaBlocks(cardHtml, targetGameId, gameIdToSlug, isAlternative, locale) {
  if (!cardHtml) return [];

  const blocks = cardHtml.split('<div class="card-body border-top">').slice(1);
  const schemas = [];

  blocks.forEach((block) => {
    const schema = parseRecipeBlock(
      block,
      targetGameId,
      gameIdToSlug,
      schemas.length,
      isAlternative,
      locale
    );
    if (schema) schemas.push(schema);
  });

  return schemas;
}

function parseRecipeBlock(
  blockHtml,
  targetGameId,
  gameIdToSlug,
  sortOrder,
  isAlternativeSection,
  locale = 'it'
) {
  const nameMatch = blockHtml.match(
    /<h5 class="card-title">\s*([\s\S]*?)\s*<\/h5>/
  );
  if (!nameMatch) return null;

  const name = stripTags(nameMatch[1]);
  const buildingMatch =
    blockHtml.match(
      new RegExp(`/${locale}/buildings/detail/id/([^"]+)/name/([^"]*)"`)
    ) ||
    blockHtml.match(/\/[a-z]{2}\/buildings\/detail\/id\/([^"]+)\/name\/([^"]*)"/);

  const ioRow = parseIoRow(blockHtml, locale);
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
    is_alternative:
      isAlternativeSection || ALTERNATE_NAME_RE.test(name) ? 1 : 0,
    building_name: buildingName,
    building_slug: buildingIdToSlug(buildingId),
    duration: computeDuration(outputEntries, targetGameId),
    sort_order: sortOrder,
    inputs,
    outputs,
  };
}

function parseSchemas(html, targetGameId, gameIdToSlug, locale = 'it') {
  let schemas = [];

  for (const labels of labelCandidates(locale)) {
    const mainCard = extractRecipeCardHtml(html, labels.recipes);
    const altCard = extractRecipeCardHtml(html, labels.alternateRecipes);
    schemas = [
      ...parseSchemaBlocks(mainCard, targetGameId, gameIdToSlug, false, locale),
      ...parseSchemaBlocks(altCard, targetGameId, gameIdToSlug, true, locale),
    ];
    if (schemas.length) break;
  }

  schemas.forEach((schema, index) => {
    schema.sort_order = index;
  });

  return schemas;
}

function parseItemDetailPage(html, targetGameId, gameIdToSlug, options = {}) {
  const { includeSchemas = true, locale = 'it' } = options;

  return {
    game_id: targetGameId,
    description: parseDescription(html),
    stack_size: parseStackSize(html, locale),
    schemas: includeSchemas
      ? parseSchemas(html, targetGameId, gameIdToSlug, locale)
      : [],
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
  getLocaleLabels,
  LOCALE_LABELS,
};
