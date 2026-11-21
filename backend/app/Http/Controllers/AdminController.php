<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AdminAuthentication;
use App\Services\EntitlementIssuer;
use App\Services\ManualPaymentService;
use App\Services\Records;
use App\Services\UserPassword;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use PragmaRX\Google2FA\Google2FA;

class AdminController extends Controller
{
    public function language(Request $request)
    {
        $data = $request->validate(['language' => 'required|in:en,am', 'return_to' => 'nullable|string|max:2000']);
        $request->session()->put('admin_locale', $data['language']);
        $path = $data['return_to'] ?? '/admin/login';
        if (! preg_match('#^/admin(?:[/?]|$)#', $path) || preg_match('/[\r\n]/', $path)) {
            $path = '/admin/login';
        }

        return redirect($path);
    }

    public function loginForm()
    {
        return view('admin.login', ['localTest' => AdminAuthentication::localTestRequest(request())]);
    }

    public function login(Request $r, Google2FA $totp)
    {
        $localTest = AdminAuthentication::localTestRequest($r);
        if (is_string($r->input('phone'))) {
            $phone = preg_replace('/[\s()\-]/', '', trim($r->input('phone')));
            if (preg_match('/^0?([79][0-9]{8})$/D', $phone, $match)) {
                $phone = '+251'.$match[1];
            } elseif (str_starts_with($phone, '00')) {
                $phone = '+'.substr($phone, 2);
            }
            $r->merge(['phone' => $phone]);
        }
        $d = $r->validate(['phone' => ['required', 'string', 'max:40', 'regex:/^\+[1-9][0-9]{7,14}$/D'], 'password' => 'required|string|max:512', 'code' => $localTest ? 'nullable' : 'required|digits:6'], ['phone.regex' => 'Enter your phone number with its country code.']);
        $u = User::where('phone', $d['phone'])->where('is_admin', true)->first();
        if (! $u || ! Hash::check($d['password'], $u->password)) {
            throw ValidationException::withMessages(['phone' => 'The phone number or password is incorrect.']);
        }
        if (! $localTest) {
            if (! $u->totp_secret) {
                throw ValidationException::withMessages(['code' => 'Authenticator enrollment is required.']);
            }
            $step = $totp->verifyKeyNewer($u->totp_secret, $d['code'], $u->totp_last_step ?? 0, 1);
            if ($step === false) {
                throw ValidationException::withMessages(['code' => 'Enter a fresh authenticator code. This code is invalid or already used.']);
            }
            $changed = User::where('id', $u->id)->where(fn ($q) => $q->whereNull('totp_last_step')->orWhere('totp_last_step', '<', $step))->update(['totp_last_step' => $step]);
            if (! $changed) {
                throw ValidationException::withMessages(['code' => 'This authenticator code was already used. Wait for a new code.']);
            }
        }
        Auth::login($u);
        $r->session()->regenerate();
        $r->session()->forget(['admin_2fa', 'admin_local_test']);
        $r->session()->put($localTest ? 'admin_local_test' : 'admin_2fa', $u->id);

        return redirect()->intended('/admin');
    }

    public function logout(Request $r)
    {
        Auth::logout();
        $r->session()->invalidate();
        $r->session()->regenerateToken();

        return redirect('/admin/login');
    }

    public function dashboard(Request $r)
    {
        if ($r->filled('from') && $r->filled('to')) {
            $r->validate(['from' => 'date_format:Y-m-d', 'to' => 'date_format:Y-m-d|after_or_equal:from']);
        }
        $q = DB::table('payments')->join('users', 'users.id', '=', 'payments.user_id')->select('payments.*', 'users.phone as account_phone');
        if ($r->filled('search')) {
            $s = '%'.addcslashes($r->string('search')->toString(), '%_\\').'%';
            $q->where(fn ($q) => $q->where('users.phone', 'like', $s)->orWhere('payer_phone', 'like', $s)->orWhere('reference', 'like', $s)->orWhere('payments.id', 'like', $s));
        }if (in_array($r->query('status'), ['pending', 'approved', 'rejected'])) {
            $q->where('status', $r->query('status'));
        }foreach (['from' => '>=', 'to' => '<='] as $key => $op) {
            if ($r->filled($key)) {
                $r->validate([$key => 'date_format:Y-m-d']);
                $q->whereDate('payments.created_at', $op, $r->query($key));
            }
        }

        return view('admin.dashboard', ['payments' => $q->orderByDesc('payments.created_at')->paginate(25)->withQueryString(), 'counts' => DB::table('payments')->selectRaw('status,count(*) as total')->groupBy('status')->pluck('total', 'status'), 'changes' => DB::table('change_requests')->where('status', 'pending')->get(), 'companies' => DB::table('licensed_companies')->leftJoin('devices', 'devices.company_id', '=', 'licensed_companies.id')->select('licensed_companies.*', 'devices.fingerprint', 'devices.license_id')->get(), 'audits' => DB::table('audit_events')->orderByDesc('id')->limit(100)->get()]);
    }

