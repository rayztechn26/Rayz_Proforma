<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ApiToken
{
    public function handle(Request $r, Closure $next)
    {
        $token = $r->bearerToken();
        abort_unless($token, 401);
        $t = DB::table('api_tokens')->where('hash', hash('sha256', $token))->where('expires_at', '>', now())->first();
        abort_unless($t, 401);
        $user = User::findOrFail($t->user_id);
        abort_if($user->is_admin, 403);
        auth()->setUser($user);
        $r->setUserResolver(fn () => $user);
        $r->attributes->set('token_id', $t->id);

        return $next($r);
    }
}
