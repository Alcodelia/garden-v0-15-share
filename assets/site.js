(() => {
  'use strict';

  function initialiseViewer() {
    const status = document.querySelector('#viewer-status');
    const viewer = document.querySelector('#garden-viewer');
    if (!status || !viewer) return;

    const fallback = window.setTimeout(() => {
      if (!customElements.get('model-viewer')) {
        status.textContent = 'Interactive component unavailable — use the static preview or GLB link';
        status.classList.add('fallback');
      }
    }, 8000);

    customElements.whenDefined('model-viewer').then(() => {
      window.clearTimeout(fallback);
      status.textContent = 'Interactive viewer ready';
      status.classList.add('ready');
    });

    viewer.addEventListener('load', () => {
      status.textContent = 'Interactive model loaded';
      status.classList.remove('fallback');
      status.classList.add('ready');
    });

    viewer.addEventListener('error', () => {
      status.textContent = 'Interactive model unavailable — use the static preview or GLB link';
      status.classList.remove('ready');
      status.classList.add('fallback');
    });
  }

  function initialiseCalculator() {
    const form = document.querySelector('#material-calculator');
    const regionList = document.querySelector('#region-list');
    const api = window.GardenCalculator;
    const manifest = window.GARDEN_REGIONS_V016;
    if (!form || !regionList || !api || !manifest) return;

    const selectableRegions = manifest.regions.filter((region) => region.selectable);
    const format = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 3 });
    const resultIds = {
      area: document.querySelector('#result-area'),
      finishedM3: document.querySelector('#result-finished-m3'),
      finishedLitres: document.querySelector('#result-finished-litres'),
      orderM3: document.querySelector('#result-order-m3'),
      orderLitres: document.querySelector('#result-order-litres'),
      bags: document.querySelector('#result-bags')
    };
    const message = document.querySelector('#calculator-message');
    const assumptions = document.querySelector('#calculation-assumptions');
    const bagField = document.querySelector('#bag-field');
    const bagResult = document.querySelector('#bag-result');

    const friendlyStatus = (status) => status
      .toLowerCase()
      .split('__').join(' / ')
      .split('_').join(' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());

    selectableRegions.forEach((region) => {
      const label = document.createElement('label');
      label.className = 'region-option';
      label.title = `${friendlyStatus(region.status)}. Tolerance: ${region.tolerance}`;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = 'region';
      checkbox.value = region.region_id;
      checkbox.setAttribute('aria-describedby', `region-meta-${region.region_id}`);

      const text = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = region.name;
      const meta = document.createElement('span');
      meta.id = `region-meta-${region.region_id}`;
      meta.textContent = `${friendlyStatus(region.status)} · ${region.tolerance}`;
      const readiness = document.createElement('span');
      readiness.className = `region-readiness${region.ordering_estimate_ready ? '' : ' caution'}`;
      readiness.textContent = region.ordering_estimate_ready ? 'Ordering estimate established' : 'Planning estimate only';
      text.append(name, meta, readiness);

      const area = document.createElement('em');
      area.textContent = `${format.format(region.calculator_area_m2)} m²`;
      label.append(checkbox, text, area);
      regionList.append(label);
    });

    function selectedRegions() {
      const ids = new Set(Array.from(form.querySelectorAll('input[name="region"]:checked'), (input) => input.value));
      return selectableRegions.filter((region) => ids.has(region.region_id));
    }

    function resetMessages() {
      message.textContent = '';
      form.querySelectorAll('[data-error-for]').forEach((element) => { element.textContent = ''; });
      form.querySelectorAll('[aria-invalid="true"]').forEach((element) => element.removeAttribute('aria-invalid'));
    }

    function showFieldErrors(fieldErrors) {
      Object.entries(fieldErrors).forEach(([field, text]) => {
        const error = form.querySelector(`[data-error-for="${field}"]`);
        if (error) error.textContent = text;
        const input = form.elements[field];
        if (input && input.setAttribute) input.setAttribute('aria-invalid', 'true');
      });
    }

    function clearResults() {
      Object.values(resultIds).forEach((element) => { if (element) element.textContent = '—'; });
      assumptions.textContent = 'Select at least one region to calculate.';
    }

    function calculate(showEmptyError = false) {
      resetMessages();
      const regions = selectedRegions();
      const mode = form.elements.mode.value;
      bagField.hidden = mode === 'bulk';
      bagResult.hidden = mode === 'bulk';

      if (!regions.length) {
        clearResults();
        if (showEmptyError) {
          const areaError = form.querySelector('[data-error-for="areaM2"]');
          areaError.textContent = 'Select at least one region.';
          message.textContent = 'Choose a region before using the quantity result.';
        }
        return;
      }

      const areaM2 = regions.reduce((total, region) => total + region.calculator_area_m2, 0);
      try {
        const result = api.calculateMaterials({
          areaM2,
          depthMm: form.elements.depthMm.value,
          wastePercent: form.elements.wastePercent.value,
          settlementPercent: form.elements.settlementPercent.value,
          bagLitres: form.elements.bagLitres.value,
          mode
        });

        resultIds.area.textContent = format.format(result.areaM2);
        resultIds.finishedM3.textContent = format.format(result.finishedM3);
        resultIds.finishedLitres.textContent = format.format(result.finishedLitres);
        resultIds.orderM3.textContent = format.format(result.orderM3);
        resultIds.orderLitres.textContent = format.format(result.orderLitres);
        resultIds.bags.textContent = result.bagCount === null ? '—' : format.format(result.bagCount);

        const material = form.elements.material.value.trim() || 'Unnamed material';
        const regionNames = regions.map((region) => region.name).join(', ');
        const cautions = regions.filter((region) => !region.ordering_estimate_ready).map((region) => region.name);
        const cautionText = cautions.length
          ? ` ${cautions.join(', ')} remains planning-only because product dimensions or choices are unresolved.`
          : ' Every selected region is established for a geometry-based ordering estimate; product specifications still need confirmation.';
        assumptions.textContent = `${material}: ${format.format(result.areaM2)} m² across ${regionNames}; ${format.format(result.depthMm)} mm depth; ${format.format(result.wastePercent)}% waste; ${format.format(result.settlementPercent)}% settlement.${cautionText}`;
      } catch (error) {
        clearResults();
        if (error instanceof api.ValidationError) {
          showFieldErrors(error.fieldErrors);
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
    form.addEventListener('input', () => calculate(false));
    form.addEventListener('change', () => calculate(false));
    calculate(false);
  }

  function initialiseViewModes() {
    const buttons = Array.from(document.querySelectorAll('[data-view-target]'));
    if (!buttons.length) return;
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        buttons.forEach((candidate) => candidate.setAttribute('aria-pressed', String(candidate === button)));
        const target = document.getElementById(button.dataset.viewTarget);
        if (!target) return;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      });
    });
  }

  function initialiseSolarExplorer() {
    const season = document.querySelector('#solar-season');
    const scenario = document.querySelector('#solar-scenario');
    const image = document.querySelector('#solar-explorer-image');
    const link = document.querySelector('#solar-explorer-link');
    const status = document.querySelector('#solar-explorer-status');
    if (!season || !scenario || !image || !link || !status) return;

    function update() {
      const seasonLabel = season.options[season.selectedIndex].text;
      const scenarioLabel = scenario.options[scenario.selectedIndex].text;
      const path = `solar/v0_18/garden_v0_18_solar_${season.value}_${scenario.value}_b330_r1.png`;
      image.src = path;
      image.alt = `${seasonLabel} ${scenarioLabel.toLowerCase()} R4 solar heatmap at B330 with G1, G2, lemon, mandarin, lime and Rhizome bed markers`;
      link.href = path;
      status.textContent = `${seasonLabel} · ${scenarioLabel.toLowerCase()} · central B330 bearing`;
    }

    season.addEventListener('change', update);
    scenario.addEventListener('change', update);
    image.addEventListener('error', () => { status.textContent = 'Selected static heatmap unavailable — use the scenario figures below'; });
    update();
  }

  initialiseViewer();
  initialiseCalculator();
  initialiseViewModes();
  initialiseSolarExplorer();
})();
