/* ============================================
   REDRAG Tools — Core JavaScript
   Namespace: RT
   Shell Injection, Utilities, Config, Analytics
   Version: 2.0.1 (Hotfix — Syntax Error Resolved)
   ============================================ */

(function (global) {
  'use strict';

  // Prevent double initialization
  if (global.RT) return;

  /* ==========================================
     1. CONFIGURATION
     ========================================== */
  const CONFIG = {
    brand: {
      name: 'REDRAG',
      domain: 'tools.redrag.in',
      blogDomain: 'https://www.redrag.in',
      founded: 2026
    },

    // Single source of truth for all internal URLs
    urls: {
      blog: 'https://www.redrag.in/',
      about: 'https://www.redrag.in/p/about-me.html',
      contact: 'https://www.redrag.in/p/contact-us.html',
      privacy: 'https://www.redrag.in/p/privacy-policy.html',
      toolsHub: 'https://tools.redrag.in/',
      sitemap: 'https://tools.redrag.in/sitemap.xml'
    },

    // Paths to shared assets (relative to root)
    paths: {
      shared: '/shared/',
      css: '/shared/css/',
      js: '/shared/js/',
      html: '/shared/html/',
      data: '/shared/data/'
    },

    // Feature flags
    features: {
      shareResults: true,
      persistState: true,
      lazyLoadContent: true,
      analytics: true
    },

    // Analytics (privacy-first, no cookies)
    analytics: {
      enabled: true,
      provider: 'plausible',
      scriptUrl: 'https://plausible.io/js/script.js',
      domain: 'tools.redrag.in'
    }
  };

  /* ==========================================
     2. DOM UTILITIES
     ========================================== */
  const dom = {
    $(selector, context) {
      return (context || document).querySelector(selector);
    },

    $$(selector, context) {
      return (context || document).querySelectorAll(selector);
    },

    create(tag, attrs, children) {
      const el = document.createElement(tag);
      if (attrs) {
        Object.entries(attrs).forEach(([key, val]) => {
          if (key === 'text') {
            el.textContent = val;
          } else if (key === 'html') {
            el.innerHTML = val;
          } else if (key.startsWith('on') && typeof val === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), val);
          } else {
            el.setAttribute(key, val);
          }
        });
      }
      if (children) {
        const arr = Array.isArray(children) ? children : [children];
        arr.forEach(child => {
          if (typeof child === 'string') {
            el.appendChild(document.createTextNode(child));
          } else if (child instanceof Node) {
            el.appendChild(child);
          }
        });
      }
      return el;
    },

    inject(target, html, position) {
      const el = typeof target === 'string' ? this.$(target) : target;
      if (!el) {
        console.warn('[RT] inject target not found:', target);
        return;
      }
      el.insertAdjacentHTML(position || 'beforeend', html);
    },

    clear(el) {
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
    },

    isInViewport(el) {
      const rect = el.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      );
    },

    ready(callback) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
      } else {
        callback();
      }
    }
  };

  /* ==========================================
     3. UTILITIES
     ========================================== */
  const utils = {
    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    throttle(func, limit) {
      let inThrottle;
      return function (...args) {
        if (!inThrottle) {
          func.apply(this, args);
          inThrottle = true;
          setTimeout(() => (inThrottle = false), limit);
        }
      };
    },

    escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    escapeJs(text) {
      if (!text) return '';
      return text
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\'")
        .replace(/"/g, '\"')
        .replace(/\n/g, '\n')
        .replace(/\r/g, '\r');
    },

    async copyToClipboard(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
      } catch (err) {
        console.error('[RT] Clipboard copy failed:', err);
        return false;
      }
    },

    formatNumber(num) {
      return new Intl.NumberFormat('en-IN').format(num);
    },

    formatBytes(bytes) {
      if (bytes === 0) return '0 GB';
      const gb = bytes / (1024 ** 3);
      if (gb >= 1) return gb.toFixed(2) + ' GB';
      const mb = bytes / (1024 ** 2);
      return mb.toFixed(0) + ' MB';
    },

    getQueryParam(name) {
      const params = new URLSearchParams(window.location.search);
      return params.get(name);
    },

    setQueryParams(params) {
      const url = new URL(window.location);
      Object.entries(params).forEach(([key, val]) => {
        if (val === null || val === undefined || val === '') {
          url.searchParams.delete(key);
        } else {
          url.searchParams.set(key, val);
        }
      });
      window.history.replaceState({}, '', url);
    },

    storage: {
      get(key, defaultValue) {
        try {
          const item = localStorage.getItem('rt:' + key);
          return item ? JSON.parse(item) : defaultValue;
        } catch {
          return defaultValue;
        }
      },
      set(key, value) {
        try {
          localStorage.setItem('rt:' + key, JSON.stringify(value));
          return true;
        } catch {
          return false;
        }
      },
      remove(key) {
        try {
          localStorage.removeItem('rt:' + key);
        } catch { /* ignore */ }
      }
    },

    prefersReducedMotion() {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    isTouchDevice() {
      return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
  };

  /* ==========================================
     4. SHELL INJECTION
     ========================================== */
  const shell = {
    _headerLoaded: false,
    _footerLoaded: false,

    async injectHeader(options) {
      const placeholder = dom.$('#rt-header');
      if (!placeholder) return;

      try {
        const res = await fetch(CONFIG.paths.html + 'header.html');
        if (!res.ok) throw new Error('Header fetch failed');
        let html = await res.text();
        placeholder.innerHTML = html;
        this._headerLoaded = true;
        this._setActiveNav(options && options.activeNav);
        this._bindMobileMenu();
        placeholder.dispatchEvent(new CustomEvent('rt:headerReady', { bubbles: true }));
      } catch (err) {
        console.error('[RT] Header injection failed:', err);
        placeholder.style.minHeight = '72px';
      }
    },

    async injectFooter() {
      const placeholder = dom.$('#rt-footer');
      if (!placeholder) return;

      try {
        const res = await fetch(CONFIG.paths.html + 'footer.html');
        if (!res.ok) throw new Error('Footer fetch failed');
        const html = await res.text();
        placeholder.innerHTML = html;
        this._footerLoaded = true;
        placeholder.dispatchEvent(new CustomEvent('rt:footerReady', { bubbles: true }));
      } catch (err) {
        console.error('[RT] Footer injection failed:', err);
      }
    },

    _setActiveNav(activeNav) {
      if (!activeNav) {
        const path = window.location.pathname;
        if (path === '/' || path === '/index.html') activeNav = 'tools';
        else if (path.includes('/storage/') || path.includes('/vram/')) activeNav = 'tools';
      }

      if (activeNav) {
        dom.$$('.rt-nav__link').forEach(link => {
          link.classList.toggle('is-active', link.dataset.nav === activeNav);
        });
        dom.$$('.rt-mobile-menu__link').forEach(link => {
          link.classList.toggle('is-active', link.dataset.nav === activeNav);
        });
      }
    },

    _bindMobileMenu() {
      const openBtn = dom.$('.rt-mobile-menu-btn');
      const closeBtn = dom.$('.rt-mobile-menu__close');
      const menu = dom.$('.rt-mobile-menu');

      if (openBtn && menu) {
        openBtn.addEventListener('click', () => {
          menu.classList.add('is-open');
          document.body.style.overflow = 'hidden';
        });
      }

      if (closeBtn && menu) {
        closeBtn.addEventListener('click', () => {
          menu.classList.remove('is-open');
          document.body.style.overflow = '';
        });
      }

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menu && menu.classList.contains('is-open')) {
          menu.classList.remove('is-open');
          document.body.style.overflow = '';
        }
      });
    },

    get ready() {
      return new Promise((resolve) => {
        const check = () => {
          if (this._headerLoaded && this._footerLoaded) {
            resolve();
            return;
          }
          setTimeout(check, 50);
        };
        check();
      });
    }
  };

  /* ==========================================
     5. ANALYTICS (Privacy-First)
     ========================================== */
  const analytics = {
    _initialized: false,

    init() {
      if (!CONFIG.features.analytics || !CONFIG.analytics.enabled) return;
      if (this._initialized) return;

      if (CONFIG.analytics.provider === 'plausible') {
        const link = dom.create('link', {
          rel: 'dns-prefetch',
          href: 'https://plausible.io'
        });
        document.head.appendChild(link);

        const script = dom.create('script', {
          defer: '',
          'data-domain': CONFIG.analytics.domain,
          src: CONFIG.analytics.scriptUrl
        });
        document.head.appendChild(script);
      }

      this._initialized = true;
    },

    track(eventName, props) {
      if (!this._initialized) return;
      if (window.plausible) {
        window.plausible(eventName, { props });
      }
      if (location.hostname === 'localhost') {
        console.log('[Analytics]', eventName, props);
      }
    },

    trackTool(toolSlug, action) {
      this.track('Tool Action', { tool: toolSlug, action });
    }
  };

  /* ==========================================
     6. INITIALIZATION
     ========================================== */
  function init() {
    const headerPlaceholder = dom.$('#rt-header');
    const footerPlaceholder = dom.$('#rt-footer');

    if (headerPlaceholder) {
      const activeNav = headerPlaceholder.dataset.active || '';
      shell.injectHeader({ activeNav });
    }

    if (footerPlaceholder) {
      shell.injectFooter();
    }

    analytics.init();

    if (global.RT && global.RT.components && global.RT.components.autoInit) {
      global.RT.components.autoInit();
    }

    if (window.performance && window.performance.mark) {
      window.performance.mark('rt-init-end');
      window.performance.measure('rt-init', 'rt-init-start', 'rt-init-end');
    }
  }

  /* ==========================================
     7. PUBLIC API
     ========================================== */
  global.RT = {
    version: '2.0.1',
    config: CONFIG,
    dom,
    utils,
    shell,
    analytics,
    init
  };

  dom.ready(() => {
    if (window.performance && window.performance.mark) {
      window.performance.mark('rt-init-start');
    }

    if (document.documentElement.dataset.rtNoInit !== 'true') {
      init();
    }
  });

})(window);