<?php

namespace App\Http\Controllers;

use App\Services\WebsiteAnalytics;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class WebsiteAnalyticsController extends Controller
{
    public function record(Request $request, WebsiteAnalytics $analytics)
    {
        $data = $request->validate([
            'page' => 'required|in:download,services', 'kind' => 'required|in:view,heartbeat',
            'event' => 'required|uuid', 'visitor' => 'required|uuid',
        ]);
        $analytics->record($data['page'], $data['kind'], $data['event'], $data['visitor']);

        return response()->noContent()->header('Cache-Control', 'no-store');
    }

    public function publicStats(WebsiteAnalytics $analytics)
    {
        $stats = $analytics->stats();
        // Public data is aggregate-only; no account, payment or visitor records.
        return response()->json(['updated_at' => $stats['updated_at'], 'day' => $stats['day'], 'download' => $stats['pages']['download']])->header('Cache-Control', 'no-store');
    }

    public function adminStats(WebsiteAnalytics $analytics)
    {
        return response()->json($analytics->stats())->header('Cache-Control', 'no-store');
    }

    public function download(Request $request, WebsiteAnalytics $analytics)
    {
        // Keep the tracked link aligned with the release shown on the public page.
        // The manifest is an operator-managed local file, never a request path.
        $relative = 'downloads/Proforma-Studio-2.0.8.apk';
        $manifest = public_path('download/release.json');
        if (is_file($manifest)) {
            try {
                $release = json_decode(file_get_contents($manifest), true, 16, JSON_THROW_ON_ERROR);
            } catch (\Throwable $error) {
                abort(503, 'The download release is not configured.');
            }
            $relative = $release['apk'] ?? '';
            abort_unless(is_string($relative) && preg_match('#\Adownloads/(?:Rayz-Proforma|Proforma-Studio)-[0-9]+\.[0-9]+\.[0-9]+\.apk\z#D', $relative), 503, 'The download release is not configured.');
        }
        $file = public_path('download/'.$relative);
        abort_unless(is_file($file), 404, 'APK is not available.');
        // HEAD/range resume/probe requests must not inflate download counts.
        if (! $request->isMethod('HEAD') && ! $request->headers->has('Range')) {
            try {
                $event = Str::isUuid($request->query('event', '')) ? $request->query('event') : (string) Str::uuid();
                $analytics->record('download', 'download', $event, null);
            } catch (\Throwable $error) {
                report($error); // Analytics outages must not prevent the APK download.
            }
        }

        return response()->download($file, basename($file), ['Content-Type' => 'application/vnd.android.package-archive', 'Cache-Control' => 'private, no-store']);
    }
}
