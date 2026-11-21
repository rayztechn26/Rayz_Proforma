<?php
// Local workstation setup only. Never deploy or expose this CLI script over HTTP.
if(PHP_SAPI!=='cli')exit(2);
$target='C:/wamp64/www/backend';
require $target.'/vendor/autoload.php';
$env=Dotenv\Dotenv::parse(file_get_contents($target.'/.env'));
$db=new PDO('mysql:host=127.0.0.1;port=3306;charset=utf8mb4','root','',[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$username='proforma_wamp';
$exists=$db->query("SELECT COUNT(*) FROM mysql.user WHERE User='proforma_wamp' AND Host='localhost'")->fetchColumn();
if($exists){if(($env['DB_USERNAME']??'')!==$username||empty($env['DB_PASSWORD']))throw new RuntimeException('Existing service account requires its preserved local credentials.');$password=$env['DB_PASSWORD'];}
else{$password=bin2hex(random_bytes(24));$db->exec('CREATE USER '.$db->quote($username)."@'localhost' IDENTIFIED BY ".$db->quote($password));}
$db->exec('CREATE DATABASE IF NOT EXISTS proforma_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$db->exec('CREATE DATABASE IF NOT EXISTS proforma_local_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
foreach(['proforma_local','proforma_local_test'] as $name)$db->exec('GRANT ALL PRIVILEGES ON `'.$name.'`.* TO '.$db->quote($username)."@'localhost'");
$values=['APP_ENV'=>'local','APP_DEBUG'=>'false','APP_URL'=>'http://127.0.0.1:8087','DB_CONNECTION'=>'mysql','DB_HOST'=>'127.0.0.1','DB_PORT'=>'3306','DB_DATABASE'=>'proforma_local','DB_USERNAME'=>$username,'DB_PASSWORD'=>$password,'SESSION_SECURE_COOKIE'=>'false','SESSION_ENCRYPT'=>'true'];
$text=file_get_contents($target.'/.env');
foreach($values as $key=>$value){$pattern='/^'.preg_quote($key,'/').'=.*$/m';$line=$key.'='.$value;if(preg_match($pattern,$text))$text=preg_replace_callback($pattern,fn()=>$line,$text);else $text.="\n".$line;}
file_put_contents($target.'/.env',$text,LOCK_EX);
echo "Local MySQL databases and scoped service account configured. Existing APP_KEY and signing configuration preserved.\n";
