function itemHasSchemas(item) {
  return Number(item.schema_count) > 0;
}

function applySchemaFilter(categories) {
  if (!hideWithoutSchemas) return categories;

  return categories
    .map((cat) => {
      const items = cat.items.filter(itemHasSchemas);
      return { ...cat, items, item_count: items.length };
    })
    .filter((cat) => cat.items.length > 0);
}

function filterItemsList(items) {
  if (!hideWithoutSchemas) return items;
  return items.filter(itemHasSchemas);
}

function renderCategorySidebar(categories) {
  const list = document.getElementById('category-list');
  const visible = applySchemaFilter(categories);
  list.innerHTML = visible
    .map(
      (cat) => `
    <li>
      <button
        type="button"
        class="category-btn ${cat.slug === activeCategory ? 'active' : ''}"
        data-category="${cat.slug}"
      >
        <span class="category-btn-text">
          <span class="category-btn-name">${escapeHtml(cat.name)}</span>
          <span class="category-btn-count">${escapeHtml(
            t(cat.item_count === 1 ? 'resources.itemsCountOne' : 'resources.itemsCountMany', {
              count: formatDisplayInteger(cat.item_count),
            })
          )}</span>
        </span>
      </button>
    </li>`
    )
    .join('');

  list.querySelectorAll('.category-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeCategory = btn.dataset.category;
      renderCategorySidebar(resourcesData);
      renderResources();
      document.getElementById(`cat-${activeCategory}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  });

  if (activeCategory && !visible.some((cat) => cat.slug === activeCategory)) {
    activeCategory = null;
  }
}

function renderItemImage(item) {
  if (item.image) {
    return `<img class="resource-img" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy" />`;
  }
  return `<div class="resource-img resource-img--placeholder"></div>`;
}

function renderItemCard(item) {
  return `
    <article class="resource-card" data-id="${item.id}">
      <button
        type="button"
        class="resource-edit-btn"
        data-id="${item.id}"
        aria-label="${escapeHtml(t('resources.editAria', { name: item.name }))}"
      >${EDIT_ICON}</button>
      ${renderItemImage(item)}
      <div class="resource-info">
        <h4>${escapeHtml(item.name)}</h4>
      </div>
    </article>`;
}

function renderCategorySection(category) {
  if (!category.items.length) return '';

  return `
    <section class="card resource-category" id="cat-${category.slug}">
      <header class="resource-category-header">
        <div>
          <h3>${escapeHtml(category.name)}</h3>
          <span class="resource-category-count">${formatUiResourcesCount(category.items.length)}</span>
        </div>
      </header>
      <div class="resource-grid">
        ${category.items.map(renderItemCard).join('')}
      </div>
    </section>`;
}

function renderSearchResults(items) {
  const container = document.getElementById('resources-container');
  const countEl = document.getElementById('search-count');
  const filtered = filterItemsList(items);

  if (!filtered.length) {
    container.innerHTML = `<p class="empty-state">${escapeHtml(t('resources.emptySearch'))}</p>`;
    countEl.textContent = formatUiResultsCount(0);
    return;
  }

  countEl.textContent = formatUiResultsCount(filtered.length);

  const grouped = filtered.reduce((acc, item) => {
    const key = item.category;
    if (!acc[key]) {
      acc[key] = { slug: key, name: item.category_name, items: [] };
    }
    acc[key].items.push(item);
    return acc;
  }, {});

  container.innerHTML = Object.values(grouped).map(renderCategorySection).join('');
}

function renderResources() {
  const container = document.getElementById('resources-container');
  const countEl = document.getElementById('search-count');
  countEl.textContent = '';
  isSearchActive = false;

  let categories = applySchemaFilter(resourcesData);

  if (activeCategory) {
    categories = categories.filter((c) => c.slug === activeCategory);
  }

  const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0);

  if (!totalItems) {
    container.innerHTML = `<p class="empty-state">${escapeHtml(t('resources.emptyCategory'))}</p>`;
    return;
  }

  container.innerHTML = categories.map(renderCategorySection).join('');
}

async function refreshResourcesView() {
  resourcesData = await window.satisfactory.getResources();
  categoryOptions = await window.satisfactory.getResourceCategories();
  renderCategorySidebar(resourcesData);

  const searchQuery = document.getElementById('resource-search').value.trim();
  if (searchQuery) {
    isSearchActive = true;
    const results = await window.satisfactory.searchResources(searchQuery);
    renderSearchResults(results);
  } else {
    renderResources();
  }
}

async function loadResources() {
  const container = document.getElementById('resources-container');
  container.innerHTML = `<p class="loading">${escapeHtml(t('common.loadingResources'))}</p>`;

  try {
    await refreshResourcesView();
  } catch (err) {
    container.innerHTML = `<p class="empty-state">${escapeHtml(t('resources.errorLoad'))}</p>`;
    console.error('Resources load error:', err);
  }
}

