(() => {
  const STORAGE_KEY = 'factory-manager.calculator.panel.v2';
  const MAX_DIGITS = 16;

  const state = {
    display: '0',
    pending: null,
    operator: null,
    waitingForOperand: false,
    memory: 0,
    error: false,
  };

  let panelEl = null;
  let displayEl = null;
  let memoryIndicatorEl = null;
  let toggleBtn = null;

  function formatDisplay(raw) {
    if (raw === 'Error') return 'Error';
    const negative = raw.startsWith('-');
    const abs = negative ? raw.slice(1) : raw;
    const parts = abs.split('.');
    const intPart = parts[0];
    const hasDecimal = parts.length > 1;
    let out;
    if (window.NumberFormat?.formatThousandsFromParts) {
      out = hasDecimal
        ? window.NumberFormat.formatThousandsFromParts(intPart, parts[1])
        : window.NumberFormat.formatThousandsFromParts(intPart);
    } else {
      const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      out = hasDecimal ? `${formattedInt},${parts[1]}` : formattedInt;
    }
    if (negative) out = `−${out}`;
    return out;
  }

  function syncNumberFormat() {
    const decimalBtn = panelEl?.querySelector('[data-calc="decimal"]');
    if (decimalBtn) {
      decimalBtn.textContent = window.NumberFormat?.getDecimalSeparator?.() || ',';
    }
    if (displayEl && !state.error) {
      displayEl.textContent = formatDisplay(state.display);
    }
  }

  function currentValue() {
    const n = Number(state.display);
    return Number.isFinite(n) ? n : 0;
  }

  function setDisplay(raw) {
    state.display = raw;
    if (displayEl) displayEl.textContent = formatDisplay(raw);
  }

  function setError() {
    state.error = true;
    state.pending = null;
    state.operator = null;
    state.waitingForOperand = false;
    setDisplay('Error');
  }

  function clearErrorIfNeeded() {
    if (!state.error) return false;
    state.error = false;
    setDisplay('0');
    return true;
  }

  function updateMemoryIndicator() {
    if (!memoryIndicatorEl) return;
    const has = state.memory !== 0;
    memoryIndicatorEl.hidden = !has;
  }

  function digitCount(raw) {
    return raw.replace('-', '').replace('.', '').length;
  }

  function inputDigit(digit) {
    if (clearErrorIfNeeded() || state.waitingForOperand) {
      setDisplay(digit);
      state.waitingForOperand = false;
      return;
    }
    if (state.display === '0') {
      setDisplay(digit);
      return;
    }
    if (state.display === '-0') {
      setDisplay(`-${digit}`);
      return;
    }
    if (digitCount(state.display) >= MAX_DIGITS) return;
    setDisplay(state.display + digit);
  }

  function inputDecimal() {
    if (clearErrorIfNeeded() || state.waitingForOperand) {
      setDisplay('0.');
      state.waitingForOperand = false;
      return;
    }
    if (state.display.includes('.')) return;
    if (digitCount(state.display) >= MAX_DIGITS) return;
    setDisplay(`${state.display}.`);
  }

  function clearAll() {
    state.error = false;
    state.pending = null;
    state.operator = null;
    state.waitingForOperand = false;
    setDisplay('0');
  }

  function clearEntry() {
    if (clearErrorIfNeeded()) return;
    setDisplay('0');
    state.waitingForOperand = false;
  }

  function backspace() {
    if (state.error || state.waitingForOperand) return;
    if (state.display.length <= 1 || state.display === '-0' || (state.display.startsWith('-') && state.display.length === 2)) {
      setDisplay('0');
      return;
    }
    setDisplay(state.display.slice(0, -1));
  }

  function negate() {
    if (clearErrorIfNeeded()) return;
    if (state.waitingForOperand) {
      setDisplay('0');
      state.waitingForOperand = false;
    }
    if (state.display === '0' || state.display === '0.') return;
    if (state.display.startsWith('-')) setDisplay(state.display.slice(1));
    else setDisplay(`-${state.display}`);
  }

  function applyOp(left, right, op) {
    switch (op) {
      case '+':
        return left + right;
      case '-':
        return left - right;
      case '*':
        return left * right;
      case '/':
        if (right === 0) return null;
        return left / right;
      default:
        return right;
    }
  }

  function toDisplayNumber(n) {
    if (!Number.isFinite(n)) return null;
    if (Object.is(n, -0)) return '0';
    let s = String(n);
    if (s.includes('e') || s.includes('E')) {
      s = n.toFixed(10).replace(/\.?0+$/, '');
    } else if (s.includes('.')) {
      const rounded = Number(n.toPrecision(12));
      s = String(rounded);
      if (s.includes('.')) s = s.replace(/\.?0+$/, '');
    }
    if (digitCount(s.replace(/^-/, '')) > MAX_DIGITS) {
      s = n.toPrecision(12).replace(/\.?0+$/, '');
    }
    return s;
  }

  function commitPending() {
    if (state.operator == null || state.pending == null || state.waitingForOperand) {
      return true;
    }
    const result = applyOp(state.pending, currentValue(), state.operator);
    if (result == null) {
      setError();
      return false;
    }
    const raw = toDisplayNumber(result);
    if (raw == null) {
      setError();
      return false;
    }
    setDisplay(raw);
    state.pending = result;
    return true;
  }

  function inputOperator(op) {
    if (state.error) return;
    if (state.operator != null && !state.waitingForOperand) {
      if (!commitPending()) return;
    } else {
      state.pending = currentValue();
    }
    state.operator = op;
    state.waitingForOperand = true;
  }

  function equals() {
    if (state.error) return;
    if (state.operator == null) return;
    const right = currentValue();
    const left = state.pending != null ? state.pending : right;
    const result = applyOp(left, right, state.operator);
    if (result == null) {
      setError();
      return;
    }
    const raw = toDisplayNumber(result);
    if (raw == null) {
      setError();
      return;
    }
    setDisplay(raw);
    state.pending = null;
    state.operator = null;
    state.waitingForOperand = true;
  }

  function percent() {
    if (state.error) return;
    let n = currentValue();
    if (state.pending != null && state.operator) {
      n = (state.pending * n) / 100;
    } else {
      n = n / 100;
    }
    const raw = toDisplayNumber(n);
    if (raw == null) {
      setError();
      return;
    }
    setDisplay(raw);
    state.waitingForOperand = false;
  }

  function memoryClear() {
    state.memory = 0;
    updateMemoryIndicator();
  }

  function memoryRecall() {
    if (clearErrorIfNeeded()) {
      /* fall through */
    }
    const raw = toDisplayNumber(state.memory);
    if (raw == null) {
      setError();
      return;
    }
    setDisplay(raw);
    state.waitingForOperand = false;
  }

  function memoryStore() {
    if (state.error) return;
    state.memory = currentValue();
    updateMemoryIndicator();
  }

  function memoryAdd() {
    if (state.error) return;
    state.memory += currentValue();
    updateMemoryIndicator();
  }

  function memorySubtract() {
    if (state.error) return;
    state.memory -= currentValue();
    updateMemoryIndicator();
  }

  function parseClipboardNumber(raw) {
    if (raw == null || raw === '') return NaN;
    let s = String(raw).trim();
    if (!s) return NaN;

    // Take the first line / first token that looks numeric (ignore units, labels, etc.)
    s = s.split(/\r?\n/)[0].trim();
    s = s.replace(/\s/g, '');
    s = s.replace(/[€$£¥]/gu, '');
    s = s.replace(/[−–—]/g, '-');

    const match = s.match(/-?\d[\d.,]*/);
    if (!match) return NaN;
    s = match[0];

    // Trailing separators only (e.g. "12," or "12.")
    s = s.replace(/[.,]+$/, '');
    if (!s || s === '-') return NaN;

    if (window.NumberFormat?.parseLocalizedNumber) {
      return window.NumberFormat.parseLocalizedNumber(s);
    }
    if (typeof parseConfigNumberInput === 'function') {
      return parseConfigNumberInput(s);
    }

    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    if (hasComma && hasDot) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (hasComma) {
      s = s.replace(',', '.');
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  async function copyDisplay() {
    if (state.error) return;
    const text = formatDisplay(state.display).replace(/−/g, '-');
    try {
      if (window.satisfactory?.clipboardWriteText) {
        window.satisfactory.clipboardWriteText(text);
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {
      /* fall through */
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(ta);
    }
  }

  async function pasteIntoDisplay() {
    let text = '';
    try {
      if (window.satisfactory?.clipboardReadText) {
        text = window.satisfactory.clipboardReadText();
      } else if (navigator.clipboard?.readText) {
        text = await navigator.clipboard.readText();
      }
    } catch {
      return;
    }
    const n = parseClipboardNumber(text);
    if (!Number.isFinite(n)) return;
    const raw = toDisplayNumber(n);
    if (raw == null) {
      setError();
      return;
    }
    state.error = false;
    setDisplay(raw);
    state.waitingForOperand = false;
  }

  function handleAction(action, el) {
    switch (action) {
      case 'digit':
        inputDigit(el.dataset.digit);
        break;
      case 'decimal':
        inputDecimal();
        break;
      case 'op':
        inputOperator(el.dataset.op);
        break;
      case 'equals':
        equals();
        break;
      case 'c':
        clearAll();
        break;
      case 'ce':
        clearEntry();
        break;
      case 'backspace':
        backspace();
        break;
      case 'negate':
        negate();
        break;
      case 'percent':
        percent();
        break;
      case 'mc':
        memoryClear();
        break;
      case 'mr':
        memoryRecall();
        break;
      case 'ms':
        memoryStore();
        break;
      case 'mplus':
        memoryAdd();
        break;
      case 'mminus':
        memorySubtract();
        break;
      case 'copy':
        void copyDisplay();
        break;
      case 'paste':
        void pasteIntoDisplay();
        break;
      default:
        break;
    }
  }

  function isOpen() {
    return panelEl && !panelEl.classList.contains('hidden');
  }

  function clampPosition(left, top) {
    const margin = 8;
    const rect = panelEl.getBoundingClientRect();
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    return {
      left: Math.min(Math.max(margin, left), maxLeft),
      top: Math.min(Math.max(margin, top), maxTop),
    };
  }

  function applyPosition(left, top) {
    const pos = clampPosition(left, top);
    panelEl.style.left = `${pos.left}px`;
    panelEl.style.top = `${pos.top}px`;
    panelEl.style.right = 'auto';
    panelEl.style.bottom = 'auto';
  }

  function defaultPosition() {
    const margin = 16;
    const width = panelEl.offsetWidth || 432;
    const chrome = document.querySelector('.app-chrome');
    const chromeBottom = chrome?.getBoundingClientRect().bottom ?? 64;
    return {
      left: Math.max(margin, window.innerWidth - width - margin),
      top: Math.max(margin, chromeBottom + 12),
    };
  }

  function savePosition() {
    try {
      const left = parseFloat(panelEl.style.left);
      const top = parseFloat(panelEl.style.top);
      if (!Number.isFinite(left) || !Number.isFinite(top)) return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ left, top }));
    } catch {
      /* ignore */
    }
  }

  function loadPosition() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Number.isFinite(parsed?.left) || !Number.isFinite(parsed?.top)) return null;
      return { left: parsed.left, top: parsed.top };
    } catch {
      return null;
    }
  }

  function openPanel() {
    if (!panelEl) return;
    panelEl.classList.remove('hidden');
    panelEl.setAttribute('aria-hidden', 'false');
    toggleBtn?.setAttribute('aria-expanded', 'true');

    const saved = loadPosition();
    requestAnimationFrame(() => {
      const pos = saved || defaultPosition();
      applyPosition(pos.left, pos.top);
    });
  }

  function closePanel() {
    if (!panelEl || !isOpen()) return;
    savePosition();
    panelEl.classList.add('hidden');
    panelEl.setAttribute('aria-hidden', 'true');
    toggleBtn?.setAttribute('aria-expanded', 'false');
  }

  function togglePanel() {
    if (isOpen()) closePanel();
    else openPanel();
  }

  function setupDrag(handle) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;

    function onPointerMove(e) {
      if (!dragging) return;
      applyPosition(originLeft + (e.clientX - startX), originTop + (e.clientY - startY));
    }

    function onPointerUp(e) {
      if (!dragging) return;
      dragging = false;
      handle.releasePointerCapture?.(e.pointerId);
      handle.classList.remove('is-dragging');
      savePosition();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    }

    function onPointerDown(e) {
      if (e.button != null && e.button !== 0) return;
      if (e.target.closest('button')) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = panelEl.getBoundingClientRect();
      originLeft = rect.left;
      originTop = rect.top;
      handle.classList.add('is-dragging');
      handle.setPointerCapture?.(e.pointerId);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
      e.preventDefault();
    }

    handle.addEventListener('pointerdown', onPointerDown);
  }

  function onKeyDown(e) {
    if (!isOpen()) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) {
      return;
    }
    if (e.target?.isContentEditable) return;

    const { key } = e;
    if (key >= '0' && key <= '9') {
      e.preventDefault();
      inputDigit(key);
      return;
    }
    if (key === ',' || key === '.') {
      e.preventDefault();
      inputDecimal();
      return;
    }
    if (key === '+' || key === '-' || key === '*' || key === '/') {
      e.preventDefault();
      inputOperator(key);
      return;
    }
    if (key === 'Enter' || key === '=') {
      e.preventDefault();
      equals();
      return;
    }
    if (key === 'Escape') {
      e.preventDefault();
      clearAll();
      return;
    }
    if (key === 'Backspace') {
      e.preventDefault();
      backspace();
      return;
    }
    if (key === '%') {
      e.preventDefault();
      percent();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (key === 'c' || key === 'C')) {
      if (window.getSelection?.()?.toString()) return;
      e.preventDefault();
      void copyDisplay();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (key === 'v' || key === 'V')) {
      e.preventDefault();
      void pasteIntoDisplay();
    }
  }

  function setupCalculator() {
    panelEl = document.getElementById('calculator-panel');
    displayEl = document.getElementById('calculator-display');
    memoryIndicatorEl = document.getElementById('calculator-memory-indicator');
    toggleBtn = document.getElementById('calculator-btn');
    if (!panelEl || !displayEl || !toggleBtn) return;

    setDisplay('0');
    updateMemoryIndicator();
    syncNumberFormat();

    toggleBtn.addEventListener('click', togglePanel);
    document.getElementById('calculator-panel-close')?.addEventListener('click', closePanel);

    panelEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-calc]');
      if (!btn || !panelEl.contains(btn)) return;
      handleAction(btn.dataset.calc, btn);
    });

    const dragHandle = document.getElementById('calculator-panel-drag');
    if (dragHandle) setupDrag(dragHandle);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', () => {
      if (!isOpen()) return;
      const left = parseFloat(panelEl.style.left);
      const top = parseFloat(panelEl.style.top);
      if (Number.isFinite(left) && Number.isFinite(top)) applyPosition(left, top);
    });
  }

  window.setupCalculator = setupCalculator;
  window.Calculator = {
    syncNumberFormat,
  };
})();
