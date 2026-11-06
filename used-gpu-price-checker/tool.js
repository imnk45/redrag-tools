/* ============================================
   Used GPU Fair Price Checker — Core Logic
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

  /* =====================================================
     GPU PRICE DATA — VERIFIED MARKET BANDS (₹, INR)
     -----------------------------------------------------
     HOW TO UPDATE (monthly, owner job — no coding needed):
     1. Edit only the numbers below.
     2. Change `lastUpdated` / `nextUpdate`.
     3. For a NEW card, copy one block, change values,
        and set "verified": true ONLY after checking real
        listings (TechEnclave sales threads, OLX, refurb
        stores). Never guess a price.
     Verified sources for Nov 2026 data: TechEnclave
     market price-guide threads, OLX/ Facebook Marketplace
     classifieds, Indian refurb store listings.
     ===================================================== */
  const GPU_DATA = {
    lastUpdated: '6 November 2026',
    nextUpdate: '6 December 2026',

    cards: [
      /* ---------- VERIFIED — bands checked Nov 2026 ---------- */
      {
        id: 'rtx-3060-12gb',
        name: 'RTX 3060 12GB',
        brand: 'NVIDIA',
        verified: true,
        tiers: {
          entry:   { min: 22000, max: 24000 }, // Galax/Colorful/Inno3D; mining & bulk units sell ₹20,000–21,000
          mid:     { min: 24000, max: 26000 }, // Zotac Twin Fan, MSI Ventus, Gigabyte Eagle
          premium: { min: 26000, max: 28000 }  // ASUS TUF/Strix, MSI Gaming X, AORUS, triple-fan
        },
        scamLine: 20000,
        specialNote: 'Mining or bulk-quantity units: expect ₹20,000–21,000 and test thermals carefully.'
      },
      {
        id: 'rtx-3060-ti-8gb',
        name: 'RTX 3060 Ti 8GB',
        brand: 'NVIDIA',
        verified: true,
        // Market-observed band ₹19,000–25,500 (Nov 2026). The Ti currently sells at or BELOW
        // the 3060 12GB: faster card, but AI buyers want the 12GB VRAM.
        tiers: {
          entry:   { min: 19000, max: 21000 },
          mid:     { min: 21000, max: 23500 },
          premium: { min: 23500, max: 25500 }
        },
        scamLine: 17000,
        specialNote: 'Value alert: for pure gaming, a 3060 Ti under ₹22,000 beats a 3060 12GB at ₹26,000.'
      },
      {
        id: 'rtx-3090-24gb',
        name: 'RTX 3090 24GB',
        brand: 'NVIDIA',
        verified: true,
        // CONTESTED MARKET (Nov 2026): sellers ask ₹1,00,000–1,20,000; experienced buyers
        // call ₹60,000–80,000 fair. Bands below reflect both ends of that argument.
        tiers: {
          entry:   { min: 60000, max: 75000 },  // experienced-buyer fair band
          mid:     { min: 75000, max: 90000 },  // upper fair / low seller-ask
          premium: { min: 90000, max: 100000 }  // strong seller-ask territory
        },
        scamLine: 60000, // listings below this are almost always fake
        specialNote: 'The most argued-about card in India right now. Warranty is rare — check thermals and repaste history carefully.'
      },

      /* ---------- VERIFIED — bands from the Nov 2026 verified data sheet (6 Nov 2026).
         Single-band cards: sources did not support a tier split, so all three tiers
         carry the same band — deliberate, not a copy error. ---------- */
      { id: 'gtx-1660-super', name: 'GTX 1660 Super', brand: 'NVIDIA', verified: true,
        tiers: { entry: { min: 11500, max: 14000 }, mid: { min: 11500, max: 14000 }, premium: { min: 11500, max: 14000 } },
        scamLine: 9000 },
      { id: 'rtx-2060', name: 'RTX 2060', brand: 'NVIDIA', verified: true,
        tiers: { entry: { min: 12500, max: 14500 }, mid: { min: 12500, max: 14500 }, premium: { min: 12500, max: 14500 } },
        scamLine: 10000 },
      { id: 'rtx-2060-super', name: 'RTX 2060 Super', brand: 'NVIDIA', verified: true,
        tiers: { entry: { min: 14000, max: 16000 }, mid: { min: 14000, max: 16000 }, premium: { min: 14000, max: 16000 } },
        scamLine: 11000 },
      { id: 'rtx-2070-super', name: 'RTX 2070 Super', brand: 'NVIDIA', verified: true,
        tiers: { entry: { min: 16000, max: 18000 }, mid: { min: 16000, max: 18000 }, premium: { min: 19000, max: 21000 } },
        scamLine: 12500,
        specialNote: 'Premium-model band (ROG Strix class) rests on limited listings — treat it as indicative.' },
      { id: 'rtx-3060-8gb', name: 'RTX 3060 8GB', brand: 'NVIDIA', verified: true, // PROVISIONAL band — single store anchor; re-verify FIRST in December
        tiers: { entry: { min: 15000, max: 17500 }, mid: { min: 15000, max: 17500 }, premium: { min: 15000, max: 17500 } },
        scamLine: 12000,
        specialNote: 'Warning: the 8GB card is ~15% slower than the 12GB and is often listed as just "RTX 3060". Confirm the VRAM before paying — never price it off the 12GB band.' },
      { id: 'rtx-3070', name: 'RTX 3070', brand: 'NVIDIA', verified: true,
        tiers: { entry: { min: 20000, max: 22000 }, mid: { min: 21000, max: 23000 }, premium: { min: 23000, max: 25000 } },
        scamLine: 16000 },
      { id: 'rtx-3070-ti', name: 'RTX 3070 Ti', brand: 'NVIDIA', verified: true,
        tiers: { entry: { min: 24000, max: 28000 }, mid: { min: 24000, max: 28000 }, premium: { min: 24000, max: 28000 } },
        scamLine: 19000,
        specialNote: 'Quoted ₹28,000+ for a 3070 Ti? Cross-shop a used RTX 3080 10GB first — their price bands overlap.' },
      { id: 'rtx-3080-10gb', name: 'RTX 3080 10GB', brand: 'NVIDIA', verified: true,
        tiers: { entry: { min: 30000, max: 33000 }, mid: { min: 32000, max: 35000 }, premium: { min: 36000, max: 40000 } },
        scamLine: 24000 },
      { id: 'rx-6600', name: 'RX 6600', brand: 'AMD', verified: true,
        tiers: { entry: { min: 14000, max: 16500 }, mid: { min: 14000, max: 16500 }, premium: { min: 14000, max: 16500 } },
        scamLine: 11000 },
      { id: 'rx-6600-xt', name: 'RX 6600 XT', brand: 'AMD', verified: true,
        tiers: { entry: { min: 16000, max: 19000 }, mid: { min: 16000, max: 19000 }, premium: { min: 19000, max: 20000 } },
        scamLine: 12500 },
      { id: 'rx-6700-xt', name: 'RX 6700 XT', brand: 'AMD', verified: true,
        tiers: { entry: { min: 21000, max: 24000 }, mid: { min: 21000, max: 25000 }, premium: { min: 25000, max: 27000 } },
        scamLine: 16500 },
      { id: 'rtx-4060', name: 'RTX 4060', brand: 'NVIDIA', verified: true,
        tiers: { entry: { min: 23000, max: 27000 }, mid: { min: 23000, max: 27000 }, premium: { min: 23000, max: 27000 } },
        scamLine: 18000 },
      { id: 'rtx-4060-ti-8gb', name: 'RTX 4060 Ti 8GB', brand: 'NVIDIA', verified: true, // TENTATIVE band — single source; re-verify FIRST in December
        tiers: { entry: { min: 27000, max: 31000 }, mid: { min: 27000, max: 31000 }, premium: { min: 27000, max: 31000 } },
        scamLine: 21500,
        specialNote: 'Early band from limited listings — this card is re-verified first in our December update.' },
      { id: 'rtx-4060-ti-16gb', name: 'RTX 4060 Ti 16GB', brand: 'NVIDIA', verified: true,
        tiers: { entry: { min: 35000, max: 38000 }, mid: { min: 35000, max: 38000 }, premium: { min: 35000, max: 38000 } },
        scamLine: 28000, // ~20% below the entry band, per the spec formula
        specialNote: 'The 16GB version trades ~₹8,000 above the 8GB — always confirm which one a listing actually is.' },
      { id: 'rtx-4070', name: 'RTX 4070', brand: 'NVIDIA', verified: true,
        tiers: { entry: { min: 38000, max: 40000 }, mid: { min: 40000, max: 43000 }, premium: { min: 43000, max: 46000 } },
        scamLine: 30000 }
    ]
  };

  /* ---------- Pricing rules (fixed logic — do not edit per card) ---------- */
  const WARRANTY_ADJ = { none: 0, under6: 500, '6to12': 1000, over1: 2000 }; // ₹ added to both ends
  const CONDITION_MULT = { likenew: { top: 1.02 }, good: { top: 1.0 }, heavy: { bottom: 0.95 }, unknown: { bottom: 0.95 } };
  const DEAL_MARGIN = 1000;    // "great deal" line = fairMin − ₹1,000
  const OVERPAY_MARGIN = 1000; // "overpay" line  = fairMax + ₹1,000

  /* ==========================================
     STATE MANAGEMENT
     ========================================== */
  const state = {
    gpuId: 'rtx-3060-12gb',
    tier: 'mid',
    warranty: 'none',
    condition: 'good',
    result: null
  };

  /* ==========================================
     DOM ELEMENTS
     ========================================== */
  const els = {};

  function cacheDOM() {
    els.gpuModel  = dom.$('#gpu-model');
    els.tier      = dom.$('#gpu-tier');
    els.warranty  = dom.$('#gpu-warranty');
    els.condition = dom.$('#gpu-condition');
    els.resultWrap  = dom.$('#result-wrap');
    els.pendingWrap = dom.$('#result-pending');
    els.priceRange  = dom.$('#price-range');
    els.dealLine    = dom.$('#deal-line');
    els.overpayLine = dom.$('#overpay-line');
    els.scamLine    = dom.$('#scam-line');
    els.verdict     = dom.$('#price-verdict');
    els.noteBox     = dom.$('#special-note');
    els.btnCopy  = dom.$('#btn-copy');
    els.btnReset = dom.$('#btn-reset');
    els.btnShare = dom.$('#btn-share');
  }

  /* ==========================================
     HELPERS
     ========================================== */
  const round500 = n => Math.round(n / 500) * 500;
  const inr = n => '₹' + Number(n).toLocaleString('en-IN');

  function getCard() {
    return GPU_DATA.cards.find(c => c.id === state.gpuId) || null;
  }

  /* ==========================================
     CORE LOGIC
     ========================================== */
  function calculateResult() {
    const card = getCard();
    state.result = null;
    if (!card) { updateUI(); return; }
    if (!card.verified) { updateUI(); return; } // honest pending state, no invented numbers

    const tier = card.tiers[state.tier];
    if (!tier) { updateUI(); return; }

    // 1. Warranty adds a flat value to both ends of the band.
    const wAdj = WARRANTY_ADJ[state.warranty] || 0;
    let min = tier.min + wAdj;
    let max = tier.max + wAdj;

    // 2. Condition moves the band edges.
    if (state.condition === 'likenew') {
      max = max * CONDITION_MULT.likenew.top; // box + bill justifies top of band (+2%)
    } else if (state.condition === 'heavy' || state.condition === 'unknown') {
      min = min * (CONDITION_MULT[state.condition].bottom || 0.95); // ~5% below bottom
    }

    // 3. Round everything to the nearest ₹500.
    min = round500(min);
    max = round500(max);

    // 4. Deal / overpay lines.
    let greatDeal = round500(min - DEAL_MARGIN);
    // Never let the "great deal" line collide with the scam line.
    if (greatDeal < card.scamLine + 500) greatDeal = card.scamLine + 500;
    const overpay = round500(max + OVERPAY_MARGIN);

    state.result = { card, fairMin: min, fairMax: max, greatDeal, overpay };
    updateUI();
  }

  function buildVerdict() {
    const r = state.result;
    if (!r) return '';
    if (state.condition === 'heavy') {
      return '⚠️ High-risk buy — only pay at the very bottom of this band, after in-person testing.';
    }
    if (state.condition === 'unknown') {
      return '⚠️ Unknown history — assume the worst, test everything, and negotiate hard.';
    }
    if (state.condition === 'likenew' && state.warranty !== 'none') {
      return '✅ Excellent pick — box, bill and remaining warranty make the top of this band fair.';
    }
    if (state.condition === 'likenew') {
      return '👍 Strong condition — aim for the upper half of the band, not above it.';
    }
    if (state.warranty === 'over1' || state.warranty === '6to12') {
      return '✅ Warranty-backed deal — paying mid-band here is low-risk.';
    }
    return '👍 Fair mainstream deal — aim for the middle of the band and negotiate.';
  }

  function updateUI() {
    const r = state.result;

    if (!r) {
      // Card selected but bands not verified yet — show honest pending state.
      if (els.resultWrap) els.resultWrap.style.display = 'none';
      if (els.pendingWrap) {
        els.pendingWrap.style.display = 'block';
        const nameEl = dom.$('#pending-card-name');
        if (nameEl && getCard()) nameEl.textContent = getCard().name;
        const dateEl = dom.$('#pending-next-update');
        if (dateEl) dateEl.textContent = GPU_DATA.nextUpdate;
      }
      return;
    }

    if (els.pendingWrap) els.pendingWrap.style.display = 'none';
    if (els.resultWrap) els.resultWrap.style.display = 'block';

    if (els.priceRange)  els.priceRange.textContent = inr(r.fairMin) + ' – ' + inr(r.fairMax);
    if (els.dealLine)    els.dealLine.textContent = 'Below ' + inr(r.greatDeal) + ' = a genuinely good deal — if the card checks out.';
    if (els.overpayLine) els.overpayLine.textContent = 'Above ' + inr(r.overpay) + ' = you are overpaying for this card.';
    if (els.scamLine)    els.scamLine.textContent = 'Below ' + inr(r.card.scamLine) + ' for this card = high scam risk. Never pay in advance.';
    if (els.verdict)     els.verdict.textContent = buildVerdict();
    if (els.noteBox) {
      if (r.card.specialNote) {
        els.noteBox.style.display = 'block';
        dom.$('#special-note-text').textContent = r.card.specialNote;
      } else {
        els.noteBox.style.display = 'none';
      }
    }
  }

  /* ==========================================
     EVENT LISTENERS
     ========================================== */
  function bindEvents() {
    const recalc = () => { calculateResult(); analytics.trackTool('used-gpu-price-checker', 'calculate'); };

    if (els.gpuModel)  els.gpuModel.addEventListener('change',  e => { state.gpuId = e.target.value; recalc(); });
    if (els.tier)      els.tier.addEventListener('change',      e => { state.tier = e.target.value; recalc(); });
    if (els.warranty)  els.warranty.addEventListener('change',  e => { state.warranty = e.target.value; recalc(); });
    if (els.condition) els.condition.addEventListener('change', e => { state.condition = e.target.value; recalc(); });

    // Copy Result
    if (els.btnCopy) {
      els.btnCopy.addEventListener('click', async () => {
        const r = state.result;
        if (!r) {
          if (components.Toast) components.Toast.show({ message: 'Select a card with verified data first.', type: 'info', duration: 3000 });
          return;
        }
        const textToCopy =
          'Used ' + r.card.name + ' (India, ' + GPU_DATA.lastUpdated + ')\n' +
          'Fair price: ' + inr(r.fairMin) + ' - ' + inr(r.fairMax) + '\n' +
          'Great deal below: ' + inr(r.greatDeal) + ' | Overpay above: ' + inr(r.overpay) + '\n' +
          'SCAM RISK below: ' + inr(r.card.scamLine) + ' — never pay in advance.\n' +
          'Checked with REDRAG Used GPU Price Checker: https://tools.redrag.in/used-gpu-price-checker/';

        const success = await utils.copyToClipboard(textToCopy);
        if (success) {
          if (components.Toast) components.Toast.show({ message: 'Result copied to clipboard!', type: 'success', duration: 3000 });
          analytics.trackTool('used-gpu-price-checker', 'share');
        } else if (components.Toast) {
          components.Toast.show({ message: 'Could not copy. Try manually.', type: 'error', duration: 4000 });
        }
      });
    }

    // WhatsApp Share (pre-filled message, per product spec)
    if (els.btnShare) {
      els.btnShare.addEventListener('click', () => {
        const r = state.result;
        if (!r) {
          if (components.Toast) components.Toast.show({ message: 'Select a card with verified data first.', type: 'info', duration: 3000 });
          return;
        }
        const msg = 'Used ' + r.card.name + ' ka fair price India me ' + inr(r.fairMin) + '–' + inr(r.fairMax) +
          ' hai. Isse sasta mile to scam ho sakta hai — check karo: https://tools.redrag.in/used-gpu-price-checker/';
        global.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank', 'noopener');
        analytics.trackTool('used-gpu-price-checker', 'share_whatsapp');
      });
    }

    // Reset
    if (els.btnReset) {
      els.btnReset.addEventListener('click', () => {
        state.gpuId = 'rtx-3060-12gb';
        state.tier = 'mid';
        state.warranty = 'none';
        state.condition = 'good';
        if (els.gpuModel)  els.gpuModel.value = state.gpuId;
        if (els.tier)      els.tier.value = state.tier;
        if (els.warranty)  els.warranty.value = state.warranty;
        if (els.condition) els.condition.value = state.condition;
        calculateResult();
        if (components.Toast) components.Toast.show({ message: 'All inputs reset', type: 'info', duration: 3000 });
        analytics.trackTool('used-gpu-price-checker', 'reset');
      });
    }
  }

  /* ==========================================
     INITIALIZATION
     ========================================== */
  async function init() {
    cacheDOM();
    bindEvents();
    calculateResult(); // initial render
    analytics.trackTool('used-gpu-price-checker', 'load');
  }

  // Auto-start when DOM is ready (shell injects header/footer first)
  dom.ready(() => {
    shell.ready.then(init).catch(err => {
      console.error('[RTTool] Init failed:', err);
      if (components.Toast) {
        components.Toast.show({ message: 'Failed to initialize tool. Please refresh.', type: 'error', duration: 5000 });
      }
    });
  });

})(window);
