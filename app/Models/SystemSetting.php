<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Cache;

class SystemSetting extends Model
{
    protected $fillable = [
        'branch_id',
        'key',
        'value',
        'type',
        'group',
        'label',
        'description',
        'options',
        'is_public',
        'is_readonly',
    ];

    protected $casts = [
        'is_public'   => 'boolean',
        'is_readonly' => 'boolean',
    ];

    // ── Cache ──────────────────────────────────────────────────────

    /** Cache TTL in seconds (1 hour) */
    const CACHE_TTL = 3600;

    protected static function booted(): void
    {
        // Flush cache whenever a setting is saved or deleted
        static::saved(fn($s)   => static::flushCache($s->branch_id));
        static::deleted(fn($s) => static::flushCache($s->branch_id));
    }

    public static function flushCache(?int $branchId = null): void
    {
        Cache::forget("settings:global");
        if ($branchId) Cache::forget("settings:branch:{$branchId}");
    }

    // ── Relationships ──────────────────────────────────────────────

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    // ── Core Read API ──────────────────────────────────────────────

    /**
     * Get a setting value with branch override support.
     *
     * Resolution order:
     *   1. Branch-specific setting (if $branchId provided)
     *   2. Global setting (branch_id = null)
     *   3. $default value
     *
     * Usage:
     *   SystemSetting::get('pos.require_cash_session')            → global
     *   SystemSetting::get('pos.require_cash_session', $branchId) → branch overrides global
     *   SystemSetting::get('general.vat_rate', null, 12.0)        → with default
     */
    public static function get(string $key, ?int $branchId = null, mixed $default = null): mixed
    {
        $all = static::allForBranch($branchId);
        $raw = $all[$key] ?? null;

        if ($raw === null) return $default;

        return static::castValue($raw['value'], $raw['type'] ?? 'string');
    }

    /**
     * Get all settings for a branch (branch settings override global).
     * Result is cached for CACHE_TTL seconds.
     *
     * Returns: ['key' => ['value' => ..., 'type' => ..., 'group' => ...], ...]
     */
    public static function allForBranch(?int $branchId = null): array
    {
        $cacheKey = $branchId ? "settings:branch:{$branchId}" : "settings:global";

        return Cache::remember($cacheKey, static::CACHE_TTL, function () use ($branchId) {
            // Load global settings
            $globals = static::whereNull('branch_id')
                ->get()
                ->keyBy('key')
                ->map(fn($s) => ['value' => $s->value, 'type' => $s->type, 'group' => $s->group])
                ->toArray();

            if (!$branchId) return $globals;

            // Load branch settings
            $branchSettings = static::where('branch_id', $branchId)
                ->get()
                ->keyBy('key')
                ->map(fn($s) => ['value' => $s->value, 'type' => $s->type, 'group' => $s->group])
                ->toArray();

            // Branch settings override globals
            return array_merge($globals, $branchSettings);
        });
    }

    /**
     * Get all settings in a group for a branch.
     * e.g. SystemSetting::group('receipt', $branchId) → all receipt.* settings
     */
    public static function group(string $group, ?int $branchId = null): array
    {
        return collect(static::allForBranch($branchId))
            ->filter(fn($v, $k) => str_starts_with($k, $group . '.'))
            ->map(fn($v) => static::castValue($v['value'], $v['type']))
            ->toArray();
    }

    // ── Core Write API ─────────────────────────────────────────────

    /**
     * Set a setting value for a given scope.
     * Creates if not exists, updates if exists.
     */
    public static function set(string $key, mixed $value, ?int $branchId = null): static
    {
        $stringValue = is_array($value) || is_object($value)
            ? json_encode($value)
            : (string) $value;

        return static::updateOrCreate(
            ['key' => $key, 'branch_id' => $branchId],
            ['value' => $stringValue]
        );
    }

    // ── Type Casting ───────────────────────────────────────────────

    protected static function castValue(mixed $value, string $type): mixed
    {
        return match ($type) {
            'boolean' => filter_var($value, FILTER_VALIDATE_BOOLEAN),
            'integer' => (int)   $value,
            'decimal' => (float) $value,
            'json'    => json_decode($value, true),
            default   => (string) $value,
        };
    }

    // ── Default Settings Registry ──────────────────────────────────

