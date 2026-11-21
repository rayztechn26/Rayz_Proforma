<section data-website-analytics data-endpoint="/admin/website-analytics" data-unavailable="{{ __('Counts are temporarily unavailable. Retrying…') }}" data-updated="{{ __('Updated') }}">
<h2>{{ __('Website visits and APK downloads') }}</h2>
<p class="helper">{{ __('Updates every 15 seconds. Today uses Ethiopian time (UTC+3). Active means seen in the last 2 minutes. Browser estimates are not verified people; download requests are not installations. Counts start when tracking is deployed.') }}</p>
<div class="table"><table><thead><tr><th>{{ __('Page') }}</th><th>{{ __('Views today') }}</th><th>{{ __('Visitors today (estimate)') }}</th><th>{{ __('Active browsers') }}</th><th>{{ __('All-time views') }}</th><th>{{ __('APK requests today') }}</th><th>{{ __('All-time APK requests') }}</th></tr></thead>
<tbody>@foreach(['services' => 'Main website Proforma section', 'download' => 'Product download page'] as $page => $label)
<tr><th>{{ __($label) }}</th>@foreach(['views_today','visitors_today','active','views','downloads_today','downloads'] as $metric)<td data-count="{{ $page }}.{{ $metric }}">—</td>@endforeach</tr>
@endforeach</tbody></table></div><p data-analytics-status class="helper" role="status">{{ __('Loading counts…') }}</p>
<button type="button" class="button secondary" data-analytics-retry>{{ __('Refresh') }}</button>
</section>
<script src="/website-analytics-admin.js?v=1" defer></script>
