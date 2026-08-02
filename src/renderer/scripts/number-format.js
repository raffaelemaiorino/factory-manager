(() => {
  const FORMAT_IT = 'it';
  const FORMAT_EN_US = 'en-US';

  let currentFormat = FORMAT_IT;

  function normalizeFormat(value) {
    const raw = String(value || '').trim();
    if (raw === FORMAT_EN_US || raw === 'en' || raw === 'en_US' || raw === 'en-us') {
      return FORMAT_EN_US;
    }
    return FORMAT_IT;
  }

  function setFormat(value) {
    currentFormat = normalizeFormat(value);
    return currentFormat;
  }

  function getFormat() {
    return currentFormat;
  }

  function isUsFormat() {
    return currentFormat === FORMAT_EN_US;
  }

  function getThousandsSeparator() {
    return isUsFormat() ? ',' : '.';
  }

  function getDecimalSeparator() {
    return isUsFormat() ? '.' : ',';
  }

  function formatThousandsFromParts(intPart, decPart) {
    const thousands = getThousandsSeparator();
    const decimal = getDecimalSeparator();
    const formattedInt = String(intPart).replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
    // arguments.length < 2: integer only; decPart '' keeps the trailing decimal sep (e.g. calc "12.")
    if (arguments.length < 2 || decPart == null) return formattedInt;
    return `${formattedInt}${decimal}${decPart}`;
  }

  function formatThousandsFromNumericString(numericStr) {
    const s = String(numericStr);
    const dotIndex = s.indexOf('.');
    if (dotIndex === -1) return formatThousandsFromParts(s);
    return formatThousandsFromParts(s.slice(0, dotIndex), s.slice(dotIndex + 1));
  }

  /** Plain decimal for editable inputs (no thousands grouping). */
  function formatPlainDecimal(value) {
    if (value == null || value === '') return '';
    const s = String(value).trim();
    if (!s) return '';
    if (/^-?\d+(\.\d+)?$/.test(s)) {
      const decimal = getDecimalSeparator();
      return decimal === '.' ? s : s.replace('.', decimal);
    }
    const n = Number(s);
    if (!Number.isFinite(n)) return '';
    return formatPlainDecimal(String(n));
  }

  function parseLocalizedNumber(raw) {
    if (raw == null || raw === '') return NaN;
    if (typeof raw === 'number') return raw;
    let s = String(raw).trim().replace(/\s/g, '').replace(/[−–—]/g, '-');
    if (!s) return NaN;

    const dec = getDecimalSeparator();
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');

    if (hasComma && hasDot) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (hasComma && !hasDot) {
      if (dec === ',') {
        s = s.replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (hasDot && !hasComma) {
      if (dec === '.') {
        const dots = (s.match(/\./g) || []).length;
        if (dots > 1) s = s.replace(/\./g, '');
      } else {
        s = s.replace(/\./g, '');
      }
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function formatDisplayInteger(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0';
    return formatThousandsFromParts(String(Math.round(n)));
  }

  function formatDisplayNumber(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';

    const nearest = Math.round(n);
    let numericStr;
    if (Math.abs(n - nearest) < 0.01) {
      numericStr = String(nearest);
    } else if (window.ProductionScale?.roundProduction) {
      numericStr = String(window.ProductionScale.roundProduction(n));
    } else {
      numericStr = String(n);
    }

    return formatThousandsFromNumericString(numericStr);
  }

  window.NumberFormat = {
    FORMAT_IT,
    FORMAT_EN_US,
    setFormat,
    getFormat,
    normalizeFormat,
    getThousandsSeparator,
    getDecimalSeparator,
    formatDisplayNumber,
    formatDisplayInteger,
    formatThousandsFromNumericString,
    formatThousandsFromParts,
    formatPlainDecimal,
    parseLocalizedNumber,
  };
})();
