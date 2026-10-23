/**
 * Apple Liquid Glass Interactive Specular Light Controller
 * Automatically calculates dynamic light position on floating glass surfaces,
 * cards, toolbars, and navigation bars across all Sigma Webapps suites.
 */
(function () {
  'use strict';

  const SELECTOR = [
    '.glass-card:not(#sidebar-wrapper)',
    '.liquid-glass',
    '.nav-pill-bar',
    '.player-bar',
    '.floating-toolbar',
    '.card',
    '.tool-card',
    '.box',
    '#reader-container',
    '#word-display-wrapper'
  ].join(', ');

  function ensureSpecularStyles() {
    if (document.getElementById('liquid-glass-specular-styles')) return;
    const style = document.createElement('style');
    style.id = 'liquid-glass-specular-styles';
    style.textContent = `
      .specular-hover {
        position: relative;
        transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
      }
      .specular-hover:hover {
        border-color: rgba(255, 255, 255, 0.28) !important;
      }
      .specular-hover::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: radial-gradient(
          380px circle at var(--specular-x, 50%) var(--specular-y, 0%),
          rgba(255, 255, 255, 0.14),
          transparent 70%
        );
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.3s ease;
        z-index: 1;
      }
      .specular-hover:hover::before {
        opacity: 1;
      }
    `;
    document.head.appendChild(style);
  }

  function bindElement(el) {
    if (!el || el.dataset.specularInit) return;
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
  }

  function attachGlassSpecular() {
    ensureSpecularStyles();
    document.querySelectorAll(SELECTOR).forEach(bindElement);
  }

  function init() {
    attachGlassSpecular();
    const observer = new MutationObserver(() => {
      document.querySelectorAll(SELECTOR).forEach(bindElement);
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
