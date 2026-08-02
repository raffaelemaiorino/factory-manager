/**
 * Floating draggable modals — same idea as the calculator panel:
 * light click-through backdrop, drag by header so content underneath stays readable.
 */
(function () {
  const EDGE = 8;
  let zCounter = 1100;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function classListHas(classAttr, token) {
    if (!classAttr) return false;
    return classAttr.split(/\s+/).includes(token);
  }

  function getDialog(overlay) {
    return overlay?.querySelector?.(':scope > .modal') || null;
  }

  function clearPosition(dialog) {
    if (!dialog) return;
    dialog.style.left = '';
    dialog.style.top = '';
    dialog.style.right = '';
    dialog.style.bottom = '';
    dialog.style.transform = '';
  }

  function applyPosition(dialog, left, top) {
    if (!dialog) return;
    const rect = dialog.getBoundingClientRect();
    const maxLeft = Math.max(EDGE, window.innerWidth - rect.width - EDGE);
    const maxTop = Math.max(EDGE, window.innerHeight - rect.height - EDGE);
    dialog.style.left = `${clamp(left, EDGE, maxLeft)}px`;
    dialog.style.top = `${clamp(top, EDGE, maxTop)}px`;
    dialog.style.right = 'auto';
    dialog.style.bottom = 'auto';
    dialog.style.transform = 'none';
  }

  function centerDialog(dialog) {
    if (!dialog) return;
    // Force layout with current size, then center in the viewport.
    dialog.style.left = '0px';
    dialog.style.top = '0px';
    dialog.style.transform = 'none';
    const rect = dialog.getBoundingClientRect();
    const left = (window.innerWidth - rect.width) / 2;
    const top = (window.innerHeight - rect.height) / 2;
    applyPosition(dialog, left, top);
  }

  function bringToFront(overlay, dialog) {
    zCounter += 1;
    overlay.style.zIndex = String(zCounter);
    dialog.style.zIndex = String(zCounter + 1);
  }

  function setupDrag(overlay, dialog, header) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;

    function onPointerMove(e) {
      if (!dragging) return;
      applyPosition(dialog, originLeft + (e.clientX - startX), originTop + (e.clientY - startY));
    }

    function onPointerUp(e) {
      if (!dragging) return;
      dragging = false;
      header.releasePointerCapture?.(e.pointerId);
      header.classList.remove('is-dragging');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    }

    function onPointerDown(e) {
      if (e.button != null && e.button !== 0) return;
      if (e.target.closest('button, a, input, select, textarea, label')) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = dialog.getBoundingClientRect();
      originLeft = rect.left;
      originTop = rect.top;
      bringToFront(overlay, dialog);
      header.classList.add('is-dragging');
      header.setPointerCapture?.(e.pointerId);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
      e.preventDefault();
    }

    header.addEventListener('pointerdown', onPointerDown);
  }

  function setupFloatingOverlay(overlay) {
    if (overlay.dataset.floatingModalReady === '1') return;
    const dialog = getDialog(overlay);
    const header = dialog?.querySelector('.modal-header');
    if (!dialog || !header) return;

    overlay.dataset.floatingModalReady = '1';
    header.classList.add('modal-header--draggable');
    setupDrag(overlay, dialog, header);

    const onHiddenChange = (isHidden) => {
      if (isHidden) {
        clearPosition(dialog);
        return;
      }
      bringToFront(overlay, dialog);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => centerDialog(dialog));
      });
    };

    // Only re-center when the overlay opens/closes — not on other class toggles.
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName !== 'class') continue;
        const wasHidden = classListHas(mutation.oldValue, 'hidden');
        const isHidden = overlay.classList.contains('hidden');
        if (wasHidden === isHidden) continue;
        onHiddenChange(isHidden);
        break;
      }
    });
    observer.observe(overlay, {
      attributes: true,
      attributeFilter: ['class'],
      attributeOldValue: true,
    });

    if (!overlay.classList.contains('hidden')) onHiddenChange(false);
  }

  function setupFloatingModals() {
    document.querySelectorAll('.modal-overlay').forEach(setupFloatingOverlay);
  }

  window.setupFloatingModals = setupFloatingModals;
})();
