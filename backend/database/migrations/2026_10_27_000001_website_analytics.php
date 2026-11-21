<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('website_analytics_daily', function (Blueprint $table) {
            $table->date('day');
            $table->string('page', 16);
            $table->unsignedBigInteger('views')->default(0);
            $table->unsignedBigInteger('visitors')->default(0);
            $table->unsignedBigInteger('downloads')->default(0);
            $table->primary(['day', 'page']);
        });
        Schema::create('website_analytics_visitors', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('page', 16);
            $table->timestamp('last_seen')->index();
        });
        Schema::create('website_analytics_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->timestamp('created_at')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('website_analytics_events');
        Schema::dropIfExists('website_analytics_visitors');
        Schema::dropIfExists('website_analytics_daily');
    }
};
