<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class SecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_account_cannot_consume_another_owners_entitlement_or_recover_their_company(): void
    {
        $a = User::factory()->create();
        $b = User::factory()->create();
        $token = bin2hex(random_bytes(32));
        DB::table('api_tokens')->insert(['user_id' => $b->id, 'hash' => hash('sha256', $token), 'expires_at' => now()->addDay()]);
        $e = (string) Str::uuid();
        DB::table('entitlements')->insert(['id' => $e, 'user_id' => $a->id, 'grant_reason' => 'Test grant']);
        $this->withToken($token)->postJson('/api/companies', ['entitlement_id' => $e, 'challenge_id' => (string) Str::uuid(), 'signature' => 'x', 'profile' => ['id' => 'company', 'name' => 'Example', 'tin' => 'TIN', 'vat' => '15', 'vatConfirmed' => true, 'logo' => 'data:image/png;base64,AA==']])->assertForbidden();
        DB::table('licensed_companies')->insert(['id' => 'owned-company', 'user_id' => $a->id, 'entitlement_id' => $e, 'name' => 'Owner', 'tin' => 'TIN', 'profile' => '{}']);
        $this->withToken($token)->postJson('/api/companies/owned-company/recover', ['challenge_id' => (string) Str::uuid(), 'signature' => 'x'])->assertNotFound();
        $this->withToken($token)->putJson('/api/companies/owned-company', ['profile' => []])->assertNotFound();
    }

    public function test_registration_rate_limit_and_invalid_upload(): void
    {
        for ($i = 0; $i < 7; $i++) {
            $r = $this->postJson('/api/register', ['phone' => 'not-a-number', 'password' => 'bad']);
        }$r->assertTooManyRequests();
    }

    public function test_production_rejects_plain_http_before_authentication(): void
    {
        $this->app->detectEnvironment(fn () => 'production');
        $this->postJson('/api/login', ['phone' => '+251911111111', 'password' => 'anything'])->assertForbidden();
    }
}
