/* ============================================
   Game Download Time Calculator - Core Logic
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

  const SLUG = 'game-download-time-calculator';

  /* ==========================================
     CONSTANTS
     ========================================== */
  // Binary units (1 GB = 1024 MB) to match how Windows / launchers display sizes
  const SIZE_TO_MB = { 'MB': 1, 'GB': 1024, 'TB': 1048576 };
  // Convert every speed unit to Megabits per second (Mbps)
  const SPEED_TO_MBPS = { 'Kbps': 1 / 1000, 'Mbps': 1, 'Gbps': 1000, 'MB/s': 8 };

  const CONNECTION_MODES = {
    'optimal':    { factor: 1.00, label: 'Theoretical maximum (100%)' },
    'ethernet':   { factor: 0.90, label: 'Real-world average (90%)' },
    'wifi':       { factor: 0.75, label: 'Wi-Fi (75%)' },
    'peak':       { factor: 0.50, label: 'Busy hours (50%)' }
  };

  // Common plan speeds (Mbps) used in the comparison table
  const COMPARE_SPEEDS = [10, 25, 50, 100, 200, 500, 1000];

  // Embedded fallback (top games) so the tool still works if data.json fails to load
  const FALLBACK_GAMES = [
    { name: 'Call of Duty: Black Ops 6', size_gb: 150, category: 'FPS', platform: 'Steam / Battle.net', notes: 'Base install' },
    { name: 'Fortnite', size_gb: 35, category: 'Battle Royale', platform: 'Epic Games', notes: 'Base install' },
    { name: 'GTA V', size_gb: 110, category: 'Open World & Action', platform: 'Steam / Epic / RGL', notes: 'Includes GTA Online updates' },
    { name: 'Red Dead Redemption 2', size_gb: 150, category: 'Open World & Action', platform: 'Steam / Rockstar', notes: '4K textures' },
    { name: 'Elden Ring', size_gb: 60, category: 'RPG', platform: 'Steam', notes: 'Base game' },
    { name: 'Baldur\'s Gate 3', size_gb: 122, category: 'RPG', platform: 'Steam / GOG', notes: 'Full release' },
    { name: 'Cyberpunk 2077', size_gb: 100, category: 'RPG', platform: 'Steam / GOG', notes: 'With Phantom Liberty' },
    { name: 'Counter-Strike 2', size_gb: 85, category: 'FPS', platform: 'Steam', notes: 'Free-to-play' },
    { name: 'Valorant', size_gb: 30, category: 'FPS', platform: 'Riot Client', notes: 'Free-to-play' },
    { name: 'God of War Ragnarok', size_gb: 190, category: 'Open World & Action', platform: 'Steam / PS5', notes: 'Large PC port' }
  ];

  /* ==========================================
     STATE MANAGEMENT
     ========================================== */
  const state = {
    games: [],
    gameName: null,          // null = custom size
    sizeValue: 100,
    sizeUnit: 'GB',
    speedValue: 100,
    speedUnit: 'Mbps',
    connMode: 'ethernet',
    seconds: null,
    effectiveMbps: 0,
    effectiveMBps: 0,
    etaDate: null
  };

  /* ==========================================
     DOM ELEMENTS
     ========================================== */
  const els = {};

  function cacheDOM() {
    els.gameSelect = dom.$('#game-select');
    els.sizeInput = dom.$('#size-input');
    els.sizeUnit = dom.$('#size-unit');
    els.speedInput = dom.$('#speed-input');
    els.speedUnit = dom.$('#speed-unit');
    els.connSelect = dom.$('#conn-select');
    els.gameNote = dom.$('#game-size-note');
    els.resultTime = dom.$('#result-time');
    els.resEffective = dom.$('#res-effective');
    els.resEta = dom.$('#res-eta');
    els.resSize = dom.$('#res-size');
    els.resMode = dom.$('#res-mode');
    els.compareBody = dom.$('#compare-body');
    els.btnSpeedTest = dom.$('#btn-speedtest');
    els.stModal = dom.$('#speedtest-modal');
    els.stSpeed = dom.$('#st-speed');
    els.stElapsed = dom.$('#st-elapsed');
    els.stBytes = dom.$('#st-bytes');
    els.stProgress = dom.$('#st-progress');
    els.stStatus = dom.$('#st-status');
    els.stUse = dom.$('#st-use');
    els.stCancel = dom.$('#st-cancel');
    els.stBackdrop = dom.$('#st-backdrop');
    els.btnCopy = dom.$('#btn-copy');
    els.btnReset = dom.$('#btn-reset');
  }

  /* ==========================================
     DATA LOADING
     ========================================== */
  async function loadGames() {
    try {
      const res = await fetch('data.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      state.games = (json.items || []).filter(g => g.name && g.size_gb > 0);
    } catch (err) {
      console.warn('[RTTool] data.json load failed, using embedded fallback:', err);
      state.games = FALLBACK_GAMES.slice();
    }
    if (!state.games.length) state.games = FALLBACK_GAMES.slice();
    populateGameSelect();
  }

  function populateGameSelect() {
    if (!els.gameSelect) return;
    const byCat = {};
    state.games.forEach((g, i) => {
      (byCat[g.category || 'Other'] = byCat[g.category || 'Other'] || []).push({ g, i });
    });

    let html = '<option value="">— Custom size (enter manually) —</option>';
    Object.keys(byCat).sort().forEach(cat => {
      html += '<optgroup label="' + cat + '">';
      byCat[cat].forEach(({ g, i }) => {
        html += '<option value="' + i + '">' + g.name + ' (~' + g.size_gb + ' GB)</option>';
      });
      html += '</optgroup>';
    });
    els.gameSelect.innerHTML = html;
  }

  /* ==========================================
     CORE LOGIC
     ========================================== */
  function readInputs() {
    state.sizeValue = parseFloat(els.sizeInput.value) || 0;
    state.sizeUnit = els.sizeUnit.value;
    state.speedValue = parseFloat(els.speedInput.value) || 0;
    state.speedUnit = els.speedUnit.value;
    state.connMode = els.connSelect.value;
  }

  function calculateResult() {
    readInputs();

    const sizeMB = state.sizeValue * (SIZE_TO_MB[state.sizeUnit] || 1024);
    const speedMbps = state.speedValue * (SPEED_TO_MBPS[state.speedUnit] || 1);
    const mode = CONNECTION_MODES[state.connMode] || CONNECTION_MODES.ethernet;

    if (sizeMB > 0 && speedMbps > 0) {
      state.effectiveMbps = speedMbps * mode.factor;
      state.effectiveMBps = state.effectiveMbps / 8;
      state.seconds = (sizeMB * 8) / state.effectiveMbps;
      state.etaDate = new Date(Date.now() + state.seconds * 1000);
    } else {
      state.seconds = null;
      state.effectiveMbps = 0;
      state.effectiveMBps = 0;
      state.etaDate = null;
    }
    updateUI();
  }

  /* ==========================================
     FORMATTING HELPERS
     ========================================== */
  function formatDuration(sec) {
    if (!isFinite(sec) || sec <= 0) return '—';
    const s = Math.round(sec);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const parts = [];
    if (d) parts.push(d + 'd');
    if (h) parts.push(h + 'h');
    if (m) parts.push(m + 'm');
    if (!d && ss) parts.push(ss + 's');
    return parts.length ? parts.join(' ') : '0s';
  }

  function formatClock(date) {
    if (!date) return '—';
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (sameDay) return 'Today, ' + time;
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ', ' + time;
  }

  function formatSpeedMbps(v) {
    if (v >= 1000) return (v / 1000).toFixed(v % 1000 === 0 ? 0 : 1) + ' Gbps';
    return (Math.round(v * 10) / 10) + ' Mbps';
  }

  /* ==========================================
     UI UPDATES
     ========================================== */
  function updateUI() {
    const valid = state.seconds !== null;

    // Main result
    if (els.resultTime) els.resultTime.textContent = valid ? formatDuration(state.seconds) : '—';

    const mode = CONNECTION_MODES[state.connMode] || CONNECTION_MODES.ethernet;

    if (els.resEffective) {
      els.resEffective.textContent = valid
        ? '~' + (state.effectiveMBps >= 100 ? Math.round(state.effectiveMBps) : (Math.round(state.effectiveMBps * 10) / 10)) + ' MB/s (' + formatSpeedMbps(state.effectiveMbps) + ')'
        : '—';
    }
    if (els.resEta) els.resEta.textContent = valid ? formatClock(state.etaDate) : '—';
    if (els.resSize) {
      els.resSize.textContent = state.sizeValue > 0
        ? state.sizeValue + ' ' + state.sizeUnit + (state.gameName ? ' \u00b7 ' + state.gameName : '')
        : '—';
    }
    if (els.resMode) els.resMode.textContent = mode.label;

    renderComparisonTable();
  }

  function renderComparisonTable() {
    if (!els.compareBody) return;
    const sizeMB = state.sizeValue * (SIZE_TO_MB[state.sizeUnit] || 1024);
    const mode = CONNECTION_MODES[state.connMode] || CONNECTION_MODES.ethernet;
    const userSpeedMbps = (state.speedValue * (SPEED_TO_MBPS[state.speedUnit] || 1)) * mode.factor;

    let html = '';
    COMPARE_SPEEDS.forEach(spd => {
      let timeStr = '—';
      if (sizeMB > 0) {
        timeStr = formatDuration((sizeMB * 8) / (spd * mode.factor));
      }
      const isMatch = Math.abs(spd - userSpeedMbps) < 0.5;
      html += '<tr' + (isMatch ? ' class="row-active"' : '') + '>' +
        '<td>' + spd + ' Mbps' + (isMatch ? ' <span class="you-badge">YOU</span>' : '') + '</td>' +
        '<td>' + timeStr + '</td>' +
        '</tr>';
    });
    els.compareBody.innerHTML = html;
  }

  /* ==========================================
     EVENT LISTENERS
     ========================================== */
  function bindEvents() {
    // Live recalculation on any input
    [els.sizeInput, els.speedInput].forEach(el => {
      if (el) el.addEventListener('input', () => {
        if (document.activeElement === els.sizeInput) state.gameName = null; // manual edit = custom
        calculateResult();
      });
    });
    [els.sizeUnit, els.speedUnit, els.connSelect].forEach(el => {
      if (el) el.addEventListener('change', calculateResult);
    });

    // Game picker
    if (els.gameSelect) {
      els.gameSelect.addEventListener('change', () => {
        const idx = els.gameSelect.value;
        if (idx === '') {
          state.gameName = null;
          if (els.gameNote) els.gameNote.textContent = 'Enter the download size shown on your store page.';
        } else {
          const g = state.games[parseInt(idx, 10)];
          if (g) {
            state.gameName = g.name;
            els.sizeInput.value = g.size_gb;
            els.sizeUnit.value = 'GB';
            if (els.gameNote) {
              els.gameNote.textContent = g.name + ' is ~' + g.size_gb + ' GB on ' + (g.platform || 'PC') +
                (g.notes ? ' \u2014 ' + g.notes : '') + '. Size may grow with updates & DLC.';
            }
            if (components.Toast) {
              components.Toast.show({ message: g.name + ' selected (~' + g.size_gb + ' GB)', type: 'info', duration: 2500 });
            }
          }
        }
        calculateResult();
      });
    }

    // Copy Button
    if (els.btnCopy) {
      els.btnCopy.addEventListener('click', async () => {
        if (state.seconds === null) {
          if (components.Toast) {
            components.Toast.show({ message: 'Enter a valid size and speed first.', type: 'error', duration: 3000 });
          }
          return;
        }
        const mode = CONNECTION_MODES[state.connMode] || CONNECTION_MODES.ethernet;
        const textToCopy =
          'Game Download Time Estimate (REDRAG Tools)\n' +
          'Game/File: ' + (state.gameName || 'Custom') + ' (' + state.sizeValue + ' ' + state.sizeUnit + ')\n' +
          'Connection: ' + state.speedValue + ' ' + state.speedUnit + ' (' + mode.label + ')\n' +
          'Estimated time: ' + formatDuration(state.seconds) + '\n' +
          'Effective speed: ~' + (Math.round(state.effectiveMBps * 10) / 10) + ' MB/s\n' +
          'Finishes around: ' + formatClock(state.etaDate) + '\n' +
          'https://tools.redrag.in/game-download-time-calculator/';

        const success = await utils.copyToClipboard(textToCopy);
        if (success) {
          if (components.Toast) {
            components.Toast.show({ message: 'Result copied to clipboard!', type: 'success', duration: 3000 });
          }
          analytics.trackTool(SLUG, 'share');
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
        state.gameName = null;
        els.gameSelect.value = '';
        els.sizeInput.value = 100;
        els.sizeUnit.value = 'GB';
        els.speedInput.value = 100;
        els.speedUnit.value = 'Mbps';
        els.connSelect.value = 'ethernet';
        if (els.gameNote) els.gameNote.textContent = 'Enter the download size shown on your store page.';
        calculateResult();
        if (components.Toast) {
          components.Toast.show({ message: 'All inputs reset', type: 'info', duration: 3000 });
        }
        analytics.trackTool(SLUG, 'reset');
      });
    }

    // Speed Test
    if (els.btnSpeedTest) els.btnSpeedTest.addEventListener('click', stRun);
    if (els.stCancel) els.stCancel.addEventListener('click', stClose);
    if (els.stBackdrop) els.stBackdrop.addEventListener('click', stClose);
    if (els.stUse) els.stUse.addEventListener('click', stApplyResult);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && els.stModal && !els.stModal.hidden) stClose();
    });
  }

  /* ==========================================
     INTERNET SPEED TEST ENGINE
     Measures real download throughput by downloading
     test payloads, then auto-fills the speed input.
     ========================================== */
  const ST = {
    running: false,
    controller: null,
    chunks: [],
    bytes: 0,
    startTime: 0,
    rafId: null,
    resultMbps: null,
    // Multi-size test: 5MB + 25MB + 50MB gives accurate result on slow & fast connections
    SIZES: [5 * 1024 * 1024, 25 * 1024 * 1024, 50 * 1024 * 1024],
    // Fallback public test files (CORS-enabled, cache-busted)
    URLS: [
      (n) => 'https://speed.cloudflare.com/__down?bytes=' + n,
      (n) => 'https://httpbin.org/bytes/' + n + '?cachebust=' + Date.now()
    ]
  };

  function stSetStatus(msg) { if (els.stStatus) els.stStatus.textContent = msg; }

  function stUpdateGauge(mbps) {
    if (els.stSpeed) els.stSpeed.textContent = mbps.toFixed(1);
    if (els.stProgress) {
      const pct = Math.min(100, (ST.bytes / (ST.SIZES[0] + ST.SIZES[1] + ST.SIZES[2])) * 100);
      els.stProgress.style.width = pct + '%';
    }
  }

  async function stDownload(url, sizeBytes) {
    // Download with streaming so progress works on slow connections too
    const response = await fetch(url, {
      cache: 'no-store',
      signal: ST.controller.signal,
      mode: 'cors'
    });
    if (!response.ok && response.status !== 0) throw new Error('HTTP ' + response.status);
    if (!response.body) {
      // No streaming support: simple buffered download
      const buf = await response.arrayBuffer();
      ST.bytes += buf.byteLength;
      return buf.byteLength;
    }
    const reader = response.body.getReader();
    let received = 0;
    try {
      while (received < sizeBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.length;
        ST.bytes += value.length;
      }
    } finally {
      try { reader.cancel(); } catch (e) { /* ignore */ }
    }
    return received;
  }

  async function stRun() {
    if (ST.running) return;
    ST.running = true;
    ST.resultMbps = null;
    ST.bytes = 0;
    if (els.stUse) els.stUse.disabled = true;
    if (els.stModal) els.stModal.hidden = false;
    stSetStatus('Starting test...');
    stUpdateGauge(0);
    analytics.trackTool(SLUG, 'speedtest_start');

    ST.controller = new AbortController();
    const samples = [];

    try {
      let urlIndex = 0;
      for (let i = 0; i < ST.SIZES.length; i++) {
        const size = ST.SIZES[i];
        stSetStatus('Test ' + (i + 1) + ' of 3 — downloading ' + (size / 1024 / 1024) + ' MB...');
        const t0 = performance.now();
        let got = 0;
        let lastErr = null;
        // Try each mirror until one works
        for (let u = 0; u < ST.URLS.length && got === 0; u++) {
          try {
            got = await stDownload(ST.URLS[(urlIndex + u) % ST.URLS.length](size), size);
            urlIndex = (urlIndex + u) % ST.URLS.length;
          } catch (err) {
            lastErr = err;
            if (err.name === 'AbortError') throw err;
          }
        }
        if (got === 0 && lastErr) throw lastErr;

        const secs = (performance.now() - t0) / 1000;
        // Only count samples that ran at least 1s (else timing noise dominates)
        if (secs >= 1 && got > 512 * 1024) {
          // Convert bytes -> megabits: bytes*8/1e6 ; per second
          const mbps = (got * 8 / 1e6) / secs;
          samples.push(mbps);
          stUpdateGauge(mbps);
        }
      }

      if (!samples.length) throw new Error('Could not measure');

      // Use the MEDIAN of samples — robust against one-off spikes/dips
      samples.sort((a, b) => a - b);
      const median = samples[Math.floor(samples.length / 2)];
      // Blend with max sample on fast connections (multi-connection reality)
      const final = Math.max(median, samples[samples.length - 1] * 0.92);
      ST.resultMbps = Math.round(final * 10) / 10;

      stUpdateGauge(ST.resultMbps);
      stSetStatus('Done! Measured ' + ST.resultMbps.toFixed(1) + ' Mbps (median of ' + samples.length + ' samples). Uses ~80 MB data.');
      if (els.stUse) els.stUse.disabled = false;
      analytics.trackTool(SLUG, 'speedtest_complete');

    } catch (err) {
      if (err.name === 'AbortError') {
        stSetStatus('Test cancelled.');
      } else {
        console.error('[RTTool] Speed test failed:', err);
        stSetStatus('Test failed — network or CORS blocked. Enter your plan speed manually below.');
        if (components.Toast) {
          components.Toast.show({ message: 'Speed test failed. Enter speed manually.', type: 'error', duration: 4000 });
        }
      }
    } finally {
      ST.running = false;
      ST.controller = null;
    }
  }

  function stClose() {
    if (ST.controller) ST.controller.abort();
    ST.running = false;
    if (els.stModal) els.stModal.hidden = true;
  }

  function stApplyResult() {
    if (ST.resultMbps === null) return;
    els.speedInput.value = ST.resultMbps;
    els.speedUnit.value = 'Mbps';
    stClose();
    calculateResult();
    if (components.Toast) {
      components.Toast.show({ message: 'Speed set to ' + ST.resultMbps + ' Mbps', type: 'success', duration: 3000 });
    }
    analytics.trackTool(SLUG, 'speedtest_apply');
  }

  /* ==========================================
     INITIALIZATION
     ========================================== */
  async function init() {
    cacheDOM();
    bindEvents();
    await loadGames();
    calculateResult(); // initial render
    initFAQ();
    analytics.trackTool(SLUG, 'load');
  }

  function initFAQ() {
    const container = dom.$('#faq-container');
    if (!container || !components.FAQ) return;

    const items = [
      {
        question: 'How does the built-in internet speed test work?',
        answer: '<p>Click <strong>Test My Speed</strong> and the tool downloads test payloads from public speed-test servers, timing each download to compute your real throughput. It runs three samples and uses the median — the same robust method professional speed tests use — then fills your measured Mbps into the calculator automatically. It takes about 15–30 seconds and uses roughly 80 MB of data.</p>'
      },
      {
        question: 'How accurate is this game download time calculator?',
        answer: '<p>The calculator uses the standard formula <strong>download time = (file size in MB \u00d7 8) \u00f7 effective speed in Mbps</strong>, where your plan speed is adjusted by a real-world efficiency factor (90% for a typical wired connection). That makes it noticeably more honest than calculators that assume you always get 100% of your advertised speed. Actual times can still vary with server load and network congestion.</p>'
      },
      {
        question: 'Why is my actual download slower than the estimate?',
        answer: '<p>Several things can slow a real download: the game server being overloaded (very common on launch day), Wi-Fi signal loss, other devices using your bandwidth, VPN overhead, disk write speed, and ISP throttling. If your downloads are consistently slower than the estimate, try a wired Ethernet connection and download during off-peak hours.</p>'
      },
      {
        question: 'What is the difference between Mbps and MB/s?',
        answer: '<p>Mbps (megabits per second) is how ISPs advertise internet speed. MB/s (megabytes per second) is what Steam, Epic and browsers usually show while downloading. There are 8 bits in 1 byte, so <strong>divide Mbps by 8 to get MB/s</strong> \u2014 a 100 Mbps plan downloads at a theoretical maximum of 12.5 MB/s, and roughly 11 MB/s in real-world conditions.</p>'
      },
      {
        question: 'How long does it take to download a 100 GB game?',
        answer: '<p>At a real-world effective speed of 90 Mbps (a typical 100 Mbps plan), a 100 GB game takes about <strong>2 hours 32 minutes</strong>. At 50 Mbps it\u2019s roughly 4 hours 33 minutes, at 200 Mbps about 1 hour 16 minutes, and on a 1 Gbps fibre connection around 15 minutes. Select your connection mode in the calculator above for a personalised estimate.</p>'
      },
      {
        question: 'Does the platform matter \u2014 Steam, PS5, or Xbox?',
        answer: '<p>The math is the same on every platform, and install sizes are usually identical too. The difference is that consoles and launchers sometimes throttle peak speeds, and new-release downloads crawl when millions of players grab the game at once. Our real-world connection modes account for typical losses, but launch-day server congestion can exceed them.</p>'
      },
      {
        question: 'How can I speed up my game downloads?',
        answer: '<p>Use a wired Ethernet connection instead of Wi-Fi, pause downloads and streams on other devices, download during off-peak hours, keep the launcher\u2019s download region set to the closest server, and avoid VPNs while downloading. On PC, make sure your SSD or HDD can keep up \u2014 a slow drive can bottleneck a fast connection.</p>'
      }
    ];

    components.FAQ.init({
      container: container,
      items: items,
      showSchema: true,
      openFirst: false
    });
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
