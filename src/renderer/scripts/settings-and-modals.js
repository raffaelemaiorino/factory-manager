function setupDetailModal() {
  document.getElementById('detail-modal-close').addEventListener('click', closeDetailModal);

  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) closeDetailModal();
  });
}

function setupResourceActions() {
  document.getElementById('resources-container').addEventListener('click', (e) => {
    const editBtn = e.target.closest('.resource-edit-btn');
    if (editBtn) {
      e.preventDefault();
      e.stopPropagation();
      openEditModal(Number(editBtn.dataset.id)).catch(console.error);
      return;
    }

    const card = e.target.closest('.resource-card');
    if (!card) return;
    openDetailModal(Number(card.dataset.id));
  });
}

function setupEditModal() {
  document.getElementById('edit-modal-close').addEventListener('click', closeEditModal);
  document.getElementById('edit-modal-cancel').addEventListener('click', closeEditModal);

  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!confirmModal.classList.contains('hidden')) closeConfirm(false);
    if (!editModal.classList.contains('hidden')) closeEditModal();
    if (!detailModal.classList.contains('hidden')) closeDetailModal();
    if (legalInfoModal && !legalInfoModal.classList.contains('hidden')) closeLegalInfoModal();
    if (!productionCreateModal.classList.contains('hidden')) closeProductionCreateModal();
    if (!schemaRenameModal.classList.contains('hidden')) closeSchemaRenameModal();
    if (!resourcePickerModal.classList.contains('hidden')) closeResourcePickerModal();
    if (!schemaPickerModal.classList.contains('hidden')) closeSchemaPickerModal();
    if (views['production-detail'].classList.contains('view-active')) closeProductionDetail();
  });

  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideFormError();

    const id = Number(document.getElementById('edit-item-id').value);
    const data = {
      name: document.getElementById('edit-item-name').value,
      category: document.getElementById('edit-item-category').value,
    };

    try {
      await window.satisfactory.updateResource(id, data);
      closeEditModal();
      await refreshResourcesView();
    } catch (err) {
      showFormError(err.message || t('errors.saveFailed'));
    }
  });
}

function setupSearch() {
  const input = document.getElementById('resource-search');
  let debounce;

  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const searchQuery = input.value.trim();

      if (!searchQuery) {
        renderResources();
        document.getElementById('search-count').textContent = '';
        return;
      }

      try {
        isSearchActive = true;
        const results = await window.satisfactory.searchResources(searchQuery);
        renderSearchResults(results);
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 200);
  });
}

function formatDateTime(iso) {
  if (!iso) return t('common.never');
  try {
    return new Date(iso).toLocaleString(activeLocale || 'it');
  } catch {
    return iso;
  }
}

function showSettingsFeedback(message, type = 'success', targetId = 'settings-feedback') {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.textContent = message;
  el.className = `settings-feedback settings-feedback--${type}`;
  el.classList.remove('hidden');
}

function hideSettingsFeedback(targetId = 'settings-feedback') {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.textContent = '';
  el.classList.add('hidden');
}

function renderAppSettingsForm(settings = appSettings) {
  const maxMachinesInput = document.getElementById('settings-max-machines');
  const maxEnergyInput = document.getElementById('settings-max-energy-generators');
  const numberFormatSelect = document.getElementById('settings-number-format');
  if (maxMachinesInput) maxMachinesInput.value = String(settings.maxMachines);
  if (maxEnergyInput) maxEnergyInput.value = String(settings.maxEnergyGenerators);
  if (numberFormatSelect) {
    numberFormatSelect.value =
      window.NumberFormat?.normalizeFormat?.(settings.numberFormat) || 'it';
  }
}

function readAppSettingsForm() {
  const maxMachinesInput = document.getElementById('settings-max-machines');
  const maxEnergyInput = document.getElementById('settings-max-energy-generators');
  const numberFormatSelect = document.getElementById('settings-number-format');
  return {
    maxMachines: Math.round(Number(maxMachinesInput?.value) || 0),
    maxEnergyGenerators: Math.round(Number(maxEnergyInput?.value) || 0),
    numberFormat: numberFormatSelect?.value || 'it',
  };
}

