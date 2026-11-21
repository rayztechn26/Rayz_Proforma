<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

final class Records
{
    public static function audit(string $action, string $subject, array $details = []): void
    {
        DB::table('audit_events')->insert(['actor_id' => auth()->id(), 'action' => $action, 'subject' => $subject, 'details' => json_encode($details, JSON_THROW_ON_ERROR), 'created_at' => now(), 'updated_at' => now()]);
    }

    public static function phone(string $v): string
    {
        $v = preg_replace('/[\s()\-]/', '', $v);
        if (str_starts_with($v, '00')) {
            $v = '+'.substr($v, 2);
        }abort_unless(preg_match('/^\+[1-9][0-9]{7,14}$/D', $v), 422, 'Use a phone number with + country code.');

        return $v;
    }

    public static function reference(string $v): string
    {
        $v = mb_strtoupper(trim($v));
        abort_unless(mb_strlen($v) >= 1 && mb_strlen($v) <= 120 && ! preg_match('/[\x00-\x1f\x7f]/u', $v), 422, 'Invalid reference.');

        return $v;
    }

    public static function cents(string $v): int
    {
        abort_unless(preg_match('/^\d{1,9}(\.\d{1,2})?$/D', $v), 422, 'Enter an ETB amount with at most two decimals.');
        [$a,$b] = array_pad(explode('.', $v), 2, '');

        return ((int) $a) * 100 + (int) str_pad($b, 2, '0');
    }

    public static function settings(): array
    {
        $r = DB::table('payment_settings')->first();
        $s = $r ? json_decode($r->value, true) : [];
        $complete = isset($s['fee']) && self::cents((string) $s['fee']) > 0;
        foreach (['merchant', 'recipient', 'instructions', 'support', 'waiting'] as $k) {
            $complete = $complete && ! empty($s[$k]);
        }

        return $s + ['enabled' => $complete, 'currency' => 'ETB'];
    }

    public static function owned(string $table, string $id): object
    {
        $r = DB::table($table)->where('id', $id)->where('user_id', auth()->id())->first();
        abort_unless($r, 404);

        return $r;
    }
}
