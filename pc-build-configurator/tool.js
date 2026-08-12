/* ============================================
   PC Build Configurator - Core Logic
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
     DATA & STATE
     ========================================== */
  let pcData = null;

  const state = {
    mode: 'wizard', // 'wizard' or 'manual'
    budget: 1000,
    useCase: 'gaming',
    targetRes: '1080p',
    selectedBuild: null,
    manualBuild: {
      cpu: null,
      gpu: null,
      motherboard: null,
      ram: null,
      storage: null,
      psu: null,
      case: null,
      cooler: null
    },
    currentBuild: null // unified build object
  };

  /* ==========================================
     DOM ELEMENTS
     ========================================== */
  const els = {};

  function cacheDOM() {
    // Mode toggle
    els.modeWizard = dom.$('#mode-wizard');
    els.modeManual = dom.$('#mode-manual');
    els.wizardPanel = dom.$('#wizard-panel');
    els.manualPanel = dom.$('#manual-panel');

    // Wizard
    els.budgetSlider = dom.$('#budget-slider');
    els.budgetDisplay = dom.$('#budget-display');
    els.useCaseBtns = dom.$$('.use-case-btn');
    els.resBtns = dom.$$('.res-btn');
    els.btnGenerate = dom.$('#btn-generate');
    els.quickBuildsGrid = dom.$('#quick-builds-grid');

    // Manual selectors
    els.selCpu = dom.$('#sel-cpu');
    els.selGpu = dom.$('#sel-gpu');
    els.selMobo = dom.$('#sel-mobo');
    els.selRam = dom.$('#sel-ram');
    els.selStorage = dom.$('#sel-storage');
    els.selPsu = dom.$('#sel-psu');
    els.selCase = dom.$('#sel-case');
    els.selCooler = dom.$('#sel-cooler');

    // Badges
    els.badgeCpu = dom.$('#badge-cpu');
    els.badgeGpu = dom.$('#badge-gpu');
    els.badgeMobo = dom.$('#badge-mobo');
    els.badgeRam = dom.$('#badge-ram');
    els.badgePsu = dom.$('#badge-psu');
    els.badgeCase = dom.$('#badge-case');
    els.badgeCooler = dom.$('#badge-cooler');

    // Results
    els.totalPrice = dom.$('#total-price');
    els.buildName = dom.$('#build-name');
    els.systemWattage = dom.$('#system-wattage');
    els.psuHeadroom = dom.$('#psu-headroom');
    els.balanceScore = dom.$('#balance-score');
    els.fps1080p = dom.$('#fps-1080p');
    els.fps1440p = dom.$('#fps-1440p');
    els.fps4k = dom.$('#fps-4k');
    els.fpsBar1080p = dom.$('#fps-bar-1080p');
    els.fpsBar1440p = dom.$('#fps-bar-1440p');
    els.fpsBar4k = dom.$('#fps-bar-4k');
    els.compatStatus = dom.$('#compatibility-status');
    els.compatTitle = dom.$('#compat-title');
    els.compatMsg = dom.$('#compat-msg');
    els.partsList = dom.$('#parts-list');
    els.proTip = dom.$('#pro-tip');

    // Buttons
    els.btnCopy = dom.$('#btn-copy');
    els.btnShare = dom.$('#btn-share');
    els.btnReset = dom.$('#btn-reset');
  }

  /* ==========================================
     DATA LOADING
     ========================================== */
  async function loadData() {
    try {
      const response = await fetch('data.json?v=43');
      pcData = await response.json();
      populateManualSelectors();
      renderQuickBuilds();
      loadFromURL();
      loadFromStorage();
    } catch (err) {
      console.error('[RTTool] Failed to load data:', err);
      if (components.Toast) {
        components.Toast.show({ message: 'Failed to load component data. Please refresh.', type: 'error', duration: 5000 });
      }
    }
  }

  /* ==========================================
     MODE SWITCHING
     ========================================== */
  function switchMode(mode) {
    state.mode = mode;

    if (mode === 'wizard') {
      els.modeWizard.classList.add('active');
      els.modeManual.classList.remove('active');
      els.wizardPanel.classList.add('active');
      els.wizardPanel.style.display = 'block';
      els.manualPanel.classList.remove('active');
      els.manualPanel.style.display = 'none';
    } else {
      els.modeManual.classList.add('active');
      els.modeWizard.classList.remove('active');
      els.manualPanel.classList.add('active');
      els.manualPanel.style.display = 'block';
      els.wizardPanel.classList.remove('active');
      els.wizardPanel.style.display = 'none';
    }

    updateUI();
    analytics.trackTool('pc-build-configurator', 'mode_switch_' + mode);
  }

  /* ==========================================
     WIZARD LOGIC
     ========================================== */
  function renderQuickBuilds() {
    if (!pcData || !pcData.prebuilt_configs) return;

    const html = pcData.prebuilt_configs.map(config => {
      const resLabel = config.target_res === '1080p' ? '1080p' : config.target_res === '1440p' ? '1440p' : '4K';
      return `
        <div class="quick-build-card" data-config-id="${config.id}">
          <div class="quick-build-budget">$${config.budget.toLocaleString()}</div>
          <div class="quick-build-info">
            <div class="quick-build-name">${config.name}</div>
            <div class="quick-build-desc">${config.description}</div>
          </div>
          <div class="quick-build-res">${resLabel}</div>
        </div>
      `;
    }).join('');

    els.quickBuildsGrid.innerHTML = html;

    dom.$$('.quick-build-card').forEach(card => {
      card.addEventListener('click', () => {
        const configId = card.dataset.configId;
        selectPrebuiltConfig(configId);
        dom.$$('.quick-build-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      });
    });
  }

  function selectPrebuiltConfig(configId) {
    const config = pcData.prebuilt_configs.find(c => c.id === configId);
    if (!config) return;

    state.selectedBuild = configId;
    state.currentBuild = buildFromConfig(config);

    // Sync UI
    els.budgetSlider.value = config.budget;
    els.budgetDisplay.textContent = '$' + config.budget.toLocaleString();

    // Set use case
    els.useCaseBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.usecase === config.use_case);
    });
    state.useCase = config.use_case;

    // Set resolution
    els.resBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.res === config.target_res);
    });
    state.targetRes = config.target_res;

    updateUI();
    saveToStorage();

    if (components.Toast) {
      components.Toast.show({ message: config.name + ' loaded!', type: 'success', duration: 2000 });
    }
    analytics.trackTool('pc-build-configurator', 'select_prebuilt');
  }

  function generateBuild() {
    // Find closest prebuilt config
    let closest = pcData.prebuilt_configs[0];
    let minDiff = Math.abs(pcData.prebuilt_configs[0].budget - state.budget);

    for (const config of pcData.prebuilt_configs) {
      const diff = Math.abs(config.budget - state.budget);
      if (diff < minDiff && config.use_case === state.useCase) {
        minDiff = diff;
        closest = config;
      }
    }

    // Fallback to any closest if use_case match fails
    if (closest.use_case !== state.useCase) {
      for (const config of pcData.prebuilt_configs) {
        const diff = Math.abs(config.budget - state.budget);
        if (diff < minDiff) {
          minDiff = diff;
          closest = config;
        }
      }
    }

    state.selectedBuild = closest.id;
    state.currentBuild = buildFromConfig(closest);

    // Highlight in quick builds
    dom.$$('.quick-build-card').forEach(card => {
      card.classList.toggle('active', card.dataset.configId === closest.id);
    });

    updateUI();
    saveToStorage();

    if (components.Toast) {
      components.Toast.show({ message: 'Build generated: ' + closest.name, type: 'success', duration: 3000 });
    }
    analytics.trackTool('pc-build-configurator', 'generate_build');
  }

  function buildFromConfig(config) {
    const build = {
      name: config.name,
      components: {},
      totalPrice: 0,
      wattage: 0,
      estimated_fps: config.estimated_fps || { "1080p": 0, "1440p": 0, "4k": 0 }
    };

    const componentMap = {
      cpu: pcData.cpus,
      gpu: pcData.gpus,
      motherboard: pcData.motherboards,
      ram: pcData.ram,
      storage: pcData.storage,
      psu: pcData.psus,
      case: pcData.cases,
      cooler: pcData.coolers
    };

    for (const [key, id] of Object.entries(config.components)) {
      const list = componentMap[key];
      if (list) {
        const item = list.find(i => i.id === id);
        if (item) {
          build.components[key] = item;
          build.totalPrice += item.price || 0;
        }
      }
    }

    build.wattage = calculateWattage(build.components);
    return build;
  }

  /* ==========================================
     MANUAL BUILDER LOGIC
     ========================================== */
  function populateManualSelectors() {
    if (!pcData) return;

    populateSelect(els.selCpu, pcData.cpus, c => `${c.name} (${c.socket}, ${c.cores}c/${c.threads}t, ${c.tdp}W) - $${c.price}`);
    populateSelect(els.selGpu, pcData.gpus, g => `${g.name} (${g.vram}GB, ${g.tdp}W) - $${g.price}`);
    populateSelect(els.selMobo, pcData.motherboards, m => `${m.name} (${m.socket}, ${m.ddr_type}) - $${m.price}`);
    populateSelect(els.selRam, pcData.ram, r => `${r.capacity}GB ${r.type}-${r.speed} (${r.sticks}x) - $${r.price}`);
    populateSelect(els.selStorage, pcData.storage, s => `${s.capacity >= 1000 ? (s.capacity/1000) + 'TB' : s.capacity + 'GB'} ${s.type} - $${s.price}`);
    populateSelect(els.selPsu, pcData.psus, p => `${p.wattage}W ${p.efficiency} ${p.modular ? 'Modular' : 'Non-Modular'} - $${p.price}`);
    populateSelect(els.selCase, pcData.cases, c => `${c.name} (GPU ≤${c.max_gpu_length}mm) - $${c.price}`);
    populateSelect(els.selCooler, pcData.coolers, c => `${c.name} (TDP ≤${c.tdp_support}W) - $${c.price}`);
  }

  function populateSelect(selectEl, items, labelFn) {
    const currentVal = selectEl.value;
    selectEl.innerHTML = '<option value="">-- Select Component --</option>';
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = labelFn(item);
      selectEl.appendChild(opt);
    });
    selectEl.value = currentVal;
  }

  function updateManualBuild() {
    const find = (arr, id) => arr.find(i => i.id === id);

    state.manualBuild.cpu = find(pcData.cpus, els.selCpu.value);
    state.manualBuild.gpu = find(pcData.gpus, els.selGpu.value);
    state.manualBuild.motherboard = find(pcData.motherboards, els.selMobo.value);
    state.manualBuild.ram = find(pcData.ram, els.selRam.value);
    state.manualBuild.storage = find(pcData.storage, els.selStorage.value);
    state.manualBuild.psu = find(pcData.psus, els.selPsu.value);
    state.manualBuild.case = find(pcData.cases, els.selCase.value);
    state.manualBuild.cooler = find(pcData.coolers, els.selCooler.value);

    // Build current build from manual selections
    const hasSelection = Object.values(state.manualBuild).some(v => v !== null && v !== undefined);
    if (hasSelection) {
      state.currentBuild = {
        name: 'Custom Build',
        components: { ...state.manualBuild },
        totalPrice: 0,
        wattage: 0,
        estimated_fps: { "1080p": 0, "1440p": 0, "4k": 0 }
      };

      for (const item of Object.values(state.manualBuild)) {
        if (item && item.price) state.currentBuild.totalPrice += item.price;
      }

      state.currentBuild.wattage = calculateWattage(state.manualBuild);

      // Estimate FPS from GPU
      if (state.manualBuild.gpu) {
        state.currentBuild.estimated_fps = {
          "1080p": state.manualBuild.gpu.gaming_1080p || 0,
          "1440p": state.manualBuild.gpu.gaming_1440p || 0,
          "4k": state.manualBuild.gpu.gaming_4k || 0
        };
      }
    } else {
      state.currentBuild = null;
    }

    checkCompatibility();
    updateUI();
    saveToStorage();
  }

  function checkCompatibility() {
    const issues = [];
    const warnings = [];
    const { cpu, gpu, motherboard, ram, psu, case: pcCase, cooler } = state.manualBuild;

    // CPU-Motherboard socket check
    if (cpu && motherboard) {
      if (cpu.socket !== motherboard.socket) {
        issues.push(`CPU socket (${cpu.socket}) does not match motherboard socket (${motherboard.socket}).`);
      }
    }

    // RAM type check
    if (motherboard && ram) {
      if (motherboard.ddr_type !== ram.type) {
        issues.push(`Motherboard supports ${motherboard.ddr_type} but selected RAM is ${ram.type}.`);
      }
    }
    if (cpu && ram) {
      if (!cpu.ddr_type.includes(ram.type)) {
        issues.push(`CPU ${cpu.name} does not support ${ram.type} memory.`);
      }
    }

    // GPU clearance check
    if (gpu && pcCase) {
      if (gpu.length > pcCase.max_gpu_length) {
        issues.push(`GPU (${gpu.length}mm) exceeds case max GPU length (${pcCase.max_gpu_length}mm).`);
      }
    }

    // PSU wattage check
    if (cpu && gpu && psu) {
      const totalWattage = calculateWattage(state.manualBuild);
      const requiredWattage = totalWattage * 1.25;
      if (psu.wattage < requiredWattage) {
        issues.push(`PSU (${psu.wattage}W) is insufficient. Recommended: ${Math.ceil(requiredWattage)}W minimum.`);
      } else if (psu.wattage < totalWattage * 1.15) {
        warnings.push(`PSU headroom is tight. Consider a ${Math.ceil(totalWattage * 1.25)}W PSU for safety.`);
      }
    }

    // Cooler TDP check
    if (cpu && cooler) {
      if (cooler.tdp_support < cpu.tdp) {
        warnings.push(`Cooler TDP support (${cooler.tdp_support}W) is below CPU TDP (${cpu.tdp}W). Thermal throttling may occur.`);
      }
    }

    // Update badges
    updateBadge(els.badgeCpu, cpu && motherboard ? (cpu.socket === motherboard.socket ? 'ok' : 'error') : null, cpu && motherboard ? (cpu.socket === motherboard.socket ? 'Socket OK' : 'Socket Mismatch') : '');
    updateBadge(els.badgeMobo, motherboard && ram ? (motherboard.ddr_type === ram.type ? 'ok' : 'error') : null, motherboard && ram ? (motherboard.ddr_type === ram.type ? 'RAM OK' : 'RAM Mismatch') : '');
    updateBadge(els.badgeGpu, gpu && pcCase ? (gpu.length <= pcCase.max_gpu_length ? 'ok' : 'error') : null, gpu && pcCase ? (gpu.length <= pcCase.max_gpu_length ? 'Fits in case' : 'Too long for case') : '');
    updateBadge(els.badgePsu, psu && cpu && gpu ? (psu.wattage >= calculateWattage(state.manualBuild) * 1.25 ? 'ok' : 'error') : null, psu && cpu && gpu ? (psu.wattage >= calculateWattage(state.manualBuild) * 1.25 ? 'Wattage OK' : 'Insufficient Wattage') : '');
    updateBadge(els.badgeCooler, cooler && cpu ? (cooler.tdp_support >= cpu.tdp ? 'ok' : 'warn') : null, cooler && cpu ? (cooler.tdp_support >= cpu.tdp ? 'Cooling OK' : 'Cooler may be insufficient') : '');
    updateBadge(els.badgeRam, ram && cpu ? (cpu.ddr_type.includes(ram.type) ? 'ok' : 'error') : null, ram && cpu ? (cpu.ddr_type.includes(ram.type) ? 'Compatible' : 'Not Supported') : '');

    // Compatibility status panel
    if (issues.length > 0) {
      els.compatStatus.style.display = 'block';
      els.compatStatus.className = 'compatibility-status error';
      els.compatTitle.textContent = '❌ Compatibility Issues Found';
      els.compatMsg.innerHTML = issues.map(i => '• ' + i).join('<br>');
      if (warnings.length > 0) {
        els.compatMsg.innerHTML += '<br><br><strong>Warnings:</strong><br>' + warnings.map(w => '• ' + w).join('<br>');
      }
    } else if (warnings.length > 0) {
      els.compatStatus.style.display = 'block';
      els.compatStatus.className = 'compatibility-status warn';
      els.compatTitle.textContent = '⚠️ Warnings';
      els.compatMsg.innerHTML = warnings.map(w => '• ' + w).join('<br>');
    } else if (hasEnoughComponents()) {
      els.compatStatus.style.display = 'block';
      els.compatStatus.className = 'compatibility-status ok';
      els.compatTitle.textContent = '✅ All Clear';
      els.compatMsg.textContent = 'Your build looks good! All checked components are compatible.';
    } else {
      els.compatStatus.style.display = 'none';
    }
  }

  function updateBadge(el, status, text) {
    if (!status) {
      el.textContent = '';
      el.className = 'compatibility-badge';
      return;
    }
    el.textContent = text;
    el.className = 'compatibility-badge ' + status;
  }

  function hasEnoughComponents() {
    const b = state.manualBuild;
    return b.cpu && b.gpu && b.motherboard && b.ram && b.storage && b.psu && b.case;
  }

  /* ==========================================
     CALCULATIONS
     ========================================== */
  function calculateWattage(components) {
    let total = 0;
    if (components.cpu) total += components.cpu.tdp || 0;
    if (components.gpu) total += components.gpu.tdp || 0;
    // Motherboard + RAM + SSD + fans overhead
    total += 75;
    return total;
  }

  function calculateBalanceScore(build) {
    if (!build || !build.components) return null;
    const cpu = build.components.cpu;
    const gpu = build.components.gpu;
    if (!cpu || !gpu) return null;

    // Simple balance: compare gaming scores
    const cpuScore = cpu.gaming_score || 50;
    const gpuScore = gpu.gaming_1080p || 50;

    const ratio = Math.min(cpuScore, gpuScore) / Math.max(cpuScore, gpuScore);
    const score = Math.round(ratio * 100);

    if (score >= 85) return { score, label: 'Excellent', color: '#4ade80' };
    if (score >= 70) return { score, label: 'Good', color: '#fbbf24' };
    if (score >= 50) return { score, label: 'Fair', color: '#fb923c' };
    return { score, label: 'Poor', color: '#f87171' };
  }

  /* ==========================================
     UI UPDATES
     ========================================== */
  function updateUI() {
    const build = state.currentBuild;

    if (!build) {
      els.totalPrice.textContent = '$0';
      els.buildName.textContent = 'Select a build';
      els.systemWattage.textContent = '0W';
      els.psuHeadroom.textContent = '--';
      els.balanceScore.textContent = '--';
      els.fps1080p.textContent = '--';
      els.fps1440p.textContent = '--';
      els.fps4k.textContent = '--';
      els.fpsBar1080p.style.width = '0%';
      els.fpsBar1440p.style.width = '0%';
      els.fpsBar4k.style.width = '0%';
      els.partsList.innerHTML = '<p style="color:var(--rt-text-secondary); text-align:center; padding: var(--rt-space-6) 0;">Select a build or configure manually to see your parts list.</p>';
      return;
    }

    // Price
    els.totalPrice.textContent = '$' + build.totalPrice.toLocaleString();
    els.buildName.textContent = build.name || 'Custom Build';

    // Wattage
    els.systemWattage.textContent = build.wattage + 'W';

    // PSU Headroom
    if (build.components.psu) {
      const headroom = Math.round(((build.components.psu.wattage - build.wattage) / build.wattage) * 100);
      els.psuHeadroom.textContent = headroom + '%';
      els.psuHeadroom.style.color = headroom >= 25 ? '#4ade80' : headroom >= 15 ? '#fbbf24' : '#f87171';
    } else {
      els.psuHeadroom.textContent = '--';
      els.psuHeadroom.style.color = '';
    }

    // Balance Score
    const balance = calculateBalanceScore(build);
    if (balance) {
      els.balanceScore.textContent = balance.score + '% (' + balance.label + ')';
      els.balanceScore.style.color = balance.color;
    } else {
      els.balanceScore.textContent = '--';
      els.balanceScore.style.color = '';
    }

    // FPS
    const fps = build.estimated_fps || { "1080p": 0, "1440p": 0, "4k": 0 };
    els.fps1080p.textContent = fps["1080p"] ? fps["1080p"] + ' FPS' : '--';
    els.fps1440p.textContent = fps["1440p"] ? fps["1440p"] + ' FPS' : '--';
    els.fps4k.textContent = fps["4k"] ? fps["4k"] + ' FPS' : '--';

    els.fpsBar1080p.style.width = Math.min((fps["1080p"] / 300) * 100, 100) + '%';
    els.fpsBar1440p.style.width = Math.min((fps["1440p"] / 300) * 100, 100) + '%';
    els.fpsBar4k.style.width = Math.min((fps["4k"] / 300) * 100, 100) + '%';

    // Parts List
    renderPartsList(build);

    // Pro Tip
    updateProTip(build);
  }

  function renderPartsList(build) {
    const icons = {
      cpu: '🧠', gpu: '🎮', motherboard: '🔌', ram: '🧮',
      storage: '💾', psu: '⚡', case: '📦', cooler: '❄️'
    };

    const labels = {
      cpu: 'Processor', gpu: 'Graphics Card', motherboard: 'Motherboard', ram: 'Memory',
      storage: 'Storage', psu: 'Power Supply', case: 'PC Case', cooler: 'CPU Cooler'
    };

    let html = '';
    let hasParts = false;

    for (const [key, item] of Object.entries(build.components)) {
      if (!item) continue;
      hasParts = true;
      const spec = getItemSpec(item, key);
      html += `
        <div class="parts-list-item">
          <div class="part-icon">${icons[key] || '🔧'}</div>
          <div class="part-details">
            <div class="part-name">${item.name || labels[key]}</div>
            <div class="part-spec">${spec}</div>
          </div>
          <div class="part-price">$${item.price}</div>
        </div>
      `;
    }

    if (!hasParts) {
      html = '<p style="color:var(--rt-text-secondary); text-align:center; padding: var(--rt-space-6) 0;">No components selected yet.</p>';
    }

    els.partsList.innerHTML = html;
  }

  function getItemSpec(item, type) {
    switch (type) {
      case 'cpu': return `${item.cores}c/${item.threads}t, ${item.tdp}W TDP`;
      case 'gpu': return `${item.vram}GB VRAM, ${item.tdp}W TDP`;
      case 'motherboard': return `${item.socket}, ${item.chipset}, ${item.ddr_type}`;
      case 'ram': return `${item.capacity}GB ${item.type}-${item.speed}`;
      case 'storage': return `${item.capacity >= 1000 ? (item.capacity/1000)+'TB' : item.capacity+'GB'} ${item.type}`;
      case 'psu': return `${item.wattage}W ${item.efficiency}`;
      case 'case': return `GPU ≤${item.max_gpu_length}mm`;
      case 'cooler': return `Up to ${item.tdp_support}W TDP`;
      default: return '';
    }
  }

  function updateProTip(build) {
    if (!build || !build.components) return;

    const tips = [];
    const { cpu, gpu, psu, cooler } = build.components;

    if (cpu && cpu.tdp > 125 && (!cooler || cooler.tdp_support < cpu.tdp)) {
      tips.push('Your CPU runs hot. Consider upgrading to a 240mm or 360mm AIO liquid cooler for better temperatures.');
    }
    if (gpu && gpu.tier === 'enthusiast' && psu && psu.wattage < 1000) {
      tips.push('High-end GPUs like the RTX 5090 need robust power delivery. Ensure your PSU has a native 12V-2x6 cable.');
    }
    if (build.totalPrice > 0 && build.totalPrice < 1000) {
      tips.push('Budget builds benefit greatly from fast RAM and an NVMe SSD. These upgrades feel more noticeable than a faster CPU.');
    }
    if (gpu && gpu.vram <= 8) {
      tips.push('8GB VRAM is becoming limiting in 2026. Consider a 12GB or 16GB card for future-proofing.');
    }

    if (tips.length > 0) {
      els.proTip.textContent = tips[0];
    } else {
      els.proTip.textContent = 'Great build! All components are well-balanced. Consider adding extra case fans for better airflow.';
    }
  }

  /* ==========================================
     ACTIONS
     ========================================== */
  function copyBuildList() {
    if (!state.currentBuild) {
      if (components.Toast) components.Toast.show({ message: 'No build to copy yet!', type: 'error', duration: 3000 });
      return;
    }

    const icons = { cpu: '🧠', gpu: '🎮', motherboard: '🔌', ram: '🧮', storage: '💾', psu: '⚡', case: '📦', cooler: '❄️' };
    const labels = { cpu: 'Processor', gpu: 'Graphics Card', motherboard: 'Motherboard', ram: 'Memory', storage: 'Storage', psu: 'Power Supply', case: 'PC Case', cooler: 'CPU Cooler' };

    let text = '🖥️ ' + (state.currentBuild.name || 'Custom PC Build') + ' by REDRAG\n';
    text += '💰 Estimated Total: $' + state.currentBuild.totalPrice.toLocaleString() + '\n';
    text += '⚡ System Wattage: ' + state.currentBuild.wattage + 'W\n';
    text += '\n';

    for (const [key, item] of Object.entries(state.currentBuild.components)) {
      if (item) {
        text += `${icons[key]} ${labels[key]}: ${item.name || labels[key]} ($${item.price})\n`;
      }
    }

    text += '\n🔗 Built with tools.redrag.in/pc-build-configurator/';

    utils.copyToClipboard(text).then(success => {
      if (success && components.Toast) {
        components.Toast.show({ message: 'Build list copied to clipboard!', type: 'success', duration: 3000 });
      }
      analytics.trackTool('pc-build-configurator', 'copy_build');
    });
  }

  function shareBuild() {
    if (!state.currentBuild) {
      if (components.Toast) components.Toast.show({ message: 'No build to share yet!', type: 'error', duration: 3000 });
      return;
    }

    const params = new URLSearchParams();
    if (state.mode === 'wizard' && state.selectedBuild) {
      params.set('build', state.selectedBuild);
    } else {
      for (const [key, item] of Object.entries(state.manualBuild)) {
        if (item) params.set(key, item.id);
      }
    }
    params.set('mode', state.mode);

    const url = window.location.origin + window.location.pathname + '?' + params.toString();

    utils.copyToClipboard(url).then(success => {
      if (success && components.Toast) {
        components.Toast.show({ message: 'Build URL copied! Share it anywhere.', type: 'success', duration: 4000 });
      }
      analytics.trackTool('pc-build-configurator', 'share_build');
    });
  }

  function resetBuild() {
    state.selectedBuild = null;
    state.currentBuild = null;
    state.manualBuild = { cpu: null, gpu: null, motherboard: null, ram: null, storage: null, psu: null, case: null, cooler: null };

    // Reset selectors
    els.selCpu.value = '';
    els.selGpu.value = '';
    els.selMobo.value = '';
    els.selRam.value = '';
    els.selStorage.value = '';
    els.selPsu.value = '';
    els.selCase.value = '';
    els.selCooler.value = '';

    // Reset badges
    [els.badgeCpu, els.badgeGpu, els.badgeMobo, els.badgeRam, els.badgePsu, els.badgeCase, els.badgeCooler].forEach(el => {
      el.textContent = '';
      el.className = 'compatibility-badge';
    });

    els.compatStatus.style.display = 'none';
    dom.$$('.quick-build-card').forEach(c => c.classList.remove('active'));

    updateUI();
    saveToStorage();

    if (components.Toast) {
      components.Toast.show({ message: 'Build reset. Start fresh!', type: 'info', duration: 3000 });
    }
    analytics.trackTool('pc-build-configurator', 'reset');
  }

  /* ==========================================
     STORAGE & URL
     ========================================== */
  function saveToStorage() {
    try {
      localStorage.setItem('rt_pcbuild_state', JSON.stringify({
        mode: state.mode,
        budget: state.budget,
        useCase: state.useCase,
        targetRes: state.targetRes,
        selectedBuild: state.selectedBuild,
        manualBuildIds: {
          cpu: els.selCpu.value,
          gpu: els.selGpu.value,
          motherboard: els.selMobo.value,
          ram: els.selRam.value,
          storage: els.selStorage.value,
          psu: els.selPsu.value,
          case: els.selCase.value,
          cooler: els.selCooler.value
        }
      }));
    } catch (e) {
      // localStorage may be unavailable
    }
  }

  function loadFromStorage() {
    try {
      const saved = localStorage.getItem('rt_pcbuild_state');
      if (!saved) return;

      const data = JSON.parse(saved);
      if (data.mode) switchMode(data.mode);
      if (data.budget) {
        state.budget = data.budget;
        els.budgetSlider.value = data.budget;
        els.budgetDisplay.textContent = '$' + data.budget.toLocaleString();
      }
      if (data.useCase) {
        state.useCase = data.useCase;
        els.useCaseBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.usecase === data.useCase));
      }
      if (data.targetRes) {
        state.targetRes = data.targetRes;
        els.resBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.res === data.targetRes));
      }
      if (data.selectedBuild) {
        selectPrebuiltConfig(data.selectedBuild);
      }
      if (data.manualBuildIds) {
        const ids = data.manualBuildIds;
        if (ids.cpu) els.selCpu.value = ids.cpu;
        if (ids.gpu) els.selGpu.value = ids.gpu;
        if (ids.motherboard) els.selMobo.value = ids.motherboard;
        if (ids.ram) els.selRam.value = ids.ram;
        if (ids.storage) els.selStorage.value = ids.storage;
        if (ids.psu) els.selPsu.value = ids.psu;
        if (ids.case) els.selCase.value = ids.case;
        if (ids.cooler) els.selCooler.value = ids.cooler;
        updateManualBuild();
      }
    } catch (e) {
      // Ignore storage errors
    }
  }

  function loadFromURL() {
    const params = new URLSearchParams(window.location.search);
    if (params.size === 0) return;

    const mode = params.get('mode');
    if (mode) switchMode(mode);

    const buildId = params.get('build');
    if (buildId) {
      selectPrebuiltConfig(buildId);
      return;
    }

    // Manual build from URL
    const keys = ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooler'];
    let hasAny = false;
    keys.forEach(key => {
      const val = params.get(key);
      if (val) {
        hasAny = true;
        const sel = dom.$('#sel-' + key);
        if (sel) sel.value = val;
      }
    });

    if (hasAny) {
      updateManualBuild();
      if (components.Toast) {
        components.Toast.show({ message: 'Build loaded from URL!', type: 'success', duration: 3000 });
      }
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
        question: 'Is this PC Build Configurator free to use?',
        answer: '<p>Yes, the REDRAG PC Build Configurator is completely free to use. It runs entirely in your browser with no sign-up required. We do not collect any personal data.</p>'
      },
      {
        question: 'How accurate are the compatibility checks?',
        answer: '<p>Our compatibility checker validates the most critical aspects: CPU socket matching, RAM type compatibility, GPU physical clearance in the case, PSU wattage headroom, and cooler TDP capacity. However, some edge cases like RAM height clearance with large CPU coolers, or specific VRM heatsink interference, cannot be checked automatically and should be verified manually.</p>'
      },
      {
        question: 'Can I buy the parts directly through this tool?',
        answer: '<p>No, this tool does not link to retailers or include real-time pricing. It provides estimated MSRP values for budgeting purposes. We recommend checking prices on Amazon, Newegg, or your local PC hardware store before purchasing.</p>'
      },
      {
        question: 'What is PSU headroom and why does it matter?',
        answer: '<p>PSU headroom is the extra wattage capacity your power supply has above what your system actually needs. We recommend at least 25% headroom because modern GPUs can draw brief power spikes (transient loads) well above their rated TDP. Adequate headroom also improves PSU efficiency, reduces fan noise, and leaves room for future upgrades.</p>'
      },
      {
        question: 'Should I build a PC or buy a prebuilt in 2026?',
        answer: '<p>Building your own PC typically offers better value, component choice, and upgradeability compared to prebuilt systems. You avoid paying for proprietary parts, unnecessary bloatware, and inflated labor costs. However, prebuilts can be a good option during GPU shortages or if you need immediate support and warranty coverage from a single vendor.</p>'
      },
      {
        question: 'Is DDR5 worth it over DDR4 in 2026?',
        answer: '<p>For new builds on AM5 or LGA1851 platforms, DDR5 is the only option and offers meaningful performance gains in memory-bandwidth-sensitive tasks. On LGA1700, DDR5-6000 provides a small gaming advantage over DDR4-3600, but the difference is usually 5-10% at most. For budget AM4 builds, DDR4 remains excellent value.</p>'
      },
      {
        question: 'How do I know if my CPU and GPU are balanced?',
        answer: '<p>A balanced build means neither the CPU nor GPU is significantly holding back the other. At 1080p, the CPU matters more. At 4K, the GPU is almost always the bottleneck. Our Balance Score helps identify mismatches — aim for 80% or higher. If you mainly game at 1440p or 4K, it is okay to have a slightly slower CPU relative to your GPU.</p>'
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
     EVENT LISTENERS
     ========================================== */
  function bindEvents() {
    // Mode toggle
    els.modeWizard.addEventListener('click', () => switchMode('wizard'));
    els.modeManual.addEventListener('click', () => switchMode('manual'));

    // Budget slider
    els.budgetSlider.addEventListener('input', (e) => {
      state.budget = parseInt(e.target.value);
      els.budgetDisplay.textContent = '$' + state.budget.toLocaleString();
    });

    // Use case buttons
    els.useCaseBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        els.useCaseBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.useCase = btn.dataset.usecase;
      });
    });

    // Resolution buttons
    els.resBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        els.resBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.targetRes = btn.dataset.res;
      });
    });

    // Generate button
    els.btnGenerate.addEventListener('click', generateBuild);

    // Manual selectors
    [els.selCpu, els.selGpu, els.selMobo, els.selRam, els.selStorage, els.selPsu, els.selCase, els.selCooler].forEach(sel => {
      sel.addEventListener('change', updateManualBuild);
    });

    // Action buttons
    els.btnCopy.addEventListener('click', copyBuildList);
    els.btnShare.addEventListener('click', shareBuild);
    els.btnReset.addEventListener('click', resetBuild);
  }

  /* ==========================================
     INITIALIZATION
     ========================================== */
  async function init() {
    cacheDOM();
    bindEvents();
    await loadData();
    initFAQ();
    updateUI();

    analytics.trackTool('pc-build-configurator', 'load');
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
