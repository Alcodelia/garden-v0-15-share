const test = require('node:test');
const assert = require('node:assert/strict');
const manifest = require('../data/garden_v0_16_region_manifest_r1.json');

const calculator = require('../assets/calculator-core.js');
const materials = require('../assets/material-profiles.js');

const profile = materials.getProfile('drainage-gravel');

function calculate(overrides = {}) {
  return calculator.calculateBulkMaterial({
    profileId: profile.id,
    areaM2: 10,
    depthMm: 50,
    wastePercent: 10,
    densityKgM3: '',
    densitySource: '',
    orderMode: 'volume',
    bagLitres: '',
    bulkIncrementM3: '',
    ...overrides
  }, profile);
}

function expectFieldError(field, overrides = {}, suppliedProfile = profile) {
  assert.throws(
    () => calculator.calculateBulkMaterial({
      profileId: suppliedProfile?.id || '',
      areaM2: 10,
      depthMm: 50,
      wastePercent: 0,
      densityKgM3: '',
      densitySource: '',
      orderMode: 'volume',
      bagLitres: '',
      bulkIncrementM3: '',
      ...overrides
    }, suppliedProfile),
    (error) => error instanceof calculator.ValidationError && Boolean(error.fieldErrors[field])
  );
}

test('material profiles centrally constrain the calculator to supported bulk categories', () => {
  assert.equal(materials.schema, 'garden-v0.21-material-profiles/v1');
  assert.deepEqual(materials.profiles.map(({ id }) => id), [
    'organic-mulch',
    'bedding-fill-sand',
    'drainage-gravel',
    'decorative-aggregate',
    'lawn-topdressing'
  ]);
  for (const candidate of materials.profiles) {
    assert.equal(candidate.basis, 'bulk-volume');
    assert.equal(candidate.density.defaultKgM3, null);
    assert.equal(candidate.density.sourceRequired, true);
    assert.deepEqual(candidate.supportedOrderModes, ['volume', 'bags', 'bulk']);
    assert.equal(candidate.defaults.wastePercent, 0);
    assert.equal(candidate.defaults.depthMm, null);
    assert.deepEqual(candidate.applicationDepth, {
      minMm: 1,
      maxMm: 1000,
      status: 'calculator guardrail only; user declaration required'
    });
    assert.equal(candidate.resultUnits.volumePrimary, 'm3');
    assert.equal(candidate.resultUnits.massOptional, 'kg');
    assert.match(candidate.calculationRules.orders, /^No order rounding/);
  }
  assert.match(materials.policy.settlementRule, /^No generic settlement/);
  assert.match(materials.policy.densityRule, /^No density default/);
});

test('area times converted depth produces exact finished volume and litres', () => {
  const result = calculate();
  assert.equal(result.finishedM3, 0.5);
  assert.equal(result.finishedLitres, 500);
  assert.equal(result.planningM3, 0.55);
  assert.equal(result.planningLitres, 550);
  assert.equal(result.wasteIncluded, true);
  assert.equal(result.bagCount, null);
  assert.equal(result.bulkOrderUnits, null);
  assert.equal(result.planningMassKg, null);
});

test('shared region-manifest areas flow into the same physical relationship without duplication', () => {
  const selected = manifest.regions.filter((region) => region.selectable);
  assert.equal(selected.length, 5);
  const areaM2 = selected.reduce((total, region) => total + region.calculator_area_m2, 0);
  const result = calculate({ areaM2, depthMm: 25, wastePercent: 0 });
  assert.equal(result.areaM2, areaM2);
  assert.equal(result.finishedM3, areaM2 * 0.025);
  assert.equal(result.planningM3, result.finishedM3);
  assert.match(manifest.selection_policy, /preventing double counting/);
});

test('mass is calculated only from a declared density with its source', () => {
  const result = calculate({ densityKgM3: 1600, densitySource: 'Selected supplier product sheet' });
  assert.equal(result.finishedMassKg, 800);
  assert.ok(Math.abs(result.planningMassKg - 880) < 1e-9);
  assert.equal(result.densitySource, 'Selected supplier product sheet');

  expectFieldError('densitySource', { densityKgM3: 1600, densitySource: '' });
  expectFieldError('densitySource', { densityKgM3: '', densitySource: 'orphaned source' });
  expectFieldError('densitySource', { densityKgM3: 1600, densitySource: 'x'.repeat(161) });
});

