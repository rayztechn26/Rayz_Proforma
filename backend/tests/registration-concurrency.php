<?php

// Independent PHP processes against a disposable MySQL database only.
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

use App\Models\User;
use App\Services\EntitlementIssuer;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;

if (! app()->environment('testing') || DB::getDriverName() !== 'mysql' || ! str_ends_with(DB::connection()->getDatabaseName(), '_test')) {
    throw new RuntimeException('Requires APP_ENV=testing and disposable MySQL DB_DATABASE ending _test.');
}
if (($argv[1] ?? '') === 'worker') {
    $fixture = json_decode(file_get_contents($argv[2]), true);
    config(['licensing.private_key_path' => $argv[2], 'licensing.key_id' => 'concurrency']);
    // The fixture and signing PEM use separate files; neither is shipped.
    config(['licensing.private_key_path' => $fixture['pem']]);
    $kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
    $send = function ($path, $body) use ($kernel, $fixture) {
        $r = Request::create($path, 'POST', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_AUTHORIZATION' => 'Bearer '.$fixture['token']], json_encode($body));

        return $kernel->handle($r);
    };
    $key = openssl_pkey_get_private(file_get_contents($fixture['pem']));
    $challenge = $send('/api/challenges', ['public_key' => openssl_pkey_get_details($key)['key']]);
    if ($challenge->getStatusCode() !== 200) {
        throw new RuntimeException('Challenge failed');
    }
    $data = json_decode($challenge->getContent(), true);
    openssl_sign($data['nonce'], $signature, $key, OPENSSL_ALGO_SHA256);
    $profile = ['id' => $argv[3], 'name' => 'Concurrent Company', 'tin' => 'TEST', 'vat' => '15', 'vatConfirmed' => true, 'currency' => 'ETB', 'prefix' => 'PF', 'logo' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='];
    $result = $send('/api/companies', ['profile' => $profile, 'entitlement_id' => $argv[4], 'challenge_id' => $data['id'], 'signature' => base64_encode($signature)]);
    echo $result->getStatusCode();
    exit;
}
Artisan::call('migrate', ['--force' => true]);
$owner = User::factory()->create();
$token = bin2hex(random_bytes(32));
DB::table('api_tokens')->insert(['user_id' => $owner->id, 'hash' => hash('sha256', $token), 'expires_at' => now()->addDay(), 'created_at' => now(), 'updated_at' => now()]);
$key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
openssl_pkey_export($key, $pem);
$pemFile = tempnam(sys_get_temp_dir(), 'registration-key-');
$fixtureFile = tempnam(sys_get_temp_dir(), 'registration-fixture-');
file_put_contents($pemFile, $pem);
file_put_contents($fixtureFile, json_encode(['pem' => $pemFile, 'token' => $token]));
try {
    $run = function ($entitlement, $ids) use ($fixtureFile) {
        $workers = array_map(fn ($id) => new Process([PHP_BINARY, __FILE__, 'worker', $fixtureFile, $id, $entitlement], base_path()), $ids);
        foreach ($workers as $worker) {
            $worker->start();
        }
        $statuses = [];
        foreach ($workers as $worker) {
            $worker->wait();
            if ($worker->getExitCode() !== 0) {
                throw new RuntimeException('Registration worker failed: '.$worker->getErrorOutput());
            }
            $statuses[] = (int) trim($worker->getOutput());
        }
        sort($statuses);

        return $statuses;
    };
    $first = app(EntitlementIssuer::class)->grant($owner->id, null, 'Concurrency test only');
    $prefix = 'retry-'.bin2hex(random_bytes(6));
    if ($run($first->id, [$prefix, $prefix]) !== [200, 200]) {
        throw new RuntimeException('Same registration did not converge');
    }
    if (DB::table('licensed_companies')->where('entitlement_id', $first->id)->count() !== 1 || DB::table('devices')->where('company_id', $prefix)->count() !== 1) {
        throw new RuntimeException('Duplicate registration/device');
    }
    $device = DB::table('devices')->where('company_id', $prefix)->value('license_id');
    if ($run($first->id, [$prefix, $prefix]) !== [200, 200] || DB::table('devices')->where('company_id', $prefix)->value('license_id') !== $device) {
        throw new RuntimeException('Retry changed device identity');
    }
    $second = app(EntitlementIssuer::class)->grant($owner->id, null, 'Concurrency test only');
    if ($run($second->id, [$prefix.'-a', $prefix.'-b']) !== [200, 409]) {
        throw new RuntimeException('One entitlement registered different companies');
    }
    if (DB::table('licensed_companies')->where('entitlement_id', $second->id)->count() !== 1) {
        throw new RuntimeException('Entitlement assigned twice');
    }
    echo "PASS: concurrent registration and lost-response retries converge; one entitlement cannot register two companies.\n";
} finally {
    unlink($pemFile);
    unlink($fixtureFile);
}
