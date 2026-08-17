<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('system_settings')->updateOrInsert(
            ['branch_id' => null, 'key' => 'receipt.hide_product_names'],
            [
                'value' => 'false',
                'type' => 'boolean',
                'group' => 'receipt',
                'label' => 'Hide product names on receipt',
                'description' => 'Replace medicine names with generic item labels on printed and downloaded receipts',
                'options' => null,
                'is_public' => false,
                'is_readonly' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }

    public function down(): void
    {
        DB::table('system_settings')
            ->whereNull('branch_id')
            ->where('key', 'receipt.hide_product_names')
            ->delete();
    }
};
