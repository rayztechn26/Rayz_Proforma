<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class HttpsOnly
{
    public function handle(Request $r, Closure $next)
    {
        if (app()->isProduction()) {
            abort_unless($r->isSecure(), 403, 'HTTPS required.');
        }$response = $next($r);
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'same-origin');
        $response->headers->set('X-Frame-Options', 'DENY');
        if (app()->isProduction()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000');
        }

        return $response;
    }
}
