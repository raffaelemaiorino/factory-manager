const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const {
  autoPlanProductionChain,
} = require('../src/database/auto-plan');
const {
  createProductionChain,
  updateProductionChain,
  getProductionChainDetail,
} = require('../src/database/production-chains');
const {
  getSharedTestDatabase,
  findItemBySlug,
  getItemById,
} = require('./helpers/test-db');

function stepByItemSlug(detail, slug) {
  return (detail.steps || []).find((s) => s.item?.slug === slug);
}

function extractionByItemSlug(detail, slug) {
  return (detail.extractions || []).find((e) => e.item?.slug === slug);
}

function assertNoSelfLinks(detail) {
  for (const step of detail.steps || []) {
    const groups = Object.values(step.input_links || {});
    for (const links of groups) {
      if (!Array.isArray(links)) continue;
      for (const link of links) {
        assert.notEqual(
          Number(link.producer_step_id),
          Number(step.id),
          `step ${step.id} must not link to itself`
        );
      }
    }
  }
}

function assertNoPackagerSteps(detail) {
  for (const step of detail.steps || []) {
    const building = String(step.schema?.building_slug || '').toLowerCase();
    assert.notEqual(
      building,
      'packager',
      `unexpected packager step for ${step.item?.slug}`
    );
  }
}

describe('autoPlanProductionChain', () => {
  let db;
  const noop = () => {};

  before(async () => {
    db = await getSharedTestDatabase();
  });

  it('plans 60 iron-plate/min with 100% OC (shard budget 0)', async () => {
    const plate = findItemBySlug(db, 'iron-plate');
    assert.ok(plate);

    const chain = createProductionChain(db, noop, {
      name: 'Test iron plate 60',
      target_item_slug: plate.slug,
      target_rate: 60,
    });

    const detail = autoPlanProductionChain(
      db,
      noop,
      chain.id,
      {
        targets: [{ item_id: plate.id, target_rate: 60 }],
        replace: true,
      },
      getItemById
    );

    assert.ok(detail);
    assert.equal(detail.targets?.length, 1);
    assert.equal(detail.targets[0].target_rate, 60);

    const plateStep = stepByItemSlug(detail, 'iron-plate');
    assert.ok(plateStep, 'expected iron-plate step');
    assert.equal(plateStep.overclock, 100);
    // 60/min @ 20 base → 3 machines, prefer-even → 4
    assert.equal(plateStep.machine_count, 4);
    assert.ok(Number(plateStep.target_output) + 1e-9 >= 60);

    const ingotStep = stepByItemSlug(detail, 'iron-ingot');
    assert.ok(ingotStep, 'expected iron-ingot step');
    assert.equal(ingotStep.overclock, 100);
    // Plate demand 60 → 90 iron ingot/min → 90/30 = 3 → prefer-even → 4 smelters
    assert.equal(ingotStep.machine_count, 4);

    const ore = extractionByItemSlug(detail, 'ore-iron');
    assert.ok(ore, 'expected iron ore extraction');
    assert.ok(Number(ore.target_output) + 1e-9 >= 90);

    assertNoSelfLinks(detail);
    assertNoPackagerSteps(detail);
  });

  it('plans aluminum-ingot without recipe cycles or packager steps', () => {
    const ingot = findItemBySlug(db, 'aluminum-ingot');
    assert.ok(ingot);

    const chain = createProductionChain(db, noop, {
      name: 'Test aluminum ingot',
      target_item_slug: ingot.slug,
      target_rate: 60,
    });

    let detail;
    assert.doesNotThrow(() => {
      detail = autoPlanProductionChain(
        db,
        noop,
        chain.id,
        {
          targets: [{ item_id: ingot.id, target_rate: 60 }],
          replace: true,
        },
        getItemById
      );
    });

    assert.ok(detail);
    const alStep = stepByItemSlug(detail, 'aluminum-ingot');
    assert.ok(alStep);
    assert.equal(alStep.overclock, 100);
    assertNoSelfLinks(detail);
    assertNoPackagerSteps(detail);

    // Should expand scrap / alumina / raws rather than abort as external-only
    assert.ok(
      (detail.steps?.length || 0) >= 2 || (detail.extractions?.length || 0) >= 1,
      'aluminum plan should include upstream crafts or extractions'
    );
  });

  it('aggregates shared intermediates for multi-target plans', () => {
    const plate = findItemBySlug(db, 'iron-plate');
    const rod = findItemBySlug(db, 'iron-rod');
    assert.ok(plate && rod);

    const chain = createProductionChain(db, noop, {
      name: 'Test plate+rod',
    });

    const detail = autoPlanProductionChain(
      db,
      noop,
      chain.id,
      {
        targets: [
          { item_id: plate.id, target_rate: 20 },
          { item_id: rod.id, target_rate: 15 },
        ],
        replace: true,
      },
      getItemById
    );

    assert.equal(detail.targets?.length, 2);

    const ingotSteps = (detail.steps || []).filter((s) => s.item?.slug === 'iron-ingot');
    assert.equal(ingotSteps.length, 1, 'shared iron-ingot must be a single step');

    assertNoSelfLinks(detail);
  });

  it('with unlimited shards may overclock above 100%', () => {
    const plate = findItemBySlug(db, 'iron-plate');
    assert.ok(plate);

    const chain = createProductionChain(db, noop, {
      name: 'Test plate OC',
      target_item_slug: plate.slug,
      target_rate: 25,
    });
    updateProductionChain(db, noop, chain.id, { power_shard_limit: -1 });

    const detail = autoPlanProductionChain(
      db,
      noop,
      chain.id,
      {
        targets: [{ item_id: plate.id, target_rate: 25 }],
        replace: true,
      },
      getItemById
    );

    const plateStep = stepByItemSlug(detail, 'iron-plate');
    assert.ok(plateStep);
    // 25/min with base 20 → typically 1 machine @ 125% when shards unlimited
    assert.ok(
      plateStep.machine_count === 1 || plateStep.overclock > 100,
      `expected OC or single machine, got machines=${plateStep.machine_count} oc=${plateStep.overclock}`
    );
    assert.ok(Number(plateStep.target_output) + 1e-9 >= 25);
  });

  it('returns detail via getProductionChainDetail after plan', () => {
    const plate = findItemBySlug(db, 'iron-plate');
    const chain = createProductionChain(db, noop, { name: 'Reload detail' });
    autoPlanProductionChain(
      db,
      noop,
      chain.id,
      { targets: [{ item_id: plate.id, target_rate: 20 }], replace: true },
      getItemById
    );
    const reloaded = getProductionChainDetail(db, chain.id, getItemById);
    assert.ok(stepByItemSlug(reloaded, 'iron-plate'));
  });
});
