const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  applyExtractionChange,
  computeNodesForTargetOutput,
  computeMaxExtractionOutput,
  WATER_PUMP_BASE_RATE,
} = require('../src/database/extraction-scale');

describe('extraction-scale output auto-bump', () => {
  const waterItem = { slug: 'water', category: 'fluids', name: 'Acqua' };

  it('bumps water extractors (prefer even) when output exceeds max at 250%', () => {
    // 120 × 2.5 = 300 m³/min per extractor → 225000 / 300 = 750
    assert.equal(computeNodesForTargetOutput(225000, WATER_PUMP_BASE_RATE), 750);

    const resolved = applyExtractionChange(
      waterItem,
      {
        miner_slug: 'water-pump',
        purity: 'normal',
        node_count: 1,
        overclock: 100,
        target_output: 120,
      },
      'output',
      225000
    );

    assert.ok(resolved);
    assert.equal(resolved.node_count, 750);
    assert.ok(Math.abs(resolved.target_output - 225000) < 0.05);
    assert.ok(resolved.overclock <= 250 + 1e-9);
    assert.ok(
      computeMaxExtractionOutput(WATER_PUMP_BASE_RATE, resolved.node_count) + 1e-9 >=
        resolved.target_output
    );
  });

  it('prefers even node counts for odd requirements', () => {
    // 301 / 300 → ceil 2 (already even via prefer-even from 1.003…)
    const nodes = computeNodesForTargetOutput(301, WATER_PUMP_BASE_RATE);
    assert.equal(nodes % 2, 0);
    assert.ok(nodes >= 2);
  });

  it('keeps current nodes when output fits under 250%', () => {
    const resolved = applyExtractionChange(
      waterItem,
      {
        miner_slug: 'water-pump',
        purity: 'normal',
        node_count: 10,
        overclock: 100,
        target_output: 1200,
      },
      'output',
      2400
    );
    // max at 10 nodes = 3000, so no bump
    assert.equal(resolved.node_count, 10);
    assert.ok(Math.abs(resolved.target_output - 2400) < 0.05);
  });
});
