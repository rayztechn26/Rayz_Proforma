<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class AdminLocale
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->is('admin', 'admin/*')) {
            $locale = $request->session()->get('admin_locale', 'en');
            app()->setLocale(in_array($locale, ['en', 'am'], true) ? $locale : 'en');
        }

        return $next($request);
    }
}