test('bag conversion rounds planning litres upward using only the declared pack volume', () => {
  const result = calculate({ orderMode: 'bags', bagLitres: 40 });
  assert.equal(result.bagCount, 14);
  assert.equal(result.roundedOrderLitres, 560);
  assert.equal(result.bulkOrderUnits, null);
  assert.equal(result.roundedOrderM3, null);
});

test('bulk conversion rounds planning volume upward using only the declared supplier increment', () => {
  const result = calculate({ orderMode: 'bulk', bulkIncrementM3: 0.1 });
  assert.equal(result.bulkOrderUnits, 6);
  assert.equal(result.roundedOrderM3, 0.6000000000000001);
  assert.equal(result.bagCount, null);
});

test('upward rounding does not add an extra unit to an exact floating-point multiple', () => {
  const bags = calculate({ areaM2: 8, depthMm: 50, wastePercent: 0, orderMode: 'bags', bagLitres: 40 });
  const bulk = calculate({ areaM2: 8, depthMm: 50, wastePercent: 0, orderMode: 'bulk', bulkIncrementM3: 0.1 });
  assert.equal(bags.planningLitres, 400);
  assert.equal(bags.bagCount, 10);
  assert.equal(bulk.planningM3, 0.4);
  assert.equal(bulk.bulkOrderUnits, 4);
});

test('upward rounding still adds a unit when a real quantity exceeds the declared unit', () => {
  const result = calculate({ areaM2: 8.00000002, depthMm: 50, wastePercent: 0, orderMode: 'bags', bagLitres: 40 });
  assert.ok(result.planningLitres > 400);
  assert.equal(result.bagCount, 11);
});

test('zero waste remains explicit and does not change exact volume', () => {
  const result = calculate({ wastePercent: 0 });
  assert.equal(result.wasteIncluded, false);
  assert.equal(result.finishedM3, result.planningM3);
});

test('required, finite and bounded geometric inputs are enforced', () => {
  for (const value of ['', 0, -1, 10001, NaN, Infinity, -Infinity]) {
    expectFieldError('areaM2', { areaM2: value });
  }
  for (const value of ['', 0, -1, 1001, NaN, Infinity, -Infinity]) {
    expectFieldError('depthMm', { depthMm: value });
  }
  for (const value of ['', -1, 101, NaN, Infinity, -Infinity]) {
    expectFieldError('wastePercent', { wastePercent: value });
  }
});

test('declared density and supplier units are finite and bounded', () => {
  for (const value of [0, -1, 5001, NaN, Infinity]) {
    expectFieldError('densityKgM3', { densityKgM3: value, densitySource: 'source' });
  }
  for (const value of ['', 0, -1, 5001, NaN, Infinity]) {
    expectFieldError('bagLitres', { orderMode: 'bags', bagLitres: value });
  }
  for (const value of ['', 0, -1, 101, NaN, Infinity]) {
    expectFieldError('bulkIncrementM3', { orderMode: 'bulk', bulkIncrementM3: value });
  }
});

test('extreme but valid inputs stay finite and preserve unit relationships', () => {
  const result = calculate({
    areaM2: 10000,
    depthMm: 1000,
    wastePercent: 100,
    densityKgM3: 5000,
    densitySource: 'Boundary-value QA source',
    orderMode: 'bulk',
    bulkIncrementM3: 100
  });
  assert.equal(result.finishedM3, 10000);
  assert.equal(result.planningM3, 20000);
  assert.equal(result.planningLitres, 20000000);
  assert.equal(result.planningMassKg, 100000000);
  assert.equal(result.bulkOrderUnits, 200);
  Object.values(result).filter((value) => typeof value === 'number').forEach((value) => assert.ok(Number.isFinite(value)));
});

test('unsupported profiles, profile mismatches and order modes fail closed', () => {
  expectFieldError('profileId', {}, null);
  expectFieldError('profileId', { profileId: 'organic-mulch' });
  expectFieldError('profileId', { profileId: '' });
  expectFieldError('orderMode', { orderMode: 'sleepers' });
  expectFieldError('profileId', {}, { id: 'timber-sleepers', basis: 'linear-item', supportedOrderModes: [], limits: materials.limits });
});

test('generic settlement or compaction input is rejected rather than silently applied', () => {
  expectFieldError('settlementPercent', { settlementPercent: 12 });
});

test('quarter-annulus helper retains its exact geometry and validation', () => {
  assert.equal(calculator.quarterAnnulusArea(2, 1), Math.PI * 3 / 4);
  assert.throws(
    () => calculator.quarterAnnulusArea(1, 1),
    (error) => error instanceof calculator.ValidationError && Boolean(error.fieldErrors.radius)
  );
});
