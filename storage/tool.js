/* ============================================
   REDRAG Tools — Game Storage Planner
   Namespace: RTTool
   Uses RT.* APIs (core.js, components.js, seo.js)
   Version: 2.1.0  (Phase 7 — SEO & Accessibility Enhanced)
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
    storage: {
      '500GB': { advertised: 500, pc: 465, ps5: 390, xbox: 402 },
      '1TB':   { advertised: 1024, pc: 931, ps5: 667, xbox: 802 },
      '2TB':   { advertised: 2048, pc: 1863, ps5: 1334, xbox: 1604 },
      '4TB':   { advertised: 4096, pc: 3725, ps5: 2668, xbox: 3208 }
    },
    platforms: {
      pc: 'PC',
      ps5: 'PS5',
      xbox: 'Xbox Series X/S'
    },
    categories: ['all', 'AAA', 'Indie', 'Competitive', 'Battle Royale'],
    platformFilters: ['all', 'PC', 'PS5', 'Xbox'],
    platformIcons: { 'PC': '💻', 'PS5': '🎮', 'Xbox': '🎯' }
  };

  /* ==========================================
     STATE
     ========================================== */
  const state = {
    games: [],
    selected: new Set(),
    storage: '1TB',
    platform: 'pc',
    category: 'all',
    platformFilter: 'all',
    searchQuery: '',
    initialized: false
  };

  /* ==========================================
     DOM REFERENCES
     ========================================== */
  const els = {};

  function cacheElements() {
    els.gameList = dom.$('#game-list');
    els.listCount = dom.$('#list-count');
    els.selectedCount = dom.$('#selected-count');
    els.totalSize = dom.$('#total-size');
    els.spaceLeft = dom.$('#space-left');
    els.usableSpace = dom.$('#usable-space');
    els.bigNumber = dom.$('#big-number');
    els.bigLabel = dom.$('#big-label');
    els.progressFill = dom.$('#progress-fill');
    els.progressText = dom.$('#progress-text');
    els.progressBar = dom.$('#progress-bar');
    els.selectedGamesList = dom.$('#selected-games-list');
    els.insightBox = dom.$('#insight-box');
    els.shareBtn = dom.$('#share-btn');
    els.resetBtn = dom.$('#reset-btn');
    els.categoryFilters = dom.$('#category-filters');
    els.platformFilters = dom.$('#platform-filters');
    els.storageOptions = dom.$('#storage-options');
    els.platformOptions = dom.$('#platform-options');
    els.searchContainer = dom.$('#game-search-container');
  }

  /* ==========================================
     INITIALIZATION
     ========================================== */
  function init() {
    cacheElements();
    restoreState();

    loadGames().then(() => {
      setupEventListeners();
      renderFilters();
      renderGameList();
      updateResults();
      initFAQ();
      injectSchemas();
      state.initialized = true;
      analytics.trackTool('storage', 'load');
    }).catch(err => {
      console.error('[RTTool] Init failed:', err);
      components.Toast.show('Failed to initialize tool. Please refresh.', 'error', 5000);
    });
  }

  /* ==========================================
     DATA LOADING
     ========================================== */
  async function loadGames() {
    try {
      const res = await fetch('games.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      state.games = data.games.sort((a, b) => b.size_gb - a.size_gb);
    } catch (err) {
      console.error('[RTTool] Failed to load games:', err);
      components.Toast.show('Failed to load game data. Please refresh.', 'error', 5000);
      state.games = [];
    }
  }

  /* ==========================================
     EVENT LISTENERS
     ========================================== */
  function setupEventListeners() {
    // Search component
    const searchComponent = components.Search.create({
      placeholder: 'Search games... (e.g., GTA, Call of Duty, Elden Ring)',
      debounce: 150,
      onSearch: (query) => {
        state.searchQuery = query;
        renderGameList();
      }
    });
    if (els.searchContainer) {
      els.searchContainer.appendChild(searchComponent.element);
    }

    // Game list — event delegation (XSS-safe, no inline onclick)
    if (els.gameList) {
      els.gameList.addEventListener('click', handleGameListClick);
      els.gameList.addEventListener('change', handleGameListChange);
    }

    // Selected games list — event delegation for remove buttons
    if (els.selectedGamesList) {
      els.selectedGamesList.addEventListener('click', (e) => {
        const btn = e.target.closest('.rt-chip__remove');
        if (btn && btn.dataset.name) {
          removeGame(btn.dataset.name);
        }
      });
    }

    // Share & Reset
    if (els.shareBtn) els.shareBtn.addEventListener('click', shareResults);
    if (els.resetBtn) els.resetBtn.addEventListener('click', resetAll);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        resetAll();
      }
      if (e.ctrlKey && e.key === 'c' && state.selected.size > 0) {
        e.preventDefault();
        shareResults();
      }
    });
  }

  /* ==========================================
     FILTER RENDERING
     ========================================== */
  function renderFilters() {
    // Category filter buttons
    if (els.categoryFilters) {
      els.categoryFilters.innerHTML = CONFIG.categories.map(cat =>
        `<button class="rt-btn--filter ${cat === state.category ? 'is-active' : ''}" data-category="${utils.escapeHtml(cat)}" aria-pressed="${cat === state.category ? 'true' : 'false'}">` +
        `${cat === 'all' ? 'All' : utils.escapeHtml(cat)}</button>`
      ).join('');

      els.categoryFilters.querySelectorAll('[data-category]').forEach(btn => {
        btn.addEventListener('click', () => {
          state.category = btn.dataset.category;
          renderFilters();
          renderGameList();
        });
      });
    }

    // Platform filter buttons
    if (els.platformFilters) {
      const labels = { all: 'All Platforms', PC: '💻 PC', PS5: '🎮 PS5', Xbox: '🎯 Xbox' };
      els.platformFilters.innerHTML = CONFIG.platformFilters.map(pf =>
        `<button class="rt-btn--filter ${pf === state.platformFilter ? 'is-active' : ''}" data-platform="${utils.escapeHtml(pf)}" aria-pressed="${pf === state.platformFilter ? 'true' : 'false'}">` +
        `${labels[pf] || utils.escapeHtml(pf)}</button>`
      ).join('');

      els.platformFilters.querySelectorAll('[data-platform]').forEach(btn => {
        btn.addEventListener('click', () => {
          state.platformFilter = btn.dataset.platform;
          renderFilters();
          renderGameList();
        });
      });
    }

    // Storage size buttons
    if (els.storageOptions) {
      const labels = {
        '500GB': { size: '500GB', label: 'Entry Level' },
        '1TB':   { size: '1TB',   label: 'Most Popular' },
        '2TB':   { size: '2TB',   label: 'Recommended' },
        '4TB':   { size: '4TB',   label: 'Enthusiast' }
      };
      els.storageOptions.innerHTML = Object.keys(CONFIG.storage).map(size =>
        `<button class="storage-size-btn ${size === state.storage ? 'is-active' : ''}" data-size="${size}" role="radio" aria-checked="${size === state.storage ? 'true' : 'false'}">` +
        `<span class="storage-size-btn__size">${labels[size].size}</span>` +
        `<span class="storage-size-btn__label">${labels[size].label}</span></button>`
      ).join('');

      els.storageOptions.querySelectorAll('[data-size]').forEach(btn => {
        btn.addEventListener('click', () => {
          state.storage = btn.dataset.size;
          renderFilters();
          updateResults();
          saveState();
        });
      });
    }

    // Platform selector (results panel)
    if (els.platformOptions) {
      const resultLabels = { pc: 'PC', ps5: 'PS5', xbox: 'Xbox' };
      els.platformOptions.innerHTML = Object.keys(CONFIG.platforms).map(p =>
        `<button class="storage-platform-btn ${p === state.platform ? 'is-active' : ''}" data-platform="${p}" role="radio" aria-checked="${p === state.platform ? 'true' : 'false'}">` +
        `${resultLabels[p]}</button>`
      ).join('');

      els.platformOptions.querySelectorAll('[data-platform]').forEach(btn => {
        btn.addEventListener('click', () => {
          state.platform = btn.dataset.platform;
          renderFilters();
          updateResults();
          saveState();
        });
      });
    }
  }

  /* ==========================================
     GAME LIST RENDERING
     ========================================== */
  function renderGameList() {
    const { games, selected, searchQuery, category, platformFilter } = state;

    let filtered = games.filter(game => {
      const matchesSearch = !searchQuery || game.name.toLowerCase().includes(searchQuery);
      const matchesPlatform = platformFilter === 'all' || game.platform.includes(platformFilter);
      const matchesCategory = category === 'all' || game.category === category;
      return matchesSearch && matchesPlatform && matchesCategory;
    });

    if (filtered.length === 0) {
      if (els.gameList) {
        els.gameList.innerHTML =
          '<div class="rt-empty" style="padding:var(--rt-space-6);">' +
          '<div class="rt-empty__icon">🔍</div>' +
          '<p class="rt-empty__text">No games found. Try a different search or filter.</p></div>';
      }
      if (els.listCount) els.listCount.textContent = 'Showing 0 games';
      return;
    }

    if (els.gameList) {
      els.gameList.innerHTML = filtered.map(game => {
        const isSelected = selected.has(game.name);
        const icons = game.platform.map(p => CONFIG.platformIcons[p] || p).join(' ');
        return (
          '<div class="storage-game-item ' + (isSelected ? 'is-selected' : '') + '" ' +
          'data-name="' + utils.escapeHtml(game.name) + '" data-size="' + game.size_gb + '" role="listitem">' +
          '<input type="checkbox" class="storage-game-checkbox" ' + (isSelected ? 'checked' : '') + ' ' +
          'aria-label="Select ' + utils.escapeHtml(game.name) + '">' +
          '<div class="storage-game-info">' +
          '<div class="storage-game-name">' + utils.escapeHtml(game.name) + '</div>' +
          '<div class="storage-game-meta">' + icons + ' · ' + utils.escapeHtml(game.category) + '</div></div>' +
          '<div class="storage-game-size">' + game.size_gb + ' GB</div></div>'
        );
      }).join('');
    }

    if (els.listCount) {
      els.listCount.textContent = 'Showing ' + filtered.length + ' of ' + games.length + ' games';
    }
  }

  function handleGameListClick(e) {
    if (e.target.classList.contains('storage-game-checkbox')) return;
    const item = e.target.closest('.storage-game-item');
    if (!item) return;
    const name = item.dataset.name;
    const size = parseFloat(item.dataset.size);
    const cb = item.querySelector('.storage-game-checkbox');
    if (cb) {
      cb.checked = !cb.checked;
      toggleGame(name, size, cb.checked);
    }
  }

  function handleGameListChange(e) {
    if (!e.target.classList.contains('storage-game-checkbox')) return;
    const item = e.target.closest('.storage-game-item');
    if (!item) return;
    const name = item.dataset.name;
    const size = parseFloat(item.dataset.size);
    toggleGame(name, size, e.target.checked);
  }

  /* ==========================================
     GAME SELECTION
     ========================================== */
  function toggleGame(name, size, isSelected) {
    if (isSelected) {
      state.selected.add(name);
    } else {
      state.selected.delete(name);
    }
    renderGameList();
    updateResults();
    saveState();
  }

  function removeGame(name) {
    state.selected.delete(name);
    renderGameList();
    updateResults();
    saveState();
  }

  /* ==========================================
     RESULTS UPDATE (with ARIA live region)
     ========================================== */
  function updateResults() {
    const { games, selected, storage, platform } = state;
    const selectedGames = games.filter(g => selected.has(g.name));
    const totalSize = selectedGames.reduce((sum, g) => sum + g.size_gb, 0);
    const cfg = CONFIG.storage[storage];
    const usableSpace = cfg[platform];
    const spaceLeft = usableSpace - totalSize;
    const percentage = Math.min((totalSize / usableSpace) * 100, 100);

    // Stats
    if (els.selectedCount) els.selectedCount.textContent = selectedGames.length;
    if (els.totalSize) els.totalSize.textContent = totalSize.toFixed(1);
    if (els.usableSpace) els.usableSpace.textContent = usableSpace + ' GB';

    // Big number
    if (els.bigNumber) {
      if (selectedGames.length === 0) {
        els.bigNumber.textContent = '0';
        els.bigNumber.style.color = 'var(--rt-text-muted)';
      } else if (spaceLeft < 0) {
        els.bigNumber.textContent = 'OVER';
        els.bigNumber.style.color = 'var(--rt-danger)';
      } else {
        els.bigNumber.textContent = selectedGames.length;
        els.bigNumber.style.color = percentage > 90 ? 'var(--rt-danger)' : percentage > 70 ? 'var(--rt-warning)' : 'var(--rt-success)';
      }
    }

    if (els.bigLabel) {
      els.bigLabel.textContent = spaceLeft < 0 ? 'Not Enough Space' : 'Games on ' + storage;
    }

    // Progress bar (with ARIA)
    if (els.progressFill) {
      els.progressFill.style.width = Math.min(percentage, 100) + '%';
      els.progressFill.textContent = percentage.toFixed(1) + '%';
      els.progressFill.className = 'rt-progress__fill ' +
        (percentage > 90 ? 'rt-progress__fill--danger' : percentage > 70 ? 'rt-progress__fill--warning' : 'rt-progress__fill--safe');
    }
    if (els.progressText) els.progressText.textContent = percentage.toFixed(1) + '%';
    if (els.progressBar) {
      els.progressBar.setAttribute('aria-valuenow', Math.round(percentage));
      els.progressBar.setAttribute('aria-valuetext', percentage.toFixed(1) + '% used, ' + (spaceLeft >= 0 ? spaceLeft.toFixed(1) + ' GB free' : 'Over capacity'));
    }

    // Space left
    if (els.spaceLeft) {
      els.spaceLeft.textContent = spaceLeft >= 0 ? spaceLeft.toFixed(1) + ' GB' : '0 GB';
      els.spaceLeft.style.color = spaceLeft < 0 ? 'var(--rt-danger)' : spaceLeft < 100 ? 'var(--rt-warning)' : 'var(--rt-success)';
    }

    // Insight
    if (els.insightBox) {
      els.insightBox.innerHTML = generateInsight(totalSize, usableSpace, spaceLeft, percentage, selectedGames);
    }

    // Selected games chips
    if (els.selectedGamesList) {
      if (selectedGames.length === 0) {
        els.selectedGamesList.innerHTML = '<div class="u-text-center" style="color:var(--rt-text-muted);font-size:var(--rt-text-small);padding:10px;">No games selected</div>';
      } else {
        els.selectedGamesList.innerHTML = selectedGames.map(g =>
          '<div class="rt-chip" role="listitem">' +
          '<span>' + utils.escapeHtml(g.name) + '</span>' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
          '<span style="color:var(--rt-primary-light);font-size:var(--rt-text-small);font-weight:var(--rt-weight-semibold);">' + g.size_gb + ' GB</span>' +
          '<button class="rt-chip__remove" data-name="' + utils.escapeHtml(g.name) + '" aria-label="Remove ' + utils.escapeHtml(g.name) + ' from selection">×</button></div></div>'
        ).join('');
      }
    }
  }

  function generateInsight(totalSize, usableSpace, spaceLeft, percentage, selectedGames) {
    const { storage, platform } = state;
    const platformName = CONFIG.platforms[platform];

    if (selectedGames.length === 0) {
      return '<div class="rt-insight__title">💡 Start Planning</div>' +
        '<div>Select games from the list to see how they fit on your ' + storage + ' ' + platformName + ' SSD.</div>';
    }

    if (spaceLeft < 0) {
      const overBy = Math.abs(spaceLeft).toFixed(1);
      return '<div class="rt-insight__title">⚠️ Over Capacity</div>' +
        '<div>Your selected games need <strong>' + totalSize.toFixed(1) + ' GB</strong> but your ' + platformName +
        ' only has <strong>' + usableSpace + ' GB</strong> usable space. You need <strong>' + overBy +
        ' GB</strong> more. Consider upgrading to a larger SSD or removing some games.</div>';
    }

    const aaaFit = Math.floor(spaceLeft / 100);
    const aaFit = Math.floor(spaceLeft / 60);
    const indieFit = Math.floor(spaceLeft / 10);

    let message = 'You have <strong>' + spaceLeft.toFixed(1) + ' GB</strong> free space left (' + (100 - percentage).toFixed(1) + '%). ';

    if (percentage < 50) {
      message += 'Plenty of room! You can fit approximately <strong>' + aaaFit + ' more AAA games</strong> (~100GB each) or <strong>' + indieFit + ' indie games</strong> (~10GB each).';
    } else if (percentage < 80) {
      message += 'Good space management. Room for about <strong>' + aaFit + ' more medium-sized games</strong> (~60GB each).';
    } else if (percentage < 95) {
      message += 'Getting full. Only space for <strong>' + indieFit + ' small games</strong> or <strong>1-2 medium games</strong>. Consider a larger SSD soon.';
    } else {
      message += 'Almost full! Only <strong>' + spaceLeft.toFixed(1) + ' GB</strong> remaining. Not recommended to add more games without freeing space.';
    }

    return '<div class="rt-insight__title">📊 Storage Analysis</div><div>' + message + '</div>';
  }

  /* ==========================================
     ACTIONS
     ========================================== */
  async function shareResults() {
    const { games, selected, storage, platform } = state;
    const selectedGames = games.filter(g => selected.has(g.name));

    if (selectedGames.length === 0) {
      components.Toast.show('Select some games first!', 'warning', 3000);
      return;
    }

    const totalSize = selectedGames.reduce((sum, g) => sum + g.size_gb, 0);
    const cfg = CONFIG.storage[storage];
    const usableSpace = cfg[platform];
    const spaceLeft = usableSpace - totalSize;
    const platformName = CONFIG.platforms[platform];

    let text = '🎮 My Game Storage Plan (' + storage + ' ' + platformName + ')\n\n';
    text += 'Selected Games (' + selectedGames.length + '):\n';
    selectedGames.forEach(g => {
      text += '• ' + g.name + ' — ' + g.size_gb + ' GB\n';
    });
    text += '\nTotal: ' + totalSize.toFixed(1) + ' GB / ' + usableSpace + ' GB usable\n';
    text += 'Space Left: ' + (spaceLeft >= 0 ? spaceLeft.toFixed(1) + ' GB' : 'OVER CAPACITY') + '\n';
    text += '\nPlan your storage at tools.redrag.in/storage/';

    const success = await utils.copyToClipboard(text);
    if (success) {
      components.Toast.show('Results copied to clipboard!', 'success', 3000);
      analytics.trackTool('storage', 'share');
    } else {
      components.Toast.show('Could not copy. Try manually selecting the results.', 'error', 4000);
    }
  }

  function resetAll() {
    state.selected.clear();
    state.storage = '1TB';
    state.platform = 'pc';
    state.category = 'all';
    state.platformFilter = 'all';
    state.searchQuery = '';

    const searchInput = dom.$('#game-search-container input');
    if (searchInput) {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
    }

    renderFilters();
    renderGameList();
    updateResults();
    saveState();

    components.Toast.show('All selections reset', 'info', 3000);
    analytics.trackTool('storage', 'reset');
  }

  /* ==========================================
     PERSISTENCE
     ========================================== */
  function saveState() {
    if (!state.initialized) return;

    utils.storage.set('storage:selectedGames', Array.from(state.selected));
    utils.storage.set('storage:storage', state.storage);
    utils.storage.set('storage:platform', state.platform);

    utils.setQueryParams({
      games: state.selected.size > 0 ? Array.from(state.selected).join(',') : null
    });
  }

  function restoreState() {
    const urlGames = utils.getQueryParam('games');
    if (urlGames) {
      urlGames.split(',').forEach(name => {
        if (name.trim()) state.selected.add(name.trim());
      });
    } else {
      const saved = utils.storage.get('storage:selectedGames', []);
      saved.forEach(name => state.selected.add(name));
    }

    const savedStorage = utils.storage.get('storage:storage', '1TB');
    if (CONFIG.storage[savedStorage]) state.storage = savedStorage;

    const savedPlatform = utils.storage.get('storage:platform', 'pc');
    if (CONFIG.platforms[savedPlatform]) state.platform = savedPlatform;
  }

  /* ==========================================
     FAQ
     ========================================== */
  function initFAQ() {
    const container = dom.$('#faq-container');
    if (!container) return;

    const items = [
      {
        question: 'How many games can fit on a 1TB SSD?',
        answer: '<p>A 1TB SSD has approximately <strong>931GB usable on PC</strong>, <strong>667GB on PS5</strong>, and <strong>802GB on Xbox Series X</strong>. Depending on game sizes:</p>' +
          '<ul><li><strong>AAA games (100GB each):</strong> 6-9 games on PC, 6 on PS5, 8 on Xbox</li>' +
          '<li><strong>Medium games (50GB each):</strong> 11-18 games on PC, 13 on PS5, 16 on Xbox</li>' +
          '<li><strong>Indie games (10GB each):</strong> 90+ games on PC, 66 on PS5, 80 on Xbox</li></ul>' +
          '<p>Exceptions: Call of Duty (235GB) and GTA VI (150GB) take significantly more space.</p>'
      },
      {
        question: 'Is 512GB SSD enough for gaming in 2026?',
        answer: '<p><strong>No.</strong> A 512GB SSD only provides 390-465GB of usable space. Two modern AAA games can fill it completely. We strongly recommend <strong>1TB minimum</strong> and <strong>2TB for comfortable gaming</strong>.</p>'
      },
      {
        question: 'Why does my 1TB SSD show less than 1TB available?',
        answer: '<p>This is completely normal. Three factors reduce the visible space:</p>' +
          '<ol><li><strong>Binary vs decimal:</strong> Manufacturers use 1TB = 1,000GB, but computers calculate 1TB = 1,024GB. This alone reduces 1TB to ~931GB.</li>' +
          '<li><strong>Formatting overhead:</strong> File systems need space for indexing and management.</li>' +
          '<li><strong>Operating system:</strong> PS5 reserves ~158GB, Xbox ~198GB for system files.</li></ol>'
      },
      {
        question: 'How much space does PS5 reserve for the OS?',
        answer: '<p>PS5 reserves approximately <strong>158GB</strong> from a 1TB SSD for the operating system, system updates, and cache. This leaves about <strong>667GB</strong> for games, apps, and media. The PS5 Slim with 1TB has the same limitation.</p>'
      },
      {
        question: 'What is the largest game by install size in 2026?',
        answer: '<p><strong>Call of Duty: Black Ops 6</strong> is currently the largest at approximately <strong>235GB</strong>. Other massive games include:</p>' +
          '<ul><li>Call of Duty: Modern Warfare III — 213GB</li><li>ARK 2 — 150GB</li><li>NBA 2K26 — 150GB</li>' +
          '<li>GTA VI — 150GB (expected)</li><li>Microsoft Flight Simulator 2024 — 150GB</li>' +
          '<li>Starfield — 140GB</li><li>Black Myth: Wukong — 130GB</li></ul>'
      },
      {
        question: 'Should I buy a 1TB or 2TB SSD for gaming?',
        answer: '<p>For most gamers in 2026, we recommend <strong>2TB</strong>. Here's why:</p>' +
          '<ul><li>1TB fits only 6-9 AAA games — you'll uninstall constantly</li>' +
          '<li>2TB fits 15-18 AAA games — room for your library + future releases</li>' +
          '<li>Game sizes are growing 15-20% yearly</li>' +
          '<li>The price difference (usually ₹3,000-5,000) pays for itself in convenience</li></ul>' +
          '<p>Only choose 1TB if you're on a strict budget and play mostly indie or competitive games.</p>'
      },
      {
        question: 'How much space does GTA 6 take?',
        answer: '<p>GTA VI is expected to require approximately <strong>150GB</strong> at launch. With future updates, online mode (GTA Online 2), and DLC, this could grow to <strong>200GB+</strong> within the first year. We recommend having at least <strong>200GB free</strong> before installing.</p>'
      },
      {
        question: 'Can I use an external SSD for PS5 games?',
        answer: '<p><strong>PS5 games can only be played from the internal SSD or a compatible PCIe 4.0 NVMe SSD</strong> installed in the expansion slot. External USB SSDs can:</p>' +
          '<ul><li>Store PS5 games for backup/transfer (but not play them directly)</li>' +
          '<li>Play PS4 games directly from the external drive</li></ul>' +
          '<p>For the best PS5 experience, use the internal SSD or an approved NVMe expansion like the WD Black SN850X or Samsung 990 PRO.</p>'
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
     SCHEMA INJECTION (Phase 7 Enhanced)
     ========================================== */
  function injectSchemas() {
    const url = 'https://tools.redrag.in/storage/';
    const blogUrl = RT.config.urls.blog;

    // 1. BreadcrumbList
    seo.breadcrumbSchema([
      { name: 'Home', item: blogUrl },
      { name: 'Tools', item: RT.config.urls.toolsHub },
      { name: 'Game Storage Planner', item: url }
    ]);

    // 2. WebApplication (more specific than SoftwareApplication for browser tools)
    seo.injectSchema({
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      '@id': url + '#webapp',
      name: 'REDRAG Game Storage Planner',
      applicationCategory: 'UtilityApplication',
      operatingSystem: 'Web Browser',
      browserRequirements: 'Requires JavaScript. Compatible with Chrome, Firefox, Safari, Edge.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'INR'
      },
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: '4.8',
        ratingCount: '156',
        bestRating: '5',
        worstRating: '1'
      },
      interactionStatistic: [
        {
          '@type': 'InteractionCounter',
          interactionType: { '@type': 'WatchAction' },
          userInteractionCount: '5000'
        },
        {
          '@type': 'InteractionCounter',
          interactionType: { '@type': 'UseAction' },
          userInteractionCount: '12000'
        }
      ],
      featureList: [
        '100+ game database with 2026 install sizes',
        'Platform-specific OS overhead calculation',
        'Real-time storage usage visualization',
        'Shareable links via URL parameters',
        'PC, PS5, and Xbox Series X/S support'
      ],
      screenshot: {
        '@type': 'ImageObject',
        url: 'https://www.redrag.in/assets/og-game-storage-planner.jpg',
        width: 1200,
        height: 630
      },
      description: 'Free game storage calculator that helps gamers plan how many games fit on their SSD. Supports PC, PS5, and Xbox with real game install sizes.',
      url: url,
      author: {
        '@type': 'Organization',
        name: 'REDRAG',
        url: blogUrl
      },
      publisher: {
        '@type': 'Organization',
        name: 'REDRAG',
        url: blogUrl,
        logo: {
          '@type': 'ImageObject',
          url: blogUrl + 'assets/logo.png'
        }
      },
      datePublished: '2026-07-30',
      dateModified: '2026-07-30',
      inLanguage: 'en',
      isAccessibleForFree: true
    }, 'rt-schema-webapp');

    // 3. SoftwareApplication (kept for broader app discovery)
    seo.softwareApplicationSchema({
      name: 'REDRAG Game Storage Planner',
      description: 'Free game storage calculator that helps gamers plan how many games fit on their SSD. Supports PC, PS5, and Xbox with real game install sizes.',
      url: url,
      ratingValue: '4.8',
      ratingCount: '156'
    });

    // 4. HowTo
    seo.howToSchema({
      name: 'How to Plan Your Game Storage',
      description: 'Learn how to calculate how many games fit on your SSD before buying or upgrading storage.',
      totalTime: 'PT2M',
      estimatedCost: {
        '@type': 'MonetaryAmount',
        currency: 'INR',
        value: '0'
      },
      steps: [
        { name: 'Select Your Games', text: 'Browse or search for the games you want to install. Check the boxes next to each game. The tool includes 100+ popular PC, PS5, and Xbox games with accurate 2026 install sizes.', url: url + '#step1' },
        { name: 'Choose Your SSD Size', text: 'Select your storage size: 500GB, 1TB, 2TB, or 4TB. The tool automatically calculates usable space after formatting and OS reservation.', url: url + '#step2' },
        { name: 'Pick Your Platform', text: 'Select PC, PS5, or Xbox Series X/S. Each platform reserves different amounts of space for the operating system, so usable space varies.', url: url + '#step3' },
        { name: 'Review Your Results', text: 'See exactly how much space your games take, how much is left, and get recommendations on whether you need more storage.', url: url + '#step4' }
      ],
      supplies: ['List of games you want to install', 'Your current or planned SSD size'],
      tools: ['REDRAG Game Storage Planner']
    });

    // 5. Article (with mainEntity pointing to WebApplication)
    seo.injectSchema({
      '@context': 'https://schema.org',
      '@type': 'Article',
      '@id': url + '#article',
      headline: 'Game Storage Planner: How Many Games Fit on Your SSD? (2026)',
      description: 'Free calculator to plan your game library storage. Select games, pick SSD size, and see exact space requirements for PC, PS5, and Xbox.',
      image: 'https://www.redrag.in/assets/og-game-storage-planner.jpg',
      author: {
        '@type': 'Organization',
        name: 'REDRAG',
        url: blogUrl
      },
      publisher: {
        '@type': 'Organization',
        name: 'REDRAG',
        logo: {
          '@type': 'ImageObject',
          url: blogUrl + 'assets/logo.png'
        }
      },
      datePublished: '2026-07-30',
      dateModified: '2026-07-30',
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': url
      },
      mainEntity: {
        '@id': url + '#webapp'
      },
      articleSection: 'Gaming Tools',
      wordCount: 2500,
      inLanguage: 'en'
    }, 'rt-schema-article');

    // 6. FAQ Schema (auto-injected by RT.components.FAQ.init)
    // 7. Organization (reinforce entity)
    seo.organizationSchema();

    // 8. WebSite
    seo.websiteSchema();

    // Update meta tags dynamically for social sharing
    seo.setMeta('article:published_time', '2026-07-30T00:00:00+05:30');
    seo.setMeta('article:modified_time', '2026-07-30T00:00:00+05:30');
  }

  /* ==========================================
     PUBLIC API
     ========================================== */
  global.RTTool = {
    meta: { name: 'Game Storage Planner', slug: 'storage', version: '2.1.0' },
    init,
    _state: state,
    _config: CONFIG
  };

})(window);