    /**
     * All system defaults. Run via SystemSettingSeeder.
     * Override per branch using SystemSetting::set($key, $value, $branchId).
     */
    public static function defaults(): array
    {
        return [

            // ── General ───────────────────────────────────────────
            ['key' => 'general.ai_chat_enabled', 'value' => 'true',                 'type' => 'boolean', 'group' => 'general', 'label' => 'AI Business Assistant', 'description' => 'Show the floating AI chat assistant for Super Admin and Administrator accounts'],
            ['key' => 'general.business_name',  'value' => 'EAJ Pharmacy Management System', 'type' => 'string',  'group' => 'general', 'label' => 'Business name'],
            ['key' => 'general.address',         'value' => '',                      'type' => 'string',  'group' => 'general', 'label' => 'Address'],
            ['key' => 'general.phone',           'value' => '',                      'type' => 'string',  'group' => 'general', 'label' => 'Phone number'],
            ['key' => 'general.tin',             'value' => '',                      'type' => 'string',  'group' => 'general', 'label' => 'TIN'],
            ['key' => 'general.currency_symbol', 'value' => '₱',                    'type' => 'string',  'group' => 'general', 'label' => 'Currency symbol'],
            ['key' => 'general.currency_code',   'value' => 'PHP',                   'type' => 'string',  'group' => 'general', 'label' => 'Currency code'],
            ['key' => 'general.date_format',     'value' => 'M d, Y',               'type' => 'string',  'group' => 'general', 'label' => 'Date format'],
            ['key' => 'general.timezone',        'value' => 'Asia/Manila',           'type' => 'string',  'group' => 'general', 'label' => 'Timezone'],
            ['key' => 'general.logo',            'value' => '',                      'type' => 'image',   'group' => 'general', 'label' => 'Business logo'],
            ['key' => 'general.app_icon',        'value' => '',                      'type' => 'image',   'group' => 'general', 'label' => 'Tab icon', 'description' => 'Browser tab and app shortcut icon'],
            ['key' => 'general.color_theme',     'value' => 'ea',                    'type' => 'select',  'group' => 'general', 'label' => 'Color theme', 'description' => 'Brand color palette applied system-wide', 'options' => json_encode(['ea','indigo','emerald','amber','rose'])],

            // ── Tax ───────────────────────────────────────────────
            ['key' => 'tax.enable_vat',          'value' => 'false',                 'type' => 'boolean', 'group' => 'tax',     'label' => 'Enable VAT'],
            ['key' => 'tax.vat_rate',            'value' => '12',                    'type' => 'decimal', 'group' => 'tax',     'label' => 'VAT rate (%)'],
            ['key' => 'tax.vat_inclusive',       'value' => 'true',                  'type' => 'boolean', 'group' => 'tax',     'label' => 'Prices are VAT-inclusive'],
            ['key' => 'tax.enable_service_charge','value' => 'false',                'type' => 'boolean', 'group' => 'tax',     'label' => 'Enable service charge'],
            ['key' => 'tax.service_charge_rate', 'value' => '10',                    'type' => 'decimal', 'group' => 'tax',     'label' => 'Service charge rate (%)'],

            // ── POS behavior ──────────────────────────────────────
            ['key' => 'pos.require_cash_session','value' => 'true',                  'type' => 'boolean', 'group' => 'pos',     'label' => 'Require open cash session to sell'],
            ['key' => 'pos.allow_negative_stock','value' => 'false',                 'type' => 'boolean', 'group' => 'pos',     'label' => 'Allow sales when stock is 0'],
            ['key' => 'pos.default_payment',     'value' => 'cash',                  'type' => 'select',  'group' => 'pos',     'label' => 'Default payment method',         'options' => '["cash","gcash","card"]'],
            ['key' => 'pos.show_product_images', 'value' => 'true',                  'type' => 'boolean', 'group' => 'pos',     'label' => 'Show product images on POS'],
            ['key' => 'pos.allow_discount',      'value' => 'true',                  'type' => 'boolean', 'group' => 'pos',     'label' => 'Allow discount on sale'],
            ['key' => 'pos.max_discount_percent','value' => '20',                    'type' => 'decimal', 'group' => 'pos',     'label' => 'Max discount % allowed'],
            ['key' => 'pos.senior_pwd_discount',  'value' => '20',                    'type' => 'decimal', 'group' => 'pos',     'label' => 'Senior/PWD discount (%)'],
            ['key' => 'pos.enable_installments', 'value' => 'false',                 'type' => 'boolean', 'group' => 'pos',     'label' => 'Enable installment sales', 'description' => 'Allow cashiers to process sales with installment payment plans'],

            // ── Receipt ───────────────────────────────────────────
            ['key' => 'receipt.show_logo',       'value' => 'true',                  'type' => 'boolean', 'group' => 'receipt', 'label' => 'Show logo on receipt'],
            ['key' => 'receipt.header_text',     'value' => 'Thank you for your purchase!', 'type' => 'string', 'group' => 'receipt', 'label' => 'Receipt header'],
            ['key' => 'receipt.footer_text',     'value' => 'Please come again.',    'type' => 'string',  'group' => 'receipt', 'label' => 'Receipt footer'],
            ['key' => 'receipt.show_cashier',    'value' => 'true',                  'type' => 'boolean', 'group' => 'receipt', 'label' => 'Show cashier name on receipt'],
            ['key' => 'receipt.hide_product_names','value' => 'false',                'type' => 'boolean', 'group' => 'receipt', 'label' => 'Hide product names on receipt', 'description' => 'Replace medicine names with generic item labels on printed and downloaded receipts'],
            ['key' => 'receipt.show_vat_breakdown','value' => 'false',               'type' => 'boolean', 'group' => 'receipt', 'label' => 'Show VAT breakdown on receipt'],
            ['key' => 'receipt.copies',          'value' => '1',                     'type' => 'integer', 'group' => 'receipt', 'label' => 'Number of receipt copies'],

            // ── Inventory ─────────────────────────────────────────
            ['key' => 'inventory.low_stock_threshold','value' => '5',                'type' => 'integer', 'group' => 'inventory','label' => 'Low stock alert threshold'],
            ['key' => 'inventory.near_expiry_days',  'value' => '30',               'type' => 'integer', 'group' => 'inventory','label' => 'Near expiry warning (days)'],
            ['key' => 'inventory.auto_grn_on_delivery','value' => 'false',          'type' => 'boolean', 'group' => 'inventory','label' => 'Auto-create GRN on order delivery'],

            // ── Cash management ───────────────────────────────────
            ['key' => 'cash.require_count_on_close', 'value' => 'true',             'type' => 'boolean', 'group' => 'cash',    'label' => 'Require cash count before closing session'],
            ['key' => 'cash.petty_cash_limit',       'value' => '500',              'type' => 'decimal', 'group' => 'cash',    'label' => 'Max single petty cash withdrawal (₱)'],
            ['key' => 'cash.over_short_alert',       'value' => '100',              'type' => 'decimal', 'group' => 'cash',    'label' => 'Over/short alert threshold (₱)'],
            ['key' => 'cash.require_manager_approval','value' => 'true',            'type' => 'boolean', 'group' => 'cash',    'label' => 'Require manager to verify cash count'],

            // ── Notifications ─────────────────────────────────────
            ['key' => 'notification.low_stock_alert','value' => 'true',             'type' => 'boolean', 'group' => 'notification','label' => 'Show low stock alert on dashboard'],
            ['key' => 'notification.expiry_alert',   'value' => 'true',             'type' => 'boolean', 'group' => 'notification','label' => 'Show near-expiry alert on dashboard'],
        ];
    }

