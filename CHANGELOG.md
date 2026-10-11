# Changelog

## 1.3.0 — 2026-10-11

- Switch to the next page at once: the address, the menu and a placeholder in the page's shape (`page`, `grid` or `product`) appear immediately and the page loads in its own place instead of behind the current one. Plugins choose the shape on `flex:page-skeleton`. Pages loaded in advance on hover are shown directly.
- Open every page of the site without reloading: links, filters and search as before, and now every form of the site (account, password, sign-out and others) is sent in the background and its answer replaces the content. Forms with files, another target, `data-full-navigation` or another site are submitted as usual.
- Keep `<head>` in step with the visible page for search engines and link previews: title, language, description, robots, canonical, Open Graph, X and JSON-LD tags (and every tag marked `data-flex-seo`). Every address still returns the full page from the server.
- Update header parts marked `data-flex-region` (the account link) when the server renders them differently, for example after signing in or out.
- `window.FlexNavigation.navigate(url, {replace})` for plugins.

## 1.2.0 — 2026-10-11

- Load the React runtime (`assets/react/storefront.js`, about 300 KB) only when something needs it: plugins ask through `window.FlexStorefrontLoader.load()`, and the header search loads it when the visitor points at, touches or focuses it, keeping the typed text, focus and caret. Until then the search works as a plain form.
- Plugins written before this (Flex Commerce up to 0.3.0) still get React at once.

## 1.1.0 — 2026-10-11

- Print the plugin tags of Flex CMS 0.1.62 as they are, without the hand-written storefront fallback (kept for older platforms).
- Theme files carry versioned URLs from `theme_asset()` and are cached by browsers until they change.
- Style header links (account, favourites) in the theme itself.

