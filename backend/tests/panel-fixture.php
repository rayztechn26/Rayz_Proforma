<?php
// Browser QA fixture: refuses all non-test databases; never a public route.
require __DIR__.'/../vendor/autoload.php';
$app=require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if(!app()->environment('testing')||!str_ends_with(Illuminate\Support\Facades\DB::connection()->getDatabaseName(),'_test'))exit(2);
Illuminate\Support\Facades\DB::table('payment_settings')->updateOrInsert(['id'=>1],['value'=>json_encode(['fee'=>'100.00','merchant'=>'TEST ONLY — NO MONEY','recipient'=>'TEST ONLY','instructions'=>'Synthetic protocol test; no real payment','support'=>'TEST ONLY','waiting'=>'TEST ONLY']),'created_at'=>now(),'updated_at'=>now()]);
$g=new PragmaRX\Google2FA\Google2FA();
$u=App\Models\User::firstOrNew(['phone'=>'+251900000001']);
$u->name='Browser QA administrator';$u->email='panel-test@admin.invalid';$u->password='PanelTestOnly123';$u->is_admin=true;$u->totp_secret=$g->generateSecretKey();$u->totp_last_step=null;$u->save();
echo json_encode(['phone'=>$u->phone,'password'=>'PanelTestOnly123','code'=>$g->getCurrentOtp($u->totp_secret)]);
