/**
 * Inventario lingue SCIM (satisfactory-calculator.com).
 * Unica fonte per import batch catalogo e seed tabella locales.
 */

const SCIM_LOCALES = [
  { code: 'ar', name: 'العربية', rtl: true, sort_order: 20 },
  { code: 'cs', name: 'Čeština', rtl: false, sort_order: 21 },
  { code: 'da', name: 'Dansk', rtl: false, sort_order: 22 },
  { code: 'de', name: 'Deutsch', rtl: false, sort_order: 3 },
  { code: 'en', name: 'English', rtl: false, sort_order: 2 },
  { code: 'es', name: 'Español', rtl: false, sort_order: 5 },
  { code: 'fa', name: 'فارسی', rtl: true, sort_order: 23 },
  { code: 'fi', name: 'Suomi', rtl: false, sort_order: 24 },
  { code: 'fr', name: 'Français', rtl: false, sort_order: 4 },
  { code: 'he', name: 'עברית', rtl: true, sort_order: 25 },
  { code: 'hu', name: 'Magyar', rtl: false, sort_order: 26 },
  { code: 'it', name: 'Italiano', rtl: false, sort_order: 1, is_default: true },
  { code: 'ja', name: '日本語', rtl: false, sort_order: 9 },
  { code: 'ko', name: '한국어', rtl: false, sort_order: 10 },
  { code: 'nl', name: 'Nederlands', rtl: false, sort_order: 12 },
  { code: 'no', name: 'Norsk', rtl: false, sort_order: 27 },
  { code: 'pl', name: 'Polski', rtl: false, sort_order: 7 },
  { code: 'pt', name: 'Português', rtl: false, sort_order: 6 },
  { code: 'ru', name: 'Русский', rtl: false, sort_order: 8 },
  { code: 'sk', name: 'Slovenčina', rtl: false, sort_order: 28 },
  { code: 'sv', name: 'Svenska', rtl: false, sort_order: 29 },
  { code: 'th', name: 'ไทย', rtl: false, sort_order: 30 },
  { code: 'tr', name: 'Türkçe', rtl: false, sort_order: 31 },
  { code: 'uk', name: 'Українська', rtl: false, sort_order: 32 },
  { code: 'zh', name: '中文', rtl: false, sort_order: 11 },
];

const SCIM_LOCALE_CODES = SCIM_LOCALES.map((locale) => locale.code);

const RTL_LOCALES = new Set(SCIM_LOCALES.filter((locale) => locale.rtl).map((l) => l.code));

function isScimLocale(code) {
  return SCIM_LOCALE_CODES.includes(String(code || '').toLowerCase());
}

function getScimLocale(code) {
  const normalized = String(code || '').toLowerCase();
  return SCIM_LOCALES.find((locale) => locale.code === normalized) || null;
}

function isRtlLocale(code) {
  return RTL_LOCALES.has(String(code || '').toLowerCase());
}

/** Codici da importare come catalogo (IT è già nei seed canonici). */
function getCatalogImportLocales({ includeIt = false } = {}) {
  return SCIM_LOCALES.filter((locale) => includeIt || locale.code !== 'it').map(
    (locale) => locale.code
  );
}

module.exports = {
  SCIM_LOCALES,
  SCIM_LOCALE_CODES,
  RTL_LOCALES,
  isScimLocale,
  getScimLocale,
  isRtlLocale,
  getCatalogImportLocales,
};
