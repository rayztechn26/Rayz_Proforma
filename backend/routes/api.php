<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\LicenseController;
use App\Http\Controllers\PaymentController;
use Illuminate\Support\Facades\Route;

Route::post('analytics/events', [\App\Http\Controllers\WebsiteAnalyticsController::class, 'record'])->middleware('throttle:240,1,website-events:');
Route::get('analytics/public', [\App\Http\Controllers\WebsiteAnalyticsController::class, 'publicStats'])->middleware('throttle:120,1,website-stats:');
Route::get('analytics/apk', [\App\Http\Controllers\WebsiteAnalyticsController::class, 'download'])->middleware('throttle:30,1,website-apk:');

Route::middleware('throttle:6,1')->group(function () {
    Route::post('register', [AccountController::class, 'register']);
    Route::post('login', [AccountController::class, 'login']);
});
Route::middleware(['token', 'throttle:120,1'])->group(function () {
    Route::post('logout', [AccountController::class, 'logout']);
    Route::post('password', [AccountController::class, 'changePassword'])->middleware('throttle:6,1,password-change:');
    Route::get('account', [PaymentController::class, 'index']);
    Route::post('payments', [PaymentController::class, 'submit'])->middleware('throttle:10,1');
    Route::post('challenges', [LicenseController::class, 'challenge']);
    Route::post('companies', [LicenseController::class, 'company']);
    Route::put('companies/{id}', [LicenseController::class, 'update']);
    Route::post('companies/{id}/recover', [LicenseController::class, 'recover']);
    Route::post('companies/{id}/changes', [LicenseController::class, 'change']);
});
