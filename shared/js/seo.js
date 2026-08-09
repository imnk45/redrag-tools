/* ============================================
   REDRAG Tools — SEO JavaScript
   Namespace: RT.seo
   Schema.org JSON-LD Template Helpers
   Version: 2.1.0 (Phase 7 — Enhanced)
   ============================================ */

(function (global) {
  'use strict';

  const RT = global.RT;
  if (!RT) {
    console.error('[RT.seo] RT.core must be loaded first');
    return;
  }

  const { dom } = RT;

  /* ==========================================
     SCHEMA INJECTION
     ========================================== */

  function injectSchema(data, id) {
    if (!data || typeof data !== 'object') {
      console.warn('[RT.seo] Invalid schema data');
      return;
    }

    const scriptId = id || 'rt-schema-' + Math.random().toString(36).slice(2, 9);

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
     SCHEMA TEMPLATES
     ========================================== */

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
        ratingCount: String(ratingCount),
        bestRating: '5',
        worstRating: '1'
      };
    }

    injectSchema(data, 'rt-schema-software');
  }

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
      url,
      wordCount,
      articleSection,
      mainEntity
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

    if (wordCount) data.wordCount = wordCount;
    if (articleSection) data.articleSection = articleSection;
    if (mainEntity) data.mainEntity = mainEntity;

    injectSchema(data, 'rt-schema-article');
  }

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
      },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: RT.config.urls.toolsHub + '?q={search_term_string}'
        },
        'query-input': 'required name=search_term_string'
      }
    };
    injectSchema(data, 'rt-schema-website');
  }

  function organizationSchema() {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'REDRAG',
      url: RT.config.urls.blog,
      logo: RT.config.urls.blog + 'assets/logo.png',
      sameAs: [
        // Add social profiles here when available
      ],
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'Customer Support',
        url: RT.config.urls.blog + 'p/contact-us.html'
      }
    };
    injectSchema(data, 'rt-schema-organization');
  }

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
     META TAG HELPERS
     ========================================== */

  function setMeta(name, content, attr) {
    attr = attr || (name.startsWith('og:') || name.startsWith('twitter:') || name.startsWith('article:') ? 'property' : 'name');
    let meta = document.querySelector(`meta[${attr}="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attr, name);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  }

  function setOpenGraph(config) {
    const {
      title,
      description,
      url,
      image,
      imageWidth,
      imageHeight,
      imageAlt,
      siteName = 'REDRAG Tools',
      type = 'website',
      locale = 'en_US'
    } = config;

    if (title) setMeta('og:title', title, 'property');
    if (description) setMeta('og:description', description, 'property');
    if (url) setMeta('og:url', url, 'property');
    if (image) setMeta('og:image', image, 'property');
    if (imageWidth) setMeta('og:image:width', String(imageWidth), 'property');
    if (imageHeight) setMeta('og:image:height', String(imageHeight), 'property');
    if (imageAlt) setMeta('og:image:alt', imageAlt, 'property');
    setMeta('og:site_name', siteName, 'property');
    setMeta('og:type', type, 'property');
    setMeta('og:locale', locale, 'property');
  }

  function setTwitterCard(config) {
    const {
      title,
      description,
      image,
      imageAlt,
      card = 'summary_large_image',
      site = '@redragblog',
      creator = '@redragblog',
      label1,
      data1,
      label2,
      data2
    } = config;

    setMeta('twitter:card', card, 'name');
    setMeta('twitter:site', site, 'name');
    setMeta('twitter:creator', creator, 'name');
    if (title) setMeta('twitter:title', title, 'name');
    if (description) setMeta('twitter:description', description, 'name');
    if (image) setMeta('twitter:image', image, 'name');
    if (imageAlt) setMeta('twitter:image:alt', imageAlt, 'name');
    if (label1) setMeta('twitter:label1', label1, 'name');
    if (data1) setMeta('twitter:data1', data1, 'name');
    if (label2) setMeta('twitter:label2', label2, 'name');
    if (data2) setMeta('twitter:data2', data2, 'name');
  }

  /* ==========================================
     UTILITY
     ========================================== */

  function stripHtml(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  function getCanonicalUrl() {
    const canonical = dom.$('link[rel="canonical"]');
    if (canonical) return canonical.href;
    return window.location.href.split('?')[0];
  }

  /* ==========================================
     PUBLIC API
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
