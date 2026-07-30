/* ============================================
   REDRAG Tools — SEO JavaScript
   Namespace: RT.seo
   Schema.org JSON-LD Template Helpers
   Version: 2.0.0
   ============================================ */

(function (global) {
  'use strict';

  const RT = global.RT;
  if (!RT) {
    console.error('[RT.seo] RT.core must be loaded first');
    return;
  }

  const { dom, utils } = RT;

  /* ==========================================
     1. SCHEMA INJECTION
     ========================================== */

  /**
   * Inject a JSON-LD script tag into the document head
   * @param {Object} data — the schema object
   * @param {string} [id] — optional ID for the script tag
   */
  function injectSchema(data, id) {
    if (!data || typeof data !== 'object') {
      console.warn('[RT.seo] Invalid schema data');
      return;
    }

    const scriptId = id || 'rt-schema-' + Math.random().toString(36).slice(2, 9);

    // Remove existing schema with same ID
    const existing = dom.$('#' + scriptId);
    if (existing) existing.remove();

    const script = dom.create('script', {
      id: scriptId,
      type: 'application/ld+json',
      text: JSON.stringify(data)
    });

    document.head.appendChild(script);
  }

  /* ==========================================
     2. SCHEMA TEMPLATES
     ========================================== */

  /**
   * BreadcrumbList schema
   * @param {Array} items — [{name, item (URL)}, ...]
   */
  function breadcrumbSchema(items) {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.item
      }))
    };
    injectSchema(data, 'rt-schema-breadcrumb');
  }

  /**
   * SoftwareApplication schema for a tool
   * @param {Object} config
   */
  function softwareApplicationSchema(config) {
    const {
      name,
      description,
      url,
      category = 'UtilityApplication',
      os = 'Web Browser',
      ratingValue,
      ratingCount,
      authorName = 'REDRAG',
      authorUrl = RT.config.urls.blog
    } = config;

    const data = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name,
      applicationCategory: category,
      operatingSystem: os,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'INR'
      },
      description,
      url,
      author: {
        '@type': 'Organization',
        name: authorName,
        url: authorUrl
      }
    };

    if (ratingValue && ratingCount) {
      data.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: String(ratingValue),
        ratingCount: String(ratingCount)
      };
    }

    injectSchema(data, 'rt-schema-software');
  }

  /**
   * FAQPage schema
   * @param {Array} items — [{question, answer}, ...]
   */
  function faqSchema(items) {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: items.map(item => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: stripHtml(item.answer)
        }
      }))
    };
    injectSchema(data, 'rt-schema-faq');
  }

  /**
   * HowTo schema
   * @param {Object} config
   */
  function howToSchema(config) {
    const {
      name,
      description,
      totalTime,
      steps = [],
      supplies = [],
      tools = []
    } = config;

    const data = {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name,
      description,
      totalTime,
      step: steps.map((step, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        name: step.name,
        text: step.text,
        url: step.url || undefined
      }))
    };

    if (supplies.length) {
      data.supply = supplies.map(s => ({
        '@type': 'HowToSupply',
        name: s
      }));
    }

    if (tools.length) {
      data.tool = tools.map(t => ({
        '@type': 'HowToTool',
        name: t
      }));
    }

    injectSchema(data, 'rt-schema-howto');
  }

  /**
   * Article schema
   * @param {Object} config
   */
  function articleSchema(config) {
    const {
      headline,
      description,
      image,
      authorName = 'REDRAG',
      authorUrl = RT.config.urls.blog,
      publisherName = 'REDRAG',
      publisherLogo,
      datePublished,
      dateModified,
      url
    } = config;

    const data = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline,
      description,
      image,
      author: {
        '@type': 'Organization',
        name: authorName,
        url: authorUrl
      },
      publisher: {
        '@type': 'Organization',
        name: publisherName,
        logo: publisherLogo ? {
          '@type': 'ImageObject',
          url: publisherLogo
        } : undefined
      },
      datePublished,
      dateModified: dateModified || datePublished,
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': url
      }
    };

    injectSchema(data, 'rt-schema-article');
  }

  /**
   * WebSite schema
   */
  function websiteSchema() {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'REDRAG Tools',
      url: RT.config.urls.toolsHub,
      description: 'Free gaming tools and PC calculators for gamers and PC builders.',
      publisher: {
        '@type': 'Organization',
        name: 'REDRAG',
        url: RT.config.urls.blog,
        logo: {
          '@type': 'ImageObject',
          url: RT.config.urls.blog + 'assets/logo.png'
        }
      }
    };
    injectSchema(data, 'rt-schema-website');
  }

  /**
   * Organization schema
   */
  function organizationSchema() {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'REDRAG',
      url: RT.config.urls.blog,
      logo: RT.config.urls.blog + 'assets/logo.png',
      sameAs: [
        // Add social profiles here when available
      ]
    };
    injectSchema(data, 'rt-schema-organization');
  }

  /**
   * ItemList schema (for hub page tool listings)
   * @param {Array} items — tool objects from registry
   */
  function itemListSchema(items) {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'SoftwareApplication',
          name: item.name,
          applicationCategory: 'UtilityApplication',
          operatingSystem: 'Web Browser',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'INR'
          },
          url: RT.config.urls.toolsHub + item.slug + '/',
          description: item.description
        }
      }))
    };
    injectSchema(data, 'rt-schema-itemlist');
  }

  /* ==========================================
     3. META TAG HELPERS
     ========================================== */

  /**
   * Set or update a meta tag
   * @param {string} name — meta name or property
   * @param {string} content
   * @param {string} [attr='name'] — 'name' or 'property'
   */
  function setMeta(name, content, attr) {
    attr = attr || (name.startsWith('og:') || name.startsWith('twitter:') ? 'property' : 'name');
    let meta = document.querySelector(`meta[${attr}="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attr, name);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  }

  /**
   * Update Open Graph meta tags
   * @param {Object} config
   */
  function setOpenGraph(config) {
    const {
      title,
      description,
      url,
      image,
      siteName = 'REDRAG Tools',
      type = 'website'
    } = config;

    if (title) setMeta('og:title', title, 'property');
    if (description) setMeta('og:description', description, 'property');
    if (url) setMeta('og:url', url, 'property');
    if (image) setMeta('og:image', image, 'property');
    setMeta('og:site_name', siteName, 'property');
    setMeta('og:type', type, 'property');
  }

  /**
   * Update Twitter Card meta tags
   * @param {Object} config
   */
  function setTwitterCard(config) {
    const {
      title,
      description,
      image,
      card = 'summary_large_image'
    } = config;

    setMeta('twitter:card', card, 'name');
    if (title) setMeta('twitter:title', title, 'name');
    if (description) setMeta('twitter:description', description, 'name');
    if (image) setMeta('twitter:image', image, 'name');
  }

  /* ==========================================
     4. UTILITY
     ========================================== */

  /**
   * Strip HTML tags from a string
   * @param {string} html
   * @returns {string}
   */
  function stripHtml(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  /**
   * Generate canonical URL for current page
   * @returns {string}
   */
  function getCanonicalUrl() {
    const canonical = dom.$('link[rel="canonical"]');
    if (canonical) return canonical.href;
    return window.location.href.split('?')[0];
  }

  /* ==========================================
     5. PUBLIC API
     ========================================== */
  RT.seo = {
    injectSchema,
    breadcrumbSchema,
    softwareApplicationSchema,
    faqSchema,
    howToSchema,
    articleSchema,
    websiteSchema,
    organizationSchema,
    itemListSchema,
    setMeta,
    setOpenGraph,
    setTwitterCard,
    stripHtml,
    getCanonicalUrl
  };

})(window);
