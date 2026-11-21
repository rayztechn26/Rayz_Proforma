<?php

namespace App\Http\Middleware;

use App\Services\AdminAuthentication;
use Closure;
use Illuminate\Http\Request;

class AdminOnly
{
    public function handle(Request $r, Closure $next)
    {
        $secondFactor = $r->session()->get('admin_2fa') === auth()->id();
        $localTest = AdminAuthentication::localTestRequest($r) && $r->session()->get('admin_local_test') === auth()->id();
        if (! auth()->check() || ! auth()->user()->is_admin || (! $secondFactor && ! $localTest)) {
            return redirect()->guest('/admin/login');
        }if (app()->isProduction()) {
            abort_unless($r->isSecure(), 403, 'HTTPS required.');
        }

        return $next($r);
    }
}
