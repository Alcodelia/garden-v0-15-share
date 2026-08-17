const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const siteData = require('../assets/site-data.js');
const materials = require('../assets/material-profiles.js');

const siteRoot = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(siteRoot, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(siteRoot, 'assets', 'site.css'), 'utf8');
const client = fs.readFileSync(path.join(siteRoot, 'assets', 'site.js'), 'utf8');

function sha256(relativePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(siteRoot, ...relativePath.split('/')))).digest('hex');
}

function localReferences(source) {
  return [...source.matchAll(/\b(?:href|src)="([^"]+)"/g)]
    .map((match) => match[1].split(/[?#]/)[0])
    .filter((value) => value && !value.startsWith('#') && !value.startsWith('http:') && !value.startsWith('https:') && !value.startsWith('mailto:'));
}

function contrastRatio(foreground, background) {
  function luminance(hex) {
    const channels = hex.match(/[0-9a-f]{2}/gi).map((value) => parseInt(value, 16) / 255);
    const linear = channels.map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  }
  const values = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function orbitRadius(cameraOrbit) {
  const match = cameraOrbit.match(/(-?\d+(?:\.\d+)?)m\s*$/);
  assert.ok(match, `Camera orbit has no metre radius: ${cameraOrbit}`);
  return Number(match[1]);
}

test('one shared site has intentional section orders and a practical cross-mode fallback', () => {
  assert.deepEqual(siteData.getSectionOrder('presentation'), ['overview', 'layout', 'realistic', 'model', 'solar', 'downloads']);
  assert.deepEqual(siteData.getSectionOrder('calculator'), ['overview', 'layout', 'materials', 'realistic', 'model', 'solar', 'downloads']);
  assert.deepEqual(siteData.structuralOrder, ['overview', 'layout', 'materials', 'realistic', 'model', 'solar', 'downloads']);
  assert.equal(siteData.sectionKeyForMode('presentation', 'materials'), 'layout');
  assert.equal(siteData.sectionKeyForMode('calculator', 'materials'), 'materials');
  assert.equal((html.match(/<html\b/g) || []).length, 1);
  assert.match(html, /name="website-view" value="presentation" checked/);
  assert.match(html, /name="website-view" value="calculator"/);
});

test('Presentation keeps the authoritative layout primary and 3D exploration secondary', () => {
  const presentationOrder = siteData.getSectionOrder('presentation');
  assert.ok(presentationOrder.indexOf('layout') < presentationOrder.indexOf('model'));
  assert.match(css, /html\[data-mode="presentation"\] \.viewer-shell \{ max-width: 840px;/);
  assert.match(css, /\.layout-primary img,[\s\S]*?\.layout-technical img \{[^}]*object-fit: contain;/);
  assert.match(css, /\.heatmap-card img \{ width: 100%; height: auto; object-fit: contain;/);
});

test('viewer zoom envelope is explicit, preserves orbit freedom and contains every reset or focus state', () => {
  const { camera, hotspot } = siteData.model;
  const { limits } = camera;
  assert.deepEqual(limits, {
    minOrbit: 'auto auto 4.2m',
    maxOrbit: 'auto auto 28m',
    minRadiusM: 4.2,
    maxRadiusM: 28,
    minFieldOfView: '24deg',
    maxFieldOfView: '48deg'
  });
  assert.match(html, /min-camera-orbit="auto auto 4\.2m"/);
  assert.match(html, /max-camera-orbit="auto auto 28m"/);
  assert.match(client, /function applyViewerCameraLimits\(\)/);
  assert.match(client, /applyViewerCameraLimits\(\);\s*applyDefaultViewerCamera\(\);/);
  assert.ok(orbitRadius(camera.desktopOrbit) >= limits.minRadiusM && orbitRadius(camera.desktopOrbit) <= limits.maxRadiusM);
  assert.ok(orbitRadius(camera.compactOrbit) >= limits.minRadiusM && orbitRadius(camera.compactOrbit) <= limits.maxRadiusM);
  assert.ok(orbitRadius(hotspot.focusOrbit) >= limits.minRadiusM && orbitRadius(hotspot.focusOrbit) <= limits.maxRadiusM);
});

test('authoritative layout card stays content-height and Firefox-safe typography has explicit metrics', () => {
  assert.match(css, /\.layout-grid \{[^}]*align-items: start;/);
  assert.match(css, /\.layout-primary \{ align-self: start; \}/);
  assert.match(css, /\.layout-side \{[^}]*align-content: start;/);
  assert.doesNotMatch(css, /font-family:\s*Inter/);
  assert.doesNotMatch(css, /font-weight:\s*820/);
  assert.match(css, /figcaption strong \{[^}]*line-height: 1\.3;[^}]*overflow-wrap: break-word;/);
  assert.match(css, /\.calculator legend \{[^}]*max-width: calc\(100% - 16px\);[^}]*line-height: 1\.2;[^}]*overflow-wrap: break-word;/);
});

test('Presentation has four ordinary seasonal maps in Summer-to-Spring order', () => {
  assert.deepEqual(siteData.solar.seasons.map(({ label }) => label), ['Summer', 'Autumn', 'Winter', 'Spring']);
  const seasons = [...html.matchAll(/data-presentation-solar-map data-season="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(seasons, ['summer', 'autumn', 'winter', 'spring']);
  assert.match(html, /How to read the maps/);
  assert.match(html, /Nearby trees and buildings are not surveyed in full/);
});

test('Calculator solar summaries remain derived from the unchanged shared R4 result source', () => {
  const solarResults = JSON.parse(fs.readFileSync(path.join(siteRoot, 'data', 'garden_v0_15_solar_results_r4.json'), 'utf8'));
  const table = siteData.deriveWholeFieldTable(solarResults);
  assert.deepEqual(table.map(({ label }) => label), ['Summer', 'Autumn', 'Winter', 'Spring']);
  for (const season of table) {
    for (const scenario of ['baseline', 'likely', 'conservative']) {
      assert.ok(Number.isFinite(season.values[scenario]));
      assert.ok(season.values[scenario] >= 0 && season.values[scenario] <= 9);
    }
  }
  const winterLikely = siteData.deriveWholeField(solarResults.zone_summaries, 'winter', 'likely', 330);
  assert.equal(winterLikely.receiverCount, 5220);
  assert.equal(winterLikely.bearing, 330);
  assert.equal(siteData.dataPaths.solarResults, 'data/garden_v0_15_solar_results_r4.json');
});

test('Presentation does not expose the Rhizome marker or technical Rhizome callout', () => {
  assert.match(html, /class="viewer-hotspot"[^>]*hidden disabled tabindex="-1"/);
  assert.match(html, /class="feature-callout" data-mode-only="calculator"/);
  assert.match(html, /<strong data-mode-only="presentation">Curved feature bed<\/strong>/);
  assert.doesNotMatch(html, /data-mode-only="presentation"[^>]*>[^<]*Rhizome/i);
});

test('calculator identity is deterministic and excludes arbitrary material or settlement fields', () => {
  assert.equal((html.match(/assets\/material-profiles\.js/g) || []).length, 1);
  assert.match(html, /<select id="material-profile" name="profileId"/);
  assert.doesNotMatch(html, /id="material-name"|name="materialName"/);
  assert.doesNotMatch(html, /id="settlement|name="settlement/i);
  assert.match(client, /GardenMaterialProfiles/);
  assert.match(client, /Choose a supported bulk material/);
  assert.doesNotMatch(client, /profileSelect\.value = profilesApi\.profiles\[0\]\.id/);
  assert.match(client, /profilesApi\.orderModes\.forEach/);
  assert.doesNotMatch(html, /<option value="(?:volume|bags|bulk)">/);
  assert.equal(materials.profiles.length, 5);
});

test('calculator labels, units, announcements and validation hooks are explicit', () => {
  for (const phrase of [
    'Finished layer depth (mm)',
    'Waste allowance (%)',
    'Declared bulk density (kg/m³)',
    'Declared bag volume (litres)',
    'Supplier bulk increment (m³)',
    'area m² × depth m',
    'volume m³ × declared density kg/m³'
  ]) assert.ok(html.includes(phrase), `Missing calculator phrase: ${phrase}`);
  assert.match(html, /id="calculator-message" role="alert"/);
  assert.match(html, /id="calculation-status" role="status" aria-live="polite"/);
  assert.match(html, /id="calculator-results" role="status" aria-live="polite"/);
  assert.match(client, /focus\(\{ preventScroll: true \}\)/);
});

test('static accessibility contract has unique IDs, labelled controls and useful image alternatives', () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual(duplicates, []);
  assert.match(html, /<a class="skip-link" href="#main">/);
  assert.match(html, /<main id="main">/);
  assert.match(html, /aria-label="Primary navigation"/);
  assert.match(html, /aria-controls="primary-nav" aria-expanded="false"/);
  assert.match(html, /<fieldset class="mode-control"/);
  assert.match(html, /<legend>Website view<\/legend>/);
  for (const image of html.matchAll(/<img\b([^>]*)>/g)) {
    const alt = image[1].match(/\balt="([^"]*)"/);
    assert.ok(alt && alt[1].trim(), `Image lacks a useful alt attribute: ${image[0]}`);
  }
  for (const control of html.matchAll(/<(input|select)\b([^>]*)>/g)) {
    assert.match(control[2], /\b(?:name|id)="[^"]+"/, `Control lacks a stable name or id: ${control[0]}`);
  }
});

test('primary small-text colour pairs meet WCAG AA contrast and focus uses a dual-colour ring', () => {
  for (const [foreground, background] of [
    ['#647068', '#f7f3ea'],
    ['#a85533', '#f7f3ea'],
    ['#a33b2b', '#fffdf8'],
    ['#854527', '#f2e2d7'],
    ['#ffffff', '#173f33'],
    ['#17211c', '#b9c9aa']
  ]) {
    assert.ok(contrastRatio(foreground, background) >= 4.5, `${foreground} on ${background} is below 4.5:1`);
  }
  assert.match(css, /:focus-visible \{[^}]*outline: 3px solid #f1a866;[^}]*box-shadow: 0 0 0 5px var\(--ink\);/s);
});

test('mode switching retains URL state, practical section context and Back/Forward handling', () => {
  assert.equal(siteData.resolveMode('?mode=calculator'), 'calculator');
  assert.equal(siteData.resolveMode('?mode=presentation'), 'presentation');
  assert.equal(siteData.resolveMode('?mode=unknown'), 'presentation');
  assert.match(client, /searchParams\.set\('mode', mode\)/);
  assert.match(client, /dataApi\.sectionKeyForMode\(mode, sectionKey\)/);
  assert.match(client, /document\.createDocumentFragment\(\)/);
  assert.match(client, /main\.append\(fragment\)/);
  assert.doesNotMatch(client, /section\.style\.order/);
  assert.match(client, /history\[historyMode === 'replace' \? 'replaceState' : 'pushState'\]/);
  assert.match(client, /addEventListener\('popstate'/);
  assert.match(client, /garden-v0\.21-calculator-state/);
});

test('responsive rules cover intermediate, mobile and narrow widths without crop-forcing maps', () => {
  for (const breakpoint of ['1100', '940', '720', '480']) {
    assert.match(css, new RegExp(`@media \\(max-width: ${breakpoint}px\\)`));
  }
  assert.match(css, /@media \(max-width: 1100px\)[\s\S]*\.nav-toggle \{ display: inline-flex/);
  assert.match(css, /@media \(max-width: 940px\)[\s\S]*\.split-heading \{ align-items: flex-start; flex-direction: column;/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.heatmap-card img \{ height: auto; aspect-ratio: auto;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /:focus-visible/);
});

test('protected R4 model and adopted solar/report assets remain byte-identical', () => {
  const expected = {
    '3d/garden_v0_18_primary_interactive_model_r4.glb': '37721f8b5d4c650cc4314a90f31887998cbbe080acff58c81fd2980562d06845',
    'solar/v0_18/garden_v0_18_solar_summer_likely_b330_r1.png': '473c16e6bc92c815bada70ded36d12fd2e896f91c8f10034e57eec04894a4fae',
    'solar/v0_18/garden_v0_18_solar_autumn_likely_b330_r1.png': '4a505ddea88d1d8f77f576067ecdcbf5c77dc0b1794f5569a804222cd0500042',
    'solar/v0_18/garden_v0_18_solar_winter_likely_b330_r1.png': 'ee7e21d2ab1f6fd6eb941ad83a5fe8afaba5968f22ee50a00629a455af0c39bc',
    'solar/v0_18/garden_v0_18_solar_spring_likely_b330_r1.png': '626fa2a167776b932d9685e639d86feafa1b14ca5893d878e58dbba70bd1f652',
    'documents/garden_v0_20_four_season_solar_summary_r6.pdf': 'da17984373c3e9bc607804f9f244bb24393a7c056da620fd00c2f3dfafb2c1e6'
  };
  for (const [relativePath, expectedHash] of Object.entries(expected)) {
    assert.equal(sha256(relativePath), expectedHash, relativePath);
  }
  assert.equal(siteData.model.expectedSha256, expected['3d/garden_v0_18_primary_interactive_model_r4.glb']);
});

test('all local HTML assets and every shared download target exist', () => {
  for (const reference of localReferences(html)) {
    assert.ok(fs.existsSync(path.join(siteRoot, ...reference.split('/'))), `Missing HTML target: ${reference}`);
  }
  for (const item of [...siteData.downloads.documents, ...siteData.downloads.technical]) {
    assert.ok(fs.existsSync(path.join(siteRoot, ...item.href.split('/'))), `Missing download target: ${item.href}`);
  }
});

test('local viewer runtime, retry policy, reset control and direct model link remain present', () => {
  assert.match(html, /assets\/vendor\/model-viewer-4\.3\.1\.min\.js/);
  assert.match(html, /id="viewer-reset"/);
  assert.match(html, /href="3d\/garden_v0_18_primary_interactive_model_r4\.glb" download/);
  assert.match(client, /let retryAttempted = false;/);
  assert.match(client, /if \(!retryAttempted && declaredSource\)/);
  assert.match(client, /viewer\.jumpCameraToGoal\(\)/);
});
