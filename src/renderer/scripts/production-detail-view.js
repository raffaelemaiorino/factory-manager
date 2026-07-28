function renderProductionDetailContent(detail) {
  cleanupProductionDragArtifacts();
  disposeProductionGraph();

  if (!detail?.chain) {
    productionDetailBody.innerHTML = `<p class="detail-empty">${escapeHtml(t('production.notFound'))}</p>`;
    document.getElementById('production-detail-external-summary').innerHTML = '';
    return;
  }

  const extractions = detail.extractions ?? [];
  const steps = detail.steps ?? [];

  document.getElementById('production-detail-heading').textContent = detail.chain.name;
  document.getElementById('production-detail-breadcrumb').textContent = detail.chain.name;
  document.getElementById('production-detail-meta').textContent = formatProductionDetailMeta(
    extractions.length,
    steps.length
  );
  updateProductionDetailExternalSummary();
  updateProductionGroupTreeButtonVisibility(detail);
  updateProductionTreeButtonState();

  if (isProductionTreeViewMode()) {
    syncChainResourceBalanceCache();
    productionGraphHandle = window.ProductionGraph.renderProductionGraph(
      productionDetailBody,
      detail,
      getProductionGraphHelpers(detail),
      {
        collapseGroups: productionDetailViewMode === 'group-tree',
        groupKey: productionDetailViewMode === 'tree' ? productionTreeGroupKey : null,
        groupLabel:
          productionDetailViewMode === 'tree' && productionTreeGroupKey
            ? getProductionGroupLabel(productionTreeGroupKey)
            : null,
      }
    );
    return;
  }

  const extractionsHtml = renderProductionExtractionsList(extractions, steps);

  const stepsHtml = renderProductionStepsList(steps, steps, detail.group_marks ?? {});

  productionDetailBody.innerHTML = `
    <div class="production-detail-columns">
      <section class="production-extractions-section">
        <h3 class="production-section-header">${escapeHtml(t('production.sectionExtractions'))}</h3>
        ${extractionsHtml}
      </section>
      <section class="production-schemas-section">
        <div class="production-section-header-row">
          <h3 class="production-section-header">${escapeHtml(t('production.sectionResourceSteps'))}</h3>
          <p class="production-group-reorder-hint" hidden>
            ${escapeHtml(t('production.groupReorderHint'))}
          </p>
        </div>
        ${stepsHtml}
      </section>
    </div>`;

  lockConfigNumberInputsIn(productionDetailBody);
  lockConfigSlidersIn(productionDetailBody);
  applyAllProductionGroupViewStates();
  applyAllProductionStepViewStates();
}

function moveProductionGroupAtPointer(movingEl, list, clientY) {
  const without = [...list.querySelectorAll('.production-step-group, .production-step-group-placeholder')].filter(
    (el) => el !== movingEl
  );

  for (const target of without) {
    const rect = target.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      if (movingEl !== target && movingEl.nextElementSibling !== target) {
        list.insertBefore(movingEl, target);
      }
      return target;
    }
  }

  const last = without[without.length - 1];
  if (last && movingEl !== last.nextElementSibling) {
    list.appendChild(movingEl);
  }
  return last ?? null;
}

function updateProductionGroupDropTarget(list, movingEl, clientY) {
  list.querySelectorAll('.production-step-group, .production-step-group-placeholder').forEach((el) => {
    el.classList.remove('production-step-group--drop-target', 'production-step-group--drop-after');
  });

  const without = [...list.querySelectorAll('.production-step-group, .production-step-group-placeholder')].filter(
    (el) => el !== movingEl
  );

  for (const target of without) {
    if (!target.classList.contains('production-step-group')) continue;
    const rect = target.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      target.classList.add('production-step-group--drop-target');
      return;
    }
  }

  const lastGroup = [...without].reverse().find((el) => el.classList.contains('production-step-group'));
  if (lastGroup) {
    lastGroup.classList.add('production-step-group--drop-target', 'production-step-group--drop-after');
  }
}

