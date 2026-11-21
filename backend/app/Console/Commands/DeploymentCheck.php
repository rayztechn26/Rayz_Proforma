<?php

namespace App\Console\Commands;

use App\Services\Records;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class DeploymentCheck extends Command
{
    protected $signature = 'deployment:check';

    protected $description = 'Check production readiness without displaying credentials or modifying records';

    public function handle(): int
    {
        $failed = false;
        $check = function (string $name, bool $ok) use (&$failed) {
            $this->line(($ok ? 'PASS ' : 'FAIL ').$name);
            if (! $ok) {
                $failed = true;
            }
        };
        $check('PHP 8.2 or newer', version_compare(PHP_VERSION, '8.2.0', '>='));
        foreach (['openssl', 'pdo_mysql', 'mbstring', 'fileinfo', 'gd'] as $extension) {
            $check('Extension '.$extension, extension_loaded($extension));
        }
        $check('Production environment', app()->isProduction());
        $check('Debug disabled', ! config('app.debug'));
        $check('Local test login disabled', ! config('admin_auth.local_test_without_totp'));
        $check('HTTPS application URL', str_starts_with(config('app.url'), 'https://'));
        $key = config('app.key', '');
        $raw = str_starts_with($key, 'base64:') ? base64_decode(substr($key, 7), true) : $key;
        $check('Application encryption key configured', is_string($raw) && strlen($raw) === 32);
        $check('Secure encrypted session cookies', config('session.secure') === true && config('session.encrypt') === true && config('session.http_only') === true);
        foreach (['storage/app/private', 'storage/framework/cache/data', 'storage/framework/sessions', 'storage/framework/views', 'storage/logs', 'bootstrap/cache'] as $folder) {
            $check('Writable '.$folder, is_dir(base_path($folder)) && is_writable(base_path($folder)));
        }
        try {
            $check('MySQL connection', DB::getDriverName() === 'mysql');
            $name = DB::connection()->getDatabaseName();
            $engines = DB::select('SELECT ENGINE FROM information_schema.tables WHERE table_schema=? AND TABLE_TYPE=?', [$name, 'BASE TABLE']);
            $check('All tables use InnoDB', count($engines) >= 22 && collect($engines)->every(fn ($r) => strcasecmp($r->ENGINE, 'InnoDB') === 0));
            $check('Database migrations imported', DB::table('migrations')->count() === count(glob(database_path('migrations/*.php'))));
            $check('Production administrator enrolled', DB::table('users')->where('is_admin', true)->whereNotNull('totp_secret')->exists());
            $check('Real payment instructions configured', Records::settings()['enabled']);
        } catch (\Throwable) {
            $check('Database connection/schema ready', false);
        }
        try {
            $path = config('licensing.private_key_path');
            $private = $path && is_file($path) ? openssl_pkey_get_private(file_get_contents($path)) : false;
            $check('Private signing key configured', $private !== false);
            $kid = config('licensing.key_id');
            $keys = json_decode(file_get_contents(base_path('deployment/mobile-public-keys.json')), true, flags: JSON_THROW_ON_ERROR);
            $public = $private ? openssl_pkey_get_details($private)['key'] : '';
            $check('Signing key matches Android verification key', $kid && isset($keys[$kid]) && trim($keys[$kid]) === trim($public));
        } catch (\Throwable) {
            $check('Licence signing configuration ready',false);
        }
        $this->line('HTTPS reachability, actual phone activation, cron execution and push delivery require separate live checks.');

        return $failed ? 1 : 0;
    }
}
