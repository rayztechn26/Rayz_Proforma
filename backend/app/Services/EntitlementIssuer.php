<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class EntitlementIssuer
{
    // Both a future verified gateway adapter and manual review use this transaction.
    public function forPayment(object $payment): object
    {
        return DB::transaction(function()use($payment){
            $p=DB::table('payments')->where('id',$payment->id)->lockForUpdate()->first();
            abort_unless($p&&$p->status==='approved'&&$p->verified_reference&&$p->received_cents>=$p->expected_cents,409,'Verified approval is required before issuing an entitlement.');
            return DB::table('entitlements')->where('payment_id',$p->id)->first()??$this->grant($p->user_id,$p->id,null);
        },3);
    }

    public function grant(int $user, ?string $payment, ?string $reason): object
    {
        $id = (string) Str::uuid();
        DB::table('entitlements')->insert(['id' => $id, 'user_id' => $user, 'payment_id' => $payment, 'grant_reason' => $reason, 'created_at' => now(), 'updated_at' => now()]);

        return DB::table('entitlements')->where('id', $id)->first();
    }
}
