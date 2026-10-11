// Loads the theme's React runtime (react/storefront.js, about 300 KB) only when something needs it: a plugin
// asks through window.FlexStorefrontLoader.load() (for example the cart drawer or the checkout), or the
// visitor turns to the header search. Until then the search works as a plain form.
const script = document.querySelector("script[data-flex-storefront-runtime]");
const runtimeUrl = script?.dataset.flexStorefrontRuntime || "";
let loading = null;

function load() {
  if (window.FlexStorefront) return Promise.resolve(window.FlexStorefront);
  if (!runtimeUrl) return Promise.reject(new Error("The storefront runtime is not available."));
  loading ??= import(runtimeUrl)
    .then(() => window.FlexStorefront)
    .catch((error) => {
      loading = null;
      throw error;
    });
  return loading;
}

window.FlexStorefrontLoader = Object.freeze({ load });

// The header search becomes the React search when the visitor is about to use it. The runtime mounts it with
// what was typed so far; focus and caret move to the new field.
for (const search of document.querySelectorAll('[data-flex-react="shop-search"]')) {
  const start = () => {
    load()
      .then((runtime) => {
        // The visitor may have clicked and typed while the runtime loaded: take the text, focus and caret
        // right before the React field replaces the plain one, and give them to the new field.
        const input = search.querySelector("input");
        const focused = input !== null && document.activeElement === input;
        const caret = focused ? input.selectionStart : null;
        if (!runtime.mount("shop-search", search, { initialValue: input?.value ?? "" }) || !focused) return;
        let frames = 0;
        const refocus = () => {
          const field = search.querySelector("input");
          if (field && field !== input) {
            field.focus();
            const position = Math.min(caret ?? field.value.length, field.value.length);
            field.setSelectionRange(position, position);
          } else if (++frames < 30) {
            requestAnimationFrame(refocus);
          }
        };
        refocus();
      })
      .catch(() => {});
  };
  for (const type of ["focusin", "pointerenter", "touchstart"]) {
    search.addEventListener(type, start, { once: true, passive: true });
  }
}

// Plugins written before lazy loading wait for the runtime at start; give it to them at once.
if (
  !window.FlexStorefrontLazyClients &&
  document.querySelector(
    "[data-commerce-cart-open], [data-commerce-cart-page], [data-commerce-checkout], [data-commerce-columns]",
  )
) {
  load().catch(() => {});
}
