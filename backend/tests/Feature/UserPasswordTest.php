<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\StrongPassword;
use App\Services\UserPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class UserPasswordTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_user_can_register_and_login_with_a_leading_zero_password(): void
    {
        foreach (['+251944444444'=>'042681', '+251955555555'=>'042681234'] as $phone=>$password) {
            $this->postJson('/api/register', ['phone'=>$phone, 'password'=>$password])->assertOk();
            $u = User::where('phone', $phone)->firstOrFail();
            $this->assertNotSame($password, $u->password);
            $this->assertTrue(Hash::check($password, $u->password));
            $this->postJson('/api/login', ['phone'=>$phone, 'password'=>$password])->assertOk();
            $this->postJson('/api/login', ['phone'=>$phone, 'password'=>'426810'])->assertUnprocessable();
        }
    }

    public function test_rule_accepts_longer_numeric_passwords_and_rejects_invalid_input_without_coercion(): void
    {
        foreach (['12345', str_repeat('1', 73), 'abc123', 'LegacyPassword123', '12345 ', "123456\n", '１２３４５６', 123456, ['123456'], null] as $value) {
            $v = Validator::make(['password'=>$value], ['password'=>UserPassword::rules()]);
            $this->assertTrue($v->fails());
        }
        foreach (['012345', '0123456', '012345678901234', str_repeat('1', 72)] as $valid) {
            $this->assertTrue(Validator::make(['password'=>$valid], ['password'=>UserPassword::rules()])->passes());
        }
        $this->postJson('/api/register', ['phone'=>'+251944444444', 'password'=>'abc123'])
            ->assertUnprocessable()->assertJsonValidationErrors('password');
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('api_tokens', 0);
    }

    public function test_existing_long_password_login_and_administrator_policy_are_preserved(): void
    {
        $u = User::factory()->create(['phone'=>'+251944444444', 'password'=>'LegacyPassword123', 'is_admin'=>false]);
        $this->postJson('/api/login', ['phone'=>$u->phone, 'password'=>'LegacyPassword123'])->assertOk();
        $this->assertTrue(Validator::make(['password'=>'042681'], ['password'=>StrongPassword::rules()])->fails());
        $this->assertTrue(Validator::make(['password'=>'AdminPassword123'], ['password'=>StrongPassword::rules()])->passes());
    }

    public function test_assisted_recovery_accepts_longer_numeric_passwords_and_cannot_reset_an_admin(): void
    {
        $admin = User::factory()->create(['phone'=>'+251922222222','is_admin'=>true]);
        $owner = User::factory()->create(['phone'=>'+251944444444', 'is_admin'=>false]);
        DB::table('api_tokens')->insert(['user_id'=>$owner->id,'hash'=>hash('sha256','old-token'),'expires_at'=>now()->addDay(),'created_at'=>now(),'updated_at'=>now()]);
        DB::table('sessions')->insert(['id'=>'old-session','user_id'=>$owner->id,'payload'=>'old-session-payload','last_activity'=>time()]);
        $this->actingAs($admin)->withSession(['admin_2fa'=>$admin->id]);
        $this->get('/admin')->assertOk()->assertSee('pattern="[0-9]{6,72}"', false)
            ->assertSee('maxlength="72"', false)->assertSee('Use at least 6 digits for your password.');
        $fields = ['phone'=>$owner->phone,'identity_checks'=>'Owner verified against original account records','password'=>'0123456789','confirmed'=>true];
        $this->post('/admin/recovery', $fields)->assertRedirect();
        $this->assertTrue(Hash::check('0123456789', $owner->fresh()->password));
        $this->assertDatabaseCount('api_tokens', 0);
        $this->assertDatabaseMissing('sessions', ['id'=>'old-session']);
        $this->assertDatabaseHas('audit_events', ['action'=>'account.recovered','subject'=>(string)$owner->id]);
        $fields['password']='longPassword123';
        $this->postJson('/admin/recovery', $fields)->assertUnprocessable();
        $fields['phone']=$admin->phone;
        $fields['password']='012345';
        $original=$admin->password;
        $this->postJson('/admin/recovery', $fields)->assertNotFound();
        $this->assertSame($original, $admin->fresh()->password);
    }
}
