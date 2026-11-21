<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

final class ManualPaymentService implements PaymentService
{
    public function __construct(private EntitlementIssuer $issuer) {}

    public function approve(string $id, string $reference, int $received, string $notes): object
    {
        return DB::transaction(function () use ($id, $reference, $received, $notes) {
            $p = DB::table('payments')->where('id', $id)->lockForUpdate()->first();
            abort_unless($p, 404);
            if ($p->status === 'approved') {
                return $this->issuer->forPayment($p);
            }
            abort_unless($p->status === 'pending', 409, 'Only pending requests can be approved.');
            abort_unless($received >= $p->expected_cents, 422, 'Underpayment: received amount does not cover expected fee.');
            $reference = Records::reference($reference);
            abort_if(DB::table('payments')->where('id', '!=', $id)->where(fn ($q) => $q->where('active_reference', $reference)->orWhere('verified_reference', $reference))->exists(), 409, 'Reference already claimed; resolve dispute first.');
            DB::table('payments')->where('id', $id)->update(['status' => 'approved', 'active_reference' => $reference, 'verified_reference' => $reference, 'received_cents' => $received, 'admin_notes' => $notes, 'reviewer_id' => auth()->id(), 'reviewed_at' => now(), 'updated_at' => now()]);
            Records::audit('payment.approved', $id, ['received_cents' => $received]);

            return $this->issuer->forPayment($p);
        }, 3);
    }
}
