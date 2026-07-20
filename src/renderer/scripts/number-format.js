(() => {
  function formatThousandsFromParts(intPart, decPart) {
    const formattedInt = String(intPart).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return decPart != null && decPart !== '' ? `${formattedInt},${decPart}` : formattedInt;
  }

  function formatThousandsFromNumericString(numericStr) {
    const s = String(numericStr);
    const dotIndex = s.indexOf('.');
    if (dotIndex === -1) return formatThousandsFromParts(s, '');
    return formatThousandsFromParts(s.slice(0, dotIndex), s.slice(dotIndex + 1));
  }

  function formatDisplayInteger(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '0';
    return formatThousandsFromParts(String(Math.round(n)), '');
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
    formatDisplayNumber,
    formatDisplayInteger,
    formatThousandsFromNumericString,
  };
})();
