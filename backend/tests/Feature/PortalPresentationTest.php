<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PortalPresentationTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_language_selection_persists_and_preserves_production_totp(): void
    {
        $this->post('/admin/language', ['language' => 'am', 'return_to' => '/admin/login'])
            ->assertRedirect('/admin/login')->assertSessionHas('admin_locale', 'am');
        $this->get('/admin/login')->assertOk()->assertSee('የአስተዳዳሪ መግቢያ')
            ->assertSee('አማ')->assertSee('name="code"', false)->assertSee('Rayz Technology plc');
    }

    public function test_locale_redirect_cannot_leave_admin_and_invalid_locale_is_rejected(): void
    {
        $this->post('/admin/language', ['language' => 'am', 'return_to' => '//example.com'])
            ->assertRedirect('/admin/login');
        $this->post('/admin/language', ['language' => 'xx'])->assertSessionHasErrors('language');
    }

    public function test_dashboard_empty_states_and_date_validation_keep_authentication_required(): void
    {
        $this->get('/admin')->assertRedirect('/admin/login');
        $user = User::factory()->create(['is_admin' => true]);
        $this->actingAs($user)->withSession(['admin_2fa' => $user->id]);
        $this->get('/admin')->assertOk()->assertSee('No payment requests match these filters.')
            ->assertSee('Clear filters')->assertSee('id="recovery-password"', false);
        $this->from('/admin')->get('/admin?from=2026-10-21&to=2026-10-01')
            ->assertRedirect('/admin')->assertSessionHasErrors('to');
    }

    public function test_bad_fee_returns_to_settings_without_losing_entered_instructions(): void
    {
        $user = User::factory()->create(['is_admin' => true]);
        $this->actingAs($user)->withSession(['admin_2fa' => $user->id]);
        $fields = ['fee' => '1,000.00', 'merchant' => 'Example merchant', 'recipient' => '123', 'instructions' => 'Example instructions', 'support' => 'Example support', 'waiting' => 'One day'];
        $this->from('/admin/settings')->post('/admin/settings', $fields)->assertRedirect('/admin/settings')
            ->assertSessionHasErrors('fee')->assertSessionHasInput('instructions', 'Example instructions');
        $fields['fee'] = '0.00';
        $this->post('/admin/settings', $fields)->assertSessionHasErrors('fee');
        $this->assertDatabaseCount('payment_settings', 0);
    }
}
