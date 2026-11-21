<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

final class DeviceProof
{
    public function consume(string $id, string $signature): object
    {
        $c = DB::table('challenges')->where('id', $id)->where('user_id', auth()->id())->lockForUpdate()->first();
        abort_unless($c && ! $c->used_at && now()->lt($c->expires_at), 422, 'Challenge expired or already used.');
        $sig = base64_decode($signature, true);
        abort_unless($sig !== false && openssl_verify($c->nonce, $sig, $c->public_key, OPENSSL_ALGO_SHA256) === 1, 422, 'Device proof failed.');
        DB::table('challenges')->where('id', $id)->update(['used_at' => now()]);

        return $c;
    }
}
