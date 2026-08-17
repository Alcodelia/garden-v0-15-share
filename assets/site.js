(() => {
  'use strict';

  const dataApi = window.GardenSiteData;
  const calculatorApi = window.GardenCalculator;
  const profilesApi = window.GardenMaterialProfiles;
  if (!dataApi || !calculatorApi || !profilesApi) return;

  const html = document.documentElement;
  const number = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 3 });
  const integer = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 });
  const decimal = new Intl.NumberFormat('en-AU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const state = {
    mode: null,
    sharedData: null,
    wholeField: null,
    sectionDomOrdered: false,
    calculatorInitialised: false,
    viewerInteracted: false,
    viewerResetCount: 0
  };

  function element(selector, scope = document) {
    return scope.querySelector(selector);
  }

  function elements(selector, scope = document) {
    return Array.from(scope.querySelectorAll(selector));
  }

  function isReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isCompact() {
    return window.matchMedia('(max-width: 720px)').matches;
  }

  function formatVolume(value) {
    if (!Number.isFinite(value)) return '—';
    return new Intl.NumberFormat('en-AU', {
      minimumFractionDigits: value < 1 ? 3 : 2,
      maximumFractionDigits: value < 1 ? 3 : 2
    }).format(value);
  }

  function formatLitres(value) {
    if (!Number.isFinite(value)) return '—';
    return value < 100 ? decimal.format(value) : integer.format(value);
  }

  function formatMass(value) {
    if (!Number.isFinite(value)) return '—';
    return value < 100 ? decimal.format(value) : integer.format(value);
  }

  function sectionName(sectionKey, mode = state.mode) {
    const section = dataApi.sectionRegistry[sectionKey] || dataApi.sectionRegistry.overview;
    return section.labels[mode] || section.labels.presentation;
  }

  function currentSectionKey() {
    const candidates = elements('[data-section-key]').filter((candidate) => candidate.offsetParent !== null);
    if (!candidates.length) return 'overview';
    const referenceY = Math.min(180, Math.max(80, window.innerHeight * 0.24));
    const containing = candidates.filter((candidate) => {
      const rect = candidate.getBoundingClientRect();
      return rect.top <= referenceY && rect.bottom > referenceY;
    });
    if (containing.length) return containing[containing.length - 1].dataset.sectionKey;
    return candidates.reduce((best, candidate) => {
      const distance = Math.abs(candidate.getBoundingClientRect().top - referenceY);
      return distance < best.distance ? { key: candidate.dataset.sectionKey, distance } : best;
    }, { key: 'overview', distance: Number.POSITIVE_INFINITY }).key;
  }

  function canonicalSectionKey(mode, sectionKey) {
    return dataApi.sectionKeyForMode(mode, sectionKey);
  }

  function updateModeCopy(mode) {
    const heroCopy = dataApi.copy.hero[mode];
    element('#hero-eyebrow').textContent = heroCopy.eyebrow;
    element('#hero-heading').textContent = heroCopy.heading;
    element('#hero-lede').textContent = heroCopy.lede;
    elements('[data-heading-key]').forEach((heading) => {
      const copy = dataApi.copy.headings[heading.dataset.headingKey];
      if (copy) heading.textContent = copy[mode];
    });
    elements('[data-caveat-key]').forEach((target) => {
      const caveat = dataApi.caveats[target.dataset.caveatKey];
      if (caveat) target.textContent = caveat[mode];
    });
    const sectionOrder = dataApi.getSectionOrder(mode);
    const nav = element('#primary-nav');
    const navLinks = elements('[data-nav-key]', nav || document);
    navLinks.forEach((link) => {
      const section = dataApi.sectionRegistry[link.dataset.navKey];
      if (!section) return;
      link.textContent = section.labels[mode];
      link.href = `#${section.anchor}`;
    });
    if (nav) {
      sectionOrder.forEach((sectionKey) => {
        const link = navLinks.find((candidate) => candidate.dataset.navKey === sectionKey);
        if (link) nav.append(link);
      });
      navLinks.filter((link) => !sectionOrder.includes(link.dataset.navKey)).forEach((link) => nav.append(link));
    }
    elements('input[name="website-view"]').forEach((input) => {
      input.checked = input.value === mode;
    });
    document.title = mode === 'calculator'
      ? 'Garden calculator — Planning evidence and quantities'
      : 'Garden design — Layout, 3D and seasonal sun';
  }

  function establishSectionDomOrder() {
    const main = element('#main');
    if (!main) return;
    const order = dataApi.structuralOrder;
    const sections = elements(':scope > [data-section-key]', main);
    const fragment = document.createDocumentFragment();
    order.forEach((sectionKey) => {
      const section = sections.find((candidate) => candidate.dataset.sectionKey === sectionKey);
      if (section) fragment.append(section);
    });
    sections.filter((section) => !order.includes(section.dataset.sectionKey)).forEach((section) => fragment.append(section));
    main.append(fragment);
    state.sectionDomOrdered = true;
  }

  function readViewerCamera() {
    const viewer = element('#garden-viewer');
    if (!viewer) return null;
    try {
      if (typeof viewer.getCameraOrbit === 'function' && typeof viewer.getCameraTarget === 'function' && typeof viewer.getFieldOfView === 'function') {
        const orbit = viewer.getCameraOrbit();
        const target = viewer.getCameraTarget();
        const fieldOfView = viewer.getFieldOfView();
        return {
          orbit: `${orbit.theta}rad ${orbit.phi}rad ${orbit.radius}m`,
          target: `${target.x}m ${target.y}m ${target.z}m`,
          fieldOfView: `${fieldOfView}deg`
        };
      }
    } catch (_error) {
      // The custom element may not be ready yet; its declared attributes remain authoritative.
    }
    return {
      orbit: viewer.getAttribute('camera-orbit'),
      target: viewer.getAttribute('camera-target'),
      fieldOfView: viewer.getAttribute('field-of-view')
    };
  }

  function restoreViewerCamera(camera) {
    if (!camera) return;
    const viewer = element('#garden-viewer');
    if (!viewer) return;
    viewer.setAttribute('camera-orbit', camera.orbit);
    viewer.setAttribute('camera-target', camera.target);
    viewer.setAttribute('field-of-view', camera.fieldOfView);
    if (isReducedMotion() && typeof viewer.jumpCameraToGoal === 'function') viewer.jumpCameraToGoal();
  }

  function applyViewerCameraLimits() {
    const viewer = element('#garden-viewer');
    if (!viewer) return;
    const limits = dataApi.model.camera.limits;
    viewer.setAttribute('min-camera-orbit', limits.minOrbit);
    viewer.setAttribute('max-camera-orbit', limits.maxOrbit);
    viewer.setAttribute('min-field-of-view', limits.minFieldOfView);
    viewer.setAttribute('max-field-of-view', limits.maxFieldOfView);
  }

  function updateViewerHotspotMode(mode) {
    const viewer = element('#garden-viewer');
    const hotspot = viewer && element('[slot="hotspot-rhizome"]', viewer);
    if (!hotspot) return;
    const calculatorMode = mode === 'calculator';
    if (!calculatorMode && document.activeElement === hotspot) hotspot.blur();
    hotspot.hidden = !calculatorMode;
    hotspot.disabled = !calculatorMode;
    hotspot.tabIndex = calculatorMode ? 0 : -1;
    hotspot.classList.toggle('is-focused', false);
    if (calculatorMode) hotspot.removeAttribute('aria-hidden');
    else hotspot.setAttribute('aria-hidden', 'true');
  }

  function writeModeUrl(mode, sectionKey, historyMode) {
    if (!historyMode) return;
    const next = new URL(window.location.href);
    next.searchParams.set('mode', mode);
    next.hash = dataApi.sectionAnchor(sectionKey);
    window.history[historyMode === 'replace' ? 'replaceState' : 'pushState']({ mode, sectionKey }, '', next);
  }

  function scrollToSection(sectionKey, focusTarget) {
    const anchor = dataApi.sectionAnchor(sectionKey);
    const target = document.getElementById(anchor);
    if (sectionKey === 'overview') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    } else if (target) {
      target.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
    if (focusTarget) {
      const focusElement = document.getElementById(focusTarget);
      if (focusElement) focusElement.focus({ preventScroll: true });
    }
  }

  function announceMode(sectionKey) {
    const status = element('#mode-status');
    if (status) status.textContent = `${state.mode === 'calculator' ? 'Calculator' : 'Presentation'} view, ${sectionName(sectionKey)} section.`;
  }

  function applyMode(mode, options = {}) {
    const resolvedMode = mode === 'calculator' ? 'calculator' : 'presentation';
    const requestedSectionKey = options.sectionKey || currentSectionKey();
    const sectionKey = canonicalSectionKey(resolvedMode, requestedSectionKey);
    const modeChanged = state.mode !== resolvedMode;
    const camera = modeChanged && state.mode !== null ? readViewerCamera() : null;

    state.mode = resolvedMode;
    html.dataset.mode = resolvedMode;
    updateViewerHotspotMode(resolvedMode);
    if (!state.sectionDomOrdered) establishSectionDomOrder();
    updateModeCopy(resolvedMode);
    renderDownloads(resolvedMode);
    updateSolarExplorer();
    recordPresentationSolarState();
    const currentHashIsNonCanonical = Boolean(window.location.hash)
      && window.location.hash !== `#${dataApi.sectionAnchor(sectionKey)}`;
    const historyMode = options.historyMode || (options.canonicalizeUrl && currentHashIsNonCanonical ? 'replace' : null);
    writeModeUrl(resolvedMode, sectionKey, historyMode);

    window.requestAnimationFrame(() => {
      if (camera) restoreViewerCamera(camera);
      if (options.scroll !== false) scrollToSection(sectionKey, options.focusTarget);
      if (options.announce !== false) announceMode(sectionKey);
    });
  }

  function initialiseModeControl() {
    const initialMode = dataApi.resolveMode(window.location.search);
    const initialSection = dataApi.sectionKeyFromAnchor(window.location.hash);
    applyMode(initialMode, { sectionKey: initialSection, scroll: Boolean(window.location.hash), announce: false, canonicalizeUrl: true });
    window.addEventListener('load', () => {
      window.setTimeout(() => {
        if (window.location.hash) scrollToSection(dataApi.sectionKeyFromAnchor(window.location.hash));
      }, 0);
    }, { once: true });

    elements('input[name="website-view"]').forEach((input) => {
      input.addEventListener('change', () => {
        if (!input.checked || input.value === state.mode) return;
        applyMode(input.value, { sectionKey: currentSectionKey(), historyMode: 'push' });
      });
    });

    elements('[data-switch-mode]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        applyMode(link.dataset.switchMode, {
          sectionKey: link.dataset.sectionTarget || currentSectionKey(),
          historyMode: 'push',
          focusTarget: link.dataset.focusTarget || null
        });
      });
    });

    window.addEventListener('popstate', () => {
      applyMode(dataApi.resolveMode(window.location.search), {
        sectionKey: dataApi.sectionKeyFromAnchor(window.location.hash),
        scroll: true,
        announce: true,
        canonicalizeUrl: true
      });
    });
  }

  function initialiseCompactNavigation() {
    const button = element('#nav-toggle');
    const navigation = element('#primary-nav');
    if (!button || !navigation) return;
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(open));
      navigation.dataset.open = String(open);
    });
    elements('a', navigation).forEach((link) => {
      link.addEventListener('click', () => {
        button.setAttribute('aria-expanded', 'false');
        navigation.dataset.open = 'false';
      });
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || button.getAttribute('aria-expanded') !== 'true') return;
      button.setAttribute('aria-expanded', 'false');
      navigation.dataset.open = 'false';
      button.focus();
    });
  }

  function applyDefaultViewerCamera(statusText) {
    const viewer = element('#garden-viewer');
    const status = element('#viewer-status');
    if (!viewer) return;
    const camera = dataApi.model.camera;
    viewer.setAttribute('camera-orbit', isCompact() ? camera.compactOrbit : camera.desktopOrbit);
    viewer.setAttribute('camera-target', camera.target);
    viewer.setAttribute('field-of-view', camera.fieldOfView);
    if (isReducedMotion() && typeof viewer.jumpCameraToGoal === 'function') viewer.jumpCameraToGoal();
    if (statusText && status) status.textContent = statusText;
    recordViewerState(null, 'reset');
  }

  function recordViewerState(event, action) {
    const viewer = element('#garden-viewer');
    const status = element('#viewer-status');
    const hotspot = viewer && element('[slot="hotspot-rhizome"]', viewer);
    if (!viewer) return;
    const camera = readViewerCamera();
    window.GARDEN_VIEWER_QA = {
      action: action || null,
      cameraChangeSource: event && event.detail ? event.detail.source : null,
      orbit: camera ? camera.orbit : null,
      target: camera ? camera.target : null,
      fieldOfView: camera ? camera.fieldOfView : null,
      cameraLimits: {
        minOrbit: viewer.getAttribute('min-camera-orbit'),
        maxOrbit: viewer.getAttribute('max-camera-orbit'),
        minFieldOfView: viewer.getAttribute('min-field-of-view'),
        maxFieldOfView: viewer.getAttribute('max-field-of-view')
      },
      reducedMotion: isReducedMotion(),
      compact: isCompact(),
      source: viewer.getAttribute('src'),
      componentRegistered: Boolean(customElements.get('model-viewer')),
      loaded: Boolean(viewer.loaded),
      modelIsVisible: Boolean(viewer.modelIsVisible),
      loadState: viewer.dataset.loadState || null,
      status: status ? status.textContent.trim() : null,
      fallback: Boolean(status && status.classList.contains('fallback')),
      exactFailureVisible: Boolean(status && status.textContent.trim() === 'Interactive model unavailable — use the static view or model link'),
      hotspotPosition: hotspot ? hotspot.dataset.position : null,
      hotspotAccessibleName: hotspot ? hotspot.getAttribute('aria-label') : null,
      hotspotText: hotspot ? hotspot.textContent.trim() : null,
      hotspotHasChildElements: Boolean(hotspot && hotspot.childElementCount),
      hotspotHidden: Boolean(hotspot && hotspot.hidden),
      hotspotDisabled: Boolean(hotspot && hotspot.disabled),
      hotspotTabIndex: hotspot ? hotspot.tabIndex : null,
      resetCount: state.viewerResetCount
    };
  }

  function initialiseViewer() {
    const status = element('#viewer-status');
    const viewer = element('#garden-viewer');
    const reset = element('#viewer-reset');
    const hotspot = viewer && element('[slot="hotspot-rhizome"]', viewer);
    if (!status || !viewer || !reset) return;

    if (isReducedMotion()) viewer.setAttribute('interaction-prompt', 'none');
    applyViewerCameraLimits();
    applyDefaultViewerCamera();
    const declaredSource = viewer.getAttribute('src');
    let retryAttempted = false;
    let retryTimer = null;
    viewer.dataset.loadState = 'waiting-for-component';

    const fallback = window.setTimeout(() => {
      if (!customElements.get('model-viewer')) {
        status.textContent = 'Interactive component unavailable — use the static view or model link';
        status.classList.remove('ready');
        status.classList.add('fallback');
        viewer.dataset.loadState = 'component-unavailable';
        recordViewerState(null, 'component-unavailable');
      }
    }, 8000);

    customElements.whenDefined('model-viewer').then(() => {
      window.clearTimeout(fallback);
      status.textContent = 'Interactive viewer ready';
      status.classList.remove('fallback');
      status.classList.add('ready');
      viewer.dataset.loadState = 'component-ready';
      recordViewerState(null, 'component-ready');
    });

    viewer.addEventListener('load', () => {
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
      status.textContent = 'Interactive model loaded';
      status.classList.remove('fallback');
      status.classList.add('ready');
      viewer.dataset.loadState = viewer.modelIsVisible ? 'visible' : 'loaded';
      recordViewerState(null, 'load');
    });
    viewer.addEventListener('model-visibility', (event) => {
      viewer.dataset.loadState = event.detail && event.detail.visible ? 'visible' : 'loaded-hidden';
      recordViewerState(event, 'model-visibility');
    });
    viewer.addEventListener('camera-change', (event) => {
      if (event.detail && event.detail.source === 'user-interaction') state.viewerInteracted = true;
      recordViewerState(event, 'camera-change');
    });
    viewer.addEventListener('error', () => {
      if (!retryAttempted && declaredSource) {
        retryAttempted = true;
        status.textContent = 'Retrying interactive model…';
        status.classList.remove('fallback', 'ready');
        viewer.dataset.loadState = 'retrying';
        recordViewerState(null, 'retrying');
        retryTimer = window.setTimeout(() => {
          retryTimer = null;
          const separator = declaredSource.includes('?') ? '&' : '?';
          viewer.setAttribute('src', `${declaredSource}${separator}retry=1`);
        }, 250);
        return;
      }
      if (retryTimer !== null) return;
      status.textContent = 'Interactive model unavailable — use the static view or model link';
      status.classList.remove('ready');
      status.classList.add('fallback');
      viewer.dataset.loadState = 'model-unavailable';
      recordViewerState(null, 'model-unavailable');
    });

    if (hotspot) {
      hotspot.setAttribute('aria-label', dataApi.model.hotspot.accessibleName);
      hotspot.dataset.position = dataApi.model.hotspot.position;
      hotspot.dataset.normal = dataApi.model.hotspot.normal;
      const updateHotspotFocus = () => {
        const active = document.activeElement;
        const markerIsFocused = active === hotspot || Boolean(active && active.getAttribute('slot') === 'hotspot-rhizome');
        hotspot.classList.toggle('is-focused', markerIsFocused);
      };
      document.addEventListener('focusin', updateHotspotFocus, true);
      document.addEventListener('focusout', () => window.requestAnimationFrame(updateHotspotFocus), true);
      document.addEventListener('keyup', (event) => {
        if (event.key === 'Tab') updateHotspotFocus();
      }, true);
      const focusRhizomeBed = () => {
        if (state.mode !== 'calculator' || hotspot.hidden || hotspot.disabled) return;
        const hotspotConfig = dataApi.model.hotspot;
        viewer.setAttribute('camera-target', hotspotConfig.focusTarget);
        viewer.setAttribute('camera-orbit', hotspotConfig.focusOrbit);
        viewer.setAttribute('field-of-view', hotspotConfig.focusFieldOfView);
        status.textContent = 'Rhizome bed focused';
        state.viewerInteracted = true;
        if (isReducedMotion() && typeof viewer.jumpCameraToGoal === 'function') viewer.jumpCameraToGoal();
        recordViewerState(null, 'hotspot');
      };
      hotspot.addEventListener('click', focusRhizomeBed);
      hotspot.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        focusRhizomeBed();
      });
    }

    reset.addEventListener('click', () => {
      state.viewerResetCount += 1;
      state.viewerInteracted = false;
      applyDefaultViewerCamera('Garden view reset');
    });

    const compactQuery = window.matchMedia('(max-width: 720px)');
    if (typeof compactQuery.addEventListener === 'function') {
      compactQuery.addEventListener('change', () => {
        if (!state.viewerInteracted) applyDefaultViewerCamera();
      });
    }
  }

  function renderRegions(regions) {
    const regionList = element('#region-list');
    if (!regionList) return;
    regionList.replaceChildren();
    const selectableRegions = regions.filter((region) => region.selectable);
    selectableRegions.forEach((region) => {
      const label = document.createElement('label');
      label.className = 'region-option';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'region';
      checkbox.value = region.region_id;
      checkbox.setAttribute('aria-describedby', `region-meta-${region.region_id} area-error`);

      const text = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = region.name;
      const meta = document.createElement('span');
      meta.id = `region-meta-${region.region_id}`;
      meta.textContent = `${number.format(region.calculator_area_m2)} m² source area · ${region.tolerance}`;
      const readiness = document.createElement('span');
      readiness.className = `region-readiness${region.ordering_estimate_ready ? '' : ' caution'}`;
      readiness.textContent = region.ordering_estimate_ready ? 'Geometry established' : 'Planning-only area';
      text.append(name, meta, readiness);

      const area = document.createElement('em');
      area.textContent = `${number.format(region.calculator_area_m2)} m²`;
      label.append(checkbox, text, area);
      regionList.append(label);
    });

    const nonSelectable = regions.filter((region) => !region.selectable);
    if (nonSelectable.length) {
      const note = document.createElement('p');
      note.className = 'data-placeholder';
      note.textContent = `Canonical source: ${regions.length} records, ${selectableRegions.length} selectable. ${nonSelectable.map((region) => region.name).join(', ')} remains non-selectable planning context.`;
      regionList.append(note);
    }
    regionList.setAttribute('aria-busy', 'false');
  }

  function renderProfileOptions(select) {
    select.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Choose a supported bulk material';
    placeholder.disabled = true;
    placeholder.selected = true;
    select.append(placeholder);
    profilesApi.listProfiles().forEach((profile) => {
      const option = document.createElement('option');
      option.value = profile.id;
      option.textContent = profile.label;
      select.append(option);
    });
  }

  function renderOrderModeOptions(select) {
    select.replaceChildren();
    profilesApi.orderModes.forEach((orderMode) => {
      const option = document.createElement('option');
      option.value = orderMode.id;
      option.textContent = orderMode.label;
      select.append(option);
    });
  }

  function renderProfileSummary(profile) {
    const summary = element('#profile-summary');
    if (!summary) return;
    summary.replaceChildren();
    if (!profile) {
      const note = document.createElement('p');
      note.textContent = 'Choose a supported profile to see its calculation and evidence policy.';
      summary.append(note);
      return;
    }

    const heading = document.createElement('h3');
    heading.textContent = profile.label;
    const description = document.createElement('p');
    description.textContent = profile.description;
    const scope = document.createElement('p');
    scope.className = 'profile-scope';
    scope.textContent = profile.scopeNote;
    const properties = document.createElement('dl');
    [
      ['Volume basis', 'Selected area × user-entered finished depth'],
      ['Depth input', `${profile.applicationDepth.minMm}–${profile.applicationDepth.maxMm.toLocaleString('en-AU')} mm calculator guardrail; no profile depth is prescribed`],
      ['Result units', 'm³ and litres; optional kilograms; whole declared supplier units'],
      ['Density', 'No default; declared value and source required for mass'],
      ['Waste', '0% default; user-entered and applied once'],
      ['Compaction', 'Not modelled by this generic calculator']
    ].forEach(([termText, valueText]) => {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      term.textContent = termText;
      const value = document.createElement('dd');
      value.textContent = valueText;
      row.append(term, value);
      properties.append(row);
    });
    summary.append(heading, description, scope, properties);
  }

  function initialiseCalculator(regions) {
    if (state.calculatorInitialised) return;
    const form = element('#material-calculator');
    const regionList = element('#region-list');
    if (!form || !regionList) return;
    state.calculatorInitialised = true;
    const selectableRegions = regions.filter((region) => region.selectable);
    const resultIds = {
      area: element('#result-area'),
      finishedM3: element('#result-finished-m3'),
      finishedLitres: element('#result-finished-litres'),
      planningM3: element('#result-planning-m3'),
      planningLitres: element('#result-planning-litres'),
      orderLabel: element('#result-order-label'),
      orderPrimary: element('#result-order-primary'),
      orderDetail: element('#result-order-detail'),
      mass: element('#result-mass'),
      massDetail: element('#result-mass-detail')
    };
    const message = element('#calculator-message');
    const assumptions = element('#calculation-assumptions');
    const calculationStatus = element('#calculation-status');
    const results = element('#calculator-results');
    const profileSelect = form.elements.profileId;
    const bagField = element('#bag-field');
    const bulkField = element('#bulk-field');
    const bagInput = form.elements.bagLitres;
    const bulkInput = form.elements.bulkIncrementM3;
    const storageKey = 'garden-v0.21-calculator-state';

    renderProfileOptions(profileSelect);
    renderOrderModeOptions(form.elements.orderMode);

    function updateProfile() {
      renderProfileSummary(profilesApi.getProfile(profileSelect.value));
    }

    function updateOrderFields() {
      const orderMode = form.elements.orderMode.value;
      const bags = orderMode === 'bags';
      const bulk = orderMode === 'bulk';
      bagField.hidden = !bags;
      bulkField.hidden = !bulk;
      bagInput.disabled = !bags;
      bulkInput.disabled = !bulk;
    }

    function selectedRegions() {
      const ids = new Set(elements('input[name="region"]:checked', form).map((input) => input.value));
      return selectableRegions.filter((region) => ids.has(region.region_id));
    }

    function resetMessages() {
      message.textContent = '';
      elements('[data-error-for]', form).forEach((target) => { target.textContent = ''; });
      elements('[aria-invalid="true"]', form).forEach((target) => target.removeAttribute('aria-invalid'));
    }

    function controlForField(field) {
      if (field === 'areaM2') return element('input[name="region"]', form);
      const control = form.elements[field];
      return control && typeof control.focus === 'function' ? control : null;
    }

    function showFieldErrors(fieldErrors, focusFirst) {
      const entries = Object.entries(fieldErrors);
      entries.forEach(([field, text]) => {
        const error = element(`[data-error-for="${field}"]`, form);
        if (error) error.textContent = text;
        const input = controlForField(field);
        if (input && input.setAttribute) input.setAttribute('aria-invalid', 'true');
      });
      if (focusFirst && entries.length) {
        const first = controlForField(entries[0][0]);
        if (first) first.focus({ preventScroll: false });
      }
    }

    function clearResults(statusText) {
      resultIds.area.textContent = '—';
      resultIds.finishedM3.textContent = '—';
      resultIds.finishedLitres.textContent = '—';
      resultIds.planningM3.textContent = '—';
      resultIds.planningLitres.textContent = '—';
      resultIds.orderLabel.textContent = 'Supplier conversion';
      resultIds.orderPrimary.textContent = '—';
      resultIds.orderDetail.textContent = 'No result yet';
      resultIds.mass.textContent = '—';
      resultIds.massDetail.textContent = 'Requires declared density and source';
      results.dataset.state = 'empty';
      assumptions.textContent = 'No calculation has been completed.';
      calculationStatus.textContent = statusText || 'Choose a profile, area and depth, then calculate.';
    }

    function saveState() {
      try {
        const values = {
          schema: profilesApi.schema,
          profileId: form.elements.profileId.value,
          selectedRegionIds: selectedRegions().map((region) => region.region_id),
          depthMm: form.elements.depthMm.value,
          wastePercent: form.elements.wastePercent.value,
          densityKgM3: form.elements.densityKgM3.value,
          densitySource: form.elements.densitySource.value,
          orderMode: form.elements.orderMode.value,
          bagLitres: form.elements.bagLitres.value,
          bulkIncrementM3: form.elements.bulkIncrementM3.value
        };
        window.sessionStorage.setItem(storageKey, JSON.stringify(values));
      } catch (_error) {
        // Calculator state persistence is optional; the in-page form remains functional.
      }
    }

    function restoreState() {
      try {
        const saved = JSON.parse(window.sessionStorage.getItem(storageKey) || 'null');
        if (!saved || saved.schema !== profilesApi.schema || !profilesApi.getProfile(saved.profileId)) return;
        ['profileId', 'depthMm', 'wastePercent', 'densityKgM3', 'densitySource', 'orderMode', 'bagLitres', 'bulkIncrementM3'].forEach((field) => {
          if (saved[field] !== undefined && form.elements[field]) form.elements[field].value = saved[field];
        });
        const selectedIds = new Set(Array.isArray(saved.selectedRegionIds) ? saved.selectedRegionIds : []);
        elements('input[name="region"]', form).forEach((input) => { input.checked = selectedIds.has(input.value); });
      } catch (_error) {
        // Ignore unavailable or invalid session state.
      }
    }

    function markResultsStale() {
      if (results.dataset.state !== 'ready') return;
      results.dataset.state = 'stale';
      calculationStatus.textContent = 'Inputs changed. Calculate again to refresh this result.';
    }

    function renderResult(profile, chosenRegions, result) {
      resultIds.area.textContent = number.format(result.areaM2);
      resultIds.finishedM3.textContent = formatVolume(result.finishedM3);
      resultIds.finishedLitres.textContent = formatLitres(result.finishedLitres);
      resultIds.planningM3.textContent = formatVolume(result.planningM3);
      resultIds.planningLitres.textContent = formatLitres(result.planningLitres);

      if (result.orderMode === 'bags') {
        resultIds.orderLabel.textContent = 'Whole bags';
        resultIds.orderPrimary.textContent = integer.format(result.bagCount);
        resultIds.orderDetail.textContent = `${number.format(result.bagLitres)} L each · ${formatLitres(result.roundedOrderLitres)} L nominal total`;
      } else if (result.orderMode === 'bulk') {
        resultIds.orderLabel.textContent = 'Rounded bulk order';
        resultIds.orderPrimary.textContent = `${formatVolume(result.roundedOrderM3)} m³`;
        resultIds.orderDetail.textContent = `${integer.format(result.bulkOrderUnits)} × ${number.format(result.bulkIncrementM3)} m³ supplier increments`;
      } else {
        resultIds.orderLabel.textContent = 'Volume to take to supplier';
        resultIds.orderPrimary.textContent = `${formatVolume(result.planningM3)} m³`;
        resultIds.orderDetail.textContent = 'No supplier-unit rounding applied';
      }

      if (result.planningMassKg === null) {
        resultIds.mass.textContent = 'Not calculated';
        resultIds.massDetail.textContent = 'Enter a matching density and source to estimate mass';
      } else {
        resultIds.mass.textContent = `${formatMass(result.planningMassKg)} kg`;
        resultIds.massDetail.textContent = `Using ${number.format(result.densityKgM3)} kg/m³ · ${result.densitySource}`;
      }

      const regionNames = chosenRegions.map((region) => region.name).join(', ');
      const wasteText = result.wasteIncluded
        ? `${number.format(result.wastePercent)}% user-declared waste included once`
        : 'waste excluded (0%)';
      const massText = result.planningMassKg === null
        ? 'mass not calculated'
        : `mass estimated from ${number.format(result.densityKgM3)} kg/m³ declared as ${result.densitySource}`;
      assumptions.textContent = `${profile.label}: ${number.format(result.areaM2)} m² across ${regionNames}; ${number.format(result.depthMm)} mm finished depth; ${wasteText}; ${massText}.`;
      results.dataset.state = 'ready';
      calculationStatus.textContent = `Calculation complete for ${profile.label}. Review the exact, declared and rounded parts below.`;
      window.GARDEN_CALCULATOR_QA = {
        schema: profilesApi.schema,
        profileId: profile.id,
        profileEvidence: profile.evidence,
        selectedRegionIds: chosenRegions.map((region) => region.region_id),
        result
      };
    }

    function calculate(focusErrors = false) {
      resetMessages();
      const chosenRegions = selectedRegions();
      const profile = profilesApi.getProfile(form.elements.profileId.value);
      const areaM2 = chosenRegions.reduce((total, region) => total + region.calculator_area_m2, 0);
      try {
        const result = calculatorApi.calculateBulkMaterial({
          profileId: form.elements.profileId.value,
          areaM2,
          depthMm: form.elements.depthMm.value,
          wastePercent: form.elements.wastePercent.value,
          densityKgM3: form.elements.densityKgM3.value,
          densitySource: form.elements.densitySource.value,
          orderMode: form.elements.orderMode.value,
          bagLitres: form.elements.bagLitres.value,
          bulkIncrementM3: form.elements.bulkIncrementM3.value
        }, profile);
        renderResult(profile, chosenRegions, result);
        saveState();
      } catch (error) {
        clearResults('The result is unavailable until the highlighted inputs are corrected.');
        if (error instanceof calculatorApi.ValidationError) {
          const fieldErrors = { ...error.fieldErrors };
          if (!chosenRegions.length) fieldErrors.areaM2 = 'Select at least one application area.';
          if (!String(form.elements.depthMm.value || '').trim()) fieldErrors.depthMm = 'Finished depth is required.';
          showFieldErrors(fieldErrors, focusErrors);
          message.textContent = error.message;
        } else {
          message.textContent = 'The calculator could not complete this quantity. Check the inputs and try again.';
        }
      }
    }

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      calculate(true);
    });
    form.addEventListener('input', () => {
      markResultsStale();
      saveState();
    });
    form.addEventListener('change', (event) => {
      if (event.target === profileSelect) updateProfile();
      if (event.target === form.elements.orderMode) updateOrderFields();
      markResultsStale();
      saveState();
    });

    restoreState();
    updateProfile();
    updateOrderFields();
    clearResults();
    window.GARDEN_MATERIAL_PROFILES_QA = {
      schema: profilesApi.schema,
      profileIds: profilesApi.profiles.map((profile) => profile.id),
      densityDefaults: profilesApi.profiles.map((profile) => profile.density.defaultKgM3),
      policy: profilesApi.policy
    };
  }

  function updateSolarExplorer() {
    const season = element('#solar-season');
    const scenario = element('#solar-scenario');
    const image = element('#solar-explorer-image');
    const link = element('#solar-explorer-link');
    const status = element('#solar-explorer-status');
    if (!season || !scenario || !image || !link || !status) return;
    const effectiveScenario = state.mode === 'presentation' ? 'likely' : scenario.value;
    const path = dataApi.heatmapPath(season.value, effectiveScenario, dataApi.solar.bearing);
    image.classList.add('is-loading');
    image.src = path;
    image.alt = `${dataApi.seasonLabel(season.value)} ${dataApi.scenarioLabel(effectiveScenario).toLowerCase()} solar heatmap at the central garden direction with G1, G2, lemon, mandarin, lime and Rhizome bed markers`;
    link.href = path;
    status.textContent = state.mode === 'presentation'
      ? `${dataApi.seasonLabel(season.value)} · likely working case · central direction`
      : `${dataApi.seasonLabel(season.value)} · ${dataApi.scenarioLabel(effectiveScenario).toLowerCase()} · central B330 bearing`;

    const average = element('#solar-likely-average');
    if (average && state.sharedData) {
      try {
        const value = dataApi.deriveWholeField(state.sharedData.solarResults.zone_summaries, season.value, 'likely');
        average.textContent = `Garden-wide likely planning average: ${value.hours.toFixed(2)} direct-sun-equivalent hours/day.`;
      } catch (_error) {
        average.textContent = 'The adopted seasonal average is unavailable; the map and location takeaways remain available.';
      }
    }
    window.GARDEN_SOLAR_QA = { mode: state.mode, season: season.value, technicalScenario: scenario.value, effectiveScenario, path };
  }

  function recordPresentationSolarState() {
    const maps = elements('[data-presentation-solar-map]');
    window.GARDEN_PRESENTATION_SOLAR_QA = {
      scenario: 'likely',
      bearing: dataApi.solar.bearing,
      seasons: maps.map((map) => map.dataset.season),
      paths: maps.map((map) => element('img', map)?.getAttribute('src') || null),
      visibleCount: maps.filter((map) => map.offsetParent !== null).length
    };
  }

  function initialiseSolarExplorer() {
    const season = element('#solar-season');
    const scenario = element('#solar-scenario');
    const image = element('#solar-explorer-image');
    const status = element('#solar-explorer-status');
    if (!season || !scenario || !image || !status) return;
    season.addEventListener('change', updateSolarExplorer);
    scenario.addEventListener('change', updateSolarExplorer);
    image.addEventListener('load', () => image.classList.remove('is-loading'));
    image.addEventListener('error', () => {
      image.classList.remove('is-loading');
      status.textContent = 'Selected solar map unavailable — use the summary and location results below';
    });
    updateSolarExplorer();
  }

  function renderLocationSummaries(locationSolar) {
    const grid = element('#location-summary-grid');
    if (!grid) return;
    grid.replaceChildren();
    locationSolar.locations.forEach((location) => {
      const card = document.createElement('article');
      const title = document.createElement('strong');
      title.textContent = location.location_name;
      const summary = document.createElement('p');
      summary.textContent = location.plain_language;
      const details = document.createElement('details');
      details.dataset.modeOnly = 'calculator';
      const detailsSummary = document.createElement('summary');
      detailsSummary.textContent = 'Seasonal values and decision';
      const status = document.createElement('span');
      status.className = 'location-status';
      status.textContent = dataApi.friendlyStatus(location.v0_17_status);
      const decision = document.createElement('p');
      decision.textContent = location.v0_17_decision;
      const values = document.createElement('dl');
      values.className = 'location-values';
      dataApi.solar.seasons.forEach((season) => {
        const record = location.seasons[season.id];
        const row = document.createElement('div');
        const term = document.createElement('dt');
        term.textContent = season.label;
        const value = document.createElement('dd');
        value.textContent = `${record.baseline.toFixed(2)} / ${record.likely.toFixed(2)} / ${record.conservative.toFixed(2)} h`;
        row.append(term, value);
        values.append(row);
      });
      details.append(detailsSummary, status, decision, values);
      card.append(title, summary, details);
      grid.append(card);
    });
    grid.setAttribute('aria-busy', 'false');
  }

  function renderWholeField(solarResults) {
    const body = element('#whole-field-body');
    if (!body) return;
    state.wholeField = dataApi.deriveWholeFieldTable(solarResults);
    body.replaceChildren();
    state.wholeField.forEach((row) => {
      const tableRow = document.createElement('tr');
      const heading = document.createElement('th');
      heading.scope = 'row';
      heading.textContent = row.label;
      tableRow.append(heading);
      dataApi.solar.scenarios.forEach((scenario) => {
        const cell = document.createElement('td');
        cell.textContent = row.values[scenario.id].toFixed(2);
        tableRow.append(cell);
      });
      body.append(tableRow);
    });
  }

  function renderRhizomeFacts() {
    const gross = element('#rhizome-gross-area');
    const net = element('#rhizome-net-area');
    if (gross) gross.textContent = `${number.format(dataApi.rhizomeFeature.grossAreaM2)} m²`;
    if (net) net.textContent = `${number.format(dataApi.rhizomeFeature.netFillAreaM2)} m²`;
  }

  function renderDownloads(mode) {
    const grid = element('#download-grid');
    const technical = element('#technical-grid');
    if (!grid || !technical) return;
    grid.replaceChildren();
    dataApi.documentsForMode(mode).forEach((item) => {
      const card = document.createElement('article');
      card.className = `download-card${item.id === 'public-package' ? ' download-card-featured' : ''}`;
      const badge = document.createElement('span');
      badge.className = 'file-badge';
      badge.textContent = item.type;
      const title = document.createElement('h3');
      title.textContent = item.title;
      const description = document.createElement('p');
      description.textContent = item.description;
      const link = document.createElement('a');
      link.className = item.id === 'public-package' ? 'button button-light' : 'text-link';
      link.href = item.href;
      link.textContent = item.type === 'ZIP' ? 'Download public package' : 'Open PDF ↗';
      card.append(badge, title, description, link);
      grid.append(card);
    });
    grid.setAttribute('aria-busy', 'false');

    if (!technical.childElementCount) {
      dataApi.downloads.technical.forEach((item) => {
        const link = document.createElement('a');
        link.href = item.href;
        const group = document.createElement('small');
        group.textContent = item.group;
        const title = document.createElement('strong');
        title.textContent = item.title;
        const detail = document.createElement('span');
        detail.textContent = item.detail;
        link.append(group, title, detail);
        technical.append(link);
      });
    }
  }

  function showSharedDataError(message) {
    html.dataset.dataStatus = 'error';
    const targets = [element('#region-list'), element('#location-summary-grid')];
    targets.forEach((target) => {
      if (!target) return;
      const note = document.createElement('p');
      note.className = 'data-placeholder data-error';
      note.textContent = message;
      target.replaceChildren(note);
      target.setAttribute('aria-busy', 'false');
    });
    const body = element('#whole-field-body');
    if (body) body.innerHTML = '<tr><td colspan="4">Adopted values unavailable.</td></tr>';
  }

  async function initialiseSharedData() {
    const requestedHash = window.location.hash;
    try {
      state.sharedData = await dataApi.loadSharedData();
      html.dataset.dataStatus = 'ready';
      const regions = state.sharedData.regionManifest.regions;
      renderRegions(regions);
      initialiseCalculator(regions);
      renderLocationSummaries(state.sharedData.locationSolar);
      renderWholeField(state.sharedData.solarResults);
      renderRhizomeFacts();
      updateSolarExplorer();
      window.GARDEN_SHARED_QA = {
        regionRecordCount: regions.length,
        selectableRegionCount: regions.filter((region) => region.selectable).length,
        locationRecordCount: state.sharedData.locationSolar.locations.length,
        wholeField: state.wholeField,
        sourcePaths: dataApi.dataPaths
      };
      if (requestedHash && window.location.hash === requestedHash) {
        window.requestAnimationFrame(() => {
          scrollToSection(dataApi.sectionKeyFromAnchor(requestedHash));
        });
      }
    } catch (_error) {
      showSharedDataError('Shared planning data unavailable. Start the site with Run-Garden-v0_21.ps1 and reload this page.');
    }
  }

  function initialise() {
    renderDownloads('presentation');
    initialiseCompactNavigation();
    initialiseModeControl();
    initialiseViewer();
    initialiseSolarExplorer();
    initialiseSharedData();
  }

  initialise();
})();
