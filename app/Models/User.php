<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use App\Helpers\MenuHelper;

class User extends Authenticatable
{
    use HasFactory, Notifiable;

    protected $fillable = [
        'fname',
        'lname',
        'username',
        'password',
        'role',
        'cashier_type',
        'branch_id',
        'access',
        'pos_layout',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'role'       => 'string',
        'cashier_type' => 'string',
        'access'     => 'array',
        'pos_layout' => 'string',
        'password'   => 'hashed',
    ];

    protected $attributes = [
        'role'       => 'cashier',
        'cashier_type' => 'counter_cashier',
        'pos_layout' => 'grid',
    ];

    // ── Role constants ─────────────────────────────────────────────

    const ROLE_SUPER_ADMIN   = 'super_admin';
    const ROLE_ADMINISTRATOR = 'administrator';
    const ROLE_MANAGER       = 'manager';
    const ROLE_CASHIER       = 'cashier';

    const CASHIER_TYPE_ORDER_TAKER      = 'order_taker';
    const CASHIER_TYPE_COUNTER_CASHIER  = 'counter_cashier';

    public static function roles(): array
    {
        return [
            self::ROLE_SUPER_ADMIN   => 'Super Admin',
            self::ROLE_ADMINISTRATOR => 'Administrator',
            self::ROLE_MANAGER       => 'Manager',
            self::ROLE_CASHIER       => 'Cashier',
        ];
    }

    public static function cashierTypes(): array
    {
        return [
            self::CASHIER_TYPE_ORDER_TAKER     => 'Order Taker',
            self::CASHIER_TYPE_COUNTER_CASHIER => 'Counter Cashier',
        ];
    }

    // ── POS Layout constants ───────────────────────────────────────

    /**
     * Valid POS layout modes.
     * Matches the values in PosIndex.tsx LayoutMode type.
     * Used for validation in UserController.
     */
    const POS_LAYOUTS = [
        'mobile',
        'tablet',
        'grid',
        'fast_cashier',
        'order_only',
    ];

    public static function posLayoutLabels(): array
    {
        return [
            'mobile'     => 'Phone',
            'tablet'     => 'Tablet',
            'grid'       => 'Standard',
            'fast_cashier' => 'Fast Cashier',
            'order_only' => 'Cashier - Take Orders Only',
        ];
    }

    // ── Role Helpers ───────────────────────────────────────────────

    public function isSuperAdmin(): bool   { return $this->role === self::ROLE_SUPER_ADMIN; }
    public function isAdministrator(): bool{ return $this->role === self::ROLE_ADMINISTRATOR; }
    public function isManager(): bool      { return $this->role === self::ROLE_MANAGER; }
    public function isCashier(): bool      { return $this->role === self::ROLE_CASHIER; }
    public function isOrderTaker(): bool   { return $this->isCashier() && $this->cashier_type === self::CASHIER_TYPE_ORDER_TAKER; }
    public function isCounterCashier(): bool { return $this->isCashier() && ($this->cashier_type ?? self::CASHIER_TYPE_COUNTER_CASHIER) === self::CASHIER_TYPE_COUNTER_CASHIER; }

    public function canCollectPosPayments(): bool
    {
        if (! $this->isCashier()) {
            return $this->hasElevatedAccess();
        }

        return $this->isCounterCashier();
    }

    /** Super Admin OR Administrator */
    public function isAdmin(): bool
    {
        return in_array($this->role, [self::ROLE_SUPER_ADMIN, self::ROLE_ADMINISTRATOR]);
    }

    /** Manager or above */
    public function hasElevatedAccess(): bool
    {
        return in_array($this->role, [
            self::ROLE_SUPER_ADMIN,
            self::ROLE_ADMINISTRATOR,
            self::ROLE_MANAGER,
        ]);
    }

    /** Can approve petty cash vouchers and cash counts */
    public function canApprove(): bool
    {
        return in_array($this->role, [
            self::ROLE_SUPER_ADMIN,
            self::ROLE_ADMINISTRATOR,
            self::ROLE_MANAGER,
        ]);
    }

    /** Super Admin is not restricted to any branch */
    public function isBranchless(): bool
    {
        return $this->role === self::ROLE_SUPER_ADMIN;
    }

    public function getRoleLabelAttribute(): string
    {
        return self::roles()[$this->role] ?? ucfirst($this->role);
    }

    public function getCashierTypeLabelAttribute(): string
    {
        return self::cashierTypes()[$this->cashier_type ?? self::CASHIER_TYPE_COUNTER_CASHIER] ?? 'Counter Cashier';
    }

