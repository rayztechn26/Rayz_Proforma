<?php
// Run only against a disposable MySQL database ending in _test.
require __DIR__.'/../vendor/autoload.php';
$app=require __DIR__.'/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Models\User;
use App\Services\ManualPaymentService;
use Symfony\Component\Process\Process;
if(!app()->environment('testing')||DB::getDriverName()!=='mysql'||!str_ends_with(DB::connection()->getDatabaseName(),'_test')){fwrite(STDERR,"Requires APP_ENV=testing and disposable MySQL DB_DATABASE ending _test.\n");exit(2);}
if(($argv[1]??'')==='worker'){
 auth()->setUser(User::findOrFail($argv[3]));
 try{app(ManualPaymentService::class)->approve($argv[2],$argv[4],10000,'Concurrency integration test');echo "approved\n";}catch(Throwable $e){echo "conflict\n";exit(3);}exit;
}
Illuminate\Support\Facades\Artisan::call('migrate',['--force'=>true]);
$owner=User::factory()->create();$admins=[User::factory()->create(['is_admin'=>true]),User::factory()->create(['is_admin'=>true])];
$make=function(string $ref)use($owner){$id=(string)Str::uuid();DB::table('payments')->insert(['id'=>$id,'user_id'=>$owner->id,'idempotency'=>(string)Str::uuid(),'payer_phone'=>'+251911111111','reference'=>$ref,'active_reference'=>$ref,'expected_cents'=>10000,'instructions'=>'{}','created_at'=>now(),'updated_at'=>now()]);return $id;};
$run=function(array $requests,string $ref)use($admins){$ps=[];foreach($requests as $i=>$id){$p=new Process([PHP_BINARY,__FILE__,'worker',$id,(string)$admins[$i]->id,$ref],base_path());$p->start();$ps[]=$p;}foreach($ps as $p)$p->wait();return array_map(fn($p)=>$p->getExitCode(),$ps);};
$prefix=bin2hex(random_bytes(8));$same=$make($prefix.'-same');$codes=$run([$same,$same],$prefix.'-same');if($codes!==[0,0]||DB::table('entitlements')->where('payment_id',$same)->count()!==1)throw new RuntimeException('Repeated concurrent approval did not converge to one entitlement');
$a=$make($prefix.'-a');$b=$make($prefix.'-b');$codes=$run([$a,$b],$prefix.'-verified');sort($codes);if($codes!==[0,3]||DB::table('payments')->where('verified_reference',$prefix.'-verified')->count()!==1||DB::table('entitlements')->whereIn('payment_id',[$a,$b])->count()!==1)throw new RuntimeException('Concurrent duplicate verified reference was not rejected');
echo "PASS: concurrent same-request approval is idempotent; concurrent duplicate verified reference grants exactly one entitlement.\n";