async function saveAppSettingsFromForm() {
  const btn = document.getElementById('btn-save-app-settings');
  hideSettingsFeedback('settings-config-feedback');
  if (btn) btn.disabled = true;

  try {
    const saved = await window.satisfactory.setAppSettings(readAppSettingsForm());
    applyAppSettings(saved);
    renderAppSettingsForm(appSettings);
    showSettingsFeedback(t('settings.configSaved'), 'success', 'settings-config-feedback');
  } catch (err) {
    showSettingsFeedback(
      err.message || t('settings.errorSaveConfig'),
      'error',
      'settings-config-feedback'
    );
    console.error('Save app settings error:', err);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function formatSettingsCountValue(value) {
  if (value == null || value === '—') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? formatDisplayInteger(n) : String(value);
}

function renderSettingsStats(info) {
  const counts = info?.counts ?? {};
  const expected = info?.expected ?? {};

  document.getElementById('settings-count-items').textContent =
    `${formatSettingsCountValue(counts.items ?? 0)} / ${formatSettingsCountValue(expected.items ?? '—')}`;
  document.getElementById('settings-count-buildings').textContent =
    `${formatSettingsCountValue(counts.buildings ?? 0)} / ${formatSettingsCountValue(expected.buildings ?? '—')}`;
  document.getElementById('settings-count-schemas').textContent =
    `${formatSettingsCountValue(counts.schemas ?? 0)} / ${formatSettingsCountValue(expected.schemas ?? '—')}`;
  document.getElementById('settings-count-somersloop-buildings').textContent =
    `${formatSettingsCountValue(counts.somersloopBuildings ?? 0)} / ${formatSettingsCountValue(expected.somersloopBuildings ?? '—')}`;
  document.getElementById('settings-bundled-version').textContent =
    info?.bundledVersion != null ? `v${info.bundledVersion}` : '—';
  document.getElementById('settings-stored-version').textContent =
    info?.storedVersion != null ? `v${info.storedVersion}` : t('common.notSet');
  document.getElementById('settings-last-reset').textContent = formatDateTime(info?.lastResetAt);
}

async function loadSettings() {
  hideSettingsFeedback();
  hideSettingsFeedback('settings-config-feedback');

  try {
    const [info, status, settings] = await Promise.all([
      window.satisfactory.getResourcesDataInfo(),
      window.satisfactory.getDbStatus(),
      window.satisfactory.getAppSettings(),
    ]);
    applyAppSettings(settings);
    renderAppSettingsForm(appSettings);
    renderSettingsStats(info);
    renderEnvironmentStats(status);
  } catch (err) {
    showSettingsFeedback(t('settings.errorLoadInfo'), 'error');
    console.error('Settings load error:', err);
  }
}

function showConfirm({ title, message, confirmLabel = t('common.confirm') }) {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-message').textContent = message;
    document.getElementById('confirm-modal-ok').textContent = confirmLabel;
    confirmModal.classList.remove('hidden');
    confirmModal.setAttribute('aria-hidden', 'false');
    document.getElementById('confirm-modal-cancel').focus();
  });
}

function closeConfirm(result) {
  confirmModal.classList.add('hidden');
  confirmModal.setAttribute('aria-hidden', 'true');
  if (confirmResolve) {
    confirmResolve(result);
    confirmResolve = null;
  }
}

function showAlert({ title, message, okLabel = t('common.close') }) {
  return new Promise((resolve) => {
    alertResolve = resolve;
    document.getElementById('alert-modal-title').textContent = title;
    document.getElementById('alert-modal-message').textContent = message;
    document.getElementById('alert-modal-ok').textContent = okLabel;
    alertModal.classList.remove('hidden');
    alertModal.setAttribute('aria-hidden', 'false');
    document.getElementById('alert-modal-ok').focus();
  });
}

function closeAlert() {
  alertModal.classList.add('hidden');
  alertModal.setAttribute('aria-hidden', 'true');
  if (alertResolve) {
    alertResolve();
    alertResolve = null;
  }
}

