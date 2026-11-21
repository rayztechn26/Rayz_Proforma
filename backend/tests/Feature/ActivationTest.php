<?php

namespace Tests\Feature;

use App\Models\User;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\SignatureInvalidException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

class ActivationTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $admin;

    private string $token;

    private $device;

    private string $privatePath;

    protected function setUp(): void
    {
        parent::setUp();
        $this->owner = User::factory()->create(['phone' => '+251911111111']);
        $this->admin = User::factory()->create(['phone' => '+251922222222', 'is_admin' => true]);
        $this->token = bin2hex(random_bytes(32));
        DB::table('api_tokens')->insert(['user_id' => $this->owner->id, 'hash' => hash('sha256', $this->token), 'expires_at' => now()->addDay(), 'created_at' => now(), 'updated_at' => now()]);
        $this->device = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        $this->privatePath = tempnam(sys_get_temp_dir(), 'lic');
        $signing = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($signing, $pem);
        file_put_contents($this->privatePath, $pem);
        config(['licensing.private_key_path' => $this->privatePath, 'licensing.key_id' => 'test-key']);
    }

    protected function tearDown(): void
    {
        if (isset($this->privatePath)) {
            @unlink($this->privatePath);
        }parent::tearDown();
    }

    private function settings(): void
    {
        DB::table('payment_settings')->insert(['id' => 1, 'value' => json_encode(['fee' => '100.00', 'merchant' => 'TEST ONLY', 'recipient' => 'TEST ONLY', 'instructions' => 'TEST ONLY: external payment', 'support' => 'TEST SUPPORT', 'waiting' => 'TEST WAIT']), 'created_at' => now(), 'updated_at' => now()]);
    }

    private function requestPayment(string $ref = 'Example FT 1', array $extra = [])
    {
        return $this->withToken($this->token)->postJson('/api/payments', $extra + ['idempotency' => (string) Str::uuid(), 'payer_phone' => '+251933333333', 'reference' => $ref]);
    }

    private function review(string $id, array $override = [])
    {
        return $this->actingAs($this->admin)->withSession(['admin_2fa' => $this->admin->id])->postJson('/admin/payments/'.$id.'/approve', $override + ['confirmed' => true, 'verified_external' => true, 'received' => '100.00', 'verified_reference' => 'Example FT 1']);
    }

    private function proof($key = null): array
    {
        $key ??= $this->device;
        $c = $this->withToken($this->token)->postJson('/api/challenges', ['public_key' => openssl_pkey_get_details($key)['key']])->assertOk()->json();
        openssl_sign($c['nonce'], $sig, $key, OPENSSL_ALGO_SHA256);

        return ['challenge_id' => $c['id'], 'signature' => base64_encode($sig)];
    }

    private function profile(string $id = 'legacy-company-id'): array
    {
        return ['id' => $id, 'name' => 'Example Company', 'tin' => 'TEST-TIN', 'vat' => '15', 'vatConfirmed' => true, 'currency' => 'ETB', 'prefix' => 'PF', 'logo' => 'data:image/png;base64,'.base64_encode(base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='))];
    }

    private function approved(): array
    {
        $this->settings();
        $id = $this->requestPayment()->assertCreated()->json('id');
        $this->review($id)->assertRedirect();

        return [$id, DB::table('entitlements')->value('id')];
    }

    public function test_register_login_logout_and_phone_normalization(): void
    {
        $r = $this->postJson('/api/register', ['phone' => '00251 944-444-444', 'password' => '042681'])->assertOk();
        $this->assertSame('+251944444444', $r->json('phone'));
        $this->assertDatabaseHas('users', ['phone' => '+251944444444', 'email_verified_at' => null]);
        $this->postJson('/api/login', ['phone' => '+251944444444', 'password' => 'bad'])->assertUnprocessable();
        $token = $this->postJson('/api/login', ['phone' => '+251944444444', 'password' => '042681'])->assertOk()->json('token');
        $this->withToken($token)->postJson('/api/logout')->assertOk();
        $this->withToken($token)->getJson('/api/account')->assertUnauthorized();
    }

    public function test_no_fee_config_blocks_submission_and_no_entitlement_blocks_company(): void
    {
        $this->requestPayment()->assertConflict();
        $this->withToken($this->token)->postJson('/api/companies', ['profile' => $this->profile(), 'entitlement_id' => (string) Str::uuid()] + $this->proof())->assertForbidden();
        $this->assertDatabaseCount('licensed_companies', 0);
    }

    public function test_pending_snapshot_idempotent_submission_and_admin_notification(): void
    {
        $this->settings();
        $key = (string) Str::uuid();
        $id = $this->requestPayment('  mixed Ref  ', ['idempotency' => $key])->assertCreated()->json('id');
        $this->requestPayment('  mixed Ref  ', ['idempotency' => $key])->assertOk()->assertJsonPath('id', $id);
        $this->assertDatabaseCount('payments', 1);
        $this->assertDatabaseHas('payments', ['reference' => 'MIXED REF', 'expected_cents' => 10000, 'status' => 'pending']);
        DB::table('payment_settings')->update(['value' => json_encode(['fee' => '999.00'])]);
        $this->assertDatabaseHas('payments', ['expected_cents' => 10000]);
        $this->assertDatabaseCount('admin_notices', 1);
        $this->assertDatabaseCount('entitlements', 0);
        $this->actingAs($this->admin)->withSession(['admin_2fa' => $this->admin->id])->getJson('/admin/notifications')->assertOk()->assertJsonPath('unread', 1);
    }

    public function test_duplicate_reference_and_rejected_correction_history(): void
    {
        $this->settings();
        $id = $this->requestPayment()->assertCreated()->json('id');
        $this->requestPayment('example ft 1')->assertConflict();
        $this->actingAs($this->admin)->withSession(['admin_2fa' => $this->admin->id])->postJson('/admin/payments/'.$id.'/reject', ['confirmed' => true, 'reason' => 'Reference could not be verified'])->assertRedirect();
        $new = $this->requestPayment('Fixed reference', ['previous_id' => $id])->assertCreated()->json('id');
        $this->assertDatabaseHas('payments', ['id' => $new, 'previous_id' => $id, 'status' => 'pending']);
        $this->assertDatabaseHas('payments', ['id' => $id, 'status' => 'rejected', 'reason' => 'Reference could not be verified', 'active_reference' => null]);
    }

    public function test_independent_check_underpayment_and_idempotent_approval(): void
    {
        $this->settings();
        $id = $this->requestPayment()->assertCreated()->json('id');
        $this->review($id, ['verified_external' => false])->assertUnprocessable();
        $this->review($id, ['received' => '99.99'])->assertUnprocessable();
        $this->assertDatabaseCount('entitlements', 0);
        $this->review($id)->assertRedirect();
        $otherAdmin = User::factory()->create(['is_admin' => true]);
        $this->actingAs($otherAdmin)->withSession(['admin_2fa' => $otherAdmin->id])->postJson('/admin/payments/'.$id.'/approve', ['confirmed' => true, 'verified_external' => true, 'received' => '100.00', 'verified_reference' => 'Example FT 1'])->assertRedirect();
        $this->assertDatabaseCount('entitlements', 1);
        $this->assertDatabaseHas('payments', ['verified_reference' => 'EXAMPLE FT 1', 'reviewer_id' => $this->admin->id]);
    }

    public function test_unique_verified_reference_and_pending_dispute_release(): void
    {
        $this->settings();
        $id = $this->requestPayment()->json('id');
        $other = $this->requestPayment('second')->json('id');
        $this->review($id, ['verified_reference' => 'second'])->assertConflict();
        $this->actingAs($this->admin)->withSession(['admin_2fa' => $this->admin->id])->postJson('/admin/payments/'.$other.'/dispute', ['confirmed' => true, 'reason' => 'Merchant records establish incorrect pending claim'])->assertRedirect();
        $this->review($id, ['verified_reference' => 'second'])->assertRedirect();
        $this->requestPayment('SECOND')->assertConflict();
        $this->assertDatabaseHas('audit_events', ['action' => 'payment.disputed_reference_released', 'subject' => $other]);
    }

    public function test_ownership_private_receipts_and_admin_second_factor(): void
    {
        $this->settings();
        Storage::fake('local');
        $r = $this->requestPayment('receipt', ['receipt' => UploadedFile::fake()->image('receipt.png')])->assertCreated();
        $id = $r->json('id');
        $this->withToken($this->token)->get('/admin/payments/'.$id.'/receipt')->assertRedirect('/admin/login');
        $this->actingAs($this->admin)->get('/admin/payments/'.$id.'/receipt')->assertRedirect('/admin/login');
        $this->withSession(['admin_2fa' => $this->admin->id])->get('/admin/payments/'.$id.'/receipt')->assertOk()->assertHeader('Cache-Control', 'no-store, private');
        $this->withToken($this->token)->postJson('/api/companies', ['profile' => $this->profile(), 'entitlement_id' => (string) Str::uuid()] + $this->proof())->assertForbidden();
    }

    public function test_real_signed_company_license_and_one_entitlement_one_company(): void
    {
        [$id,$e] = $this->approved();
        $p = $this->proof();
        $r = $this->withToken($this->token)->postJson('/api/companies', ['profile' => $this->profile(), 'entitlement_id' => $e] + $p);
        $r->assertOk();
        $private = openssl_pkey_get_private(file_get_contents($this->privatePath));
        $pub = openssl_pkey_get_details($private)['key'];
        $claims = JWT::decode($r->json('license'), new Key($pub, 'RS256'));
        $this->assertSame('legacy-company-id', $claims->company_id);
        $this->assertSame(hash('sha256', base64_decode(preg_replace('/-----[^-]+-----|\s/', '', openssl_pkey_get_details($this->device)['key']))), $claims->device_fp);
        $this->assertObjectNotHasProperty('exp', $claims);
        $this->withToken($this->token)->postJson('/api/companies', ['profile' => $this->profile('different-company'), 'entitlement_id' => $e] + $this->proof())->assertConflict();
        $this->withToken($this->token)->postJson('/api/companies', ['profile' => $this->profile(), 'entitlement_id' => $e] + $p)->assertUnprocessable();
        $this->assertDatabaseCount('licensed_companies', 1);
    }

    public function test_device_transfer_requires_admin_review_and_new_key_proof(): void
    {
        [, $e] = $this->approved();
        $this->withToken($this->token)->postJson('/api/companies', ['profile' => $this->profile(), 'entitlement_id' => $e] + $this->proof())->assertOk();
        $old = DB::table('devices')->value('fingerprint');
        $new = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        $this->withToken($this->token)->postJson('/api/companies/legacy-company-id/recover', $this->proof($new))->assertForbidden();
        $rid = $this->withToken($this->token)->postJson('/api/companies/legacy-company-id/changes', ['kind' => 'transfer', 'reason' => 'New phone; verify original ownership'] + $this->proof($new))->assertOk()->json('id');
        $this->actingAs($this->admin)->withSession(['admin_2fa' => $this->admin->id])->postJson('/admin/changes/'.$rid, ['decision' => 'approved', 'reason' => 'Original ownership verified independently', 'confirmed' => true])->assertRedirect();
        $this->withToken($this->token)->postJson('/api/companies/legacy-company-id/recover', ['transfer_id' => $rid] + $this->proof($new))->assertOk();
        $this->assertNotSame($old, DB::table('devices')->value('fingerprint'));
        $this->withToken($this->token)->postJson('/api/companies/legacy-company-id/recover', $this->proof())->assertForbidden();
        $this->assertDatabaseHas('audit_events', ['action' => 'device.transferred']);
    }

    public function test_identity_changes_need_review_and_ordinary_updates_cannot_change_tin(): void
    {
        [, $e] = $this->approved();
        $this->withToken($this->token)->postJson('/api/companies', ['profile' => $this->profile(), 'entitlement_id' => $e] + $this->proof())->assertOk();
        $p = $this->profile();
        $p['tin'] = 'NEW';
        $this->withToken($this->token)->putJson('/api/companies/legacy-company-id', ['profile' => $p])->assertUnprocessable();
        $rid = $this->withToken($this->token)->postJson('/api/companies/legacy-company-id/changes', ['kind' => 'identity', 'name' => 'Corrected', 'tin' => 'NEW', 'reason' => 'Legal correction with supporting records'])->assertOk()->json('id');
        $this->actingAs($this->admin)->withSession(['admin_2fa' => $this->admin->id])->postJson('/admin/changes/'.$rid, ['decision' => 'approved', 'reason' => 'Identity correction checked against records', 'confirmed' => true])->assertRedirect();
        $this->assertDatabaseHas('licensed_companies', ['name' => 'Corrected', 'tin' => 'NEW']);
    }

    public function test_admin_login_requires_real_totp_and_rejects_replay(): void
    {
        $g = new Google2FA;
        $this->admin->password = 'StrongPassword123';
        $this->admin->totp_secret = $g->generateSecretKey();
        $this->admin->save();
        $code = $g->getCurrentOtp($this->admin->totp_secret);
        $this->post('/admin/login', ['phone' => $this->admin->phone, 'password' => 'StrongPassword123', 'code' => $code])->assertRedirect('/admin');
        $this->post('/admin/logout');
        $this->postJson('/admin/login', ['phone' => $this->admin->phone, 'password' => 'StrongPassword123', 'code' => $code])->assertUnprocessable();
    }

    public function test_admin_pages_render_and_grants_are_separate_from_payments(): void
    {
        $this->actingAs($this->admin)->withSession(['admin_2fa' => $this->admin->id]);
        $this->get('/admin')->assertOk()->assertSee('Payment requests');
        $this->get('/admin/settings')->assertOk();
        $this->post('/admin/grants', ['phone' => $this->owner->phone, 'reason' => 'Complimentary activation after owner review', 'confirmed' => true])->assertRedirect();
        $this->assertDatabaseCount('entitlements', 1);
        $this->assertDatabaseCount('payments', 0);
    }

    public function test_signed_licence_rejects_modified_claims(): void
    {
        [, $e] = $this->approved();
        $r = $this->withToken($this->token)->postJson('/api/companies', ['profile' => $this->profile(), 'entitlement_id' => $e] + $this->proof())->assertOk();
        $parts = explode('.', $r->json('license'));
        $claims = json_decode(JWT::urlsafeB64Decode($parts[1]), true);
        $claims['company_id'] = 'another-company';
        $parts[1] = JWT::urlsafeB64Encode(json_encode($claims));
        $public = openssl_pkey_get_details(openssl_pkey_get_private(file_get_contents($this->privatePath)))['key'];
        $this->expectException(SignatureInvalidException::class);
        JWT::decode(implode('.', $parts), new Key($public, 'RS256'));
    }

    public function test_upload_must_be_a_real_jpeg_or_png(): void
    {
        $this->settings();
        Storage::fake('local');
        $this->requestPayment('fake image', ['receipt' => UploadedFile::fake()->createWithContent('receipt.png', 'not image content')])->assertUnprocessable();
        $this->assertDatabaseCount('payments', 0);
        $this->assertDatabaseCount('admin_notices', 0);
    }

    public function test_signing_outage_rolls_back_registration_without_losing_approved_entitlement(): void
    {
        [$payment, $entitlement] = $this->approved();
        $proof = $this->proof();
        config(['licensing.private_key_path' => $this->privatePath.'.missing']);
        $result = $this->withToken($this->token)->postJson('/api/companies', ['profile' => $this->profile(), 'entitlement_id' => $entitlement] + $proof);
        $result->assertStatus(503)->assertHeader('Content-Type', 'application/json')->assertHeader('X-Request-ID');
        $this->assertDatabaseCount('licensed_companies', 0);
        $this->assertDatabaseCount('devices', 0);
        $this->assertDatabaseHas('payments', ['id' => $payment, 'status' => 'approved']);
        $this->assertDatabaseHas('entitlements', ['id' => $entitlement]);
        $this->assertDatabaseHas('challenges', ['id' => $proof['challenge_id'], 'used_at' => null]);
        $this->withToken($this->token)->getJson('/api/account')->assertJsonPath('entitlements.0.id', $entitlement);
        config(['licensing.private_key_path' => $this->privatePath]);
        $this->withToken($this->token)->postJson('/api/companies', ['profile' => $this->profile(), 'entitlement_id' => $entitlement] + $proof)->assertOk();
        $this->assertDatabaseCount('licensed_companies', 1);
        $this->assertDatabaseCount('devices', 1);
    }

    public function test_lost_registration_response_can_retry_with_fresh_proof_and_same_identity(): void
    {
        [, $entitlement] = $this->approved();
        $first = $this->withToken($this->token)->postJson('/api/companies', ['profile' => $this->profile(), 'entitlement_id' => $entitlement] + $this->proof())->assertOk();
        $device = DB::table('devices')->first();
        $this->withToken($this->token)->getJson('/api/account')->assertJsonCount(0, 'entitlements');
        $retry = $this->withToken($this->token)->postJson('/api/companies', ['profile' => $this->profile(), 'entitlement_id' => $entitlement] + $this->proof())->assertOk();
        $firstProfile = $first->json('profile');
        $retryProfile = $retry->json('profile');
        // MySQL JSON canonicalizes object key ordering; values and types must match.
        ksort($firstProfile);
        ksort($retryProfile);
        $this->assertSame($firstProfile, $retryProfile);
        $this->assertSame($device->license_id, DB::table('devices')->value('license_id'));
        $this->assertDatabaseCount('licensed_companies', 1);
        $this->assertDatabaseCount('devices', 1);
        $this->assertDatabaseCount('entitlements', 1);
        $this->assertSame(1, DB::table('audit_events')->where('action', 'company.activated')->count());
        $changed = $this->profile();
        $changed['tin'] = 'CHANGED';
        $this->withToken($this->token)->postJson('/api/companies', ['profile' => $changed, 'entitlement_id' => $entitlement] + $this->proof())->assertConflict();
        $this->assertDatabaseHas('licensed_companies', ['tin' => 'TEST-TIN']);
    }

    public function test_invalid_private_key_returns_service_error_and_preserves_entitlement(): void
    {
        [, $entitlement] = $this->approved();
        file_put_contents($this->privatePath, 'invalid signing key');
        $this->withToken($this->token)->postJson('/api/companies', ['profile' => $this->profile(), 'entitlement_id' => $entitlement] + $this->proof())->assertStatus(503);
        $this->assertDatabaseCount('licensed_companies', 0);
        $this->assertDatabaseCount('devices', 0);
        $this->withToken($this->token)->getJson('/api/account')->assertJsonPath('entitlements.0.id', $entitlement);
    }

    public function test_api_errors_are_json_without_accept_header_and_include_correlation_id(): void
    {
        $this->get('/api/account')->assertUnauthorized()->assertHeader('Content-Type', 'application/json')->assertHeader('X-Request-ID');
    }
}
