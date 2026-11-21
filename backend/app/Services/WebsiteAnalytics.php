<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class WebsiteAnalytics
{
    public function record(string $page, string $kind, string $event, ?string $visitor): void
    {
        $day = now('Africa/Addis_Ababa')->toDateString();
        DB::transaction(function () use ($page, $kind, $event, $visitor, $day) {
            DB::table('website_analytics_daily')->insertOrIgnore(['day' => $day, 'page' => $page]);
            if ($visitor && $kind !== 'download') {
                // The browser ID rotates daily. Store only a server-keyed digest.
                $id = hash_hmac('sha256', $day.'|'.$page.'|'.$visitor, config('app.key'));
                $new = DB::table('website_analytics_visitors')->insertOrIgnore(['id' => $id, 'page' => $page, 'last_seen' => now()]);
                DB::table('website_analytics_visitors')->where('id', $id)->update(['last_seen' => now()]);
                if ($new) {
                    DB::table('website_analytics_daily')->where(['day' => $day, 'page' => $page])->increment('visitors');
                }
            }
            if ($kind === 'heartbeat') {
                return;
            }
            if (DB::table('website_analytics_events')->insertOrIgnore(['id' => $event, 'created_at' => now()])) {
                DB::table('website_analytics_daily')->where(['day' => $day, 'page' => $page])->increment($kind === 'download' ? 'downloads' : 'views');
            }
        }, 3);
        // Bounded retention for anonymous browser digests and retry IDs; daily totals remain.
        if (Cache::add('website-analytics-pruned', true, 86400)) {
            DB::table('website_analytics_visitors')->where('last_seen', '<', now()->subDays(30))->delete();
            DB::table('website_analytics_events')->where('created_at', '<', now()->subDays(30))->delete();
        }
    }

    public function stats(): array
    {
        $day = now('Africa/Addis_Ababa')->toDateString();
        $result = ['updated_at' => now()->toIso8601String(), 'day' => $day, 'timezone' => 'Africa/Addis_Ababa', 'pages' => []];
        foreach (['download', 'services'] as $page) {
            $all = DB::table('website_analytics_daily')->where('page', $page)->selectRaw('COALESCE(SUM(views), 0) as views, COALESCE(SUM(downloads), 0) as downloads')->first();
            $today = DB::table('website_analytics_daily')->where(['day' => $day, 'page' => $page])->first();
            $result['pages'][$page] = [
                'views' => (int) $all->views, 'downloads' => (int) $all->downloads,
                'views_today' => (int) ($today->views ?? 0), 'visitors_today' => (int) ($today->visitors ?? 0),
                'downloads_today' => (int) ($today->downloads ?? 0),
                'active' => DB::table('website_analytics_visitors')->where('page', $page)->where('last_seen', '>=', now()->subMinutes(2))->count(),
            ];
        }

        return $result;
    }
}
