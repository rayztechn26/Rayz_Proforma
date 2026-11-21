<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LocalAdminTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ValidateCsrfToken::class);
    }

    private function enable(): void
    {
        $this->app->detectEnvironment(fn () => 'local');
        config(['admin_auth.local_test_without_totp' => true]);
    }

    public function test_invalid_browser_login_returns_to_form_with_error_and_without_password(): void
    {
        $this->enable();
        $this->from('/admin/login')->post('/admin/login', ['phone' => '947833314', 'password' => 'wrong'])->assertRedirect('/admin/login')->assertSessionHasErrors('phone')->assertSessionHasInput('phone', '+251947833314')->assertSessionMissing('_old_input.password');
        $this->get('/admin/login')->assertOk()->assertSee('The phone number or password is incorrect.')->assertSee('value="+251947833314"', false);
    }

    public function test_national_and_domestic_phone_formats_match_registered_account(): void
    {
        $this->enable();
        $u = User::factory()->create(['phone' => '+251947833314', 'is_admin' => true, 'password' => 'password']);
        foreach (['947833314', '0947833314', '00251947833314', '+251 947 833 314'] as $phone) {
            $this->post('/admin/login', ['phone' => $phone, 'password' => 'password'])->assertRedirect('/admin')->assertSessionHas('admin_local_test', $u->id);
            $this->post('/admin/logout');
        }
    }

    public function test_loopback_local_login_works_without_code_and_checks_password(): void
    {
        $this->enable();
        $u = User::factory()->create(['phone' => '+251947833314', 'is_admin' => true, 'password' => 'password']);
        $this->get('/admin/login')->assertOk()->assertDontSee('name="code"', false);
        $this->postJson('/admin/login', ['phone' => $u->phone, 'password' => 'wrong'])->assertUnprocessable();
        $this->post('/admin/login', ['phone' => $u->phone, 'password' => 'password'])->assertRedirect('/admin')->assertSessionHas('admin_local_test', $u->id)->assertSessionMissing('admin_2fa');
        $this->get('/admin')->assertOk();
    }

    public function test_flag_cannot_disable_production_totp(): void
    {
        $this->app->detectEnvironment(fn () => 'production');
        config(['admin_auth.local_test_without_totp' => true]);
        $this->get('https://localhost/admin/login')->assertOk()->assertSee('name="code"', false);
        $this->postJson('https://localhost/admin/login', ['phone' => '+251947833314', 'password' => 'password'])->assertUnprocessable()->assertJsonValidationErrors('code');
    }

    public function test_remote_local_request_still_requires_authenticator(): void
    {
        $this->enable();
        $this->withServerVariables(['REMOTE_ADDR' => '192.168.1.50'])->get('/admin/login')->assertSee('name="code"', false);
        $this->postJson('/admin/login', ['phone' => '+251947833314', 'password' => 'password'])->assertUnprocessable()->assertJsonValidationErrors('code');
    }

    public function test_local_test_session_is_rejected_after_environment_change(): void
    {
        $this->enable();
        $u = User::factory()->create(['is_admin' => true]);
        $this->actingAs($u)->withSession(['admin_local_test' => $u->id]);
        $this->get('/admin')->assertOk();
        $this->app->detectEnvironment(fn () => 'production');
        $this->get('https://localhost/admin')->assertRedirect('/admin/login');
    }

    public function test_non_admin_cannot_use_local_login(): void
    {
        $this->enable();
        $u = User::factory()->create(['phone' => '+251947833314', 'is_admin' => false, 'password' => 'password']);
        $this->postJson('/admin/login', ['phone' => $u->phone, 'password' => 'password'])->assertUnprocessable();
    }
}
