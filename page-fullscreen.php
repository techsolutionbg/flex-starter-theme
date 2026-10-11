<?php

declare(strict_types=1);

// Discover page styles before rendering the body so the first paint is styled.
$isHomePage = (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/') === '/';
if ($isHomePage && class_exists(\Flex\Commerce\CatalogEmbedRenderer::class)) {
    $highlights = new \Flex\Commerce\CatalogEmbedRenderer();
    $bestsellers = $highlights->bestsellers() . $highlights->topProducts();
    if (preg_match('/<section\b[^>]*class="[^"]*flex-gallery--slider[^"]*"[^>]*>.*?<\/section>/s', $pageContent)) {
        $pageContent = preg_replace_callback('/<section\b[^>]*class="[^"]*flex-gallery--slider[^"]*"[^>]*>.*?<\/section>/s', static fn($match) => $match[0] . $bestsellers, $pageContent, 1) ?? $pageContent;
    } else {
        $pageContent = $bestsellers . $pageContent;
    }
}
$pageStyles = [];
$pageContent = preg_replace_callback('/<link\b[^>]*>/i', static function (array $match) use (&$pageStyles): string {
    if (preg_match('/\brel\s*=\s*(["\x27])stylesheet\1/i', $match[0]) !== 1) {
        return $match[0];
    }
    $pageStyles[$match[0]] = $match[0];
    return '';
}, $pageContent) ?? $pageContent;
?>
<!doctype html>
<?php
$documentLanguage = ($site['locale'] ?? 'bg') === 'en' ? 'en' : 'bg';
$documentTitle = is_string($document_title ?? null) && trim($document_title) !== '' ? $document_title : $pageTitle;
?>
<?php
// Formats for /assets/flex-time.js, which shows <time data-flex-time> values in the visitor's time zone.
$dateFormat = htmlspecialchars((string) ($site['date_format'] ?? 'd.m.Y'), ENT_QUOTES, 'UTF-8');
$timeFormat = htmlspecialchars((string) ($site['time_format'] ?? 'H:i'), ENT_QUOTES, 'UTF-8');
?>
<html lang="<?= $documentLanguage ?>" data-flex-date-format="<?= $dateFormat ?>" data-flex-time-format="<?= $timeFormat ?>">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= htmlspecialchars($documentTitle, ENT_QUOTES, 'UTF-8') ?></title>
    <link rel="stylesheet" href="<?= htmlspecialchars($theme_asset('style.css'), ENT_QUOTES, 'UTF-8') ?>">
    <?php
    $pageStyleBlob = implode('', $pageStyles);
    $extensionTags = trim((string) ($frontend_extension_tags ?? ''));
    if ($extensionTags !== '') {
        $extensionTags = preg_replace_callback('/<(link|script)\b[^>]*>/i', static function (array $match) use ($pageStyleBlob, $pageContent): string {
            $tag = $match[0];
            if (preg_match('/\b(?:href|src)\s*=\s*(["\x27])([^"\x27]+)\1/i', $tag, $attr) !== 1) {
                return $tag;
            }
            $url = $attr[2];
            $path = parse_url($url, PHP_URL_PATH) ?: $url;
            if (str_contains($pageStyleBlob, $path) || str_contains($pageContent, $path)) {
                return '';
            }
            return $tag;
        }, $extensionTags) ?? $extensionTags;
        echo $extensionTags, "\n";
    }
    ?>
    <?php if (($head_tags ?? '') !== ''): ?>
    <?= $head_tags ?>
    <?php endif; ?>
    <?php foreach ($pageStyles as $stylesheet): ?>
    <?= $stylesheet ?>
    <?php endforeach; ?>
    <?php // Flex CMS 0.1.62+ loads the storefront files through plugin asset groups only where they are used. ?>
    <?php if (class_exists(\Flex\Commerce\PublicCatalog::class) && !class_exists(\Flex\Extensions\PublicAssetQueue::class)): ?>
    <?php if (!str_contains($pageStyleBlob . $extensionTags, "/extensions/flex/commerce/assets/assets/cart.css")): ?>
    <link rel="stylesheet" href="/extensions/flex/commerce/assets/assets/cart.css?v=3">
    <?php endif; ?>
    <?php if (!str_contains($pageContent . $extensionTags, "/extensions/flex/commerce/assets/assets/cart.js")): ?>
    <script type="module" src="/extensions/flex/commerce/assets/assets/cart.js?v=8"></script>
    <?php endif; ?>
    <?php if (!str_contains($pageContent . $extensionTags, "/extensions/flex/commerce/assets/assets/storefront.js")): ?>
    <script type="module" src="/extensions/flex/commerce/assets/assets/storefront.js?v=22"></script>
    <?php endif; ?>
    <?php endif; ?>
    <style>
        html.is-page-loading::before {
            content: ""; position: fixed; inset: 0 auto auto 0; width: 35%; height: 3px;
            background: var(--flex-color-accent, #2d6a4f); z-index: 2147483647; pointer-events: none;
            animation: flex-page-loading 1.1s ease-in-out infinite;
        }
        @keyframes flex-page-loading {
            from { transform: translateX(-100%); }
            to { transform: translateX(300%); }
        }
        @media (prefers-reduced-motion: reduce) {
            html.is-page-loading::before { animation: none; width: 100%; }
        }
    </style>
    <script>
        (() => {
            const root = document.documentElement;
            root.classList.add('is-page-loading');
            const finish = () => root.classList.remove('is-page-loading');
            document.addEventListener('DOMContentLoaded', finish, { once: true });
            window.addEventListener('pageshow', finish);
            document.addEventListener('flex:page-loading', event => {
                root.classList.toggle('is-page-loading', event.detail === true);
            });
        })();
    </script>
    <script defer src="<?= htmlspecialchars($theme_asset('navigation.js'), ENT_QUOTES, 'UTF-8') ?>"></script>
    <?php // The same URL as in plugin imports, so the browser loads the module once. ?>
    <script type="module" src="/assets/flex-time.js"></script>
    <?php if (is_file(__DIR__ . '/assets/react/storefront.js')): ?>
    <?php
    // Flex CMS 0.1.62+ versions theme_asset() URLs itself, so browsers keep the file until it changes.
    $storefrontUrl = $theme_asset('react/storefront.js');
    if (!str_contains($storefrontUrl, '?')) {
        $storefrontUrl .= '?v=' . substr(hash_file('sha256', __DIR__ . '/assets/react/storefront.js'), 0, 16);
    }
    ?>
    <script type="module" src="<?= htmlspecialchars($storefrontUrl, ENT_QUOTES, 'UTF-8') ?>"></script>
    <?php endif; ?>
</head>
<body>
<?php include __DIR__ . '/commerce-header.php'; ?>
<?php if (($menuHtml['secondary'] ?? '') !== ''): ?>
    <nav class="site-secondary-navigation" aria-label="Допълнителна навигация">
        <?= $menuHtml['secondary'] ?>
    </nav>
<?php endif; ?>


<main class="site-main site-main-fullscreen">
    <?php if (
        str_contains($pageContent, 'class="commerce-product-title"')
        || str_contains($pageContent, 'data-commerce-checkout')
        || str_contains($pageContent, 'class="commerce-order-received"')
    ): ?>
        <?php // Product, checkout and order-received templates supply their own page heading. ?>
    <?php elseif (($page_settings['show_title'] ?? true) !== false): ?>
        <h1 class="fullscreen-page-title"><?= htmlspecialchars($pageTitle, ENT_QUOTES, 'UTF-8') ?></h1>
    <?php else: ?>
        <h1 class="visually-hidden"><?= htmlspecialchars($pageTitle, ENT_QUOTES, 'UTF-8') ?></h1>
    <?php endif; ?>
    <div class="site-content site-content-fullscreen<?= $isHomePage ? ' starter-home-content' : '' ?>">
        <?= $pageContent ?>
    </div>
</main>

<?php if (($menuHtml['footer'] ?? '') !== ''): ?>
    <footer class="site-footer">
        <nav aria-label="Навигация във футъра">
            <?= $menuHtml['footer'] ?>
        </nav>
    </footer>
<?php endif; ?>
</body>
</html>
