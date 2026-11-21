<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('device_revocations', function (Blueprint $t) {
            $t->uuid('license_id')->primary();
            $t->string('company_id', 100);
            $t->foreign('company_id')->references('id')->on('licensed_companies');
            $t->string('fingerprint', 64);
            $t->text('public_key');
            $t->uuid('transfer_id');
            $t->foreignId('reviewer_id')->constrained('users');
            $t->timestamp('revoked_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_revocations');
    }
};
