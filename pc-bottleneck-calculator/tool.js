/* ============================================
   PC Bottleneck Calculator - Core Logic
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
  const SLUG = 'pc-bottleneck-calculator';

  const RES_LABELS = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' };
  const RES_FACTORS = { '1080p': 1.0, '1440p': 1.35, '4k': 2.2 };
  const WORK_FACTORS = { 'balanced': 1.0, 'esports': 0.8, 'aaa': 1.15 };
  const BALANCE_K = 0.95;

  const DEFAULTS = {
    cpuId: 'r5-5600',
    gpuId: 'rtx-4060',
    res: '1080p',
    workload: 'balanced'
  };

  const state = {
    data: null,
    cpuId: DEFAULTS.cpuId,
    gpuId: DEFAULTS.gpuId,
    res: DEFAULTS.res,
    workload: DEFAULTS.workload,
    result: null
  };

  const els = {};

  function cacheDOM() {
    els.cpu = dom.$('#select-cpu');
    els.gpu = dom.$('#select-gpu');
    els.res = dom.$('#select-res');
    els.workload = dom.$('#select-workload');
    els.cpuMeta = dom.$('#cpu-meta');
    els.gpuMeta = dom.$('#gpu-meta');
    els.pct = dom.$('#res-pct');
    els.label = dom.$('#res-label');
    els.band = dom.$('#res-band');
    els.explain = dom.$('#res-explain');
    els.fix = dom.$('#res-fix');
    els.statCpu = dom.$('#stat-cpu');
    els.statGpu = dom.$('#stat-gpu');
    els.btnCopy = dom.$('#btn-copy');
    els.btnReset = dom.$('#btn-reset');
  }

  function populateSelects() {
    if (!state.data) return;

    const cpuGroups = ['Intel', 'AMD'];
    els.cpu.innerHTML = cpuGroups.map(brand => {
      const list = state.data.cpus.filter(c => c.brand === brand);
      const opts = list.map(c => `<option value="${utils.escapeHtml(c.id)}">${utils.escapeHtml(c.name)}</option>`).join('');
      return `<optgroup label="${brand}">${opts}</optgroup>`;
    }).join('');

    const gpuGroups = ['NVIDIA', 'AMD', 'Intel', 'Integrated'];
    els.gpu.innerHTML = gpuGroups.map(brand => {
      const list = state.data.gpus.filter(g => g.brand === brand);
      const opts = list.map(g => `<option value="${utils.escapeHtml(g.id)}">${utils.escapeHtml(g.name)} (${utils.escapeHtml(g.vram)})</option>`).join('');
      return `<optgroup label="${brand}">${opts}</optgroup>`;
    }).join('');

    els.cpu.value = state.cpuId;
    els.gpu.value = state.gpuId;
    els.res.value = state.res;
    els.workload.value = state.workload;
  }

  function computePair(cpuScore, gpuScore, resKey, workloadKey) {
    const resFactor = RES_FACTORS[resKey] || 1.0;
    const workFactor = WORK_FACTORS[workloadKey] || 1.0;
    const effectiveGpuDemand = gpuScore / (resFactor * workFactor);
    const requiredCpu = effectiveGpuDemand * BALANCE_K;

    if (cpuScore < requiredCpu) {
      const pct = Math.min(60, Math.round((1 - cpuScore / requiredCpu) * 100));
      return { limiter: 'cpu', pct, effectiveGpuDemand, requiredCpu };
    }
    const pct = Math.min(60, Math.round((1 - requiredCpu / cpuScore) * 100));
    return { limiter: 'gpu', pct, effectiveGpuDemand, requiredCpu };
  }

  function getVerdictBand(pct) {
    if (pct <= 5) return { text: '0–5% Excellent match', cls: 'pbc-pill--ok' };
    if (pct <= 10) return { text: '6–10% Minor, ignore it', cls: 'pbc-pill--minor' };
    if (pct <= 20) return { text: '11–20% Noticeable in some games', cls: 'pbc-pill--warn' };
    return { text: '21%+ Severe, upgrade worth it', cls: 'pbc-pill--bad' };
  }

  function buildSentence(cpu, gpu, resKey, res) {
    const resName = RES_LABELS[resKey];
    const nextRes = resKey === '1080p' ? '1440p' : resKey === '1440p' ? '4K' : null;
    const nextCalc = nextRes ? computePair(cpu.score, gpu.score, nextRes.toLowerCase(), state.workload) : null;

    if (res.limiter === 'cpu') {
      const currentDesc = res.pct <= 10
        ? `At ${resName}, your ${cpu.name} keeps up well with the ${gpu.name} (estimated ${res.pct}% CPU bottleneck).`
        : `At ${resName}, your ${cpu.name} is estimated to hold back the ${gpu.name} by ~${res.pct}% in CPU-heavy scenes.`;

      if (!nextCalc) {
        return `${currentDesc} Since you are already at 4K, only a faster processor will relieve this CPU limit.`;
      }
      const nextDesc = nextCalc.limiter === 'gpu'
        ? `Stepping up to ${nextRes} shifts the load onto the GPU (GPU-limited — ideal for gaming).`
        : `Stepping up to ${nextRes} drops the estimated CPU bottleneck to ~${nextCalc.pct}%.`;
      return `${currentDesc} ${nextDesc}`;
    }

    const gpuDesc = `At ${resName}, your setup is GPU-limited — normal and ideal for gaming (your ${cpu.name} has ~${res.pct}% headroom to spare).`;
    if (!nextCalc) {
      return `${gpuDesc} Stepping down to 1440p or enabling DLSS/FSR will boost frame rates further.`;
    }
    return `${gpuDesc} Moving up to ${nextRes} puts even more work on the ${gpu.name}, lowering raw FPS.`;
  }

  function buildIndiaFix(cpu, gpu, res) {
    const configUrl = 'https://tools.redrag.in/pc-build-configurator/';
    const usedGpuUrl = 'https://tools.redrag.in/used-gpu-price-checker/';

    if (res.limiter === 'cpu' && res.pct > 10) {
      if (cpu.socket === 'AM4' && cpu.score < 130) {
        return `<strong>India Fix:</strong> A drop-in <strong>Ryzen 7 5700X3D (~₹21,000–₹23,000, approx. Nov 2026)</strong> on your AM4 board clears this bottleneck without changing your motherboard. Compare options in the <a href="${configUrl}">PC Build Configurator</a>.`;
      }
      if (cpu.socket === 'LGA1700' && cpu.score < 120) {
        return `<strong>India Fix:</strong> Stepping up to an <strong>Intel Core i5-13400F / i5-14400F (~₹14,500–₹17,500, approx. Nov 2026)</strong> on your LGA1700 board removes most of this bottleneck. Plan it in the <a href="${configUrl}">PC Build Configurator</a>.`;
      }
      if (cpu.socket === 'AM5' && cpu.score < 155) {
        return `<strong>India Fix:</strong> A drop-in <strong>Ryzen 7 7800X3D (~₹36,000–₹39,000, approx. Nov 2026)</strong> on your AM5 board eliminates this CPU limit. Check compatibility in the <a href="${configUrl}">PC Build Configurator</a>.`;
      }
      return `<strong>India Fix:</strong> Your ${cpu.socket} platform has limited drop-in headroom for this GPU. Plan a balanced AM4/AM5 or LGA1700 upgrade in our <a href="${configUrl}">PC Build Configurator</a>.`;
    }

    if (res.limiter === 'gpu' && (gpu.score < 95 || res.pct > 20)) {
      if (gpu.score < 85) {
        return `<strong>India Fix:</strong> A <strong>used RTX 3060 Ti (₹16,000–₹19,000 used)</strong> or <strong>used RX 6700 XT (₹17,000–₹20,000 used, approx. Nov 2026)</strong> gives a huge FPS jump under ₹20,000. Check fair market rates on the <a href="${usedGpuUrl}">Used GPU Price Checker</a>.`;
      }
      if (gpu.score < 115) {
        return `<strong>India Fix:</strong> Stepping up to an <strong>RTX 4060 (~₹27,500–₹29,500 new)</strong> or <strong>RX 7600 (~₹23,500–₹26,000 new, approx. Nov 2026)</strong>—or checking used options on the <a href="${usedGpuUrl}">Used GPU Price Checker</a>—lifts GPU-limited FPS cleanly.`;
      }
      return `<strong>India Fix:</strong> Being GPU-limited on a ${gpu.name} is normal and ideal for gaming — no urgent upgrade needed. If you want more FPS, enable DLSS/FSR or compare higher-tier cards in the <a href="${configUrl}">PC Build Configurator</a>.`;
    }

    return `<strong>India Fix:</strong> No upgrade needed — this pairing is already well balanced. If you plan a future upgrade anyway, test parts in our <a href="${configUrl}">PC Build Configurator</a>.`;
  }

  function calculateResult() {
    if (!state.data) return;
    const cpu = state.data.cpus.find(c => c.id === state.cpuId) || state.data.cpus[0];
    const gpu = state.data.gpus.find(g => g.id === state.gpuId) || state.data.gpus[0];

    const res = computePair(cpu.score, gpu.score, state.res, state.workload);
    const band = res.limiter === 'gpu'
      ? { text: 'GPU-limited — normal & healthy', cls: 'pbc-pill--ok' }
      : getVerdictBand(res.pct);

    state.result = { cpu, gpu, res, band };
    updateUI();
  }

  function updateUI() {
    if (!state.result) return;
    const { cpu, gpu, res, band } = state.result;

    els.cpuMeta.textContent = `Socket: ${cpu.socket} • Relative gaming score: ${cpu.score} (Ryzen 5 5600 = 100)`;
    const marketTag = gpu.market === 'used' ? 'approx. used price, Nov 2026' : gpu.market === 'new' ? 'approx. street price, Nov 2026' : 'Integrated graphics';
    els.gpuMeta.textContent = `VRAM: ${gpu.vram} • Score: ${gpu.score} (RTX 4060 = 100) • ${gpu.price_inr} (${marketTag})`;

    els.pct.textContent = `${res.pct}%`;
    els.label.textContent = res.limiter === 'cpu'
      ? `CPU bottleneck: ${res.pct}% (estimate)`
      : `GPU-limited — normal for gaming (${res.pct}%)`;

    els.band.textContent = band.text;
    els.band.className = `pbc-pill ${band.cls}`;

    els.explain.textContent = buildSentence(cpu, gpu, state.res, res);
    els.fix.innerHTML = buildIndiaFix(cpu, gpu, res);

    els.statCpu.textContent = `${cpu.score} (${cpu.socket})`;
    els.statGpu.textContent = `${Math.round(res.effectiveGpuDemand)} @ ${RES_LABELS[state.res]}`;
  }

  function bindEvents() {
    const onChange = () => {
      state.cpuId = els.cpu.value;
      state.gpuId = els.gpu.value;
      state.res = els.res.value;
      state.workload = els.workload.value;
      calculateResult();
    };

    [els.cpu, els.gpu, els.res, els.workload].forEach(el => {
      if (el) el.addEventListener('change', onChange);
    });

    if (els.btnCopy) {
      els.btnCopy.addEventListener('click', async () => {
        if (!state.result) return;
        const { cpu, gpu, res, band } = state.result;
        const summary = [
          `REDRAG PC Bottleneck Estimate (${RES_LABELS[state.res]})`,
          `CPU: ${cpu.name} | GPU: ${gpu.name}`,
          `Result: ${res.limiter === 'cpu' ? `CPU bottleneck: ${res.pct}%` : `GPU-limited — normal for gaming (${res.pct}%)`}`,
          `Verdict: ${band.text}`,
          `Check yours: https://tools.redrag.in/pc-bottleneck-calculator/`
        ].join('\n');

        const ok = await utils.copyToClipboard(summary);
        if (components.Toast) {
          components.Toast.show({
            message: ok ? 'Estimated result copied to clipboard!' : 'Could not copy. Try manually.',
            type: ok ? 'success' : 'error',
            duration: 3000
          });
        }
        if (ok) analytics.trackTool(SLUG, 'share');
      });
    }

    if (els.btnReset) {
      els.btnReset.addEventListener('click', () => {
        state.cpuId = DEFAULTS.cpuId;
        state.gpuId = DEFAULTS.gpuId;
        state.res = DEFAULTS.res;
        state.workload = DEFAULTS.workload;
        els.cpu.value = state.cpuId;
        els.gpu.value = state.gpuId;
        els.res.value = state.res;
        els.workload.value = state.workload;
        calculateResult();

        if (components.Toast) {
          components.Toast.show({ message: 'Reset to Ryzen 5 5600 + RTX 4060 (1080p)', type: 'info', duration: 2500 });
        }
        analytics.trackTool(SLUG, 'reset');
      });
    }
  }

  function initFAQ() {
    const container = dom.$('#faq-container');
    if (!container || !components.FAQ) return;

    const items = [
      {
        question: 'What is a bottleneck calculator?',
        answer: '<p>A PC bottleneck calculator estimates whether your CPU or GPU is more likely to limit gaming frame rates at a chosen resolution and workload. It compares relative gaming performance averages so you can spot big pairing mismatches before buying or upgrading parts.</p>'
      },
      {
        question: 'How much bottleneck is OK for gaming?',
        answer: '<p>Anything up to <strong>10%</strong> is completely fine for everyday gaming. Even 11%–15% is only noticeable in select CPU-heavy titles at 1080p. In practice, only a <strong>20%+ CPU bottleneck</strong> is worth spending money to fix.</p>'
      },
      {
        question: 'Is a GPU bottleneck better than a CPU bottleneck?',
        answer: '<p>Yes. Being <strong>GPU-limited</strong> (where your graphics card runs at 98%–99% usage) is normal and ideal for gaming because it delivers smooth frame times without micro-stutters. A heavy CPU bottleneck leaves your GPU underused and can cause uneven frame pacing.</p>'
      },
      {
        question: 'Does resolution change the bottleneck?',
        answer: '<p>Yes. Higher resolutions like 1440p and 4K force the GPU to render many more pixels per frame, reducing raw FPS and taking pressure off the CPU. A pairing that shows a CPU bottleneck at 1080p often becomes balanced or GPU-limited at 1440p or 4K.</p>'
      },
      {
        question: 'My GPU usage is 60% but FPS is low — why?',
        answer: '<p>If your frame rate is uncapped (V-Sync and FPS limiters off) and GPU usage sits around 60% with low FPS, your system is hitting a <strong>CPU, RAM, or single-thread engine bottleneck</strong>. Check that your RAM is running in dual-channel with XMP/EXPO enabled and close heavy background apps.</p>'
      },
      {
        question: 'What is the cheapest way to fix a CPU bottleneck in India?',
        answer: '<p>First try free fixes: enable XMP/EXPO, run dual-channel RAM, or raise graphics settings/resolution. If you need a hardware upgrade on AM4, a drop-in <strong>Ryzen 7 5700X3D (~₹21,000–₹23,000, approx. Nov 2026)</strong> is the best value. On LGA1700, an <strong>i5-13400F or i5-14400F (~₹14,500–₹17,500)</strong> fixes most mid-range bottlenecks.</p>'
      }
    ];

    components.FAQ.init({
      container: container,
      items: items,
      showSchema: true,
      openFirst: false
    });
  }

  async function init() {
    cacheDOM();
    try {
      const res = await fetch('data.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      state.data = await res.json();
    } catch (err) {
      console.error('[RTTool] Failed to load data.json:', err);
      if (components.Toast) {
        components.Toast.show({ message: 'Could not load hardware list. Please refresh.', type: 'error', duration: 5000 });
      }
      return;
    }

    populateSelects();
    bindEvents();
    calculateResult();
    initFAQ();
    analytics.trackTool(SLUG, 'load');
  }

  dom.ready(() => {
    shell.ready.then(init).catch(err => {
      console.error('[RTTool] Init failed:', err);
    });
  });

})(window);