    // ── Convenience static getters (strongly typed shortcuts) ──────

    public static function businessName(?int $branchId = null): string
    {
        return (string) static::get('general.business_name', $branchId, 'EAJ Pharmacy Management System');
    }

    public static function currencySymbol(): string
    {
        return (string) static::get('general.currency_symbol', null, '₱');
    }

    public static function vatEnabled(?int $branchId = null): bool
    {
        return (bool) static::get('tax.enable_vat', $branchId, false);
    }

    public static function vatRate(?int $branchId = null): float
    {
        return (float) static::get('tax.vat_rate', $branchId, 12.0);
    }

    public static function vatInclusive(?int $branchId = null): bool
    {
        return (bool) static::get('tax.vat_inclusive', $branchId, true);
    }

    public static function lowStockThreshold(?int $branchId = null): int
    {
        return (int) static::get('inventory.low_stock_threshold', $branchId, 5);
    }

    public static function requireCashSession(?int $branchId = null): bool
    {
        return (bool) static::get('pos.require_cash_session', $branchId, true);
    }

    public static function allowNegativeStock(?int $branchId = null): bool
    {
        return (bool) static::get('pos.allow_negative_stock', $branchId, false);
    }

    public static function maxDiscountPercent(?int $branchId = null): float
    {
        return (float) static::get('pos.max_discount_percent', $branchId, 20.0);
    }

    public static function pettyCashLimit(?int $branchId = null): float
    {
        return (float) static::get('cash.petty_cash_limit', $branchId, 500.0);
    }
}
