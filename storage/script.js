/* ============================================
   REDRAG Game Storage Planner - JavaScript
   ============================================ */

// Storage configurations (advertised vs usable)
const STORAGE_CONFIGS = {
  '500GB': { advertised: 500, pc: 465, ps5: 390, xbox: 402 },
  '1TB':   { advertised: 1024, pc: 931, ps5: 667, xbox: 802 },
  '2TB':   { advertised: 2048, pc: 1863, ps5: 1334, xbox: 1604 },
  '4TB':   { advertised: 4096, pc: 3725, ps5: 2668, xbox: 3208 }
};

// Platform labels
const PLATFORM_LABELS = {
  'pc': 'PC',
  'ps5': 'PS5',
  'xbox': 'Xbox Series X/S'
};

// State
let gamesData = [];
let selectedGames = new Set();
let currentStorage = '1TB';
let currentPlatform = 'pc';
let currentFilter = 'all';
let currentCategory = 'all';

// DOM Elements
let gameListEl, searchInput, selectedCountEl, totalSizeEl;

// Initialize
document.addEventListener('DOMContentLoaded', async function() {
  await loadGames();
  setupEventListeners();
  renderGameList();
  updateResults();
  setupFAQ();
});

// Load games from JSON
async function loadGames() {
  try {
    const response = await fetch('games.json');
    const data = await response.json();
    gamesData = data.games.sort((a, b) => b.size_gb - a.size_gb);
  } catch (error) {
    console.error('Failed to load games:', error);
    // Fallback data if JSON fails
    gamesData = [
      {"name": "GTA VI", "size_gb": 150, "platform": ["PC", "PS5", "Xbox"], "category": "AAA"},
      {"name": "Call of Duty: Black Ops 6", "size_gb": 235, "platform": ["PC", "PS5", "Xbox"], "category": "AAA"},
      {"name": "Starfield", "size_gb": 140, "platform": ["PC", "Xbox"], "category": "AAA"},
      {"name": "Baldur's Gate 3", "size_gb": 122, "platform": ["PC", "PS5", "Xbox"], "category": "AAA"},
      {"name": "Cyberpunk 2077", "size_gb": 90, "platform": ["PC", "PS5", "Xbox"], "category": "AAA"},
      {"name": "Elden Ring", "size_gb": 60, "platform": ["PC", "PS5", "Xbox"], "category": "AAA"},
      {"name": "Valorant", "size_gb": 28, "platform": ["PC"], "category": "Competitive"},
      {"name": "Minecraft", "size_gb": 4, "platform": ["PC", "PS5", "Xbox"], "category": "Indie"}
    ];
  }
}

// Setup event listeners
function setupEventListeners() {
  // Search
  searchInput = document.getElementById('gameSearch');
  searchInput.addEventListener('input', debounce(renderGameList, 200));

  // Storage buttons
  document.querySelectorAll('.storage-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.storage-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentStorage = this.dataset.size;
      updateResults();
    });
  });

  // Platform buttons
  document.querySelectorAll('.platform-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.platform-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentPlatform = this.dataset.platform;
      updateResults();
    });
  });

  // Category filters
  document.querySelectorAll('.filter-btn[data-category]').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filter-btn[data-category]').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentCategory = this.dataset.category;
      renderGameList();
    });
  });

  // Platform filters
  document.querySelectorAll('.filter-btn[data-platform]').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.filter-btn[data-platform]').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentFilter = this.dataset.platform;
      renderGameList();
    });
  });

  // Action buttons
  document.getElementById('shareBtn').addEventListener('click', shareResults);
  document.getElementById('resetBtn').addEventListener('click', resetAll);
}

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Render game list
function renderGameList() {
  gameListEl = document.getElementById('gameList');
  const searchTerm = searchInput.value.toLowerCase();

  let filtered = gamesData.filter(game => {
    const matchesSearch = game.name.toLowerCase().includes(searchTerm);
    const matchesPlatform = currentFilter === 'all' || game.platform.includes(currentFilter);
    const matchesCategory = currentCategory === 'all' || game.category === currentCategory;
    return matchesSearch && matchesPlatform && matchesCategory;
  });

  if (filtered.length === 0) {
    gameListEl.innerHTML = '<div class="game-count">No games found. Try a different search.</div>';
    return;
  }

  gameListEl.innerHTML = filtered.map(game => {
    const isSelected = selectedGames.has(game.name);
    const platformIcons = game.platform.map(p => {
      const icons = { 'PC': '💻', 'PS5': '🎮', 'Xbox': '🎯' };
      return icons[p] || p;
    }).join(' ');

    return `
      <div class="game-item ${isSelected ? 'selected' : ''}" data-name="${escapeHtml(game.name)}">
        <input type="checkbox" class="game-checkbox" ${isSelected ? 'checked' : ''} 
               data-name="${escapeHtml(game.name)}" data-size="${game.size_gb}">
        <div class="game-info">
          <div class="game-name">${escapeHtml(game.name)}</div>
          <div class="game-meta">${platformIcons} · ${game.category}</div>
        </div>
        <div class="game-size">${game.size_gb} GB</div>
      </div>
    `;
  }).join('');

  // Add click handlers
  gameListEl.querySelectorAll('.game-item').forEach(item => {
    item.addEventListener('click', function(e) {
      if (e.target.classList.contains('game-checkbox')) {
        toggleGame(e.target.dataset.name, parseFloat(e.target.dataset.size), e.target.checked);
      } else {
        const checkbox = this.querySelector('.game-checkbox');
        checkbox.checked = !checkbox.checked;
        toggleGame(checkbox.dataset.name, parseFloat(checkbox.dataset.size), checkbox.checked);
      }
    });
  });

  // Update count
  const countEl = document.getElementById('listCount');
  if (countEl) countEl.textContent = `Showing ${filtered.length} of ${gamesData.length} games`;
}