function startProductionGroupDrag(groupEl, list, handle, e) {
  const rect = groupEl.getBoundingClientRect();

  const placeholder = document.createElement('div');
  placeholder.className = 'production-step-group-placeholder';
  placeholder.style.height = `${rect.height}px`;
  list.insertBefore(placeholder, groupEl);

  const clone = groupEl.cloneNode(true);
  clone.classList.add('production-step-group-clone');
  clone.setAttribute('aria-hidden', 'true');
  clone.style.width = `${rect.width}px`;
  clone.style.left = `${rect.left}px`;
  clone.style.top = `${rect.top}px`;
  document.body.appendChild(clone);

  groupEl.classList.add('production-step-group--drag-hidden');

  productionGroupDragState = {
    groupEl,
    list,
    handle,
    placeholder,
    clone,
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    didMove: false,
  };

  document.body.classList.add('production-step-drag-active');
  handle.setPointerCapture(e.pointerId);
}

function updateProductionGroupDrag(e) {
  if (!productionGroupDragState || productionGroupDragState.pointerId !== e.pointerId) return;

  const { clone, placeholder, list, startX, startY } = productionGroupDragState;
  const deltaX = e.clientX - startX;
  const deltaY = e.clientY - startY;

  if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
    productionGroupDragState.didMove = true;
  }

  clone.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
  moveProductionGroupAtPointer(placeholder, list, e.clientY);
  updateProductionGroupDropTarget(list, placeholder, e.clientY);
}

async function saveProductionGroupOrder(list) {
  const groupKeys = [...list.querySelectorAll('.production-step-group')].map(
    (el) => el.dataset.groupKey
  );
  if (!activeProductionChainId || groupKeys.length < 2) return;

  try {
    activeProductionDetail = await window.satisfactory.reorderProductionChainGroups(
      activeProductionChainId,
      groupKeys
    );
  } catch (err) {
    console.error('Reorder production groups error:', err);
    await refreshProductionDetail();
  }
}

function moveProductionStepAtPointer(movingEl, list, clientY) {
  const without = [...list.querySelectorAll('.production-step, .production-step-placeholder')].filter(
    (el) => el !== movingEl
  );

  for (const target of without) {
    const rect = target.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      if (movingEl !== target && movingEl.nextElementSibling !== target) {
        list.insertBefore(movingEl, target);
      }
      return target;
    }
  }

  const last = without[without.length - 1];
  if (last && movingEl !== last.nextElementSibling) {
    list.appendChild(movingEl);
  }
  return last ?? null;
}

function updateProductionDropTarget(list, movingEl, clientY) {
  list.querySelectorAll('.production-step, .production-step-placeholder').forEach((el) => {
    el.classList.remove('production-step--drop-target', 'production-step--drop-after');
  });

  const without = [...list.querySelectorAll('.production-step, .production-step-placeholder')].filter(
    (el) => el !== movingEl
  );

  for (const target of without) {
    if (!target.classList.contains('production-step')) continue;
    const rect = target.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      target.classList.add('production-step--drop-target');
      return;
    }
  }

  const lastStep = [...without].reverse().find((el) => el.classList.contains('production-step'));
  if (lastStep) {
    lastStep.classList.add('production-step--drop-target', 'production-step--drop-after');
  }
}

function startProductionStepDrag(stepEl, list, handle, e) {
  const rect = stepEl.getBoundingClientRect();

  const placeholder = document.createElement('div');
  placeholder.className = 'production-step-placeholder';
  placeholder.style.height = `${rect.height}px`;
  list.insertBefore(placeholder, stepEl);

  const clone = stepEl.cloneNode(true);
  clone.classList.add('production-step-clone');
  clone.setAttribute('aria-hidden', 'true');
  clone.style.width = `${rect.width}px`;
  clone.style.left = `${rect.left}px`;
  clone.style.top = `${rect.top}px`;
  document.body.appendChild(clone);

  stepEl.classList.add('production-step--drag-hidden');

  productionStepDragState = {
    stepEl,
    list,
    handle,
    placeholder,
    clone,
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    didMove: false,
  };

  document.body.classList.add('production-step-drag-active');
  handle.setPointerCapture(e.pointerId);
}

function updateProductionStepDrag(e) {
  if (!productionStepDragState || productionStepDragState.pointerId !== e.pointerId) return;

  const { clone, placeholder, list, startX, startY } = productionStepDragState;
  const deltaX = e.clientX - startX;
  const deltaY = e.clientY - startY;

  if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
    productionStepDragState.didMove = true;
  }

  clone.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
  moveProductionStepAtPointer(placeholder, list, e.clientY);
  updateProductionDropTarget(list, placeholder, e.clientY);
}

