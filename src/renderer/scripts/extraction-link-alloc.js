(function () {
  const DEFAULT_TOLERANCE = 0.05;

  function defaultRound(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 1000) / 1000;
  }

  /**
   * Consumers filled in sort_order; each waterfills residual demand onto linked
   * extractions (largest remaining capacity first).
   */
  function buildExtractionAllocationTable({
    itemSlug,
    steps,
    extractions,
    getStepInputRate,
    getExtractionOutputRate,
    getProducerCoveredRate,
    tolerance = DEFAULT_TOLERANCE,
    round = defaultRound,
  }) {
    const table = new Map();
    if (!itemSlug) return table;

    const remaining = new Map();
    for (const extraction of extractions || []) {
      if (extraction?.item?.slug !== itemSlug) continue;
      const id = Number(extraction.id);
      const rate = Number(getExtractionOutputRate(extraction)) || 0;
      if (!(rate > 0)) continue;
      remaining.set(id, rate);
      table.set(id, new Map());
    }

    if (remaining.size === 0) return table;

    const consumers = (steps || [])
      .filter((step) =>
        (step.input_links?.[itemSlug] ?? []).some(
          (link) =>
            link.producer_extraction_id != null &&
            remaining.has(Number(link.producer_extraction_id))
        )
      )
      .sort(
        (left, right) =>
          (left.sort_order ?? 0) - (right.sort_order ?? 0) || Number(left.id) - Number(right.id)
      );

    for (const consumer of consumers) {
      const required = Number(getStepInputRate(consumer, itemSlug)) || 0;
      const producerCovered = getProducerCoveredRate
        ? Number(getProducerCoveredRate(consumer, itemSlug)) || 0
        : 0;
      let need = round(Math.max(0, required - producerCovered));

      const linkedIds = [
        ...new Set(
          (consumer.input_links?.[itemSlug] ?? [])
            .filter(
              (link) =>
                link.producer_extraction_id != null &&
                remaining.has(Number(link.producer_extraction_id))
            )
            .map((link) => Number(link.producer_extraction_id))
        ),
      ];

      const ordered = linkedIds
        .map((id) => ({ id, capacity: remaining.get(id) || 0 }))
        .sort((a, b) => b.capacity - a.capacity || a.id - b.id);

      for (const entry of ordered) {
        const consumerAlloc = table.get(entry.id) ?? new Map();
        table.set(entry.id, consumerAlloc);

        if (!(need > tolerance)) {
          if (!consumerAlloc.has(consumer.id)) consumerAlloc.set(consumer.id, 0);
          continue;
        }

        const cap = remaining.get(entry.id) || 0;
        const take = round(Math.min(cap, need));
        consumerAlloc.set(consumer.id, take);
        if (take > 0) {
          remaining.set(entry.id, round(Math.max(0, cap - take)));
          need = round(Math.max(0, need - take));
        }
      }
    }

    return table;
  }

  window.ExtractionLinkAlloc = {
    buildExtractionAllocationTable,
    DEFAULT_TOLERANCE,
  };
})();
