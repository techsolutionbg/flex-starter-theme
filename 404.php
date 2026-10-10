<?php

declare(strict_types=1);

$pageData = [];
$pageTitle = (string) ($title ?? 'Страницата не е намерена');
$pageContent = '<p class="fullscreen-message">Страницата не е намерена. <a href="/">Към началото</a></p>';
$menuHtml = is_array($menu_html ?? null) ? $menu_html : [];
include __DIR__ . '/page-fullscreen.php';
