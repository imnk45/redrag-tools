/* ============================================
   [Tool Name] - Core Logic
   Requires: shared/js/core.js, shared/js/components.js
   ============================================ */

(function (global) {
  'use strict';

  // Wait for shell to be ready (header/footer injected)
  const RT = global.RT;
  if (!RT) {
    console.error('[RTTool] Core not loaded');
    return;
  }

  const { dom, utils, shell, analytics } = RT;
  // Make sure components exist
  const components = global.RT.components || {};

  /* ==========================================
     STATE MANAGEMENT
     ========================================== */
  const state = {
    // Define your state variables here
    inputValue: 0,
    resultValue: 0
  };

  /* ==========================================
     DOM ELEMENTS
     ========================================== */
  const els = {};

  function cacheDOM() {
    els.btnCopy = dom.$('#btn-copy');
    els.btnReset = dom.$('#btn-reset');
    // Add other elements here
  }

  /* ==========================================
     CORE LOGIC
     ========================================== */
  
  function calculateResult() {
    // Perform calculations based on state
    state.resultValue = state.inputValue * 2; // Example
    updateUI();
  }

  function updateUI() {
    // Update the DOM based on state
  }

  /* ==========================================
     EVENT LISTENERS
     ========================================== */
  
  function bindEvents() {
    
    // Copy Button
    if (els.btnCopy) {
      els.btnCopy.addEventListener('click', async () => {
        const textToCopy = `Result: ${state.resultValue}`;
        const success = await utils.copyToClipboard(textToCopy);
        
        if (success) {
          if (components.Toast) {
            components.Toast.show({ message: 'Result copied to clipboard!', type: 'success', duration: 3000 });
          }
          analytics.trackTool('your-tool-slug', 'share');
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
        state.inputValue = 0;
        state.resultValue = 0;
        updateUI();
        
        if (components.Toast) {
          components.Toast.show({ message: 'All inputs reset', type: 'info', duration: 3000 });
        }
        analytics.trackTool('your-tool-slug', 'reset');
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
    updateUI();
    
    analytics.trackTool('your-tool-slug', 'load');
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
