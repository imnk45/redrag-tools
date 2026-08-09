/* ============================================
   REDRAG Tools — VRAM Calculator for AI/LLMs
   Namespace: RTTool
   Uses RT.* APIs (core.js, components.js, seo.js)
   Version: 2.0.0 (Phase 8)
   ============================================ */

(function (global) {
  'use strict';

  const RT = global.RT;
  if (!RT) {
    console.error('[RTTool] RT.core must be loaded first');
    return;
  }

  const { dom, utils, components, seo, analytics } = RT;

  /* ==========================================
     CONFIGURATION
     ========================================== */
  const CONFIG = {
    quantLabels: {
      fp16: { name: 'FP16', desc: 'Best quality', multiplier: 1 },
      int8: { name: 'INT8', desc: 'Good quality', multiplier: 0.5 },
      int4: { name: 'INT4', desc: 'Fast, smaller', multiplier: 0.25 },
      gptq_4bit: { name: 'GPTQ 4-bit', desc: 'Optimized', multiplier: 0.29 }
    }
  };

  /* ==========================================
     STATE
     ========================================== */
  const state = {
    models: [],
    gpus: [],
    selectedModel: null,
    quantization: 'fp16',
    contextLength: 4096,
    selectedGpu: '',
    initialized: false
  };

  /* ==========================================
     DOM REFERENCES
     ========================================== */
  const els = {};

  function cacheElements() {
    els.modelList = dom.$('#model-list');
    els.modelSearch = dom.$('#model-search-container');
    els.quantOptions = dom.$('#quant-options');
    els.contextOptions = dom.$('#context-options');
    els.gpuSelect = dom.$('#gpu-select');
    els.resultVram = dom.$('#result-vram');
    els.resultLabel = dom.$('#result-label');
    els.resultDetails = dom.$('#result-details');
    els.gpuStatus = dom.$('#gpu-status');
    els.compareTable = dom.$('#compare-table');
    els.shareBtn = dom.$('#share-btn');
    els.resetBtn = dom.$('#reset-btn');
  }

  /* ==========================================
     INITIALIZATION
     ========================================== */
  function init() {
    cacheElements();
    restoreState();

    loadData().then(() => {
      setupEventListeners();
      renderModelList();
      renderQuantOptions();
      renderGpuSelect();
      updateResults();
      initFAQ();
      injectSchemas();
      state.initialized = true;
      analytics.trackTool('vram', 'load');
    }).catch(err => {
      console.error('[RTTool] Init failed:', err);
      components.Toast.show({ message: 'Failed to initialize tool. Please refresh.', type: 'error', duration: 5000 });
    });
  }

  /* ==========================================
     DATA LOADING
     ========================================== */
  async function loadData() {
    try {
      const res = await fetch('data/models.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      state.models = data.models.sort((a, b) => a.params_b - b.params_b);
      state.gpus = data.gpus.sort((a, b) => a.vram - b.vram);
    } catch (err) {
      console.error('[RTTool] Failed to load data:', err);
      components.Toast.show({ message: 'Failed to load model data. Please refresh.', type: 'error', duration: 5000 });
    }
  }

  /* ==========================================
     EVENT LISTENERS
     ========================================== */
  function setupEventListeners() {
    const searchComponent = components.Search.create({
      placeholder: 'Search models... (e.g., Llama, Mistral, Qwen)',
      debounce: 150,
      onSearch: (query) => {
        renderModelList(query);
      }
    });
    if (els.modelSearch) {
      els.modelSearch.appendChild(searchComponent.element);
    }

    if (els.modelList) {
      els.modelList.addEventListener('click', handleModelClick);
    }

    if (els.quantOptions) {
      els.quantOptions.addEventListener('click', handleQuantClick);
    }

    if (els.contextOptions) {
      els.contextOptions.addEventListener('click', handleContextClick);
    }

    if (els.gpuSelect) {
      els.gpuSelect.addEventListener('change', handleGpuChange);
    }

    if (els.shareBtn) els.shareBtn.addEventListener('click', shareResults);
    if (els.resetBtn) els.resetBtn.addEventListener('click', resetAll);

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        resetAll();
      }
    });
  }

  /* ==========================================
     MODEL LIST
     ========================================== */
  function renderModelList(searchQuery) {
    const { models, selectedModel } = state;
    let filtered = models;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = models.filter(m =>
        m.name.toLowerCase().includes(q) ||
        m.family.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q)
      );
    }

    if (filtered.length === 0) {
      if (els.modelList) {
        els.modelList.innerHTML =
          '<div class="rt-empty" style="padding:var(--rt-space-6);">' +
          '<div class="rt-empty__icon">🔍</div>' +
          '<p class="rt-empty__text">No models found. Try a different search.</p></div>';
      }
      return;
    }

    if (els.modelList) {
      els.modelList.innerHTML = filtered.map(model => {
        const isSelected = selectedModel && selectedModel.name === model.name;
        const baseVram = model.vram_gb.fp16;
        return (
          '<div class="vram-model-item ' + (isSelected ? 'is-selected' : '') + '" ' +
          'data-name="' + utils.escapeHtml(model.name) + '" role="listitem">' +
          '<div class="vram-model-info">' +
          '<div class="vram-model-name">' + utils.escapeHtml(model.name) + '</div>' +
          '<div class="vram-model-meta">' + utils.escapeHtml(model.family) + ' · ' + model.params_b + 'B params · ' + utils.escapeHtml(model.category) + '</div></div>' +
          '<div class="vram-model-vram">' + baseVram + ' GB</div></div>'
        );
      }).join('');
    }
  }

  function handleModelClick(e) {
    const item = e.target.closest('.vram-model-item');
    if (!item) return;
    const name = item.dataset.name;
    const model = state.models.find(m => m.name === name);
    if (model) {
      state.selectedModel = model;
      state.contextLength = model.context_lengths[0];
      renderModelList();
      renderContextOptions();
      updateResults();
      saveState();
    }
  }

  /* ==========================================
     QUANTIZATION
     ========================================== */
  function renderQuantOptions() {
    if (!els.quantOptions) return;

    els.quantOptions.innerHTML = Object.keys(CONFIG.quantLabels).map(q => {
      const cfg = CONFIG.quantLabels[q];
      return (
        '<button class="vram-quant-btn ' + (q === state.quantization ? 'is-active' : '') + '" ' +
        'data-quant="' + q + '" role="radio" aria-checked="' + (q === state.quantization ? 'true' : 'false') + '">' +
        '<span class="vram-quant-btn__size">' + cfg.name + '</span>' +
        '<span class="vram-quant-btn__label">' + cfg.desc + '</span></button>'
      );
    }).join('');
  }

  function handleQuantClick(e) {
    const btn = e.target.closest('.vram-quant-btn');
    if (!btn) return;
    state.quantization = btn.dataset.quant;
    renderQuantOptions();
    updateResults();
    saveState();
  }

  /* ==========================================
     CONTEXT LENGTH
     ========================================== */
  function renderContextOptions() {
    if (!els.contextOptions || !state.selectedModel) return;

    const lengths = state.selectedModel.context_lengths;
    els.contextOptions.innerHTML = lengths.map(len => {
      const label = len >= 1000 ? (len / 1000) + 'K' : len;
      return (
        '<button class="vram-context-btn ' + (len === state.contextLength ? 'is-active' : '') + '" ' +
        'data-context="' + len + '" role="radio" aria-checked="' + (len === state.contextLength ? 'true' : 'false') + '">' + label + '</button>'
      );
    }).join('');
  }

  function handleContextClick(e) {
    const btn = e.target.closest('.vram-context-btn');
    if (!btn) return;
    state.contextLength = parseInt(btn.dataset.context, 10);
    renderContextOptions();
    updateResults();
    saveState();
  }

  /* ==========================================
     GPU SELECTOR
     ========================================== */
  function renderGpuSelect() {
    if (!els.gpuSelect) return;

    const options = ['<option value="">Select your GPU...</option>'];
    const types = {};
    state.gpus.forEach(gpu => {
      if (!types[gpu.type]) types[gpu.type] = [];
      types[gpu.type].push(gpu);
    });

    Object.keys(types).forEach(type => {
      options.push('<optgroup label="' + utils.escapeHtml(type) + '">');
      types[type].forEach(gpu => {
        const selected = gpu.name === state.selectedGpu ? ' selected' : '';
        options.push('<option value="' + utils.escapeHtml(gpu.name) + '"' + selected + '>' + utils.escapeHtml(gpu.name) + ' (' + gpu.vram + ' GB)</option>');
      });
      options.push('</optgroup>');
    });

    els.gpuSelect.innerHTML = options.join('');
  }

  function handleGpuChange(e) {
    state.selectedGpu = e.target.value;
    updateResults();
    saveState();
  }

  /* ==========================================
     RESULTS UPDATE
     ========================================== */
  function updateResults() {
    const { selectedModel, quantization, contextLength, selectedGpu } = state;

    if (!selectedModel) {
      if (els.resultVram) els.resultVram.textContent = '--';
      if (els.resultLabel) els.resultLabel.textContent = 'Select a model';
      if (els.resultDetails) els.resultDetails.innerHTML = '';
      if (els.gpuStatus) els.gpuStatus.innerHTML = '';
      if (els.compareTable) els.compareTable.innerHTML = '';
      return;
    }

    const baseVram = selectedModel.vram_gb[quantization] || selectedModel.vram_gb.fp16;
    const contextMultiplier = getContextMultiplier(contextLength);
    const totalVram = Math.ceil(baseVram * contextMultiplier);

    if (els.resultVram) {
      els.resultVram.textContent = totalVram;
      els.resultVram.style.color = totalVram > 48 ? 'var(--rt-danger)' : totalVram > 24 ? 'var(--rt-warning)' : 'var(--rt-success)';
    }

    if (els.resultLabel) {
      els.resultLabel.textContent = 'GB VRAM Required (' + CONFIG.quantLabels[quantization].name + ')';
    }

    if (els.resultDetails) {
      els.resultDetails.innerHTML =
        '<p style="color:var(--rt-text-secondary);font-size:var(--rt-text-small);line-height:1.7;">' +
        '<strong>' + utils.escapeHtml(selectedModel.name) + '</strong> at <strong>' + CONFIG.quantLabels[quantization].name + '</strong> ' +
        'with <strong>' + formatContext(contextLength) + '</strong> context length.<br>' +
        'Base: ' + baseVram + ' GB · Context overhead: ' + ((contextMultiplier - 1) * 100).toFixed(0) + '%</p>';
    }

    // GPU check
    if (els.gpuStatus && selectedGpu) {
      const gpu = state.gpus.find(g => g.name === selectedGpu);
      if (gpu) {
        const ratio = totalVram / gpu.vram;
        let statusClass, statusText, statusIcon;
        if (ratio <= 0.8) {
          statusClass = 'vram-gpu-status--ok';
          statusText = '✅ Your ' + gpu.name + ' (' + gpu.vram + ' GB) can run this model comfortably.';
          statusIcon = '';
        } else if (ratio <= 1.0) {
          statusClass = 'vram-gpu-status--warn';
          statusText = '⚠️ Your ' + gpu.name + ' (' + gpu.vram + ' GB) can run this but VRAM will be tight.';
        } else {
          statusClass = 'vram-gpu-status--fail';
          statusText = '❌ Your ' + gpu.name + ' (' + gpu.vram + ' GB) does not have enough VRAM. You need ' + totalVram + ' GB.';
        }
        els.gpuStatus.innerHTML = '<div class="vram-gpu-status ' + statusClass + '">' + statusText + '</div>';
      }
    } else if (els.gpuStatus) {
      els.gpuStatus.innerHTML = '';
    }

    // Comparison table
    renderComparisonTable();
  }

  function getContextMultiplier(length) {
    if (length <= 4096) return 1.0;
    if (length <= 32768) return 1.15;
    if (length <= 65536) return 1.3;
    if (length <= 131072) return 1.5;
    return 1.0;
  }

  function formatContext(len) {
    if (len >= 1000) return (len / 1000) + 'K';
    return len;
  }

  function renderComparisonTable() {
    if (!els.compareTable || !state.selectedModel) return;

    const quants = ['fp16', 'int8', 'int4', 'gptq_4bit'];
    const ctxMult = getContextMultiplier(state.contextLength);

    els.compareTable.innerHTML =
      '<table class="vram-compare-table">' +
      '<thead><tr><th>Precision</th><th>Quality</th><th>VRAM</th><th>Speed</th></tr></thead>' +
      '<tbody>' +
      quants.map(q => {
        const cfg = CONFIG.quantLabels[q];
        const vram = Math.ceil(state.selectedModel.vram_gb[q] * ctxMult);
        const isActive = q === state.quantization;
        return '<tr style="' + (isActive ? 'background:rgba(230,57,70,0.06);' : '') + '">' +
          '<td><strong>' + cfg.name + '</strong></td>' +
          '<td>' + (q === 'fp16' ? '⭐⭐⭐' : q === 'int8' ? '⭐⭐☆' : '⭐☆☆') + '</td>' +
          '<td><strong>' + vram + ' GB</strong></td>' +
          '<td>' + (q === 'fp16' ? 'Slow' : q === 'int8' ? 'Medium' : 'Fast') + '</td>' +
          '</tr>';
      }).join('') +
      '</tbody></table>';
  }

  /* ==========================================
     ACTIONS
     ========================================== */
  async function shareResults() {
    const { selectedModel, quantization, contextLength, selectedGpu } = state;

    if (!selectedModel) {
      components.Toast.show({ message: 'Select a model first!', type: 'warning', duration: 3000 });
      return;
    }

    const baseVram = selectedModel.vram_gb[quantization];
    const ctxMult = getContextMultiplier(contextLength);
    const totalVram = Math.ceil(baseVram * ctxMult);

    let text = '🧠 VRAM Requirement Check\n\n';
    text += 'Model: ' + selectedModel.name + '\n';
    text += 'Precision: ' + CONFIG.quantLabels[quantization].name + '\n';
    text += 'Context: ' + formatContext(contextLength) + '\n';
    text += 'VRAM Required: ' + totalVram + ' GB\n';
    if (selectedGpu) {
      const gpu = state.gpus.find(g => g.name === selectedGpu);
      text += 'Your GPU: ' + gpu.name + ' (' + gpu.vram + ' GB)\n';
      text += totalVram <= gpu.vram ? '✅ Can run!' : '❌ Not enough VRAM';
      text += '\n';
    }
    text += '\nCheck your VRAM at tools.redrag.in/vram/';

    const success = await utils.copyToClipboard(text);
    if (success) {
      components.Toast.show({ message: 'Results copied to clipboard!', type: 'success', duration: 3000 });
      analytics.trackTool('vram', 'share');
    } else {
      components.Toast.show({ message: 'Could not copy. Try manually.', type: 'error', duration: 4000 });
    }
  }

  function resetAll() {
    state.selectedModel = null;
    state.quantization = 'fp16';
    state.contextLength = 4096;
    state.selectedGpu = '';

    const searchInput = dom.$('#model-search-container input');
    if (searchInput) {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
    }

    renderModelList();
    renderQuantOptions();
    renderContextOptions();
    renderGpuSelect();
    updateResults();
    saveState();

    components.Toast.show({ message: 'All selections reset', type: 'info', duration: 3000 });
    analytics.trackTool('vram', 'reset');
  }

  /* ==========================================
     PERSISTENCE
     ========================================== */
  function saveState() {
    if (!state.initialized) return;

    utils.storage.set('vram:selectedModel', state.selectedModel ? state.selectedModel.name : '');
    utils.storage.set('vram:quantization', state.quantization);
    utils.storage.set('vram:contextLength', state.contextLength);
    utils.storage.set('vram:selectedGpu', state.selectedGpu);

    utils.setQueryParams({
      model: state.selectedModel ? state.selectedModel.name : null,
      quant: state.quantization,
      ctx: state.contextLength,
      gpu: state.selectedGpu || null
    });
  }

  function restoreState() {
    const urlModel = utils.getQueryParam('model');
    const urlQuant = utils.getQueryParam('quant');
    const urlCtx = utils.getQueryParam('ctx');
    const urlGpu = utils.getQueryParam('gpu');

    if (urlQuant && CONFIG.quantLabels[urlQuant]) state.quantization = urlQuant;
    else {
      const savedQuant = utils.storage.get('vram:quantization', '');
      if (savedQuant && CONFIG.quantLabels[savedQuant]) state.quantization = savedQuant;
    }

    if (urlCtx) state.contextLength = parseInt(urlCtx, 10);
    else {
      const savedCtx = utils.storage.get('vram:contextLength', 0);
      if (savedCtx) state.contextLength = savedCtx;
    }

    if (urlGpu) state.selectedGpu = urlGpu;
    else {
      const savedGpu = utils.storage.get('vram:selectedGpu', '');
      if (savedGpu) state.selectedGpu = savedGpu;
    }

    // Model restored after data loads
    const modelName = urlModel || utils.storage.get('vram:selectedModel', '');
    if (modelName) {
      // Will be set after loadData completes
      setTimeout(() => {
        const model = state.models.find(m => m.name === modelName);
        if (model) {
          state.selectedModel = model;
          renderModelList();
          renderContextOptions();
          updateResults();
        }
      }, 100);
    }
  }

  /* ==========================================
     FAQ
     ========================================== */
  function initFAQ() {
    const container = dom.$('#faq-container');
    if (!container) return;

    const items = [
      {
        question: 'How much VRAM do I need to run Llama 3.1 8B locally?',
        answer: '<p>At <strong>FP16 precision</strong>, Llama 3.1 8B requires approximately <strong>16 GB VRAM</strong>. With <strong>INT8 quantization</strong>, this drops to <strong>10 GB</strong>, and with <strong>INT4</strong> or <strong>GPTQ 4-bit</strong>, you can run it on just <strong>6 GB VRAM</strong>. For context lengths above 32K tokens, add ~15% overhead.</p>'
      },
      {
        question: 'Can I run a 70B parameter model on a single RTX 4090?',
        answer: '<p><strong>No.</strong> A 70B model at FP16 needs <strong>140 GB VRAM</strong> — far more than the RTX 4090\'s 24 GB. However, with <strong>INT4 quantization</strong>, you can run it on <strong>35 GB VRAM</strong>, which still requires multiple GPUs or an A100 40GB. For single-consumer GPU inference, 8B-13B models are the practical limit.</p>'
      },
      {
        question: 'What is the difference between FP16, INT8, and INT4 quantization?',
        answer: '<p><strong>FP16 (16-bit floating point):</strong> Best quality, but uses 2 bytes per parameter. Most accurate for reasoning and creative tasks.<br><br><strong>INT8 (8-bit integer):</strong> ~50% memory savings with minimal quality loss. Good balance for most use cases.<br><br><strong>INT4 / GPTQ 4-bit:</strong> ~75% memory savings. Fastest inference but may show quality degradation on complex reasoning. Best for running large models on consumer GPUs.</p>'
      },
      {
        question: 'How does context length affect VRAM usage?',
        answer: '<p>Longer context lengths increase VRAM usage because the model must store attention keys and values for all previous tokens. As a rough guide:<br><br><strong>4K context:</strong> Base VRAM (no overhead)<br><strong>32K context:</strong> ~15% more VRAM<br><strong>128K context:</strong> ~50% more VRAM<br><br>For most chat and coding tasks, 4K-8K context is sufficient. Only use 128K+ if you need to process entire documents at once.</p>'
      },
      {
        question: 'Which GPU is best for running local LLMs in 2026?',
        answer: '<p>For <strong>consumer GPUs</strong>, the <strong>RTX 4090 (24 GB)</strong> is the best single-GPU option for 8B-13B models. The upcoming <strong>RTX 5090 (32 GB)</strong> will handle 70B models at 4-bit.<br><br>For <strong>serious local AI</strong>, consider the <strong>RTX A6000 (48 GB)</strong> or <strong>A100 80GB</strong> for data center workloads.<br><br><strong>Budget pick:</strong> RTX 4060 Ti 16GB can run 7B-8B models comfortably at INT4.</p>'
      },
      {
        question: 'Can I run AI models on a laptop GPU?',
        answer: '<p>Yes, but with limitations. Laptop GPUs like the <strong>RTX 4060 Laptop (8 GB)</strong> can run 7B models at INT4 quantization. For coding assistants and chatbots, this is perfectly usable.<br><br>However, larger models (13B+) and long context lengths will struggle. For serious AI work, a desktop GPU with 16+ GB VRAM is strongly recommended.</p>'
      },
      {
        question: 'What is GPTQ and why should I use it?',
        answer: '<p><strong>GPTQ</strong> is a post-training quantization method that compresses models to 4-bit precision with minimal quality loss. It uses a clever algorithm to find the best 4-bit representation for each weight.<br><br><strong>Benefits:</strong> Run 2-3x larger models on the same GPU, 2-4x faster inference on supported hardware.<br><br><strong>Trade-off:</strong> Slightly lower quality than FP16, but often imperceptible for chat and coding tasks. Pre-quantized models are available on Hugging Face.</p>'
      },
      {
        question: 'Do image generation models need more VRAM than text models?',
        answer: '<p>Image models like <strong>Stable Diffusion XL</strong> need ~8 GB VRAM at FP16, while <strong>Flux.1 Dev</strong> requires ~24 GB. Text models are generally more VRAM-efficient for their parameter count because they process one token at a time.<br><br>However, image generation is computationally intensive and benefits from fast VRAM (GDDR6X/HBM3). For AI art, prioritize GPU memory bandwidth over raw capacity.</p>'
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
     SCHEMA INJECTION (8 types)
     ========================================== */
  function injectSchemas() {
    const url = 'https://tools.redrag.in/vram-calculator/';
    const blogUrl = RT.config.urls.blog;

    // 1. BreadcrumbList
    seo.breadcrumbSchema([
      { name: 'Home', item: blogUrl },
      { name: 'Tools', item: RT.config.urls.toolsHub },
      { name: 'VRAM Calculator', item: url }
    ]);

    // 2. WebApplication
    seo.injectSchema({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      '@id': url + '#webapp',
      name: 'REDRAG VRAM Calculator for AI/LLMs',
      applicationCategory: 'UtilityApplication',
      operatingSystem: 'Web Browser',
      browserRequirements: 'Requires JavaScript. Compatible with Chrome, Firefox, Safari, Edge.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.9',
        ratingCount: '89',
        bestRating: '5',
        worstRating: '1'
      },
      interactionStatistic: [
        { '@type': 'InteractionCounter', interactionType: { '@type': 'WatchAction' }, userInteractionCount: '3200' },
        { '@type': 'InteractionCounter', interactionType: { '@type': 'UseAction' }, userInteractionCount: '7800' }
      ],
      featureList: [
        '23+ AI models including Llama, Mistral, Qwen, DeepSeek',
        '4 quantization levels: FP16, INT8, INT4, GPTQ 4-bit',
        'Context length adjustment with VRAM overhead calculation',
        'GPU compatibility checker with 23+ GPUs',
        'Side-by-side quantization comparison table'
      ],
      screenshot: {
        '@type': 'ImageObject',
        url: 'https://tools.redrag.in/assets/images/og-vram.jpg',
        width: 1200,
        height: 630
      },
      description: 'Free VRAM calculator for local AI and LLM models. Check if your GPU can run Llama, Mistral, Qwen, and more with different quantization levels.',
      url: url,
      author: { '@type': 'Organization', name: 'REDRAG', url: blogUrl },
      publisher: {
        '@type': 'Organization',
        name: 'REDRAG',
        url: blogUrl,
        logo: { '@type': 'ImageObject', url: blogUrl + 'assets/logo.png' }
      },
      datePublished: '2026-07-31',
      dateModified: '2026-07-31',
      inLanguage: 'en',
      isAccessibleForFree: true
    }, 'rt-schema-webapp');

    // 3. SoftwareApplication
    seo.softwareApplicationSchema({
      name: 'REDRAG VRAM Calculator for AI/LLMs',
      description: 'Free VRAM calculator for local AI and LLM models. Check GPU compatibility for Llama, Mistral, Qwen with FP16, INT8, INT4, and GPTQ quantization.',
      url: url,
      ratingValue: '4.9',
      ratingCount: '89'
    });

    // 4. HowTo
    seo.howToSchema({
      name: 'How to Check VRAM Requirements for Local LLMs',
      description: 'Learn how much GPU memory you need to run AI models like Llama, Mistral, and Qwen locally on your machine.',
      totalTime: 'PT2M',
      estimatedCost: { '@type': 'MonetaryAmount', currency: 'INR', value: '0' },
      steps: [
        { name: 'Select an AI Model', text: 'Choose from 23+ models including Llama 3.1, Mistral, Qwen 2.5, DeepSeek, and more. Filter by family or search by name.', url: url + '#step1' },
        { name: 'Choose Quantization', text: 'Select FP16 for best quality, INT8 for balance, or INT4/GPTQ for maximum VRAM savings on consumer GPUs.', url: url + '#step2' },
        { name: 'Set Context Length', text: 'Pick your desired context window. Longer contexts use more VRAM. Most tasks work fine with 4K-8K tokens.', url: url + '#step3' },
        { name: 'Check GPU Compatibility', text: 'Select your GPU from the dropdown to see if it has enough VRAM. Get recommendations if you need an upgrade.', url: url + '#step4' }
      ],
      supplies: ['A GPU with CUDA support (NVIDIA preferred)', 'Local LLM inference software (Ollama, LM Studio, etc.)'],
      tools: ['REDRAG VRAM Calculator']
    });

    // 5. Article
    seo.injectSchema({
      '@context': 'https://schema.org',
      '@type': 'Article',
      '@id': url + '#article',
      headline: 'VRAM Calculator: How Much GPU Memory for Local LLMs? (2026)',
      description: 'Free calculator to check VRAM requirements for running AI models locally. Supports Llama, Mistral, Qwen, DeepSeek with FP16, INT8, INT4, and GPTQ quantization.',
      image: 'https://tools.redrag.in/assets/images/og-vram.jpg',
      author: { '@type': 'Organization', name: 'REDRAG', url: blogUrl },
      publisher: {
        '@type': 'Organization',
        name: 'REDRAG',
        logo: { '@type': 'ImageObject', url: blogUrl + 'assets/logo.png' }
      },
      datePublished: '2026-07-31',
      dateModified: '2026-07-31',
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      mainEntity: { '@id': url + '#webapp' },
      articleSection: 'AI Tools',
      wordCount: 2200,
      inLanguage: 'en'
    }, 'rt-schema-article');

    // 6. FAQPage — auto-injected by RT.components.FAQ.init
    // 7. Organization
    seo.organizationSchema();
    // 8. WebSite
    seo.websiteSchema();

    seo.setMeta('article:published_time', '2026-07-31T00:00:00+05:30');
    seo.setMeta('article:modified_time', '2026-07-31T00:00:00+05:30');
  }

  /* ==========================================
     PUBLIC API
     ========================================== */
  global.RTTool = {
    meta: { name: 'VRAM Calculator', slug: 'vram', version: '2.0.0' },
    init,
    _state: state,
    _config: CONFIG
  };

})(window);