    public function detail(string $id)
    {
        $p = DB::table('payments')->where('id', $id)->first();
        abort_unless($p, 404);

        return view('admin.payment', ['p' => $p, 'user' => User::findOrFail($p->user_id), 'reviewer' => $p->reviewer_id ? User::find($p->reviewer_id) : null]);
    }

    public function receipt(string $id)
    {
        $p = DB::table('payments')->where('id', $id)->first();
        abort_unless($p && $p->receipt && Storage::disk('local')->exists($p->receipt), 404);

        return Storage::disk('local')->response($p->receipt, null, ['Cache-Control' => 'private, no-store', 'X-Content-Type-Options' => 'nosniff', 'Content-Security-Policy' => "default-src 'none'; sandbox"]);
    }

    public function approve(Request $r, string $id, ManualPaymentService $service)
    {
        $d = $r->validate(['confirmed' => 'required|accepted', 'verified_external' => 'required|accepted', 'verified_reference' => 'required|string|max:120', 'received' => ['required', 'string', 'regex:/^\d{1,9}(\.\d{1,2})?$/D'], 'notes' => 'nullable|string|max:2000']);
        try {
            $service->approve($id, $d['verified_reference'], Records::cents($d['received']), $d['notes'] ?? '');
        } catch (QueryException) {
            abort(409, 'A different review claimed this reference. Reload and resolve the dispute.');
        }

        return back()->with('message', 'Approved. One company registration is now available.');
    }

    public function reject(Request $r, string $id)
    {
        return $this->rejectClaim($r, $id, false);
    }

    public function dispute(Request $r, string $id)
    {
        return $this->rejectClaim($r, $id, true);
    }

    private function rejectClaim(Request $r, string $id, bool $dispute)
    {
        $d = $r->validate(['confirmed' => 'required|accepted', 'reason' => 'required|string|min:10|max:2000']);
        DB::transaction(function () use ($id, $d, $dispute) {
            $p = DB::table('payments')->where('id', $id)->lockForUpdate()->first();
            abort_unless($p && $p->status === 'pending', 409, 'Only pending claims can be rejected or released.');
            DB::table('payments')->where('id', $id)->update(['status' => 'rejected', 'active_reference' => null, 'reason' => $d['reason'], 'reviewer_id' => auth()->id(), 'reviewed_at' => now(), 'updated_at' => now()]);
            Records::audit($dispute ? 'payment.disputed_reference_released' : 'payment.rejected', $id, ['reason' => $d['reason']]);
        });

        return back()->with('message', 'Pending claim rejected and released. User may submit a correction.');
    }

    public function settings()
    {
        return view('admin.settings', ['settings' => Records::settings()]);
    }

    public function saveSettings(Request $r)
    {
        $d = $r->validate(['fee' => ['required', 'string', 'regex:/^\d{1,9}(\.\d{1,2})?$/D'], 'merchant' => 'required|string|max:255', 'recipient' => 'required|string|max:120', 'instructions' => 'required|string|max:4000', 'support' => 'required|string|max:255', 'waiting' => 'required|string|max:255']);
        if (Records::cents($d['fee']) <= 0) {
            throw ValidationException::withMessages(['fee' => 'Enter a positive ETB amount with at most two decimals (for example, 1000.00).']);
        }
        DB::transaction(function () use ($d) {
            DB::table('payment_settings')->updateOrInsert(['id' => 1], ['value' => json_encode($d), 'created_at' => now(), 'updated_at' => now()]);
            Records::audit('settings.updated', 'payment_settings');
        });

        return back()->with('message', 'Settings saved. Pending requests keep their original fee.');
    }

