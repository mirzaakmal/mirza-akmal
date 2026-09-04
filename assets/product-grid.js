/**
 * product-grid.js
 * Vanilla JS only (no jQuery), scoped per section instance so multiple
 * Product Grid sections can exist on the same page without collisions.
 *
 * Responsibilities:
 *  1. Fetch product JSON on "+" click and open the shared popup.
 *  2. Dynamically build variant option selectors from the product's
 *     variant list (no hardcoded option names/values).
 *  3. Resolve the selected variant as options change, update price
 *     and availability, and post the correct variant ID to /cart/add.js.
 *  4. Enforce the "Black + Medium auto-adds Soft Winter Jacket" rule
 *     using merchant-configurable trigger values (data attributes),
 *     not hardcoded strings.
 */

(function () {
  'use strict';

  document.querySelectorAll('[data-product-grid]').forEach(initProductGrid);

  function initProductGrid(root) {
    const modal = root.querySelector('[data-product-modal]');
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

    // Holds state for whichever product is currently open in the modal.
    let selectedOptions = []; // e.g. ["Black", "Medium"]

    // ── Open / close ──────────────────────────────────────────────

    root.querySelectorAll('[data-open-product-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const wrap = btn.closest('[data-product-handle]');
        const handle = wrap && wrap.dataset.productHandle;
        if (!handle) return;
        loadProduct(handle);
      });
    });

    modal.querySelectorAll('[data-modal-close]').forEach((el) => {
      el.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    function openModal() {
      modal.setAttribute('data-open', 'true');
      modal.setAttribute('aria-hidden', 'false');
    }

    function closeModal() {
      modal.removeAttribute('data-open');
      modal.setAttribute('aria-hidden', 'true');
      els.message.textContent = '';
    }

    // ── Fetch product JSON ────────────────────────────────────────

    function loadProduct(handle) {
      fetch(`/products/${handle}.js`)
        .then((res) => {
          if (!res.ok) throw new Error('Product fetch failed');
          return res.json();
        })
        .then((product) => {
          renderProduct(product);
          openModal();
        })
        .catch(() => {
          els.message.textContent = 'Sorry, this product could not be loaded.';
          openModal();
        });
    }

    // ── Render product info + build variant selectors ─────────────

    function renderProduct(product) {
      els.title.textContent = product.title;
      els.description.innerHTML = product.description || '';
      els.image.src = normalizeUrl(product.featured_image);
      els.image.alt = product.title;
      els.message.textContent = '';

      // Default to the first available variant, falling back to the first variant.
      const defaultVariant =
        product.variants.find((v) => v.available) || product.variants[0];
      selectedOptions = [
        defaultVariant.option1,
        defaultVariant.option2,
        defaultVariant.option3,
      ].filter(Boolean);

      buildOptionSelectors(product);
      updateForSelection(product);
    }

    function buildOptionSelectors(product) {
      els.options.innerHTML = '';

      // product.options is an array of option names, e.g. ["Color", "Size"].
      product.options.forEach((optionName, index) => {
        const values = uniqueOptionValues(product, index);

        const group = document.createElement('div');
        group.className = 'product-modal__option';

        const label = document.createElement('span');
        label.className = 'product-modal__option-label';
        label.textContent = optionName;
        group.appendChild(label);

        const valuesWrap = document.createElement('div');
        valuesWrap.className = 'product-modal__option-values';

        values.forEach((value) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'product-modal__option-value';
          btn.textContent = value;
          btn.dataset.optionIndex = String(index);
          btn.dataset.optionValue = value;
          btn.setAttribute(
            'data-selected',
            selectedOptions[index] === value ? 'true' : 'false'
          );

          btn.addEventListener('click', () => {
            selectedOptions[index] = value;
            buildOptionSelectors(product); // re-render to refresh selected/disabled states
            updateForSelection(product);
          });

          valuesWrap.appendChild(btn);
        });

        group.appendChild(valuesWrap);
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

    // ── Resolve currently selected variant + update UI ─────────────

    function findMatchingVariant(product) {
      return product.variants.find((variant) => {
        return [variant.option1, variant.option2, variant.option3]
          .filter(Boolean)
          .every((val, i) => val === selectedOptions[i]);
      });
    }

    function updateForSelection(product) {
      const variant = findMatchingVariant(product);

      els.price.textContent = variant
        ? formatMoney(variant.price, moneyFormat)
        : 'Unavailable';

      const available = Boolean(variant && variant.available);
      els.addToCartBtn.disabled = !available;
      els.addToCartBtn.textContent = available ? 'ADD TO CART' : 'SOLD OUT';

      els.addToCartBtn.onclick = available
        ? () => handleAddToCart(variant)
        : null;
    }

    // ── Add to cart + linked product rule ──────────────────────────

    function handleAddToCart(variant) {
      els.addToCartBtn.disabled = true;
      els.message.textContent = 'Adding to cart…';

      const items = [{ id: variant.id, quantity: 1 }];

      // If both trigger values are present on the selected variant,
      // queue up the linked product's first available variant too.
      const variantValues = [variant.option1, variant.option2, variant.option3]
        .filter(Boolean)
        .map((v) => v.toLowerCase());

      const shouldAddLinkedProduct =
        linkedProductHandle &&
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
          .catch(() => addItemsToCart(items)); // fall back to just the main item
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
          els.message.textContent =
            items.length > 1
              ? 'Added to cart, including a bonus item!'
              : 'Added to cart!';
          els.addToCartBtn.disabled = false;
          document.dispatchEvent(new CustomEvent('cart:updated'));
        })
        .catch(() => {
          els.message.textContent = 'Something went wrong. Please try again.';
          els.addToCartBtn.disabled = false;
        });
    }

    // ── Helpers ─────────────────────────────────────────────────────

    function normalizeUrl(url) {
      if (!url) return '';
      return url.startsWith('//') ? `https:${url}` : url;
    }

    // Formats a price (in cents) using the shop's money_format string,
    // e.g. "${{amount}}" -> "$25.00". Keeps this section independent
    // of any Dawn/global formatMoney helper.
    function formatMoney(cents, format) {
      const amount = (cents / 100).toFixed(2);
      return format.replace(/\{\{\s*amount\s*\}\}/, amount);
    }
  }
})();

