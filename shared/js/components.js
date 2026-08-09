/* ============================================
   REDRAG Tools — Components JavaScript
   Namespace: RT.components
   Shared Interactive Behaviors & Helpers
   Version: 2.0.0
   ============================================ */

(function (global) {
  'use strict';

  const RT = global.RT;
  if (!RT) {
    console.error('[RT.components] RT.core must be loaded first');
    return;
  }

  const { dom, utils } = RT;

  /* ==========================================
     1. ACCORDION
     ========================================== */
  const Accordion = {
    init(container, options) {
      const el = typeof container === 'string' ? dom.$(container) : container;
      if (!el) return;

      const config = Object.assign({ multiple: false, animated: true }, options);
      const items = el.querySelectorAll('.rt-accordion__item, .rt-faq__item');

      items.forEach(item => {
        const question = item.querySelector('.rt-accordion__question, .rt-faq__question');
        if (!question) return;

        question.addEventListener('click', () => {
          const isActive = item.classList.contains('is-active');

          if (!config.multiple) {
            items.forEach(i => this._close(i, config.animated));
          }

          if (!isActive) {
            this._open(item, config.animated);
          }
        });

        // Keyboard support
        question.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            question.click();
          }
        });
      });
    },

    _open(item, animated) {
      item.classList.add('is-active');
      const question = item.querySelector('.rt-accordion__question, .rt-faq__question');
      const answer = item.querySelector('.rt-accordion__answer, .rt-faq__answer');
      if (question) question.setAttribute('aria-expanded', 'true');

      if (answer && animated) {
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    },

    _close(item, animated) {
      item.classList.remove('is-active');
      const question = item.querySelector('.rt-accordion__question, .rt-faq__question');
      const answer = item.querySelector('.rt-accordion__answer, .rt-faq__answer');
      if (question) question.setAttribute('aria-expanded', 'false');

      if (answer && animated) {
        answer.style.maxHeight = '0';
      }
    }
  };

  /* ==========================================
     2. TABS
     ========================================== */
  const Tabs = {
    init(container) {
      const el = typeof container === 'string' ? dom.$(container) : container;
      if (!el) return;

      const tabs = el.querySelectorAll('[data-rt-tab]');
      const panels = el.querySelectorAll('[data-rt-panel]');

      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const target = tab.dataset.rtTab;

          tabs.forEach(t => t.classList.remove('is-active'));
          tab.classList.add('is-active');

          panels.forEach(p => {
            p.classList.toggle('is-active', p.dataset.rtPanel === target);
          });
        });
      });

      // Activate first tab by default
      if (tabs.length && !el.querySelector('.is-active[data-rt-tab]')) {
        tabs[0].click();
      }
    }
  };

  /* ==========================================
     3. TOAST
     ========================================== */
  const Toast = {
    _container: null,
    _toasts: new Map(),
    _idCounter: 0,

    _ensureContainer() {
      if (!this._container) {
        this._container = dom.create('div', { class: 'rt-toast-container' });
        document.body.appendChild(this._container);
      }
    },

    /**
     * Show a toast notification
     * @param {Object} config
     * @param {string} config.message
     * @param {string} [config.type='info'] — info, success, error, warning
     * @param {number} [config.duration=3000] — ms, 0 = persistent
     * @param {string} [config.position='bottom-center']
     * @param {boolean} [config.dismissible=true]
     * @param {Object} [config.action] — { label, onClick }
     * @returns {string} toastId
     */
    show(config) {
      this._ensureContainer();

      const id = 'toast-' + (++this._idCounter);
      const {
        message,
        type = 'info',
        duration = 3000,
        dismissible = true,
        action
      } = config;

      const toast = dom.create('div', {
        class: `rt-toast rt-toast--${type}`,
        role: 'status',
        'aria-live': 'polite',
        'data-toast-id': id
      });

      // Icon based on type
      const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
      };

      toast.appendChild(dom.create('span', { text: icons[type] || 'ℹ' }));
      toast.appendChild(dom.create('span', { text: message }));

      if (action && action.label) {
        const actionBtn = dom.create('button', {
          class: 'rt-btn rt-btn--ghost rt-btn--sm',
          text: action.label,
          style: 'margin-left:auto;'
        });
        actionBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (action.onClick) action.onClick();
          this.hide(id);
        });
        toast.appendChild(actionBtn);
      }

      if (dismissible && !action) {
        toast.style.cursor = 'pointer';
        toast.addEventListener('click', () => this.hide(id));
      }

      this._container.appendChild(toast);
      this._toasts.set(id, toast);

      // Trigger animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => toast.classList.add('is-visible'));
      });

      // Auto-dismiss
      if (duration > 0) {
        setTimeout(() => this.hide(id), duration);
      }

      return id;
    },

    /**
     * Hide a toast by ID
     * @param {string} id
     */
    hide(id) {
      const toast = this._toasts.get(id);
      if (!toast) return;

      toast.classList.remove('is-visible');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
        this._toasts.delete(id);
      }, 400);
    }
  };

  /* ==========================================
     4. TOOLTIP
     ========================================== */
  const Tooltip = {
    _activeTooltip: null,

    /**
     * Attach tooltip to an element
     * @param {Element} element
     * @param {Object} config
     * @param {string} config.content
     * @param {string} [config.position='top']
     * @param {number} [config.delay=300]
     */
    attach(element, config) {
      if (!element) return;

      const content = config.content || element.dataset.tooltip || '';
      if (!content) return;

      const position = config.position || element.dataset.tooltipPosition || 'top';
      const delay = config.delay || 300;

      let showTimeout;

      const show = () => {
        clearTimeout(showTimeout);
        showTimeout = setTimeout(() => {
          this._show(element, content, position);
        }, delay);
      };

      const hide = () => {
        clearTimeout(showTimeout);
        this._hide();
      };

      element.addEventListener('mouseenter', show);
      element.addEventListener('mouseleave', hide);
      element.addEventListener('focus', show);
      element.addEventListener('blur', hide);
    },

    _show(target, content, position) {
      this._hide();

      const tooltip = dom.create('div', {
        class: `rt-tooltip rt-tooltip--${position}`,
        text: content
      });

      document.body.appendChild(tooltip);
      this._activeTooltip = tooltip;

      // Position
      const rect = target.getBoundingClientRect();
      const tipRect = tooltip.getBoundingClientRect();

      let top, left;
      if (position === 'top') {
        top = rect.top + window.scrollY - tipRect.height - 8;
        left = rect.left + window.scrollX + (rect.width - tipRect.width) / 2;
      } else if (position === 'bottom') {
        top = rect.bottom + window.scrollY + 8;
        left = rect.left + window.scrollX + (rect.width - tipRect.width) / 2;
      } else if (position === 'left') {
        top = rect.top + window.scrollY + (rect.height - tipRect.height) / 2;
        left = rect.left + window.scrollX - tipRect.width - 8;
      } else {
        top = rect.top + window.scrollY + (rect.height - tipRect.height) / 2;
        left = rect.right + window.scrollX + 8;
      }

      tooltip.style.top = top + 'px';
      tooltip.style.left = Math.max(8, left) + 'px';

      requestAnimationFrame(() => tooltip.classList.add('is-visible'));
    },

    _hide() {
      if (this._activeTooltip) {
        const tip = this._activeTooltip;
        tip.classList.remove('is-visible');
        setTimeout(() => {
          if (tip.parentNode) tip.parentNode.removeChild(tip);
        }, 200);
        this._activeTooltip = null;
      }
    }
  };

  /* ==========================================
     5. MODAL
     ========================================== */
  const Modal = {
    _activeModal: null,

    /**
     * Create and open a modal
     * @param {Object} config
     * @param {string} config.title
     * @param {string|Element} config.content
     * @param {string} [config.size='md']
     * @param {boolean} [config.closable=true]
     * @param {boolean} [config.showFooter=true]
     * @param {Array} [config.footerButtons]
     * @returns {Object} { close, destroy }
     */
    open(config) {
      const {
        title,
        content,
        size = 'md',
        closable = true,
        showFooter = true,
        footerButtons = []
      } = config;

      // Overlay
      const overlay = dom.create('div', { class: 'rt-modal-overlay' });

      // Modal
      const modal = dom.create('div', { class: `rt-modal rt-modal--${size}` });

      // Header
      const header = dom.create('div', { class: 'rt-modal__header' });
      header.appendChild(dom.create('h3', { class: 'rt-modal__title', text: title }));

      if (closable) {
        const closeBtn = dom.create('button', {
          class: 'rt-modal__close',
          'aria-label': 'Close modal',
          text: '×'
        });
        closeBtn.addEventListener('click', () => instance.close());
        header.appendChild(closeBtn);
      }
      modal.appendChild(header);

      // Body
      const body = dom.create('div', { class: 'rt-modal__body' });
      if (typeof content === 'string') {
        body.innerHTML = content;
      } else if (content instanceof Node) {
        body.appendChild(content);
      }
      modal.appendChild(body);

      // Footer
      if (showFooter && footerButtons.length) {
        const footer = dom.create('div', { class: 'rt-modal__footer' });
        footerButtons.forEach(btnConfig => {
          const btn = dom.create('button', {
            class: `rt-btn rt-btn--${btnConfig.variant || 'secondary'}`,
            text: btnConfig.label
          });
          if (btnConfig.onClick) {
            btn.addEventListener('click', (e) => {
              btnConfig.onClick(e, instance);
            });
          }
          footer.appendChild(btn);
        });
        modal.appendChild(footer);
      }

      document.body.appendChild(overlay);
      document.body.appendChild(modal);
      document.body.style.overflow = 'hidden';

      // Animate in
      requestAnimationFrame(() => {
        overlay.classList.add('is-open');
        modal.classList.add('is-open');
      });

      // Event handlers
      const onOverlayClick = (e) => {
        if (e.target === overlay && closable) instance.close();
      };
      const onKeydown = (e) => {
        if (e.key === 'Escape' && closable) instance.close();
      };

      overlay.addEventListener('click', onOverlayClick);
      document.addEventListener('keydown', onKeydown);

      const instance = {
        overlay,
        modal,
        close() {
          overlay.classList.remove('is-open');
          modal.classList.remove('is-open');
          document.body.style.overflow = '';

          setTimeout(() => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (modal.parentNode) modal.parentNode.removeChild(modal);
          }, 300);

          overlay.removeEventListener('click', onOverlayClick);
          document.removeEventListener('keydown', onKeydown);
          this._activeModal = null;
        },
        destroy() {
          this.close();
        }
      };

      this._activeModal = instance;
      return instance;
    }
  };

  /* ==========================================
     6. LOADING SPINNER
     ========================================== */
  const Spinner = {
    /**
     * Create a spinner element
     * @param {Object} [config={}]
     * @param {string} [config.size='medium']
     * @param {string} [config.color='primary']
     * @returns {Element}
     */
    create(config) {
      const { size = 'medium', color = 'primary' } = config || {};
      return dom.create('span', {
        class: `rt-spinner rt-spinner--${size} rt-spinner--${color}`,
        'aria-hidden': 'true'
      });
    }
  };

  /* ==========================================
     7. SKELETON
     ========================================== */
  const Skeleton = {
    /**
     * Create a skeleton placeholder
     * @param {Object} [config={}]
     * @param {string} [config.variant='text']
     * @param {string} [config.width]
     * @param {string} [config.height]
     * @returns {Element}
     */
    create(config) {
      const { variant = 'text', width, height } = config || {};
      const el = dom.create('div', {
        class: `rt-skeleton rt-skeleton--${variant}`,
        'aria-hidden': 'true'
      });
      if (width) el.style.width = width;
      if (height) el.style.height = height;
      return el;
    }
  };

  /* ==========================================
     8. COMPONENT HELPERS
     ========================================== */

  /**
   * Create a button element
   */
  function createButton(config) {
    const {
      text,
      variant = 'primary',
      size,
      icon,
      iconPosition = 'left',
      fullWidth,
      disabled,
      loading,
      ariaLabel,
      onClick
    } = config;

    const classes = ['rt-btn', `rt-btn--${variant}`];
    if (size) classes.push(`rt-btn--${size}`);
    if (fullWidth) classes.push('rt-btn--full');

    const btn = dom.create('button', {
      class: classes.join(' '),
      'aria-label': ariaLabel || text,
      disabled: disabled || loading || false
    });

    if (loading) {
      btn.appendChild(Spinner.create({ size: 'small', color: 'white' }));
    } else if (icon && iconPosition === 'left') {
      btn.appendChild(dom.create('span', { text: icon }));
    }

    btn.appendChild(dom.create('span', { text: text || '' }));

    if (icon && iconPosition === 'right') {
      btn.appendChild(dom.create('span', { text: icon }));
    }

    if (onClick) {
      btn.addEventListener('click', onClick);
    }

    return btn;
  }

  /**
   * Create a card element
   */
  function createCard(config) {
    const {
      variant = 'default',
      padding,
      border = true,
      hover = false,
      accent,
      href,
      ariaLabel,
      children
    } = config;

    const classes = ['rt-card', `rt-card--${variant}`];
    if (hover) classes.push('rt-card--hover');
    if (accent) classes.push(`rt-card--accent-${accent}`);
    if (!border) classes.push('u-border-none');

    const tag = href ? 'a' : 'div';
    const card = dom.create(tag, {
      class: classes.join(' '),
      'aria-label': ariaLabel
    });

    if (href) card.href = href;
    if (padding) card.style.padding = padding;

    if (children) {
      const arr = Array.isArray(children) ? children : [children];
      arr.forEach(child => {
        if (typeof child === 'string') {
          card.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
          card.appendChild(child);
        }
      });
    }

    return card;
  }

  /**
   * Create an input element
   */
  function createInput(config) {
    const {
      type = 'text',
      placeholder,
      value,
      icon,
      clearable,
      debounce: debounceMs,
      min,
      max,
      ariaLabel,
      onInput,
      onChange
    } = config;

    const wrap = dom.create('div', { class: 'rt-input-wrap' });

    const input = dom.create('input', {
      type,
      class: `rt-input${icon ? ' rt-input--search' : ''}${type === 'number' ? ' rt-input--number' : ''}`,
      placeholder,
      value,
      'aria-label': ariaLabel,
      min,
      max
    });

    if (onInput) {
      const handler = debounceMs > 0 ? utils.debounce(onInput, debounceMs) : onInput;
      input.addEventListener('input', handler);
    }
    if (onChange) {
      input.addEventListener('change', onChange);
    }

    wrap.appendChild(input);

    if (clearable) {
      const clearBtn = dom.create('button', {
        class: 'rt-input-clear',
        'aria-label': 'Clear input',
        text: '×'
      });
      clearBtn.addEventListener('click', () => {
        input.value = '';
        input.dispatchEvent(new Event('input'));
        clearBtn.classList.remove('is-visible');
        input.focus();
      });
      input.addEventListener('input', () => {
        clearBtn.classList.toggle('is-visible', input.value.length > 0);
      });
      wrap.appendChild(clearBtn);
    }

    return wrap;
  }

  /**
   * Create a select dropdown
   */
  function createSelect(config) {
    const {
      options = [],
      value,
      placeholder = 'Select...',
      searchable,
      onChange
    } = config;

    const container = dom.create('div', { class: 'rt-select' });

    const trigger = dom.create('button', {
      class: 'rt-select__trigger',
      type: 'button',
      'aria-haspopup': 'listbox',
      'aria-expanded': 'false'
    });

    const label = dom.create('span', { class: 'rt-select__label', text: placeholder });
    const chevron = dom.create('span', { class: 'rt-select__chevron', text: '▼' });
    trigger.appendChild(label);
    trigger.appendChild(chevron);

    const dropdown = dom.create('div', {
      class: 'rt-select__dropdown',
      role: 'listbox'
    });

    let selectedValue = value;

    function renderOptions() {
      dom.clear(dropdown);
      options.forEach(opt => {
        const option = dom.create('div', {
          class: 'rt-select__option',
          role: 'option',
          'aria-selected': String(opt.value === selectedValue),
          text: opt.label
        });
        if (opt.disabled) option.classList.add('is-disabled');
        if (opt.value === selectedValue) option.classList.add('is-selected');

        option.addEventListener('click', () => {
          if (opt.disabled) return;
          selectedValue = opt.value;
          label.textContent = opt.label;
          trigger.setAttribute('aria-expanded', 'false');
          dropdown.classList.remove('is-open');
          renderOptions();
          if (onChange) onChange(opt.value, opt);
        });

        dropdown.appendChild(option);
      });
    }

    renderOptions();

    // Set initial label
    const initial = options.find(o => o.value === value);
    if (initial) label.textContent = initial.label;

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('is-open');
      trigger.setAttribute('aria-expanded', String(!isOpen));
      dropdown.classList.toggle('is-open', !isOpen);
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        trigger.setAttribute('aria-expanded', 'false');
        dropdown.classList.remove('is-open');
      }
    });

    container.appendChild(trigger);
    container.appendChild(dropdown);

    return container;
  }

  /* ==========================================
     9. SEARCH COMPONENT
     ========================================== */
  const Search = {
    /**
     * Create a search component
     * @param {Object} config
     * @returns {Object} { element, search, clear }
     */
    create(config) {
      const {
        placeholder = 'Search...',
        debounce: debounceMs = 200,
        onSearch
      } = config;

      let currentQuery = '';

      const input = createInput({
        type: 'search',
        placeholder,
        icon: true,
        clearable: true,
        debounce: debounceMs,
        ariaLabel: placeholder,
        onInput: (e) => {
          currentQuery = e.target.value.toLowerCase().trim();
          if (onSearch) onSearch(currentQuery);
        }
      });

      return {
        element: input,
        search: (query) => {
          const inp = input.querySelector('input');
          inp.value = query;
          inp.dispatchEvent(new Event('input'));
        },
        clear: () => {
          const inp = input.querySelector('input');
          inp.value = '';
          inp.dispatchEvent(new Event('input'));
        },
        get value() {
          return currentQuery;
        }
      };
    }
  };

  /* ==========================================
     10. FAQ COMPONENT
     ========================================== */
  const FAQ = {
    /**
     * Initialize FAQ section with schema injection
     * @param {Object} config
     */
    init(config) {
      const { container, items, showSchema = true, openFirst = false } = config;
      const el = typeof container === 'string' ? dom.$(container) : container;
      if (!el) return;

      // Build HTML
      items.forEach((item, index) => {
        const question = utils.escapeHtml(item.question);
        const answer = item.answer; // Allow HTML in answers

        const itemEl = dom.create('div', { class: 'rt-faq__item' });
        const qEl = dom.create('div', {
          class: 'rt-faq__question',
          role: 'button',
          'aria-expanded': 'false',
          tabindex: '0'
        });
        qEl.appendChild(dom.create('span', { html: question }));
        qEl.appendChild(dom.create('span', { class: 'rt-faq__icon', text: '+' }));

        const aEl = dom.create('div', { class: 'rt-faq__answer' });
        aEl.appendChild(dom.create('div', { html: answer }));

        itemEl.appendChild(qEl);
        itemEl.appendChild(aEl);
        el.appendChild(itemEl);
      });

      // Init accordion behavior
      Accordion.init(el, { multiple: false, animated: true });

      if (openFirst) {
        const first = el.querySelector('.rt-faq__item');
        if (first) Accordion._open(first, true);
      }

      // Inject schema
      if (showSchema && RT.seo && RT.seo.faqSchema) {
        RT.seo.faqSchema(items);
      }
    }
  };

  /* ==========================================
     11. AUTO-INIT
     ========================================== */
  function autoInit() {
    // Find all elements with data-rt-component and initialize
    dom.$$('[data-rt-component]').forEach(el => {
      const component = el.dataset.rtComponent;
      switch (component) {
        case 'accordion':
          Accordion.init(el);
          break;
        case 'tabs':
          Tabs.init(el);
          break;
        case 'tooltip':
          Tooltip.attach(el, {
            content: el.dataset.tooltip || '',
            position: el.dataset.tooltipPosition || 'top'
          });
          break;
      }
    });
  }

  /* ==========================================
     12. PUBLIC API
     ========================================== */
  RT.components = {
    Accordion,
    Tabs,
    Toast,
    Tooltip,
    Modal,
    Spinner,
    Skeleton,
    Search,
    FAQ,
    createButton,
    createCard,
    createInput,
    createSelect,
    autoInit
  };

})(window);
