<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'cashier_type')) {
                $table->string('cashier_type', 30)->default('counter_cashier')->after('role');
                $table->index('cashier_type');
            }
        });

        DB::table('users')
            ->where('role', 'cashier')
            ->where(function ($query) {
                $query->whereNull('cashier_type')->orWhere('cashier_type', '');
            })
            ->update(['cashier_type' => 'counter_cashier']);

        Schema::table('sales', function (Blueprint $table) {
            if (! Schema::hasColumn('sales', 'order_created_by')) {
                $table->foreignId('order_created_by')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('sales', 'payment_received_by')) {
                $table->foreignId('payment_received_by')->nullable()->after('order_created_by')->constrained('users')->nullOnDelete();
            }
        });

        DB::table('sales')->whereNull('order_created_by')->update([
            'order_created_by' => DB::raw('user_id'),
        ]);
        DB::table('sales')->whereNull('payment_received_by')->update([
            'payment_received_by' => DB::raw('user_id'),
        ]);

        Schema::table('pos_queued_orders', function (Blueprint $table) {
            if (! Schema::hasColumn('pos_queued_orders', 'payment_status')) {
                $table->string('payment_status', 30)->default('pending_payment')->after('status');
                $table->index(['branch_id', 'payment_status']);
            }
        });

        DB::table('pos_queued_orders')
            ->where('status', 'processed')
            ->update(['payment_status' => 'paid']);

        DB::table('pos_queued_orders')
            ->where('status', 'pending')
            ->update(['payment_status' => 'pending_payment']);
    }

    public function down(): void
    {
        Schema::table('pos_queued_orders', function (Blueprint $table) {
            if (Schema::hasColumn('pos_queued_orders', 'payment_status')) {
                $table->dropIndex(['branch_id', 'payment_status']);
                $table->dropColumn('payment_status');
            }
        });

        Schema::table('sales', function (Blueprint $table) {
            if (Schema::hasColumn('sales', 'payment_received_by')) {
                $table->dropConstrainedForeignId('payment_received_by');
            }
            if (Schema::hasColumn('sales', 'order_created_by')) {
                $table->dropConstrainedForeignId('order_created_by');
            }
        });

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'cashier_type')) {
                $table->dropIndex(['cashier_type']);
                $table->dropColumn('cashier_type');
            }
        });
    }
};
