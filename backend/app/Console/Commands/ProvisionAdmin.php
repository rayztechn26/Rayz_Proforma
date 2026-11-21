<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\AdminAuthentication;
use App\Services\Records;
use App\Services\StrongPassword;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use PragmaRX\Google2FA\Google2FA;

class ProvisionAdmin extends Command
{
    protected $signature = 'admin:provision {phone?}';

    protected $description = 'Interactively provision an administrator with mandatory TOTP; no public signup';

    public function handle(Google2FA $g): int
    {
        $phone = Records::phone($this->argument('phone') ?: $this->ask('Administrator phone (+ country code)'));
        if (str_starts_with($phone, '+251') && ! preg_match('/^\+251[0-9]{9}$/D', $phone)) {
            $this->error('Enter the complete Ethiopian phone number: +251 followed by 9 digits.');

            return 1;
        }
        if (User::where('phone', $phone)->exists()) {
            $this->error('Account already exists.');

            return 1;
        }$password = $this->secret('Password (12+ characters, mixed-case letters and numbers)');
        Validator::make(['password' => $password], ['password' => StrongPassword::rules()])->validate();
        $secret = null;
        if (! AdminAuthentication::localTestEnabled()) {
            $secret = $g->generateSecretKey();
            $this->warn('This secret is shown once for local authenticator enrollment. Do not record terminal output.');
            $this->line('In your authenticator app, add a time-based account with this setup key:');
            $this->line($secret);
            $this->line('Account label: Rayz Proforma Admin '.$phone);
            $this->line($g->getQRCodeUrl('Rayz Proforma Admin', $phone, $secret));
            $code = $this->secret('Enter the current 6-digit authenticator code');
            if (! $g->verifyKey($secret, $code, 1)) {
                $this->error('Authenticator enrollment failed. No account created.');

                return 1;
            }
        }
        $u = User::create(['name' => 'Administrator', 'phone' => $phone, 'email' => bin2hex(random_bytes(16)).'@admin.invalid', 'password' => $password]);
        $u->is_admin = true;
        $u->totp_secret = $secret;
        $u->save();
        Records::audit('admin.provisioned', (string) $u->id);
        $this->info($secret ? 'Administrator created. Password and authenticator code are required at every login.' : 'Local test administrator created. Local sign-in requires phone and password. Production requires authenticator enrollment.');

        return 0;
    }
}
