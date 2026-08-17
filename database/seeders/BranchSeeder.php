<?php

namespace Database\Seeders;

use App\Models\Branch;
use Illuminate\Database\Seeder;

class BranchSeeder extends Seeder
{
    /**
     * Business type auto-applies feature flags via Branch::booted():
     *
     *   retail     → use_variants=true, use_expiry_tracking=true, use_bundles=true
     *   cafe       → use_variants=true, use_recipe_system=true
     *   restaurant → use_recipe_system=true, use_table_ordering=true
     *   mixed      → all flags true
     *
     * Override any flag explicitly in the array below.
     */
    public function run(): void
    {
        $branches = [

            // ── COOP Main Campus — cafe WITH dine-in tables ────────
            // Overrides: use_table_ordering=true (cafe defaults to false)
            [
                'name'               => 'COOP Main Campus',
                'code'               => 'CMC',
                'address'            => 'Main Building, Ground Floor',
                'phone'              => '09171234501',
                'contact_person'     => 'Ana Rivera',
                'is_active'          => true,
                'business_type'      => Branch::TYPE_CAFE,
                'use_table_ordering' => true, // override: this cafe has tables
            ],

            // ── COOP Annex — cafe, takeout/kiosk only ─────────────
            // Auto-flags: use_variants=true, use_recipe_system=true
            [
                'name'          => 'COOP Annex',
                'code'          => 'CAN',
                'address'       => 'Annex Building, Room 101',
                'phone'         => '09171234502',
                'contact_person'=> 'Ben Torres',
                'is_active'     => true,
                'business_type' => Branch::TYPE_CAFE,
            ],

            // ── ABC Main Store — retail / grocery ─────────────────
            // Auto-flags: use_variants=true, use_expiry_tracking=true, use_bundles=true
            [
                'name'          => 'ABC Main Store',
                'code'          => 'ABC1',
                'address'       => '123 Commerce St., City Center',
                'phone'         => '09281234501',
                'contact_person'=> 'Maria Santos',
                'is_active'     => true,
                'business_type' => Branch::TYPE_RETAIL,
            ],

            // ── XYZ Warehouse — hardware / wholesale ──────────────
            // Overrides: use_variants=false, use_expiry_tracking=false
            // (hardware doesn't need sizes or expiry dates)
            [
                'name'                => 'XYZ Warehouse',
                'code'                => 'XYZ1',
                'address'             => '456 Trade Ave., Uptown',
                'phone'               => '09391234501',
                'contact_person'      => 'Pedro Reyes',
                'is_active'           => true,
                'business_type'       => Branch::TYPE_RETAIL,
                'use_variants'        => false,
                'use_expiry_tracking' => false,
            ],
        ];

        foreach ($branches as $data) {
            Branch::firstOrCreate(['code' => $data['code']], $data);
        }

        $this->command->info('✓ Branches seeded (' . count($branches) . ')');
    }
}
