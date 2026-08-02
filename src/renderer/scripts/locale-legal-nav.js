function setupNavigation() {
  document.getElementById('main-nav').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-view]');
    if (!btn || btn.disabled) return;
    switchView(btn.dataset.view);
  });

  document.querySelector('.brand--compact')?.addEventListener('click', () => {
    switchView('dashboard');
  });

  document.querySelectorAll('[data-goto]').forEach((el) => {
    el.addEventListener('click', () => switchView(el.dataset.goto));
  });
}

const legalInfoModal = document.getElementById('legal-info-modal');

function openLegalInfoModal() {
  if (!legalInfoModal) return;
  legalInfoModal.classList.remove('hidden');
  legalInfoModal.setAttribute('aria-hidden', 'false');
  document.getElementById('legal-info-modal-body')?.focus();
}

function closeLegalInfoModal() {
  if (!legalInfoModal) return;
  legalInfoModal.classList.add('hidden');
  legalInfoModal.setAttribute('aria-hidden', 'true');
}

function setupLegalInfoModal() {
  document.getElementById('legal-info-btn')?.addEventListener('click', openLegalInfoModal);
  document.getElementById('legal-info-modal-close')?.addEventListener('click', closeLegalInfoModal);

  legalInfoModal?.addEventListener('click', (e) => {
    if (e.target === legalInfoModal) closeLegalInfoModal();
  });
}

function renderLocaleSelect() {
  const menu = document.getElementById('locale-select-menu');
  const valueEl = document.getElementById('locale-select-value');
  const trigger = document.getElementById('locale-select-trigger');
  if (!menu || !valueEl || !trigger) return;

  const current =
    availableLocales.find((locale) => locale.code === activeLocale) ||
    availableLocales[0] ||
    { code: 'en', name: 'English' };

  valueEl.textContent = String(current.code || 'en').toUpperCase();
  trigger.title = t('topbar.languageTitle');
  trigger.setAttribute(
    'aria-label',
    t('topbar.languageAria', { name: current.name || current.code })
  );

  menu.innerHTML = availableLocales
    .map((locale) => {
      const code = String(locale.code || '').toUpperCase();
      const isActive = locale.code === activeLocale;
      return `<li
        class="theme-select-option locale-select-option ${isActive ? 'theme-select-option--active' : ''}"
        role="option"
        tabindex="-1"
        data-value="${escapeHtml(locale.code)}"
        aria-selected="${isActive ? 'true' : 'false'}"
      >
        <span class="locale-select-option-name">${escapeHtml(locale.name)}</span>
        <span class="locale-select-option-code">${escapeHtml(code)}</span>
      </li>`;
    })
    .join('');
}

async function refreshAfterLocaleChange() {
  syncLocaleDependentLabels();
  pickerResourcesData = [];
  window.EnergyUI?.clearLocaleCaches?.();

  // Rebuild catalog cache before any summary that depends on mineral slugs
  // (otherwise the resource balance box vanishes after IT→EN switch).
  try {
    if (typeof ensurePickerResourcesData === 'function') {
      await ensurePickerResourcesData();
    }
  } catch (err) {
    console.error('Locale picker resources refresh error:', err);
  }

  const app = document.getElementById('app');
  const currentView = app?.dataset.view || 'dashboard';

  if (currentView === 'resources' || resourcesData.length) {
    try {
      await refreshResourcesView();
    } catch (err) {
      console.error('Locale resources refresh error:', err);
    }
  }

  if (currentView === 'production') {
    try {
      await loadProductionChains();
    } catch (err) {
      console.error('Locale production refresh error:', err);
    }
  }

  if (currentView === 'production-detail' && activeProductionChainId) {
    try {
      activeProductionDetail = await window.satisfactory.getProductionChainDetail(
        activeProductionChainId
      );
      renderProductionDetailContent(activeProductionDetail);
    } catch (err) {
      console.error('Locale production detail refresh error:', err);
    }
  }

  if (currentView === 'energy' && window.EnergyUI) {
    try {
      await window.EnergyUI.loadEnergyChains();
    } catch (err) {
      console.error('Locale energy refresh error:', err);
    }
  }

  if (currentView === 'energy-detail' && window.EnergyUI?.reloadActiveDetail) {
    try {
      await window.EnergyUI.reloadActiveDetail();
    } catch (err) {
      console.error('Locale energy detail refresh error:', err);
    }
  }

  if (currentView === 'dashboard') {
    try {
      await initDashboard();
    } catch (err) {
      console.error('Locale dashboard refresh error:', err);
    }
  }

  if (currentView === 'settings') {
    try {
      await loadSettings();
    } catch (err) {
      console.error('Locale settings refresh error:', err);
    }
  }
}

async function setUiLocale(localeCode, { persist = true } = {}) {
  const next = String(localeCode || 'en').toLowerCase();
  if (persist) {
    await window.satisfactory.setAppLocale(next);
  }
  activeLocale = next;
  if (window.I18nUI?.loadLocale) {
    await window.I18nUI.loadLocale(activeLocale);
  } else {
    document.documentElement.lang = activeLocale;
  }
  syncLocaleDependentLabels();
  renderLocaleSelect();
  if (persist) {
    await refreshAfterLocaleChange();
  }
}

async function initLocaleSelector() {
  try {
    const info = await window.satisfactory.getI18nInfo();
    availableLocales = info.availableLocales?.length
      ? info.availableLocales
      : info.locales || [
          { code: 'en', name: 'English' },
          { code: 'it', name: 'Italiano' },
        ];
    activeLocale = info.activeLocale || 'en';
  } catch (err) {
    console.error('Locale init error:', err);
    availableLocales = [
      { code: 'en', name: 'English' },
      { code: 'it', name: 'Italiano' },
    ];
    activeLocale = 'en';
  }

  if (window.I18nUI?.loadLocale) {
    await window.I18nUI.loadLocale(activeLocale);
  } else {
    document.documentElement.lang = activeLocale;
  }
  syncLocaleDependentLabels();
  renderLocaleSelect();
}

function setupLocaleSelector() {
  const root = document.getElementById('locale-select');
  if (!root) return;

  root.addEventListener('click', async (e) => {
    const option = e.target.closest('.locale-select-option');
    if (option) {
      e.preventDefault();
      e.stopPropagation();
      const next = option.dataset.value;
      closeAllThemeSelects();
      if (!next || next === activeLocale) return;
      try {
        await setUiLocale(next);
      } catch (err) {
        console.error('Locale change error:', err);
      }
      return;
    }

    const trigger = e.target.closest('#locale-select-trigger');
    if (trigger) {
      e.preventDefault();
      e.stopPropagation();
      toggleThemeSelect(root);
    }
  });
}

