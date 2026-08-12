/* ============================================
   PSU Wattage Calculator - Core Logic
   Requires: shared/js/core.js, shared/js/components.js
   ============================================ */

(function (global) {
  'use strict';

  const RT = global.RT;
  if (!RT) {
    console.error('[PSUCalc] Core not loaded');
    return;
  }

  const { dom, utils } = RT;
  const components = global.RT.components || {};

  /* ==========================================
     DATA & STATE
     ========================================== */
  let componentData = null;

  const state = {
    cpu: '',
    gpu: '',
    motherboard: 'atx',
    ramType: 'ddr5',
    ramSticks: 2,
    ramRgb: false,
    nvmeCount: 1,
    sataSsdCount: 0,
    hddCount: 0,
    cooling: 'air_stock',
    fanType: 'standard_120mm',
    fanCount: 3,
    peripherals: {
      rgbController: false,
      soundCard: false,
      captureCard: false,
      usbDevices: false,
      fanController: false,
      ledStrips: 0
    },
    overclocking: false,
    efficiency: '80_plus_gold'
  };

  const els = {};

  /* ==========================================
     COLORS FOR BREAKDOWN
     ========================================== */
  const BREAKDOWN_COLORS = {
    cpu: '#e63946',
    gpu: '#3498db',
    motherboard: '#9b59b6',
    ram: '#f1c40f',
    storage: '#2ecc71',
    cooling: '#e67e22',
    fans: '#1abc9c',
    peripherals: '#95a5a6'
  };

  /* ==========================================
     INIT
     ========================================== */
  async function init() {
    try {
      const res = await fetch('data.json?v=1');
      componentData = await res.json();
    } catch (e) {
      console.error('[PSUCalc] Failed to load data:', e);
      if (components.Toast) {
        components.Toast.show({ message: 'Failed to load component data. Please refresh.', type: 'error', duration: 5000 });
      }
      return;
    }

    cacheDOM();
    populateDropdowns();
    loadStateFromURL();
    bindEvents();
    updateUI();
    initFAQ();

    if (RT.analytics) {
      RT.analytics.trackTool('psu-wattage-calculator', 'load');
    }
  }

  /* ========================================== */

  function cacheDOM() {
    // CPU
    els.cpuBrand = dom.$('#cpu-brand');
    els.cpuSelect = dom.$('#cpu-select');
    // GPU
    els.gpuBrand = dom.$('#gpu-brand');
    els.gpuSelect = dom.$('#gpu-select');
    // Motherboard
    els.moboSelect = dom.$('#mobo-select');
    // RAM
    els.ramType = dom.$('#ram-type');
    els.ramSticks = dom.$('#ram-sticks');
    els.ramSticksVal = dom.$('#ram-sticks-val');
    els.ramRgb = dom.$('#ram-rgb');
    // Storage
    els.nvmeCount = dom.$('#nvme-count');
    els.nvmeVal = dom.$('#nvme-val');
    els.sataCount = dom.$('#sata-count');
    els.sataVal = dom.$('#sata-val');
    els.hddCount = dom.$('#hdd-count');
    els.hddVal = dom.$('#hdd-val');
    // Cooling
    els.coolingSelect = dom.$('#cooling-select');
    // Fans
    els.fanType = dom.$('#fan-type');
    els.fanCount = dom.$('#fan-count');
    els.fanVal = dom.$('#fan-val');
    // Peripherals
    els.periphRgb = dom.$('#periph-rgb');
    els.periphSound = dom.$('#periph-sound');
    els.periphCapture = dom.$('#periph-capture');
    els.periphUsb = dom.$('#periph-usb');
    els.periphFanCtrl = dom.$('#periph-fanctrl');
    els.periphLed = dom.$('#periph-led');
    els.periphLedVal = dom.$('#periph-led-val');
    // Toggles
    els.ocToggle = dom.$('#oc-toggle');
    els.effSelect = dom.$('#eff-select');
    // Results
    els.resultMin = dom.$('#result-min');
    els.resultRec = dom.$('#result-rec');
    els.resultFuture = dom.$('#result-future');
    els.breakdownBar = dom.$('#breakdown-bar');
    els.breakdownLegend = dom.$('#breakdown-legend');
    els.atxBadge = dom.$('#atx-badge');
    els.gpuConnector = dom.$('#gpu-connector');
    els.effTable = dom.$('#eff-table');
    els.wallPower = dom.$('#wall-power');
    // Buttons
    els.btnCopy = dom.$('#btn-copy');
    els.btnReset = dom.$('#btn-reset');
    els.btnShare = dom.$('#btn-share');
  }

  /* ==========================================
     POPULATE DROPDOWNS
     ========================================== */
  function populateDropdowns() {
    if (!componentData) return;

    // CPU by brand
    const updateCPU = () => {
      const brand = els.cpuBrand.value;
      els.cpuSelect.innerHTML = '<option value="">-- Select CPU --</option>';
      const list = componentData.cpus[brand] || [];
      list.forEach(cpu => {
        const opt = document.createElement('option');
        opt.value = cpu.name;
        opt.textContent = cpu.name + ' (' + cpu.tdp + 'W TDP)';
        els.cpuSelect.appendChild(opt);
      });
      if (state.cpu) els.cpuSelect.value = state.cpu;
    };
    els.cpuBrand.addEventListener('change', updateCPU);
    updateCPU();

    // GPU by brand
    const updateGPU = () => {
      const brand = els.gpuBrand.value;
      els.gpuSelect.innerHTML = '<option value="">-- Select GPU --</option>';
      const list = componentData.gpus[brand] || [];
      list.forEach(gpu => {
        const opt = document.createElement('option');
        opt.value = gpu.name;
        opt.textContent = gpu.name + ' (' + gpu.tdp + 'W TDP)';
        els.gpuSelect.appendChild(opt);
      });
      if (state.gpu) els.gpuSelect.value = state.gpu;
    };
    els.gpuBrand.addEventListener('change', updateGPU);
    updateGPU();
  }

  /* ==========================================
     EVENT BINDING
     ========================================== */
  function bindEvents() {
    // Selects
    els.cpuSelect.addEventListener('change', () => { state.cpu = els.cpuSelect.value; updateUI(); });
    els.gpuSelect.addEventListener('change', () => { state.gpu = els.gpuSelect.value; updateUI(); });
    els.moboSelect.addEventListener('change', () => { state.motherboard = els.moboSelect.value; updateUI(); });
    els.ramType.addEventListener('change', () => { state.ramType = els.ramType.value; updateUI(); });
    els.coolingSelect.addEventListener('change', () => { state.cooling = els.coolingSelect.value; updateUI(); });
    els.fanType.addEventListener('change', () => { state.fanType = els.fanType.value; updateUI(); });
    els.effSelect.addEventListener('change', () => { state.efficiency = els.effSelect.value; updateUI(); });

    // Counters - RAM
    bindCounter(els.ramSticks, els.ramSticksVal, (v) => { state.ramSticks = v; updateUI(); }, 1, 8);
    // Counters - Storage
    bindCounter(els.nvmeCount, els.nvmeVal, (v) => { state.nvmeCount = v; updateUI(); }, 0, 6);
    bindCounter(els.sataCount, els.sataVal, (v) => { state.sataSsdCount = v; updateUI(); }, 0, 6);
    bindCounter(els.hddCount, els.hddVal, (v) => { state.hddCount = v; updateUI(); }, 0, 6);
    // Counters - Fans
    bindCounter(els.fanCount, els.fanVal, (v) => { state.fanCount = v; updateUI(); }, 0, 15);
    // Counters - LED strips
    bindCounter(els.periphLed, els.periphLedVal, (v) => { state.peripherals.ledStrips = v; updateUI(); }, 0, 10);

    // Toggles
    els.ramRgb.addEventListener('change', () => { state.ramRgb = els.ramRgb.checked; updateUI(); });
    els.periphRgb.addEventListener('change', () => { state.peripherals.rgbController = els.periphRgb.checked; updateUI(); });
    els.periphSound.addEventListener('change', () => { state.peripherals.soundCard = els.periphSound.checked; updateUI(); });
    els.periphCapture.addEventListener('change', () => { state.peripherals.captureCard = els.periphCapture.checked; updateUI(); });
    els.periphUsb.addEventListener('change', () => { state.peripherals.usbDevices = els.periphUsb.checked; updateUI(); });
    els.periphFanCtrl.addEventListener('change', () => { state.peripherals.fanController = els.periphFanCtrl.checked; updateUI(); });

    // Overclocking toggle
    els.ocToggle.addEventListener('click', () => {
      state.overclocking = !state.overclocking;
      els.ocToggle.classList.toggle('active', state.overclocking);
      updateUI();
    });

    // Buttons
    if (els.btnCopy) {
      els.btnCopy.addEventListener('click', copyResult);
    }
    if (els.btnReset) {
      els.btnReset.addEventListener('click', resetTool);
    }
    if (els.btnShare) {
      els.btnShare.addEventListener('click', shareURL);
    }
  }

  function bindCounter(btnContainer, valEl, callback, min, max) {
    if (!btnContainer) return;
    const btns = btnContainer.querySelectorAll('.psu-counter__btn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        let val = parseInt(valEl.textContent, 10);
        if (btn.dataset.action === 'inc' && val < max) val++;
        if (btn.dataset.action === 'dec' && val > min) val--;
        valEl.textContent = val;
        callback(val);
      });
    });
  }

  /* ==========================================
     CALCULATION LOGIC
     ========================================== */
  function calculate() {
    if (!componentData) return null;

    const d = componentData;
    let breakdown = {
      cpu: 0, gpu: 0, motherboard: 0, ram: 0,
      storage: 0, cooling: 0, fans: 0, peripherals: 0
    };

    // CPU
    let cpuTdp = 0;
    if (state.cpu) {
      const brand = els.cpuBrand.value;
      const cpu = d.cpus[brand].find(c => c.name === state.cpu);
      if (cpu) {
        cpuTdp = state.overclocking ? cpu.boost : cpu.tdp;
        breakdown.cpu = cpuTdp;
      }
    }

    // GPU
    let gpuTdp = 0;
    let gpuObj = null;
    if (state.gpu) {
      const brand = els.gpuBrand.value;
      gpuObj = d.gpus[brand].find(g => g.name === state.gpu);
      if (gpuObj) {
        gpuTdp = state.overclocking ? Math.round(gpuObj.tdp * d.overclocking.gpu_multiplier) : gpuObj.tdp;
        breakdown.gpu = gpuTdp;
      }
    }

    // Motherboard
    breakdown.motherboard = d.motherboards[state.motherboard] || 70;

    // RAM
    const ramKey = state.ramType + (state.ramRgb ? '_rgb' : '') + '_stick';
    const ramWatt = d.ram[ramKey] || (state.ramType === 'ddr5' ? 6 : 4);
    breakdown.ram = ramWatt * state.ramSticks;

    // Storage
    breakdown.storage = (d.storage.nvme_m2 * state.nvmeCount) +
                        (d.storage.sata_ssd * state.sataSsdCount) +
                        (d.storage.hdd_7200rpm * state.hddCount);

    // Cooling
    breakdown.cooling = d.cooling[state.cooling] || 5;

    // Fans
    const fanWatt = d.fans[state.fanType] || 2;
    breakdown.fans = fanWatt * state.fanCount;

    // Peripherals
    let periphWatt = 0;
    if (state.peripherals.rgbController) periphWatt += d.peripherals.case_rgb_controller;
    if (state.peripherals.soundCard) periphWatt += d.peripherals.sound_card;
    if (state.peripherals.captureCard) periphWatt += d.peripherals.capture_card;
    if (state.peripherals.usbDevices) periphWatt += d.peripherals.usb_devices;
    if (state.peripherals.fanController) periphWatt += d.peripherals.fan_controller;
    periphWatt += d.peripherals.led_strips * state.peripherals.ledStrips;
    breakdown.peripherals = periphWatt;

    // Total base
    const baseTotal = Object.values(breakdown).reduce((a, b) => a + b, 0);

    // Transient spike buffer (10% for modern GPUs)
    const transientBuffer = gpuObj && gpuObj.tdp >= 300 ? Math.round(gpuObj.tdp * 0.10) : 0;

    // Tiers
    const minWatt = Math.ceil((baseTotal + transientBuffer) / 50) * 50;
    const recWatt = Math.ceil((baseTotal + transientBuffer) * d.headroom.recommended / 50) * 50;
    const futureWatt = Math.ceil((baseTotal + transientBuffer) * d.headroom.future_proof / 50) * 50;

    // Efficiency
    const effRate = d.efficiency[state.efficiency] || 0.87;
    const wallPower = Math.round(baseTotal / effRate);

    return {
      breakdown,
      baseTotal,
      transientBuffer,
      minWatt,
      recWatt,
      futureWatt,
      gpuObj,
      wallPower,
      effRate
    };
  }

  /* ==========================================
     UI UPDATE
     ========================================== */
  function updateUI() {
    const calc = calculate();
    if (!calc) return;

    // Sync form state
    if (els.cpuSelect.value !== state.cpu) els.cpuSelect.value = state.cpu;
    if (els.gpuSelect.value !== state.gpu) els.gpuSelect.value = state.gpu;

    // Update result tiers
    els.resultMin.textContent = calc.minWatt + 'W';
    els.resultRec.textContent = calc.recWatt + 'W';
    els.resultFuture.textContent = calc.futureWatt + 'W';

    // Breakdown bar
    renderBreakdown(calc.breakdown, calc.baseTotal);

    // ATX 3.1 Badge
    if (calc.gpuObj && calc.gpuObj.atx31) {
      els.atxBadge.className = 'psu-atx-badge psu-atx-badge--yes';
      els.atxBadge.innerHTML = '<span>✓</span> ATX 3.1 / PCIe 5.1 Recommended';
      els.gpuConnector.textContent = 'GPU Power: ' + calc.gpuObj.connector + ' (Native support advised)';
    } else if (calc.gpuObj && (calc.gpuObj.name.includes('RTX 40') || calc.gpuObj.name.includes('RTX 5090') || calc.gpuObj.name.includes('RTX 5080') || calc.gpuObj.name.includes('RTX 5070'))) {
      els.atxBadge.className = 'psu-atx-badge psu-atx-badge--no';
      els.atxBadge.innerHTML = '<span>⚠</span> Consider ATX 3.1 PSU for GPU spikes';
      els.gpuConnector.textContent = 'GPU Power: ' + (calc.gpuObj.connector || '8-pin');
    } else {
      els.atxBadge.className = 'psu-atx-badge psu-atx-badge--no';
      els.atxBadge.innerHTML = '<span>ℹ</span> Standard PSU Compatible';
      els.gpuConnector.textContent = calc.gpuObj ? 'GPU Power: ' + calc.gpuObj.connector : 'GPU Power: Not selected';
    }

    // Efficiency table
    renderEfficiencyTable(calc.baseTotal);
    els.wallPower.textContent = '~' + calc.wallPower + 'W from wall';

    // Update URL
    updateURL();
  }

  function renderBreakdown(breakdown, total) {
    if (total === 0) {
      els.breakdownBar.innerHTML = '';
      els.breakdownLegend.innerHTML = '<span style="color:var(--rt-text-muted);font-size:var(--rt-text-sm);">Select components to see power breakdown</span>';
      return;
    }

    let barHTML = '';
    let legendHTML = '';

    for (const [key, value] of Object.entries(breakdown)) {
      if (value === 0) continue;
      const pct = ((value / total) * 100).toFixed(1);
      barHTML += '<div class="psu-breakdown__segment" style="width:' + pct + '%;background:' + BREAKDOWN_COLORS[key] + ';" data-label="' + key.toUpperCase() + ' ' + value + 'W (' + pct + '%)' + '"></div>';
      legendHTML += '<div class="psu-legend__item"><div class="psu-legend__dot" style="background:' + BREAKDOWN_COLORS[key] + '"></div><span>' + key.charAt(0).toUpperCase() + key.slice(1) + ' ' + value + 'W</span></div>';
    }

    els.breakdownBar.innerHTML = barHTML;
    els.breakdownLegend.innerHTML = legendHTML;
  }

  function renderEfficiencyTable(baseTotal) {
    if (!componentData) return;
    const efficiencies = [
      { key: '80_plus_titanium', label: '80 Plus Titanium' },
      { key: '80_plus_platinum', label: '80 Plus Platinum' },
      { key: '80_plus_gold', label: '80 Plus Gold' },
      { key: '80_plus_silver', label: '80 Plus Silver' },
      { key: '80_plus_bronze', label: '80 Plus Bronze' },
      { key: '80_plus', label: '80 Plus White' }
    ];

    let html = '<table class="psu-eff-table"><thead><tr><th>Efficiency Rating</th><th>Efficiency</th><th>Wall Draw</th><th>Heat Waste</th></tr></thead><tbody>';
    efficiencies.forEach(eff => {
      const rate = componentData.efficiency[eff.key];
      const wall = Math.round(baseTotal / rate);
      const waste = wall - baseTotal;
      const isActive = state.efficiency === eff.key;
      html += '<tr style="' + (isActive ? 'background:rgba(230,57,70,0.08);' : '') + '"><td>' + eff.label + '</td><td>' + Math.round(rate * 100) + '%</td><td>' + wall + 'W</td><td>' + waste + 'W</td></tr>';
    });
    html += '</tbody></table>';
    els.effTable.innerHTML = html;
  }

  /* ==========================================
     URL STATE
     ========================================== */
  function updateURL() {
    const params = new URLSearchParams();
    if (state.cpu) { params.set('cpuBrand', els.cpuBrand.value); params.set('cpu', state.cpu); }
    if (state.gpu) { params.set('gpuBrand', els.gpuBrand.value); params.set('gpu', state.gpu); }
    params.set('mobo', state.motherboard);
    params.set('ramType', state.ramType);
    params.set('ramSticks', state.ramSticks);
    params.set('ramRgb', state.ramRgb);
    params.set('nvme', state.nvmeCount);
    params.set('sata', state.sataSsdCount);
    params.set('hdd', state.hddCount);
    params.set('cooling', state.cooling);
    params.set('fanType', state.fanType);
    params.set('fanCount', state.fanCount);
    params.set('oc', state.overclocking);
    params.set('eff', state.efficiency);
    if (state.peripherals.rgbController) params.set('rgbCtrl', '1');
    if (state.peripherals.soundCard) params.set('sound', '1');
    if (state.peripherals.captureCard) params.set('capture', '1');
    if (state.peripherals.usbDevices) params.set('usb', '1');
    if (state.peripherals.fanController) params.set('fanCtrl', '1');
    if (state.peripherals.ledStrips > 0) params.set('led', state.peripherals.ledStrips);

    const newURL = window.location.pathname + '?' + params.toString();
    window.history.replaceState({}, '', newURL);
  }

  function loadStateFromURL() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('cpuBrand')) els.cpuBrand.value = params.get('cpuBrand');
    if (params.has('cpu')) state.cpu = params.get('cpu');
    if (params.has('gpuBrand')) els.gpuBrand.value = params.get('gpuBrand');
    if (params.has('gpu')) state.gpu = params.get('gpu');
    if (params.has('mobo')) { state.motherboard = params.get('mobo'); els.moboSelect.value = state.motherboard; }
    if (params.has('ramType')) { state.ramType = params.get('ramType'); els.ramType.value = state.ramType; }
    if (params.has('ramSticks')) { state.ramSticks = parseInt(params.get('ramSticks'), 10); els.ramSticksVal.textContent = state.ramSticks; }
    if (params.has('ramRgb')) { state.ramRgb = params.get('ramRgb') === 'true'; els.ramRgb.checked = state.ramRgb; }
    if (params.has('nvme')) { state.nvmeCount = parseInt(params.get('nvme'), 10); els.nvmeVal.textContent = state.nvmeCount; }
    if (params.has('sata')) { state.sataSsdCount = parseInt(params.get('sata'), 10); els.sataVal.textContent = state.sataSsdCount; }
    if (params.has('hdd')) { state.hddCount = parseInt(params.get('hdd'), 10); els.hddVal.textContent = state.hddCount; }
    if (params.has('cooling')) { state.cooling = params.get('cooling'); els.coolingSelect.value = state.cooling; }
    if (params.has('fanType')) { state.fanType = params.get('fanType'); els.fanType.value = state.fanType; }
    if (params.has('fanCount')) { state.fanCount = parseInt(params.get('fanCount'), 10); els.fanVal.textContent = state.fanCount; }
    if (params.has('oc')) { state.overclocking = params.get('oc') === 'true'; els.ocToggle.classList.toggle('active', state.overclocking); }
    if (params.has('eff')) { state.efficiency = params.get('eff'); els.effSelect.value = state.efficiency; }
    if (params.has('rgbCtrl')) { state.peripherals.rgbController = true; els.periphRgb.checked = true; }
    if (params.has('sound')) { state.peripherals.soundCard = true; els.periphSound.checked = true; }
    if (params.has('capture')) { state.peripherals.captureCard = true; els.periphCapture.checked = true; }
    if (params.has('usb')) { state.peripherals.usbDevices = true; els.periphUsb.checked = true; }
    if (params.has('fanCtrl')) { state.peripherals.fanController = true; els.periphFanCtrl.checked = true; }
    if (params.has('led')) { state.peripherals.ledStrips = parseInt(params.get('led'), 10); els.periphLedVal.textContent = state.peripherals.ledStrips; }
  }

  /* ==========================================
     ACTIONS
     ========================================== */
  async function copyResult() {
    const calc = calculate();
    if (!calc) return;

    const text = `REDRAG PSU Wattage Calculator Result
=====================================
Components: ${state.cpu || 'No CPU'} + ${state.gpu || 'No GPU'}
Overclocking: ${state.overclocking ? 'Yes' : 'No'}

Power Breakdown:
- CPU: ${calc.breakdown.cpu}W
- GPU: ${calc.breakdown.gpu}W
- Motherboard: ${calc.breakdown.motherboard}W
- RAM: ${calc.breakdown.ram}W
- Storage: ${calc.breakdown.storage}W
- Cooling: ${calc.breakdown.cooling}W
- Fans: ${calc.breakdown.fans}W
- Peripherals: ${calc.breakdown.peripherals}W

Recommended PSU: ${calc.recWatt}W (80 Plus ${state.efficiency.replace('80_plus_', '').toUpperCase()})
Future-Proof PSU: ${calc.futureWatt}W
ATX 3.1 Required: ${calc.gpuObj && calc.gpuObj.atx31 ? 'Yes' : 'No'}

Calculated via tools.redrag.in/psu-wattage-calculator/`;

    const success = await utils.copyToClipboard(text);
    if (success) {
      if (components.Toast) {
        components.Toast.show({ message: 'Full result copied to clipboard!', type: 'success', duration: 3000 });
      }
      if (RT.analytics) RT.analytics.trackTool('psu-wattage-calculator', 'copy');
    } else {
      if (components.Toast) {
        components.Toast.show({ message: 'Could not copy. Try manually.', type: 'error', duration: 4000 });
      }
    }
  }

  function resetTool() {
    state.cpu = '';
    state.gpu = '';
    state.motherboard = 'atx';
    state.ramType = 'ddr5';
    state.ramSticks = 2;
    state.ramRgb = false;
    state.nvmeCount = 1;
    state.sataSsdCount = 0;
    state.hddCount = 0;
    state.cooling = 'air_stock';
    state.fanType = 'standard_120mm';
    state.fanCount = 3;
    state.peripherals = { rgbController: false, soundCard: false, captureCard: false, usbDevices: false, fanController: false, ledStrips: 0 };
    state.overclocking = false;
    state.efficiency = '80_plus_gold';

    // Reset DOM
    els.cpuSelect.value = '';
    els.gpuSelect.value = '';
    els.moboSelect.value = 'atx';
    els.ramType.value = 'ddr5';
    els.ramSticksVal.textContent = '2';
    els.ramRgb.checked = false;
    els.nvmeVal.textContent = '1';
    els.sataVal.textContent = '0';
    els.hddVal.textContent = '0';
    els.coolingSelect.value = 'air_stock';
    els.fanType.value = 'standard_120mm';
    els.fanVal.textContent = '3';
    els.periphRgb.checked = false;
    els.periphSound.checked = false;
    els.periphCapture.checked = false;
    els.periphUsb.checked = false;
    els.periphFanCtrl.checked = false;
    els.periphLedVal.textContent = '0';
    els.ocToggle.classList.remove('active');
    els.effSelect.value = '80_plus_gold';

    updateUI();
    window.history.replaceState({}, '', window.location.pathname);

    if (components.Toast) {
      components.Toast.show({ message: 'All inputs reset', type: 'info', duration: 3000 });
    }
    if (RT.analytics) RT.analytics.trackTool('psu-wattage-calculator', 'reset');
  }

  async function shareURL() {
    const url = window.location.href;
    const success = await utils.copyToClipboard(url);
    if (success) {
      if (components.Toast) {
        components.Toast.show({ message: 'Shareable link copied!', type: 'success', duration: 3000 });
      }
      if (RT.analytics) RT.analytics.trackTool('psu-wattage-calculator', 'share');
    }
  }

  /* ==========================================
     FAQ
     ========================================== */
  function initFAQ() {
    const container = dom.$('#faq-container');
    if (!container || !components.FAQ) return;

    const items = [
      {
        question: 'How accurate is this PSU wattage calculator?',
        answer: '<p>This calculator uses manufacturer-reported TDP (Thermal Design Power) and TGP (Total Graphics Power) values as the baseline. It adds realistic power draw for motherboards, RAM, storage, cooling, and peripherals. A 10% transient spike buffer is included for high-end GPUs (300W+), as modern GPUs like the RTX 4090 and RTX 5090 can briefly spike above their rated TDP. For overclocking, we apply a 25% multiplier to CPU and 20% to GPU based on typical overclocking power increases. The result is conservative and safe for real-world builds.</p>'
      },
      {
        question: 'What PSU wattage do I need for RTX 5090 or RTX 5080?',
        answer: '<p>NVIDIA recommends a 1000W PSU for the RTX 5090 (575W TDP) and an 850W PSU for the RTX 5080 (360W TDP). However, these recommendations assume a high-end CPU. For a balanced build with a Core i7/Ryzen 7 or higher, our calculator suggests 1000W minimum for the RTX 5090 and 850W for the RTX 5080. If you plan to overclock or want headroom for future upgrades, consider 1200W for the RTX 5090 and 1000W for the RTX 5080. Always choose an ATX 3.1 / PCIe 5.1 compliant PSU with a native 12V-2x6 connector for these cards.</p>'
      },
      {
        question: 'Why do different PSU calculators show different wattages?',
        answer: '<p>Different calculators use different methodologies. Some only add CPU + GPU and estimate the rest, while others ask for every single component. Some apply aggressive safety margins, while others are more conservative. Brand-owned calculators (like Corsair or ASUS) may also round up to sell higher-wattage units. Our calculator strikes a balance: it accounts for all major components individually, applies a scientifically-backed 20% headroom for the recommended tier, and includes transient spike protection for modern GPUs — without inflating numbers to push products.</p>'
      },
      {
        question: 'What is ATX 3.1 and do I need it for my PSU?',
        answer: '<p>ATX 3.1 is the latest power supply standard designed to handle the extreme power spikes of modern GPUs, especially NVIDIA RTX 40 series and RTX 50 series cards. It introduces tighter voltage regulation, improved transient response, and the safer 12V-2x6 connector (an improved version of 12VHPWR). If you are building with an RTX 4090, RTX 5080, RTX 5090, or any GPU using a 16-pin power connector, an ATX 3.1 PSU is strongly recommended. For older or lower-power GPUs (RTX 4060, RX 7600, etc.), a standard high-quality PSU is sufficient.</p>'
      },
      {
        question: 'How does 80 Plus efficiency affect my electricity bill?',
        answer: '<p>80 Plus efficiency ratings indicate how effectively a PSU converts AC wall power into DC power for your PC. For example, an 80 Plus Gold PSU is ~87% efficient at 50% load, meaning 13% is lost as heat. A Titanium PSU is ~92% efficient, wasting only 8%. Over a year of gaming, the difference between Bronze and Gold can save ₹1,500–₹3,000+ on electricity in India. Higher efficiency also means less heat, quieter operation, and longer PSU lifespan. We recommend 80 Plus Gold as the minimum for any gaming build in 2026.</p>'
      },
      {
        question: 'Should I choose the Minimum, Recommended, or Future-Proof wattage?',
        answer: '<p><strong>Minimum</strong> is the bare minimum PSU wattage your build needs at full load, including transient spike protection. It works, but leaves no room for error or upgrades.<br><br><strong>Recommended</strong> (our default suggestion) adds a 20% headroom, which is the sweet spot for stable voltage regulation, PSU longevity, and minor future upgrades like adding storage or RAM.<br><br><strong>Future-Proof</strong> adds a 35% headroom and is ideal if you plan to overclock, upgrade to a more powerful GPU later, or want your PSU to last through 2-3 build generations. We recommend the Recommended tier for most users.</p>'
      },
      {
        question: 'What about power spikes and transient loads?',
        answer: '<p>Modern GPUs, especially NVIDIA RTX 30 series and newer, can experience brief power spikes (transients) that exceed their rated TDP by 2-3x for milliseconds. These spikes can trip overcurrent protection (OCP) on underpowered or low-quality PSUs, causing random shutdowns. Our calculator includes a 10% transient buffer for GPUs with 300W+ TDP to account for this. For maximum safety with high-end cards (RTX 4090, RTX 5090, RX 7900 XTX), choose a PSU rated well above your average load and ensure it has strong transient response — this is where ATX 3.1 certification matters most.</p>'
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
     BOOT
     ========================================== */
  dom.ready(() => {
    if (RT.shell && RT.shell.ready) {
      RT.shell.ready.then(init).catch(err => {
        console.error('[PSUCalc] Init failed:', err);
        if (components.Toast) {
          components.Toast.show({ message: 'Failed to initialize calculator. Please refresh.', type: 'error', duration: 5000 });
        }
      });
    } else {
      init();
    }
  });

})(window);
