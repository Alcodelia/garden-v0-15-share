(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GardenMaterialProfiles = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LIMITS = Object.freeze({
    areaM2: Object.freeze({ minExclusive: 0, max: 10000 }),
    depthMm: Object.freeze({ min: 1, max: 1000 }),
    wastePercent: Object.freeze({ min: 0, max: 100 }),
    densityKgM3: Object.freeze({ min: 1, max: 5000 }),
    bagLitres: Object.freeze({ min: 0.1, max: 5000 }),
    bulkIncrementM3: Object.freeze({ min: 0.001, max: 100 })
  });

  const ORDER_MODES = Object.freeze([
    Object.freeze({
      id: 'volume',
      label: 'Planning volume only',
      description: 'Reports the calculated volume without supplier-unit rounding.'
    }),
    Object.freeze({
      id: 'bags',
      label: 'Bags by declared pack volume',
      description: 'Rounds upward using the pack volume entered from the selected product.'
    }),
    Object.freeze({
      id: 'bulk',
      label: 'Bulk by declared supplier increment',
      description: 'Rounds upward using the cubic-metre increment entered from the supplier.'
    })
  ]);

  const RESULT_UNITS = Object.freeze({
    area: 'm2',
    depthInput: 'mm',
    volumePrimary: 'm3',
    volumeSecondary: 'L',
    massOptional: 'kg',
    bagOrder: 'whole bags',
    bulkOrder: 'declared m3 increments'
  });

  const POLICY = Object.freeze({
    schema: 'garden-v0.21-material-profiles/v1',
    calculationBasis: 'bulk-volume',
    exactRelationship: 'finished volume m3 = selected area m2 * finished depth mm / 1000',
    wasteRule: 'A user-entered waste percentage is applied once to finished volume. Zero is the default.',
    settlementRule: 'No generic settlement or compaction conversion is applied.',
    densityRule: 'No density default is supplied. Mass is calculated only from a user- or supplier-declared kg/m3 value with a source note.',
    densityApplicability: 'The declared density must describe the same material and moisture/compaction state intended for the volume estimate.',
    orderRule: 'No order rounding is applied unless the user declares a bag volume or supplier bulk increment.',
    defaultPolicy: 'The only numeric default is 0% waste. Depth, density and supplier order units require explicit declarations.',
    evidenceStatus: 'Project-defined material taxonomy; all non-geometric calculation properties are user/supplier declarations.',
    provenance: 'Garden v0.21 calculator engineering audit, 2026-08-15'
  });

  function profile(record) {
    return Object.freeze({
      ...record,
      basis: POLICY.calculationBasis,
      supportedOrderModes: Object.freeze(['volume', 'bags', 'bulk']),
      density: Object.freeze({ supported: true, defaultKgM3: null, sourceRequired: true }),
      defaults: Object.freeze({ depthMm: null, wastePercent: 0, densityKgM3: null, orderMode: 'volume' }),
      applicationDepth: Object.freeze({ minMm: LIMITS.depthMm.min, maxMm: LIMITS.depthMm.max, status: 'calculator guardrail only; user declaration required' }),
      resultUnits: RESULT_UNITS,
      calculationRules: Object.freeze({ waste: POLICY.wasteRule, settlement: POLICY.settlementRule, orders: POLICY.orderRule }),
      limits: LIMITS,
      evidence: Object.freeze({
        taxonomy: 'supported project planning category',
        numericDefaults: 'none except 0% waste',
        physicalProperties: 'user or supplier declaration required'
      })
    });
  }

  const PROFILES = Object.freeze([
    profile({
      id: 'organic-mulch',
      label: 'Organic mulch',
      category: 'organic-bulk',
      description: 'Loose organic mulch applied as a surface layer to a declared garden area.',
      scopeNote: 'Useful for garden-bed volume planning. The calculator does not choose a mulch product or application depth.'
    }),
    profile({
      id: 'bedding-fill-sand',
      label: 'Sand - bedding or fill',
      category: 'mineral-bulk',
      description: 'Loose sand used as a declared bedding, levelling or fill layer.',
      scopeNote: 'Use the depth and material state that match the intended job; no compaction factor is assumed.'
    }),
    profile({
      id: 'drainage-gravel',
      label: 'Drainage gravel',
      category: 'mineral-bulk',
      description: 'Loose drainage aggregate placed over a declared area and finished depth.',
      scopeNote: 'This estimates bulk quantity only. Grading, drainage design and suitability remain separate decisions.'
    }),
    profile({
      id: 'decorative-aggregate',
      label: 'Decorative aggregate or pebbles',
      category: 'mineral-bulk',
      description: 'Loose decorative aggregate or pebbles applied as a surface layer.',
      scopeNote: 'Enter the intended finished depth and the actual supplier unit; product coverage claims are not invented here.'
    }),
    profile({
      id: 'lawn-topdressing',
      label: 'Lawn top-dressing blend',
      category: 'blended-bulk',
      description: 'A supplier-defined sand/soil top-dressing blend applied to the lawn area.',
      scopeNote: 'Blend, application depth and density vary. Use declared values for the selected product and job.'
    })
  ]);

  function getProfile(id) {
    return PROFILES.find((candidate) => candidate.id === id) || null;
  }

  function getOrderMode(id) {
    return ORDER_MODES.find((candidate) => candidate.id === id) || null;
  }

  function listProfiles() {
    return PROFILES.slice();
  }

  return Object.freeze({
    schema: POLICY.schema,
    limits: LIMITS,
    resultUnits: RESULT_UNITS,
    policy: POLICY,
    profiles: PROFILES,
    orderModes: ORDER_MODES,
    getProfile,
    getOrderMode,
    listProfiles
  });
});
