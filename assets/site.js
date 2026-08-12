(() => {
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
})();
