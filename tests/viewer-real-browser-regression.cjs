const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const baseUrl = new URL(process.argv[2] || 'http://127.0.0.1:8765/');
const outputPath = process.argv[3] ? path.resolve(process.argv[3]) : null;
const artifactDirectory = process.argv[4] ? path.resolve(process.argv[4]) : null;
const firefoxPath = process.env.FIREFOX_PATH || 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
const exactFailure = 'Interactive model unavailable — use the static view or model link';

const result = {
  schema: 'garden-v0.21-r2-real-browser-functional-regression/v1',
  startedAtUtc: new Date().toISOString(),
  browser: null,
  checks: {},
  screenshots: {},
  consoleEntries: [],
  network: [],
  pass: false,
};

let browserProcess = null;
let profileDirectory = null;
let ws = null;
let nextId = 1;
const pending = new Map();
let context = null;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForHttp(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await new Promise((resolve) => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve(response.statusCode === 200);
      });
      request.setTimeout(1000, () => request.destroy());
      request.on('error', () => resolve(false));
    });
    if (ready) return;
    await delay(200);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function connectWebSocket(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  while (Date.now() < deadline) {
    const candidate = new WebSocket(url);
    const opened = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, error: new Error('WebSocket open timed out') }), 1500);
      candidate.addEventListener('open', () => {
        clearTimeout(timer);
        resolve({ ok: true });
      }, { once: true });
      candidate.addEventListener('error', (event) => {
        clearTimeout(timer);
        resolve({ ok: false, error: event.error || new Error('WebSocket connection failed') });
      }, { once: true });
    });
    if (opened.ok) return candidate;
    lastError = opened.error;
    try { candidate.close(); } catch {}
    await delay(200);
  }
  throw new Error(`Timed out connecting to ${url}: ${lastError?.message || 'unknown error'}`);
}

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { method, resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

function onMessage(event) {
  const message = JSON.parse(event.data);
  if (Object.prototype.hasOwnProperty.call(message, 'id')) {
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.type === 'error') {
      request.reject(new Error(`${request.method}: ${message.error}: ${message.message}`));
    } else {
      request.resolve(message.result);
    }
    return;
  }
  if (message.method === 'log.entryAdded') {
    result.consoleEntries.push({
      level: message.params?.level || null,
      type: message.params?.type || null,
      text: message.params?.text || null,
      stackTrace: message.params?.stackTrace || null,
    });
  }
  if (message.method === 'network.responseCompleted') {
    const response = message.params?.response || {};
    const url = response.url || '';
    if (/model-viewer|\.glb(?:\?|$)|site\.js|index\.html/i.test(url)) {
      result.network.push({
        url,
        status: response.status,
        mimeType: response.mimeType || null,
        bytesReceived: response.bytesReceived ?? null,
      });
    }
  }
  if (message.method === 'network.fetchError') {
    result.network.push({
      url: message.params?.request?.url || null,
      fetchError: message.params?.errorText || 'unknown',
    });
  }
}

async function evaluateJson(expression) {
  const evaluation = await send('script.evaluate', {
    expression,
    target: { context },
    awaitPromise: true,
    resultOwnership: 'none',
    userActivation: false,
  });
  assert.equal(evaluation.result?.type, 'string', `Expected a JSON string result, got ${evaluation.result?.type}`);
  return JSON.parse(evaluation.result.value);
}