// Toggle game selection
function toggleGame(name, size, isSelected) {
  if (isSelected) {
    selectedGames.add(name);
  } else {
    selectedGames.delete(name);
  }
  renderGameList();
  updateResults();
}

// Update results panel
function updateResults() {
  const selected = gamesData.filter(g => selectedGames.has(g.name));
  const totalSize = selected.reduce((sum, g) => sum + g.size_gb, 0);
  const config = STORAGE_CONFIGS[currentStorage];
  const usableSpace = config[currentPlatform];
  const spaceLeft = usableSpace - totalSize;
  const percentage = Math.min((totalSize / usableSpace) * 100, 100);

  // Update selected count
  const countEl = document.getElementById('selectedCount');
  if (countEl) countEl.textContent = selected.length;

  // Update total size
  const sizeEl = document.getElementById('totalSize');
  if (sizeEl) sizeEl.textContent = totalSize.toFixed(1);

  // Update big number
  const bigNumEl = document.getElementById('bigNumber');
  if (bigNumEl) {
    if (selected.length === 0) {
      bigNumEl.textContent = '0';
      bigNumEl.style.color = 'var(--text-muted)';
    } else if (spaceLeft < 0) {
      bigNumEl.textContent = 'OVER';
      bigNumEl.style.color = 'var(--danger)';
    } else {
      bigNumEl.textContent = selected.length;
      bigNumEl.style.color = percentage > 90 ? 'var(--danger)' : percentage > 70 ? 'var(--warning)' : 'var(--success)';
    }
  }

  // Update big label
  const bigLabelEl = document.getElementById('bigLabel');
  if (bigLabelEl) {
    bigLabelEl.textContent = spaceLeft < 0 ? 'Not Enough Space' : `Games on ${currentStorage}`;
  }

  // Update progress bar
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  if (progressFill) {
    progressFill.style.width = Math.min(percentage, 100) + '%';
    progressFill.className = 'progress-bar-fill ' + (percentage > 90 ? 'danger' : percentage > 70 ? 'warning' : 'safe');
    if (progressText) progressText.textContent = percentage.toFixed(1) + '%';
  }

  // Update stats
  const spaceLeftEl = document.getElementById('spaceLeft');
  if (spaceLeftEl) {
    spaceLeftEl.textContent = spaceLeft >= 0 ? spaceLeft.toFixed(1) + ' GB' : '0 GB';
    spaceLeftEl.style.color = spaceLeft < 0 ? 'var(--danger)' : spaceLeft < 100 ? 'var(--warning)' : 'var(--success)';
  }

  const usableEl = document.getElementById('usableSpace');
  if (usableEl) usableEl.textContent = usableSpace + ' GB';

  const advertisedEl = document.getElementById('advertisedSpace');
  if (advertisedEl) advertisedEl.textContent = currentStorage;

  // Update insight
  const insightEl = document.getElementById('insightBox');
  if (insightEl) {
    insightEl.innerHTML = generateInsight(totalSize, usableSpace, spaceLeft, percentage, selected);
  }

  // Update selected games list
  const selectedListEl = document.getElementById('selectedGamesList');
  if (selectedListEl) {
    if (selected.length === 0) {
      selectedListEl.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:13px;padding:10px;">No games selected</div>';
    } else {
      selectedListEl.innerHTML = selected.map(g => `
        <div class="selected-game-item">
          <span>${escapeHtml(g.name)}</span>
          <div>
            <span style="color:var(--primary-light);margin-right:8px;">${g.size_gb} GB</span>
            <button class="remove-btn" onclick="removeGame('${escapeHtml(g.name)}')">×</button>
          </div>
        </div>
      `).join('');
    }
  }
}

