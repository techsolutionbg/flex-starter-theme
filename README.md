# Flex Starter

A minimal, customisable PHP storefront theme for Flex CMS, with a shop header, fast page navigation and a small React runtime for public components.

Version: **1.2.0** · ID: `flex-starter` · Minimum Flex CMS version: **0.1.54**.

GitHub repository: `techsolutionbg/flex-starter-theme`.

## Requirements and installation

Requires an installed Flex CMS with PHP 8.3+. Flex Commerce, Flex Accounts and Flex Galleries are optional: the theme detects them and enables the related header actions, assets and home page sections.

Place the theme in `themes/flex-starter/`, with `theme.json` directly inside that folder, and activate it from the theme administration. The compiled `assets/react/storefront.js` is part of the theme, so no build is needed to use it.

## What it includes

- A shop header with brand, product search, account link, favourites and cart.
- Navigation links for Home, Products, About us and Contacts, with `aria-current` for the current page.
- Menu locations `primary`, `secondary` and `footer`. The secondary menu is shown below the header and the footer menu in the page footer.
- Declared support in `theme.json` for menus, navigation, featured images, custom logos and the shared form controls. The header currently shows a fixed text brand.
- A full-width page template used for pages and the 404 page.
- Lazy React: the storefront runtime (`assets/react/storefront.js`) loads only when a plugin asks for it through `window.FlexStorefrontLoader.load()` or when the visitor turns to the header search; until then pages carry no React.
- Local times: the platform module `/assets/flex-time.js` is loaded on every page and `<html>` carries the date and time formats from the general settings, so any `<time data-flex-time datetime="…Z">` (for example from the `flex_time()` template function) is shown in the visitor's time zone with a relative time, such as „10.10.2026 14:30 · преди 5 минути“.
- SEO support: `<title>` uses the `document_title` value from the `public.title` filter (Flex CMS 0.1.59+), and the `head_tags` from `public.head` are printed in `<head>`, so plugins such as Flex SEO can set titles, meta tags and structured data.
- A page title that can be hidden per page; product, checkout and order pages provide their own heading.
- With Flex Commerce active, the home page shows the bestsellers and top products sections after the first gallery slider, or at the top of the page.
- Product search suggestions while typing, with keyboard navigation.
- A loading indicator during page changes that respects reduced-motion preferences.
- Responsive styles for small screens.

The theme text is Bulgarian. The `lang` attribute follows the site language setting (`bg` or `en`).

## Styling

Colours and controls are defined as CSS custom properties in `style.css`. The `--starter-*` properties set the theme palette. The `--flex-*` properties are a shared contract that plugins read with fallbacks, for example `--flex-color-accent`, `--flex-color-border`, `--flex-radius-control` and `--flex-control-min-height`. Change these to restyle the theme and plugin forms together.

## Public page navigation

The full-width template keeps the shared header and loads internal pages without a full reload. Page URLs still return server-rendered HTML. Page stylesheets load before the content is replaced, and new module scripts load once.

The document title and every `<head>` element marked with `data-flex-seo` are replaced with those of the new page, so canonical URLs, meta tags and JSON-LD stay correct.

Components can clean up on `flex:page-before-change` and initialise on `flex:page-ready`. Flex Commerce and Flex Galleries use these events. `window.FlexNavigation.navigate(url)` starts the same navigation from code.

Add `data-full-navigation` to a link whose destination needs a normal browser navigation. Unsupported templates, inline executable scripts and HTTP errors fall back to a full page load.

## Public React components

The theme bundles React and React DOM from the platform's pinned admin dependencies, in a separate production build. There are no admin imports, remote CDN scripts or extra dependencies. The bundle is loaded on all public pages, and a content hash in its URL prevents stale browser caches after a rebuild.

The product search is the first React component. It renders inside the existing GET form and keeps the server HTML design and normal form submission. Without JavaScript, or when the bundle is missing, the server-rendered search form still works.

### Shared runtime for themes and plugins

`window.FlexStorefront` exposes `apiVersion` (1), `React`, `createRoot`, `register(name, Component)`, `mount(name, element, props)` and `unmount(element)`. Use its React instance for hooks to avoid loading a second copy. Do not import admin components: their styles and assumptions belong to the admin panel.

Wait for the runtime if your script loads before it:

```js
function start(runtime) {
  const { React } = runtime;
  runtime.register('my-plugin.example', function Example({ text }) {
    return React.createElement('span', null, text);
  });
  const element = document.querySelector('[data-example]');
  if (element) runtime.mount('my-plugin.example', element, { text: 'Hello' });
}
if (window.FlexStorefront) start(window.FlexStorefront);
else window.addEventListener('flex:storefront-ready', event => start(event.detail), { once: true });
```

`mount` prevents duplicate roots. Call `unmount` before removing a React island. An uncaught render error restores the original server markup. Keep useful server markup in each island for progressive enhancement. PHP output is not React SSR, so use `createRoot`, not `hydrateRoot`. React only controls the island's children. Prefer text props and React escaping; do not pass user HTML to `dangerouslySetInnerHTML`.

This runtime is provided by Flex Starter. Other themes may include an equivalent runtime; the CMS core does not inject it globally.

## Building the React bundle

Run from the Flex CMS root:

```sh
npm --prefix resources/admin-react ci
cd resources/admin-react
npx vite build --config ../../themes/flex-starter/vite.config.mjs
```

For development, add `--watch` and run it in a second terminal, then reload public pages after changes. A separate public development server is not needed. Keep the generated bundle in the theme release ZIP; `src/` and `vite.config.mjs` are build sources, not browser assets.

## Structure

```text
theme.json                 Version, supports, menu locations and metadata
index.php                  Page entry template
404.php                    Not found page
page-fullscreen.php        Full-width layout, assets and page content
commerce-header.php        Shop header, search and customer actions
style.css                  Theme styles and shared design tokens
assets/navigation.js       Menus and fast page navigation
assets/react/storefront.js Compiled React runtime and search
assets/screenshot.png      Theme preview
src/storefront.js          React runtime source
vite.config.mjs            Bundle build configuration
tests/                     JavaScript navigation tests
```

## Development checks

```sh
node --test themes/flex-starter/tests/navigation.test.cjs
```

When this README was written, **3 JavaScript tests** passed.

## Licence

Flex Starter is licensed under the GNU General Public License, version 2 or (at your option) any later version (`GPL-2.0-or-later`). The full text of version 2 is in [`LICENSE`](LICENSE).

The compiled bundle `assets/react/storefront.js` includes React and React DOM, which are distributed under the MIT licence.
