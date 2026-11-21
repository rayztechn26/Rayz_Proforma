<?php

namespace App\Services;

use Illuminate\Http\Request;

final class AdminAuthentication
{
    public static function localTestEnabled(): bool
    {
        return app()->environment('local') && config('admin_auth.local_test_without_totp') === true;
    }

    public static function localTestRequest(Request $r): bool
    {
        return self::localTestEnabled() && in_array($r->ip(), ['127.0.0.1', '::1'], true);
    }
}
