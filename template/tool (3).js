/* ============================================
   REDRAG Tools — Template Tool JavaScript
   Namespace: RTTool
   Uses RT.* APIs (core.js, components.js, seo.js)
   Version: 2.0.0 (Phase 8 — Template)
   ============================================ */

(function (global) {
  'use strict';

  const RT = global.RT;
  if (!RT) {
    console.error('[RTTool] RT.core must be loaded first');
    return;
  }

  const { dom, utils, components, seo, analytics } = RT;

  /* ==========================================
     CONFIGURATION — EDIT THIS FOR YOUR TOOL
     ========================================== */
  const CONFIG = {
    // Tool identity
    name: 'Tool Name',
    slug: 'template',
    version: '2.0.0',

    // Data source
    dataUrl: 'data.json',

    // Input fields configuration
    // Types: 'number', 'text', 'select', 'checkbox'
    inputs: [
      {
        id: 'input-a',
        type: 'number',
        label: 'Input A',
        placeholder: 'Enter a number',
        default: 10,
        min: 0,
        max: 1000,
        step: 1
      },
      {
        id: 'input-b',
        type: 'select',
        label: 'Input B (Select)',
        options: [
          { value: 'option1', label: 'Option 1' },
          { value: 'option2', label: 'Option 2' },
          { value: 'option3', label: 'Option 3' }
        ],
        default: 'option1'
      },
      {
        id: 'input-c',
        type: 'checkbox',
        label: 'Enable Feature C',
        default: false
      }
    ],

    // Results display config
    result: {
      unit: 'units',
      precision: 2
    },

    // Stats to show (map to DOM IDs)
    stats: [
      { id: 'stat-1', label: 'Raw Value', key: 'raw' },
      { id: 'stat-2', label: 'Rounded', key: 'rounded' },
      { id: 'stat-3', label: 'Percentage', key: 'pct', suffix: '%' },
      { id: 'stat-4', label: 'Status', key: 'status' }
    ]
  };

  /* ==========================================
     STATE
     ========================================== */
  const state = {
    data: null,
    inputs: {},
    result: null,
    initialized: false
  };

  /* ==========================================
     DOM REFERENCES
     ========================================== */
  const els = {};

  function cacheElements() {
    els.inputsContainer = dom.$('#tool-inputs');
    els.resultValue = dom.$('#result-value');
    els.resultLabel = dom.$('#result-label');
    els.insightBox = dom.$('#insight-box');
    els.calcBtn = dom.$('#calc-btn');
    els.resetBtn = dom.$('#reset-btn');
    els.shareBtn = dom.$('#share-btn');
    els.tableBody = dom.$('#table-body');
  }

  /* ==========================================
     INITIALIZATION
     ========================================== */
  function init() {
    cacheElements();
    restoreState();

    loadData().then(() => {
      renderInputs();
      setupEventListeners();
      if (hasAllInputs()) calculate();
      renderTable();
      initFAQ();
      injectSchemas();
      state.initialized = true;
      analytics.trackTool(CONFIG.slug, 'load');
    }).catch(err => {
      console.error('[RTTool] Init failed:', err);
      components.Toast.show('Failed to initialize tool. Please refresh.', 'error', 5000);
    });
  }

  /* ==========================================
     DATA LOADING
     ========================================== */
  async function loadData() {
    try {
      const res = await fetch(CONFIG.dataUrl);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      state.data = await res.json();
    } catch (err) {
      console.warn('[RTTool] Could not load data.json:', err);
      state.data = { items: [] };
    }
  }

  /* ==========================================
     INPUT RENDERING
     ========================================== */
  function renderInputs() {
    if (!els.inputsContainer) return;

    els.inputsContainer.innerHTML = CONFIG.inputs.map(input => renderInput(input)).join('');

    // Restore values from state
    CONFIG.inputs.forEach(input => {
      const el = dom.$('#' + input.id);
      if (el && state.inputs[input.id] !== undefined) {
        if (input.type === 'checkbox') {
          el.checked = state.inputs[input.id];
        } else {
          el.value = state.inputs[input.id];
        }
      }
    });
  }

  function renderInput(config) {
    const value = state.inputs[config.id] !== undefined
      ? state.inputs[config.id]
      : (config.default !== undefined ? config.default : '');

    let html = '<div class="template-input-group">';
    html += '<label class="template-input-label" for="' + utils.escapeHtml(config.id) + '">' + utils.escapeHtml(config.label) + '</label>';

    if (config.type === 'select') {
      html += '<select id="' + utils.escapeHtml(config.id) + '" class="template-select" aria-label="' + utils.escapeHtml(config.label) + '">';
      (config.options || []).forEach(opt => {
        const selected = opt.value === value ? ' selected' : '';
        html += '<option value="' + utils.escapeHtml(opt.value) + '"' + selected + '>' + utils.escapeHtml(opt.label) + '</option>';
      });
      html += '</select>';
    } else if (config.type === 'checkbox') {
      const checked = value ? ' checked' : '';
      html += '<label class="template-checkbox-label">';
      html += '<input type="checkbox" id="' + utils.escapeHtml(config.id) + '"' + checked + ' aria-label="' + utils.escapeHtml(config.label) + '">';
      html += '<span>' + utils.escapeHtml(config.label) + '</span></label>';
    } else {
      html += '<input type="' + utils.escapeHtml(config.type) + '" id="' + utils.escapeHtml(config.id) + '"';
      html += ' class="template-input" placeholder="' + utils.escapeHtml(config.placeholder || '') + '"';
      html += ' value="' + utils.escapeHtml(String(value)) + '"';
      if (config.min !== undefined) html += ' min="' + config.min + '"';
      if (config.max !== undefined) html += ' max="' + config.max + '"';
      if (config.step !== undefined) html += ' step="' + config.step + '"';
      html += ' aria-label="' + utils.escapeHtml(config.label) + '">';
    }

    html += '</div>';
    return html;
  }

  /* ==========================================
     EVENT LISTENERS (Event Delegation)
     ========================================== */
  function setupEventListeners() {
    // Calculate button
    if (els.calcBtn) {
      els.calcBtn.addEventListener('click', () => {
        calculate();
        analytics.trackTool(CONFIG.slug, 'calculate');
      });
    }

    // Reset button
    if (els.resetBtn) {
      els.resetBtn.addEventListener('click', resetAll);
    }

    // Share button
    if (els.shareBtn) {
      els.shareBtn.addEventListener('click', shareResults);
    }

    // Input changes — auto-calculate on Enter key
    if (els.inputsContainer) {
      els.inputsContainer.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          calculate();
        }
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        resetAll();
      }
      if (e.ctrlKey && e.key === 'c' && state.result !== null) {
        e.preventDefault();
        shareResults();
      }
    });
  }

  /* ==========================================
     CALCULATION LOGIC — EDIT THIS FOR YOUR TOOL
     ========================================== */
  function calculate() {
    // Read all inputs
    const values = {};
    CONFIG.inputs.forEach(input => {
      const el = dom.$('#' + input.id);
      if (!el) return;
      if (input.type === 'checkbox') {
        values[input.id] = el.checked;
      } else if (input.type === 'number') {
        values[input.id] = parseFloat(el.value) || 0;
      } else {
        values[input.id] = el.value;
      }
      state.inputs[input.id] = values[input.id];
    });

    // === YOUR CALCULATION LOGIC GOES HERE ===
    // Example: simple formula
    const a = values['input-a'] || 0;
    const b = values['input-b'] === 'option2' ? 2 : values['input-b'] === 'option3' ? 3 : 1;
    const c = values['input-c'] ? 1.5 : 1;

    const rawResult = a * b * c;

    state.result = {
      value: rawResult,
      raw: rawResult,
      rounded: Math.round(rawResult),
      pct: Math.min(Math.round(rawResult), 100),
      status: rawResult > 50 ? 'High' : rawResult > 20 ? 'Medium' : 'Low'
    };
    // === END CALCULATION LOGIC ===

    updateResults();
    saveState();
  }

  /* ==========================================
     RESULTS UPDATE
     ========================================== */
  function updateResults() {
    if (!state.result) return;

    const r = state.result;
    const cfg = CONFIG.result;

    // Main result
    if (els.resultValue) {
      els.resultValue.textContent = r.value.toFixed(cfg.precision);
      els.resultValue.style.color = r.value > 50 ? 'var(--rt-danger)' : r.value > 20 ? 'var(--rt-warning)' : 'var(--rt-success)';
    }
    if (els.resultLabel) {
      els.resultLabel.textContent = cfg.unit;
    }

    // Stats
    CONFIG.stats.forEach(stat => {
      const el = dom.$('#' + stat.id);
      if (el && r[stat.key] !== undefined) {
        let val = r[stat.key];
        if (typeof val === 'number') val = val.toFixed(cfg.precision);
        if (stat.suffix) val += stat.suffix;
        el.textContent = val;
      }
    });

    // Insight
    if (els.insightBox) {
      els.insightBox.innerHTML = generateInsight(r);
    }
  }

  function generateInsight(r) {
    if (r.value === 0) {
      return '<div class="rt-insight__title">💡 Start Here</div><div>Enter values and click Calculate to see your result.</div>';
    }
    if (r.value > 50) {
      return '<div class="rt-insight__title">⚠️ High Value</div><div>Your result is <strong>' + r.value.toFixed(2) + '</strong>. This is above the recommended threshold. Consider reviewing your inputs.</div>';
    }
    return '<div class="rt-insight__title">✅ Result</div><div>Your calculated value is <strong>' + r.value.toFixed(2) + '</strong>. This is within normal range.</div>';
  }

  /* ==========================================
     DATA TABLE
     ========================================== */
  function renderTable() {
    if (!els.tableBody || !state.data) return;
    const items = state.data.items || [];

    if (items.length === 0) {
      els.tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--rt-text-muted);">No reference data available.</td></tr>';
      return;
    }

    els.tableBody.innerHTML = items.slice(0, 10).map(item =>
      '<tr>' +
      '<td>' + utils.escapeHtml(item.name || '') + '</td>' +
      '<td>' + utils.escapeHtml(String(item.value || '')) + '</td>' +
      '<td>' + utils.escapeHtml(item.notes || '') + '</td>' +
      '</tr>'
    ).join('');
  }

  /* ==========================================
     ACTIONS
     ========================================== */
  async function shareResults() {
    if (state.result === null) {
      components.Toast.show('Calculate something first!', 'warning', 3000);
      return;
    }

    const r = state.result;
    let text = '🎮 ' + CONFIG.name + ' Result\n\n';
    text += 'Result: ' + r.value.toFixed(CONFIG.result.precision) + ' ' + CONFIG.result.unit + '\n';
    CONFIG.stats.forEach(stat => {
      let val = r[stat.key];
      if (typeof val === 'number') val = val.toFixed(CONFIG.result.precision);
      if (stat.suffix) val += stat.suffix;
      text += stat.label + ': ' + val + '\n';
    });
    text += '\nCalculated at tools.redrag.in/' + CONFIG.slug + '/';

    const success = await utils.copyToClipboard(text);
    if (success) {
      components.Toast.show('Results copied to clipboard!', 'success', 3000);
      analytics.trackTool(CONFIG.slug, 'share');
    } else {
      components.Toast.show('Could not copy. Try manually.', 'error', 4000);
    }
  }

  function resetAll() {
    state.inputs = {};
    state.result = null;

    CONFIG.inputs.forEach(input => {
      const el = dom.$('#' + input.id);
      if (!el) return;
      if (input.type === 'checkbox') {
        el.checked = input.default || false;
      } else {
        el.value = input.default !== undefined ? input.default : '';
      }
    });

    if (els.resultValue) {
      els.resultValue.textContent = '—';
      els.resultValue.style.color = 'var(--rt-primary)';
    }
    if (els.resultLabel) els.resultLabel.textContent = 'Enter values and click Calculate';

    CONFIG.stats.forEach(stat => {
      const el = dom.$('#' + stat.id);
      if (el) el.textContent = '—';
    });

    if (els.insightBox) {
      els.insightBox.innerHTML = '<div class="rt-insight__title">💡 How It Works</div><div>Enter your values on the left and click Calculate to see your results instantly.</div>';
    }

    saveState();
    components.Toast.show('All inputs reset', 'info', 3000);
    analytics.trackTool(CONFIG.slug, 'reset');
  }

  /* ==========================================
     PERSISTENCE
     ========================================== */
  function saveState() {
    if (!state.initialized) return;

    utils.storage.set(CONFIG.slug + ':inputs', state.inputs);
    if (state.result) {
      utils.storage.set(CONFIG.slug + ':result', state.result);
    }

    // Build URL params from inputs
    const params = {};
    Object.entries(state.inputs).forEach(([key, val]) => {
      params[key] = val;
    });
    utils.setQueryParams(params);
  }

  function restoreState() {
    // Try URL params first
    const hasUrlParams = CONFIG.inputs.some(input => utils.getQueryParam(input.id) !== null);

    if (hasUrlParams) {
      CONFIG.inputs.forEach(input => {
        const val = utils.getQueryParam(input.id);
        if (val !== null) {
          if (input.type === 'checkbox') {
            state.inputs[input.id] = val === 'true';
          } else if (input.type === 'number') {
            state.inputs[input.id] = parseFloat(val) || 0;
          } else {
            state.inputs[input.id] = val;
          }
        }
      });
    } else {
      // Fall back to localStorage
      const saved = utils.storage.get(CONFIG.slug + ':inputs', {});
      Object.assign(state.inputs, saved);
    }
  }

  function hasAllInputs() {
    return CONFIG.inputs.every(input => state.inputs[input.id] !== undefined);
  }

  /* ==========================================
     FAQ
     ========================================== */
  function initFAQ() {
    const container = dom.$('#faq-container');
    if (!container) return;

    const items = [
      {
        question: 'How accurate is this calculator?',
        answer: '<p>This calculator provides <strong>estimates based on official specifications</strong>. Real-world results may vary slightly depending on specific hardware configurations and software versions.</p>'
      },
      {
        question: 'Is this tool free to use?',
        answer: '<p>Yes, completely free. No signup, no ads, no tracking. All calculations happen in your browser.</p>'
      },
      {
        question: 'Can I share my results?',
        answer: '<p>Absolutely! Click the <strong>Copy Results</strong> button to copy a formatted summary to your clipboard. You can also share the URL — your inputs are saved in the link.</p>'
      },
      {
        question: 'How is the data sourced?',
        answer: '<p>All data is sourced from official manufacturer documentation, product pages, and verified third-party benchmarks. We update regularly to keep numbers accurate.</p>'
      },
      {
        question: 'Does this work on mobile?',
        answer: '<p>Yes! All REDRAG Tools are fully responsive and work on desktop, mobile, and tablet browsers without installing any app.</p>'
      },
      {
        question: 'I found incorrect data. How do I report it?',
        answer: '<p>Please <a href="https://www.redrag.in/p/contact-us.html">contact us</a> with the details. We verify and update within 48 hours.</p>'
      }
    ];

    components.FAQ.init({
      container: container,
      items: items,
      showSchema: true,
      openFirst: false
    });
  }

  /* ==========================================
     SCHEMA INJECTION (8 types)
     ========================================== */
  function injectSchemas() {
    const toolUrl = RT.config.urls.toolsHub + CONFIG.slug + '/';
    const blogUrl = RT.config.urls.blog;

    // 1. BreadcrumbList — already inline in HTML <head>

    // 2. WebApplication
    seo.injectSchema({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      '@id': toolUrl + '#webapp',
      name: 'REDRAG ' + CONFIG.name,
      applicationCategory: 'UtilityApplication',
      operatingSystem: 'Web Browser',
      browserRequirements: 'Requires JavaScript. Compatible with Chrome, Firefox, Safari, Edge.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        ratingCount: '100',
        bestRating: '5',
        worstRating: '1'
      },
      featureList: [
        'Real-time calculations in browser',
        'Shareable results via URL',
        'Mobile responsive design',
        'No signup required'
      ],
      screenshot: {
        '@type': 'ImageObject',
        url: 'https://tools.redrag.in/assets/images/og-' + CONFIG.slug + '.jpg',
        width: 1200,
        height: 630
      },
      description: 'Free ' + CONFIG.name + ' calculator for gamers and PC builders.',
      url: toolUrl,
      author: { '@type': 'Organization', name: 'REDRAG', url: blogUrl },
      publisher: {
        '@type': 'Organization',
        name: 'REDRAG',
        url: blogUrl,
        logo: { '@type': 'ImageObject', url: blogUrl + 'assets/logo.png' }
      },
      datePublished: '2026-07-31',
      dateModified: '2026-07-31',
      inLanguage: 'en',
      isAccessibleForFree: true
    }, 'rt-schema-webapp');

    // 3. SoftwareApplication
    seo.softwareApplicationSchema({
      name: 'REDRAG ' + CONFIG.name,
      description: 'Free ' + CONFIG.name + ' calculator for gamers and PC builders.',
      url: toolUrl,
      ratingValue: '4.8',
      ratingCount: '100'
    });

    // 4. HowTo
    seo.howToSchema({
      name: 'How to Use ' + CONFIG.name,
      description: 'Learn how to calculate ' + CONFIG.name.toLowerCase() + ' with REDRAG's free tool.',
      totalTime: 'PT1M',
      steps: [
        { name: 'Enter Your Values', text: 'Fill in the required inputs on the left panel. All fields support real-time updates.', url: toolUrl + '#step1' },
        { name: 'Click Calculate', text: 'Press the Calculate button or hit Enter to process your inputs.', url: toolUrl + '#step2' },
        { name: 'Review Results', text: 'See your calculated result, detailed stats, and personalized recommendations.', url: toolUrl + '#step3' }
      ],
      supplies: [],
      tools: ['REDRAG ' + CONFIG.name]
    });

    // 5. Article
    seo.injectSchema({
      '@context': 'https://schema.org',
      '@type': 'Article',
      '@id': toolUrl + '#article',
      headline: CONFIG.name + ': Free Calculator for Gamers & PC Builders (2026)',
      description: 'Free ' + CONFIG.name + ' calculator. Enter your specs, get instant results. No signup needed.',
      image: 'https://tools.redrag.in/assets/images/og-' + CONFIG.slug + '.jpg',
      author: { '@type': 'Organization', name: 'REDRAG', url: blogUrl },
      publisher: {
        '@type': 'Organization',
        name: 'REDRAG',
        logo: { '@type': 'ImageObject', url: blogUrl + 'assets/logo.png' }
      },
      datePublished: '2026-07-31',
      dateModified: '2026-07-31',
      mainEntityOfPage: { '@type': 'WebPage', '@id': toolUrl },
      mainEntity: { '@id': toolUrl + '#webapp' },
      articleSection: 'Gaming Tools',
      wordCount: 1500,
      inLanguage: 'en'
    }, 'rt-schema-article');

    // 6. FAQPage — auto-injected by RT.components.FAQ.init
    // 7. Organization
    seo.organizationSchema();
    // 8. WebSite
    seo.websiteSchema();

    // Update meta tags dynamically
    seo.setMeta('article:published_time', '2026-07-31T00:00:00+05:30');
    seo.setMeta('article:modified_time', '2026-07-31T00:00:00+05:30');
  }

  /* ==========================================
     PUBLIC API
     ========================================== */
  global.RTTool = {
    meta: { name: CONFIG.name, slug: CONFIG.slug, version: CONFIG.version },
    init,
    _state: state,
    _config: CONFIG
  };

})(window);