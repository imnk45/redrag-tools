/* ============================================
   RAM Latency Calculator - Core Logic
   Requires: shared/js/core.js, shared/js/components.js
   ============================================ */

(function (global) {
  'use strict';

  const RT = global.RT;
  if (!RT) {
    console.error('[RTTool] Core not loaded');
    return;
  }

  const { dom, utils, shell, analytics } = RT;
  const components = global.RT.components || {};

  /* ==========================================
     CONFIGURATION
     ========================================== */
  const TOOL_SLUG = 'ram-latency-calculator';

  const DDR_PRESETS = {
    ddr3: {
      speeds: [800, 1066, 1333, 1600, 1866, 2133],
      cls: [5, 7, 9, 10, 11],
      defaultSpeed: 1600,
      defaultCl: 9
    },
    ddr4: {
      speeds: [2133, 2400, 2666, 3000, 3200, 3600, 4000, 4266, 4400, 4800],
      cls: [14, 15, 16, 17, 18, 19, 20, 22],
      defaultSpeed: 3200,
      defaultCl: 16
    },
    ddr5: {
      speeds: [4800, 5200, 5600, 6000, 6400, 6800, 7200, 7600, 8000],
      cls: [30, 32, 34, 36, 38, 40, 42],
      defaultSpeed: 6000,
      defaultCl: 30
    }
  };

  const GRADES = [
    { max: 8.0, label: 'Excellent', class: 'excellent', color: '#22c55e', tip: 'Top-tier latency. Ideal for competitive gaming and high-frequency trading.' },
    { max: 10.0, label: 'Very Good', class: 'very-good', color: '#84cc16', tip: 'Great latency for gaming and daily use. Most DDR4-3200 CL16 and DDR5-6000 CL30 kits fall here.' },
    { max: 12.0, label: 'Good', class: 'good', color: '#eab308', tip: 'Solid performance for general computing and most games. A safe choice for budget builds.' },
    { max: 14.0, label: 'Average', class: 'average', color: '#f97316', tip: 'Acceptable for basic tasks, but you may notice occasional stuttering in CPU-bound games.' },
    { max: 16.0, label: 'Below Average', class: 'below-average', color: '#f43f5e', tip: 'Consider upgrading or tightening timings if you experience performance issues.' },
    { max: Infinity, label: 'Poor', class: 'poor', color: '#dc2626', tip: 'High latency will bottleneck CPU performance. Upgrade to faster memory recommended.' }
  ];

  const REFERENCE_KITS = [
    { name: 'DDR3-1600 CL9', type: 'ddr3', speed: 1600, cl: 9 },
    { name: 'DDR3-1866 CL10', type: 'ddr3', speed: 1866, cl: 10 },
    { name: 'DDR3-2133 CL11', type: 'ddr3', speed: 2133, cl: 11 },
    { name: 'DDR4-2400 CL14', type: 'ddr4', speed: 2400, cl: 14 },
    { name: 'DDR4-2666 CL16', type: 'ddr4', speed: 2666, cl: 16 },
    { name: 'DDR4-3200 CL16', type: 'ddr4', speed: 3200, cl: 16 },
    { name: 'DDR4-3600 CL16', type: 'ddr4', speed: 3600, cl: 16 },
    { name: 'DDR4-3600 CL18', type: 'ddr4', speed: 3600, cl: 18 },
    { name: 'DDR4-4000 CL18', type: 'ddr4', speed: 4000, cl: 18 },
    { name: 'DDR5-4800 CL40', type: 'ddr5', speed: 4800, cl: 40 },
    { name: 'DDR5-5600 CL36', type: 'ddr5', speed: 5600, cl: 36 },
    { name: 'DDR5-6000 CL30', type: 'ddr5', speed: 6000, cl: 30 },
    { name: 'DDR5-6400 CL32', type: 'ddr5', speed: 6400, cl: 32 },
    { name: 'DDR5-7200 CL34', type: 'ddr5', speed: 7200, cl: 34 },
    { name: 'DDR5-8000 CL38', type: 'ddr5', speed: 8000, cl: 38 }
  ];

  /* ==========================================
     STATE MANAGEMENT
     ========================================== */
  const state = {
    ddrType: 'ddr4',
    speed: 3200,
    cl: 16,
    latency: 0,
    memClock: 1600
  };

  /* ==========================================
     DOM ELEMENTS
     ========================================== */
  const els = {};

  function cacheDOM() {
    els.ddrType = dom.$('#ddr-type');
    els.ramSpeed = dom.$('#ram-speed');
    els.casLatency = dom.$('#cas-latency');
    els.memClock = dom.$('#mem-clock');
    els.resultLatency = dom.$('#result-latency');
    els.gradeBadge = dom.$('#grade-badge');
    els.formulaDisplay = dom.$('#formula-display');
    els.resultType = dom.$('#result-type');
    els.resultSpeed = dom.$('#result-speed');
    els.resultCl = dom.$('#result-cl');
    els.quickTip = dom.$('#quick-tip');
    els.btnCopy = dom.$('#btn-copy');
    els.btnReset = dom.$('#btn-reset');
    els.speedPresets = dom.$('#speed-presets');
    els.clPresets = dom.$('#cl-presets');
    els.compareTbody = dom.$('#compare-tbody');
  }

  /* ==========================================
     CORE LOGIC
     ========================================== */

  function calculateLatency() {
    // True Latency (ns) = (CL × 2000) / Data Rate (MT/s)
    state.latency = (state.cl * 2000) / state.speed;
    // Memory Clock = Data Rate / 2 for DDR
    state.memClock = state.speed / 2;
  }

  function getGrade(latency) {
    for (const grade of GRADES) {
      if (latency <= grade.max) {
        return grade;
      }
    }
    return GRADES[GRADES.length - 1];
  }

  function getSpeedPresetsForType(type) {
    return DDR_PRESETS[type].speeds;
  }

  function getClPresetsForType(type) {
    return DDR_PRESETS[type].cls;
  }

  /* ==========================================
     UI UPDATES
     ========================================== */

  function updateSpeedPresets() {
    const presets = getSpeedPresetsForType(state.ddrType);
    els.speedPresets.innerHTML = presets.map(s => 
      `<button class="rl-preset-btn" data-speed="${s}">${s}</button>`
    ).join('');

    // Re-bind preset events
    els.speedPresets.querySelectorAll('.rl-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.speed = parseInt(btn.dataset.speed, 10);
        els.ramSpeed.value = state.speed;
        calculateAndUpdate();
      });
    });
  }

  function updateClPresets() {
    const presets = getClPresetsForType(state.ddrType);
    els.clPresets.innerHTML = presets.map(c => 
      `<button class="rl-preset-btn" data-cl="${c}">CL${c}</button>`
    ).join('');

    // Re-bind preset events
    els.clPresets.querySelectorAll('.rl-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.cl = parseInt(btn.dataset.cl, 10);
        els.casLatency.value = state.cl;
        calculateAndUpdate();
      });
    });
  }

  function updateComparisonTable() {
    const currentLatency = state.latency;

    const rows = REFERENCE_KITS.map(kit => {
      const kitLatency = (kit.cl * 2000) / kit.speed;
      const diff = kitLatency - currentLatency;
      const diffStr = diff > 0 ? `+${diff.toFixed(2)}ns` : diff < 0 ? `${diff.toFixed(2)}ns` : 'Same';
      const diffClass = diff > 0 ? 'rl-diff-slower' : diff < 0 ? 'rl-diff-faster' : 'rl-diff-same';
      const isCurrent = Math.abs(kitLatency - currentLatency) < 0.001 && kit.type === state.ddrType;
      const highlightClass = isCurrent ? 'rl-row-active' : '';

      return `<tr class="${highlightClass}">
        <td><strong>${kit.name}</strong></td>
        <td>${kit.speed} MT/s</td>
        <td>CL${kit.cl}</td>
        <td><span class="rl-latency-val">${kitLatency.toFixed(2)}ns</span> <span class="rl-diff ${diffClass}">${diffStr}</span></td>
      </tr>`;
    }).join('');

    els.compareTbody.innerHTML = rows;
  }

  function updateUI() {
    const grade = getGrade(state.latency);

    // Main result
    els.resultLatency.textContent = state.latency.toFixed(2);

    // Grade badge
    els.gradeBadge.dataset.grade = grade.class;
    els.gradeBadge.querySelector('.rl-grade-text').textContent = grade.label;
    els.gradeBadge.querySelector('.rl-grade-dot').style.backgroundColor = grade.color;

    // Details
    els.formulaDisplay.textContent = `(${state.cl} × 2000) ÷ ${state.speed}`;
    els.resultType.textContent = state.ddrType.toUpperCase();
    els.resultSpeed.textContent = `${state.speed} MT/s`;
    els.resultCl.textContent = `CL${state.cl}`;
    els.memClock.value = state.memClock;

    // Quick tip
    els.quickTip.textContent = grade.tip;

    // Comparison table
    updateComparisonTable();

    // Update URL for shareability
    updateURL();
  }

  function calculateAndUpdate() {
    calculateLatency();
    updateUI();
  }

  function updateURL() {
    const params = new URLSearchParams();
    params.set('type', state.ddrType);
    params.set('speed', state.speed);
    params.set('cl', state.cl);

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }

  function loadFromURL() {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    const speed = parseInt(params.get('speed'), 10);
    const cl = parseInt(params.get('cl'), 10);

    if (type && DDR_PRESETS[type]) {
      state.ddrType = type;
      els.ddrType.value = type;
    }
    if (!isNaN(speed) && speed >= 800 && speed <= 12000) {
      state.speed = speed;
      els.ramSpeed.value = speed;
    }
    if (!isNaN(cl) && cl >= 5 && cl <= 60) {
      state.cl = cl;
      els.casLatency.value = cl;
    }

    updateSpeedPresets();
    updateClPresets();
  }

  /* ==========================================
     EVENT LISTENERS
     ========================================== */

  function bindEvents() {
    // DDR Type change
    els.ddrType.addEventListener('change', () => {
      state.ddrType = els.ddrType.value;
      const presets = DDR_PRESETS[state.ddrType];
      state.speed = presets.defaultSpeed;
      state.cl = presets.defaultCl;
      els.ramSpeed.value = state.speed;
      els.casLatency.value = state.cl;
      updateSpeedPresets();
      updateClPresets();
      calculateAndUpdate();
      analytics.trackTool(TOOL_SLUG, 'change_type');
    });

    // Speed input
    els.ramSpeed.addEventListener('input', () => {
      const val = parseInt(els.ramSpeed.value, 10);
      if (!isNaN(val) && val >= 800 && val <= 12000) {
        state.speed = val;
        calculateAndUpdate();
      }
    });

    // CAS Latency input
    els.casLatency.addEventListener('input', () => {
      const val = parseInt(els.casLatency.value, 10);
      if (!isNaN(val) && val >= 5 && val <= 60) {
        state.cl = val;
        calculateAndUpdate();
      }
    });

    // Copy Button
    if (els.btnCopy) {
      els.btnCopy.addEventListener('click', async () => {
        const grade = getGrade(state.latency);
        const textToCopy = `RAM Latency Result\n\nType: ${state.ddrType.toUpperCase()}\nSpeed: ${state.speed} MT/s\nCAS Latency: CL${state.cl}\nTrue Latency: ${state.latency.toFixed(2)}ns\nGrade: ${grade.label}\n\nCalculated via tools.redrag.in/ram-latency-calculator/`;

        const success = await utils.copyToClipboard(textToCopy);

        if (success) {
          if (components.Toast) {
            components.Toast.show({ message: 'Result copied to clipboard!', type: 'success', duration: 3000 });
          }
          analytics.trackTool(TOOL_SLUG, 'copy');
        } else {
          if (components.Toast) {
            components.Toast.show({ message: 'Could not copy. Try manually.', type: 'error', duration: 4000 });
          }
        }
      });
    }

    // Reset Button
    if (els.btnReset) {
      els.btnReset.addEventListener('click', () => {
        state.ddrType = 'ddr4';
        state.speed = 3200;
        state.cl = 16;
        els.ddrType.value = 'ddr4';
        els.ramSpeed.value = 3200;
        els.casLatency.value = 16;
        updateSpeedPresets();
        updateClPresets();
        calculateAndUpdate();

        if (components.Toast) {
          components.Toast.show({ message: 'All inputs reset to defaults', type: 'info', duration: 3000 });
        }
        analytics.trackTool(TOOL_SLUG, 'reset');
      });
    }
  }

  /* ==========================================
     INITIALIZATION
     ========================================== */

  async function init() {
    cacheDOM();
    loadFromURL();
    updateSpeedPresets();
    updateClPresets();
    bindEvents();
    calculateAndUpdate();

    analytics.trackTool(TOOL_SLUG, 'load');
  }

  // Auto-start when DOM is ready
  dom.ready(() => {
    shell.ready.then(init).catch(err => {
      console.error('[RTTool] Init failed:', err);
      if (components.Toast) {
        components.Toast.show({ message: 'Failed to initialize tool. Please refresh.', type: 'error', duration: 5000 });
      }
    });
  });

})(window);