async function viewerState(includeRenderedFrame = false) {
  return evaluateJson(`(async () => {
    const viewer = document.querySelector('#garden-viewer');
    const status = document.querySelector('#viewer-status');
    const hotspot = viewer?.querySelector('[slot="hotspot-rhizome"]');
    const canvases = Array.from(viewer?.shadowRoot?.querySelectorAll('canvas') || []);
    const poster = viewer?.shadowRoot?.querySelector('.slot.poster');
    const rect = viewer?.getBoundingClientRect();
    const canvasRect = canvases
      .map((canvas) => canvas.getBoundingClientRect())
      .sort((left, right) => (right.width * right.height) - (left.width * left.height))[0] || null;
    const orbit = viewer?.getCameraOrbit?.();
    const target = viewer?.getCameraTarget?.();
    let renderedFrame = null;
    try {
      renderedFrame = ${includeRenderedFrame ? "viewer?.toDataURL?.('image/png') || null" : "null"};
      if (renderedFrame && typeof renderedFrame.then === 'function') renderedFrame = await renderedFrame;
    } catch (_) {}
    const hotspotStyle = hotspot ? getComputedStyle(hotspot) : null;
    return JSON.stringify({
      url: location.href,
      mode: document.documentElement.dataset.mode,
      customElementRegistered: Boolean(customElements.get('model-viewer')),
      loaded: Boolean(viewer?.loaded),
      modelIsVisible: Boolean(viewer?.modelIsVisible),
      loadState: viewer?.dataset.loadState || null,
      src: viewer?.getAttribute('src') || null,
      status: status?.textContent?.trim() || null,
      fallback: Boolean(status?.classList.contains('fallback')),
      exactFailureVisible: Boolean(status && status.textContent.trim() === ${JSON.stringify(exactFailure)} && status.getClientRects().length),
      rect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
      canvasRect: canvasRect ? { width: canvasRect.width, height: canvasRect.height } : null,
      canvasCount: canvases.length,
      posterDisplay: poster ? getComputedStyle(poster).display : null,
      camera: orbit && target ? {
        theta: orbit.theta,
        phi: orbit.phi,
        radius: orbit.radius,
        target: { x: target.x, y: target.y, z: target.z },
        fieldOfView: viewer.getFieldOfView?.() ?? null
      } : null,
      cameraAttributes: {
        orbit: viewer?.getAttribute('camera-orbit') || null,
        target: viewer?.getAttribute('camera-target') || null,
        fieldOfView: viewer?.getAttribute('field-of-view') || null,
        minOrbit: viewer?.getAttribute('min-camera-orbit') || null,
        maxOrbit: viewer?.getAttribute('max-camera-orbit') || null,
        minFieldOfView: viewer?.getAttribute('min-field-of-view') || null,
        maxFieldOfView: viewer?.getAttribute('max-field-of-view') || null
      },
      renderedFrame,
      hotspot: hotspot ? {
        accessibleName: hotspot.getAttribute('aria-label'),
        ariaHidden: hotspot.getAttribute('aria-hidden'),
        text: hotspot.textContent.trim(),
        childElementCount: hotspot.childElementCount,
        hidden: hotspot.hidden,
        disabled: hotspot.disabled,
        tabIndex: hotspot.tabIndex,
        display: hotspotStyle.display,
        visibility: hotspotStyle.visibility,
        outlineStyle: hotspotStyle.outlineStyle,
        outlineWidth: hotspotStyle.outlineWidth,
        outlineOffset: hotspotStyle.outlineOffset
      } : null,
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      staticViewHref: document.querySelector('a[href="realistic/garden_v0_18_left_side_perspective_r4.png"]')?.href || null,
      modelLinkHref: document.querySelector('a[href="3d/garden_v0_18_primary_interactive_model_r4.glb"]')?.href || null,
      qaState: window.GARDEN_VIEWER_QA || null
    });
  })()`);
}

async function pageLayoutState() {
  return evaluateJson(`(() => {
    const displayed = (node) => Boolean(node && node.getClientRects().length);
    const inViewport = (node) => {
      if (!displayed(node)) return false;
      const rect = node.getBoundingClientRect();
      return rect.bottom >= 0 && rect.right >= 0 && rect.top <= innerHeight && rect.left <= innerWidth;
    };
    const headingIssues = Array.from(document.querySelectorAll('h1, h2, h3'))
      .filter(displayed)
      .map((heading) => {
        const rect = heading.getBoundingClientRect();
        return {
          text: heading.textContent.trim(),
          left: rect.left,
          right: rect.right,
          clientWidth: heading.clientWidth,
          scrollWidth: heading.scrollWidth
        };
      })
      .filter((heading) => heading.left < -1 || heading.right > innerWidth + 1 || heading.scrollWidth > heading.clientWidth + 1);
    const imageIssues = Array.from(document.images)
      .filter(inViewport)
      .filter((image) => !image.complete || image.naturalWidth === 0)
      .map((image) => image.getAttribute('src'));
    const layoutPrimary = document.querySelector('.layout-primary');
    const layoutPrimaryLink = layoutPrimary?.querySelector(':scope > a');
    const layoutPrimaryCaption = layoutPrimary?.querySelector(':scope > figcaption');
    const layoutPrimaryHeight = layoutPrimary?.getBoundingClientRect().height || 0;
    const layoutPrimaryContentHeight = (layoutPrimaryLink?.getBoundingClientRect().height || 0) + (layoutPrimaryCaption?.getBoundingClientRect().height || 0) + 2;
    return JSON.stringify({
      mode: document.documentElement.dataset.mode,
      viewport: { width: innerWidth, height: innerHeight },
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      headingIssues,
      imageIssues,
      layoutPrimary: displayed(layoutPrimary) ? {
        height: layoutPrimaryHeight,
        contentHeight: layoutPrimaryContentHeight,
        artificialBlankHeight: Math.max(0, layoutPrimaryHeight - layoutPrimaryContentHeight)
      } : null,
      visibleSections: Array.from(document.querySelectorAll('[data-section-key]')).filter(displayed).map((section) => section.dataset.sectionKey),
      calculatorVisible: displayed(document.querySelector('#calculator')),
      seasonalMaps: Array.from(document.querySelectorAll('[data-presentation-solar-map]')).filter(displayed).map((map) => map.dataset.season)
    });
  })()`);
}

