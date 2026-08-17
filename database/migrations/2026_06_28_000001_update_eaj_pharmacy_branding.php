<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('system_settings')->updateOrInsert(
            ['branch_id' => null, 'key' => 'general.business_name'],
            [
                'value' => 'EAJ Pharmacy Management System',
                'type' => 'string',
                'group' => 'general',
                'label' => 'Business name',
                'description' => null,
                'options' => null,
                'is_public' => true,
                'is_readonly' => false,
                'updated_at' => now(),
                'created_at' => now(),
            ],
        );
    }

    public function down(): void
    {
        DB::table('system_settings')
            ->whereNull('branch_id')
            ->where('key', 'general.business_name')
            ->where('value', 'EAJ Pharmacy Management System')
            ->update(['value' => 'My POS Business', 'updated_at' => now()]);
    }
};