    // ── Menu Access ────────────────────────────────────────────────

    public function hasAccess(string|int $menuId): bool
    {
        if ($this->isSuperAdmin()) return true;
        if ($this->isAdministrator() && empty($this->access)) {
            return !in_array((string) $menuId, ['25', '28']);
        }
        return in_array((string) $menuId, $this->access ?? []);
    }

    public function getAccessibleMenus(): array
    {
        if ($this->isSuperAdmin()) return MenuHelper::all();
        if ($this->isAdministrator() && empty($this->access)) {
            return array_diff_key(MenuHelper::all(), array_flip(['25', '28']));
        }
        return array_intersect_key(
            MenuHelper::all(),
            array_flip($this->access ?? [])
        );
    }

    // ── Accessors ──────────────────────────────────────────────────

    public function getFullNameAttribute(): string
    {
        return trim("{$this->fname} {$this->lname}");
    }

    /**
     * Human-readable label for the user's POS layout.
     * e.g.  $user->pos_layout_label → "Cafe / Quick"
     */
    public function getPosLayoutLabelAttribute(): string
    {
        return self::posLayoutLabels()[$this->pos_layout ?? 'grid'] ?? 'PC / Standard';
    }

    // ── Relationships ──────────────────────────────────────────────

    public function branch()
    {
        return $this->belongsTo(Branch::class);
    }

    public function supplier()
    {
        return $this->hasOneThrough(
            Supplier::class,
            Branch::class,
            'id',
            'id',
            'branch_id',
            'supplier_id'
        );
    }

    public function sales()
    {
        return $this->hasMany(Sale::class);
    }

    public function createdSales()
    {
        return $this->hasMany(Sale::class, 'order_created_by');
    }

    public function paymentsReceived()
    {
        return $this->hasMany(Sale::class, 'payment_received_by');
    }

    public function cashSessions()
    {
        return $this->hasMany(CashSession::class);
    }

    public function cashCounts()
    {
        return $this->hasMany(CashCount::class, 'counted_by');
    }

    public function verifiedCashCounts()
    {
        return $this->hasMany(CashCount::class, 'verified_by');
    }

    public function expenses()
    {
        return $this->hasMany(Expense::class);
    }

    public function goodsReceived()
    {
        return $this->hasMany(GoodsReceivedNote::class, 'received_by');
    }

    public function confirmedGrns()
    {
        return $this->hasMany(GoodsReceivedNote::class, 'confirmed_by');
    }

    public function activityLogs()
    {
        return $this->hasMany(ActivityLog::class);
    }

    // ── Petty Cash ─────────────────────────────────────────────────

    /** Petty cash funds managed by this user */
    public function managedPettyCashFunds()
    {
        return $this->hasMany(PettyCashFund::class, 'managed_by');
    }

    /** Petty cash vouchers this user submitted */
    public function pettyCashRequests()
    {
        return $this->hasMany(PettyCashVoucher::class, 'requested_by');
    }

    /** Petty cash vouchers this user approved or rejected */
    public function pettyCashApprovals()
    {
        return $this->hasMany(PettyCashVoucher::class, 'approved_by');
    }

    // ── Old relationships kept for backwards compatibility ──────────

    public function sentRequisitions()
    {
        return $this->hasMany(Requisition::class, 'production_user_id');
    }

    public function receivedRequisitions()
    {
        return $this->hasMany(Requisition::class, 'enterprise_user_id');
    }

    public function issuedConsignments()
    {
        return $this->hasMany(ConsignmentStock::class, 'enterprise_user_id');
    }

    public function receivedConsignments()
    {
        return $this->hasMany(ConsignmentStock::class, 'production_user_id');
    }

    public function receivableBalances()
    {
        return $this->hasMany(ProductionBalance::class, 'enterprise_user_id');
    }

    public function payableBalances()
    {
        return $this->hasMany(ProductionBalance::class, 'production_user_id');
    }

    // ── Scopes ─────────────────────────────────────────────────────

    public function scopeSuperAdmins($query)    { return $query->where('role', self::ROLE_SUPER_ADMIN); }
    public function scopeAdministrators($query) { return $query->where('role', self::ROLE_ADMINISTRATOR); }
    public function scopeManagers($query)       { return $query->where('role', self::ROLE_MANAGER); }
    public function scopeCashiers($query)       { return $query->where('role', self::ROLE_CASHIER); }
    public function scopeForBranch($query, int $branchId) { return $query->where('branch_id', $branchId); }
}