async function calculatorFunctionalState() {
  const ready = await evaluateJson(`(async () => {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline && !document.querySelector('input[name="region"]')) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return JSON.stringify({ ready: Boolean(document.querySelector('input[name="region"]')) });
  })()`);
  assert.equal(ready.ready, true, 'Calculator regions did not load');

  const invalid = await evaluateJson(`(() => {
    sessionStorage.removeItem('garden-v0.21-calculator-state');
    const form = document.querySelector('#material-calculator');
    form.querySelectorAll('input[name="region"]').forEach((input) => { input.checked = false; });
    form.elements.depthMm.value = '';
    form.requestSubmit();
    return JSON.stringify({
      message: document.querySelector('#calculator-message').textContent.trim(),
      profileError: document.querySelector('#profile-error').textContent.trim(),
      areaError: document.querySelector('#area-error').textContent.trim(),
      depthError: document.querySelector('#depth-error').textContent.trim(),
      activeName: document.activeElement?.name || null,
      resultState: document.querySelector('#calculator-results').dataset.state
    });
  })()`);
  assert.match(invalid.message, /highlighted calculator inputs/i);
  assert.match(invalid.profileError, /supported bulk-material profile/i);
  assert.match(invalid.areaError, /Select at least one application area/i);
  assert.match(invalid.depthError, /required/i);
  assert.equal(invalid.activeName, 'profileId');
  assert.equal(invalid.resultState, 'empty');

  const valid = await evaluateJson(`(() => {
    const form = document.querySelector('#material-calculator');
    const firstRegion = form.querySelector('input[name="region"]');
    firstRegion.checked = true;
    form.elements.profileId.value = 'drainage-gravel';
    form.elements.depthMm.value = '50';
    form.elements.wastePercent.value = '10';
    form.elements.densityKgM3.value = '1600';
    form.elements.densitySource.value = 'Visible Firefox QA declared source';
    form.elements.orderMode.value = 'bags';
    form.elements.orderMode.dispatchEvent(new Event('change', { bubbles: true }));
    form.elements.bagLitres.value = '40';
    form.requestSubmit();
    return JSON.stringify({
      qa: window.GARDEN_CALCULATOR_QA || null,
      message: document.querySelector('#calculator-message').textContent.trim(),
      resultState: document.querySelector('#calculator-results').dataset.state,
      area: document.querySelector('#result-area').textContent.trim(),
      finished: document.querySelector('#result-finished-m3').textContent.trim(),
      planning: document.querySelector('#result-planning-m3').textContent.trim(),
      order: document.querySelector('#result-order-primary').textContent.trim(),
      mass: document.querySelector('#result-mass').textContent.trim(),
      assumptions: document.querySelector('#calculation-assumptions').textContent.trim()
    });
  })()`);
  assert.equal(valid.message, '');
  assert.equal(valid.resultState, 'ready');
  assert.equal(valid.qa.profileId, 'drainage-gravel');
  assert.equal(valid.qa.result.finishedM3, valid.qa.result.areaM2 * 0.05);
  assert.ok(Math.abs(valid.qa.result.planningM3 - valid.qa.result.finishedM3 * 1.1) < 1e-10);
  assert.ok(Math.abs(valid.qa.result.planningMassKg - valid.qa.result.planningM3 * 1600) < 1e-8);
  assert.equal(valid.qa.result.bagCount, Math.ceil(valid.qa.result.planningLitres / 40));
  assert.match(valid.assumptions, /Visible Firefox QA declared source/);
  return { invalid, valid };
}

async function verifyDownloadEndpoints() {
  const endpoints = await evaluateJson(`(async () => {
    const targets = [
      '2d/garden_v0_16_layout_overview.pdf',
      'documents/garden_v0_16_project_summary.pdf',
      'documents/garden_v0_20_four_season_solar_summary_r6.pdf',
      'data/garden_v0_16_region_manifest_r1.json'
    ];
    const results = [];
    for (const target of targets) {
      const response = await fetch(target, { method: 'HEAD' });
      results.push({ target, ok: response.ok, status: response.status, contentType: response.headers.get('content-type') });
    }
    return JSON.stringify(results);
  })()`);
  endpoints.forEach((endpoint) => assert.equal(endpoint.ok, true, `${endpoint.target} returned HTTP ${endpoint.status}`));
  return endpoints;
}

function frameEvidence(state, label) {
  assert.match(state.renderedFrame || '', /^data:image\/png;base64,/, `${label}: model-viewer did not expose a rendered PNG frame`);
  const bytes = Buffer.from(state.renderedFrame.split(',', 2)[1], 'base64');
  assert.ok(bytes.length > 10000, `${label}: rendered frame was unexpectedly small (${bytes.length} bytes)`);
  return { bytes: bytes.length, sha256: sha256(bytes) };
}