async function saveProductionStepOrder(list) {
  const groupEl = list.closest('.production-step-group');
  const groupKey =
    groupEl?.dataset.groupKey ??
    list.dataset.groupKey ??
    PRODUCTION_GROUP_KEY_UNGROUPED;
  const groupName = groupKey === PRODUCTION_GROUP_KEY_UNGROUPED ? null : groupKey;

  const stepIds = [...list.querySelectorAll('.production-step')].map((el) =>
    Number(el.dataset.stepId)
  );
  if (!activeProductionChainId || !stepIds.length) return;

  try {
    activeProductionDetail = await window.satisfactory.reorderProductionChainStepsInGroup(
      activeProductionChainId,
      groupName,
      stepIds
    );
    activeProductionDetail.steps.forEach((step) => {
      const el = list.querySelector(`.production-step[data-step-id="${step.id}"]`);
      if (el) el.dataset.sortOrder = step.sort_order;
    });
  } catch (err) {
    console.error('Reorder production steps error:', err);
    await refreshProductionDetail();
  }
}

async function handleProductionStepGroupRename(groupKey, newName) {
  if (!activeProductionChainId || !groupKey) return;

  const normalizedNew = normalizeProductionGroupName(newName);
  if (!normalizedNew) {
    throw new Error(t('errors.groupNameRequired'));
  }

  activeProductionDetail = await window.satisfactory.renameProductionStepGroup(
    activeProductionChainId,
    groupKey,
    normalizedNew
  );
  migrateProductionGroupPersistedKeys(activeProductionChainId, groupKey, normalizedNew);
  renderProductionDetailContent(activeProductionDetail);
}

async function handleProductionStepGroupChange(stepId, value) {
  if (value === '__new__') {
    openSchemaRenameModal({
      kind: 'step-group',
      id: stepId,
      name: '',
      title: t('confirm.newGroupTitle'),
    });
    return;
  }

  try {
    activeProductionDetail = await window.satisfactory.setProductionStepGroupName(
      stepId,
      value || null
    );
    renderProductionDetailContent(activeProductionDetail);
  } catch (err) {
    console.error('Set production step group error:', err);
  }
}

async function handleStepLinkChange(checkbox) {
  const consumerStepId = Number(checkbox.dataset.consumerStepId);
  const itemSlug = checkbox.dataset.itemSlug;
  const stepEl = getProductionStepElement(consumerStepId);
  if (!stepEl) return;

  const checkboxes = stepEl.querySelectorAll('.production-link-checkbox');
  const producerIds = [...checkboxes]
    .filter((input) => input.dataset.itemSlug === itemSlug && input.checked)
    .map((input) => Number(input.dataset.producerStepId));

  try {
    activeProductionDetail = await window.satisfactory.setProductionStepInputLinks(
      consumerStepId,
      itemSlug,
      producerIds
    );
    renderProductionDetailContent(activeProductionDetail);
  } catch (err) {
    checkbox.checked = !checkbox.checked;
    console.error('Set step links error:', err);
  }
}

async function handleExtractionConsumerLinkChange(checkbox) {
  const consumerStepId = Number(checkbox.dataset.consumerStepId);
  const extractionId = Number(checkbox.dataset.extractionId);
  const itemSlug = checkbox.dataset.itemSlug;

  const consumer = activeProductionDetail?.steps?.find(
    (step) => Number(step.id) === consumerStepId
  );
  const currentIds = (consumer?.input_links?.[itemSlug] ?? [])
    .filter((link) => link.producer_extraction_id)
    .map((link) => Number(link.producer_extraction_id));

  const nextIds = checkbox.checked
    ? [...new Set([...currentIds, extractionId])]
    : currentIds.filter((id) => id !== extractionId);

  try {
    activeProductionDetail = await window.satisfactory.setProductionStepExtractionLinks(
      consumerStepId,
      itemSlug,
      nextIds
    );
    renderProductionDetailContent(activeProductionDetail);
  } catch (err) {
    checkbox.checked = !checkbox.checked;
    console.error('Set extraction consumer links error:', err);
  }
}

