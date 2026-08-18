const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const {
  createProductionChain,
  getProductionChainDetail,
  setProductionStepInputLinks,
  listAllProductionObjectives,
  listProductionObjectives,
  addProductionChainStep,
  addSinkProductionChainStep,
  updateProductionChainStep,
} = require('../src/database/production-chains');
const { autoPlanProductionChain } = require('../src/database/auto-plan');
const { getItemSchemas } = require('../src/database/schemas');
const {
  createEnergyChain,
  addEnergyGenerator,
  setEnergyGeneratorProductionLinks,
  ensureEnergyProductionLinksTable,
} = require('../src/database/energy-chains');
const {
  getSharedTestDatabase,
  findItemBySlug,
  getItemById,
} = require('./helpers/test-db');

function stepByItemSlug(detail, slug) {
  return (detail.steps || []).find((s) => s.item?.slug === slug);
}

function defaultSchemaForItem(db, itemId) {
  const schemas = getItemSchemas(db, itemId);
  assert.ok(schemas?.length, 'expected schemas');
  return schemas.find((s) => !s.is_alternative) || schemas[0];
}

describe('cross-chain production links', () => {
  let db;
  const noop = () => {};

  before(async () => {
    db = await getSharedTestDatabase();
    ensureEnergyProductionLinksTable(db);
  });

  it('links a production step to a producer in another chain', () => {
    const plate = findItemBySlug(db, 'iron-plate');
    const reinforced = findItemBySlug(db, 'iron-plate-reinforced');
    assert.ok(plate && reinforced);

    const producerChain = createProductionChain(db, noop, {
      name: 'CrossLink producer plates',
      target_item_slug: plate.slug,
      target_rate: 60,
    });
    const producerDetail = autoPlanProductionChain(
      db,
      noop,
      producerChain.id,
      {
        targets: [{ item_id: plate.id, target_rate: 60 }],
        replace: true,
      },
      getItemById
    );
    const plateStep = stepByItemSlug(producerDetail, 'iron-plate');
    assert.ok(plateStep);

    const consumerChain = createProductionChain(db, noop, {
      name: 'CrossLink consumer reinforced',
    });
    const schema = defaultSchemaForItem(db, reinforced.id);
    let consumerStep = addProductionChainStep(
      db,
      noop,
      consumerChain.id,
      { item_id: reinforced.id, item_schema_id: schema.id },
      getItemById
    );
    assert.ok(consumerStep);
    assert.equal(consumerStep.item?.slug, 'iron-plate-reinforced');

    consumerStep = updateProductionChainStep(
      db,
      noop,
      consumerStep.id,
      {
        target_output: 10,
        machine_count: consumerStep.machine_count || 1,
        overclock: consumerStep.overclock || 100,
      },
      getItemById
    );

    const hasPlateInput = (consumerStep.scaled_inputs ?? []).some(
      (io) => io.item_slug === 'iron-plate'
    );
    assert.ok(hasPlateInput, 'reinforced plate should require iron-plate');

    const consumerDetail = setProductionStepInputLinks(
      db,
      noop,
      consumerStep.id,
      'iron-plate',
      [plateStep.id],
      getItemById
    );

    const linkedStep = stepByItemSlug(consumerDetail, 'iron-plate-reinforced');
    const links = linkedStep.input_links?.['iron-plate'] ?? [];
    assert.equal(links.length, 1);
    assert.equal(Number(links[0].producer_step_id), Number(plateStep.id));
    assert.equal(Number(links[0].producer_chain_id), Number(producerChain.id));
    assert.equal(links[0].producer_chain_name, 'CrossLink producer plates');
    assert.ok((links[0].producer_rate ?? 0) > 0);

    const objectives = listAllProductionObjectives(db, getItemById);
    const plateObjective = objectives.find(
      (obj) =>
        Number(obj.step_id) === Number(plateStep.id) && obj.item_slug === 'iron-plate'
    );
    assert.ok(plateObjective, 'producer surplus should remain listable or reduced');
    assert.ok(
      plateObjective.excess_rate + 1e-9 < plateObjective.rate,
      'cross-chain demand should reduce excess'
    );

    const listDetail = getProductionChainDetail(db, producerChain.id, getItemById);
    assert.deepEqual(listDetail.production_objectives, []);

    const editorDetail = getProductionChainDetail(db, consumerChain.id, getItemById, {
      includeProductionObjectives: true,
    });
    assert.ok(
      editorDetail.production_objectives.some(
        (obj) => Number(obj.step_id) === Number(plateStep.id)
      )
    );
  });

  it('allows the same producer step to link to energy and another production chain', () => {
    const compacted = findItemBySlug(db, 'compacted-coal');
    assert.ok(compacted);

    const producerChain = createProductionChain(db, noop, {
      name: 'CrossLink compacted producer',
      target_item_slug: compacted.slug,
      target_rate: 30,
    });
    const producerDetail = autoPlanProductionChain(
      db,
      noop,
      producerChain.id,
      {
        targets: [{ item_id: compacted.id, target_rate: 30 }],
        replace: true,
      },
      getItemById
    );
    const fuelStep = stepByItemSlug(producerDetail, 'compacted-coal');
    assert.ok(fuelStep, 'expected compacted-coal production step');

    const sinkChain = createProductionChain(db, noop, {
      name: 'CrossLink compacted sink',
    });
    const sinkStep = addSinkProductionChainStep(
      db,
      noop,
      sinkChain.id,
      { item_id: compacted.id, target_output: 5 },
      getItemById
    );
    assert.ok(sinkStep);
    assert.equal(Number(sinkStep.is_sink), 1);

    const sinkDetail = setProductionStepInputLinks(
      db,
      noop,
      sinkStep.id,
      'compacted-coal',
      [fuelStep.id],
      getItemById
    );
    const linkedSink = (sinkDetail.steps || []).find((s) => Number(s.is_sink) === 1);
    assert.equal((linkedSink.input_links?.['compacted-coal'] ?? []).length, 1);

    const energyChain = createEnergyChain(db, noop, {
      name: 'CrossLink compacted energy',
      target_power_mw: 75,
      target_building_slug: 'generator-coal',
      target_fuel_slug: 'compacted-coal',
    });
    const generator = addEnergyGenerator(
      db,
      noop,
      energyChain.id,
      {
        building_slug: 'generator-coal',
        fuel_slug: 'compacted-coal',
        machine_count: 1,
        overclock: 100,
        target_fuel_input: 50 / 7,
      },
      getItemById
    );
    assert.ok(generator?.id);

    const afterEnergy = setEnergyGeneratorProductionLinks(
      db,
      noop,
      generator.id,
      'compacted-coal',
      [fuelStep.id],
      getItemById
    );
    const energyLinks =
      afterEnergy.generators?.find((g) => Number(g.id) === Number(generator.id))
        ?.production_input_links?.['compacted-coal'] ?? [];
    assert.equal(energyLinks.length, 1);

    const stillOfferedToProduction = listProductionObjectives(db, getItemById, {
      itemSlugs: ['compacted-coal'],
    });
    assert.ok(
      stillOfferedToProduction.some(
        (obj) => Number(obj.step_id) === Number(fuelStep.id) && obj.item_slug === 'compacted-coal'
      ),
      'energy demand must not hide leftover production surplus'
    );

    const stillLinked = getProductionChainDetail(db, sinkChain.id, getItemById);
    const stillSink = (stillLinked.steps || []).find((s) => Number(s.is_sink) === 1);
    assert.equal((stillSink.input_links?.['compacted-coal'] ?? []).length, 1);

    const objectives = listAllProductionObjectives(db, getItemById);
    const fuelObjective = objectives.find(
      (obj) => Number(obj.step_id) === Number(fuelStep.id) && obj.item_slug === 'compacted-coal'
    );
    if (fuelObjective) {
      assert.ok(
        fuelObjective.excess_rate + 1e-9 < fuelObjective.rate,
        'production + energy demand should reduce excess'
      );
    }
  });

  it('keeps fully allocated producers as energy link candidates', () => {
    const plate = findItemBySlug(db, 'iron-plate');
    assert.ok(plate);

    const producerChain = createProductionChain(db, noop, {
      name: 'CrossLink allocated producer',
      target_item_slug: plate.slug,
      target_rate: 20,
    });
    const producerDetail = autoPlanProductionChain(
      db,
      noop,
      producerChain.id,
      {
        targets: [{ item_id: plate.id, target_rate: 20 }],
        replace: true,
      },
      getItemById
    );
    const plateStep = stepByItemSlug(producerDetail, 'iron-plate');
    assert.ok(plateStep);
    const outputRate = Number(plateStep.target_output) || 20;

    const sinkChain = createProductionChain(db, noop, {
      name: 'CrossLink allocated sink',
    });
    const sinkStep = addSinkProductionChainStep(
      db,
      noop,
      sinkChain.id,
      { item_id: plate.id, target_output: outputRate },
      getItemById
    );
    setProductionStepInputLinks(db, noop, sinkStep.id, 'iron-plate', [plateStep.id], getItemById);

    const surplusOnly = listProductionObjectives(db, getItemById, {
      itemSlugs: ['iron-plate'],
    });
    const forEnergy = listProductionObjectives(db, getItemById, {
      itemSlugs: ['iron-plate'],
      includeAllocated: true,
    });

    assert.equal(
      surplusOnly.some((obj) => Number(obj.step_id) === Number(plateStep.id)),
      false
    );
    assert.ok(
      forEnergy.some((obj) => Number(obj.step_id) === Number(plateStep.id)),
      'energy should still offer a producer already used by another production plan'
    );

    const sinkEditor = getProductionChainDetail(db, sinkChain.id, getItemById, {
      includeProductionObjectives: true,
    });
    assert.equal(
      sinkEditor.production_objectives.some(
        (obj) => Number(obj.step_id) === Number(plateStep.id) && obj.item_slug === 'iron-plate'
      ),
      false,
      'production-to-production links stay exclusive when the producer is fully used'
    );
  });
});