function assertViewerReady(state, label) {
  assert.notEqual(state.status, exactFailure, `${label}: exact human fallback is displayed`);
  assert.equal(state.exactFailureVisible, false, `${label}: exact human fallback is visibly rendered`);
  assert.equal(state.fallback, false, `${label}: viewer is in fallback state`);
  assert.equal(state.customElementRegistered, true, `${label}: model-viewer is not registered`);
  assert.equal(state.loaded, true, `${label}: model load did not complete`);
  assert.equal(state.modelIsVisible, true, `${label}: model is not visible`);
  assert.equal(state.loadState, 'visible', `${label}: runtime did not reach visible state`);
  assert.ok(state.rect?.width > 300 && state.rect?.height > 300, `${label}: viewer area is too small`);
  assert.ok(state.canvasRect?.width > 300 && state.canvasRect?.height > 300, `${label}: render canvas is blank or zero-sized`);
  assert.equal(state.posterDisplay, 'none', `${label}: static poster still covers the rendered model`);
  assert.equal(state.horizontalOverflow, 0, `${label}: horizontal overflow detected`);
  assert.equal(state.hotspot?.accessibleName, 'Rhizome bed', `${label}: Rhizome marker lost its accessible name`);
  assert.equal(state.hotspot?.text, '', `${label}: visible Rhizome marker text returned`);
  assert.equal(state.hotspot?.childElementCount, 0, `${label}: Rhizome marker contains a visible text child`);
  if (state.mode === 'presentation') {
    assert.equal(state.hotspot?.hidden, true, `${label}: Presentation Rhizome marker is not hidden`);
    assert.equal(state.hotspot?.disabled, true, `${label}: Presentation Rhizome hotspot remains keyboard-operable`);
    assert.equal(state.hotspot?.tabIndex, -1, `${label}: Presentation Rhizome hotspot remains in the tab order`);
    assert.equal(state.hotspot?.display, 'none', `${label}: Presentation Rhizome marker remains visible`);
    assert.equal(state.hotspot?.ariaHidden, 'true', `${label}: Presentation Rhizome hotspot is not removed from the accessibility tree`);
  } else {
    assert.equal(state.hotspot?.hidden, false, `${label}: Calculator Rhizome marker is hidden`);
    assert.equal(state.hotspot?.disabled, false, `${label}: Calculator Rhizome hotspot is disabled`);
    assert.equal(state.hotspot?.tabIndex, 0, `${label}: Calculator Rhizome hotspot is not keyboard reachable`);
    assert.notEqual(state.hotspot?.display, 'none', `${label}: Calculator Rhizome marker is not visible`);
    assert.equal(state.hotspot?.ariaHidden, null, `${label}: Calculator Rhizome hotspot remains hidden from assistive technology`);
  }
  assert.ok(state.staticViewHref, `${label}: static fallback link is missing`);
  assert.ok(state.modelLinkHref, `${label}: direct model link is missing`);
  return frameEvidence(state, label);
}

async function waitForViewer(label, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  let state = null;
  while (Date.now() < deadline) {
    state = await viewerState(false);
    if (state.status === exactFailure || state.exactFailureVisible) {
      assertViewerReady(state, label);
    }
    if (
      state.loaded &&
      state.modelIsVisible &&
      state.loadState === 'visible' &&
      state.canvasRect?.width > 300 &&
      state.canvasRect?.height > 300 &&
      state.posterDisplay === 'none'
    ) {
      const renderedState = await viewerState(true);
      const frame = assertViewerReady(renderedState, label);
      return { state: renderedState, frame };
    }
    await delay(200);
  }
  assertViewerReady(state || {}, label);
  throw new Error(`${label}: timed out waiting for a rendered model`);
}

function gardenUrl(mode, marker) {
  const url = new URL(baseUrl);
  url.searchParams.set('mode', mode);
  url.searchParams.set('qa', marker);
  url.hash = 'model';
  return url.href;
}

async function navigateAndWait(mode, marker, label) {
  await send('browsingContext.navigate', {
    context,
    url: gardenUrl(mode, marker),
    wait: 'complete',
  });
  return waitForViewer(label);
}

async function capture(name) {
  if (!artifactDirectory) return null;
  fs.mkdirSync(artifactDirectory, { recursive: true });
  const screenshot = await send('browsingContext.captureScreenshot', {
    context,
    format: { type: 'image/jpeg', quality: 0.92 },
    origin: 'viewport',
  });
  const bytes = Buffer.from(screenshot.data, 'base64');
  const filePath = path.join(artifactDirectory, name);
  fs.writeFileSync(filePath, bytes);
  const evidence = { path: filePath, bytes: bytes.length, sha256: sha256(bytes) };
  result.screenshots[name] = evidence;
  return evidence;
}

async function clickMode(mode) {
  await evaluateJson(`(() => {
    const control = document.querySelector('input[name="website-view"][value="${mode}"]');
    control.click();
    return JSON.stringify({ clicked: true });
  })()`);
  await delay(500);
  const ready = await waitForViewer(`mode switch to ${mode}`);
  assert.equal(ready.state.mode, mode);
  return ready;
}

