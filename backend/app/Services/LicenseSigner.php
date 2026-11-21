<?php

namespace App\Services;

use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Log;

final class LicenseSigner
{
    public function issue(object $company, object $device): string
    {
        $path = config('licensing.private_key_path');
        $pem = is_string($path) && @is_file($path) && @is_readable($path) ? @file_get_contents($path) : false;
        $private = $pem ? @openssl_pkey_get_private($pem) : false;
        $details = $private ? openssl_pkey_get_details($private) : false;
        if (! config('licensing.key_id') || ! $details || $details['type'] !== OPENSSL_KEYTYPE_RSA || $details['bits'] < 2048) {
            Log::error('Licence signing unavailable.', ['reason' => 'missing_unreadable_or_invalid_RSA_signing_configuration']);
            abort(503, 'Licence signing is temporarily unavailable. Your approved payment is preserved. Retry or contact support.');
        }

        return JWT::encode(['iss' => config('app.url'), 'sub' => (string) $company->user_id, 'jti' => $device->license_id, 'company_id' => $company->id, 'company_name' => $company->name, 'company_tin' => $company->tin, 'device_fp' => $device->fingerprint, 'iat' => time(), 'format' => 1, 'kid' => config('licensing.key_id'), 'features' => ['proforma', 'backup', 'pdf']], $pem, 'RS256', config('licensing.key_id'));
    }
}
