async function boot() {
  // Wired first, synchronously, so the alert modal is usable even if the
  // async init below throws before reaching its normal position in the list.
  setupAlertModal();

  try {
    await initProductionUiStateStore();
    initProductionTreeDetailMode();
    await initLocaleSelector();
    await initAppSettings();
    setupLocaleSelector();
    setupNavigation();
    setupLegalInfoModal();
    setupCalculator();
    setupSearch();
    setupSchemaFilter();
    setupNumberInputWheelBlock();
    setupConfirmModal();
    setupSchemaRenameModal();
    setupSettings();
    setupProductionUiStatePersistence();
    setupProduction();
    setupResourceActions();
    setupEditModal();
    setupDetailModal();
    setupDashboard();
    setupUpdateBanner();
    checkAppUpdateOnBoot();
  } catch (err) {
    // Without this, a rejection anywhere above is an unhandled promise
    // rejection and the app silently never finishes starting up.
    console.error('Factory Manager failed to start:', err);
    showAlert({
      title: 'Factory Manager failed to start',
      message: err && err.message ? err.message : String(err),
      okLabel: 'Close',
    });
  }
}


// The window.ProductionUI export below (plus its later Object.assign extension,
// and the window.showConfirm / window.showAlert exports) were originally positioned
// near the top of app.js, right after switchView(). That worked only because the
// whole file was one <script>, where function declarations are hoisted across the
// entire file before any top-level code runs. Now that app.js is split across
// multiple <script> tags, hoisting no longer spans files, so these statements must
// run AFTER every function/namespace member they reference has been defined - i.e.
// here, at the very end, right before boot() is called.
window.ProductionUI = {
  renderItemImage,
  renderThemeSelect,
  renderBuildingPanel,
  renderBuildingPowerShards,
  formatProductionValue,
  formatDisplayInteger,
  formatRateWithUnit,
  formatExtractionOutputInputValue,
  formatWaterExtractionOutputInputValue,
  parseConfigNumberInput,
  getEditableConfigInput,
  resolveConfigNumberInput,
  formatOutputInputValue,
  formatOverclockInputValue,
  formatMachineCountInput,
  computeTotalPowerShards,
  computeTotalSomersloops,
  computeDetailPowerShards,
  computeDetailSomersloops,
  computeDetailPowerMw,
  computeExtractionsPowerMw,
  renderPowerShardsSummary,
  formatExtractionBuildingConfigContent,
  getExtractionOutputUnit,
  getExtractionSubtitle,
  computeClientExtractionRate,
  getExtractionOutputSliderMin,
  getExtractionOutputSliderMax,
  usesFractionalExtractionOutput,
  getExtractionOutputSliderStep,
  lockConfigSlidersIn,
  isConfigSlider,
  isConfigSliderLocked,
  activateConfigSlider,
  deactivateConfigSlider,
  lockActiveConfigSlidersOutsidePointer,
  lockConfigNumberInputsIn,
  activateConfigNumberInput,
  lockConfigNumberInput,
  rememberConfigInputValue,
  getConfigInputField,
  applyConfigInputNudge,
  normalizeConfigInputSpinnerStep,
  nudgeConfigNumberInput,
  closeAllThemeSelects,
  toggleThemeSelect,
  MINER_OPTIONS,
  PURITY_OPTIONS,
  getLinkBalanceState,
  getLinkStateClass,
  resolveInputLinkBalance,
  normalizeLinkDelta,
  LINK_BALANCE_TOLERANCE,
  isExternalSummarySlug,
};

window.showConfirm = showConfirm;
window.showAlert = showAlert;

Object.assign(window.ProductionUI, {
  updateExtractionConfigDisplay,
  snapProductionSliderValue,
  guardConfigSliderInput,
  getEditableConfigInput,
});


boot();
