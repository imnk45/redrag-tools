/* ============================================
   RAM Latency Calculator - Core Logic
   Requires: shared/js/core.js, shared/js/components.js
   ============================================ */

(function (global) {
  'use strict';

  // Wait for shell to be ready
  const RT = global.RT;
  if (!RT) {
    console.error('[RTTool] Core not loaded');
    return;
  }

  const { dom, utils, shell, analytics } = RT;
  const components = global.RT.components || {};

  /* ==========================================
     STATE MANAGEMENT
     ========================================== */
  const state = {
    kitA: { speed: 3600, cl: 16 },
    kitB: { speed: 6000, cl: 30 },
    resA: 0,
    resB: 0
  };

  /* ==========================================
     DOM ELEMENTS
     ========================================== */
  const els = {};

  function cacheDOM() {
    els.speedA = dom.$('#speed-a');
    els.clA = dom.$('#cl-a');
    els.speedB = dom.$('#speed-b');
    els.clB = dom.$('#cl-b');
    
    els.resA = dom.$('#res-a');
    els.resB = dom.$('#res-b');
    els.verdict = dom.$('#verdict');
    
    els.btnCopy = dom.$('#btn-copy');
    els.btnReset = dom.$('#btn-reset');
  }

  /* ==========================================
     CORE LOGIC
     ========================================== */
  
  function calculateResult() {
    // Read from inputs
    state.kitA.speed = parseInt(els.speedA.value) || 0;
    state.kitA.cl = parseInt(els.clA.value) || 0;
    
    state.kitB.speed = parseInt(els.speedB.value) || 0;
    state.kitB.cl = parseInt(els.clB.value) || 0;

    // Calculate latency: (CL * 2000) / Speed
    if (state.kitA.speed > 0 && state.kitA.cl > 0) {
      state.resA = (state.kitA.cl * 2000) / state.kitA.speed;
    } else {
      state.resA = 0;
    }

    if (state.kitB.speed > 0 && state.kitB.cl > 0) {
      state.resB = (state.kitB.cl * 2000) / state.kitB.speed;
    } else {
      state.resB = 0;
    }

    updateUI();
  }

  function updateUI() {
    // Format to 2 decimal places
    const formatNs = (val) => val > 0 ? val.toFixed(2) + ' ns' : '--';

    els.resA.textContent = formatNs(state.resA);
    els.resB.textContent = formatNs(state.resB);

    // Determine verdict
    if (state.resA === 0 && state.resB === 0) {
      els.verdict.innerHTML = `<span style="color:var(--rt-text-muted);">Enter RAM details to compare</span>`;
      return;
    }

    if (state.resA === 0) {
      els.verdict.innerHTML = `Kit B is <span style="color:#60a5fa;">${state.resB.toFixed(2)} ns</span>`;
      return;
    }

    if (state.resB === 0) {
      els.verdict.innerHTML = `Kit A is <span style="color:#4ade80;">${state.resA.toFixed(2)} ns</span>`;
      return;
    }

    const diff = Math.abs(state.resA - state.resB).toFixed(2);

    if (state.resA < state.resB) {
      els.verdict.innerHTML = `Kit A is <span style="color:#4ade80; font-weight:900;">${diff} ns faster</span>`;
    } else if (state.resB < state.resA) {
      els.verdict.innerHTML = `Kit B is <span style="color:#60a5fa; font-weight:900;">${diff} ns faster</span>`;
    } else {
      els.verdict.innerHTML = `Both kits have the <span style="color:var(--rt-text-primary); font-weight:900;">same latency</span>`;
    }
  }

  /* ==========================================
     EVENT LISTENERS
     ========================================== */
  
  function bindEvents() {
    // Listen to inputs (real-time update)
    [els.speedA, els.clA, els.speedB, els.clB].forEach(input => {
      input.addEventListener('input', calculateResult);
    });
    
    // Copy Button
    if (els.btnCopy) {
      els.btnCopy.addEventListener('click', async () => {
        let textToCopy = `RAM Latency Comparison (via REDRAG Tools):\n\n`;
        textToCopy += `Kit A: ${state.kitA.speed} MT/s CL${state.kitA.cl} -> ${state.resA.toFixed(2)} ns\n`;
        textToCopy += `Kit B: ${state.kitB.speed} MT/s CL${state.kitB.cl} -> ${state.resB.toFixed(2)} ns\n\n`;
        
        let verdictText = els.verdict.textContent.trim();
        textToCopy += `Verdict: ${verdictText}\n`;
        textToCopy += `https://tools.redrag.in/ram/`;

        const success = await utils.copyToClipboard(textToCopy);
        
        if (success) {
          if (components.Toast) {
            components.Toast.show({ message: 'Comparison copied to clipboard!', type: 'success', duration: 3000 });
          }
          analytics.trackTool('ram', 'share');
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
        els.speedA.value = 3600;
        els.clA.value = 16;
        els.speedB.value = 6000;
        els.clB.value = 30;
        
        calculateResult();
        
        if (components.Toast) {
          components.Toast.show({ message: 'Inputs reset to defaults', type: 'info', duration: 3000 });
        }
        analytics.trackTool('ram', 'reset');
      });
    }
  }

  /* ==========================================
     INITIALIZATION
     ========================================== */
  
  async function init() {
    cacheDOM();
    bindEvents();
    
    // Initial UI render
    calculateResult();
    
    analytics.trackTool('ram', 'load');
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
