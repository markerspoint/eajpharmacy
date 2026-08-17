<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * Roles:
     *   super_admin   — no branch, bypasses all access checks, full system
     *   administrator — full branch admin (products, users, orders, reports)
     *   manager       — approves expenses & petty cash, verifies cash counts
     *   cashier       — POS only: sales, cash session, cash count, petty cash requests
     */
    public function run(): void
    {
        $cmc  = Branch::where('code', 'CMC')->first();
        $can  = Branch::where('code', 'CAN')->first();
        $abc1 = Branch::where('code', 'ABC1')->first();
        $xyz1 = Branch::where('code', 'XYZ1')->first();

        // Administrator gets full branch access (all menus except super-admin only: 25 Branches, 28 Settings)
        $adminAccess = array_values(array_map('strval', array_diff(array_keys(\App\Helpers\MenuHelper::all()), ['25', '28'])));

        // Manager preset (management of sales, inventory, cash, reports, promos)
        $managerAccess = ['1','2','3','4','5','6','11','12','13','14','15','16','17','18','19','20','21','22','29','30','31','32','33','34','36'];

        // Cashier preset (POS, sales history, table orders, cash sessions, cash counts, petty cash, promos)
        $cashierAccess = ['2','3','4','14','15','16','29'];

        $users = [

            // ── Super Admin ────────────────────────────────────────
            [
                'fname'     => 'System',
                'lname'     => 'Administrator',
                'username'  => 'superadmin',
                'password'  => Hash::make('superadmin123'),
                'role'      => User::ROLE_SUPER_ADMIN,
                'branch_id' => null,
                'access'    => [],
            ],

            // ── Administrators ─────────────────────────────────────
            [
                'fname'     => 'Admin',
                'lname'     => 'COOP Main',
                'username'  => 'admin.coop.main',
                'password'  => Hash::make('admin123'),
                'role'      => User::ROLE_ADMINISTRATOR,
                'branch_id' => $cmc?->id,
                'access'    => $adminAccess,
            ],
            [
                'fname'     => 'Admin',
                'lname'     => 'COOP Annex',
                'username'  => 'admin.coop.annex',
                'password'  => Hash::make('admin123'),
                'role'      => User::ROLE_ADMINISTRATOR,
                'branch_id' => $can?->id,
                'access'    => $adminAccess,
            ],
            [
                'fname'     => 'Admin',
                'lname'     => 'ABC Store',
                'username'  => 'admin.abc',
                'password'  => Hash::make('admin123'),
                'role'      => User::ROLE_ADMINISTRATOR,
                'branch_id' => $abc1?->id,
                'access'    => $adminAccess,
            ],
            [
                'fname'     => 'Admin',
                'lname'     => 'XYZ Warehouse',
                'username'  => 'admin.xyz',
                'password'  => Hash::make('admin123'),
                'role'      => User::ROLE_ADMINISTRATOR,
                'branch_id' => $xyz1?->id,
                'access'    => $adminAccess,
            ],

            // ── Managers ───────────────────────────────────────────
            [
                'fname'     => 'Ana',
                'lname'     => 'Rivera',
                'username'  => 'ana.manager',
                'password'  => Hash::make('manager123'),
                'role'      => User::ROLE_MANAGER,
                'branch_id' => $cmc?->id,
                'access'    => $managerAccess,
            ],
            [
                'fname'     => 'Ben',
                'lname'     => 'Torres',
                'username'  => 'ben.manager',
                'password'  => Hash::make('manager123'),
                'role'      => User::ROLE_MANAGER,
                'branch_id' => $can?->id,
                'access'    => $managerAccess,
            ],
            [
                'fname'     => 'Maria',
                'lname'     => 'Santos',
                'username'  => 'maria.manager',
                'password'  => Hash::make('manager123'),
                'role'      => User::ROLE_MANAGER,
                'branch_id' => $abc1?->id,
                'access'    => $managerAccess,
            ],
            [
                'fname'     => 'Pedro',
                'lname'     => 'Reyes',
                'username'  => 'pedro.manager',
                'password'  => Hash::make('manager123'),
                'role'      => User::ROLE_MANAGER,
                'branch_id' => $xyz1?->id,
                'access'    => $managerAccess,
            ],

            // ── Cashiers ───────────────────────────────────────────
            // CMC has 2 cashiers — busy dine-in cafe
            [
                'fname'     => 'Carlo',
                'lname'     => 'Mendoza',
                'username'  => 'carlo.cashier',
                'password'  => Hash::make('cashier123'),
                'role'      => User::ROLE_CASHIER,
                'branch_id' => $cmc?->id,
                'access'    => $cashierAccess,
            ],
            [
                'fname'     => 'Diana',
                'lname'     => 'Cruz',
                'username'  => 'diana.cashier',
                'password'  => Hash::make('cashier123'),
                'role'      => User::ROLE_CASHIER,
                'branch_id' => $cmc?->id,
                'access'    => $cashierAccess,
            ],
            [
                'fname'     => 'Ella',
                'lname'     => 'Bautista',
                'username'  => 'ella.cashier',
                'password'  => Hash::make('cashier123'),
                'role'      => User::ROLE_CASHIER,
                'branch_id' => $can?->id,
                'access'    => $cashierAccess,
            ],
            [
                'fname'     => 'Frank',
                'lname'     => 'Lim',
                'username'  => 'frank.cashier',
                'password'  => Hash::make('cashier123'),
                'role'      => User::ROLE_CASHIER,
                'branch_id' => $abc1?->id,
                'access'    => $cashierAccess,
            ],
            [
                'fname'     => 'Grace',
                'lname'     => 'Tan',
                'username'  => 'grace.cashier',
                'password'  => Hash::make('cashier123'),
                'role'      => User::ROLE_CASHIER,
                'branch_id' => $xyz1?->id,
                'access'    => $cashierAccess,
            ],
        ];

        foreach ($users as $data) {
            User::updateOrCreate(['username' => $data['username']], $data);
        }

        $this->command->info('✓ Users seeded (' . count($users) . ')');
    }
}
