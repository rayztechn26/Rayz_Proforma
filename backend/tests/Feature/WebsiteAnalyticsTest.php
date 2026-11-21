<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\WebsiteAnalytics;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class WebsiteAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    public function test_retries_heartbeats_and_reload_have_correct_counts_without_personal_data(): void
    {
        $payload = ['page' => 'download', 'kind' => 'view', 'event' => (string) Str::uuid(), 'visitor' => (string) Str::uuid()];
        $this->postJson('/api/analytics/events', $payload)->assertNoContent();
        $this->postJson('/api/analytics/events', $payload)->assertNoContent();
        $payload['kind'] = 'heartbeat';
        $this->postJson('/api/analytics/events', $payload)->assertNoContent();
        $this->getJson('/api/analytics/public')->assertOk()->assertJsonPath('download.views', 1)->assertJsonPath('download.visitors_today', 1)->assertJsonPath('download.active', 1)->assertJsonMissingPath('pages.services');
        $payload['kind'] = 'view'; $payload['event'] = (string) Str::uuid();
        $this->postJson('/api/analytics/events', $payload)->assertNoContent();
        $this->getJson('/api/analytics/public')->assertJsonPath('download.views', 2)->assertJsonPath('download.visitors_today', 1);
        $this->assertDatabaseMissing('website_analytics_visitors', ['id' => $payload['visitor']]);
        $this->assertDatabaseCount('website_analytics_events', 2);
        $this->assertDatabaseCount('payments', 0);
    }

    public function test_admin_metrics_require_existing_admin_and_second_factor(): void
    {
        $this->getJson('/admin/website-analytics')->assertRedirect('/admin/login');
        $user = User::factory()->create(['is_admin' => true]);
        $this->actingAs($user)->getJson('/admin/website-analytics')->assertRedirect('/admin/login');
        $this->actingAs($user)->withSession(['admin_2fa' => $user->id])->getJson('/admin/website-analytics')->assertOk()->assertJsonPath('pages.services.views', 0);
        $this->get('/admin')->assertOk()->assertSee('Website visits and APK downloads')->assertSee('data-website-analytics', false);
    }

    public function test_download_missing_file_and_head_do_not_count_and_retries_are_deduplicated(): void
    {
        $oldPublic = public_path();
        $tmp = sys_get_temp_dir().'/analytics-test-'.Str::uuid();
        mkdir($tmp.'/download/downloads', 0777, true);
        $this->app->usePublicPath($tmp);
        try {
            $this->get('/api/analytics/apk')->assertNotFound();
            $file = $tmp.'/download/downloads/Proforma-Studio-2.0.8.apk';
            file_put_contents($file, 'TEST APK ONLY');
            $this->head('/api/analytics/apk')->assertOk();
            $this->get('/api/analytics/apk', ['Range' => 'bytes=0-3'])->assertSuccessful();
            $this->getJson('/api/analytics/public')->assertJsonPath('download.downloads', 0);
            $url = '/api/analytics/apk?event='.Str::uuid();
            $this->get($url)->assertOk()->assertHeader('Content-Type', 'application/vnd.android.package-archive');
            $this->get($url)->assertOk();
            $this->getJson('/api/analytics/public')->assertJsonPath('download.downloads', 1);
            $latest = $tmp.'/download/downloads/Rayz-Proforma-2.0.9.apk';
            file_put_contents($latest, 'NEW TEST APK ONLY');
            file_put_contents($tmp.'/download/release.json', json_encode(['apk' => 'downloads/Rayz-Proforma-2.0.9.apk']));
            $response = $this->get('/api/analytics/apk');
            $response->assertOk();
            $this->assertSame(realpath($latest), $response->baseResponse->getFile()->getRealPath());
            file_put_contents($tmp.'/download/release.json', json_encode(['apk' => '../../.env']));
            $this->get('/api/analytics/apk')->assertStatus(503);
            unlink($tmp.'/download/release.json');
            $this->mock(WebsiteAnalytics::class, function ($mock) {
                $mock->shouldReceive('record')->andThrow(new \RuntimeException('Analytics database unavailable'));
            });
            $this->get('/api/analytics/apk')->assertOk();
        } finally {
            $this->app->usePublicPath($oldPublic);
            @unlink($tmp.'/download/downloads/Proforma-Studio-2.0.8.apk');
            @unlink($tmp.'/download/downloads/Rayz-Proforma-2.0.9.apk');
            @unlink($tmp.'/download/release.json');
            @rmdir($tmp.'/download/downloads'); @rmdir($tmp.'/download'); @rmdir($tmp);
        }
    }

    public function test_active_expires_daily_totals_persist_and_invalid_pages_are_rejected(): void
    {
        $analytics = app(WebsiteAnalytics::class);
        $analytics->record('services', 'view', (string) Str::uuid(), (string) Str::uuid());
        $this->travel(3)->minutes();
        $stats = $analytics->stats();
        $this->assertSame(0, $stats['pages']['services']['active']);
        $this->assertSame(1, $stats['pages']['services']['views']);
        $this->postJson('/api/analytics/events', ['page' => 'admin', 'kind' => 'view', 'event' => (string) Str::uuid(), 'visitor' => (string) Str::uuid()])->assertUnprocessable();
        $this->assertDatabaseCount('website_analytics_daily', 1);
    }
}