async function performOrbit(state) {
  const x = Math.round(state.rect.x + state.rect.width * 0.5);
  const y = Math.round(state.rect.y + state.rect.height * 0.5);
  await send('input.performActions', {
    context,
    actions: [{
      type: 'pointer',
      id: 'mouse',
      parameters: { pointerType: 'mouse' },
      actions: [
        { type: 'pointerMove', x, y, duration: 0, origin: 'viewport' },
        { type: 'pointerDown', button: 0 },
        { type: 'pointerMove', x: x + 130, y: y + 55, duration: 600, origin: 'viewport' },
        { type: 'pointerUp', button: 0 },
      ],
    }],
  });
  await send('input.releaseActions', { context });
  await delay(1000);
}

async function performZoom(state) {
  const x = Math.round(state.rect.x + state.rect.width * 0.5);
  const y = Math.round(state.rect.y + state.rect.height * 0.5);
  await send('input.performActions', {
    context,
    actions: [{
      type: 'wheel',
      id: 'wheel',
      actions: [{
        type: 'scroll',
        x,
        y,
        deltaX: 0,
        deltaY: -420,
        duration: 500,
        origin: 'viewport',
      }],
    }],
  });
  await send('input.releaseActions', { context });
  await delay(1000);
}

async function testCameraEnvelope() {
  const limits = await evaluateJson(`(() => {
    const viewer = document.querySelector('#garden-viewer');
    return JSON.stringify({
      minOrbit: viewer.getAttribute('min-camera-orbit'),
      maxOrbit: viewer.getAttribute('max-camera-orbit'),
      minFieldOfView: viewer.getAttribute('min-field-of-view'),
      maxFieldOfView: viewer.getAttribute('max-field-of-view')
    });
  })()`);
  assert.deepEqual(limits, {
    minOrbit: 'auto auto 4.2m',
    maxOrbit: 'auto auto 28m',
    minFieldOfView: '24deg',
    maxFieldOfView: '48deg'
  });

  async function requestRadius(radius) {
    await evaluateJson(`(() => {
      const viewer = document.querySelector('#garden-viewer');
      viewer.setAttribute('camera-orbit', '38deg 58deg ${radius}m');
      viewer.jumpCameraToGoal();
      return JSON.stringify({ requestedRadius: ${radius} });
    })()`);
    await delay(250);
    return viewerState(false);
  }

  const near = await requestRadius(0.5);
  assert.ok(Math.abs(near.camera.radius - 4.2) < 0.05, `Near camera bound failed: ${near.camera.radius}`);
  const far = await requestRadius(100);
  assert.ok(Math.abs(far.camera.radius - 28) < 0.05, `Far camera bound failed: ${far.camera.radius}`);

  await evaluateJson(`(() => {
    document.querySelector('#viewer-reset').click();
    return JSON.stringify({ clicked: true });
  })()`);
  await delay(300);
  const reset = await viewerState(false);
  assert.ok(Math.abs(reset.camera.radius - 18.5) < 0.05, `Reset escaped camera bounds: ${reset.camera.radius}`);
  return { limits, nearRadius: near.camera.radius, farRadius: far.camera.radius, resetRadius: reset.camera.radius };
}

async function testHotspotKeyboardFocus() {
  await evaluateJson(`(() => {
    document.querySelector('#viewer-reset').focus({ preventScroll: true });
    return JSON.stringify({ focused: document.activeElement?.id || null });
  })()`);
  await send('input.performActions', {
    context,
    actions: [{
      type: 'key',
      id: 'keyboard',
      actions: [
        { type: 'keyDown', value: '\uE004' },
        { type: 'keyUp', value: '\uE004' },
      ],
    }],
  });
  await send('input.releaseActions', { context });
  let focus = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    focus = await evaluateJson(`(() => {
      const hotspot = document.querySelector('[slot="hotspot-rhizome"]');
      const active = document.activeElement;
      const focused = active === hotspot || active?.getAttribute?.('slot') === 'hotspot-rhizome';
      const style = getComputedStyle(hotspot);
      return JSON.stringify({
        activeId: active?.id || null,
        activeTag: active?.tagName || null,
        activeSlot: active?.getAttribute?.('slot') || null,
        focused,
        focusVisible: Boolean(focused && active.matches(':focus-visible')),
        tabIndex: hotspot.tabIndex,
        disabled: hotspot.disabled,
        connected: hotspot.isConnected,
        dataVisible: hotspot.hasAttribute('data-visible'),
        display: style.display,
        visibility: style.visibility,
        pointerEvents: style.pointerEvents,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        outlineOffset: style.outlineOffset
      });
    })()`);
    if (focus.focused) break;
    await send('input.performActions', {
      context,
      actions: [{
        type: 'key',
        id: 'keyboard',
        actions: [
          { type: 'keyDown', value: '\uE004' },
          { type: 'keyUp', value: '\uE004' },
        ],
      }],
    });
    await send('input.releaseActions', { context });
  }
  assert.equal(focus?.focused, true, `Keyboard-modality focus did not reach the Rhizome marker: ${JSON.stringify(focus)}`);
  assert.equal(focus.outlineStyle, 'solid', 'Rhizome keyboard focus outline is not visible');
  assert.equal(focus.outlineWidth, '3px', 'Rhizome keyboard focus outline width changed');
  assert.equal(focus.outlineOffset, '4px', 'Rhizome keyboard focus outline offset changed');

  await send('input.performActions', {
    context,
    actions: [{
      type: 'key',
      id: 'keyboard',
      actions: [
        { type: 'keyDown', value: '\uE007' },
        { type: 'keyUp', value: '\uE007' },
      ],
    }],
  });
  await send('input.releaseActions', { context });
  await delay(300);
  const activation = await viewerState();
  assert.equal(activation.status, 'Rhizome bed focused', 'Keyboard activation did not focus the Rhizome bed');
  assert.equal(activation.cameraAttributes.target, '5.05m 0.34m -8.25m');
  assert.equal(activation.cameraAttributes.orbit, '25deg 70deg 4.2m');
  assert.equal(activation.hotspot.text, '', 'Keyboard activation exposed Rhizome marker text');
  return { focus, activationStatus: activation.status };
}

