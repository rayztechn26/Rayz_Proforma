<?php

use App\Http\Controllers\AdminController as A;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => redirect('/admin'));
Route::post('/admin/language', [A::class, 'language'])->middleware('throttle:30,1');
Route::get('/admin/login', [A::class, 'loginForm'])->name('login');
Route::post('/admin/login', [A::class, 'login'])->middleware('throttle:6,1');
Route::prefix('admin')->middleware('admin')->group(function () {
    Route::get('website-analytics', [\App\Http\Controllers\WebsiteAnalyticsController::class, 'adminStats']);
    Route::get('/', [A::class, 'dashboard']);
    Route::post('logout', [A::class, 'logout']);
    Route::get('payments/{id}', [A::class, 'detail']);
    Route::get('payments/{id}/receipt', [A::class, 'receipt']);
    Route::post('payments/{id}/approve', [A::class, 'approve']);
    Route::post('payments/{id}/reject', [A::class, 'reject']);
    Route::post('payments/{id}/dispute', [A::class, 'dispute']);
    Route::get('settings', [A::class, 'settings']);
    Route::post('settings', [A::class, 'saveSettings']);
    Route::post('grants', [A::class, 'grant']);
    Route::post('recovery', [A::class, 'recoverAccount']);
    Route::post('changes/{id}', [A::class, 'change']);
    Route::get('notifications', [A::class, 'notifications']);
    Route::post('notifications/{id}/read', [A::class, 'read']);
    Route::post('push', [A::class, 'subscribe']);
});
