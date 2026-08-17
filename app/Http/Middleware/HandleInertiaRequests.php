<?php

namespace App\Http\Middleware;

use App\Helpers\MenuHelper;
use App\Models\Promo;
use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    protected $rootView = 'app';

    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Props shared with every Inertia page.
     *
     *   props.auth.user                      → logged-in user object
     *   props.auth.user.branch.feature_flags → { table_ordering, variants, ... }
     *   props.settings.require_cash_session  → branch-scoped POS setting
     *   props.flash.message                  → { type, text } toast
     *   props.app.currency                   → e.g. "₱"
     *   props.promos                         → active promos array (for POS)
     */
    public function share(Request $request): array
    {
        $user = Auth::user();

        if ($user && ! $user->relationLoaded('branch')) {
            $user->load(['branch']);
        }

        $branch   = $user?->branch;
        $branchId = $branch?->id;

        // ── Active promos ──────────────────────────────────────────
        // Loaded once per request for authenticated users.
        // POS uses this for promo code validation and auto-apply.
        // tableExists() prevents crashes before migration has been run.
        $activePromos = [];
        if ($user && Promo::tableExists()) {
            $activePromos = Promo::with(['products:id', 'categories:id'])
                ->active()
                ->get()
                ->map(fn (Promo $p) => [
                    'id'               => $p->id,
                    'name'             => $p->name,
                    'code'             => $p->code,
                    'discount_type'    => $p->discount_type,
                    'discount_value'   => (float) $p->discount_value,
                    'applies_to'       => $p->applies_to,
                    'minimum_purchase' => $p->minimum_purchase ? (float) $p->minimum_purchase : null,
                    'product_ids'      => $p->products->pluck('id')->values(),
                    'category_ids'     => $p->categories->pluck('id')->values(),
                    'expires_at'       => $p->expires_at?->toIso8601String(),
                ])
                ->values()
                ->all();
        }

        $brandImage = function (string $key) use ($branchId) {
            $branchRow = $branchId
                ? SystemSetting::where('branch_id', $branchId)->where('key', $key)->first(['value', 'updated_at'])
                : null;
            $globalRow = SystemSetting::whereNull('branch_id')->where('key', $key)->first(['value', 'updated_at']);

            return $branchRow && (string) $branchRow->value !== '' ? $branchRow : $globalRow;
        };

        $brandVersion = function (string $path, mixed $updatedAt): string {
            $path = ltrim(str_replace('\\', '/', $path), '/');
            $mtime = Storage::disk('public')->exists($path)
                ? Storage::disk('public')->lastModified($path)
                : 0;

            return implode('-', array_filter([
                $updatedAt?->timestamp,
                $mtime,
                sprintf('%u', crc32($path)),
            ]));
        };

        $effectiveLogo = $brandImage('general.logo');
        $logoPath = (string) ($effectiveLogo?->value ?? '');
        $logoVersion = $logoPath !== '' ? $brandVersion($logoPath, $effectiveLogo?->updated_at) : null;

        $effectiveIcon = $brandImage('general.app_icon');
        $iconPath = (string) ($effectiveIcon?->value ?? '');
        $iconVersion = $iconPath !== '' ? $brandVersion($iconPath, $effectiveIcon?->updated_at) : null;

        return array_merge(parent::share($request), [

            // ── App meta ──────────────────────────────────────────
            'app' => [
                'name'           => (string) SystemSetting::get('general.business_name', null, config('app.name', 'Point of Sale')),
                'business_name'  => (string) SystemSetting::get('general.business_name', null, config('app.name', 'Point of Sale')),
                'env'            => config('app.env'),
                'currency'       => SystemSetting::currencySymbol(),
                'ai_chat_enabled'=> (bool) SystemSetting::get('general.ai_chat_enabled', null, true),
                'color_theme'    => (string) SystemSetting::get('general.color_theme', null, 'ea'),
                'logo_url'       => $logoPath !== ''
                    ? route('brand.logo', array_filter([
                        'branchId' => $branchId,
                        'v'        => $logoVersion,
                    ]))
                    : null,
                'logo_version'   => $logoVersion,
                'icon_url'       => $iconPath !== ''
                    ? route('brand.icon', array_filter([
                        'branchId' => $branchId,
                        'v'        => $iconVersion,
                    ]))
                    : asset('eajicon.png'),
                'icon_version'   => $iconVersion,
            ],

            // ── Auth ──────────────────────────────────────────────
            'auth' => [
                'authenticated' => Auth::check(),

                'user' => $user ? [

                    // Identity
                    'id'        => $user->id,
                    'fname'     => $user->fname,
                    'lname'     => $user->lname,
                    'full_name' => $user->full_name,
                    'username'  => $user->username,

                    // Role
                    'role'       => $user->role,
                    'role_label' => $user->role_label,
                    'cashier_type' => $user->cashier_type ?? 'counter_cashier',
                    'cashier_type_label' => $user->cashier_type_label,

                    // Menu access array — used by hasAccess() in the sidebar
                    // super_admin gets all menu IDs as strings; others get assigned or admin defaults
                    'access' => $user->isSuperAdmin()
                        ? array_values(array_map('strval', array_keys(MenuHelper::all())))
                        : ($user->isAdministrator() && empty($user->access)
                            ? array_values(array_diff(array_map('strval', array_keys(MenuHelper::all())), ['25', '28']))
                            : ($user->access ?? [])),

                    // Boolean role helpers
                    'is_super_admin'   => $user->isSuperAdmin(),
                    'is_administrator' => $user->isAdministrator(),
                    'is_manager'       => $user->isManager(),
                    'is_cashier'       => $user->isCashier(),
                    'is_admin'         => $user->isAdmin(),
                    'can_approve'      => $user->canApprove(),
                    'can_collect_payments' => $user->canCollectPosPayments(),
                    'pos_layout'       => $user->pos_layout ?? 'grid',

                    // Branch (null for super_admin who has no branch)
                    'branch_id' => $user->branch_id,
                    'branch'    => $branch ? [
                        'id'            => $branch->id,
                        'name'          => $branch->name,
                        'code'          => $branch->code,
                        'business_type' => $branch->business_type,
                        'is_active'     => $branch->is_active,
                        'feature_flags' => $branch->feature_flags,
                    ] : null,

                    // Supplier — resolved through branch
                ] : null,
            ],

            // ── Branch-scoped system settings ─────────────────────
            'settings' => $user ? [

                // POS behaviour
                'require_cash_session' => SystemSetting::requireCashSession($branchId),
                'allow_negative_stock' => SystemSetting::allowNegativeStock($branchId),
                'allow_discount'       => (bool)  SystemSetting::get('pos.allow_discount',        $branchId, true),
                'max_discount_percent' => SystemSetting::maxDiscountPercent($branchId),
                'default_payment'      =>          SystemSetting::get('pos.default_payment',       $branchId, 'cash'),
                'show_product_images'  => (bool)  SystemSetting::get('pos.show_product_images',   $branchId, true),
                'senior_pwd_discount'  => (float) SystemSetting::get('pos.senior_pwd_discount',   $branchId, 20),
                'enable_installments'  => (bool)  SystemSetting::get('pos.enable_installments',   $branchId, false),

                // Tax
                'vat_enabled'          => SystemSetting::vatEnabled($branchId),
                'vat_rate'             => SystemSetting::vatRate($branchId),
                'vat_inclusive'        => SystemSetting::vatInclusive($branchId),
                'service_charge_rate'  => (float) SystemSetting::get('tax.service_charge_rate',   $branchId, 0),

                // Receipt
                'receipt_header'          =>        SystemSetting::get('receipt.header_text',        $branchId, ''),
                'receipt_footer'          =>        SystemSetting::get('receipt.footer_text',        $branchId, ''),
                'show_cashier_on_receipt' => (bool) SystemSetting::get('receipt.show_cashier',       $branchId, true),
                'hide_product_names_on_receipt' => (bool) SystemSetting::get('receipt.hide_product_names', $branchId, false),
                'receipt_copies'          => (int)  SystemSetting::get('receipt.copies',             $branchId, 1),

                // Inventory alerts
                'low_stock_threshold' => SystemSetting::lowStockThreshold($branchId),
                'near_expiry_days'    => (int) SystemSetting::get('inventory.near_expiry_days',     $branchId, 30),

                // Cash management
                'petty_cash_limit'       => SystemSetting::pettyCashLimit($branchId),
                'require_count_on_close' => (bool) SystemSetting::get('cash.require_count_on_close', $branchId, true),
                'over_short_alert'       => (float) SystemSetting::get('cash.over_short_alert',      $branchId, 100),

            ] : null,

            // ── Active promos ──────────────────────────────────────
            // Available on every page via usePage().props.promos
            'promos' => $activePromos,

            // ── Flash messages ────────────────────────────────────
            'flash' => [
                'success'    => session('success'),
                'error'      => session('error'),
                'warning'    => session('warning'),
                'info'       => session('info'),
                'message'    => session('message'),
                'pos_result' => session('pos_result'),
                'queued_order' => session('queued_order'),
            ],

            // ── Ziggy route helper ────────────────────────────────
            'ziggy' => [
                'location' => $request->url(),
            ],

        ]);
    }
}
