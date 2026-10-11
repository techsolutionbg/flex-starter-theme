# Changelog

## 1.2.0 — 2026-10-11

- Load the React runtime (`assets/react/storefront.js`, about 300 KB) only when something needs it: plugins ask through `window.FlexStorefrontLoader.load()`, and the header search loads it when the visitor points at, touches or focuses it, keeping the typed text, focus and caret. Until then the search works as a plain form.
- Plugins written before this (Flex Commerce up to 0.3.0) still get React at once.

## 1.1.0 — 2026-10-11

- Print the plugin tags of Flex CMS 0.1.62 as they are, without the hand-written storefront fallback (kept for older platforms).
- Theme files carry versioned URLs from `theme_asset()` and are cached by browsers until they change.
- Style header links (account, favourites) in the theme itself.