// Generate insight message
function generateInsight(totalSize, usableSpace, spaceLeft, percentage, selected) {
  if (selected.length === 0) {
    return `
      <div class="insight-title">💡 Start Planning</div>
      <div>Select games from the list to see how they fit on your ${currentStorage} ${PLATFORM_LABELS[currentPlatform]} SSD.</div>
    `;
  }

  if (spaceLeft < 0) {
    const overBy = Math.abs(spaceLeft).toFixed(1);
    return `
      <div class="insight-title">⚠️ Over Capacity</div>
      <div>Your selected games need <strong>${totalSize.toFixed(1)} GB</strong> but your ${PLATFORM_LABELS[currentPlatform]} only has <strong>${usableSpace} GB</strong> usable space. You need <strong>${overBy} GB</strong> more. Consider upgrading to a larger SSD or removing some games.</div>
    `;
  }

  // Calculate how many more games of different sizes fit
  const aaaFit = Math.floor(spaceLeft / 100);
  const aaFit = Math.floor(spaceLeft / 60);
  const indieFit = Math.floor(spaceLeft / 10);

  let message = `You have <strong>${spaceLeft.toFixed(1)} GB</strong> free space left (${(100 - percentage).toFixed(1)}%). `;

  if (percentage < 50) {
    message += `Plenty of room! You can fit approximately <strong>${aaaFit} more AAA games</strong> (~100GB each) or <strong>${indieFit} indie games</strong> (~10GB each).`;
  } else if (percentage < 80) {
    message += `Good space management. Room for about <strong>${aaFit} more medium-sized games</strong> (~60GB each).`;
  } else if (percentage < 95) {
    message += `Getting full. Only space for <strong>${indieFit} small games</strong> or <strong>1-2 medium games</strong>. Consider a larger SSD soon.`;
  } else {
    message += `Almost full! Only <strong>${spaceLeft.toFixed(1)} GB</strong> remaining. Not recommended to add more games without freeing space.`;
  }

  return `
    <div class="insight-title">📊 Storage Analysis</div>
    <div>${message}</div>
  `;
}

// Remove game from selection
function removeGame(name) {
  selectedGames.delete(name);
  renderGameList();
  updateResults();
}

// Reset all
function resetAll() {
  selectedGames.clear();
  currentStorage = '1TB';
  currentPlatform = 'pc';
  currentFilter = 'all';
  currentCategory = 'all';

  // Reset UI
  document.querySelectorAll('.storage-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-size="1TB"]').classList.add('active');

  document.querySelectorAll('.platform-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-platform="pc"]').classList.add('active');

  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-category="all"]').classList.add('active');
  document.querySelector('[data-platform="all"]').classList.add('active');

  searchInput.value = '';

  renderGameList();
  updateResults();
  showToast('All selections reset');
}

// Share results
function shareResults() {
  const selected = gamesData.filter(g => selectedGames.has(g.name));
  if (selected.length === 0) {
    showToast('Select some games first!');
    return;
  }

  const totalSize = selected.reduce((sum, g) => sum + g.size_gb, 0);
  const config = STORAGE_CONFIGS[currentStorage];
  const usableSpace = config[currentPlatform];
  const spaceLeft = usableSpace - totalSize;

  let text = `🎮 My Game Storage Plan (${currentStorage} ${PLATFORM_LABELS[currentPlatform]})\n\n`;
  text += `Selected Games (${selected.length}):\n`;
  selected.forEach(g => {
    text += `• ${g.name} — ${g.size_gb} GB\n`;
  });
  text += `\nTotal: ${totalSize.toFixed(1)} GB / ${usableSpace} GB usable\n`;
  text += `Space Left: ${spaceLeft >= 0 ? spaceLeft.toFixed(1) + ' GB' : 'OVER CAPACITY'}\n`;
  text += `\nPlan your storage at tools.redrag.in/storage/`;

  navigator.clipboard.writeText(text).then(() => {
    showToast('Results copied to clipboard!');
  }).catch(() => {
    showToast('Could not copy. Try manually selecting the results.');
  });
}

// Toast notification
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// FAQ Accordion
function setupFAQ() {
  document.querySelectorAll('.faq-question').forEach(q => {
    q.addEventListener('click', function() {
      const item = this.parentElement;
      const isActive = item.classList.contains('active');

      // Close all
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));

      // Open clicked if it was closed
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