    public function grant(Request $r, EntitlementIssuer $issuer)
    {
        $d = $r->validate(['phone' => 'required|string|max:40', 'reason' => 'required|string|min:10|max:2000', 'confirmed' => 'required|accepted']);
        $u = User::where('phone', Records::phone($d['phone']))->where('is_admin', false)->firstOrFail();
        DB::transaction(function () use ($u, $d, $issuer) {
            $e = $issuer->grant($u->id, null, $d['reason']);
            Records::audit('entitlement.complimentary_grant', $e->id, ['reason' => $d['reason'], 'user_id' => $u->id]);
        });

        return back()->with('message', 'Complimentary entitlement granted without a payment record.');
    }

    public function change(Request $r, string $id)
    {
        $d = $r->validate(['decision' => 'required|in:approved,rejected', 'reason' => 'required|string|min:10|max:2000', 'confirmed' => 'required|accepted']);
        DB::transaction(function () use ($id, $d) {
            $c = DB::table('change_requests')->where('id', $id)->lockForUpdate()->first();
            abort_unless($c && $c->status === 'pending', 409, 'Request already reviewed.');
            $company = DB::table('licensed_companies')->where('id', $c->company_id)->lockForUpdate()->first();
            if ($d['decision'] === 'approved' && $c->kind === 'identity') {
                $p = json_decode($company->profile, true);
                $identity = json_decode($c->details, true);
                $p['name'] = $identity['name'];
                $p['tin'] = $identity['tin'];
                DB::table('licensed_companies')->where('id', $company->id)->update(['name' => $p['name'], 'tin' => $p['tin'], 'profile' => json_encode($p), 'updated_at' => now()]);
            }DB::table('change_requests')->where('id', $id)->update(['status' => $d['decision'], 'reason' => $c->reason."\nAdmin: ".$d['reason'], 'reviewer_id' => auth()->id(), 'reviewed_at' => now(), 'updated_at' => now()]);
            Records::audit('company.'.$c->kind.'.'.$d['decision'], $id, ['reason' => $d['reason']]);
        });

        return back()->with('message', 'Change reviewed. Transfer requires proof from the approved new device.');
    }

    public function recoverAccount(Request $r)
    {
        $d = $r->validate(['phone' => 'required|string|max:40', 'identity_checks' => 'required|string|min:20|max:2000', 'password' => UserPassword::rules(), 'confirmed' => 'required|accepted']);
        $u = User::where('phone', Records::phone($d['phone']))->where('is_admin', false)->firstOrFail();
        DB::transaction(function () use ($u, $d) {
            $u->password = $d['password'];
            $u->save();
            DB::table('api_tokens')->where('user_id', $u->id)->delete();
            DB::table('sessions')->where('user_id', $u->id)->delete();
            Records::audit('account.recovered', (string) $u->id, ['identity_checks' => $d['identity_checks'], 'sessions_revoked' => true]);
        });

        return back()->with('message', 'Password reset and all sessions revoked. Deliver password privately.');
    }

    public function notifications()
    {
        return ['unread' => DB::table('admin_notices')->whereNotIn('id', DB::table('notice_reads')->where('user_id', auth()->id())->select('notice_id'))->count(), 'notices' => DB::table('admin_notices')->orderByDesc('id')->limit(30)->get(['id', 'payment_id', 'created_at']), 'push_key' => config('licensing.push_public')];
    }

    public function read(string $id)
    {
        abort_unless(DB::table('admin_notices')->where('id', $id)->exists(), 404);
        DB::table('notice_reads')->insertOrIgnore(['user_id' => auth()->id(), 'notice_id' => $id]);

        return ['ok' => true];
    }

    public function subscribe(Request $r)
    {
        $d = $r->validate(['endpoint' => 'required|url:https|max:3000', 'keys.auth' => 'required|string|max:255', 'keys.p256dh' => 'required|string|max:255']);
        $host = parse_url($d['endpoint'], PHP_URL_HOST);
        abort_unless(in_array($host, ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com']) || str_ends_with($host, '.notify.windows.com'), 422, 'Unsupported push service.');
        DB::table('push_subscriptions')->updateOrInsert(['endpoint_hash' => hash('sha256', $d['endpoint'])], ['user_id' => auth()->id(), 'subscription' => encrypt(json_encode($d)), 'created_at' => now(), 'updated_at' => now()]);

        return ['ok' => true];
    }
}
