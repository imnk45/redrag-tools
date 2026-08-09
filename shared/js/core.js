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

    // Google Analytics
    googleAnalytics: {
      enabled: true,
      measurementId: 'G-XXXXXXXXXX'
    },

    // Google AdSense
    adsense: {
      enabled: true,
      publisherId: 'ca-pub-XXXXXXXXXXXXXXXX'
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
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
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
     4. SHELL INJECTION & THEMING
     ========================================== */
  const shell = {
    _headerLoaded: false,
    _footerLoaded: false,
    _theme: 'light',

    /**
     * Initialize theme from localStorage or system preference
     */
    initTheme() {
      // 1. Check local storage
      const savedTheme = utils.storage.get('theme');
      
      if (savedTheme === 'dark' || savedTheme === 'light') {
        this._theme = savedTheme;
      } else {
        // 2. Check system preference
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        this._theme = prefersDark ? 'dark' : 'light';
      }
      
      // Apply theme to document element
      document.documentElement.setAttribute('data-theme', this._theme);
    },

    /**
     * Toggle between light and dark theme
     */
    toggleTheme() {
      this._theme = this._theme === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', this._theme);
      utils.storage.set('theme', this._theme);
      
      // Update UI if needed
      const themeBtn = dom.$('#rt-theme-toggle');
      if (themeBtn) {
        this._updateThemeIcon(themeBtn);
      }
    },

    /**
     * Update the icon of the theme toggle button
     */
    _updateThemeIcon(btn) {
      if (!btn) return;
      if (this._theme === 'dark') {
        // Sun icon for Dark Mode (to switch to light)
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
      } else {
        // Moon icon for Light Mode (to switch to dark)
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
      }
    },

    /**
     * Fetch and inject the shared header
     * @param {Object} [options={}]
     * @param {string} [options.activeNav] — which nav item is active
     */
    async injectHeader(options) {
      const placeholder = dom.$('#rt-header');
      if (!placeholder) return;

      try {
        const res = await fetch(CONFIG.paths.html + 'header.html?v=38');
        if (!res.ok) throw new Error('Header fetch failed');
        let html = await res.text();

        // Inject into placeholder
        placeholder.innerHTML = html;
        this._headerLoaded = true;

        // Highlight active nav item
        this._setActiveNav(options && options.activeNav);

        // Bind mobile menu toggle
        this._bindMobileMenu();

        // Bind theme toggle
        const themeBtn = dom.$('#rt-theme-toggle');
        if (themeBtn) {
          this._updateThemeIcon(themeBtn);
          themeBtn.addEventListener('click', () => this.toggleTheme());
        }

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
        const res = await fetch(CONFIG.paths.html + 'footer.html?v=38');
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
     * Automatically injects related tools section on tool pages
     */
    async injectRelatedTools() {
      const toolLayout = dom.$('.rt-tool-layout');
      // If there's no tool layout, we're not on a tool page
      if (!toolLayout) return;

      try {
        // 1. Get current tool slug from URL
        let path = window.location.pathname.replace('index.html', '');
        if (path.endsWith('/')) path = path.slice(0, -1);
        const parts = path.split('/');
        const currentSlug = parts.pop();
        if (!currentSlug) return;

        // 2. Fetch registry
        const res = await fetch(CONFIG.paths.data + 'tools-registry.json?v=42');
        if (!res.ok) throw new Error('Registry fetch failed');
        const data = await res.json();
        const allTools = data.tools || [];

        // 3. Find current tool
        const currentTool = allTools.find(t => t.slug === currentSlug);
        if (!currentTool) return; // Unregistered tool

        // 4. Find related tools (Live only, not current)
        let related = allTools.filter(t => t.status === 'live' && t.slug !== currentSlug);
        
        // Sort: Same category first
        related.sort((a, b) => {
          const aCat = a.category === currentTool.category ? 1 : 0;
          const bCat = b.category === currentTool.category ? 1 : 0;
          return bCat - aCat;
        });

        // Pick top 3
        const topRelated = related.slice(0, 3);
        if (topRelated.length === 0) return;

        // 5. Generate HTML
        const cardsHtml = topRelated.map(tool => {
          const tags = (tool.tags || []).slice(0, 3).map(tag => 
            `<span class="rt-tag rt-tag--neutral">${utils.escapeHtml(tag)}</span>`
          ).join('');
          const imageHtml = tool.thumbnail 
            ? `<div class="rt-tool-thumb"><img src="${tool.thumbnail}" alt="${utils.escapeHtml(tool.name)}" loading="lazy"></div>`
            : `<div style="font-size:32px;margin-bottom:12px;" aria-hidden="true">${tool.icon}</div>`;
          
          return `
            <a href="/${tool.slug}/" class="rt-card rt-card--hover rt-card--accent-top rt-tool-card">
              <div class="rt-tool-arrow" aria-hidden="true">→</div>
              ${imageHtml}
              <h3 style="font-size:18px;font-weight:var(--rt-weight-extrabold);margin-bottom:8px;letter-spacing:-0.3px;">${utils.escapeHtml(tool.name)}</h3>
              <p style="font-size:14px;color:var(--rt-text-secondary);line-height:1.7;margin-bottom:16px;flex:1;">${utils.escapeHtml(tool.description)}</p>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <span class="rt-tag rt-tag--live">● LIVE</span>
                ${tags}
              </div>
            </a>
          `;
        }).join('');

        const sectionHtml = `
          <section class="rt-content-section rt-related-tools" style="padding-top: var(--rt-space-8); border-top: 1px solid var(--rt-border-default); margin-top: var(--rt-space-8);">
            <div class="vram-section-header" style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: var(--rt-space-5); flex-wrap:wrap; gap:16px;">
              <div>
                <h2 style="margin:0;">Related Tools</h2>
                <p style="color:var(--rt-text-secondary); margin:4px 0 0 0; font-size:14px;">Explore more free utilities</p>
              </div>
              <a href="${CONFIG.urls.toolsHub}" class="rt-btn rt-btn--secondary rt-btn--sm" style="text-decoration:none;">Explore All Tools &rarr;</a>
            </div>
            <div class="rt-tools-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--rt-space-5);">
              ${cardsHtml}
            </div>
          </section>
        `;

        // 6. Inject after tool layout
        toolLayout.insertAdjacentHTML('afterend', sectionHtml);

      } catch (err) {
        console.warn('[RT] Related tools injection failed:', err);
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
      if (!CONFIG.features.analytics || !CONFIG.googleAnalytics.enabled) return;
      if (this._initialized) return;

      // Inject Google Analytics (gtag.js)
      const script = dom.create('script', {
        async: '',
        src: `https://www.googletagmanager.com/gtag/js?id=${CONFIG.googleAnalytics.measurementId}`
      });
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      window.gtag = function(){ dataLayer.push(arguments); };
      gtag('js', new Date());
      gtag('config', CONFIG.googleAnalytics.measurementId);

      this._initialized = true;
    },

    /**
     * Track a custom event
     * @param {string} eventName
     * @param {Object} [props={}]
     */
    track(eventName, props) {
      if (!this._initialized) return;

      // Google Analytics custom event
      if (typeof gtag === 'function') {
        gtag('event', eventName, props);
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
     5B. MONETIZATION (AdSense)
     ========================================== */
  const ads = {
    _initialized: false,

    init() {
      if (!CONFIG.adsense.enabled) return;
      if (this._initialized) return;

      // Inject Google AdSense (Auto Ads)
      const script = dom.create('script', {
        async: '',
        src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CONFIG.adsense.publisherId}`,
        crossorigin: 'anonymous'
      });
      document.head.appendChild(script);

      this._initialized = true;
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

    // Automatically inject related tools before footer on tool pages
    shell.injectRelatedTools();

    if (footerPlaceholder) {
      shell.injectFooter();
    }

    // Initialize analytics and ads
    analytics.init();
    ads.init();

    // Auto-init components that use data-rt-component
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
  
  // Initialize theme immediately to prevent FOUC
  shell.initTheme();

  global.RT = {
    version: '2.0.0',
    config: CONFIG,
    dom,
    utils,
    shell,
    analytics,
    ads,
    init
  };

  // Auto-init on DOM ready unless opted out
  dom.ready(() => {
  if (window.performance && window.performance.mark) {
    window.performance.mark('rt-init-start');
  }

  if (document.documentElement.dataset.rtNoInit !== 'true') {
    init();
  }
});

})(window);
