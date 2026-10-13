/* ============================================
   Mouse Sensitivity Converter - Core Logic
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
     FALLBACK DATA (used if data.json fetch fails)
     ========================================== */
  const FALLBACK_GAMES = [
    {"id":"valorant","name":"Valorant","yaw":0.07,"fov":103,"fov_locked":true,"min":0.1,"max":10,"approx":false,"note":"Locked 103° horizontal FOV. Sens accepts 3 decimals in GameSettings.ini."},
    {"id":"cs2","name":"Counter-Strike 2","yaw":0.022,"fov":90,"fov_locked":false,"min":0.1,"max":10,"approx":false,"note":"Source 2 engine (m_yaw 0.022). Identical scale to CS:GO and CS 1.6."},
    {"id":"apex","name":"Apex Legends","yaw":0.022,"fov":110,"fov_locked":false,"min":0.1,"max":20,"approx":false,"note":"Respawn Source branch — sensitivity transfers 1:1 with CS2."},
    {"id":"overwatch2","name":"Overwatch 2","yaw":0.0066,"fov":103,"fov_locked":false,"min":0.1,"max":100,"approx":false,"note":"Blizzard engine. Overwatch sens x 0.3 = CS2 sens."},
    {"id":"warzone","name":"Call of Duty: Warzone","yaw":0.0066,"fov":100,"fov_locked":false,"min":0.01,"max":20,"approx":false,"note":"IW engine standard at 1.00 ADS multiplier (legacy ADS mode)."},
    {"id":"destiny2","name":"Destiny 2","yaw":0.0066,"fov":105,"fov_locked":false,"min":1,"max":100,"approx":false,"note":"Shares the Overwatch-family yaw constant."},
    {"id":"marvelrivals","name":"Marvel Rivals","yaw":0.0175,"fov":100,"fov_locked":false,"min":0.01,"max":100,"approx":false,"note":"Per-hero ADS/scope multipliers are separate and not converted here."},
    {"id":"titanfall2","name":"Titanfall 2","yaw":0.022,"fov":90,"fov_locked":false,"min":0.1,"max":20,"approx":false,"note":"Same Respawn Source branch as Apex Legends."},
    {"id":"tf2","name":"Team Fortress 2","yaw":0.022,"fov":90,"fov_locked":false,"min":0.1,"max":20,"approx":false,"note":"Standard Source m_yaw."},
    {"id":"quake","name":"Quake Champions","yaw":0.022,"fov":100,"fov_locked":false,"min":0.1,"max":20,"approx":false,"note":"Quake set the 0.022 convention Source inherited."},
    {"id":"rust","name":"Rust","yaw":0.1125,"fov":90,"fov_locked":false,"min":0.1,"max":5,"approx":false,"note":"High yaw — sensitivity numbers are low for the same turn speed."},
    {"id":"tarkov","name":"Escape from Tarkov","yaw":0.125,"fov":75,"fov_locked":false,"min":0.1,"max":5,"approx":false,"note":"Highest yaw in the list — lowest sens numbers."},
    {"id":"fortnite","name":"Fortnite","yaw":0.005555,"fov":80,"fov_locked":false,"min":0.01,"max":100,"approx":true,"note":"APPROXIMATE: percentage-based slider; build/edit modes and seasonal changes affect feel."},
    {"id":"r6siege","name":"Rainbow Six Siege","yaw":0.00573,"fov":60,"fov_locked":false,"min":1,"max":100,"approx":true,"note":"APPROXIMATE: hipfire baseline only. Sens interacts with FOV and has changed across patches."},
    {"id":"pubg","name":"PUBG: Battlegrounds","yaw":0.002222,"fov":90,"fov_locked":false,"min":1,"max":100,"approx":true,"note":"APPROXIMATE: general slider is non-linear and per-scope multipliers scale differently."}
  ];

  /* ==========================================
     STATE MANAGEMENT
     ========================================== */
  const STORAGE_KEY = 'msc-state-v1';
  const DEFAULT_STATE = {
    fromGame: 'valorant',
    fromSens: 0.4,
    fromDpi: 800,
    toGame: 'cs2',
    toDpi: 800,
    mode: '360', // '360' | 'fov'
    fromFov: 103,
    toFov: 90
  };

  let GAMES = [];
  const gameById = id => GAMES.find(g => g.id === id);

  const state = Object.assign({}, DEFAULT_STATE);

  /* ==========================================
     DOM ELEMENTS
     ========================================== */
  const els = {};

  function cacheDOM() {
    els.selFromGame = dom.$('#sel-from-game');
    els.selToGame = dom.$('#sel-to-game');
    els.inpFromSens = dom.$('#inp-from-sens');
    els.inpFromDpi = dom.$('#inp-from-dpi');
    els.inpToDpi = dom.$('#inp-to-dpi');
    els.inpFromFov = dom.$('#inp-from-fov');
    els.inpToFov = dom.$('#inp-to-fov');
    els.mode360 = dom.$('#mode-360');
    els.modeFov = dom.$('#mode-fov');
    els.fovPanel = dom.$('#fov-panel');
    els.btnSwap = dom.$('#btn-swap');
    els.btnCopy = dom.$('#btn-copy');
    els.btnReset = dom.$('#btn-reset');
    els.gameNote = dom.$('#game-note');
    // Results
    els.resSens = dom.$('#res-sens');
    els.resSub = dom.$('#res-sub');
    els.resBadge = dom.$('#res-badge');
    els.resFactor = dom.$('#res-factor');
    els.resCm = dom.$('#res-cm');
    els.resInch = dom.$('#res-inch');
    els.resEdpiSrc = dom.$('#res-edpi-src');
    els.resEdpiTgt = dom.$('#res-edpi-tgt');
    els.resCmSrc = dom.$('#res-cm-src');
    els.insight = dom.$('#insight-body');
  }

  /* ==========================================
     FORMATTING HELPERS
     ========================================== */
  function formatSens(v) {
    if (!isFinite(v)) return '—';
    if (v >= 100) return v.toFixed(1);
    if (v >= 10) return v.toFixed(2);
    if (v >= 1) return v.toFixed(3);
    return v.toFixed(4);
  }
  function formatNum(v, dec) {
    if (!isFinite(v)) return '—';
    return v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function formatInt(v) {
    if (!isFinite(v)) return '—';
    return Math.round(v).toLocaleString('en-US');
  }

  /* ==========================================
     CORE LOGIC
     ========================================== */

  function readInputs() {
    state.fromGame = els.selFromGame.value;
    state.toGame = els.selToGame.value;
    state.fromSens = parseFloat(els.inpFromSens.value);
    state.fromDpi = parseFloat(els.inpFromDpi.value) || 800;
    state.toDpi = parseFloat(els.inpToDpi.value) || state.fromDpi;
    state.fromFov = parseFloat(els.inpFromFov.value) || gameById(state.fromGame).fov;
    state.toFov = parseFloat(els.inpToFov.value) || gameById(state.toGame).fov;
  }

  function calculateResult() {
    const src = gameById(state.fromGame);
    const tgt = gameById(state.toGame);

    if (!src || !tgt || !(state.fromSens > 0)) return null;

    // Base factor: yaw ratio (exact 360° match)
    let factor = src.yaw / tgt.yaw;

    // FOV-aware (focal-length scaling, 0% monitor distance)
    if (state.mode === 'fov') {
      const f1 = state.fromFov * Math.PI / 180;
      const f2 = state.toFov * Math.PI / 180;
      factor *= Math.tan(f1 / 2) / Math.tan(f2 / 2);
    }

    // DPI compensation (only if target DPI differs)
    const dpiRatio = state.fromDpi / state.toDpi;

    const targetSens = state.fromSens * factor * dpiRatio;

    // Distances
    const cmSrc = 914.4 / (state.fromDpi * state.fromSens * src.yaw);
    const inSrc = 360 / (state.fromDpi * state.fromSens * src.yaw);
    const cmTgt = 914.4 / (state.toDpi * targetSens * tgt.yaw);
    const inTgt = 360 / (state.toDpi * targetSens * tgt.yaw);

    return {
      src, tgt, factor, targetSens,
      cmSrc, inSrc, cmTgt, inTgt,
      edpiSrc: state.fromDpi * state.fromSens,
      edpiTgt: state.toDpi * targetSens,
      approx: !!(src.approx || tgt.approx)
    };
  }

  function updateUI() {
    const r = calculateResult();
    const valid = !!r;

    els.resSens.textContent = valid ? formatSens(r.targetSens) : '—';
    els.resSub.textContent = valid
      ? `${r.src.name} ${formatSens(state.fromSens)} → ${r.tgt.name}`
      : 'Enter a valid sensitivity';

    // In 360 mode source & target cm/360 are identical; show target distance
    els.resCm.textContent = valid ? formatNum(r.cmTgt, 1) : '—';
    els.resInch.textContent = valid ? formatNum(r.inTgt, 1) : '—';
    els.resFactor.textContent = valid ? '× ' + formatSens(r.factor) : '—';
    els.resEdpiSrc.textContent = valid ? formatInt(r.edpiSrc) : '—';
    els.resEdpiTgt.textContent = valid ? formatInt(r.edpiTgt) : '—';
    els.resCmSrc.textContent = valid ? formatNum(r.cmSrc, 1) : '—';

    // Approximation badge
    els.resBadge.hidden = !valid || !r.approx;

    // Game-specific note under inputs
    const src = gameById(state.fromGame);
    if (src) els.gameNote.textContent = src.note;

    // FOV inputs reflect selected games' defaults (only when not user-touched this session)
    if (state.mode === 'fov') {
      const srcDef = src.fov, tgtDef = gameById(state.toGame).fov;
      if (!els.inpFromFov.dataset.touched) els.inpFromFov.value = srcDef;
      if (!els.inpToFov.dataset.touched) els.inpToFov.value = tgtDef;
    }

    persist();
  }

  /* ==========================================
     PERSISTENCE: URL params + localStorage
     ========================================== */

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      const p = new URLSearchParams();
      p.set('from', state.fromGame);
      p.set('sens', state.fromSens);
      p.set('from_dpi', state.fromDpi);
      p.set('to', state.toGame);
      p.set('to_dpi', state.toDpi);
      p.set('mode', state.mode);
      if (state.mode === 'fov') {
        p.set('from_fov', state.fromFov);
        p.set('to_fov', state.toFov);
      }
      history.replaceState(null, '', '?' + p.toString());
    } catch (e) { /* storage unavailable — tool still works */ }
  }

  function restore() {
    let restored = false;
    try {
      const p = new URLSearchParams(location.search);
      if (p.has('from')) {
        state.fromGame = p.get('from');
        state.fromSens = parseFloat(p.get('sens')) || DEFAULT_STATE.fromSens;
        state.fromDpi = parseFloat(p.get('from_dpi')) || 800;
        state.toGame = p.get('to') || DEFAULT_STATE.toGame;
        state.toDpi = parseFloat(p.get('to_dpi')) || state.fromDpi;
        state.mode = p.get('mode') === 'fov' ? 'fov' : '360';
        state.fromFov = parseFloat(p.get('from_fov')) || 90;
        state.toFov = parseFloat(p.get('to_fov')) || 90;
        restored = true;
      } else {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const s = JSON.parse(saved);
          Object.assign(state, DEFAULT_STATE, s);
          restored = true;
        }
      }
    } catch (e) { /* fall through to defaults */ }

    if (!gameById(state.fromGame)) state.fromGame = DEFAULT_STATE.fromGame;
    if (!gameById(state.toGame)) state.toGame = DEFAULT_STATE.toGame;
    return restored;
  }

  /* ==========================================
     EVENT LISTENERS
     ========================================== */

  function setMode(mode) {
    state.mode = mode;
    const isFov = mode === 'fov';
    els.fovPanel.hidden = !isFov;
    els.mode360.classList.toggle('is-active', !isFov);
    els.mode360.setAttribute('aria-pressed', String(!isFov));
    els.modeFov.classList.toggle('is-active', isFov);
    els.modeFov.setAttribute('aria-pressed', String(isFov));
    if (isFov) {
      els.inpFromFov.dataset.touched = '';
      delete els.inpFromFov.dataset.touched;
      els.inpToFov.dataset.touched = '';
      delete els.inpToFov.dataset.touched;
    }
    updateUI();
  }

  function bindEvents() {
    [els.selFromGame, els.selToGame, els.inpFromSens, els.inpFromDpi, els.inpToDpi]
      .forEach(el => el.addEventListener('input', () => { readInputs(); updateUI(); }));

    [els.inpFromFov, els.inpToFov].forEach(el =>
      el.addEventListener('input', () => {
        el.dataset.touched = '1';
        readInputs();
        updateUI();
      }));

    els.mode360.addEventListener('click', () => setMode('360'));
    els.modeFov.addEventListener('click', () => setMode('fov'));

    // Swap games
    els.btnSwap.addEventListener('click', () => {
      readInputs();
      const r = calculateResult();
      const oldFrom = state.fromGame;
      state.fromGame = state.toGame;
      state.toGame = oldFrom;
      const oldDpi = state.fromDpi;
      state.fromDpi = state.toDpi;
      state.toDpi = oldDpi;
      if (r) state.fromSens = parseFloat(formatSens(r.targetSens));
      els.selFromGame.value = state.fromGame;
      els.selToGame.value = state.toGame;
      els.inpFromSens.value = state.fromSens;
      els.inpFromDpi.value = state.fromDpi;
      els.inpToDpi.value = state.toDpi;
      updateUI();
      if (components.Toast) {
        components.Toast.show({ message: 'Games swapped — now converting back', type: 'info', duration: 2500 });
      }
      analytics.trackTool('mouse-sensitivity-converter', 'swap');
    });

    // Copy Button
    els.btnCopy.addEventListener('click', async () => {
      const r = calculateResult();
      if (!r) {
        if (components.Toast) {
          components.Toast.show({ message: 'Enter a valid sensitivity first', type: 'error', duration: 3000 });
        }
        return;
      }
      const lines = [
        `Mouse Sensitivity Conversion (REDRAG Tools)`,
        `From: ${r.src.name} — Sens ${formatSens(state.fromSens)} @ ${state.fromDpi} DPI`,
        `To:   ${r.tgt.name} — Sens ${formatSens(r.targetSens)} @ ${state.toDpi} DPI`,
        `Mode: ${state.mode === 'fov' ? 'FOV-Aware' : '360° Match'} | Factor: ×${formatSens(r.factor)}`,
        `cm/360: ${formatNum(r.cmSrc, 1)} | in/360: ${formatNum(r.inSrc, 1)} | eDPI: ${formatInt(r.edpiSrc)}`,
        r.approx ? `Note: approximate conversion (non-linear slider game)` : null,
        `https://tools.redrag.in/mouse-sensitivity-converter/`
      ].filter(Boolean);
      const success = await utils.copyToClipboard(lines.join('\n'));

      if (success) {
        if (components.Toast) {
          components.Toast.show({ message: 'Result copied to clipboard!', type: 'success', duration: 3000 });
        }
        analytics.trackTool('mouse-sensitivity-converter', 'share');
      } else {
        if (components.Toast) {
          components.Toast.show({ message: 'Could not copy. Try manually.', type: 'error', duration: 4000 });
        }
      }
    });

    // Reset Button
    els.btnReset.addEventListener('click', () => {
      Object.assign(state, DEFAULT_STATE);
      els.selFromGame.value = state.fromGame;
      els.selToGame.value = state.toGame;
      els.inpFromSens.value = state.fromSens;
      els.inpFromDpi.value = state.fromDpi;
      els.inpToDpi.value = state.toDpi;
      els.inpFromFov.value = state.fromFov;
      els.inpToFov.value = state.toFov;
      delete els.inpFromFov.dataset.touched;
      delete els.inpToFov.dataset.touched;
      setMode('360');
      updateUI();
      try { localStorage.removeItem(STORAGE_KEY); history.replaceState(null, '', location.pathname); } catch (e) {}
      if (components.Toast) {
        components.Toast.show({ message: 'All inputs reset', type: 'info', duration: 3000 });
      }
      analytics.trackTool('mouse-sensitivity-converter', 'reset');
    });
  }

  /* ==========================================
     FAQ
     ========================================== */

  function initFAQ() {
    const container = dom.$('#faq-container');
    if (!container || !components.FAQ) return;

    const items = [
      {
        question: 'How does this mouse sensitivity converter work?',
        answer: '<p>Every game engine uses a hidden constant called <strong>yaw</strong> — the degrees your camera rotates per mouse count at sensitivity 1.0. Valorant uses 0.07, CS2 and Apex use 0.022, Overwatch 2 and Warzone use 0.0066. The converter multiplies your sensitivity by the ratio of the two yaw values (source yaw ÷ target yaw), which keeps your cm/360 — the physical distance for a full 360° turn — exactly identical in both games.</p>'
      },
      {
        question: 'Is the converted sensitivity 100% accurate?',
        answer: '<p>For linear-scale games, the 360° conversion is mathematically exact — your mouse travels the same physical distance for the same rotation. What can still feel different is FOV, visual style and ADS multipliers, which is why we offer an FOV-Aware mode. Games with non-linear sliders (Fortnite, Rainbow Six Siege, PUBG) are clearly flagged as approximate, because their sensitivity does not scale linearly.</p>'
      },
      {
        question: 'What is cm/360 and why does it matter?',
        answer: '<p>cm/360 is the centimetres of mouse movement needed for a full 360° turn: <code>914.4 ÷ (DPI × sens × yaw)</code>. It is the universal sensitivity metric because it is a physical measurement — two players with the same cm/360 aim identically regardless of game or hardware. Most competitive FPS players land between 25 and 55 cm/360.</p>'
      },
      {
        question: 'What is eDPI and how do I calculate it?',
        answer: '<p>eDPI (effective DPI) = mouse DPI × in-game sensitivity. A player on 800 DPI at 0.4 sens has 320 eDPI. eDPI only compares players within the same game — across different games, compare cm/360 instead, because each game uses a different yaw. This tool shows both automatically.</p>'
      },
      {
        question: 'Does mouse DPI affect the conversion between games?',
        answer: '<p>No. DPI cancels out of the yaw-ratio formula, so converting Valorant 0.4 to CS2 gives 1.273 whether you use 400, 800 or 1600 DPI. DPI only matters when you want cm/360 and eDPI figures, or when you are actually changing DPI between the two games — in which case the converter compensates automatically.</p>'
      },
      {
        question: 'Why do Fortnite, Rainbow Six Siege and PUBG show an approximate warning?',
        answer: '<p>These games use non-linear sliders or per-scope multiplier systems, so no single fixed ratio describes them perfectly. We still convert them using the best-documented baseline yaw values (0.005555, 0.00573 and 0.002222 respectively) and flag the result honestly, so you get a strong starting point instead of a misleading exact number. Always verify in-game with a cm/360 test.</p>'
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
     INITIALIZATION
     ========================================== */

  function populateSelects() {
    const options = GAMES.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    els.selFromGame.innerHTML = options;
    els.selToGame.innerHTML = options;
  }

  function applyStateToDOM() {
    els.selFromGame.value = state.fromGame;
    els.selToGame.value = state.toGame;
    els.inpFromSens.value = state.fromSens;
    els.inpFromDpi.value = state.fromDpi;
    els.inpToDpi.value = state.toDpi;
    els.inpFromFov.value = state.fromFov;
    els.inpToFov.value = state.toFov;
    const isFov = state.mode === 'fov';
    els.fovPanel.hidden = !isFov;
    els.mode360.classList.toggle('is-active', !isFov);
    els.modeFov.classList.toggle('is-active', isFov);
  }

  async function loadGames() {
    try {
      const res = await fetch('data.json');
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      if (!Array.isArray(data.games) || !data.games.length) throw new Error('bad data');
      GAMES = data.games;
    } catch (e) {
      GAMES = FALLBACK_GAMES;
    }
  }

  async function init() {
    cacheDOM();
    await loadGames();
    populateSelects();
    restore();
    applyStateToDOM();
    bindEvents();
    readInputs();
    updateUI();
    initFAQ();
    analytics.trackTool('mouse-sensitivity-converter', 'load');
  }

  dom.ready(() => {
    shell.ready.then(init).catch(err => {
      console.error('[RTTool] Init failed:', err);
      if (components.Toast) {
        components.Toast.show({ message: 'Failed to initialize tool. Please refresh.', type: 'error', duration: 5000 });
      }
    });
  });

})(window);
