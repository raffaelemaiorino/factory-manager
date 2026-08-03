const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { buildExtractionAllocationTable } = require('../src/database/extraction-link-alloc');

function rateFor(step) {
  const io = (step.scaled_inputs ?? []).find((input) => input.item_slug === 'raw-quartz');
  return io ? Number(io.amount) : 0;
}

function outputOf(extraction) {
  return Number(extraction.output_rate) || 0;
}

describe('extraction-link-alloc', () => {
  it('splits 960+1200 across Caterium 1800 and Silica 360 (user quartz case)', () => {
    const quartz1 = {
      id: 1,
      item: { slug: 'raw-quartz', name: 'Quarzo grezzo' },
      output_rate: 960,
    };
    const quartz2 = {
      id: 2,
      item: { slug: 'raw-quartz', name: 'Quarzo grezzo' },
      output_rate: 1200,
    };
    const caterium = {
      id: 10,
      name: 'Minerale di Caterium (quarzo) #1',
      sort_order: 0,
      scaled_inputs: [{ item_slug: 'raw-quartz', amount: 1800 }],
      input_links: {
        'raw-quartz': [
          { producer_extraction_id: 1 },
          { producer_extraction_id: 2 },
        ],
      },
    };
    const silica = {
      id: 11,
      name: 'Silice #1',
      sort_order: 1,
      scaled_inputs: [{ item_slug: 'raw-quartz', amount: 360 }],
      input_links: {
        'raw-quartz': [{ producer_extraction_id: 1 }],
      },
    };

    const table = buildExtractionAllocationTable({
      itemSlug: 'raw-quartz',
      steps: [caterium, silica],
      extractions: [quartz1, quartz2],
      getStepInputRate: rateFor,
      getExtractionOutputRate: outputOf,
    });

    assert.equal(table.get(2).get(10), 1200);
    assert.equal(table.get(1).get(10), 600);
    assert.equal(table.get(1).get(11), 360);
  });

  it('still works when Silica is ordered before Caterium', () => {
    const quartz1 = { id: 1, item: { slug: 'raw-quartz' }, output_rate: 960 };
    const quartz2 = { id: 2, item: { slug: 'raw-quartz' }, output_rate: 1200 };
    const silica = {
      id: 11,
      sort_order: 0,
      scaled_inputs: [{ item_slug: 'raw-quartz', amount: 360 }],
      input_links: { 'raw-quartz': [{ producer_extraction_id: 1 }] },
    };
    const caterium = {
      id: 10,
      sort_order: 1,
      scaled_inputs: [{ item_slug: 'raw-quartz', amount: 1800 }],
      input_links: {
        'raw-quartz': [
          { producer_extraction_id: 1 },
          { producer_extraction_id: 2 },
        ],
      },
    };

    const table = buildExtractionAllocationTable({
      itemSlug: 'raw-quartz',
      steps: [caterium, silica],
      extractions: [quartz1, quartz2],
      getStepInputRate: rateFor,
      getExtractionOutputRate: outputOf,
    });

    assert.equal(table.get(1).get(11), 360);
    assert.equal(table.get(1).get(10), 600);
    assert.equal(table.get(2).get(10), 1200);
  });

  it('subtracts production-step coverage before filling from extractions', () => {
    const quartz1 = { id: 1, item: { slug: 'raw-quartz' }, output_rate: 960 };
    const consumer = {
      id: 10,
      sort_order: 0,
      scaled_inputs: [{ item_slug: 'raw-quartz', amount: 1800 }],
      input_links: {
        'raw-quartz': [{ producer_extraction_id: 1 }, { producer_step_id: 99 }],
      },
    };

    const table = buildExtractionAllocationTable({
      itemSlug: 'raw-quartz',
      steps: [consumer],
      extractions: [quartz1],
      getStepInputRate: rateFor,
      getExtractionOutputRate: outputOf,
      getProducerCoveredRate: () => 1200,
    });

    assert.equal(table.get(1).get(10), 600);
  });
});
