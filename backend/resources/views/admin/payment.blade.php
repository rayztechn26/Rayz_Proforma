@extends('admin.layout')
@section('title', __('Payment review'))
@section('content')
<div class="page-heading"><div><span class="eyebrow">{{ __('MANUAL VERIFICATION') }}</span><h1>{{ __('Payment review') }}</h1><span class="status status-{{ $p->status }}">{{ __(ucfirst($p->status)) }}</span></div><a class="button secondary" href="/admin">{{ __('Back to payment requests') }}</a></div>
<section><dl class="review-details">
@foreach(['id'=>'Request ID','payer_phone'=>'Payer phone','reference'=>'Submitted reference','created_at'=>'Submitted at','reason'=>'Rejection reason','verified_reference'=>'Verified reference','admin_notes'=>'Admin notes','reviewed_at'=>'Reviewed at','previous_id'=>'Corrects request'] as $key=>$label)<div><dt>{{ __($label) }}</dt><dd>{{ $p->$key??'—' }}</dd></div>@endforeach
<div><dt>{{ __('Account phone') }}</dt><dd>{{ $user->phone }}</dd></div>
<div><dt>{{ __('Expected amount') }}</dt><dd>{{ number_format($p->expected_cents/100,2) }} ETB</dd></div>
<div><dt>{{ __('Confirmed received amount') }}</dt><dd>{{ $p->received_cents!==null?number_format($p->received_cents/100,2).' ETB':__('Unconfirmed') }}</dd></div>
<div><dt>{{ __('Reviewer') }}</dt><dd>{{ $reviewer?->phone??'—' }}</dd></div><div><dt>{{ __('User note') }}</dt><dd>{{ $p->note?:'—' }}</dd></div>
<div><dt>{{ __('Instructions snapshot') }}</dt><dd><pre>{{ json_encode(json_decode($p->instructions),JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE) }}</pre></dd></div>
</dl>
@if($p->receipt)<a class="button secondary" href="/admin/payments/{{ $p->id }}/receipt" target="_blank" rel="noopener">{{ __('View protected receipt') }}</a><p class="helper" style="margin-top:12px">{{ __('A screenshot or typed reference is not proof of payment.') }}</p>@endif
</section>
@if($p->status==='pending')<div class="grid">
<section><h2>{{ __('Approve payment') }}</h2><form method="post" action="/admin/payments/{{ $p->id }}/approve" data-confirm="{{ __('Approve this payment and grant one company registration?') }}">@csrf
<label>{{ __('Verified transaction reference') }}<input name="verified_reference" value="{{ old('verified_reference') }}" required maxlength="120"></label>
<label>{{ __('Amount actually received (ETB)') }}<input name="received" value="{{ old('received') }}" inputmode="decimal" required></label>
<label>{{ __('Notes') }}<textarea name="notes">{{ old('notes') }}</textarea></label>
<label class="check"><input type="checkbox" name="verified_external" value="1" required>{{ __('I checked receipt in my own Telebirr account or merchant records.') }}</label>
<label class="check"><input type="checkbox" name="confirmed" value="1" required>{{ __('I confirm approval.') }}</label><button class="button primary">{{ __('Approve payment') }}</button>
</form></section>
<section><h2>{{ __('Reject payment') }}</h2><form method="post" action="/admin/payments/{{ $p->id }}/reject" data-confirm="{{ __('Reject this submission?') }}">@csrf
<label>{{ __('Reason shown to user') }}<textarea name="reason" minlength="10" required>{{ old('reason') }}</textarea></label><label class="check"><input type="checkbox" name="confirmed" value="1" required>{{ __('Confirm rejection') }}</label><button class="button danger">{{ __('Reject payment') }}</button></form>
<h3>{{ __('Resolve disputed pending reference') }}</h3><p class="helper">{{ __('Independently verify the legitimate payer before releasing a pending claim. Approved references remain unique.') }}</p>
<form method="post" action="/admin/payments/{{ $p->id }}/dispute" data-confirm="{{ __('Release this disputed pending claim and record the reason?') }}">@csrf<label>{{ __('Investigation and visible reason') }}<textarea name="reason" minlength="10" required></textarea></label><label class="check"><input type="checkbox" name="confirmed" value="1" required>{{ __('Identity and merchant records checked') }}</label><button class="button secondary">{{ __('Release pending claim') }}</button></form>
</section></div>@endif
@endsection
