function updateNavigationLinks() {
  const normalize = path => path.replace(/\/$/, "") || "/";
  const current = normalize(location.pathname);
  for (const link of document.querySelectorAll(".shop-navigation > a")) {
    const target = normalize(new URL(link.href, location.href).pathname);
    link.removeAttribute("aria-current");
    if (target === current) link.setAttribute("aria-current", "page");
    else if (target === "/catalog" && current.startsWith("/product/")) link.setAttribute("aria-current", "location");
  }
}
updateNavigationLinks();
const menus = [...document.querySelectorAll(".shop-navigation details")];
function closeMenu(menu, restoreFocus = false) {
  menu.open = false;
  if (restoreFocus) menu.querySelector("summary")?.focus();
}
document.addEventListener("click", (event) => {
  for (const menu of menus) {
    if (menu.open && !menu.contains(event.target)) closeMenu(menu);
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  for (const menu of menus) {
    if (!menu.open) continue;
    closeMenu(menu, menu.contains(document.activeElement));
    event.preventDefault();
  }
});
for (const menu of menus) {
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) closeMenu(menu);
  });
  menu.addEventListener("toggle", () => {
    if (menu.open)
      for (const other of menus) if (other !== menu) closeMenu(other);
  });
}

// Enhance navigation between public pages while preserving server-rendered HTML.
{
  const main = document.querySelector(".site-main-fullscreen");
  if (main) {
    main
      .querySelectorAll("link[rel='stylesheet']")
      .forEach((link) => document.head.append(link));
    const announcement = document.createElement("p");
    announcement.className = "visually-hidden";
    announcement.setAttribute("role", "status");
    document.body.append(announcement);
    const previews = new Map();
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    let pending = null;
    function isStoreUrl(url) {
      return (
        url.origin === location.origin &&
        /^https?:$/.test(url.protocol) &&
        !/^\/(?:admin|api|media-files|extensions|assets|themes|login|logout)(?:\/|$)/.test(
          url.pathname,
        ) &&
        !/\.(?:pdf|zip|jpg|jpeg|png|webp|gif|svg|mp4|mp3)$/i.test(url.pathname)
      );
    }
    const moduleKey = (value) => {
      const url = new URL(value, location.origin);
      return url.origin + url.pathname;
    };
    const loadedModules = new Set(
      [...document.querySelectorAll('script[type="module"][src]')].map((node) =>
        moduleKey(node.src),
      ),
    );
    async function prepareAssets(page) {
      for (const style of page.querySelectorAll(
        'link[rel="stylesheet"][href]',
      )) {
        const url = new URL(style.getAttribute("href"), location.origin);
        if (url.origin !== location.origin)
          throw new Error("External page styles require a full navigation");
        if (
          [...document.querySelectorAll('link[rel="stylesheet"]')].some(
            (node) => node.href === url.href,
          )
        )
          continue;
        await new Promise((resolve, reject) => {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = url.href;
          const timer = setTimeout(() => {
            link.remove();
            reject(new Error("Stylesheet timeout"));
          }, 10000);
          link.onload = () => {
            clearTimeout(timer);
            resolve();
          };
          link.onerror = () => {
            clearTimeout(timer);
            link.remove();
            reject(new Error("Stylesheet failed"));
          };
          document.head.append(link);
        });
      }
      const modules = [];
      for (const script of page.querySelectorAll("script[src]")) {
        const url = new URL(script.getAttribute("src"), location.origin);
        if (url.origin !== location.origin)
          throw new Error("External script requires a full navigation");
        if (script.type === "module" && !loadedModules.has(moduleKey(url.href)))
          modules.push(url.href);
        else if (
          script.type !== "module" &&
          ![...document.querySelectorAll("script[src]")].some(
            (node) => node.src === url.href,
          )
        )
          throw new Error("Page script requires a full navigation");
      }
      if (
        page.querySelector(
          '.site-main-fullscreen script:not([src]):not([type="application/ld+json"])',
        )
      )
        throw new Error("Inline page script requires a full navigation");
      return [...new Set(modules)];
    }
    // SEO plugins mark their <head> tags so canonical, meta and JSON-LD follow the visible page.
    function replaceSeoTags(page) {
      document.head
        .querySelectorAll("[data-flex-seo]")
        .forEach((node) => node.remove());
      for (const node of page.head?.querySelectorAll("[data-flex-seo]") ?? []) {
        document.head.append(document.importNode(node, true));
      }
    }
    async function loadPage(url, signal) {
      const response = await fetch(url.href, {
        credentials: "same-origin",
        signal,
        headers: { Accept: "text/html" },
      });
      if (!response.ok || !isStoreUrl(new URL(response.url)))
        throw new Error("Invalid storefront response");
      const html = await response.text();
      return { html, url: response.url };
    }
    async function navigateStorefront(url, push = true, scroll = null) {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      main.setAttribute("aria-busy", "true");
      document.dispatchEvent(
        new CustomEvent("flex:page-loading", { detail: true }),
      );
      announcement.textContent = "Зареждане…";
      try {
        const preview = previews.get(url.href);
        const result =
          preview && Date.now() - preview.time < 10000
            ? await preview.promise
            : await loadPage(url, controller.signal);
        previews.delete(url.href);
        if (controller.signal.aborted) return;
        const page = new DOMParser().parseFromString(result.html, "text/html");
        const nextMain = page.querySelector(".site-main-fullscreen");
        if (!nextMain) throw new Error("Incompatible page template");
        const modules = await prepareAssets(page);
        if (controller.signal.aborted) return;
        if (push) {
          history.replaceState(
            {
              ...history.state,
              commerceScroll: [window.scrollX, window.scrollY],
            },
            "",
          );
        }
        document
          .querySelectorAll("dialog[open]")
          .forEach((dialog) => dialog.close());
        document.dispatchEvent(new CustomEvent("flex:page-before-change"));
        // Assets are already loaded. Do not insert another module or execute response scripts.
        nextMain
          .querySelectorAll(
            "script:not([type='application/ld+json']), link[rel='stylesheet']",
          )
          .forEach((node) => node.remove());
        main.replaceChildren(...nextMain.childNodes);
        document.title = page.title;
        replaceSeoTags(page);
        if (push) history.pushState({ commerceScroll: [0, 0] }, "", result.url);
        updateNavigationLinks();
        for (const src of modules) {
          await import(src);
          loadedModules.add(moduleKey(src));
        }
        if (controller.signal.aborted) return;
        document.dispatchEvent(new CustomEvent("flex:page-ready"));
        const heading = main.querySelector("h1");
        announcement.textContent =
          heading?.textContent || "Съдържанието е обновено.";
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
        const anchor =
          push && url.hash
            ? document.getElementById(decodeURIComponent(url.hash.slice(1)))
            : null;
        if (anchor) anchor.scrollIntoView();
        else
          window.scrollTo({
            left: scroll?.[0] || 0,
            top: scroll?.[1] || 0,
            behavior: "instant",
          });
      } catch (error) {
        if (error.name !== "AbortError" && !controller.signal.aborted) {
          console.warn("Flex navigation used a full page load:", error.message);
          location.assign(url.href);
        }
      } finally {
        if (pending === controller) {
          main.removeAttribute("aria-busy");
          document.dispatchEvent(
            new CustomEvent("flex:page-loading", { detail: false }),
          );
          pending = null;
        }
      }
    }
    document.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = event.target.closest("a[href]");
      if (
        !link ||
        link.hasAttribute("download") ||
        (link.target && link.target !== "_self") ||
        link.hasAttribute("data-full-navigation")
      )
        return;
      const url = new URL(link.href);
      if (
        !isStoreUrl(url) ||
        (url.pathname === location.pathname &&
          url.search === location.search &&
          url.hash)
      )
        return;
      event.preventDefault();
      navigateStorefront(url);
    });
    document.addEventListener("submit", (event) => {
      if (event.defaultPrevented) return;
      const form = event.target;
      if (
        !(form instanceof HTMLFormElement) ||
        !form.matches(".commerce-filters, .shop-search")
      )
        return;
      const url = new URL(form.action, location.href);
      if (!isStoreUrl(url)) return;
      event.preventDefault();
      const params = new URLSearchParams();
      for (const [key, value] of new FormData(form).entries()) {
        if (typeof value === "string" && value.trim() !== "") params.append(key, value);
      }
      url.search = params.toString();
      navigateStorefront(url);
    });
    window.FlexNavigation = Object.freeze({
      navigate: (value) => {
        const url = new URL(value, location.href);
        if (isStoreUrl(url)) navigateStorefront(url);
        else location.assign(url.href);
      },
    });
    window.addEventListener("popstate", (event) => {
      const url = new URL(location.href);
      if (!isStoreUrl(url)) {
        location.reload();
        return;
      }
      // Preview query changes stay on the same page content.
      if (event.state?.commercePreviewOnly) {
        document.dispatchEvent(new CustomEvent("commerce:preview-url"));
        return;
      }
      navigateStorefront(url, false, event.state?.commerceScroll);
    });
    // Small, short-lived prefetch budget: no background crawl or persistent stock cache.
    let hoverTimer;
    function prepareProduct(event) {
      const link = event.target.closest("a[href]");
      if (!link || !link.closest(".commerce-product-card")) return;
      const url = new URL(link.href);
      if (!isStoreUrl(url) || !url.pathname.includes("/product/")) return;
      const connection = navigator.connection;
      if (
        connection?.saveData ||
        /(^|-)2g$/.test(connection?.effectiveType || "")
      )
        return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        if (previews.has(url.href)) return;
        for (const [key, value] of previews)
          if (Date.now() - value.time >= 10000) previews.delete(key);
        if (previews.size >= 2) return;
        const promise = loadPage(url);
        previews.set(url.href, { time: Date.now(), promise });
        promise.catch(() => previews.delete(url.href));
      }, 180);
    }
    document.addEventListener("pointerover", prepareProduct);
    document.addEventListener("focusin", prepareProduct);
    document.addEventListener("pointerout", (event) => {
      const card = event.target.closest(".commerce-product-card");
      if (card && !card.contains(event.relatedTarget)) clearTimeout(hoverTimer);
    });
  }
}
