@extends('admin.layout')
@section('title', __('Payment settings'))
@section('content')
<div class="page-heading"><div><span class="eyebrow">{{ __('CONFIGURATION') }}</span><h1>{{ __('Payment instructions') }}</h1><p>{{ __('Complete all required payment settings to enable new payment submissions. Changes will apply to new requests; existing requests will retain their original payment details.') }}</p></div><a class="button secondary" href="/admin">{{ __('Back to dashboard') }}</a></div>
<section class="panel narrow"><form method="post">@csrf
@foreach(['fee'=>'One-time activation fee (ETB)','merchant'=>'Telebirr recipient name','recipient'=>'Telebirr number / merchant ID','instructions'=>'Instructions','support'=>'Support contact','waiting'=>'Estimated approval time'] as $key=>$label)
<label for="setting-{{ $key }}">{{ __($label) }}</label>
@if($key==='instructions')<textarea id="setting-{{ $key }}" name="{{ $key }}" required rows="12">{{ old($key,$settings[$key]??'') }}</textarea>
@else<input id="setting-{{ $key }}" name="{{ $key }}" value="{{ old($key,$settings[$key]??'') }}" @if($key==='fee') inputmode="decimal" placeholder="1000.00" @endif required>
@endif
@endforeach<button class="button primary">{{ __('Save settings') }}</button>
</form></section>
@endsection
