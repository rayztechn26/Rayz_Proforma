<?php
// Used only for a fixed document root. Keep the Laravel core outside this folder.
use Illuminate\Http\Request;
define('LARAVEL_START',microtime(true));
$root=require __DIR__.'/app-path.php';
if(!is_string($root)||!is_file($root.'/vendor/autoload.php')){http_response_code(503);exit('Application files are not configured.');}
if(file_exists($maintenance=$root.'/storage/framework/maintenance.php'))require $maintenance;
require $root.'/vendor/autoload.php';
$app=require_once $root.'/bootstrap/app.php';
$app->usePublicPath(__DIR__);
$app->handleRequest(Request::capture());
