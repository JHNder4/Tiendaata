/* 
 * Tienda Ata — Liquid Glass surface engine
 * Inspired by the architecture of Liquid Glass JS:
 * https://github.com/BeMoreDifferent/liquid-glass-js
 *
 * Copyright (c) 2024 Liquid Glass JS
 * MIT License — see THIRD_PARTY_LICENSES/LIQUID-GLASS-JS-MIT.txt
 */
(() => {
  'use strict';

  const SELECTOR = [
    '.hd',
    '.srch',
    '.flt',
    '.tabs',
    '.bar',
    '.f',
    '.tn',
    '.card',
    '.glass-banner',
    '.related-products',
    '.related-card',
    '.btn.s',
    '.nav-btn',
    '.theme-btn',
    '.control-btn',
    '.departments a',
    '.chips a',
    '.gb',
    '.cnt',
    '.card em',
    '.sz',
    '.ata-chat',
    '.ata-chat-fab',
    '.ata-chat-product'
  ].join(',');

  const initialized = new WeakMap();
  let advancedSupported = false;

  try {
    advancedSupported = CSS.supports('backdrop-filter', 'url("#liquid-glass")');
  } catch (_) {
    advancedSupported = false;
  }

  const num = (value, fallback) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const escapeAttr = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  function buildDisplacementMap(id, width, height, radius, depth) {
    const safeW = Math.max(1, Math.round(width));
    const safeH = Math.max(1, Math.round(height));
    const safeR = Math.max(1, radius);
    const safeD = Math.max(1, Math.min(depth, Math.floor(Math.min(safeW, safeH) / 3)));

    const svg = '<svg height="' + safeH + '" width="' + safeW + '" viewBox="0 0 ' + safeW + ' ' + safeH + '" xmlns="http://www.w3.org/2000/svg">' +
      '<defs>' +
      '<linearGradient id="y-' + id + '" x1="0" x2="0" y1="' + Math.ceil((safeR / safeH) * 15) + '%" y2="' + Math.floor(100 - (safeR / safeH) * 15) + '%">' +
      '<stop offset="0%" stop-color="#0F0"/><stop offset="100%" stop-color="#000"/>' +
      '</linearGradient>' +
      '<linearGradient id="x-' + id + '" x1="' + Math.ceil((safeR / safeW) * 15) + '%" x2="' + Math.floor(100 - (safeR / safeW) * 15) + '%" y1="0" y2="0">' +
      '<stop offset="0%" stop-color="#F00"/><stop offset="100%" stop-color="#000"/>' +
      '</linearGradient>' +
      '</defs>' +
      '<rect width="' + safeW + '" height="' + safeH + '" fill="#808080"/>' +
      '<g filter="blur(2px)">' +
      '<rect width="' + safeW + '" height="' + safeH + '" fill="#000080"/>' +
      '<rect width="' + safeW + '" height="' + safeH + '" fill="url(#y-' + id + ')" style="mix-blend-mode:screen"/>' +
      '<rect width="' + safeW + '" height="' + safeH + '" fill="url(#x-' + id + ')" style="mix-blend-mode:screen"/>' +
      '<rect x="' + safeD + '" y="' + safeD + '" width="' + Math.max(1, safeW - safeD * 2) + '" height="' + Math.max(1, safeH - safeD * 2) + '" rx="' + safeR + '" ry="' + safeR + '" fill="#808080" filter="blur(' + safeD + 'px)"/>' +
      '</g></svg>';

    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function buildFilter(id, width, height, radius, depth, strength, chromatic) {
    const map = buildDisplacementMap(id, width, height, radius, depth);
    const s = Math.max(0, Math.min(90, strength));
    const c = Math.max(0, Math.min(18, chromatic));
    const svg = '<svg height="' + height + '" width="' + width + '" viewBox="0 0 ' + width + ' ' + height + '" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><filter id="f-' + id + '" color-interpolation-filters="sRGB">' +
      '<feImage x="0" y="0" width="' + width + '" height="' + height + '" href="' + escapeAttr(map) + '" result="map"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="map" scale="' + (s + c * 2) + '" xChannelSelector="R" yChannelSelector="G"/>' +
      '<feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="map" scale="' + (s + c) + '" xChannelSelector="R" yChannelSelector="G"/>' +
      '<feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="map" scale="' + s + '" xChannelSelector="R" yChannelSelector="G"/>' +
      '<feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/>' +
      '<feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="b" mode="screen"/>' +
      '</filter></defs></svg>';
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '#f-' + id;
  }

  function attach(element) {
    if (initialized.has(element)) return;
    initialized.set(element, { width: 0, height: 0 });

    element.classList.add('liquid-glass-surface');
    element.style.setProperty('--lg-opacity', '0.90');
    element.style.setProperty('--lg-scale', '1');

    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const state = initialized.get(element);
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      const blur = num(element.dataset.lgBlur, 18);
      const depth = num(element.dataset.lgDepth, 9);
      const strength = num(element.dataset.lgStrength, 16);
      const chromatic = num(element.dataset.lgChromatic, 2);

      element.style.setProperty('--lg-blur', blur + 'px');

      if (advancedSupported) {
        const key = width + 'x' + height + ':' + blur + ':' + depth + ':' + strength + ':' + chromatic;
        if (state.key === key) return;
        state.key = key;
        const id = 'ta-' + Math.random().toString(36).slice(2, 10);
        const filterUrl = buildFilter(id, width, height, 18, depth, strength, chromatic);
        element.style.setProperty('--lg-filter', 'url("' + filterUrl + '")');
      } else if (state.key !== width + 'x' + height + ':' + blur) {
        state.key = width + 'x' + height + ':' + blur;
        element.style.setProperty('--lg-filter', 'none');
      }
    };

    const queue = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    const observer = 'ResizeObserver' in window ? new ResizeObserver(queue) : null;
    if (observer) observer.observe(element);

    element.addEventListener('mouseenter', () => {
      element.style.setProperty('--lg-opacity', '1');
      element.style.setProperty('--lg-scale', '1.012');
    });
    element.addEventListener('mouseleave', () => {
      element.style.setProperty('--lg-opacity', '0.90');
      element.style.setProperty('--lg-scale', '1');
    });

    queue();
  }

  function scan(root = document) {
    root.querySelectorAll(SELECTOR).forEach(attach);
  }

  const boot = () => {
    scan();
    const root = document.getElementById('app');
    if (root && 'MutationObserver' in window) {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              if (node.matches && node.matches(SELECTOR)) attach(node);
              if (node.querySelectorAll) scan(node);
            }
          }
        }
      });
      observer.observe(root, { childList: true, subtree: true });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