function showImportTypeMismatchAlert(typeMismatch) {
  const { expected, actual } = typeMismatch || {};
  let messageKey = 'errors.importFailed';
  if (expected === 'production' && actual === 'energy') {
    messageKey = 'errors.importEnergyIntoProduction';
  } else if (expected === 'energy' && actual === 'production') {
    messageKey = 'errors.importProductionIntoEnergy';
  }
  return showAlert({
    title: t('errors.importTypeMismatchTitle'),
    message: t(messageKey),
  });
}

function setupConfirmModal() {
  document.getElementById('confirm-modal-cancel').addEventListener('click', () => {
    closeConfirm(false);
  });
  document.getElementById('confirm-modal-ok').addEventListener('click', () => {
    closeConfirm(true);
  });
  confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) closeConfirm(false);
  });
}

function setupAlertModal() {
  document.getElementById('alert-modal-ok')?.addEventListener('click', () => {
    closeAlert();
  });
  alertModal?.addEventListener('click', (e) => {
    if (e.target === alertModal) closeAlert();
  });
}

async function restoreDefaultResources() {
  const confirmed = await showConfirm({
    title: t('confirm.restoreDefaultsTitle'),
    message: t('confirm.restoreDefaultsMessage'),
    confirmLabel: t('confirm.restoreDefaultsConfirm'),
  });
  if (!confirmed) return;

  const btn = document.getElementById('btn-restore-resources');
  btn.disabled = true;
  hideSettingsFeedback();

  try {
    const result = await window.satisfactory.restoreDefaultResources();
    renderSettingsStats(result.status?.resources ?? result);
    await initDashboard();

    resourcesData = [];
    if (views.resources.classList.contains('view-active')) {
      await loadResources();
    }

    const items = result.status?.counts?.items ?? result.items?.count ?? '—';
    const schemas = result.status?.counts?.schemas ?? result.schemas?.count ?? '—';
    const buildings = result.status?.counts?.buildings ?? result.buildings?.count ?? '—';
    showSettingsFeedback(
      t('settings.restoreSuccess', {
        items: formatSettingsCountValue(items),
        buildings: formatSettingsCountValue(buildings),
        schemas: formatSettingsCountValue(schemas),
      }),
      'success'
    );
  } catch (err) {
    showSettingsFeedback(err.message || t('settings.errorRestore'), 'error');
    console.error('Restore error:', err);
  } finally {
    btn.disabled = false;
  }
}

function setupSettings() {
  document.getElementById('btn-restore-resources').addEventListener('click', restoreDefaultResources);
  document.getElementById('btn-save-app-settings')?.addEventListener('click', saveAppSettingsFromForm);
}

function setupNumberInputWheelBlock() {
  document.addEventListener(
    'wheel',
    (event) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement &&
        (target.type === 'number' || target.classList.contains('production-config-decimal-input')) &&
        target === document.activeElement
      ) {
        event.preventDefault();
        const field = getConfigInputField(target);
        if (field) {
          const commit =
            typeof field === 'string' &&
            field.startsWith('energy-') &&
            typeof window.EnergyUI?.commitEnergyConfigInputChange === 'function'
              ? window.EnergyUI.commitEnergyConfigInputChange
              : commitConfigInputChange;
          applyConfigInputNudge(target, field, event.deltaY < 0 ? 1 : -1, commit);
        }
      }
    },
    { passive: false, capture: true }
  );
}

function setupSchemaFilter() {
  const checkbox = document.getElementById('hide-no-schemas');
  hideWithoutSchemas = checkbox.checked;

  checkbox.addEventListener('change', () => {
    hideWithoutSchemas = checkbox.checked;
    renderCategorySidebar(resourcesData);

    const searchQuery = document.getElementById('resource-search').value.trim();
    if (searchQuery) {
      window.satisfactory.searchResources(searchQuery).then(renderSearchResults).catch(console.error);
    } else {
      renderResources();
    }
  });
}

