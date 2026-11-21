@extends('admin.layout')
@section('title', __('Administrator sign in'))
@section('content')
<section class="panel narrow login-panel">
<span class="eyebrow">{{ __('SECURE ACCESS') }}</span>
<h1>{{ __('Administrator sign in') }}</h1><p class="helper">{{ __('Manage payments, company licences and account recovery.') }}</p>
@if($localTest)<p class="alert info">{{ __('Local testing: sign in with your phone and password.') }}</p>@endif
<form method="post" action="/admin/login">@csrf
<label for="phone">{{ __('Phone with country code') }}</label><input id="phone" name="phone" value="{{ old('phone') }}" inputmode="tel" autocomplete="username" placeholder="+251…" required maxlength="40" aria-describedby="phone-help">
<p id="phone-help" class="helper field-help">{{ __('Ethiopian mobile numbers also work with a leading 0 or without the country code.') }}</p>
<div class="label-row"><label for="password">{{ __('Password') }}</label><button class="text-button" type="button" data-password-toggle="password" data-show-label="{{ __('Show') }}" data-hide-label="{{ __('Hide') }}" aria-label="{{ __('Show password') }}" aria-pressed="false">{{ __('Show') }}</button></div><input id="password" name="password" type="password" autocomplete="current-password" required>
@unless($localTest)<label for="code">{{ __('Authenticator code') }}</label><input id="code" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" placeholder="000000" required>@endunless
<button class="button primary" type="submit">{{ __('Sign in') }}</button>
</form><p class="helper login-note">{{ __('Administrator accounts are created by the server operator.') }}</p>
</section>
@endsection
