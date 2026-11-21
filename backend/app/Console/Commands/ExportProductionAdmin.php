<?php

namespace App\Console\Commands;

use App\Services\Records;
use App\Services\StrongPassword;
use Dotenv\Dotenv;
use Illuminate\Console\Command;
use Illuminate\Encryption\Encrypter;
use Illuminate\Support\Facades\Validator;
use PragmaRX\Google2FA\Google2FA;

class ExportProductionAdmin extends Command
{
    protected $signature = 'admin:export-production {environment : Private production env file} {output : Private SQL output path} {--phone=}';

    protected $description = 'Locally enroll a production administrator and export SQL without touching a database';

    public function handle(Google2FA $g): int
    {
        $file = realpath($this->argument('environment'));
        if (! $file || ! is_file($file)) {
            $this->error('Production environment file not found.');

            return 1;
        }
        $output = $this->argument('output');
        $parent = realpath(dirname($output));
        $project = realpath(is_file(base_path('../mobile/package.json')) ? base_path('..') : base_path());
        foreach ([$file, $parent] as $path) {
            if (! $path || $path === $project || str_starts_with(strtolower($path), strtolower($project.DIRECTORY_SEPARATOR))) {
                $this->error('Keep production environment and administrator SQL outside the source project and web root.');

                return 1;
            }
        }
        if (file_exists($output)) {
            $this->error('SQL output already exists. It was not overwritten.');

            return 1;
        }
        $env = Dotenv::parse(file_get_contents($file));
        if (($env['APP_ENV'] ?? '') !== 'production' || filter_var($env['ADMIN_LOCAL_TEST_WITHOUT_TOTP'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            $this->error('Use a production environment with local test login disabled.');

            return 1;
        }
        $key = $env['APP_KEY'] ?? '';
        $key = str_starts_with($key, 'base64:') ? base64_decode(substr($key, 7), true) : $key;
        if (! is_string($key) || strlen($key) !== 32) {
            $this->error('The production APP_KEY must contain 32 bytes.');

            return 1;
        }
        $phone = Records::phone($this->option('phone') ?: $this->ask('Production administrator phone (+ country code)'));
        if (str_starts_with($phone, '+251') && ! preg_match('/^\+251\d{9}$/D', $phone)) {
            $this->error('Use +251 followed by 9 digits.');

            return 1;
        }
        $password = $this->secret('New production password (12+ characters, mixed-case letters and numbers)');
        Validator::make(['password' => $password], ['password' => StrongPassword::rules()])->validate();
        if ($password !== $this->secret('Confirm new production password')) {
            $this->error('Passwords do not match.');

            return 1;
        }
        $secret = $g->generateSecretKey();
        $this->warn('Enroll this time-based key in your authenticator locally. Do not record or share it.');
        $this->line('Account: Rayz Proforma Production '.$phone);
        $this->line('Setup key: '.$secret);
        if (! $g->verifyKey($secret, $this->secret('Current 6-digit authenticator code'), 1)) {
            $this->error('Authenticator enrollment failed. No SQL generated.');

            return 1;
        }
        $encrypted = (new Encrypter($key, 'AES-256-CBC'))->encryptString($secret);
        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
        $quote = fn (string $s) => "'".str_replace("'", "''", $s)."'";
        $values = array_map($quote, ['Production administrator', bin2hex(random_bytes(16)).'@admin.invalid', $hash, $phone, $encrypted]);
        $sql = "-- PRIVATE: import once into the fresh production database after schema import.\n-- Requires the exact APP_KEY from the matching private production env file.\nSTART TRANSACTION;\n";
        $sql .= 'INSERT INTO `users` (`name`,`email`,`password`,`phone`,`totp_secret`,`is_admin`,`created_at`,`updated_at`) VALUES ('.implode(',', $values).",1,NOW(),NOW());\n";
        $sql .= "INSERT INTO `audit_events` (`actor_id`,`action`,`subject`,`details`,`created_at`,`updated_at`) VALUES (LAST_INSERT_ID(),'admin.provisioned',CAST(LAST_INSERT_ID() AS CHAR),'{\"method\":\"offline production enrollment\"}',NOW(),NOW());\nCOMMIT;\n";
        file_put_contents($output, $sql, LOCK_EX);
        chmod($output, 0600);
        $this->info('Private administrator SQL created. No database was modified and no plaintext password was written.');

        return 0;
    }
}
