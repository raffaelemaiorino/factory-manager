const BUILDING_SLUG_BY_ID = {
  Build_MinerMk1_C: 'miner-mk1',
  Build_MinerMk2_C: 'miner-mk2',
  Build_MinerMk3_C: 'miner-mk3',
  Build_OilPump_C: 'oil-pump',
  Build_WaterPump_C: 'water-pump',
  Build_FrackingSmasher_C: 'fracking-smasher',
  Build_FrackingExtractor_C: 'fracking-extractor',
  Build_SmelterMk1_C: 'smelter',
  Build_FoundryMk1_C: 'foundry',
  Build_ConstructorMk1_C: 'constructor',
  Build_AssemblerMk1_C: 'assembler',
  Build_ManufacturerMk1_C: 'manufacturer',
  Build_OilRefinery_C: 'refinery',
  Build_Packager_C: 'packager',
  Build_Blender_C: 'blender',
  Build_HadronCollider_C: 'particle-accelerator',
  Build_QuantumEncoder_C: 'quantum-encoder',
  Build_Converter_C: 'converter',
  Build_GeneratorBiomass_Automated_C: 'generator-biomass',
  Build_GeneratorCoal_C: 'generator-coal',
  Build_GeneratorFuel_C: 'generator-fuel',
  Build_GeneratorGeoThermal_C: 'generator-geothermal',
  Build_GeneratorNuclear_C: 'generator-nuclear',
  Build_PowerStorageMk1_C: 'power-storage',
  Build_AlienPowerBuilding_C: 'alien-power-distributor',
};

function buildingIdToSlug(buildingId) {
  return (
    BUILDING_SLUG_BY_ID[buildingId] ??
    buildingId
      .replace(/^Build_/, '')
      .replace(/_C$/, '')
      .replace(/Mk\d+/gi, '')
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/_/g, '-')
      .toLowerCase()
  );
}

module.exports = { BUILDING_SLUG_BY_ID, buildingIdToSlug };
