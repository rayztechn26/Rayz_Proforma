<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ApiRequestContext
{
    public function handle(Request $request, Closure $next)
    {
        if (! $request->is('api/*')) {
            return $next($request);
        }
        $id = (string) Str::uuid();
        $request->attributes->set('api_request_id', $id);
        // No request body, credentials, licence token, or query string in logs.
        Log::withContext(['request_id' => $id, 'method' => $request->method(), 'endpoint' => '/'.$request->path()]);
        $response = $next($request);
        $response->headers->set('X-Request-ID', $id);

        return $response;
    }
}
