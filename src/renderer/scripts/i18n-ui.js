/**
 * i18n UI lato renderer (messaggi caricati via IPC, non via fs).
 */
(function initI18nUi(global) {
  let messages = {};
  let currentLocale = 'it';

  function getByPath(obj, keyPath) {
    if (obj == null || typeof keyPath !== 'string' || !keyPath) return undefined;

    if (Object.prototype.hasOwnProperty.call(obj, keyPath)) {
      return obj[keyPath];
    }

    const parts = keyPath.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== 'object') return undefined;
      const rest = parts.slice(i).join('.');
      if (Object.prototype.hasOwnProperty.call(cur, rest)) {
        return cur[rest];
      }
      const part = parts[i];
      if (!Object.prototype.hasOwnProperty.call(cur, part)) return undefined;
      cur = cur[part];
    }
    return cur;
  }

  function interpolate(template, vars) {
    if (!vars || typeof vars !== 'object') return template;
    return String(template).replace(/\{(\w+)\}/g, (_, key) => {
      const value = vars[key];
      return value == null ? `{${key}}` : String(value);
    });
  }

  function t(key, vars) {
    let value = getByPath(messages, key);
    if (typeof value !== 'string') return key;
    return vars ? interpolate(value, vars) : value;
  }

  function setMessages(locale, nextMessages) {
    currentLocale = locale || 'it';
    messages = nextMessages && typeof nextMessages === 'object' ? nextMessages : {};
  }

  function applyDomI18n(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      el.textContent = t(key);
    });

    root.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      if (!key) return;
      el.innerHTML = t(key);
    });

    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      el.setAttribute('placeholder', t(key));
    });

    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (!key) return;
      el.setAttribute('title', t(key));
    });

    root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria');
      if (!key) return;
      el.setAttribute('aria-label', t(key));
    });

    root.querySelectorAll('[data-i18n-alt]').forEach((el) => {
      const key = el.getAttribute('data-i18n-alt');
      if (!key) return;
      el.setAttribute('alt', t(key));
    });
  }

  async function loadLocale(locale) {
    const code = String(locale || 'it').toLowerCase();
    const payload = await global.satisfactory.getUiMessages(code);
    setMessages(code, payload);
    applyDomI18n();

    const root = document.documentElement;
    root.lang = code;
    const rtlLocales = new Set(['ar', 'he', 'fa']);
    root.dir = rtlLocales.has(code) ? 'rtl' : 'ltr';

    return payload;
  }

  global.I18nUI = {
    t,
    setMessages,
    applyDomI18n,
    loadLocale,
    getLocale: () => currentLocale,
  };

  global.t = t;
})(window);
