import * as React from "react";
import { createRoot } from "react-dom/client";

const components = new Map();
const roots = new WeakMap();

function mount(name, element, props = {}) {
  if (!(element instanceof HTMLElement) || roots.has(element)) return false;
  const Component = components.get(name);
  if (!Component) return false;
  const fallback = [...element.childNodes].map((node) => node.cloneNode(true));
  const root = createRoot(element, {
    onUncaughtError(error) {
      console.error("Flex storefront component failed:", name, error);
      queueMicrotask(() => {
        root.unmount();
        roots.delete(element);
        element.replaceChildren(...fallback);
        delete element.dataset.flexReactMounted;
      });
    },
  });
  roots.set(element, root);
  element.dataset.flexReactMounted = name;
  root.render(React.createElement(Component, props));
  return true;
}
function unmount(element) {
  const root = roots.get(element);
  if (!root) return false;
  root.unmount();
  roots.delete(element);
  delete element.dataset.flexReactMounted;
  return true;
}
function register(name, Component) {
  if (!/^[a-z][a-z0-9.-]*$/.test(name) || typeof Component !== "function")
    throw new TypeError("Invalid storefront component");
  if (components.has(name)) return;
  components.set(name, Component);
}
function ShopSearch({ initialValue = "" }) {
  const [query, setQuery] = React.useState(initialValue);
  const [open, setOpen] = React.useState(false);
  const [products, setProducts] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const input = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    setProducts([]);
    setActive(-1);
    const timer = setTimeout(
      async () => {
        try {
          const response = await fetch(
            "/plugins/flex/commerce/suggestions?q=" +
              encodeURIComponent(query.trim()),
            { signal: controller.signal },
          );
          if (!response.ok) throw new Error("Search unavailable");
          const data = await response.json();
          if (!controller.signal.aborted) {
            setProducts(data.products);
            setLoading(false);
          }
        } catch (error) {
          if (!controller.signal.aborted) {
            setFailed(true);
            setLoading(false);
          }
        }
      },
      query ? 200 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);
  React.useEffect(() => {
    function outside(event) {
      if (!input.current?.closest(".shop-search")?.contains(event.target))
        setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  function keydown(event) {
    if (event.key === "Escape") {
      setOpen(false);
      event.preventDefault();
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive((value) =>
        event.key === "ArrowDown"
          ? Math.min(value + 1, products.length - 1)
          : Math.max(value - 1, -1),
      );
    }
    if (event.key === "Enter" && open && active >= 0 && products[active]) {
      event.preventDefault();
      if (window.FlexNavigation)
        window.FlexNavigation.navigate(products[active].url);
      else window.location.assign(products[active].url);
    }
  }
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "label",
      { className: "visually-hidden", htmlFor: "shop-product-search" },
      "Търсене на продукти",
    ),
    React.createElement("input", {
      id: "shop-product-search",
      ref: input,
      role: "combobox",
      autoComplete: "off",
      "aria-autocomplete": "list",
      "aria-expanded": open,
      "aria-controls": "shop-suggestions",
      "aria-activedescendant":
        open && active >= 0 ? "shop-suggestion-" + active : undefined,
      onFocus: () => setOpen(true),
      onKeyDown: keydown,
      onBlur: (event) => {
        if (
          !event.currentTarget
            .closest(".shop-search")
            ?.contains(event.relatedTarget)
        )
          setOpen(false);
      },
      type: "search",
      name: "q",
      value: query,
      onChange: (event) => {
        setQuery(event.target.value);
        setOpen(true);
      },
      maxLength: 150,
      placeholder: "Какво търсите днес?",
    }),
    React.createElement(
      "button",
      { type: "submit", "aria-label": "Търси продукти" },
      React.createElement(
        "svg",
        {
          viewBox: "0 0 24 24",
          width: 20,
          height: 20,
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1.8,
          "aria-hidden": true,
        },
        React.createElement("circle", { cx: 10.5, cy: 10.5, r: 6.5 }),
        React.createElement("path", { d: "m16 16 4.5 4.5" }),
      ),
    ),
    open &&
      React.createElement(
        "div",
        { className: "shop-suggestions-panel" },
        React.createElement(
          "p",
          { className: "shop-suggestions-heading" },
          query.trim() ? "Предложения за вас" : "Разгледайте тези продукти",
        ),
        React.createElement(
          "div",
          {
            id: "shop-suggestions",
            role: "listbox",
            "aria-label": "Предложени продукти",
            "aria-busy": loading,
          },
          products.map((product, index) =>
            React.createElement(
              "a",
              {
                key: product.url,
                id: "shop-suggestion-" + index,
                role: "option",
                "aria-selected": index === active,
                className: "shop-suggestion",
                href: product.url,
                onPointerDown: (event) => event.preventDefault(),
              },
              product.image &&
                React.createElement("img", {
                  src: product.image,
                  alt: "",
                  width: 52,
                  height: 52,
                }),
              React.createElement(
                "span",
                null,
                React.createElement(
                  "span",
                  { className: "shop-suggestion-name" },
                  product.name,
                ),
                React.createElement(
                  "span",
                  { className: "shop-suggestion-price" },
                  product.price + " " + product.currency,
                ),
              ),
            ),
          ),
        ),
        React.createElement(
          "p",
          { className: "shop-suggestions-status", role: "status" },
          loading
            ? "Търсене…"
            : failed
              ? "Предложенията не са достъпни. Използвайте бутона за търсене."
              : !products.length
                ? "Няма намерени продукти."
                : "",
        ),
        React.createElement(
          "a",
          {
            className: "shop-suggestions-all",
            href:
              "/catalog?q=" + encodeURIComponent(query),
          },
          query.trim() ? "Виж всички резултати →" : "Към каталога →",
        ),
      ),
  );
}
register("shop-search", ShopSearch);
const runtime = Object.freeze({
  apiVersion: 1,
  React,
  createRoot,
  register,
  mount,
  unmount,
});
window.FlexStorefront = runtime;
// With the theme's lazy loader (assets/storefront-loader.js) the loader mounts the search itself, keeping the
// visitor's text, focus and caret; otherwise the search is mounted here.
if (!window.FlexStorefrontLoader) {
  for (const element of document.querySelectorAll(
    '[data-flex-react="shop-search"]',
  )) {
    mount("shop-search", element, {
      initialValue: element.querySelector("input")?.value ?? "",
    });
  }
}
window.dispatchEvent(
  new CustomEvent("flex:storefront-ready", { detail: runtime }),
);
export { React, register, mount, unmount };
