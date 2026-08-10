/* ============================================
   Resolution Scaling Visualizer — Core Logic
   Requires: shared/js/core.js, shared/js/components.js
   ============================================ */

(function (global) {
  'use strict';

  const RT = global.RT;
  if (!RT) { console.error('[RSV] Core not loaded'); return; }
  const { dom, utils, shell, analytics } = RT;
  const components = global.RT.components || {};

  /* ==========================================
     FALLBACK DATA (if fetch fails)
     ========================================== */
  const FALLBACK_DATA = {
    resolutions: [
      {name: "1080p Full HD", width: 1920, height: 1080, mp: 2.07, aspect: "16:9", vram_min: 6, vram_rec: 8},
      {name: "1440p QHD", width: 2560, height: 1440, mp: 3.69, aspect: "16:9", vram_min: 8, vram_rec: 12},
      {name: "4K UHD", width: 3840, height: 2160, mp: 8.29, aspect: "16:9", vram_min: 12, vram_rec: 16}
    ],
    scaling_technologies: [
      {id: "native", name: "Native", modes: [{id: "native", name: "Native (100%)", scale_factor: 1.0, perf_mult: 1.0, quality_score: 100}]},
      {id: "dlss", name: "NVIDIA DLSS", modes: [
        {id: "dlss-quality", name: "Quality (67%)", scale_factor: 0.6667, perf_mult: 1.4, quality_score: 95},
        {id: "dlss-balanced", name: "Balanced (59%)", scale_factor: 0.5882, perf_mult: 1.6, quality_score: 90},
        {id: "dlss-performance", name: "Performance (50%)", scale_factor: 0.5, perf_mult: 1.9, quality_score: 85},
        {id: "dlss-ultra", name: "Ultra Performance (33%)", scale_factor: 0.3333, perf_mult: 2.8, quality_score: 75}
      ]},
      {id: "fsr", name: "AMD FSR", modes: [
        {id: "fsr-quality", name: "Quality (77%)", scale_factor: 0.7692, perf_mult: 1.3, quality_score: 92},
        {id: "fsr-balanced", name: "Balanced (67%)", scale_factor: 0.6667, perf_mult: 1.5, quality_score: 88},
        {id: "fsr-performance", name: "Performance (59%)", scale_factor: 0.5882, perf_mult: 1.7, quality_score: 82},
        {id: "fsr-ultra", name: "Ultra Performance (50%)", scale_factor: 0.5, perf_mult: 2.0, quality_score: 72}
      ]},
      {id: "xess", name: "Intel XeSS", modes: [
        {id: "xess-quality", name: "Quality (67%)", scale_factor: 0.6667, perf_mult: 1.35, quality_score: 93},
        {id: "xess-balanced", name: "Balanced (59%)", scale_factor: 0.5882, perf_mult: 1.55, quality_score: 88},
        {id: "xess-performance", name: "Performance (50%)", scale_factor: 0.5, perf_mult: 1.85, quality_score: 80}
      ]}
    ],
    monitor_sizes: [24, 27, 32, 34],
    quality_labels: {
      excellent: {min: 90, label: "Excellent", color: "#22c55e"},
      good: {min: 80, label: "Good", color: "#84cc16"},
      fair: {min: 70, label: "Fair", color: "#eab308"},
      poor: {min: 0, label: "Noticeable Loss", color: "#ef4444"}
    }
  };

  /* ==========================================
     STATE
     ========================================== */
  const state = {
    data: null,
    baseResIndex: 2,      // default 4K
    techId: 'dlss',
    modeId: 'dlss-quality',
    baseFps: 0,
    monitorSize: 27
  };

  const els = {};

  /* ==========================================
     DATA LOADING
     ========================================== */
  async function loadData() {
    try {
      const resp = await fetch('data.json?v=1');
      if (!resp.ok) throw new Error('Fetch failed');
      state.data = await resp.json();
    } catch (e) {
      console.warn('[RSV] Using fallback data');
      state.data = FALLBACK_DATA;
    }
  }

  /* ==========================================
     DOM CACHE
     ========================================== */
  function cacheDOM() {
    els.baseRes     = dom.$('#base-resolution');
    els.scalingTech = dom.$('#scaling-tech');
    els.scalingMode = dom.$('#scaling-mode');
    els.baseFps     = dom.$('#base-fps');
    els.monitorSize = dom.$('#monitor-size');

    els.renderRes   = dom.$('#render-res');
    els.renderPct   = dom.$('#render-percent');
    els.pixelBar    = dom.$('#pixel-bar');
    els.pixelPct    = dom.$('#pixel-pct');
    els.nativePixels= dom.$('#native-pixels');
    els.scaledPixels= dom.$('#scaled-pixels');
    els.perfMult    = dom.$('#perf-mult');
    els.estFps      = dom.$('#est-fps');
    els.vramNeed    = dom.$('#vram-need');
    els.ppiValue    = dom.$('#ppi-value');
    els.qualityBadge= dom.$('#quality-badge');
    els.qualityDot  = dom.$('#quality-dot');
    els.qualityText = dom.$('#quality-text');
    els.tipBody     = dom.$('#tip-body');
    els.grid        = dom.$('#pixel-grid');
    els.compareTable= dom.$('#compare-table');
    els.btnCopy     = dom.$('#btn-copy');
    els.btnReset    = dom.$('#btn-reset');
  }

  /* ==========================================
     POPULATE DROPDOWNS
     ========================================== */
  function populateDropdowns() {
    const d = state.data;

    // Resolutions
    els.baseRes.innerHTML = d.resolutions.map((r, i) =>
      `<option value="${i}"${i === state.baseResIndex ? ' selected' : ''}>${r.name} — ${r.width}×${r.height}</option>`
    ).join('');

    // Monitor sizes
    els.monitorSize.innerHTML = d.monitor_sizes.map(s =>
      `<option value="${s}"${s === state.monitorSize ? ' selected' : ''}>${s}"</option>`
    ).join('');

    // Scaling tech
    els.scalingTech.innerHTML = d.scaling_technologies.map(t =>
      `<option value="${t.id}"${t.id === state.techId ? ' selected' : ''}>${t.name}</option>`
    ).join('');

    updateModeDropdown();
  }

  function updateModeDropdown() {
    const tech = state.data.scaling_technologies.find(t => t.id === state.techId);
    if (!tech) return;

    els.scalingMode.innerHTML = tech.modes.map(m =>
      `<option value="${m.id}"${m.id === state.modeId ? ' selected' : ''}>${m.name}</option>`
    ).join('');

    // Ensure state.modeId is valid
    const valid = tech.modes.find(m => m.id === state.modeId);
    if (!valid && tech.modes.length) state.modeId = tech.modes[0].id;
  }

  /* ==========================================
     CALCULATIONS
     ========================================== */
  function getResolution() {
    return state.data.resolutions[state.baseResIndex];
  }

  function getMode() {
    const tech = state.data.scaling_technologies.find(t => t.id === state.techId);
    return tech ? tech.modes.find(m => m.id === state.modeId) : null;
  }

  function calculatePPI(width, height, diagonal) {
    const w2 = width * width;
    const h2 = height * height;
    const diagPx = Math.sqrt(w2 + h2);
    return Math.round(diagPx / diagonal);
  }

  function getQualityLabel(score) {
    const labels = state.data.quality_labels;
    if (score >= labels.excellent.min) return labels.excellent;
    if (score >= labels.good.min) return labels.good;
    if (score >= labels.fair.min) return labels.fair;
    return labels.poor;
  }

  function getVramEstimate(nativeMin, scaleFactor) {
    if (scaleFactor >= 0.75) return nativeMin;
    if (scaleFactor >= 0.5) return Math.max(4, nativeMin - 2);
    return Math.max(4, nativeMin - 4);
  }

  function getTipText(res, mode, techId) {
    const techName = techId === 'dlss' ? 'DLSS' : techId === 'fsr' ? 'FSR' : techId === 'xess' ? 'XeSS' : 'Native';
    if (techId === 'native') {
      return `Native ${res.name} delivers the sharpest image but demands the most GPU power. Consider ${res.width >= 3840 ? 'DLSS or FSR' : 'upscaling'} for better performance.`;
    }
    const saved = Math.round((1 - mode.scale_factor) * 100);
    const gain = Math.round((mode.perf_mult - 1) * 100);
    return `${techName} ${mode.name.split(' ')[0]} at ${res.name} renders ${saved}% fewer pixels internally, typically yielding ~${gain}% higher FPS with AI reconstruction.`;
  }

  /* ==========================================
     UPDATE UI
     ========================================== */
  function updateUI() {
    const res = getResolution();
    const mode = getMode();
    if (!res || !mode) return;

    const scale = mode.scale_factor;
    const intW = Math.round(res.width * scale);
    const intH = Math.round(res.height * scale);
    const intMp = ((intW * intH) / 1000000).toFixed(2);
    const pct = Math.round(scale * 100);

    // Main result
    els.renderRes.textContent = `${intW} × ${intH}`;
    els.renderPct.textContent = `${pct}% of native pixels (${intMp} MP vs ${res.mp} MP)`;

    // Pixel bar
    els.pixelBar.style.width = `${Math.max(4, pct)}%`;
    els.pixelPct.textContent = `${pct}%`;
    els.nativePixels.textContent = `${res.mp} MP`;
    els.scaledPixels.textContent = `${intMp} MP`;

    // Metrics
    els.perfMult.textContent = `${mode.perf_mult.toFixed(2)}×`;

    const baseFpsVal = parseInt(els.baseFps.value, 10) || 0;
    if (baseFpsVal > 0) {
      const est = Math.round(baseFpsVal * mode.perf_mult);
      els.estFps.textContent = `${est} FPS`;
    } else {
      els.estFps.textContent = '—';
    }

    const vram = getVramEstimate(res.vram_min, scale);
    els.vramNeed.textContent = `${vram} GB`;

    const ppi = calculatePPI(res.width, res.height, state.monitorSize);
    els.ppiValue.textContent = `${ppi} PPI`;

    // Quality badge
    const qLabel = getQualityLabel(mode.quality_score);
    els.qualityText.textContent = `${qLabel.label} — ${mode.quality_score}/100`;
    els.qualityDot.style.background = qLabel.color;
    els.qualityBadge.style.borderLeft = `3px solid ${qLabel.color}`;

    // Tip
    els.tipBody.textContent = getTipText(res, mode, state.techId);

    // Pixel grid
    updatePixelGrid(pct);

    // Comparison table
    updateComparisonTable(res);
  }

  function updatePixelGrid(pct) {
    if (!els.grid) return;
    const activeCount = Math.round(pct);
    let html = '';
    for (let i = 0; i < 100; i++) {
      html += `<div class="rsv-grid-cell${i < activeCount ? ' active' : ''}"></div>`;
    }
    els.grid.innerHTML = html;
  }

  function updateComparisonTable(res) {
    if (!els.compareTable) return;

    const tech = state.data.scaling_technologies.find(t => t.id === state.techId);
    if (!tech || tech.modes.length <= 1) {
      els.compareTable.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--rt-text-muted)">Select a scaling technology to see mode comparison.</td></tr>';
      return;
    }

    let html = `<tr><th>Mode</th><th>Internal Res</th><th>Est. FPS</th><th>Quality</th></tr>`;
    const baseFpsVal = parseInt(els.baseFps.value, 10) || 0;

    tech.modes.forEach(m => {
      const intW = Math.round(res.width * m.scale_factor);
      const intH = Math.round(res.height * m.scale_factor);
      const isActive = m.id === state.modeId;
      const fpsText = baseFpsVal > 0 ? `${Math.round(baseFpsVal * m.perf_mult)} FPS` : `${m.perf_mult.toFixed(2)}×`;
      const qLabel = getQualityLabel(m.quality_score);

      html += `<tr style="${isActive ? 'background:rgba(230,57,70,0.08)' : ''}">
        <td><strong>${m.name.split(' ')[0]}</strong>${isActive ? ' ✓' : ''}</td>
        <td>${intW}×${intH}</td>
        <td class="${m.perf_mult > 1.5 ? 'rsv-best' : ''}">${fpsText}</td>
        <td style="color:${qLabel.color}">${qLabel.label}</td>
      </tr>`;
    });

    els.compareTable.innerHTML = html;
  }

  /* ==========================================
     EVENT BINDING
     ========================================== */
  function bindEvents() {
    els.baseRes.addEventListener('change', e => {
      state.baseResIndex = parseInt(e.target.value, 10);
      updateUI();
      analytics.trackTool('resolution-scaling-visualizer', 'change_resolution');
    });

    els.scalingTech.addEventListener('change', e => {
      state.techId = e.target.value;
      updateModeDropdown();
      // Select first mode of new tech
      const tech = state.data.scaling_technologies.find(t => t.id === state.techId);
      if (tech && tech.modes.length) state.modeId = tech.modes[0].id;
      updateUI();
      analytics.trackTool('resolution-scaling-visualizer', 'change_tech');
    });

    els.scalingMode.addEventListener('change', e => {
      state.modeId = e.target.value;
      updateUI();
      analytics.trackTool('resolution-scaling-visualizer', 'change_mode');
    });

    els.baseFps.addEventListener('input', () => {
      updateUI();
    });

    els.monitorSize.addEventListener('change', e => {
      state.monitorSize = parseInt(e.target.value, 10);
      updateUI();
    });

    // Copy
    if (els.btnCopy) {
      els.btnCopy.addEventListener('click', async () => {
        const res = getResolution();
        const mode = getMode();
        if (!res || !mode) return;

        const intW = Math.round(res.width * mode.scale_factor);
        const intH = Math.round(res.height * mode.scale_factor);
        const techName = state.techId === 'native' ? 'Native' : state.techId === 'dlss' ? 'DLSS' : state.techId === 'fsr' ? 'FSR' : 'XeSS';
        const baseFpsVal = parseInt(els.baseFps.value, 10) || 0;
        const fpsLine = baseFpsVal > 0 ? `\nEstimated FPS: ${Math.round(baseFpsVal * mode.perf_mult)} FPS` : '';

        const text = `Resolution Scaling Visualizer Result\n\nOutput: ${res.name} (${res.width}×${res.height})\nTechnology: ${techName} — ${mode.name.split(' ')[0]}\nInternal Render: ${intW}×${intH} (${Math.round(mode.scale_factor * 100)}% of native)\nPerformance Multiplier: ${mode.perf_mult.toFixed(2)}×${fpsLine}\nVRAM Needed: ~${getVramEstimate(res.vram_min, mode.scale_factor)} GB\nQuality: ${getQualityLabel(mode.quality_score).label} (${mode.quality_score}/100)\n\nvia tools.redrag.in`;

        const success = await utils.copyToClipboard(text);
        if (success) {
          if (components.Toast) components.Toast.show({ message: 'Result copied to clipboard!', type: 'success', duration: 3000 });
          analytics.trackTool('resolution-scaling-visualizer', 'share');
        } else {
          if (components.Toast) components.Toast.show({ message: 'Could not copy. Try manually.', type: 'error', duration: 4000 });
        }
      });
    }

    // Reset
    if (els.btnReset) {
      els.btnReset.addEventListener('click', () => {
        state.baseResIndex = 2;
        state.techId = 'dlss';
        state.modeId = 'dlss-quality';
        state.monitorSize = 27;
        els.baseFps.value = '';
        populateDropdowns();
        updateUI();
        if (components.Toast) components.Toast.show({ message: 'All settings reset', type: 'info', duration: 3000 });
        analytics.trackTool('resolution-scaling-visualizer', 'reset');
      });
    }
  }

  /* ==========================================
     FAQ
     ========================================== */
  function initFAQ() {
    const container = dom.$('#faq-container');
    if (!container || !components.FAQ) return;

    components.FAQ.init({
      container: container,
      items: [
        {
          question: 'What is resolution scaling and how does it work?',
          answer: '<p>Resolution scaling is a rendering technique where your GPU draws the game at a <strong>lower internal resolution</strong> than your monitor\'s native output, then uses AI or algorithmic upscaling to reconstruct the final image. Technologies like <strong>NVIDIA DLSS</strong>, <strong>AMD FSR</strong>, and <strong>Intel XeSS</strong> analyze the lower-resolution frame and intelligently fill in missing detail. This dramatically reduces the pixel workload — for example, DLSS Quality at 4K renders internally at 1440p (just 44% of the pixels) — while the output remains sharp on your 4K display.</p>'
        },
        {
          question: 'How much FPS boost does DLSS Quality mode actually give?',
          answer: '<p>DLSS Quality mode typically provides a <strong>30–50% FPS increase</strong> compared to native rendering at the same output resolution. At 4K, this can mean jumping from 45 FPS to 60–65 FPS. The exact gain depends on your GPU, the game engine, and whether ray tracing is enabled. DLSS Performance mode can deliver even larger gains — often <strong>80–100% higher FPS</strong> — by rendering at just 50% of the native resolution internally.</p>'
        },
        {
          question: 'Which upscaling technology has the best image quality?',
          answer: '<p>In 2026, <strong>NVIDIA DLSS 4.5</strong> generally leads in image quality benchmarks and blind tests, especially at 1440p and 4K with ray tracing. <strong>Intel XeSS</strong> follows closely, offering strong results on Arc GPUs with dedicated XMX cores. <strong>AMD FSR 4</strong> (Redstone) has closed the gap significantly with its new ML-based pipeline but can still show more temporal instability in motion. For cross-GPU compatibility, FSR works on virtually any modern GPU, while DLSS requires RTX hardware and XeSS works best on Intel Arc.</p>'
        },
        {
          question: 'Does resolution scaling reduce VRAM usage?',
          answer: '<p>Yes, but <strong>not as dramatically as the pixel reduction suggests</strong>. VRAM usage scales with resolution, but many buffers (shadow maps, texture caches, UI elements) remain roughly the same size regardless of render resolution. As a rule of thumb: Quality/Balanced modes use roughly the same VRAM as native, while Performance and Ultra Performance modes may free up 2–4 GB depending on the base resolution. For 4K gaming, 16 GB VRAM is still the safe minimum even with upscaling enabled.</p>'
        },
        {
          question: 'Should I use Quality, Balanced, or Performance mode?',
          answer: '<p>Choose <strong>Quality mode</strong> when you want the best image fidelity with a modest FPS boost — ideal if you\'re already close to your target frame rate. Use <strong>Balanced mode</strong> as the sweet spot between visuals and performance for most gamers. Switch to <strong>Performance mode</strong> when you need maximum frame rates, such as for high-refresh 1440p monitors or ray-traced 4K gaming. <strong>Ultra Performance</strong> is best reserved for extreme cases like 8K output or VR where every frame counts, as image quality degradation becomes more visible.</p>'
        },
        {
          question: 'Can I use DLSS on an AMD GPU or FSR on an NVIDIA GPU?',
          answer: '<p><strong>DLSS is NVIDIA-exclusive</strong> and requires RTX 20-series or newer. <strong>FSR is open and works on any modern GPU</strong> — AMD, NVIDIA, and Intel — making it the most versatile choice. <strong>Intel XeSS</strong> runs cross-vendor too, but performs best on Arc GPUs with XMX acceleration; on other GPUs it falls back to DP4a instructions with slightly lower quality. If you have an RTX card, DLSS is usually the best option. On AMD or older NVIDIA cards, FSR is your go-to.</p>'
        }
      ],
      showSchema: true,
      openFirst: false
    });
  }

  /* ==========================================
     INIT
     ========================================== */
  async function init() {
    await loadData();
    cacheDOM();
    populateDropdowns();
    bindEvents();
    updateUI();
    initFAQ();
    analytics.trackTool('resolution-scaling-visualizer', 'load');
  }

  dom.ready(() => {
    shell.ready.then(init).catch(err => {
      console.error('[RSV] Init failed:', err);
      if (components.Toast) {
        components.Toast.show({ message: 'Failed to initialize tool. Please refresh.', type: 'error', duration: 5000 });
      }
    });
  });

})(window);
