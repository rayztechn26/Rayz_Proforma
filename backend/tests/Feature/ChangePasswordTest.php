<?php
namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ChangePasswordTest extends TestCase
{
    use RefreshDatabase;

    private function token(User $u, string $plain): void
    {
        DB::table('api_tokens')->insert(['user_id'=>$u->id,'hash'=>hash('sha256',$plain),'expires_at'=>now()->addDay(),'created_at'=>now(),'updated_at'=>now()]);
    }

    public function test_owner_changes_legacy_password_keeps_current_token_and_revokes_other_sessions(): void
    {
        $u=User::factory()->create(['phone'=>'+251944444444','password'=>'LegacyPassword123','is_admin'=>false]);
        $other=User::factory()->create(['is_admin'=>false]);
        $this->token($u,'current-token');$this->token($u,'other-token');$this->token($other,'unrelated-token');
        DB::table('sessions')->insert(['id'=>'old-session','user_id'=>$u->id,'payload'=>'old','last_activity'=>time()]);
        $this->withToken('current-token')->postJson('/api/password',['current_password'=>'LegacyPassword123','password'=>'012345678','password_confirmation'=>'012345678'])->assertOk()->assertJsonPath('ok',true);
        $this->assertTrue(Hash::check('012345678',$u->fresh()->password));
        $this->assertDatabaseHas('api_tokens',['hash'=>hash('sha256','current-token')]);
        $this->assertDatabaseMissing('api_tokens',['hash'=>hash('sha256','other-token')]);
        $this->assertDatabaseHas('api_tokens',['hash'=>hash('sha256','unrelated-token')]);
        $this->assertDatabaseMissing('sessions',['id'=>'old-session']);
        $this->assertDatabaseHas('audit_events',['action'=>'account.password_changed','subject'=>(string)$u->id]);
        $this->assertDatabaseCount('payments',0);$this->assertDatabaseCount('entitlements',0);$this->assertDatabaseCount('licensed_companies',0);
        $this->withToken('current-token')->getJson('/api/account')->assertOk();
        $audit=DB::table('audit_events')->where('action','account.password_changed')->value('details');
        $this->assertStringNotContainsString('012345678',$audit);
    }

    public function test_wrong_current_password_and_invalid_confirmation_do_not_change_accounts_or_tokens(): void
    {
        $u=User::factory()->create(['password'=>'012345','is_admin'=>false]);$original=$u->password;$this->token($u,'token');
        $this->withToken('token')->postJson('/api/password',['current_password'=>'wrong','password'=>'9876543','password_confirmation'=>'9876543'])->assertUnprocessable()->assertJsonValidationErrors('current_password');
        $this->withToken('token')->postJson('/api/password',['current_password'=>'012345','password'=>'9876543','password_confirmation'=>'9876544'])->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->withToken('token')->postJson('/api/password',['current_password'=>'012345','password'=>'12345','password_confirmation'=>'12345'])->assertUnprocessable();
        $this->assertSame($original,$u->fresh()->password);$this->assertDatabaseCount('api_tokens',1);$this->assertDatabaseCount('audit_events',0);
    }

    public function test_endpoint_requires_customer_authentication_and_rate_limits_password_guesses(): void
    {
        $this->postJson('/api/password',[])->assertUnauthorized();
        $admin=User::factory()->create(['is_admin'=>true]);$this->token($admin,'admin-token');
        $this->withToken('admin-token')->postJson('/api/password',[])->assertForbidden();
        $u=User::factory()->create(['password'=>'012345','is_admin'=>false]);$this->token($u,'customer-token');
        \Illuminate\Support\Facades\Cache::flush();
        for($i=0;$i<6;$i++) {
            $this->app['auth']->forgetGuards(); // Separate HTTP requests do not share the test runner's cached guard.
            $this->withToken('customer-token')->postJson('/api/password',['current_password'=>'wrong','password'=>'987654','password_confirmation'=>'987654'])->assertUnprocessable();
        }
        $this->app['auth']->forgetGuards();
        $this->withToken('customer-token')->postJson('/api/password',[])->assertStatus(429);
    }
}