async function handleExtractionLinkChange(checkbox) {
  const consumerStepId = Number(checkbox.dataset.consumerStepId);
  const itemSlug = checkbox.dataset.itemSlug;
  const stepEl = getProductionStepElement(consumerStepId);
  if (!stepEl) return;

  const checkboxes = stepEl.querySelectorAll('.production-extraction-link-checkbox');
  const extractionIds = [...checkboxes]
    .filter((input) => input.dataset.itemSlug === itemSlug && input.checked)
    .map((input) => Number(input.dataset.producerExtractionId));

  try {
    activeProductionDetail = await window.satisfactory.setProductionStepExtractionLinks(
      consumerStepId,
      itemSlug,
      extractionIds
    );
    renderProductionDetailContent(activeProductionDetail);
  } catch (err) {
    checkbox.checked = !checkbox.checked;
    console.error('Set extraction links error:', err);
  }
}

async function openProductionDetail(chainId) {
  activeProductionChainId = chainId;
  activeProductionDetail = null;
  productionDetailViewMode = 'editor';
  productionTreeGroupKey = null;
  hydrateProductionUiStateMaps(chainId);
  productionDetailBody.innerHTML = `<p class="loading">${escapeHtml(t('common.loading'))}</p>`;
  document.getElementById('production-detail-heading').textContent = '—';
  document.getElementById('production-detail-breadcrumb').textContent = '—';
  document.getElementById('production-detail-meta').textContent = '';
  document.getElementById('production-detail-external-summary').innerHTML = '';
  switchView('production-detail');

  try {
    if (!pickerResourcesData.length) {
      await ensurePickerResourcesData();
    }
    activeProductionDetail = await window.satisfactory.getProductionChainDetail(chainId);
    renderProductionDetailContent(activeProductionDetail);
  } catch (err) {
    productionDetailBody.innerHTML = `<p class="detail-empty">${escapeHtml(t('production.errorDetailLoad'))}</p>`;
    console.error('Production detail error:', err);
  }
}

function closeProductionDetail() {
  cleanupProductionDragArtifacts();
  disposeProductionGraph();
  persistProductionUiState(activeProductionChainId);
  productionDetailViewMode = 'editor';
  productionTreeGroupKey = null;
  switchView('production');
  loadProductionChainSummaries()
    .then(() => renderProductionChains())
    .catch(console.error);
}

function renderExtractionPickerItem(item) {
  return `
    <button type="button" class="picker-item" data-id="${item.id}">
      ${renderItemImage(item)}
      <span>${escapeHtml(item.name)}</span>
    </button>`;
}

function renderExtractionPickerList(categories) {
  const mineralCategory = categories.find((cat) => cat.slug === 'minerali');
  const liquidiCategory = categories.find((cat) => cat.slug === 'liquidi');
  const mineralItems = mineralCategory?.items ?? [];
  const liquidItems = (liquidiCategory?.items ?? []).filter((item) =>
    EXTRACTION_LIQUID_SLUGS.includes(item.slug)
  );
  const total = mineralItems.length + liquidItems.length;
  const countEl = document.getElementById('resource-picker-count');
  countEl.textContent = formatUiResourcesCount(total);

  if (!total) {
    document.getElementById('resource-picker-list').innerHTML =
      `<p class="empty-state">${escapeHtml(t('errors.pickerExtractEmpty'))}</p>`;
    return;
  }

  const sections = [];

  if (mineralItems.length) {
    sections.push(`
      <section class="picker-category">
        <h4>${escapeHtml(mineralCategory.name)}</h4>
        <div class="picker-grid">
          ${mineralItems.map(renderExtractionPickerItem).join('')}
        </div>
      </section>`);
  }

  if (liquidItems.length) {
    sections.push(`
      <section class="picker-category">
        <h4>${escapeHtml(t('production.groupLiquids'))}</h4>
        <div class="picker-grid">
          ${liquidItems.map(renderExtractionPickerItem).join('')}
        </div>
      </section>`);
  }

  document.getElementById('resource-picker-list').innerHTML = sections.join('');
}

function renderMineralPickerItem(item) {
  return renderExtractionPickerItem(item);
}

function renderMineralPickerList(categories) {
  renderExtractionPickerList(categories);
}

