<!doctype html>
<html lang="{{ app()->getLocale() }}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="csrf-token" content="{{ csrf_token() }}">
<title>@yield('title', __('Administration')) · Rayz Proforma</title>
<link rel="icon" href="/brand-logo.png"><link rel="stylesheet" href="/admin.css?v=2.0.8">
</head>
<body>
<a class="skip-link" href="#main">{{ __('Skip to content') }}</a>
<header class="site-header"><div class="header-inner">
<a class="brand" href="/admin"><img src="/brand-logo.png" width="36" height="36" alt="Rayz Technology"><span>Rayz Proforma<small>{{ __('Administration') }}</small></span></a>
<nav class="main-nav" aria-label="{{ __('Main navigation') }}">
@auth
<a href="/admin" @class(['nav-link','active'=>request()->is('admin')])>{{ __('Dashboard') }}</a>
<a href="/admin/settings" @class(['nav-link','active'=>request()->is('admin/settings')])>{{ __('Payment settings') }}</a>
<button class="nav-link" id="notices-button" type="button" aria-controls="notices" aria-expanded="false">{{ __('Notifications') }} <b id="unread" class="notification-count">0</b></button>
@endauth
</nav>
<div class="header-actions">
<form method="post" action="/admin/language" class="language-switch" aria-label="{{ __('Language') }}">@csrf<input type="hidden" name="return_to" value="{{ request()->getRequestUri() }}">
<button type="submit" name="language" value="en" aria-label="English" aria-pressed="{{ app()->getLocale()==='en'?'true':'false' }}" @class(['selected'=>app()->getLocale()==='en'])>EN</button>
<button type="submit" name="language" value="am" aria-label="አማርኛ" aria-pressed="{{ app()->getLocale()==='am'?'true':'false' }}" @class(['selected'=>app()->getLocale()==='am'])>አማ</button>
</form>
@auth<form method="post" action="/admin/logout">@csrf<button class="button secondary">{{ __('Sign out') }}</button></form>@endauth
</div></div></header>
<main id="main">
@if($errors->any())<aside class="alert error" role="alert">{{ __($errors->first()) }}</aside>@endif
@if(session('message'))<aside class="alert success" role="status">{{ __(session('message')) }}</aside>@endif
@yield('content')
@auth
<details id="notices" class="panel notification-panel"><summary>{{ __('Notification centre') }}</summary><div class="details-content">
<div class="section-heading"><p>{{ __('New payment requests appear here for review.') }}</p><button id="refresh-notices" class="button secondary" type="button">{{ __('Refresh') }}</button></div>
<p id="notification-status" class="helper" role="status">{{ __('Loading notifications…') }}</p><div id="notice-list"></div>
<div class="notification-tools"><button id="enable-push" class="button secondary" type="button">{{ __('Enable background notifications') }}</button><p id="push-status" class="helper" role="status">{{ __('In-panel notifications refresh automatically.') }}</p></div>
</div></details>
@endauth
</main>
<footer class="site-footer"><span>{{ __('Developed by') }} <strong>Rayz Technology plc</strong></span><span>Rayz Proforma · 2.0.8 · {{ date('Y') }}</span></footer>
<script id="admin-messages" type="application/json">{!! json_encode(collect(['Loading notifications…','Notifications are up to date.','Unable to refresh notifications. Please retry.','No payment notifications yet.','Payment request needs review','Background notifications are not configured. In-panel notifications remain available.','This browser cannot receive background notifications.','Notification permission was not granted.','Unable to save the notification subscription.','Background notifications enabled. Delivery depends on the server configuration.','In-panel notifications refresh automatically.','Processing…'])->mapWithKeys(fn($text)=>[$text=>__($text)]), JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_UNESCAPED_UNICODE) !!}</script>
<script src="/admin.js?v=2.0.3" defer></script>
</body></html>
