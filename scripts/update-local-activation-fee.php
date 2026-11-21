<?php
// Local WAMP only. Preserve all payment snapshots and existing entitlements.
require 'C:/wamp64/www/backend/vendor/autoload.php';
$app = require 'C:/wamp64/www/backend/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
use App\Services\Records;

$connection = config('database.default');
if (!in_array(config("database.connections.$connection.host"), ['127.0.0.1', 'localhost', '::1'], true)) {
    throw new RuntimeException('This operation is restricted to the local WAMP database.');
}
$paymentsBefore = hash('sha256', DB::table('payments')->orderBy('id')->get()->toJson());
$entitlementsBefore = hash('sha256', DB::table('entitlements')->orderBy('id')->get()->toJson());
$backupDir = 'D:/Projects/ProformaApp-backups/payment-fee-3000-2026-10-27';
if (!is_dir($backupDir)) mkdir($backupDir, 0700, true);
DB::transaction(function () use ($backupDir) {
    $row = DB::table('payment_settings')->where('id', 1)->lockForUpdate()->first();
    if (!$row) throw new RuntimeException('Local payment settings are not configured; no changes made.');
    $s = json_decode($row->value, true, 512, JSON_THROW_ON_ERROR);
    if (!in_array(Records::cents((string)$s['fee']), [50000,300000], true)) {
        throw new RuntimeException('Unexpected local fee; refusing to overwrite it.');
    }
    $backup = $backupDir.'/settings-before.json';
    if (!file_exists($backup)) file_put_contents($backup, json_encode($row, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
    $oldFee = $s['fee'];
    $s['fee'] = '3000.00';
    $s['instructions'] = str_replace(['ETB 500','500 ብር'], ['ETB 3,000','3,000 ብር'], $s['instructions']);
    DB::table('payment_settings')->where('id', 1)->update(['value'=>json_encode($s, JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),'updated_at'=>now()]);
    if (Records::cents((string)$oldFee)!==300000) Records::audit('settings.updated', 'payment_settings', ['source'=>'authorized local price update','old_fee'=>$oldFee,'new_fee'=>'3000.00']);
});
if ($paymentsBefore!==hash('sha256',DB::table('payments')->orderBy('id')->get()->toJson()) || $entitlementsBefore!==hash('sha256',DB::table('entitlements')->orderBy('id')->get()->toJson())) {
    throw new RuntimeException('Unexpected payment or entitlement changes detected.');
}
if (Records::cents((string)Records::settings()['fee'])!==300000) throw new RuntimeException('Fee update verification failed.');
echo "Local activation fee is ETB 3,000.00. Payment records and entitlements are unchanged. Prior settings backed up outside public folders.\n";
