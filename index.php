<?php

declare(strict_types=1);

$pageData = ($page ?? null) instanceof \Flex\Pages\Page
    ? $page->toPublicArray()
    : (is_array($page ?? null) ? $page : []);

$menuHtml = is_array($menu_html ?? null) ? $menu_html : [];
$pageTitle = (string) ($pageData['title'] ?? 'Flex CMS');
$pageContent = (string) ($pageData['content'] ?? '');

include __DIR__ . '/page-fullscreen.php';
