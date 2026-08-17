(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GardenSiteData = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DATA_PATHS = Object.freeze({
    regionManifest: 'data/garden_v0_16_region_manifest_r1.json',
    locationSolar: 'data/garden_v0_18_location_solar_summary_r1.json',
    solarResults: 'data/garden_v0_15_solar_results_r4.json'
  });

  const SECTION_REGISTRY = Object.freeze({
    overview: {
      anchor: 'top',
      labels: { presentation: 'Overview', calculator: 'Technical scope' }
    },
    model: {
      anchor: 'model',
      labels: { presentation: '3D explore', calculator: 'Shared 3D model' }
    },
    layout: {
      anchor: 'layout',
      labels: { presentation: 'Layout', calculator: 'Layout & geometry' }
    },
    realistic: {
      anchor: 'realistic',
      labels: { presentation: 'Finished views', calculator: 'Appearance evidence' }
    },
    materials: {
      anchor: 'calculator',
      labels: { presentation: 'Materials', calculator: 'Material quantities' }
    },
    solar: {
      anchor: 'solar',
      labels: { presentation: 'Sun & shade', calculator: 'Solar analysis' }
    },
    downloads: {
      anchor: 'downloads',
      labels: { presentation: 'Plans', calculator: 'Evidence & downloads' }
    }
  });

  const SECTION_ORDER = Object.freeze({
    presentation: ['overview', 'layout', 'realistic', 'model', 'solar', 'downloads'],
    calculator: ['overview', 'layout', 'materials', 'realistic', 'model', 'solar', 'downloads']
  });

  const STRUCTURAL_ORDER = Object.freeze(['overview', 'layout', 'materials', 'realistic', 'model', 'solar', 'downloads']);

  const SECTION_FALLBACKS = Object.freeze({
    presentation: Object.freeze({ materials: 'layout' }),
    calculator: Object.freeze({})
  });

  const COPY = Object.freeze({
    hero: {
      presentation: {
        eyebrow: 'A complete backyard plan',
        heading: 'A garden designed to work as a whole',
        lede: 'See the complete layout, the finished garden character and the useful sunlight each part is likely to receive through the year.'
      },
      calculator: {
        eyebrow: 'Technical planning mode',
        heading: 'Plan quantities with explicit assumptions',
        lede: 'Inspect the shared layout, calculate supported bulk materials, and review the solar scenarios, units, source boundaries and downloadable evidence.'
      }
    },
    headings: {
      overview: { presentation: 'How the design comes together', calculator: 'Technical scope and source boundaries' },
      model: { presentation: 'Explore the plan in 3D', calculator: 'Shared 3D model and appearance context' },
      layout: { presentation: 'The complete garden plan', calculator: 'Authoritative layout, orientation and geometry' },
      realistic: { presentation: 'See the garden from ground level', calculator: 'Photo-grounded appearance context' },
      materials: { presentation: 'Material quantities', calculator: 'Bulk-material quantity planner' },
      solar: { presentation: 'Sun and shade through the year', calculator: 'Solar assumptions and results' },
      downloads: { presentation: 'Plans and useful summaries', calculator: 'Documents, data and validation' }
    }
  });

  const CAVEATS = Object.freeze({
    global: {
      presentation: 'This is a useful garden-planning guide, not a site survey or construction drawing. Confirm site conditions before building.',
      calculator: 'Planning material only—not survey, construction, fabrication, purchasing documentation or automatic ordering approval.'
    },
    layout: {
      presentation: 'This is the planned layout, not a site survey. The back of the garden faces roughly north-west.',
      calculator: 'Rear bearing is approximately 330° true ±5°. Exact and approximate geometry remain identified in the supporting records.'
    },
    appearance: {
      presentation: 'Colours and surfaces reflect the existing garden; planting and some details are illustrative.',
      calculator: 'Appearance is photo-grounded and non-dimensional. Protected geometry and adopted solar obstructions remain separate authorities.'
    },
    solar: {
      presentation: 'These are seasonal estimates, not a promise for any one day. Nearby trees and buildings can change the result.',
      calculator: 'Off-site geometry is scenario-bracketed rather than surveyed. Use baseline, likely and conservative results together and retain the ±5° bearing boundary.'
    },
    materials: {
      presentation: 'These depths and amounts are examples, not application advice or a shopping list. Check the final material, depth, pack size and site conditions before buying.',
      calculator: 'Results separate exact geometry from declared properties and supplier-unit rounding. Confirm the product, site conditions and supplier information before purchase.'
    },
    rhizome: {
      presentation: 'Its footprint is fixed in the plan; final edging height, thickness and product still need to be chosen.',
      calculator: 'Plan geometry is exact. Display height/band are presentation proxies; fabrication dimensions and product choice remain unresolved.'
    }
  });

  const MODEL = Object.freeze({
    source: '3d/garden_v0_18_primary_interactive_model_r4.glb',
    poster: 'realistic/garden_v0_18_left_side_perspective_r4.png',
    expectedSha256: '37721f8b5d4c650cc4314a90f31887998cbbe080acff58c81fd2980562d06845',
    camera: {
      desktopOrbit: '38deg 58deg 18.5m',
      compactOrbit: '38deg 58deg 27m',
      target: '2.9m 0.85m -4.5m',
      fieldOfView: '32deg',
      limits: Object.freeze({
        minOrbit: 'auto auto 4.2m',
        maxOrbit: 'auto auto 28m',
        minRadiusM: 4.2,
        maxRadiusM: 28,
        minFieldOfView: '24deg',
        maxFieldOfView: '48deg'
      })
    },
    hotspot: {
      accessibleName: 'Rhizome bed',
      position: '5.05m 0.34m -8.25m',
      normal: '0m 1m 0m',
      focusOrbit: '25deg 70deg 4.2m',
      focusTarget: '5.05m 0.34m -8.25m',
      focusFieldOfView: '30deg'
    }
  });

  const RHIZOME_FEATURE = Object.freeze({
    regionId: 'rhizome-bed',
    centreMm: [5800, 9000],
    outerRadiusMm: 1100,
    grossAreaM2: 0.9503317777109126,
    netFillAreaM2: 0.9160884177867837
  });

  const SOLAR = Object.freeze({
    bearing: 330,
    seasons: Object.freeze([
      Object.freeze({ id: 'summer', label: 'Summer' }),
      Object.freeze({ id: 'autumn', label: 'Autumn' }),
      Object.freeze({ id: 'winter', label: 'Winter' }),
      Object.freeze({ id: 'spring', label: 'Spring' })
    ]),
    scenarios: Object.freeze([
      Object.freeze({ id: 'baseline', label: 'Baseline', publicLabel: 'Sunnier bound' }),
      Object.freeze({ id: 'likely', label: 'Likely', publicLabel: 'Likely working case' }),
      Object.freeze({ id: 'conservative', label: 'Conservative', publicLabel: 'Shadier bound' })
    ]),
    orientationBearings: Object.freeze([325, 330, 335]),
    metric: 'expected_open_sky_weighted_hours'
  });

  const DOWNLOADS = Object.freeze({
    documents: Object.freeze([
      Object.freeze({ id: 'public-package', type: 'ZIP', title: 'Sanitised public distribution', description: 'Public models, renders, solar maps and validation with raw photographs and EXIF excluded.', href: 'downloads/garden_v0_18_public_distribution_r1.zip', modes: ['calculator'] }),
      Object.freeze({ id: 'layout', type: 'PDF', title: 'Complete garden layout', description: 'A clear top-down overview of the planned garden.', href: '2d/garden_v0_16_layout_overview.pdf', modes: ['presentation', 'calculator'] }),
      Object.freeze({ id: 'project-summary', type: 'PDF', title: 'Garden project summary', description: 'The layout, key feature geometry, quantities and planning boundaries in one document.', href: 'documents/garden_v0_16_project_summary.pdf', modes: ['presentation', 'calculator'] }),
      Object.freeze({ id: 'solar-summary', type: 'PDF', title: 'Four-season sunlight guide', description: 'Summer, Autumn, Winter and Spring likely-planning maps with plain-language interpretation.', href: 'documents/garden_v0_20_four_season_solar_summary_r6.pdf', modes: ['presentation', 'calculator'] })
    ]),
    technical: Object.freeze([
      Object.freeze({ group: 'Solar', title: 'Receiver results', detail: 'CSV · 5,220 receivers', href: 'data/garden_v0_15_receiver_results_r4.csv' }),
      Object.freeze({ group: 'Solar', title: 'Zone summary', detail: 'CSV · planning zones', href: 'data/garden_v0_15_zone_summary_r4.csv' }),
      Object.freeze({ group: 'Solar', title: 'Scenario comparison', detail: 'CSV · scenario sensitivity', href: 'data/garden_v0_15_scenario_comparison_r4.csv' }),
      Object.freeze({ group: 'Solar', title: 'Solar results', detail: 'JSON · complete result summary', href: 'data/garden_v0_15_solar_results_r4.json' }),
      Object.freeze({ group: 'Solar', title: 'Skyline envelopes', detail: 'JSON · obstruction brackets', href: 'data/garden_v0_15_skyline_envelopes_r4.json' }),
      Object.freeze({ group: 'Solar', title: 'Planning disposition', detail: 'Markdown · approved claim boundary', href: 'records/garden_v0_15_final_planning_disposition_r4.md' }),
      Object.freeze({ group: 'Layout', title: 'Region manifest', detail: 'JSON · source-backed calculator areas', href: 'data/garden_v0_16_region_manifest_r1.json' }),
      Object.freeze({ group: 'Solar', title: 'Rhizome solar mapping', detail: 'JSON · adopted R4 receivers', href: 'data/garden_v0_16_rhizome_solar_mapping_r1.json' }),
      Object.freeze({ group: 'Model', title: 'Model validation', detail: 'JSON · sanitised PASS record', href: 'records/garden_v0_16_public_validation_r1.json' }),
      Object.freeze({ group: 'Model', title: 'Public manifest', detail: 'JSON · v0.16 publication identity', href: 'records/garden_v0_16_public_manifest_r1.json' }),
      Object.freeze({ group: 'Model', title: 'SHA-256 ledger', detail: 'Text · v0.16 public checksums', href: 'records/garden_v0_16_SHA256SUMS_R1.txt' }),
      Object.freeze({ group: 'Solar', title: 'Location solar summaries', detail: 'JSON · six marked locations', href: 'data/garden_v0_18_location_solar_summary_r1.json' }),
      Object.freeze({ group: 'Model', title: 'v0.18 validation', detail: 'JSON · privacy, links, GLB and hashes', href: 'records/garden_v0_18_public_validation_r1.json' }),
      Object.freeze({ group: 'Model', title: 'v0.18 manifest', detail: 'JSON · published file identity', href: 'records/garden_v0_18_public_manifest_r1.json' }),
      Object.freeze({ group: 'Model', title: 'v0.18 SHA-256 ledger', detail: 'Text · published v0.18 assets', href: 'records/garden_v0_18_SHA256SUMS_R1.txt' })
    ])
  });

  let sharedDataPromise = null;

  function resolveMode(search) {
    const params = new URLSearchParams(typeof search === 'string' ? search : '');
    return params.get('mode') === 'calculator' ? 'calculator' : 'presentation';
  }

  function sectionKeyFromAnchor(anchor) {
    const clean = String(anchor || '').replace(/^#/, '');
    const direct = Object.entries(SECTION_REGISTRY).find(([, section]) => section.anchor === clean);
    if (direct) return direct[0];
    const parentMap = {
      'what-this-is': 'overview',
      views: 'overview',
      'rhizome-callout-heading': 'layout',
      'material-calculator': 'materials',
      'calculator-results': 'materials',
      'solar-explorer-heading': 'solar'
    };
    return parentMap[clean] || 'overview';
  }

  function sectionAnchor(sectionKey) {
    return (SECTION_REGISTRY[sectionKey] || SECTION_REGISTRY.overview).anchor;
  }

  function getSectionOrder(mode) {
    return SECTION_ORDER[mode === 'calculator' ? 'calculator' : 'presentation'].slice();
  }

  function sectionKeyForMode(mode, sectionKey) {
    const resolvedMode = mode === 'calculator' ? 'calculator' : 'presentation';
    const order = SECTION_ORDER[resolvedMode];
    if (order.includes(sectionKey)) return sectionKey;
    return SECTION_FALLBACKS[resolvedMode][sectionKey] || 'overview';
  }

  function heatmapPath(season, scenario, bearing = SOLAR.bearing) {
    const seasonId = SOLAR.seasons.some((candidate) => candidate.id === season) ? season : 'winter';
    const scenarioId = SOLAR.scenarios.some((candidate) => candidate.id === scenario) ? scenario : 'likely';
    const bearingId = Number.isFinite(Number(bearing)) ? Number(bearing) : SOLAR.bearing;
    return `solar/v0_18/garden_v0_18_solar_${seasonId}_${scenarioId}_b${bearingId}_r1.png`;
  }

  function seasonLabel(season) {
    const record = SOLAR.seasons.find((candidate) => candidate.id === season);
    return record ? record.label : SOLAR.seasons[0].label;
  }

  function scenarioLabel(scenario) {
    const record = SOLAR.scenarios.find((candidate) => candidate.id === scenario);
    return record ? record.label : 'Likely';
  }

  function friendlyStatus(status) {
    return String(status || '')
      .toLowerCase()
      .split('__').join(' / ')
      .split('_').join(' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function deriveWholeField(zoneSummaries, season, scenario, bearing = SOLAR.bearing) {
    const caseKey = `${String(season).toUpperCase()}_B${Number(bearing)}`;
    const rows = (Array.isArray(zoneSummaries) ? zoneSummaries : []).filter((row) => (
      row.case_key === caseKey
      && row.scenario === scenario
      && row.metric === SOLAR.metric
    ));
    if (!rows.length) throw new Error(`No adopted whole-field solar rows for ${caseKey} / ${scenario}.`);
    const receiverCount = rows.reduce((total, row) => total + Number(row.receiver_count || 0), 0);
    if (!(receiverCount > 0)) throw new Error(`Invalid receiver count for ${caseKey} / ${scenario}.`);
    const weightedHours = rows.reduce((total, row) => total + Number(row.mean) * Number(row.receiver_count), 0) / receiverCount;
    return { season, scenario, bearing: Number(bearing), receiverCount, hours: weightedHours };
  }

  function deriveWholeFieldTable(solarResults) {
    if (!solarResults || !Array.isArray(solarResults.zone_summaries)) throw new Error('Adopted R4 zone summaries are unavailable.');
    return SOLAR.seasons.map((season) => {
      const values = {};
      SOLAR.scenarios.forEach((scenario) => {
        values[scenario.id] = deriveWholeField(solarResults.zone_summaries, season.id, scenario.id).hours;
      });
      return { season: season.id, label: season.label, values };
    });
  }

  async function loadJson(path, fetchImplementation) {
    const response = await fetchImplementation(path, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}.`);
    return response.json();
  }

  async function loadSharedData(fetchImplementation) {
    const fetcher = fetchImplementation || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    if (!fetcher) throw new Error('This site needs local HTTP access to load its shared planning data.');
    if (sharedDataPromise && !fetchImplementation) return sharedDataPromise;
    const request = Promise.all([
      loadJson(DATA_PATHS.regionManifest, fetcher),
      loadJson(DATA_PATHS.locationSolar, fetcher),
      loadJson(DATA_PATHS.solarResults, fetcher)
    ]).then(([regionManifest, locationSolar, solarResults]) => {
      if (!Array.isArray(regionManifest.regions) || regionManifest.regions.length !== 6) throw new Error('The canonical region manifest must contain six records.');
      if (!Array.isArray(locationSolar.locations) || locationSolar.locations.length !== 6) throw new Error('The canonical location solar summary must contain six records.');
      if (!Array.isArray(solarResults.zone_summaries)) throw new Error('The adopted R4 solar results do not contain zone summaries.');
      return { regionManifest, locationSolar, solarResults };
    });
    if (!fetchImplementation) sharedDataPromise = request;
    return request;
  }

  function documentsForMode(mode) {
    const resolved = mode === 'calculator' ? 'calculator' : 'presentation';
    return DOWNLOADS.documents.filter((item) => item.modes.includes(resolved));
  }

  return Object.freeze({
    dataPaths: DATA_PATHS,
    sectionRegistry: SECTION_REGISTRY,
    sectionOrder: SECTION_ORDER,
    structuralOrder: STRUCTURAL_ORDER,
    sectionFallbacks: SECTION_FALLBACKS,
    copy: COPY,
    caveats: CAVEATS,
    model: MODEL,
    rhizomeFeature: RHIZOME_FEATURE,
    solar: SOLAR,
    downloads: DOWNLOADS,
    resolveMode,
    sectionKeyFromAnchor,
    sectionAnchor,
    getSectionOrder,
    sectionKeyForMode,
    heatmapPath,
    seasonLabel,
    scenarioLabel,
    friendlyStatus,
    deriveWholeField,
    deriveWholeFieldTable,
    loadSharedData,
    documentsForMode
  });
});
