/**
 * Apple Liquid Glass Interactive Specular Light Controller
 * Automatically calculates dynamic light position on floating glass surfaces.
 */
(function () {
  'use strict';

  function attachGlassSpecular() {
    const targets = document.querySelectorAll('.glass-card, .liquid-glass, .nav-pill-bar, .player-bar, .floating-toolbar');
    targets.forEach((el) => {
      if (el.dataset.specularInit) return;
      el.dataset.specularInit = 'true';
      el.classList.add('specular-hover');

      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        el.style.setProperty('--specular-x', `${x}px`);
        el.style.setProperty('--specular-y', `${y}px`);
      });

      el.addEventListener('mouseleave', () => {
        el.style.setProperty('--specular-x', '50%');
        el.style.setProperty('--specular-y', '0%');
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachGlassSpecular);
  } else {
    attachGlassSpecular();
  }
})();
