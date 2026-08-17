(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GardenCalculator = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  class ValidationError extends Error {
    constructor(fieldErrors) {
      super('Check the highlighted calculator inputs and try again.');
      this.name = 'ValidationError';
      this.fieldErrors = fieldErrors;
    }
  }

  function numeric(value, field, label, errors) {
    if (value === null || value === undefined || String(value).trim() === '') {
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

  function optionalNumeric(value, field, label, errors) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    return numeric(value, field, label, errors);
  }

  function within(value, limits) {
    return Number.isFinite(value) && value >= limits.min && value <= limits.max;
  }

  function upwardUnits(total, increment) {
    const ratio = total / increment;
    const nearestInteger = Math.round(ratio);
    const floatingTolerance = Number.EPSILON * Math.max(1, Math.abs(ratio)) * 8;
    return Math.abs(ratio - nearestInteger) <= floatingTolerance ? nearestInteger : Math.ceil(ratio);
  }

  function calculateBulkMaterial(input, profile) {
    const errors = {};
    if (!profile || typeof profile !== 'object' || profile.basis !== 'bulk-volume' || !profile.limits) {
      throw new ValidationError({ profileId: 'Choose a supported bulk-material profile.' });
    }
    if (String(input.profileId || '') !== profile.id) {
      errors.profileId = 'The selected material profile does not match the calculation request.';
    }

    const limits = profile.limits;
    const areaM2 = numeric(input.areaM2, 'areaM2', 'Selected area', errors);
    const depthMm = numeric(input.depthMm, 'depthMm', 'Finished depth', errors);
    const wastePercent = numeric(input.wastePercent, 'wastePercent', 'Waste allowance', errors);
    const densityKgM3 = optionalNumeric(input.densityKgM3, 'densityKgM3', 'Declared bulk density', errors);
    const densitySource = String(input.densitySource || '').trim();
    const orderMode = String(input.orderMode || '');
    const supportedModes = profile && Array.isArray(profile.supportedOrderModes) ? profile.supportedOrderModes : [];
    const bagLitres = orderMode === 'bags' ? numeric(input.bagLitres, 'bagLitres', 'Bag volume', errors) : null;
    const bulkIncrementM3 = orderMode === 'bulk'
      ? numeric(input.bulkIncrementM3, 'bulkIncrementM3', 'Supplier bulk increment', errors)
      : null;

    if (Number.isFinite(areaM2) && (areaM2 <= limits.areaM2.minExclusive || areaM2 > limits.areaM2.max)) {
      errors.areaM2 = `Use a selected area greater than 0 and no more than ${limits.areaM2.max.toLocaleString('en-AU')} m².`;
    }
    if (Number.isFinite(depthMm) && !within(depthMm, limits.depthMm)) {
      errors.depthMm = `Use a finished depth from ${limits.depthMm.min} to ${limits.depthMm.max.toLocaleString('en-AU')} mm.`;
    }
    if (Number.isFinite(wastePercent) && !within(wastePercent, limits.wastePercent)) {
      errors.wastePercent = `Use a waste allowance from ${limits.wastePercent.min}% to ${limits.wastePercent.max}%.`;
    }
    if (densityKgM3 !== null && Number.isFinite(densityKgM3) && !within(densityKgM3, limits.densityKgM3)) {
      errors.densityKgM3 = `Use a declared density from ${limits.densityKgM3.min} to ${limits.densityKgM3.max.toLocaleString('en-AU')} kg/m³.`;
    }
    if (densityKgM3 !== null && !densitySource) {
      errors.densitySource = 'Add the supplier, product sheet or measurement source for this density.';
    }
    if (densityKgM3 === null && densitySource) {
      errors.densitySource = 'Enter the matching density or clear this source note.';
    }
    if (densitySource.length > 160) {
      errors.densitySource = 'Keep the density source note to 160 characters or fewer.';
    }
    if (!supportedModes.includes(orderMode)) {
      errors.orderMode = 'Choose a supported order basis.';
    }
    if (orderMode === 'bags' && Number.isFinite(bagLitres) && !within(bagLitres, limits.bagLitres)) {
      errors.bagLitres = `Use a declared bag volume from ${limits.bagLitres.min} to ${limits.bagLitres.max.toLocaleString('en-AU')} litres.`;
    }
    if (orderMode === 'bulk' && Number.isFinite(bulkIncrementM3) && !within(bulkIncrementM3, limits.bulkIncrementM3)) {
      errors.bulkIncrementM3 = `Use a supplier increment from ${limits.bulkIncrementM3.min} to ${limits.bulkIncrementM3.max} m³.`;
    }
    if (input.settlementPercent !== undefined && input.settlementPercent !== null && String(input.settlementPercent).trim() !== '') {
      errors.settlementPercent = 'Generic settlement or compaction is not supported. Use supplier yield information outside this calculation.';
    }

    if (Object.keys(errors).length) throw new ValidationError(errors);

    const wasteFraction = wastePercent / 100;
    const finishedM3 = areaM2 * depthMm / 1000;
    const planningM3 = finishedM3 * (1 + wasteFraction);
    const finishedLitres = finishedM3 * 1000;
    const planningLitres = planningM3 * 1000;
    const finishedMassKg = densityKgM3 === null ? null : finishedM3 * densityKgM3;
    const planningMassKg = densityKgM3 === null ? null : planningM3 * densityKgM3;
    const bagCount = orderMode === 'bags' ? upwardUnits(planningLitres, bagLitres) : null;
    const bulkOrderUnits = orderMode === 'bulk' ? upwardUnits(planningM3, bulkIncrementM3) : null;
    const roundedOrderLitres = bagCount === null ? null : bagCount * bagLitres;
    const roundedOrderM3 = bulkOrderUnits === null ? null : bulkOrderUnits * bulkIncrementM3;

    return {
      profileId: profile.id,
      areaM2,
      depthMm,
      wastePercent,
      wasteIncluded: wastePercent > 0,
      orderMode,
      bagLitres,
      bulkIncrementM3,
      densityKgM3,
      densitySource: densitySource || null,
      finishedM3,
      finishedLitres,
      planningM3,
      planningLitres,
      finishedMassKg,
      planningMassKg,
      bagCount,
      bulkOrderUnits,
      roundedOrderLitres,
      roundedOrderM3
    };
  }

  function quarterAnnulusArea(outerRadiusM, innerRadiusM) {
    if (!Number.isFinite(outerRadiusM) || !Number.isFinite(innerRadiusM) || outerRadiusM <= innerRadiusM || innerRadiusM < 0) {
      throw new ValidationError({ radius: 'Outer radius must be greater than a non-negative inner radius.' });
    }
    return Math.PI * (outerRadiusM ** 2 - innerRadiusM ** 2) / 4;
  }

  return Object.freeze({ ValidationError, calculateBulkMaterial, quarterAnnulusArea });
});
