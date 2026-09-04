/**
 * product-grid.js
 * Scoped per section instance for Shopify.
 */
(function () {
  'use strict';

  document.querySelectorAll('[data-product-grid]').forEach(initProductGrid);

  function initProductGrid(root) {
    const modal = root.querySelector('[data-product-modal]');
    if (!modal) return;

    const moneyFormat = root.dataset.moneyFormat || '${{amount}}';
    const linkedProductHandle = root.dataset.linkedProductHandle;
    const triggerA = (root.dataset.triggerOptionA || '').toLowerCase();
    const triggerB = (root.dataset.triggerOptionB || '').toLowerCase();

    const els = {
      image: modal.querySelector('[data-modal-image]'),
      title: modal.querySelector('[data-modal-title]'),
      price: modal.querySelector('[data-modal-price]'),
      description: modal.querySelector('[data-modal-description]'),
      options: modal.querySelector('[data-modal-options]'),
      addToCartBtn: modal.querySelector('[data-add-to-cart]'),
      message: modal.querySelector('[data-modal-message]'),
    };

    let currentProduct = null;
    let selectedOptions = [];

    // Open / Close triggers
    root.querySelectorAll('[data-open-product-modal]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const wrap = btn.closest('[data-product-handle]');
        const handle = wrap && wrap.dataset.productHandle;
        if (!handle) return;
        loadProduct(handle);
      });
    });

    modal.querySelectorAll('[data-modal-close]').forEach((el) => {
      el.addEventListener('click', closeModal);
    });

    const overlay = modal.querySelector('.product-modal__overlay');
    if (overlay) {
      overlay.addEventListener('click', closeModal);
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    function openModal() {
      modal.setAttribute('data-open', 'true');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      modal.removeAttribute('data-open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (els.message) els.message.textContent = '';
    }

    function loadProduct(handle) {
      if (els.message) els.message.textContent = 'Loading...';
      fetch(`/products/${handle}.js`)
        .then((res) => {
          if (!res.ok) throw new Error('Product fetch failed');
          return res.json();
        })
        .then((product) => {
          currentProduct = product;
          renderProduct(product);
          openModal();
        })
        .catch(() => {
          if (els.message) els.message.textContent = 'Sorry, this product could not be loaded.';
          openModal();
        });
    }

    function renderProduct(product) {
      if (els.title) els.title.textContent = product.title;
      if (els.description) els.description.innerHTML = product.description || '';
      if (els.image) {
        els.image.src = normalizeUrl(product.featured_image || (product.images && product.images[0]));
        els.image.alt = product.title;
      }
      if (els.message) els.message.textContent = '';

      const defaultVariant = product.variants.find((v) => v.available) || product.variants[0];
      selectedOptions = defaultVariant
        ? [defaultVariant.option1, defaultVariant.option2, defaultVariant.option3].filter(Boolean)
        : [];

      buildOptionSelectors(product);
      updateForSelection(product);
    }

    function buildOptionSelectors(product) {
      if (!els.options) return;
      els.options.innerHTML = '';

      if (!product.options || !product.options.length) return;

      product.options.forEach((optionObj, index) => {
        // FIX: Safely extract string name to prevent [OBJECT OBJECT]
        const optionName = typeof optionObj === 'object' && optionObj !== null
          ? (optionObj.name || `Option ${index + 1}`)
          : String(optionObj);

        if (optionName.toLowerCase() === 'title' && product.variants.length === 1 && product.variants[0].title === 'Default Title') {
          return;
        }

        const values = uniqueOptionValues(product, index);

        const group = document.createElement('div');
        group.className = 'product-modal__option';

        const label = document.createElement('label');
        label.className = 'product-modal__option-label';
        label.textContent = optionName;
        group.appendChild(label);

        const lowerName = optionName.toLowerCase();

        // Size selector -> Dropdown select box matching Image 2
        if (lowerName.includes('size') || values.length > 5) {
          const selectWrap = document.createElement('div');
          selectWrap.className = 'product-modal__select-wrap';

          const select = document.createElement('select');
          select.className = 'product-modal__select';

          const defaultOption = document.createElement('option');
          defaultOption.value = '';
          defaultOption.textContent = 'Choose your size';
          defaultOption.disabled = true;
          if (!selectedOptions[index]) defaultOption.selected = true;
          select.appendChild(defaultOption);

          values.forEach((val) => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            if (selectedOptions[index] === val) opt.selected = true;
            select.appendChild(opt);
          });

          select.addEventListener('change', (e) => {
            selectedOptions[index] = e.target.value;
            updateForSelection(product);
            buildOptionSelectors(product);
          });

          const arrow = document.createElement('div');
          arrow.className = 'product-modal__select-arrow';
          arrow.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

          selectWrap.appendChild(select);
          selectWrap.appendChild(arrow);
          group.appendChild(selectWrap);
        } else {
          // Color & segment options -> Full width bordered side-by-side buttons
          const valuesWrap = document.createElement('div');
          valuesWrap.className = 'product-modal__option-values';

          values.forEach((value) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'product-modal__option-value';
            btn.textContent = value;
            btn.dataset.optionIndex = String(index);
            btn.dataset.optionValue = value;
            btn.setAttribute('data-selected', selectedOptions[index] === value ? 'true' : 'false');

            btn.addEventListener('click', () => {
              selectedOptions[index] = value;
              buildOptionSelectors(product);
              updateForSelection(product);
            });

            valuesWrap.appendChild(btn);
          });

          group.appendChild(valuesWrap);
        }

        els.options.appendChild(group);
      });
    }

    function uniqueOptionValues(product, index) {
      const key = `option${index + 1}`;
      const seen = [];
      product.variants.forEach((variant) => {
        if (variant[key] && !seen.includes(variant[key])) {
          seen.push(variant[key]);
        }
      });
      return seen;
    }

    function findMatchingVariant(product) {
      return product.variants.find((variant) => {
        return [variant.option1, variant.option2, variant.option3]
          .filter(Boolean)
          .every((val, i) => val === selectedOptions[i]);
      });
    }

    function updateForSelection(product) {
      const variant = findMatchingVariant(product);

      if (els.price) {
        els.price.textContent = variant
          ? formatMoney(variant.price, moneyFormat)
          : 'Unavailable';
      }

      const available = Boolean(variant && variant.available);
      if (els.addToCartBtn) {
        els.addToCartBtn.disabled = !available;
        els.addToCartBtn.innerHTML = available
          ? `<span>ADD TO CART</span><span class="product-modal__add-arrow">⟶</span>`
          : `<span>SOLD OUT</span>`;

        els.addToCartBtn.onclick = available ? () => handleAddToCart(variant) : null;
      }
    }

    function handleAddToCart(variant) {
      if (!variant) return;
      els.addToCartBtn.disabled = true;
      if (els.message) els.message.textContent = 'Adding to cart…';

      const items = [{ id: variant.id, quantity: 1 }];

      const variantValues = [variant.option1, variant.option2, variant.option3]
        .filter(Boolean)
        .map((v) => v.toLowerCase());

      const shouldAddLinkedProduct =
        linkedProductHandle &&
        triggerA &&
        triggerB &&
        variantValues.includes(triggerA) &&
        variantValues.includes(triggerB);

      if (shouldAddLinkedProduct) {
        fetch(`/products/${linkedProductHandle}.js`)
          .then((res) => res.json())
          .then((linkedProduct) => {
            const linkedVariant =
              linkedProduct.variants.find((v) => v.available) ||
              linkedProduct.variants[0];
            if (linkedVariant) {
              items.push({ id: linkedVariant.id, quantity: 1 });
            }
            addItemsToCart(items);
          })
          .catch(() => addItemsToCart(items));
      } else {
        addItemsToCart(items);
      }
    }

    function addItemsToCart(items) {
      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
        .then((res) => {
          if (!res.ok) throw new Error('Add to cart failed');
          return res.json();
        })
        .then(() => {
          if (els.message) {
            els.message.textContent =
              items.length > 1
                ? 'Added to cart, including bonus item!'
                : 'Added to cart!';
          }
          if (els.addToCartBtn) els.addToCartBtn.disabled = false;
          document.dispatchEvent(new CustomEvent('cart:updated'));
        })
        .catch(() => {
          if (els.message) els.message.textContent = 'Something went wrong. Please try again.';
          if (els.addToCartBtn) els.addToCartBtn.disabled = false;
        });
    }

    function normalizeUrl(url) {
      if (!url) return '';
      return url.startsWith('//') ? `https:${url}` : url;
    }

    function formatMoney(cents, format) {
      if (cents == null) return '';
      const amount = (cents / 100).toFixed(2).replace('.', ',');
      if (format.includes('{{amount}}')) {
        return format.replace(/\{\{\s*amount\s*\}\}/, amount);
      }
      return `${amount}€`;
    }
  }
})();