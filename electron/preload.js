const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('satisfactory', {
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  loadProductionUiState: () => ipcRenderer.sendSync('production-ui-state:load'),
  saveProductionUiState: (data) => ipcRenderer.sendSync('production-ui-state:save', data),
  getDbStatus: () => ipcRenderer.invoke('db:status'),
  getResources: () => ipcRenderer.invoke('resources:all'),
  getResourceCategories: () => ipcRenderer.invoke('resources:categories'),
  getResource: (id) => ipcRenderer.invoke('resources:get', id),
  getResourceDetail: (id) => ipcRenderer.invoke('resources:detail', id),
  updateResource: (id, data) => ipcRenderer.invoke('resources:update', id, data),
  searchResources: (query) => ipcRenderer.invoke('resources:search', query),
  restoreDefaultResources: () => ipcRenderer.invoke('db:restore-default-resources'),
  getResourcesDataInfo: () => ipcRenderer.invoke('db:resources-info'),
  getProductionChains: () => ipcRenderer.invoke('production:all'),
  createProductionChain: (data) => ipcRenderer.invoke('production:create', data),
  updateProductionChain: (id, data) => ipcRenderer.invoke('production:update', id, data),
  deleteProductionChain: (id) => ipcRenderer.invoke('production:delete', id),
  duplicateProductionChain: (id) => ipcRenderer.invoke('production:duplicate', id),
  exportProductionChain: (id) => ipcRenderer.invoke('production:export', id),
  importProductionChain: () => ipcRenderer.invoke('production:import'),
  getProductionChainDetail: (id) => ipcRenderer.invoke('production:get', id),
  addProductionChainStep: (chainId, data) =>
    ipcRenderer.invoke('production:add-step', chainId, data),
  updateProductionChainStep: (stepId, data) =>
    ipcRenderer.invoke('production:update-step', stepId, data),
  setProductionStepMarked: (stepId, marked) =>
    ipcRenderer.invoke('production:set-step-marked', stepId, marked),
  setProductionGroupMarked: (chainId, groupName, marked) =>
    ipcRenderer.invoke('production:set-group-marked', chainId, groupName, marked),
  resetProductionChainStep: (stepId) => ipcRenderer.invoke('production:reset-step', stepId),
  deleteProductionChainStep: (stepId) => ipcRenderer.invoke('production:delete-step', stepId),
  reorderProductionChainSteps: (chainId, stepIds) =>
    ipcRenderer.invoke('production:reorder-steps', chainId, stepIds),
  reorderProductionChainStepsInGroup: (chainId, groupName, stepIds) =>
    ipcRenderer.invoke('production:reorder-steps-in-group', chainId, groupName, stepIds),
  reorderProductionChainGroups: (chainId, groupKeys) =>
    ipcRenderer.invoke('production:reorder-step-groups', chainId, groupKeys),
  setProductionStepGroupName: (stepId, groupName) =>
    ipcRenderer.invoke('production:set-step-group', stepId, groupName),
  renameProductionStepGroup: (chainId, oldGroupName, newGroupName) =>
    ipcRenderer.invoke('production:rename-step-group', chainId, oldGroupName, newGroupName),
  setProductionStepInputLinks: (consumerStepId, itemSlug, producerStepIds) =>
    ipcRenderer.invoke('production:set-step-links', consumerStepId, itemSlug, producerStepIds),
  setProductionStepExtractionLinks: (consumerStepId, itemSlug, producerExtractionIds) =>
    ipcRenderer.invoke(
      'production:set-extraction-links',
      consumerStepId,
      itemSlug,
      producerExtractionIds
    ),
  addMineralExtraction: (chainId, data) =>
    ipcRenderer.invoke('production:add-extraction', chainId, data),
  updateMineralExtraction: (extractionId, data) =>
    ipcRenderer.invoke('production:update-extraction', extractionId, data),
  deleteMineralExtraction: (extractionId) =>
    ipcRenderer.invoke('production:delete-extraction', extractionId),
  resetMineralExtraction: (extractionId) =>
    ipcRenderer.invoke('production:reset-extraction', extractionId),
  getEnergyChains: () => ipcRenderer.invoke('energy:all'),
  createEnergyChain: (data) => ipcRenderer.invoke('energy:create', data),
  updateEnergyChain: (id, data) => ipcRenderer.invoke('energy:update', id, data),
  deleteEnergyChain: (id) => ipcRenderer.invoke('energy:delete', id),
  exportEnergyChain: (id) => ipcRenderer.invoke('energy:export', id),
  importEnergyChain: () => ipcRenderer.invoke('energy:import'),
  getEnergyChainDetail: (id) => ipcRenderer.invoke('energy:get', id),
  getEnergyGeneratorCatalog: () => ipcRenderer.invoke('energy:generator-catalog'),
  addEnergyExtraction: (chainId, data) =>
    ipcRenderer.invoke('energy:add-extraction', chainId, data),
  updateEnergyExtraction: (extractionId, data) =>
    ipcRenderer.invoke('energy:update-extraction', extractionId, data),
  deleteEnergyExtraction: (extractionId) =>
    ipcRenderer.invoke('energy:delete-extraction', extractionId),
  resetEnergyExtraction: (extractionId) =>
    ipcRenderer.invoke('energy:reset-extraction', extractionId),
  addEnergyGenerator: (chainId, data) =>
    ipcRenderer.invoke('energy:add-generator', chainId, data),
  updateEnergyGenerator: (generatorId, data) =>
    ipcRenderer.invoke('energy:update-generator', generatorId, data),
  deleteEnergyGenerator: (generatorId) =>
    ipcRenderer.invoke('energy:delete-generator', generatorId),
  resetEnergyGenerator: (generatorId) =>
    ipcRenderer.invoke('energy:reset-generator', generatorId),
  setEnergyGeneratorInputLinks: (generatorId, itemSlug, extractionIds) =>
    ipcRenderer.invoke('energy:set-input-links', generatorId, itemSlug, extractionIds),
  setEnergyGeneratorProductionLinks: (generatorId, itemSlug, producerStepIds) =>
    ipcRenderer.invoke('energy:set-production-links', generatorId, itemSlug, producerStepIds),
});
