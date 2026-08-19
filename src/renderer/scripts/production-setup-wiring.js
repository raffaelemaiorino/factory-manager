function setupProduction() {
  document.addEventListener('mousedown', handleThemeSelectOutsidePointer, true);

  document.getElementById('btn-new-production').addEventListener('click', openProductionCreateModal);
  document.getElementById('btn-import-production').addEventListener('click', async () => {
    try {
      const result = await window.satisfactory.importProductionChain();
      if (result?.canceled) return;
      if (result?.typeMismatch) {
        await showImportTypeMismatchAlert(result.typeMismatch);
        return;
      }
      if (!result?.chain) return;
      productionChains = [result.chain, ...productionChains.filter((item) => item.id !== result.chain.id)];
      await loadProductionChainSummaries();
      renderProductionChains();
    } catch (err) {
      console.error('Production import error:', err);
      await showAlert({
        title: t('errors.importFailed'),
        message: err.message || t('errors.importFailed'),
      });
    }
  });
  document.getElementById('production-create-modal-close').addEventListener('click', closeProductionCreateModal);
  document.getElementById('production-create-cancel').addEventListener('click', closeProductionCreateModal);

  const manifoldLayoutModal = document.getElementById('manifold-layout-modal');
  document.getElementById('manifold-layout-modal-close')?.addEventListener('click', closeManifoldLayoutModal);
  manifoldLayoutModal?.addEventListener('click', (e) => {
    if (e.target === manifoldLayoutModal) closeManifoldLayoutModal();
  });

  const manifoldAlignModal = document.getElementById('manifold-align-modal');
  document.getElementById('manifold-align-modal-close')?.addEventListener('click', closeManifoldAlignModal);
  manifoldAlignModal?.addEventListener('click', (e) => {
    if (e.target === manifoldAlignModal) closeManifoldAlignModal();
    const applyBtn = e.target.closest('[data-manifold-align-apply]');
    if (applyBtn) {
      e.preventDefault();
      handleManifoldAlignApply(applyBtn);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (manifoldAlignModal && !manifoldAlignModal.classList.contains('hidden')) {
      closeManifoldAlignModal();
      return;
    }
    if (!manifoldLayoutModal || manifoldLayoutModal.classList.contains('hidden')) return;
    closeManifoldLayoutModal();
  });
  document.getElementById('production-create-pick-product')?.addEventListener('click', () => {
    openCreateTargetPickerModal();
  });
  document.getElementById('production-create-targets-list')?.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-create-target-remove]');
    if (!removeBtn) return;
    removeProductionCreateTargetAt(Number(removeBtn.dataset.createTargetRemove));
  });
  document.getElementById('production-create-targets-list')?.addEventListener('change', (e) => {
    const rateInput = e.target.closest('[data-create-target-rate]');
    if (!rateInput) return;
    const index = Number(rateInput.dataset.createTargetRate);
    const rate = Number(rateInput.value);
    if (!productionCreateTargets[index]) return;
    if (!Number.isFinite(rate) || rate <= 0) {
      rateInput.value = String(productionCreateTargets[index].rate);
      return;
    }
    productionCreateTargets[index].rate = rate;
  });

  productionCreateModal.addEventListener('click', (e) => {
    if (e.target === productionCreateModal) closeProductionCreateModal();
  });

  document.getElementById('production-container').addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.production-edit-btn');
    if (editBtn) {
      e.preventDefault();
      e.stopPropagation();

      const chainId = Number(editBtn.dataset.id);
      const chain = productionChains.find((item) => item.id === chainId);
      if (!chain) return;

      openSchemaRenameModal({
        kind: 'production',
        id: chainId,
        name: chain.name,
        onSaved: (updated) => {
          const index = productionChains.findIndex((item) => item.id === chainId);
          if (index >= 0) productionChains[index] = updated;
          if (activeProductionDetail?.chain?.id === chainId) {
            activeProductionDetail.chain.name = updated.name;
            document.getElementById('production-detail-heading').textContent = updated.name;
            document.getElementById('production-detail-breadcrumb').textContent = updated.name;
          }
          renderProductionChains();
        },
      });
      return;
    }

    const duplicateBtn = e.target.closest('.production-duplicate-btn');
    if (duplicateBtn) {
      e.preventDefault();
      e.stopPropagation();

      const chainId = Number(duplicateBtn.dataset.id);
      const chain = productionChains.find((item) => item.id === chainId);
      if (!chain) return;

      try {
        const copied = await window.satisfactory.duplicateProductionChain(chainId);
        productionChains = [copied, ...productionChains.filter((item) => item.id !== copied.id)];
        await loadProductionChainSummaries();
        renderProductionChains();
      } catch (err) {
        console.error('Production duplicate error:', err);
      }
      return;
    }

    const exportBtn = e.target.closest('.production-export-btn');
    if (exportBtn) {
      e.preventDefault();
      e.stopPropagation();

      const chainId = Number(exportBtn.dataset.id);
      const chain = productionChains.find((item) => item.id === chainId);
      if (!chain) return;

      try {
        await window.satisfactory.exportProductionChain(chainId);
      } catch (err) {
        console.error('Production export error:', err);
      }
      return;
    }

    const deleteBtn = e.target.closest('.production-delete-btn');
    if (deleteBtn) {
      e.preventDefault();
      e.stopPropagation();

      const chainId = Number(deleteBtn.dataset.id);
      const chain = productionChains.find((item) => item.id === chainId);
      if (!chain) return;

      const confirmed = await showConfirm({
        title: t('confirm.deletePlanTitle'),
        message: t('confirm.deletePlanMessage', { name: chain.name }),
        confirmLabel: t('actions.delete'),
      });
      if (!confirmed) return;

      try {
        await window.satisfactory.deleteProductionChain(chainId);
        productionChains = productionChains.filter((item) => item.id !== chainId);
        productionChainSummaries.delete(chainId);
        renderProductionChains();
      } catch (err) {
        console.error('Production delete error:', err);
      }
      return;
    }

    const openTarget = e.target.closest('.production-card-body');
    if (openTarget) {
      openProductionDetail(Number(openTarget.dataset.id));
    }
  });

  document.getElementById('production-detail-back').addEventListener('click', closeProductionDetail);
  document.getElementById('production-detail-external-summary')?.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-build-summary-toggle]');
    if (!toggle) return;
    e.preventDefault();
    setPlanBuildSummaryCollapsed(!isPlanBuildSummaryCollapsed());
    updateProductionDetailExternalSummary();
  });
  document.getElementById('btn-production-tree-view').addEventListener('click', toggleProductionTreeView);
  document
    .getElementById('btn-production-group-tree-view')
    .addEventListener('click', toggleProductionGroupTreeView);
  document.getElementById('btn-add-resource-step').addEventListener('click', openResourcePickerModal);
  document
    .getElementById('btn-add-resource-step-output')
    .addEventListener('click', openResourceOutputPickerModal);
  document.getElementById('btn-add-extraction').addEventListener('click', openExtractionPickerModal);

  productionDetailBody.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;

    const slider = e.target.closest('.production-config-slider');
    if (slider && isConfigSlider(slider) && isConfigSliderLocked(slider)) {
      activateConfigSlider(slider);
      return;
    }

    const groupHandle = e.target.closest('.production-step-group-drag-handle');
    if (groupHandle && canReorderProductionGroups() && !productionGroupDragState && !productionStepDragState) {
      const groupEl = groupHandle.closest('.production-step-group');
      const list = groupEl?.closest('#production-steps-list');
      if (!groupEl || !list) return;

      e.preventDefault();
      startProductionGroupDrag(groupEl, list, groupHandle, e);
      return;
    }

    const handle = e.target.closest('.production-step-drag-handle:not(.production-step-group-drag-handle)');
    if (!handle) return;

    const stepEl = handle.closest('.production-step');
    const list = stepEl?.closest('.production-step-group-body');
    if (!stepEl || !list || productionStepDragState) return;

    e.preventDefault();
    startProductionStepDrag(stepEl, list, handle, e);
  });

  productionDetailBody.addEventListener('pointermove', (e) => {
    if (productionGroupDragState?.pointerId === e.pointerId) {
      e.preventDefault();
      updateProductionGroupDrag(e);
      return;
    }
    if (!productionStepDragState || productionStepDragState.pointerId !== e.pointerId) return;
    e.preventDefault();
    updateProductionStepDrag(e);
  });

  const finishProductionGroupDrag = async (e) => {
    if (!productionGroupDragState || productionGroupDragState.pointerId !== e.pointerId) return;

    const { groupEl, list, handle, placeholder, clone, didMove } = productionGroupDragState;

    try {
      handle.releasePointerCapture(e.pointerId);
    } catch (_) {
      /* pointer already released */
    }

    if (placeholder && groupEl) {
      list.insertBefore(groupEl, placeholder);
    }

    clone?.remove();
    placeholder?.remove();
    groupEl?.classList.remove('production-step-group--drag-hidden');

    list?.querySelectorAll('.production-step-group').forEach((el) => {
      el.classList.remove('production-step-group--drop-target', 'production-step-group--drop-after');
    });

    document.body.classList.remove('production-step-drag-active');
    productionGroupDragState = null;

    if (didMove && list) {
      await saveProductionGroupOrder(list);
    }

    updateProductionGroupReorderUi();
  };

  const finishProductionStepDrag = async (e) => {
    if (!productionStepDragState || productionStepDragState.pointerId !== e.pointerId) return;

    const { stepEl, list, handle, placeholder, clone, didMove } = productionStepDragState;

    try {
      handle.releasePointerCapture(e.pointerId);
    } catch (_) {
      /* pointer already released */
    }

    if (placeholder && stepEl) {
      list.insertBefore(stepEl, placeholder);
    }

    clone?.remove();
    placeholder?.remove();
    stepEl?.classList.remove('production-step--dragging', 'production-step--drag-hidden');

    list?.querySelectorAll('.production-step').forEach((el) => {
      el.classList.remove('production-step--drop-target', 'production-step--drop-after');
    });

    document.body.classList.remove('production-step-drag-active');
    productionStepDragState = null;

    if (didMove && list) {
      await saveProductionStepOrder(list);
    }
  };

  productionDetailBody.addEventListener('pointerup', finishProductionGroupDrag);
  productionDetailBody.addEventListener('pointercancel', finishProductionGroupDrag);
  productionDetailBody.addEventListener('pointerup', finishProductionStepDrag);
  productionDetailBody.addEventListener('pointercancel', finishProductionStepDrag);

  productionDetailBody.addEventListener('pointerup', (e) => {
    if (e.button !== 0) return;
    lockActiveConfigSlidersOutsidePointer(e.clientX, e.clientY);
  });

  productionDetailBody.addEventListener('pointerleave', (e) => {
    const field = e.target.closest('.production-config-field');
    if (!field || e.target !== field) return;
    const slider = field.querySelector('.production-config-slider');
    if (!slider || !isConfigSlider(slider)) return;
    if (e.buttons !== 0) return;
    if (field.contains(e.relatedTarget)) return;
    deactivateConfigSlider(slider);
  });

  productionDetailBody.addEventListener('focusin', (e) => {
    const slider = e.target.closest('.production-config-slider');
    if (slider && isConfigSlider(slider)) {
      activateConfigSlider(slider);
      return;
    }

    const input = getEditableConfigInput(e.target);
    if (!input) return;
    rememberConfigInputValue(input);
    activateConfigNumberInput(input);
  });

  productionDetailBody.addEventListener('focusout', (e) => {
    const slider = e.target.closest('.production-config-slider');
    if (slider && isConfigSlider(slider)) {
      window.setTimeout(() => {
        if (document.activeElement === slider) return;
        deactivateConfigSlider(slider);
      }, 0);
      return;
    }

    const input = getEditableConfigInput(e.target);
    if (!input) return;
    window.setTimeout(() => {
      if (document.activeElement === input) return;
      lockConfigNumberInput(input);
    }, 0);
  });

  productionDetailBody.addEventListener('input', (e) => {
    const configInput = resolveConfigNumberInput(e.target);
    if (configInput && normalizeConfigInputSpinnerStep(configInput, e)) return;

    const outputSlider = e.target.closest('.production-output-slider');
    if (outputSlider) {
      guardConfigSliderInput(outputSlider, () => handleProductionSliderInput(outputSlider, 'output'));
      return;
    }

    const overclockSlider = e.target.closest('.production-overclock-slider');
    if (overclockSlider) {
      guardConfigSliderInput(overclockSlider, () =>
        handleProductionSliderInput(overclockSlider, 'overclock')
      );
      return;
    }

    const machinesSlider = e.target.closest('.production-machines-slider');
    if (machinesSlider) {
      guardConfigSliderInput(machinesSlider, () =>
        handleProductionSliderInput(machinesSlider, 'machines')
      );
      return;
    }

    const extractionOverclockSlider = e.target.closest('.production-extraction-overclock-slider');
    if (extractionOverclockSlider) {
      guardConfigSliderInput(extractionOverclockSlider, () =>
        handleExtractionSliderInput(extractionOverclockSlider, 'overclock')
      );
      return;
    }

    const extractionOutputSlider = e.target.closest('.production-extraction-output-slider');
    if (extractionOutputSlider) {
      guardConfigSliderInput(extractionOutputSlider, () =>
        handleExtractionSliderInput(extractionOutputSlider, 'output')
      );
      return;
    }

    const extractionNodesSlider = e.target.closest('.production-extraction-nodes-slider');
    if (extractionNodesSlider) {
      guardConfigSliderInput(extractionNodesSlider, () =>
        handleExtractionSliderInput(extractionNodesSlider, 'nodes')
      );
      return;
    }

    const wellNodeExtractorsSlider = e.target.closest('.production-well-node-extractors-slider');
    if (wellNodeExtractorsSlider) {
      guardConfigSliderInput(wellNodeExtractorsSlider, () => {
        const value = snapProductionSliderValue(wellNodeExtractorsSlider);
        if (value == null) return;
        const extractionId = Number(wellNodeExtractorsSlider.dataset.extractionId);
        const index = Number(wellNodeExtractorsSlider.dataset.subNodeIndex);
        const extractionEl = productionDetailBody.querySelector(
          `[data-extraction-id="${extractionId}"]`
        );
        const input = extractionEl?.querySelector(
          `.production-well-node-extractors-input[data-sub-node-index="${index}"]`
        );
        if (input) input.value = String(value);
        handleExtractionConfigChange(extractionId, 'sub-node-extractors-slider', {
          index,
          count: value,
        });
      });
    }
  });

  productionDetailBody.addEventListener('change', (e) => {
    const planSetting = e.target.closest('[data-plan-setting]');
    if (planSetting) {
      applyPlanSettingsFromUi();
      return;
    }

    const planTargetRate = e.target.closest('[data-plan-target-rate]');
    if (planTargetRate) {
      schedulePlanTargetRateChange(
        Number(planTargetRate.dataset.planTargetRate),
        planTargetRate.value
      );
      return;
    }

    const configInput = resolveConfigNumberInput(e.target);
    const field = configInput ? getConfigInputField(configInput) : null;
    if (field) {
      commitConfigInputFromField(configInput, field);
      rememberConfigInputValue(configInput);
      return;
    }
  });

  productionDetailBody.addEventListener(
    'wheel',
    (e) => {
      const slider = e.target.closest('.production-config-slider');
      if (!slider || !isConfigSlider(slider)) return;
      if (isConfigSliderLocked(slider) || document.activeElement !== slider) return;
      e.preventDefault();
      nudgeProductionSlider(slider, e.deltaY < 0 ? 1 : -1);
    },
    { passive: false }
  );

  productionDetailBody.addEventListener('change', (e) => {
    const somersloopCheckbox = e.target.closest('.production-somersloop-checkbox');
    if (somersloopCheckbox) {
      handleSomersloopChange(Number(somersloopCheckbox.dataset.stepId));
      return;
    }

    const stepMarkCheckbox = e.target.closest(
      '.production-step-mark-checkbox, .production-graph-step-mark-checkbox'
    );
    if (stepMarkCheckbox) {
      handleStepMarkedChange(Number(stepMarkCheckbox.dataset.stepId), stepMarkCheckbox.checked);
      return;
    }

    const groupMarkCheckbox = e.target.closest('.production-step-group-mark-checkbox');
    if (groupMarkCheckbox) {
      handleProductionGroupMarkedChange(groupMarkCheckbox.dataset.groupKey, groupMarkCheckbox.checked);
      return;
    }

    const checkbox = e.target.closest('.production-link-checkbox');
    if (checkbox) {
      handleStepLinkChange(checkbox);
      return;
    }

    const extractionCheckbox = e.target.closest('.production-extraction-link-checkbox');
    if (extractionCheckbox) {
      handleExtractionLinkChange(extractionCheckbox);
      return;
    }

    const extractionConsumerCheckbox = e.target.closest(
      '.production-extraction-consumer-link-checkbox'
    );
    if (extractionConsumerCheckbox) {
      handleExtractionConsumerLinkChange(extractionConsumerCheckbox);
    }
  });

  productionDetailBody.addEventListener('click', (e) => {
    if (e.target.closest('#btn-add-plan-target')) {
      e.preventDefault();
      openPlanTargetPickerModal();
      return;
    }

    const removeTargetBtn = e.target.closest('[data-plan-target-remove]');
    if (removeTargetBtn) {
      e.preventDefault();
      removePlanTargetItem(Number(removeTargetBtn.dataset.planTargetRemove));
      return;
    }

    if (e.target.closest('.production-io-rate')) {
      e.stopPropagation();
    }

    const inputAddTrigger = e.target.closest('.production-input-add-trigger');
    if (inputAddTrigger) {
      e.preventDefault();
      e.stopPropagation();
      const sourceStepEl = inputAddTrigger.closest('.production-step');
      pendingInsertAfterStepId = sourceStepEl ? Number(sourceStepEl.dataset.stepId) : null;
      addProductionStepForInputSlug(inputAddTrigger.dataset.itemSlug);
      return;
    }

    const outputAddTrigger = e.target.closest('.production-output-add-trigger');
    if (outputAddTrigger) {
      e.preventDefault();
      e.stopPropagation();
      const sourceStepEl = outputAddTrigger.closest('.production-step');
      pendingInsertAfterStepId = sourceStepEl ? Number(sourceStepEl.dataset.stepId) : null;
      addProductionStepForOutputSlug(outputAddTrigger.dataset.itemSlug);
      return;
    }

    const themeSelectOption = e.target.closest('.theme-select-option');
    if (themeSelectOption) {
      e.preventDefault();
      e.stopPropagation();
      const select = themeSelectOption.closest('.theme-select');
      if (select?.dataset.boxTransportMk) {
        handleBoxTransportMkChange(select, themeSelectOption.dataset.value);
        closeAllThemeSelects();
        return;
      }
      if (select?.dataset.field === 'step-group' && select.dataset.stepId) {
        handleProductionStepGroupChange(
          Number(select.dataset.stepId),
          themeSelectOption.dataset.value
        );
        closeAllThemeSelects();
        return;
      }
      if (!select?.dataset.extractionId || !select.dataset.field) return;

      if (select.dataset.field === 'sub-node-purity') {
        handleExtractionConfigChange(Number(select.dataset.extractionId), 'sub-node-purity', {
          index: Number(select.dataset.subNodeIndex),
          purity: themeSelectOption.dataset.value,
        });
        closeAllThemeSelects();
        return;
      }

      handleExtractionConfigChange(
        Number(select.dataset.extractionId),
        select.dataset.field,
        themeSelectOption.dataset.value
      );
      closeAllThemeSelects();
      return;
    }

    const themeSelectTrigger = e.target.closest('.theme-select-trigger');
    if (themeSelectTrigger) {
      e.preventDefault();
      e.stopPropagation();
      toggleThemeSelect(themeSelectTrigger.closest('.theme-select'));
      return;
    }

    if (!e.target.closest('.theme-select')) {
      closeAllThemeSelects();
    }

    const duplicateBtn = e.target.closest('.production-extraction-duplicate-btn');
    if (duplicateBtn) {
      e.preventDefault();
      e.stopPropagation();
      addMineralExtractionFromPicker(Number(duplicateBtn.dataset.itemId), {
        extractionMethod: duplicateBtn.dataset.extractionMethod || undefined,
      });
      return;
    }

    const wellAddNodeBtn = e.target.closest('.production-well-add-node-btn');
    if (wellAddNodeBtn) {
      e.preventDefault();
      e.stopPropagation();
      handleExtractionConfigChange(Number(wellAddNodeBtn.dataset.extractionId), 'add-sub-node');
      return;
    }

    const wellRemoveNodeBtn = e.target.closest('.production-well-remove-node-btn:not([disabled])');
    if (wellRemoveNodeBtn) {
      e.preventDefault();
      e.stopPropagation();
      handleExtractionConfigChange(
        Number(wellRemoveNodeBtn.dataset.extractionId),
        'remove-sub-node',
        Number(wellRemoveNodeBtn.dataset.subNodeIndex)
      );
      return;
    }

    const extractionResetBtn = e.target.closest(
      '.production-step-reset-btn[data-extraction-id]:not(.production-well-add-node-btn)'
    );
    if (extractionResetBtn) {
      e.preventDefault();
      e.stopPropagation();
      resetProductionExtraction(Number(extractionResetBtn.dataset.extractionId));
      return;
    }

    const extractionDeleteBtn = e.target.closest(
      '.production-step-delete-btn[data-extraction-id]:not(.production-well-remove-node-btn)'
    );
    if (extractionDeleteBtn) {
      e.preventDefault();
      e.stopPropagation();
      deleteProductionExtraction(Number(extractionDeleteBtn.dataset.extractionId));
      return;
    }

    const groupTreeBtn = e.target.closest('.production-step-group-tree-btn');
    if (groupTreeBtn) {
      e.preventDefault();
      e.stopPropagation();
      openProductionGroupTreeView(groupTreeBtn.dataset.groupKey);
      return;
    }

    const groupRenameBtn = e.target.closest('.production-step-group-rename-btn');
    if (groupRenameBtn) {
      e.preventDefault();
      e.stopPropagation();
      const groupKey = groupRenameBtn.dataset.groupKey;
      openSchemaRenameModal({
        kind: 'rename-step-group',
        id: activeProductionChainId,
        groupKey,
        name: groupKey,
        title: t('confirm.renameGroupTitle'),
      });
      return;
    }

    const groupToggleBtn = e.target.closest('.production-step-group-toggle-btn');
    if (groupToggleBtn) {
      e.preventDefault();
      e.stopPropagation();
      const groupKey = groupToggleBtn.dataset.groupKey;
      const groupEl = groupToggleBtn.closest('.production-step-group');
      const next = toggleProductionGroupViewState(groupKey);
      applyProductionGroupViewState(groupEl, next);
      return;
    }

    const toggleBtn = e.target.closest('.production-step-toggle-btn[data-step-id]');
    if (toggleBtn) {
      e.preventDefault();
      e.stopPropagation();
      const stepEl = toggleBtn.closest('.production-step');
      const stepId = normalizeProductionStepId(toggleBtn.dataset.stepId);
      if (!stepEl || !stepId) return;
      applyProductionStepViewState(stepEl, cycleProductionStepViewState(stepId));
      return;
    }

    const manifoldLayoutBtn = e.target.closest('[data-manifold-layout-open]');
    if (manifoldLayoutBtn) {
      e.preventDefault();
      e.stopPropagation();
      handleManifoldLayoutOpen(manifoldLayoutBtn);
      return;
    }

    const manifoldAlignBtn = e.target.closest('[data-manifold-align-open]');
    if (manifoldAlignBtn) {
      e.preventDefault();
      e.stopPropagation();
      handleManifoldAlignOpen(manifoldAlignBtn);
      return;
    }

    const buildStatsToggle = e.target.closest('[data-build-stats-toggle]');
    if (buildStatsToggle) {
      e.preventDefault();
      e.stopPropagation();
      handleBuildStatsToggle(buildStatsToggle);
      return;
    }

    const resetBtn = e.target.closest('.production-step-reset-btn[data-step-id]');
    if (resetBtn) {
      e.preventDefault();
      e.stopPropagation();
      resetProductionStep(Number(resetBtn.dataset.stepId));
      return;
    }

    const deleteBtn = e.target.closest('.production-step-delete-btn[data-step-id]');
    if (!deleteBtn) return;
    e.preventDefault();
    e.stopPropagation();
    deleteProductionStep(Number(deleteBtn.dataset.stepId));
  });

  document.getElementById('resource-picker-modal-close').addEventListener('click', closeResourcePickerModal);
  resourcePickerModal.addEventListener('click', (e) => {
    if (e.target === resourcePickerModal) closeResourcePickerModal();
  });

  document.getElementById('resource-picker-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.picker-item:not([disabled])');
    if (!btn) return;
    const itemId = Number(btn.dataset.id);
    rememberResourcePickerSelection(itemId);
    handleResourceSelection(itemId, {
      extractionMethod: btn.dataset.extractionMethod || undefined,
    });
  });

  const pickerSearch = document.getElementById('resource-picker-search');
  let pickerDebounce;
  pickerSearch.addEventListener('input', () => {
    clearTimeout(pickerDebounce);
    pickerDebounce = setTimeout(async () => {
      const query = pickerSearch.value.trim();
      const listEl = document.getElementById('resource-picker-list');

      if (!query) {
        if (resourcePickerMode === 'extraction') {
          renderExtractionPickerList(pickerResourcesData);
        } else {
          renderResourcePickerList(pickerResourcesData);
        }
        return;
      }

      try {
        let results = await window.satisfactory.searchResources(query);
        if (resourcePickerMode === 'extraction') {
          const entries = expandItemsForExtractionPicker(results.filter(isExtractionPickerItem));
          const minerals = entries.filter((entry) => entry.extraction_method === 'mineral');
          const liquids = entries.filter((entry) => entry.extraction_method === 'liquid');
          const wells = entries.filter((entry) => entry.extraction_method === 'well');

          if (!entries.length) {
            listEl.innerHTML = `<p class="empty-state">${escapeHtml(t('errors.pickerExtractEmpty'))}</p>`;
          } else {
            const renderGroup = (items, title) => {
              if (!items.length) return '';
              return `
                <section class="picker-category">
                  <h4>${escapeHtml(title)}</h4>
                  <div class="picker-grid">
                    ${items.map(renderExtractionPickerItem).join('')}
                  </div>
                </section>`;
            };

            listEl.innerHTML = [
              renderGroup(minerals, t('production.groupMinerals')),
              renderGroup(liquids, t('production.groupLiquids')),
              renderGroup(wells, t('production.groupWells')),
            ].join('');
          }

          document.getElementById('resource-picker-count').textContent =
            `${formatUiResultsCount(entries.length)}`;
        } else {
          listEl.innerHTML = renderResourcePickerSearchResults(results);
        }
      } catch (err) {
        console.error('Resource picker search error:', err);
      }
    }, 200);
  });

  document.getElementById('schema-picker-modal-close').addEventListener('click', closeSchemaPickerModal);
  schemaPickerModal.addEventListener('click', (e) => {
    if (e.target === schemaPickerModal) closeSchemaPickerModal();
  });

  document.getElementById('schema-picker-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.picker-schema-btn');
    if (!btn || !pendingPickerItemId) return;
    const stepItemId = Number(btn.dataset.itemId) || pendingPickerItemId;
    addProductionStep(stepItemId, Number(btn.dataset.schemaId));
  });

  productionCreateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideProductionCreateError();

    const name = document.getElementById('production-chain-name').value;
    const targets = productionCreateTargets.map((entry) => ({
      item_id: entry.id,
      target_rate: Number(entry.rate),
    }));

    if (targets.length) {
      const invalid = targets.some(
        (entry) => !Number.isFinite(entry.target_rate) || entry.target_rate <= 0
      );
      if (invalid) {
        showProductionCreateError(t('errors.invalidTargetRate'));
        return;
      }
    }

    const submitBtn = productionCreateForm.querySelector('button[type="submit"]');
    const submitLabel = submitBtn?.textContent;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = t('common.loading');
    }

    try {
      const payload = { name };
      if (targets.length) {
        payload.auto_plan = true;
        payload.targets = targets;
        payload.sink_byproducts = document.getElementById('production-create-sink-byproducts')
          ?.checked
          ? 1
          : 0;
      }

      // Close modal first so the UI can show loading instead of looking frozen on Crea.
      if (targets.length) {
        closeProductionCreateModal();
        productionDetailBody.innerHTML = `<section class="card production-detail-main"><p class="loading">${escapeHtml(t('common.loading'))}</p></section>`;
        document.getElementById('production-detail-heading').textContent = name || '—';
        document.getElementById('production-detail-breadcrumb').textContent = name || '—';
        document.getElementById('production-detail-meta').textContent = '';
        document.getElementById('production-detail-external-summary').innerHTML = '';
        switchView('production-detail');
      }

      const chain = await window.satisfactory.createProductionChain(payload);
      productionChains = [chain, ...productionChains.filter((item) => item.id !== chain.id)];
      if (!targets.length) {
        closeProductionCreateModal();
      }
      await loadProductionChainSummaries();
      renderProductionChains();
      if (targets.length) {
        await openProductionDetail(chain.id);
      }
    } catch (err) {
      if (targets.length) {
        switchView('production');
        productionCreateModal.classList.remove('hidden');
        productionCreateModal.setAttribute('aria-hidden', 'false');
      }
      showProductionCreateError(err.message || t('errors.createFailed'));
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        if (submitLabel != null) submitBtn.textContent = submitLabel;
      }
    }
  });
}