function renderResourcePickerItem(item) {
  const hasSchemas = Number(item.schema_count) > 0;
  return `
    <button
      type="button"
      class="picker-item ${hasSchemas ? '' : 'picker-item--disabled'}"
      data-id="${item.id}"
      ${hasSchemas ? '' : 'disabled'}
    >
      ${renderItemImage(item)}
      <span>${escapeHtml(item.name)}</span>
      ${hasSchemas ? '' : `<span class="picker-item-note">${escapeHtml(t('modals.pickerNoSchema'))}</span>`}
    </button>`;
}

function renderResourcePickerCategories(categories) {
  const countEl = document.getElementById('resource-picker-count');
  const total = categories.reduce((sum, cat) => sum + cat.items.length, 0);
  countEl.textContent = `${total} risorse`;

  if (!total) {
    return `<p class="empty-state">${escapeHtml(t('picker.noResources'))}</p>`;
  }

  return categories
    .filter((cat) => cat.items.length)
    .map(
      (cat) => `
      <section class="picker-category">
        <h4>${escapeHtml(cat.name)}</h4>
        <div class="picker-grid">
          ${cat.items.map(renderResourcePickerItem).join('')}
        </div>
      </section>`
    )
    .join('');
}

function renderResourcePickerSearchResults(items) {
  const countEl = document.getElementById('resource-picker-count');
  countEl.textContent = formatUiResultsCount(items.length);

  if (!items.length) {
    return `<p class="empty-state">${escapeHtml(t('picker.noResources'))}</p>`;
  }

  const grouped = items.reduce((acc, item) => {
    const key = item.category;
    if (!acc[key]) {
      acc[key] = { name: item.category_name || key, items: [] };
    }
    acc[key].items.push(item);
    return acc;
  }, {});

  return Object.values(grouped)
    .map(
      (cat) => `
      <section class="picker-category">
        <h4>${escapeHtml(cat.name)}</h4>
        <div class="picker-grid">
          ${cat.items.map(renderResourcePickerItem).join('')}
        </div>
      </section>`
    )
    .join('');
}

function renderMineralPickerList(categories) {
  renderExtractionPickerList(categories);
}

function renderResourcePickerList(categories) {
  if (resourcePickerMode === 'extraction') {
    renderExtractionPickerList(categories);
    return;
  }

  document.getElementById('resource-picker-list').innerHTML =
    renderResourcePickerCategories(categories);
}

async function openExtractionPickerModal() {
  resourcePickerMode = 'extraction';
  document.getElementById('resource-picker-modal-title').textContent = t('modals.selectResourceExtract');
  document.getElementById('resource-picker-search').value = '';
  document.getElementById('resource-picker-count').textContent = '';
  document.getElementById('resource-picker-list').innerHTML =
    `<p class="loading">${escapeHtml(t('common.loadingResources'))}</p>`;
  resourcePickerModal.classList.remove('hidden');
  resourcePickerModal.setAttribute('aria-hidden', 'false');

  try {
    if (!pickerResourcesData.length) {
      pickerResourcesData = await window.satisfactory.getResources();
    }
    renderExtractionPickerList(pickerResourcesData);
    document.getElementById('resource-picker-search').focus();
  } catch (err) {
    document.getElementById('resource-picker-list').innerHTML =
      `<p class="empty-state">${escapeHtml(t('resources.errorLoad'))}</p>`;
    console.error('Extraction picker load error:', err);
  }
}

async function openMineralPickerModal() {
  openExtractionPickerModal();
}

async function openResourcePickerModal() {
  pendingInsertAfterStepId = null;
  resourcePickerMode = 'step';
  document.getElementById('resource-picker-modal-title').textContent = t('modals.selectResource');
  document.getElementById('resource-picker-search').value = '';
  document.getElementById('resource-picker-count').textContent = '';
  document.getElementById('resource-picker-list').innerHTML =
    `<p class="loading">${escapeHtml(t('common.loadingResources'))}</p>`;
  resourcePickerModal.classList.remove('hidden');
  resourcePickerModal.setAttribute('aria-hidden', 'false');

  try {
    if (!pickerResourcesData.length) {
      pickerResourcesData = await window.satisfactory.getResources();
    }
    renderResourcePickerList(pickerResourcesData);
    document.getElementById('resource-picker-search').focus();
  } catch (err) {
    document.getElementById('resource-picker-list').innerHTML =
      `<p class="empty-state">${escapeHtml(t('resources.errorLoad'))}</p>`;
    console.error('Resource picker load error:', err);
  }
}

