@if($payments->hasPages())
<nav class="pagination" aria-label="{{ __('Payment pages') }}">
@if($payments->onFirstPage())<span>{{ __('Previous') }}</span>@else<a class="button secondary" href="{{ $payments->previousPageUrl() }}">{{ __('Previous') }}</a>@endif
<span>{{ __('Page :current of :last', ['current'=>$payments->currentPage(), 'last'=>$payments->lastPage()]) }}</span>
@if($payments->hasMorePages())<a class="button secondary" href="{{ $payments->nextPageUrl() }}">{{ __('Next') }}</a>@else<span>{{ __('Next') }}</span>@endif
</nav>@endif
