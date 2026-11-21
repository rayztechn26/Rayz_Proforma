<?php

namespace App\Http\Controllers;

use App\Services\DeviceProof;
use App\Services\LicenseSigner;
use App\Services\Records;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class LicenseController extends Controller
{
    public function challenge(Request $r)
    {
        $d = $r->validate(['public_key' => 'required|string|max:5000']);
        $k = openssl_pkey_get_public($d['public_key']);
        abort_unless($k, 422, 'Invalid public key.');
        $details = openssl_pkey_get_details($k);
        abort_unless($details['type'] === OPENSSL_KEYTYPE_RSA && $details['bits'] >= 2048, 422, 'RSA key of at least 2048 bits required.');
        $pem = $details['key'];
        $der = base64_decode(preg_replace('/-----[^-]+-----|\s/', '', $pem));
        $id = (string) Str::uuid();
        $nonce = bin2hex(random_bytes(32));
        DB::table('challenges')->insert(['id' => $id, 'user_id' => auth()->id(), 'nonce' => $nonce, 'public_key' => $pem, 'fingerprint' => hash('sha256', $der), 'expires_at' => now()->addMinutes(5), 'created_at' => now(), 'updated_at' => now()]);

        return ['id' => $id, 'nonce' => $nonce];
    }

    public function company(Request $r, DeviceProof $proof, LicenseSigner $signer)
    {
        $d = $r->validate(['entitlement_id' => 'required|uuid', 'challenge_id' => 'required|uuid', 'signature' => 'required|string|max:2000', 'profile' => 'required|array', 'profile.id' => 'required|string|max:100|regex:/^[A-Za-z0-9_-]+$/', 'profile.name' => 'required|string|max:255', 'profile.tin' => 'required|string|max:255', 'profile.vat' => 'required|numeric|gt:0', 'profile.vatConfirmed' => 'required|accepted', 'profile.logo' => 'required|string|max:14000000']);
        $d['profile'] = $r->input('profile');

        try {
            return DB::transaction(function () use ($d, $proof, $signer) {
                $e = DB::table('entitlements')->where('id', $d['entitlement_id'])->where('user_id', auth()->id())->lockForUpdate()->first();
                abort_unless($e, 403, 'Approved entitlement required.');
                $existing = DB::table('licensed_companies')->where('entitlement_id', $e->id)->first();
                $c = $proof->consume($d['challenge_id'], $d['signature']);
                if ($existing) {
                    abort_unless($existing->id === $d['profile']['id'], 409, 'Entitlement already assigned.');
                    $device = DB::table('devices')->where('company_id', $existing->id)->first();
                    abort_unless($device && $device->fingerprint === $c->fingerprint, 403, 'Request administrator-approved device transfer.');

                    abort_unless($existing->name === trim($d['profile']['name']) && $existing->tin === trim($d['profile']['tin']), 409, 'Company already registered with a different legal identity. Recover the approved profile.');

                    return ['license' => $signer->issue($existing, $device), 'profile' => json_decode($existing->profile, true)];
                }
                abort_if(DB::table('licensed_companies')->where('id', $d['profile']['id'])->exists(), 409, 'Company ID already assigned.');
                $profile = $this->profile($d['profile']);
                $id = $profile['id'];
                DB::table('licensed_companies')->insert(['id' => $id, 'user_id' => auth()->id(), 'entitlement_id' => $e->id, 'name' => $profile['name'], 'tin' => $profile['tin'], 'profile' => json_encode($profile), 'created_at' => now(), 'updated_at' => now()]);
                $deviceId = (string) Str::uuid();
                DB::table('devices')->insert(['id' => $deviceId, 'company_id' => $id, 'public_key' => $c->public_key, 'fingerprint' => $c->fingerprint, 'license_id' => (string) Str::uuid(), 'created_at' => now(), 'updated_at' => now()]);
                Records::audit('company.activated', $id);

                return ['license' => $signer->issue(DB::table('licensed_companies')->where('id', $id)->first(), DB::table('devices')->where('id', $deviceId)->first()), 'profile' => $profile];
            }, 3);
        } catch (UniqueConstraintViolationException $e) {
            abort(409, 'Company registration conflicts with an existing company. Refresh status or recover its licence.');
        }
    }

    private function profile(array $p): array
    {
        $clean = [];
        foreach (['id', 'name', 'tin', 'vatNumber', 'address', 'phone', 'email', 'website', 'bankName', 'accountName', 'accountNumber', 'currency', 'vat', 'paymentTerms', 'deliveryTerms', 'prefix', 'logo'] as $key) {
            $value = $p[$key] ?? '';
            abort_unless(is_string($value) && mb_strlen($value) <= ($key === 'logo' ? 14000000 : 20000), 422, 'Invalid company field.');
            $clean[$key] = $value;
        }
        $clean['validity'] = $p['validity'] ?? 30;
        abort_unless(is_int($clean['validity']) && $clean['validity'] >= 1 && $clean['validity'] <= 3650, 422, 'Invalid validity period.');
        abort_unless(is_numeric($clean['vat']) && $clean['vat'] > 0 && $clean['vat'] <= 1000000000000 && ($p['vatConfirmed'] ?? false) === true, 422, 'Confirm positive VAT.');
        $clean['vatConfirmed'] = true;
        $p = $clean;
        foreach (['id', 'name', 'tin', 'currency', 'prefix', 'logo'] as $key) {
            abort_unless(isset($p[$key]) && is_string($p[$key]) && trim($p[$key]) !== '', 422, 'Incomplete company profile.');
        }abort_unless(preg_match('#^data:image/(png|jpeg);base64,(.+)$#s', $p['logo'], $m), 422, 'PNG/JPEG logo required.');
        $image = base64_decode($m[2], true);
        abort_unless($image && strlen($image) <= 10 * 1024 * 1024 && ($info = @getimagesizefromstring($image)) && in_array($info['mime'], ['image/png', 'image/jpeg']), 422, 'Invalid logo.');

        return $p;
    }

    public function update(Request $r, string $id)
    {
        $c = Records::owned('licensed_companies', $id);
        $p = $this->profile($r->validate(['profile' => 'required|array'])['profile']);
        abort_unless($p['id'] === $id && $p['name'] === $c->name && $p['tin'] === $c->tin, 422, 'Legal name/TIN changes require administrator review.');
        abort_unless(isset($p['vat']) && is_numeric($p['vat']) && $p['vat'] > 0 && ! empty($p['vatConfirmed']), 422, 'Confirm positive VAT.');
        DB::table('licensed_companies')->where('id', $id)->update(['profile' => json_encode($p), 'updated_at' => now()]);

        return ['ok' => true];
    }

    public function recover(Request $r, string $id, DeviceProof $proof, LicenseSigner $signer)
    {
        $c = Records::owned('licensed_companies', $id);
        $d = $r->validate(['challenge_id' => 'required|uuid', 'signature' => 'required|string|max:2000', 'transfer_id' => 'nullable|uuid']);

        return DB::transaction(function () use ($c, $d, $proof, $signer) {
            $company = DB::table('licensed_companies')->where('id', $c->id)->lockForUpdate()->first();
            $p = $proof->consume($d['challenge_id'], $d['signature']);
            $device = DB::table('devices')->where('company_id', $c->id)->lockForUpdate()->first();
            if ($device->fingerprint !== $p->fingerprint) {
                $t = DB::table('change_requests')->where('id', $d['transfer_id'] ?? '')->where('company_id', $c->id)->where('kind', 'transfer')->lockForUpdate()->first();
                abort_unless($t && $t->status === 'approved' && json_decode($t->details, true)['fingerprint'] === $p->fingerprint, 403, 'Administrator-approved transfer for this device required.');
                DB::table('device_revocations')->insert(['license_id' => $device->license_id, 'company_id' => $c->id, 'fingerprint' => $device->fingerprint, 'public_key' => $device->public_key, 'transfer_id' => $t->id, 'reviewer_id' => $t->reviewer_id, 'revoked_at' => now()]);
                Records::audit('device.transferred', $c->id, ['old_fingerprint' => $device->fingerprint, 'new_fingerprint' => $p->fingerprint, 'approval' => $t->id]);
                DB::table('devices')->where('id', $device->id)->update(['public_key' => $p->public_key, 'fingerprint' => $p->fingerprint, 'license_id' => (string) Str::uuid(), 'updated_at' => now()]);
                DB::table('change_requests')->where('id', $t->id)->update(['status' => 'consumed']);
                $device = DB::table('devices')->where('id', $device->id)->first();
            }

            return ['license' => $signer->issue($company, $device), 'profile' => json_decode($company->profile, true)];
        }, 3);
    }

    public function change(Request $r, string $id, DeviceProof $proof)
    {
        Records::owned('licensed_companies', $id);
        $d = $r->validate(['kind' => 'required|in:transfer,identity', 'reason' => 'required|string|min:10|max:2000', 'name' => 'required_if:kind,identity|string|max:255', 'tin' => 'required_if:kind,identity|string|max:255', 'challenge_id' => 'required_if:kind,transfer|uuid', 'signature' => 'required_if:kind,transfer|string|max:2000']);

        return DB::transaction(function () use ($id, $d, $proof) {
            $details = $d['kind'] === 'transfer' ? ['fingerprint' => $proof->consume($d['challenge_id'], $d['signature'])->fingerprint] : ['name' => $d['name'], 'tin' => $d['tin']];
            $rid = (string) Str::uuid();
            DB::table('change_requests')->insert(['id' => $rid, 'user_id' => auth()->id(), 'company_id' => $id, 'kind' => $d['kind'], 'details' => json_encode($details), 'reason' => $d['reason'], 'created_at' => now(), 'updated_at' => now()]);
            Records::audit('company.change_requested', $rid);

            return ['id' => $rid];
        });
    }
}