function closeResourcePickerModal() {
  resourcePickerModal.classList.add('hidden');
  resourcePickerModal.setAttribute('aria-hidden', 'true');
  pendingPickerItemId = null;
  resourcePickerMode = 'step';
}

function renderSelectableCraftSchema(schema) {
  return `
    <button type="button" class="picker-schema-btn" data-schema-id="${schema.id}">
      ${renderCraftSchema(schema, schema.is_alternative, { compact: true })}
    </button>`;
}

function openSchemaPickerModal(item, schemas) {
  pendingPickerItemId = item.id;
  document.getElementById('schema-picker-modal-title').textContent = t('modals.selectSchemaFor', {
    name: item.name,
  });
  document.getElementById('schema-picker-item-meta').textContent = t('modals.selectSchemaAltHint');

  const imgEl = document.getElementById('schema-picker-item-image');
  if (item.image) {
    imgEl.src = item.image;
    imgEl.alt = item.name;
    imgEl.hidden = false;
  } else {
    imgEl.hidden = true;
  }

  document.getElementById('schema-picker-list').innerHTML = schemas
    .map(renderSelectableCraftSchema)
    .join('');
  schemaPickerModal.classList.remove('hidden');
  schemaPickerModal.setAttribute('aria-hidden', 'false');
}

function closeSchemaPickerModal() {
  schemaPickerModal.classList.add('hidden');
  schemaPickerModal.setAttribute('aria-hidden', 'true');
  pendingPickerItemId = null;
  pendingInsertAfterStepId = null;
}

async function refreshProductionDetail() {
  if (!activeProductionChainId) return;

  try {
    activeProductionDetail = await window.satisfactory.getProductionChainDetail(
      activeProductionChainId
    );
    renderProductionDetailContent(activeProductionDetail);
  } catch (err) {
    // Several callers invoke this as a bare recovery step from inside their
    // own catch block (e.g. after a failed reorder) - without this try/catch,
    // a second failure here would be an unhandled rejection.
    console.error('Refresh production detail error:', err);
  }
}

async function addProductionStep(itemId, schemaId) {
  if (!activeProductionChainId) return;

  const insertAfterStepId = pendingInsertAfterStepId;
  pendingInsertAfterStepId = null;
  const sourceStep = insertAfterStepId
    ? activeProductionDetail?.steps?.find((step) => step.id === insertAfterStepId)
    : null;

  try {
    const newStep = await window.satisfactory.addProductionChainStep(activeProductionChainId, {
      item_id: itemId,
      item_schema_id: schemaId,
      group_name: sourceStep?.group_name ?? null,
    });

    if (insertAfterStepId && newStep?.id && activeProductionDetail?.steps?.length) {
      const currentIds = activeProductionDetail.steps.map((step) => step.id);
      const insertIndex = currentIds.indexOf(insertAfterStepId);
      if (insertIndex >= 0) {
        const newOrder = [
          ...currentIds.slice(0, insertIndex + 1),
          newStep.id,
          ...currentIds.slice(insertIndex + 1),
        ];
        await window.satisfactory.reorderProductionChainSteps(activeProductionChainId, newOrder);
      }
    }

    closeSchemaPickerModal();
    closeResourcePickerModal();
    await refreshProductionDetail();
  } catch (err) {
    console.error('Add production step error:', err);
  }
}

async function handleResourceSelection(itemId) {
  if (resourcePickerMode === 'extraction') {
    await addMineralExtractionFromPicker(itemId);
    return;
  }

  try {
    await addProductionStepForItem(itemId);
  } catch (err) {
    console.error('Resource selection error:', err);
  }
}

async function loadProductionChains() {
  const container = document.getElementById('production-container');
  container.innerHTML = `<p class="loading">${escapeHtml(t('common.loadingSchemas'))}</p>`;

  try {
    productionChains = await window.satisfactory.getProductionChains();
    await loadProductionChainSummaries();
    renderProductionChains();
  } catch (err) {
    container.innerHTML =
      `<p class="empty-state">${escapeHtml(t('production.errorLoadList'))}</p>`;
    console.error('Production load error:', err);
  }
}

