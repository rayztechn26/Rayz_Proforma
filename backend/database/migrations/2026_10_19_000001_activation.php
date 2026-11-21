<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            $t->string('phone', 20)->nullable()->unique();
            $t->boolean('is_admin')->default(false);
            $t->text('totp_secret')->nullable();
            $t->unsignedBigInteger('totp_last_step')->nullable();
        });
        Schema::create('api_tokens', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained();
            $t->string('hash', 64)->unique();
            $t->timestamp('expires_at');
            $t->timestamps();
        });
        Schema::create('payment_settings', function (Blueprint $t) {
            $t->id();
            $t->json('value');
            $t->timestamps();
        });
        Schema::create('payments', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignId('user_id')->constrained();
            $t->uuid('idempotency');
            $t->uuid('previous_id')->nullable();
            $t->string('payer_phone', 20);
            $t->string('reference', 120);
            $t->string('active_reference', 120)->nullable()->unique();
            $t->string('verified_reference', 120)->nullable()->unique();
            $t->unsignedBigInteger('expected_cents');
            $t->json('instructions');
            $t->string('receipt')->nullable();
            $t->text('note')->nullable();
            $t->string('status')->default('pending');
            $t->unsignedBigInteger('received_cents')->nullable();
            $t->text('reason')->nullable();
            $t->text('admin_notes')->nullable();
            $t->foreignId('reviewer_id')->nullable()->constrained('users');
            $t->timestamp('reviewed_at')->nullable();
            $t->timestamps();
            $t->unique(['user_id', 'idempotency']);
        });
        Schema::create('entitlements', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignId('user_id')->constrained();
            $t->uuid('payment_id')->nullable()->unique();
            $t->foreign('payment_id')->references('id')->on('payments');
            $t->text('grant_reason')->nullable();
            $t->timestamps();
        });
        Schema::create('licensed_companies', function (Blueprint $t) {
            $t->string('id', 100)->primary();
            $t->foreignId('user_id')->constrained();
            $t->uuid('entitlement_id')->unique();
            $t->foreign('entitlement_id')->references('id')->on('entitlements');
            $t->string('name');
            $t->string('tin');
            $t->json('profile');
            $t->timestamps();
        });
        Schema::create('devices', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->string('company_id', 100)->unique();
            $t->foreign('company_id')->references('id')->on('licensed_companies');
            $t->text('public_key');
            $t->string('fingerprint', 64);
            $t->uuid('license_id');
            $t->timestamps();
        });
        Schema::create('challenges', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignId('user_id')->constrained();
            $t->string('nonce', 128);
            $t->text('public_key');
            $t->string('fingerprint', 64);
            $t->timestamp('expires_at');
            $t->timestamp('used_at')->nullable();
            $t->timestamps();
        });
        Schema::create('change_requests', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignId('user_id')->constrained();
            $t->string('company_id', 100);
            $t->foreign('company_id')->references('id')->on('licensed_companies');
            $t->string('kind');
            $t->json('details');
            $t->string('status')->default('pending');
            $t->text('reason');
            $t->foreignId('reviewer_id')->nullable()->constrained('users');
            $t->timestamp('reviewed_at')->nullable();
            $t->timestamps();
        });
        Schema::create('admin_notices', function (Blueprint $t) {
            $t->id();
            $t->uuid('payment_id');
            $t->timestamps();
        });
        Schema::create('notice_reads', function (Blueprint $t) {
            $t->foreignId('user_id')->constrained();
            $t->foreignId('notice_id')->constrained('admin_notices');
            $t->primary(['user_id', 'notice_id']);
        });
        Schema::create('push_subscriptions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained();
            $t->string('endpoint_hash', 64)->unique();
            $t->text('subscription');
            $t->timestamps();
        });
        Schema::create('audit_events', function (Blueprint $t) {
            $t->id();
            $t->foreignId('actor_id')->nullable()->constrained('users');
            $t->string('action');
            $t->string('subject');
            $t->json('details');
            $t->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['audit_events', 'push_subscriptions', 'notice_reads', 'admin_notices', 'change_requests', 'challenges', 'devices', 'licensed_companies', 'entitlements', 'payments', 'payment_settings', 'api_tokens'] as $n) {
            Schema::dropIfExists($n);
        }Schema::table('users', fn (Blueprint $t) => $t->dropColumn(['phone', 'is_admin', 'totp_secret', 'totp_last_step']));
    }
};