async function run() {
  assert.ok(fs.existsSync(firefoxPath), `Firefox not found: ${firefoxPath}`);
  await waitForHttp(baseUrl.href, 5000);

  const remotePort = await freePort();
  profileDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'garden-v021-firefox-'));
  browserProcess = spawn(firefoxPath, [
    '--new-instance',
    '--profile', profileDirectory,
    '--remote-debugging-port', String(remotePort),
    'about:blank',
  ], { stdio: 'ignore', windowsHide: false });
  ws = await connectWebSocket(`ws://127.0.0.1:${remotePort}/session`);
  ws.addEventListener('message', onMessage);

  const session = await send('session.new', {
    capabilities: { alwaysMatch: { acceptInsecureCerts: true, unhandledPromptBehavior: 'dismiss' } },
  });
  result.browser = {
    name: session.capabilities.browserName,
    version: session.capabilities.browserVersion,
    platform: session.capabilities.platformName,
    userAgent: session.capabilities.userAgent,
    headless: session.capabilities['moz:headless'],
  };
  assert.equal(result.browser.name, 'firefox');
  assert.equal(result.browser.headless, false, 'Acceptance run must use ordinary non-headless Firefox');

  await send('session.subscribe', {
    events: ['log.entryAdded', 'network.responseCompleted', 'network.fetchError'],
  });

  for (let attempt = 0; attempt < 300 && !context; attempt += 1) {
    const tree = await send('browsingContext.getTree');
    context = tree.contexts?.[0]?.context || null;
    if (!context) await delay(100);
  }
  if (!context) {
    for (let attempt = 0; attempt < 20 && !context; attempt += 1) {
      try {
        const created = await send('browsingContext.create', { type: 'tab' });
        context = created.context || null;
      } catch {
        await delay(500);
      }
    }
  }
  assert.ok(context, 'Firefox did not expose a top-level browsing context');

  await send('browsingContext.setViewport', {
    context,
    viewport: { width: 1280, height: 900 },
    devicePixelRatio: 1,
  });

  const presentation = await navigateAndWait('presentation', `cold-${Date.now()}`, 'Presentation cold/direct');
  result.checks.presentationColdDirect = { pass: true, frame: presentation.frame };
  await capture('garden_v0_21_r2_presentation_viewer_no_rhizome_marker_firefox_1280x900.jpg');
  result.checks.presentationRhizomeMarkerRemoved = {
    pass: true,
    hidden: presentation.state.hotspot.hidden,
    disabled: presentation.state.hotspot.disabled,
    tabIndex: presentation.state.hotspot.tabIndex,
    display: presentation.state.hotspot.display
  };

  const beforeOrbit = (await waitForViewer('post-hotspot reset')).state;
  await performOrbit(beforeOrbit);
  const afterOrbit = await waitForViewer('orbit interaction');
  assert.ok(
    Math.abs(afterOrbit.state.camera.theta - beforeOrbit.camera.theta) > 0.01 ||
      Math.abs(afterOrbit.state.camera.phi - beforeOrbit.camera.phi) > 0.01,
    'Orbit input did not change the camera',
  );
  assert.notEqual(afterOrbit.frame.sha256, presentation.frame.sha256, 'Orbit input did not change rendered pixels');
  result.checks.orbit = { pass: true, before: presentation.frame.sha256, after: afterOrbit.frame.sha256 };

  const beforeZoom = afterOrbit.state;
  await performZoom(beforeZoom);
  const afterZoom = await waitForViewer('zoom interaction');
  assert.ok(Math.abs(afterZoom.state.camera.radius - beforeZoom.camera.radius) > 0.01, 'Zoom input did not change camera radius');
  assert.notEqual(afterZoom.frame.sha256, afterOrbit.frame.sha256, 'Zoom input did not change rendered pixels');
  result.checks.zoom = { pass: true, beforeRadius: beforeZoom.camera.radius, afterRadius: afterZoom.state.camera.radius };

  await evaluateJson(`(() => {
    document.querySelector('#viewer-reset').click();
    return JSON.stringify({ clicked: true });
  })()`);
  await delay(1800);
  const reset = await waitForViewer('reset');
  assert.equal(reset.state.cameraAttributes.orbit, '38deg 58deg 18.5m');
  assert.equal(reset.state.cameraAttributes.target, '2.9m 0.85m -4.5m');
  assert.equal(reset.state.cameraAttributes.fieldOfView, '32deg');
  assert.ok(Math.abs(reset.state.camera.radius - 18.5) < 0.05, 'Reset did not restore the intended camera radius');
  result.checks.reset = { pass: true, camera: reset.state.camera, attributes: reset.state.cameraAttributes };
  result.checks.cameraEnvelope = { pass: true, ...(await testCameraEnvelope()) };

  const calculatorSwitch = await clickMode('calculator');
  result.checks.presentationToCalculator = { pass: true, frame: calculatorSwitch.frame };
  const hotspot = await testHotspotKeyboardFocus();
  result.checks.calculatorRhizomeMarkerKeyboard = { pass: true, ...hotspot };
  await capture('garden_v0_21_r2_calculator_viewer_rhizome_marker_firefox_1280x900.jpg');
  await evaluateJson(`(() => {
    document.querySelector('#viewer-reset').click();
    return JSON.stringify({ clicked: true });
  })()`);
  await delay(1200);
  const presentationSwitch = await clickMode('presentation');
  result.checks.calculatorToPresentation = { pass: true, frame: presentationSwitch.frame };

  await send('browsingContext.traverseHistory', { context, delta: -1 });
  await delay(500);
  const historyBack = await waitForViewer('history Back');
  assert.equal(historyBack.state.mode, 'calculator');
  await send('browsingContext.traverseHistory', { context, delta: 1 });
  await delay(500);
  const historyForward = await waitForViewer('history Forward');
  assert.equal(historyForward.state.mode, 'presentation');
  result.checks.historyBackForward = { pass: true };

  await send('browsingContext.reload', { context, wait: 'complete' });
  const reload = await waitForViewer('reload');
  result.checks.reload = { pass: true, frame: reload.frame };

  const calculatorDirect = await navigateAndWait('calculator', `direct-${Date.now()}`, 'Calculator cold/direct');
  result.checks.calculatorColdDirect = { pass: true, frame: calculatorDirect.frame };
  await evaluateJson(`(() => {
    document.querySelector('#calculator').scrollIntoView({ block: 'start' });
    return JSON.stringify({ scrolled: true });
  })()`);
  const calculatorFunctional = await calculatorFunctionalState();
  result.checks.calculatorValidationAndResult = { pass: true, ...calculatorFunctional };
  const calculatorLayout = await pageLayoutState();
  assert.deepEqual(calculatorLayout.visibleSections, ['overview', 'layout', 'materials', 'realistic', 'model', 'solar', 'downloads']);
  assert.equal(calculatorLayout.calculatorVisible, true);
  assert.equal(calculatorLayout.horizontalOverflow, 0);
  result.checks.calculatorSectionHierarchy = { pass: true, ...calculatorLayout };
  await capture('garden_v0_21_r2_calculator_quantity_result_firefox_1280x900.jpg');
  result.checks.downloadEndpoints = { pass: true, endpoints: await verifyDownloadEndpoints() };

  await send('browsingContext.setViewport', {
    context,
    viewport: { width: 1280, height: 900 },
    devicePixelRatio: 1,
  });
  const solarPresentation = await navigateAndWait('presentation', `solar-${Date.now()}`, 'Presentation solar direct');
  await evaluateJson(`(async () => {
    document.querySelector('#solar').scrollIntoView({ block: 'start' });
    await Promise.all(Array.from(document.querySelectorAll('[data-presentation-solar-map] img')).map((image) => image.complete ? Promise.resolve() : new Promise((resolve) => image.addEventListener('load', resolve, { once: true }))));
    return JSON.stringify({
      maps: Array.from(document.querySelectorAll('[data-presentation-solar-map]')).filter((map) => map.getClientRects().length).length,
      labels: Array.from(document.querySelectorAll('[data-presentation-solar-map] strong')).map((label) => label.textContent.trim()),
      overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
    });
  })()`);
  const solarState = await evaluateJson(`(() => JSON.stringify({
    maps: Array.from(document.querySelectorAll('[data-presentation-solar-map]')).filter((map) => map.getClientRects().length).length,
    labels: Array.from(document.querySelectorAll('[data-presentation-solar-map] strong')).map((label) => label.textContent.trim()),
    overflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
  }))()`);
  assert.equal(solarState.maps, 4, 'Presentation does not show exactly four seasonal maps');
  assert.deepEqual(solarState.labels, ['Summer', 'Autumn', 'Winter', 'Spring']);
  assert.equal(solarState.overflow, 0, 'Presentation solar section has horizontal overflow');
  result.checks.presentationFourSeasonSolar = { pass: true, ...solarState, frame: solarPresentation.frame };
  await capture('garden_v0_21_r2_presentation_four_season_solar_firefox_1280x900.jpg');

  await send('browsingContext.setViewport', {
    context,
    viewport: { width: 360, height: 800 },
    devicePixelRatio: 1,
  });
  const compact = await navigateAndWait('presentation', `compact-${Date.now()}`, 'compact Presentation');
  result.checks.compactPresentation = { pass: true, frame: compact.frame, overflow: compact.state.horizontalOverflow };
  await capture('garden_v0_21_r2_presentation_viewer_no_rhizome_marker_firefox_360x800.jpg');

  const responsive = [];
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1100, height: 900 },
    { width: 820, height: 900 },
    { width: 480, height: 820 },
    { width: 360, height: 800 }
  ]) {
    await send('browsingContext.setViewport', { context, viewport, devicePixelRatio: 1 });
    await delay(250);
    const layout = await pageLayoutState();
    assert.equal(layout.horizontalOverflow, 0, `${viewport.width}px: horizontal overflow`);
    assert.deepEqual(layout.headingIssues, [], `${viewport.width}px: clipped or overflowing headings`);
    assert.deepEqual(layout.imageIssues, [], `${viewport.width}px: visible image failed to load`);
    assert.deepEqual(layout.visibleSections, ['overview', 'layout', 'realistic', 'model', 'solar', 'downloads']);
    assert.equal(layout.calculatorVisible, false);
    assert.deepEqual(layout.seasonalMaps, ['summer', 'autumn', 'winter', 'spring']);
    assert.ok(layout.layoutPrimary && layout.layoutPrimary.artificialBlankHeight <= 3, `${viewport.width}px: authoritative layout card is grid-stretched by ${layout.layoutPrimary?.artificialBlankHeight}px`);
    responsive.push(layout);
  }
  result.checks.responsivePresentation = { pass: true, viewports: responsive };

  await evaluateJson(`(() => {
    const viewer = document.querySelector('#garden-viewer');
    viewer.dispatchEvent(new Event('error'));
    return JSON.stringify({ dispatched: 1 });
  })()`);
  await delay(600);
  await evaluateJson(`(() => {
    const viewer = document.querySelector('#garden-viewer');
    viewer.dispatchEvent(new Event('error'));
    return JSON.stringify({ dispatched: 2 });
  })()`);
  await delay(100);
  const negative = await viewerState();
  assert.equal(negative.status, exactFailure, 'Negative control did not create the previously observed fallback');
  let negativeControlCaught = false;
  try {
    assertViewerReady(negative, 'injected exact-fallback negative control');
  } catch (error) {
    negativeControlCaught = /exact human fallback|fallback/i.test(error.message);
  }
  assert.equal(negativeControlCaught, true, 'Regression QA did not fail on the exact human fallback');
  result.checks.exactFallbackNegativeControl = { pass: true, exactMessageCaught: true };

  const unexpectedConsole = result.consoleEntries.filter((entry) => ['error', 'warn'].includes(entry.level));
  assert.deepEqual(unexpectedConsole, [], `Unexpected Firefox console entries: ${JSON.stringify(unexpectedConsole)}`);
  result.checks.console = { pass: true, warningsAndErrors: [] };

  result.finishedAtUtc = new Date().toISOString();
  result.pass = true;
}

async function cleanup() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try { await send('browser.close'); } catch (_) {}
    try { ws.close(); } catch (_) {}
  }
  if (browserProcess && !browserProcess.killed) {
    try { browserProcess.kill(); } catch (_) {}
  }
  if (profileDirectory) {
    const resolved = path.resolve(profileDirectory);
    const temporaryRoot = path.resolve(os.tmpdir());
    if (resolved.startsWith(`${temporaryRoot}${path.sep}`) && path.basename(resolved).startsWith('garden-v021-firefox-')) {
      try { fs.rmSync(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (_) {}
    }
  }
}

run()
  .catch((error) => {
    result.finishedAtUtc = new Date().toISOString();
    result.error = error.stack || String(error);
    result.pass = false;
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    const text = `${JSON.stringify(result, null, 2)}\n`;
    if (outputPath) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, text);
    }
    process.stdout.write(text);
  });
