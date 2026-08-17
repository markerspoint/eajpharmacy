<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('branches', 'supplier_id')) {
            return;
        }

        try {
            Schema::table('branches', function ($table) {
                $table->dropForeign(['supplier_id']);
            });
        } catch (Throwable) {
            // Fresh or manually repaired databases may not have this constraint.
        }

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE branches MODIFY supplier_id BIGINT UNSIGNED NULL');
        }
    }

    public function down(): void
    {
        // Keep branches independent from suppliers. This migration is intentionally one-way.
    }
};
