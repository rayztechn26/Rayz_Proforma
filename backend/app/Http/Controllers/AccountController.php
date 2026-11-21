<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\Records;
use App\Services\UserPassword;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class AccountController extends Controller
{
    public function register(Request $r)
    {
        $d = $r->validate(['phone' => 'required|string|max:40', 'password' => UserPassword::rules()]);
        $phone = Records::phone($d['phone']);
        abort_if(User::where('phone', $phone)->exists(), 422, 'Account cannot be registered with these details.');
        $u = User::create(['phone' => $phone, 'name' => 'Customer', 'email' => bin2hex(random_bytes(16)).'@accounts.invalid', 'password' => $d['password']]);

        return $this->token($u);
    }

    public function login(Request $r)
    {
        $d = $r->validate(['phone' => 'required|string|max:40', 'password' => 'required|string|max:512']);
        $u = User::where('phone', Records::phone($d['phone']))->where('is_admin', false)->first();
        abort_unless($u && Hash::check($d['password'], $u->password), 422, 'Invalid account credentials.');

        return $this->token($u);
    }

    private function token(User $u)
    {
        $token = bin2hex(random_bytes(32));
        DB::table('api_tokens')->insert(['user_id' => $u->id, 'hash' => hash('sha256', $token), 'expires_at' => now()->addDays(30), 'created_at' => now(), 'updated_at' => now()]);

        return ['token' => $token, 'phone' => $u->phone, 'user_id' => $u->id];
    }

    public function logout(Request $r)
    {
        DB::table('api_tokens')->where('id', $r->attributes->get('token_id'))->delete();

        return ['ok' => true];
    }

    public function changePassword(Request $r)
    {
        $d = $r->validate([
            'current_password' => 'required|string|max:512',
            'password' => [...UserPassword::rules(), 'confirmed'],
        ]);
        DB::transaction(function () use ($r, $d) {
            $u = User::where('id', $r->user()->id)->where('is_admin', false)->lockForUpdate()->firstOrFail();
            if (!Hash::check($d['current_password'], $u->password)) {
                throw \Illuminate\Validation\ValidationException::withMessages(['current_password' => 'The current password is incorrect.']);
            }
            $u->password = $d['password'];
            $u->save();
            DB::table('api_tokens')->where('user_id', $u->id)->where('id', '!=', $r->attributes->get('token_id'))->delete();
            DB::table('sessions')->where('user_id', $u->id)->delete();
            Records::audit('account.password_changed', (string) $u->id, ['other_sessions_revoked' => true]);
        });
        return ['ok' => true];
    }
}
