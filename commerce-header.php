<?php

declare(strict_types=1);

$shopCurrentPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$shopQuery = is_string($_GET['q'] ?? null) ? mb_substr($_GET['q'], 0, 150) : '';
$shopEscape = static fn(string $value): string => htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
$accountsLoggedIn = class_exists(\Flex\Accounts\AccountSessionReader::class)
    && \Flex\Accounts\AccountSessionReader::loggedIn();
$accountsNavHref = $accountsLoggedIn ? '/account' : '/account/login';
$accountsNavLabel = $accountsLoggedIn ? 'Моят профил' : 'Вход';
$accountsNavState = $accountsLoggedIn ? 'customer' : 'guest';
$accountsNavIcon = $accountsLoggedIn
    ? '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>'
    : '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5"/><path d="M17 16l4-4-4-4"/><path d="M21 12H9"/></svg>';
$shopNavCurrent = static function (string $path) use ($shopCurrentPath): string {
    if ($path === '/') {
        return $shopCurrentPath === '/' ? 'aria-current="page"' : '';
    }
    if ($path === '/catalog') {
        if ($shopCurrentPath === '/catalog' || str_starts_with($shopCurrentPath, '/catalog/')) {
            return 'aria-current="page"';
        }
        if (str_starts_with($shopCurrentPath, '/product/')) {
            return 'aria-current="location"';
        }

        return '';
    }

    return $shopCurrentPath === $path ? 'aria-current="page"' : '';
};
?>
<header class="shop-header">
    <div class="shop-header-main">
        <a class="shop-brand" href="/"><span>Flex CMS</span><span class="shop-brand-label">Магазин</span></a>
        <form class="shop-search" method="get" action="/catalog" role="search" aria-label="Търсене в магазина">
            <div class="shop-search-react" data-flex-react="shop-search">
            <label class="visually-hidden" for="shop-product-search">Търсене на продукти</label>
            <input id="shop-product-search" type="search" name="q" value="<?= $shopEscape($shopQuery) ?>" maxlength="150" placeholder="Какво търсите днес?">
            <button type="submit" aria-label="Търси продукти"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg></button>
            </div>
        </form>
        <div class="shop-header-actions" role="group" aria-label="Клиентски функции"><a href="<?= $shopEscape($accountsNavHref) ?>" class="shop-action" data-flex-accounts-nav data-flex-region="account-nav" data-accounts-state="<?= $shopEscape($accountsNavState) ?>" aria-label="<?= $shopEscape($accountsNavLabel) ?>" title="<?= $shopEscape($accountsNavLabel) ?>"><?= $accountsNavIcon ?><span><?= $shopEscape($accountsNavLabel) ?></span></a><a href="/favourites" class="shop-action shop-cart-action" data-commerce-favourites-link aria-label="Любими" title="Любими"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg><span>Любими</span><span class="shop-cart-count" data-commerce-favourites-count hidden>0</span></a><button type="button" class="shop-action shop-cart-action" data-commerce-cart-open disabled aria-label="Количка" title="Количка"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h3l3 13h11l3-9H6"/><circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/></svg><span>Количка</span><span class="shop-cart-count" data-commerce-cart-count hidden>0</span></button></div>
    </div>
    <div class="shop-navigation-wrap">
        <nav class="shop-navigation" aria-label="Навигация в магазина">
            <a href="/" <?= $shopNavCurrent('/') ?>>Начало</a>
            <a href="/catalog" <?= $shopNavCurrent('/catalog') ?>>Продукти</a>
            <a href="/about-us" <?= $shopNavCurrent('/about-us') ?>>За нас</a>
            <a href="/contacts" <?= $shopNavCurrent('/contacts') ?>>Контакти</a>
        </nav>
    </div>
</header>
