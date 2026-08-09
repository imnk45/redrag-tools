/* ============================================
   REDRAG Tools — Hub Page JavaScript
   Namespace: RTHub
   Uses RT.* APIs (core.js, components.js, seo.js)
   Version: 2.0.0 (Phase 8 — Hub Migration)
   ============================================ */

(function (global) {
  'use strict';

  const RT = global.RT;
  if (!RT) {
    console.error('[RTHub] RT.core must be loaded first');
    return;
  }

  const { dom, utils, components, seo, analytics } = RT;

  /* ==========================================
     CONFIGURATION
     ========================================== */
  const CONFIG = {
    registryUrl: '/shared/data/tools-registry.json?v=42',
    maxTags: 3
  };

  /* ==========================================
     INITIALIZATION
     ========================================== */
  async function init() {
    try {
      await renderTools();
      initFAQ();
      injectSchemas();
      setupCTA();
      analytics.trackTool('hub', 'load');
    } catch (err) {
      console.error('[RTHub] Init failed:', err);
    }
  }

  let allTools = [];
  let currentCategory = 'All';
  let currentSearch = '';
  let currentPage = 1;
  const TOOLS_PER_PAGE = 9;

  /* ==========================================
     RENDER TOOLS FROM REGISTRY
     ========================================== */
  async function renderTools() {
    const container = dom.$('#tools-grid');
    if (!container) return;

    try {
      const res = await fetch(CONFIG.registryUrl);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      allTools = data.tools || [];

      if (allTools.length === 0) {
        container.innerHTML = '<div class="rt-empty"><div class="rt-empty__icon">📭</div><p class="rt-empty__text">No tools available yet.</p></div>';
        return;
      }

      // Initial render
      updateToolsGrid();
      
      // Setup dynamic filters and search
      setupFilters();
      setupSearch();

      // Update live tool count in hero
      const liveCount = allTools.filter(t => t.status === 'live').length;
      const statEl = dom.$('#hero-stat-live');
      if (statEl) statEl.textContent = liveCount;

    } catch (err) {
      console.error('[RTHub] Failed to load tools:', err);
      container.innerHTML = '<div class="rt-empty"><div class="rt-empty__icon">⚠️</div><p class="rt-empty__text">Failed to load tools. Please refresh.</p></div>';
    }
  }

  function setupFilters() {
    const chipsContainer = dom.$('#filter-chips');
    if (!chipsContainer) return;

    // 1. Extract unique categories dynamically
    const categories = new Set();
    allTools.forEach(tool => {
      if (tool.category) {
        categories.add(tool.category);
      }
    });

    // 2. Build chip HTML
    let chipsHtml = `<button class="rt-chip" data-filter="All" aria-selected="true" type="button">All</button>`;
    
    // Sort categories alphabetically and add to HTML
    Array.from(categories).sort().forEach(category => {
      chipsHtml += `<button class="rt-chip" data-filter="${utils.escapeHtml(category)}" aria-selected="false" type="button">${utils.escapeHtml(category)}</button>`;
    });

    // Add Coming Soon special filter
    chipsHtml += `<button class="rt-chip" data-filter="Coming Soon" aria-selected="false" type="button">Coming Soon</button>`;

    chipsContainer.innerHTML = chipsHtml;

    // 3. Attach event listeners
    const chips = chipsContainer.querySelectorAll('.rt-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        // Update active state
        chips.forEach(c => c.setAttribute('aria-selected', 'false'));
        chip.setAttribute('aria-selected', 'true');
        
        // Filter and re-render
        currentCategory = chip.getAttribute('data-filter');
        currentPage = 1; // Reset to page 1
        updateToolsGrid();
      });
    });
  }

  function setupSearch() {
    const searchInput = dom.$('#tool-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value.toLowerCase().trim();
      currentPage = 1; // Reset to page 1
      updateToolsGrid();
    });
  }

  function updateToolsGrid() {
    const container = dom.$('#tools-grid');
    if (!container) return;

    // Apply Filters
    const filteredTools = allTools.filter(tool => {
      // 1. Category Filter
      let categoryMatch = true;
      if (currentCategory === 'Coming Soon') {
        categoryMatch = (tool.status === 'coming-soon');
      } else if (currentCategory !== 'All') {
        categoryMatch = (tool.category === currentCategory);
      }

      // 2. Search Filter
      let searchMatch = true;
      if (currentSearch) {
        const titleMatch = tool.name.toLowerCase().includes(currentSearch);
        const descMatch = tool.description.toLowerCase().includes(currentSearch);
        const tagMatch = (tool.tags || []).some(tag => tag.toLowerCase().includes(currentSearch));
        const catMatch = tool.category && tool.category.toLowerCase().includes(currentSearch);
        searchMatch = titleMatch || descMatch || tagMatch || catMatch;
      }

      return categoryMatch && searchMatch;
    });

    // Pagination Logic
    const totalPages = Math.ceil(filteredTools.length / TOOLS_PER_PAGE);
    if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
    
    const startIndex = (currentPage - 1) * TOOLS_PER_PAGE;
    const endIndex = startIndex + TOOLS_PER_PAGE;
    const paginatedTools = filteredTools.slice(startIndex, endIndex);

    // Render Grid
    if (filteredTools.length === 0) {
      container.innerHTML = '<div class="rt-empty" style="grid-column: 1 / -1; padding: 64px 0;"><div class="rt-empty__icon">🔍</div><p class="rt-empty__text">No tools found matching your criteria.</p></div>';
    } else {
      container.innerHTML = paginatedTools.map(tool => renderToolCard(tool)).join('');
    }

    // Render Pagination Controls
    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    const container = dom.$('#pagination-container');
    if (!container) {
      // If container doesn't exist, create it after grid
      const grid = dom.$('#tools-grid');
      const pag = dom.create('div', { id: 'pagination-container', class: 'rt-pagination u-mt-6 u-flex u-items-center u-justify-center' });
      grid.parentNode.insertBefore(pag, grid.nextSibling);
      return renderPagination(totalPages);
    }

    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = `<div style="display:flex; gap:8px;">`;
    
    // Prev Button
    if (currentPage > 1) {
      html += `<button class="rt-page-btn" data-page="${currentPage - 1}">← Prev</button>`;
    } else {
      html += `<button class="rt-page-btn rt-page-btn--disabled" disabled>← Prev</button>`;
    }

    // Page Numbers
    for (let i = 1; i <= totalPages; i++) {
      if (i === currentPage) {
        html += `<button class="rt-page-btn rt-page-btn--active" aria-current="page">${i}</button>`;
      } else {
        html += `<button class="rt-page-btn" data-page="${i}">${i}</button>`;
      }
    }

    // Next Button
    if (currentPage < totalPages) {
      html += `<button class="rt-page-btn" data-page="${currentPage + 1}">Next →</button>`;
    } else {
      html += `<button class="rt-page-btn rt-page-btn--disabled" disabled>Next →</button>`;
    }

    html += `</div>`;
    container.innerHTML = html;

    // Attach listeners
    container.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        currentPage = parseInt(e.target.getAttribute('data-page'), 10);
        updateToolsGrid();
        // Scroll back to top of grid
        dom.$('#tools-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function renderToolCard(tool) {
    const isLive = tool.status === 'live';
    const tags = (tool.tags || []).slice(0, CONFIG.maxTags);

    const tagHtml = tags.map(tag =>
      `<span class="rt-tag rt-tag--neutral">${utils.escapeHtml(tag)}</span>`
    ).join('');

    const statusBadge = isLive
      ? '<span class="rt-tag rt-tag--live">● LIVE</span>'
      : '<span class="rt-tag rt-tag--coming">Coming Soon</span>';

    const cardClass = isLive
      ? 'rt-card rt-card--hover rt-card--accent-top rt-tool-card'
      : 'rt-card rt-tool-card rt-tool-card--soon';

    const hrefAttr = isLive ? `href="./${tool.slug}/"` : '';
    const tagName = isLive ? 'a' : 'div';
    const arrowHtml = isLive
      ? '<div class="rt-tool-arrow" aria-hidden="true">→</div>'
      : '';

    const imageHtml = tool.thumbnail 
      ? `<div class="rt-tool-thumb"><img src="${tool.thumbnail}" alt="${utils.escapeHtml(tool.name)}" loading="lazy"></div>`
      : `<div style="font-size:32px;margin-bottom:12px;" aria-hidden="true">${tool.icon}</div>`;

    return (
      `<${tagName} ${hrefAttr} class="${cardClass}" ${!isLive ? 'aria-label="' + utils.escapeHtml(tool.name) + ' - Coming Soon"' : ''}>` +
      arrowHtml +
      imageHtml +
      `<h3 style="font-size:18px;font-weight:var(--rt-weight-extrabold);margin-bottom:8px;letter-spacing:-0.3px;">${utils.escapeHtml(tool.name)}</h3>` +
      `<p style="font-size:14px;color:var(--rt-text-secondary);line-height:1.7;margin-bottom:16px;flex:1;">${utils.escapeHtml(tool.description)}</p>` +
      `<div style="display:flex;gap:8px;flex-wrap:wrap;">${statusBadge}${tagHtml}</div>` +
      `</${tagName}>`
    );
  }

  /* ==========================================
     FAQ
     ========================================== */
  function initFAQ() {
    const container = dom.$('#faq-container');
    if (!container) return;

    const items = [
      {
        question: 'Are REDRAG Tools completely free to use?',
        answer: '<p>Yes, all REDRAG Tools are <strong>100% free</strong> to use. No signup, no subscription, and no hidden fees. We believe useful gaming utilities should be accessible to everyone.</p>'
      },
      {
        question: 'What tools are currently available on REDRAG Tools?',
        answer: '<p>Currently live: <strong>Game Storage Planner</strong> (calculate how many games fit on your SSD). Coming soon: VRAM Calculator for AI/LLMs, RAM Latency Calculator, Resolution Scaling Visualizer, Budget PC Build Configurator (India), and PSU Wattage Calculator.</p>'
      },
      {
        question: 'Do I need to download anything to use these tools?',
        answer: '<p>No downloads required. All tools run directly in your web browser. They work on desktop, mobile, and tablet without installing any software.</p>'
      },
      {
        question: 'Are the game install sizes in the Storage Planner accurate?',
        answer: '<p>Yes, we source game install sizes from official store pages (Steam, PlayStation Store, Xbox Store) and update them regularly. Sizes include base game + major updates but may vary slightly with future patches and DLC.</p>'
      },
      {
        question: 'Will there be more tools added in the future?',
        answer: '<p>Absolutely! We are actively building new calculators and planners. Next up: VRAM Calculator for AI models, RAM Latency comparison tool, and a full PC Build Configurator with India pricing.</p>'
      },
      {
        question: "Is my data private when using these tools?",
        answer: "<p>Yes. All calculations happen in your browser. We don't collect personal data, don't use cookies for tracking, and don't store your selections on our servers. We use privacy-first analytics (Plausible) that is GDPR compliant.</p>"
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
    const hubUrl = RT.config.urls.toolsHub;
    const blogUrl = RT.config.urls.blog;

    // 1. WebSite with SearchAction
    seo.websiteSchema();

    // 2. Organization
    seo.organizationSchema();

    // 3. ItemList (async, after tools load)
    injectItemListSchema();

    // 4. Article (About the Tools Hub)
    seo.injectSchema({
      '@context': 'https://schema.org',
      '@type': 'Article',
      '@id': hubUrl + '#article',
      headline: 'REDRAG Tools: Free Gaming Utilities & PC Calculators (2026)',
      description: 'Free gaming tools and PC calculators for gamers and PC builders. Game Storage Planner, VRAM Calculator, RAM Latency Tool, and more. No signup needed.',
      image: 'https://tools.redrag.in/assets/images/og-tools-hub.jpg',
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
      datePublished: '2026-07-31',
      dateModified: '2026-07-31',
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': hubUrl
      },
      articleSection: 'Gaming Tools',
      wordCount: 1800,
      inLanguage: 'en'
    }, 'rt-schema-article');

    // 5. HowTo
    seo.howToSchema({
      name: 'How to Use REDRAG Tools',
      description: "Get started with REDRAG's free gaming calculators and planners in 3 simple steps.",
      totalTime: 'PT1M',
      steps: [
        { name: 'Choose a Tool', text: 'Browse our collection of free gaming utilities. Click on any live tool to open it instantly in your browser.', url: hubUrl + '#step1' },
        { name: 'Enter Your Data', text: 'Fill in your specific details — select games, choose hardware, or input your budget. All calculations happen in real-time.', url: hubUrl + '#step2' },
        { name: 'Get Your Results', text: 'See instant results with visualizations, recommendations, and shareable summaries. Copy results or share via URL.', url: hubUrl + '#step3' }
      ],
      supplies: [],
      tools: ['Web Browser']
    });

    // 6. SoftwareApplication (Hub as platform)
    seo.softwareApplicationSchema({
      name: 'REDRAG Tools Hub',
      description: 'Collection of free gaming utilities and PC calculators including storage planner, VRAM calculator, and build configurator.',
      url: hubUrl,
      ratingValue: '4.9',
      ratingCount: '203'
    });

    // 7. FAQPage — auto-injected by RT.components.FAQ.init
    // 8. BreadcrumbList — inline in HTML <head>
  }

  async function injectItemListSchema() {
    try {
      const res = await fetch(CONFIG.registryUrl);
      const data = await res.json();
      const tools = data.tools || [];

      const items = tools.map((tool) => ({
        name: tool.name,
        slug: tool.slug,
        description: tool.description
      }));

      seo.itemListSchema(items);
    } catch (err) {
      console.warn('[RTHub] Could not inject ItemList schema:', err);
    }
  }

  /* ==========================================
     CTA
     ========================================== */
  function setupCTA() {
    const ctaBtn = dom.$('#cta-btn');
    const ctaTitle = dom.$('#cta-title');
    const ctaDesc = dom.$('#cta-desc');

    if (ctaBtn) {
      ctaBtn.addEventListener('click', () => {
        analytics.trackTool('hub', 'cta_click');
      });

      if (ctaTitle && ctaDesc) {
        const liveTools = allTools.filter(t => t.status === 'live');
        if (liveTools.length > 1) {
          // Add CSS transitions for smooth fading
          ctaTitle.style.transition = 'opacity 0.4s ease';
          ctaDesc.style.transition = 'opacity 0.4s ease';
          ctaBtn.style.transition = 'opacity 0.4s ease';

          let currentIndex = 0;
          setInterval(() => {
            currentIndex = (currentIndex + 1) % liveTools.length;
            const tool = liveTools[currentIndex];
            
            // Fade out
            ctaTitle.style.opacity = '0';
            ctaDesc.style.opacity = '0';
            ctaBtn.style.opacity = '0';
            
            setTimeout(() => {
              // Update content
              ctaTitle.textContent = `Ready to try ${tool.name}?`;
              ctaDesc.textContent = tool.description;
              ctaBtn.href = `./${tool.slug}/`;
              ctaBtn.innerHTML = `Try ${tool.name} &rarr;`;
              
              // Fade in
              ctaTitle.style.opacity = '1';
              ctaDesc.style.opacity = '1';
              ctaBtn.style.opacity = '1';
            }, 400); // wait for fade out
          }, 2500); // rotate every 2.5 seconds
        }
      }
    }
  }

  /* ==========================================
     PUBLIC API
     ========================================== */
  global.RTHub = {
    meta: { name: 'Tools Hub', slug: 'hub', version: '2.0.0' },
    init
  };

})(window);
