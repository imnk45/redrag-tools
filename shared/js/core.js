/* ============================================
   REDRAG Tools — Core JavaScript
   Namespace: RT
   Shell Injection, Utilities, Config, Analytics
   Version: 2.0.0
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
      // Plausible.io configuration — swap provider here if needed
      provider: 'plausible',
      scriptUrl: 'https://plausible.io/js/script.js',
      domain: 'tools.redrag.in'
    }
  };

  /* ==========================================
     2. DOM UTILITIES
     ========================================== */
  const dom = {
    /**
     * Shorthand for querySelector
     * @param {string} selector
     * @param {Element} [context=document]
     * @returns {Element|null}
     */
    $(selector, context) {
      return (context || document).querySelector(selector);
    },

    /**
     * Shorthand for querySelectorAll
     * @param {string} selector
     * @param {Element} [context=document]
     * @returns {NodeList}
     */
    $$(selector, context) {
      return (context || document).querySelectorAll(selector);
    },

    /**
     * Create an element with attributes and children
     * @param {string} tag
     * @param {Object} [attrs={}]
     * @param {Array|string} [children=[]]
     * @returns {Element}
     */
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

    /**
     * Inject HTML string into a container element
     * @param {Element|string} target — element or selector
     * @param {string} html
     * @param {string} [position='beforeend']
     */
    inject(target, html, position) {
      const el = typeof target === 'string' ? this.$(target) : target;
      if (!el) {
        console.warn('[RT] inject target not found:', target);
        return;
      }
      el.insertAdjacentHTML(position || 'beforeend', html);
    },

    /**
     * Remove all children from an element
     * @param {Element} el
     */
    clear(el) {
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
    },

    /**
     * Check if element is in viewport
     * @param {Element} el
     * @returns {boolean}
     */
    isInViewport(el) {
      const rect = el.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
      );
    },

    /**
     * Wait for DOM ready (or execute immediately if already ready)
     * @param {Function} callback
     */
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
    /**
     * Debounce a function
     * @param {Function} func
     * @param {number} wait — milliseconds
     * @returns {Function}
     */
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

    /**
     * Throttle a function
     * @param {Function} func
     * @param {number} limit — milliseconds
     * @returns {Function}
     */
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

    /**
     * Escape HTML special characters
     * @param {string} text
     * @returns {string}
     */
    escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },

    /**
     * Escape text for use in JavaScript strings (single quotes)
     * @param {string} text
     * @returns {string}
     */
    escapeJs(text) {
      if (!text) return '';
      return text
        .replace(/\/g, '\\')
        .replace(/'/g, "\'")
        .replace(/"/g, '\"')
        .replace(/
/g, '\n')
        .replace(//g, '\r');
    },

    /**
     * Copy text to clipboard
     * @param {string} text
     * @returns {Promise<boolean>}
     */
    async copyToClipboard(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
        // Fallback for older browsers
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

    /**
     * Format a number with locale separators
     * @param {number} num
     * @returns {string}
     */
    formatNumber(num) {
      return new Intl.NumberFormat('en-IN').format(num);
    },

    /**
     * Format bytes to human-readable (GB, MB, etc.)
     * @param {number} bytes
     * @returns {string}
     */
    formatBytes(bytes) {
      if (bytes === 0) return '0 GB';
      const gb = bytes / (1024 ** 3);
      if (gb >= 1) return gb.toFixed(2) + ' GB';
      const mb = bytes / (1024 ** 2);
      return mb.toFixed(0) + ' MB';
    },

    /**
     * Get URL query parameter
     * @param {string} name
     * @returns {string|null}
     */
    getQueryParam(name) {
      const params = new URLSearchParams(window.location.search);
      return params.get(name);
    },

    /**
     * Set URL query parameter without reloading
     * @param {Object} params — key-value pairs
     */
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

    /**
     * Simple localStorage wrapper with JSON support
     */
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

    /**
     * Detect if user prefers reduced motion
     * @returns {boolean}
     */
    prefersReducedMotion() {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    },

    /**
     * Detect touch device
     * @returns {boolean}
     */
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

    /**
     * Fetch and inject the shared header
     * @param {Object} [options={}]
     * @param {string} [options.activeNav] — which nav item is active
     */
    async injectHeader(options) {
      const placeholder = dom.$('#rt-header');
      if (!placeholder) return;

      try {
        const res = await fetch(CONFIG.paths.html + 'header.html');
        if (!res.ok) throw new Error('Header fetch failed');
        let html = await res.text();

        // Inject into placeholder
        placeholder.innerHTML = html;
        this._headerLoaded = true;

        // Highlight active nav item
        this._setActiveNav(options && options.activeNav);

        // Bind mobile menu toggle
        this._bindMobileMenu();

        // Dispatch event for other scripts
        placeholder.dispatchEvent(new CustomEvent('rt:headerReady', { bubbles: true }));
      } catch (err) {
        console.error('[RT] Header injection failed:', err);
        // Fallback: keep placeholder visible with minimal styling
        placeholder.style.minHeight = '72px';
      }
    },

    /**
     * Fetch and inject the shared footer
     */
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

    /**
     * Set active nav item based on current URL or explicit option
     * @param {string} [activeNav]
     */
    _setActiveNav(activeNav) {
      if (!activeNav) {
        // Auto-detect from pathname
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

    /**
     * Bind mobile menu open/close handlers
     */
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

      // Close on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && menu && menu.classList.contains('is-open')) {
          menu.classList.remove('is-open');
          document.body.style.overflow = '';
        }
      });
    },

    /**
     * Promise that resolves when both header and footer are injected
     * @returns {Promise<void>}
     */
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

      // Plausible Analytics — lightweight, no cookies, GDPR compliant
      if (CONFIG.analytics.provider === 'plausible') {
        const script = dom.create('script', {
          defer: '',
          'data-domain': CONFIG.analytics.domain,
          src: CONFIG.analytics.scriptUrl
        });
        document.head.appendChild(script);
      }

      this._initialized = true;
    },

    /**
     * Track a custom event
     * @param {string} eventName
     * @param {Object} [props={}]
     */
    track(eventName, props) {
      if (!this._initialized) return;

      // Plausible custom event
      if (window.plausible) {
        window.plausible(eventName, { props });
      }

      // Console log in development
      if (location.hostname === 'localhost') {
        console.log('[Analytics]', eventName, props);
      }
    },

    /**
     * Track tool usage
     * @param {string} toolSlug
     * @param {string} action — e.g. 'calculate', 'share', 'reset'
     */
    trackTool(toolSlug, action) {
      this.track('Tool Action', { tool: toolSlug, action });
    }
  };

  /* ==========================================
     6. INITIALIZATION
     ========================================== */
  function init() {
    // Inject shell if placeholders exist
    const headerPlaceholder = dom.$('#rt-header');
    const footerPlaceholder = dom.$('#rt-footer');

    if (headerPlaceholder) {
      const activeNav = headerPlaceholder.dataset.active || '';
      shell.injectHeader({ activeNav });
    }

    if (footerPlaceholder) {
      shell.injectFooter();
    }

    // Initialize analytics
    analytics.init();

    // Auto-init components that use data-rt-component
    if (global.RT && global.RT.components && global.RT.components.autoInit) {
      global.RT.components.autoInit();
    }
  }

  /* ==========================================
     7. PUBLIC API
     ========================================== */
  global.RT = {
    version: '2.0.0',
    config: CONFIG,
    dom,
    utils,
    shell,
    analytics,
    init
  };

  // Auto-init on DOM ready unless opted out
  dom.ready(() => {
    if (document.documentElement.dataset.rtNoInit !== 'true') {
      init();
    }
  });

})(window);
