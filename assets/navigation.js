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
    // The <head> tags search engines and link previews read follow the visible page: those SEO plugins mark,
    // and the usual description, robots, canonical, Open Graph, X and JSON-LD tags. Every URL is also served as
    // a full page, so crawlers never depend on this.
    const headTags =
      '[data-flex-seo], meta[name="description"], meta[name="robots"], link[rel="canonical"], meta[property^="og:"], meta[name^="twitter:"], script[type="application/ld+json"]';
    function replaceSeoTags(page) {
      document.head.querySelectorAll(headTags).forEach((node) => node.remove());
      for (const node of page.head?.querySelectorAll(headTags) ?? []) {
        document.head.append(document.importNode(node, true));
      }
      const lang = page.documentElement?.getAttribute?.("lang");
      if (lang) document.documentElement?.setAttribute?.("lang", lang);
    }
    // Parts outside <main> that depend on the visitor, such as the account link after signing in or out. They
    // are replaced only when the server renders them differently, so counts kept by scripts are left alone.
    const regionSources = new Map(
      [...document.querySelectorAll("[data-flex-region]")].map((node) => [node.dataset.flexRegion, node.outerHTML]),
    );
    function replaceRegions(page) {
      for (const next of page.querySelectorAll?.("[data-flex-region]") ?? []) {
        const name = next.dataset.flexRegion;
        const current = [...document.querySelectorAll("[data-flex-region]")].find((node) => node.dataset.flexRegion === name);
        if (!current || regionSources.get(name) === next.outerHTML) continue;
        regionSources.set(name, next.outerHTML);
        current.replaceWith(document.importNode(next, true));
      }
    }
    // The next page appears at once as a placeholder in its shape, and loads in its own place. Plugins choose
    // the shape for their addresses on flex:page-skeleton (detail.variant: "page", "grid" or "product"), or
    // draw their own placeholder into detail.main and cancel the event.
    const skeletonVariants = {
      page: '<div class="flex-skeleton-page"><span class="flex-skeleton is-crumbs"></span><span class="flex-skeleton is-title"></span><span class="flex-skeleton"></span><span class="flex-skeleton"></span><span class="flex-skeleton is-short"></span><span class="flex-skeleton is-block"></span></div>',
      grid:
        '<div class="flex-skeleton-page"><span class="flex-skeleton is-crumbs"></span><span class="flex-skeleton is-title"></span><div class="flex-skeleton-grid">' +
        '<div class="flex-skeleton-card"><span class="flex-skeleton is-media"></span><span class="flex-skeleton"></span><span class="flex-skeleton is-short"></span></div>'.repeat(8) +
        "</div></div>",
      product:
        '<div class="flex-skeleton-page"><span class="flex-skeleton is-crumbs"></span><div class="flex-skeleton-product"><span class="flex-skeleton is-media"></span><div><span class="flex-skeleton is-title"></span><span class="flex-skeleton is-short"></span><span class="flex-skeleton"></span><span class="flex-skeleton"></span><span class="flex-skeleton is-button"></span></div></div></div>',
    };
    function showSkeleton(url) {
      document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
      document.dispatchEvent(new CustomEvent("flex:page-before-change"));
      const detail = { url: url.href, variant: "page", main };
      const event = new CustomEvent("flex:page-skeleton", { detail, cancelable: true });
      document.dispatchEvent(event);
      if (!event.defaultPrevented) {
        const placeholder = document.createElement("div");
        placeholder.className = "flex-page-skeleton";
        placeholder.setAttribute("aria-hidden", "true");
        placeholder.innerHTML = skeletonVariants[detail.variant] ?? skeletonVariants.page;
        main.replaceChildren(placeholder);
      }
      updateNavigationLinks();
      window.scrollTo({ left: 0, top: 0, behavior: "instant" });
    }

    async function loadPage(url, signal, request = {}) {
      const method = (request.method || "GET").toUpperCase();
      const response = await fetch(url.href, {
        method,
        credentials: "same-origin",
        signal,
        headers: {
          Accept: "text/html",
          ...(request.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        },
        ...(request.body ? { body: request.body } : {}),
      });
      // A submitted form may answer with its page and an error status (for example invalid input); a link that
      // fails gets the server's own error page through a full load.
      if ((!response.ok && method === "GET") || !isStoreUrl(new URL(response.url)))
        throw new Error("Invalid storefront response");
      if (!(response.headers?.get?.("Content-Type") ?? "text/html").includes("text/html"))
        throw new Error("Not a page");
      const html = await response.text();
      return { html, url: response.url };
    }
    async function navigateStorefront(url, push = true, scroll = null, request = {}) {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      main.setAttribute("aria-busy", "true");
      document.dispatchEvent(
        new CustomEvent("flex:page-loading", { detail: true }),
      );
      announcement.textContent = "Зареждане…";
      let changed = false;
      try {
        const preview = previews.get(url.href);
        const usePreview = preview && !request.method && Date.now() - preview.time < 10000;
        // A page already loaded in advance is shown directly; any other switches to its placeholder now.
        if (!(usePreview && preview.ready)) {
          if (push && !request.method && !request.replace) {
            history.replaceState({ ...history.state, commerceScroll: [window.scrollX, window.scrollY] }, "");
            history.pushState({ commerceScroll: [0, 0] }, "", url.href);
            changed = true;
          }
          showSkeleton(url);
        }
        const result = usePreview ? await preview.promise : await loadPage(url, controller.signal, request);
        previews.delete(url.href);
        if (controller.signal.aborted) return;
        const page = new DOMParser().parseFromString(result.html, "text/html");
        const nextMain = page.querySelector(".site-main-fullscreen");
        if (!nextMain) throw new Error("Incompatible page template");
        const modules = await prepareAssets(page);
        if (controller.signal.aborted) return;
        if (push && !changed) {
          history.replaceState(
            {
              ...history.state,
              commerceScroll: [window.scrollX, window.scrollY],
            },
            "",
          );
        }
        if (!main.querySelector(".flex-page-skeleton")) {
          document
            .querySelectorAll("dialog[open]")
            .forEach((dialog) => dialog.close());
          document.dispatchEvent(new CustomEvent("flex:page-before-change"));
        }
        // Assets are already loaded. Do not insert another module or execute response scripts.
        nextMain
          .querySelectorAll(
            "script:not([type='application/ld+json']), link[rel='stylesheet']",
          )
          .forEach((node) => node.remove());
        main.replaceChildren(...nextMain.childNodes);
        document.title = page.title;
        replaceSeoTags(page);
        replaceRegions(page);
        // A form answering on its own address, or a page that replaces the current one, keeps one history entry.
        if (changed || request.replace || (push && request.method && result.url === location.href)) {
          // The address was changed with the placeholder; a redirect may still change it.
          if (!changed || result.url !== location.href) history.replaceState({ commerceScroll: [0, 0] }, "", result.url);
        } else if (push) history.pushState({ commerceScroll: [0, 0] }, "", result.url);
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
          // A form is sent again as a normal submission, so what was entered is not lost.
          if (request.form) {
            // The form was replaced by the placeholder; a copy keeps what was entered.
            const copy = request.form.isConnected === false ? request.form.cloneNode?.(true) ?? request.form : request.form;
            if (copy !== request.form) {
              copy.hidden = true;
              document.body.append(copy);
            }
            HTMLFormElement.prototype.submit.call(copy);
          }
          else if (request.replace) location.replace(url.href);
          else location.assign(url.href);
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
    // Forms of the site are sent in the background and their answer replaces the content, like links. Forms with
    // files, another target or data-full-navigation, and forms of other sites, are submitted as usual.
    document.addEventListener("submit", (event) => {
      if (event.defaultPrevented) return;
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || form.hasAttribute("data-full-navigation")) return;
      const submitter = event.submitter;
      const method = (submitter?.getAttribute("formmethod") || form.method || "get").toLowerCase();
      const target = submitter?.getAttribute("formtarget") || form.target;
      const url = new URL(submitter?.getAttribute("formaction") || form.action, location.href);
      if (
        !isStoreUrl(url) ||
        (target && target !== "_self") ||
        !(method === "get" || method === "post") ||
        form.enctype === "multipart/form-data" ||
        [...form.elements].some((field) => field.type === "file")
      )
        return;
      event.preventDefault();
      const params = new URLSearchParams();
      // Search and filters leave empty fields out of the address.
      const compact = form.matches(".commerce-filters, .shop-search");
      for (const [key, value] of new FormData(form, submitter ?? undefined).entries()) {
        if (typeof value !== "string" || (compact && value.trim() === "")) continue;
        params.append(key, value);
      }
      if (method === "get") {
        url.search = params.toString();
        navigateStorefront(url);
      } else {
        navigateStorefront(url, true, null, { method: "POST", body: params.toString(), form });
      }
    });
    window.FlexNavigation = Object.freeze({
      // Plugins open pages through this, for example after signing in or placing an order.
      navigate: (value, options = {}) => {
        const url = new URL(value, location.href);
        if (isStoreUrl(url)) navigateStorefront(url, true, null, { replace: options.replace === true });
        else if (options.replace === true) location.replace(url.href);
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
        const entry = { time: Date.now(), promise, ready: false };
        previews.set(url.href, entry);
        promise.then(() => (entry.ready = true)).catch(() => previews.delete(url.href));
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
