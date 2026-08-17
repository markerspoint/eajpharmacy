<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('system_settings')->updateOrInsert(
            ['branch_id' => null, 'key' => 'general.app_icon'],
            [
                'value' => '',
                'type' => 'image',
                'group' => 'general',
                'label' => 'Tab icon',
                'description' => 'Browser tab and app shortcut icon',
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
            ->where('key', 'general.app_icon')
            ->delete();
    }
};
