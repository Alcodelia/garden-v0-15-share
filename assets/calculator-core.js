(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GardenCalculator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  class ValidationError extends Error {
    constructor(fieldErrors) {
      super('Check the highlighted calculator inputs.');
      this.name = 'ValidationError';
      this.fieldErrors = fieldErrors;
    }
  }

  function numeric(value, field, label, errors) {
    if (value === '' || value === null || value === undefined) {
      errors[field] = `${label} is required.`;
      return NaN;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      errors[field] = `${label} must be a number.`;
      return NaN;
    }
    return parsed;
  }

  function calculateMaterials(input) {
    const errors = {};
    const areaM2 = numeric(input.areaM2, 'areaM2', 'Selected area', errors);
    const depthMm = numeric(input.depthMm, 'depthMm', 'Finished depth', errors);
    const wastePercent = numeric(input.wastePercent, 'wastePercent', 'Waste allowance', errors);
    const settlementPercent = numeric(input.settlementPercent, 'settlementPercent', 'Settlement allowance', errors);
    const mode = input.mode === 'bulk' ? 'bulk' : 'bags';
    const bagLitres = mode === 'bags'
      ? numeric(input.bagLitres, 'bagLitres', 'Bag volume', errors)
      : null;

    if (Number.isFinite(areaM2) && (areaM2 <= 0 || areaM2 > 100000)) {
      errors.areaM2 = 'Select at least one valid region.';
    }
    if (Number.isFinite(depthMm) && (depthMm <= 0 || depthMm > 2000)) {
      errors.depthMm = 'Use a finished depth from 1 to 2,000 mm.';
    }
    if (Number.isFinite(wastePercent) && (wastePercent < 0 || wastePercent > 200)) {
      errors.wastePercent = 'Use a waste allowance from 0% to 200%.';
    }
    if (Number.isFinite(settlementPercent) && (settlementPercent < 0 || settlementPercent >= 95)) {
      errors.settlementPercent = 'Use a settlement allowance from 0% to less than 95%.';
    }
    if (mode === 'bags' && Number.isFinite(bagLitres) && (bagLitres <= 0 || bagLitres > 5000)) {
      errors.bagLitres = 'Use a bag volume from 1 to 5,000 litres.';
    }

    if (Object.keys(errors).length) throw new ValidationError(errors);

    const wasteFraction = wastePercent / 100;
    const settlementFraction = settlementPercent / 100;
    const finishedM3 = areaM2 * depthMm / 1000;
    const orderM3 = finishedM3 * (1 + wasteFraction) / (1 - settlementFraction);
    const finishedLitres = finishedM3 * 1000;
    const orderLitres = orderM3 * 1000;
    const bagCount = mode === 'bags' ? Math.ceil(orderLitres / bagLitres) : null;

    return {
      areaM2,
      depthMm,
      wastePercent,
      settlementPercent,
      mode,
      bagLitres,
      finishedM3,
      finishedLitres,
      orderM3,
      orderLitres,
      bagCount
    };
  }

  function quarterAnnulusArea(outerRadiusM, innerRadiusM) {
    if (!Number.isFinite(outerRadiusM) || !Number.isFinite(innerRadiusM) || outerRadiusM <= innerRadiusM || innerRadiusM < 0) {
      throw new ValidationError({ radius: 'Outer radius must be greater than a non-negative inner radius.' });
    }
    return Math.PI * (outerRadiusM ** 2 - innerRadiusM ** 2) / 4;
  }

  return { ValidationError, calculateMaterials, quarterAnnulusArea };
});