function showProductionCreateError(message) {
  productionCreateError.textContent = message;
  productionCreateError.classList.remove('hidden');
}

function hideProductionCreateError() {
  productionCreateError.textContent = '';
  productionCreateError.classList.add('hidden');
}

function openProductionCreateModal() {
  hideProductionCreateError();
  productionCreateForm.reset();
  productionCreateModal.classList.remove('hidden');
  productionCreateModal.setAttribute('aria-hidden', 'false');
  document.getElementById('production-chain-name').focus();
}

function closeProductionCreateModal() {
  productionCreateModal.classList.add('hidden');
  productionCreateModal.setAttribute('aria-hidden', 'true');
  hideProductionCreateError();
}

function showSchemaRenameError(message) {
  schemaRenameError.textContent = message;
  schemaRenameError.classList.remove('hidden');
}

function hideSchemaRenameError() {
  schemaRenameError.textContent = '';
  schemaRenameError.classList.add('hidden');
}

function openSchemaRenameModal({ kind, id, name, title, onSaved, groupKey }) {
  hideSchemaRenameError();
  document.getElementById('schema-rename-id').value = String(id);
  document.getElementById('schema-rename-kind').value = kind;
  document.getElementById('schema-rename-name').value = name ?? '';
  document.getElementById('schema-rename-modal-title').textContent =
    title ??
    (kind === 'energy'
      ? t('modals.renameEnergyPlan')
      : kind === 'step-group' || kind === 'rename-step-group'
        ? t('modals.renameGroup')
        : t('modals.renameProductionPlan'));
  schemaRenameOnSaved = typeof onSaved === 'function' ? onSaved : null;
  schemaRenameGroupKey = groupKey ?? null;
  schemaRenameModal.classList.remove('hidden');
  schemaRenameModal.setAttribute('aria-hidden', 'false');
  document.getElementById('schema-rename-name').focus();
  document.getElementById('schema-rename-name').select();
}

function closeSchemaRenameModal() {
  schemaRenameModal.classList.add('hidden');
  schemaRenameModal.setAttribute('aria-hidden', 'true');
  hideSchemaRenameError();
  schemaRenameOnSaved = null;
  schemaRenameGroupKey = null;
}

function setupSchemaRenameModal() {
  document.getElementById('schema-rename-modal-close').addEventListener('click', closeSchemaRenameModal);
  document.getElementById('schema-rename-cancel').addEventListener('click', closeSchemaRenameModal);
  schemaRenameModal.addEventListener('click', (e) => {
    if (e.target === schemaRenameModal) closeSchemaRenameModal();
  });

  schemaRenameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideSchemaRenameError();

    const kind = document.getElementById('schema-rename-kind').value;
    const id = Number(document.getElementById('schema-rename-id').value);
    const name = document.getElementById('schema-rename-name').value.trim();
    if (!name) {
      showSchemaRenameError(t('errors.nameRequired'));
      return;
    }

    try {
      if (kind === 'step-group') {
        activeProductionDetail = await window.satisfactory.setProductionStepGroupName(id, name);
        renderProductionDetailContent(activeProductionDetail);
        schemaRenameOnSaved?.(activeProductionDetail);
        closeSchemaRenameModal();
        return;
      }

      if (kind === 'rename-step-group') {
        await handleProductionStepGroupRename(schemaRenameGroupKey, name);
        schemaRenameOnSaved?.(activeProductionDetail);
        closeSchemaRenameModal();
        return;
      }

      const updated =
        kind === 'energy'
          ? await window.satisfactory.updateEnergyChain(id, { name })
          : await window.satisfactory.updateProductionChain(id, { name });
      schemaRenameOnSaved?.(updated);
      closeSchemaRenameModal();
    } catch (err) {
      showSchemaRenameError(err.message || t('errors.saveFailed'));
    }
  });
}

window.openSchemaRenameModal = openSchemaRenameModal;

function setupProductionUiStatePersistence() {
  const flushProductionUiState = () => {
    persistProductionUiState(activeProductionChainId);
  };

  window.addEventListener('beforeunload', flushProductionUiState);
  window.addEventListener('pagehide', flushProductionUiState);
}

