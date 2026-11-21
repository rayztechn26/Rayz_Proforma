<?php

namespace App\Http\Controllers;

use App\Jobs\PaymentPush;
use App\Services\Records;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PaymentController extends Controller
{
    public function index()
    {
        return ['phone' => auth()->user()->phone, 'settings' => Records::settings(), 'payments' => DB::table('payments')->where('user_id', auth()->id())->orderByDesc('created_at')->get()->map(function ($p) {
            unset($p->receipt,$p->admin_notes);

            return $p;
        }), 'entitlements' => DB::table('entitlements')->where('user_id', auth()->id())->whereNotIn('id', DB::table('licensed_companies')->select('entitlement_id'))->get(), 'companies' => DB::table('licensed_companies')->where('user_id', auth()->id())->get(), 'changes' => DB::table('change_requests')->where('user_id', auth()->id())->get()];
    }

    public function submit(Request $r)
    {
        $d = $r->validate(['idempotency' => 'required|uuid', 'payer_phone' => 'required|string|max:40', 'reference' => 'required|string|max:120', 'note' => 'nullable|string|max:2000', 'previous_id' => 'nullable|uuid', 'receipt' => 'nullable|file|image|mimes:jpeg,png|mimetypes:image/jpeg,image/png|max:5120']);
        if ($p = DB::table('payments')->where('user_id', auth()->id())->where('idempotency', $d['idempotency'])->first()) {
            unset($p->receipt,$p->admin_notes);

            return $p;
        }
        $s = Records::settings();
        abort_unless($s['enabled'], 409, 'Payment instructions are not yet configured. Contact support.');
        $ref = Records::reference($d['reference']);
        $phone = Records::phone($d['payer_phone']);
        if (! empty($d['previous_id'])) {
            $old = Records::owned('payments', $d['previous_id']);
            abort_unless($old->status === 'rejected', 409, 'Only rejected submissions can be corrected.');
        }
        if ($file = $r->file('receipt')) {
            $bytes = file_get_contents($file->getRealPath());
            $info = @getimagesizefromstring($bytes);
            abort_unless(strlen($bytes) <= 5 * 1024 * 1024 && $info && in_array($info['mime'], ['image/png', 'image/jpeg']), 422, 'Receipt must contain an actual JPG or PNG image, at most 5 MB.');
        }
        $path = $r->file('receipt')?->store('receipts', 'local');
        try {
            $p = DB::transaction(function () use ($d, $s, $ref, $phone, $path) {
                $existing = DB::table('payments')->where('user_id', auth()->id())->where('idempotency', $d['idempotency'])->lockForUpdate()->first();
                if ($existing) {
                    return $existing;
                }
                abort_if(DB::table('payments')->where('active_reference', $ref)->orWhere('verified_reference', $ref)->exists(), 409, 'Reference already claimed. Contact support for a disputed claim.');
                $id = (string) Str::uuid();
                DB::table('payments')->insert(['id' => $id, 'user_id' => auth()->id(), 'idempotency' => $d['idempotency'], 'previous_id' => $d['previous_id'] ?? null, 'payer_phone' => $phone, 'reference' => $ref, 'active_reference' => $ref, 'expected_cents' => Records::cents($s['fee']), 'instructions' => json_encode($s), 'receipt' => $path, 'note' => $d['note'] ?? null, 'created_at' => now(), 'updated_at' => now()]);
                DB::table('admin_notices')->insert(['payment_id' => $id, 'created_at' => now(), 'updated_at' => now()]);

                return DB::table('payments')->where('id', $id)->first();
            }, 3);
        } catch (\Throwable $e) {
            if ($path) {
                \Storage::disk('local')->delete($path);
            }if ($e instanceof QueryException) {
                $p = DB::table('payments')->where('user_id', auth()->id())->where('idempotency', $d['idempotency'])->first();
                if ($p) {
                    unset($p->receipt,$p->admin_notes);

                    return $p;
                }abort(409, 'Reference already claimed. Contact support.');
            }throw $e;
        }
        // Persistent notice is committed first. Push/queue failure cannot fail submission.
        if ($path && $p->receipt !== $path) {
            \Storage::disk('local')->delete($path);
        }
        try {
            PaymentPush::dispatch();
        } catch (\Throwable) {
            \Log::warning('Admin push enqueue failed; use notification centre.');
        }
        unset($p->receipt,$p->admin_notes);

        return response()->json($p, 201);
    }
}
