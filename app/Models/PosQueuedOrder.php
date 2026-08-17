<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class PosQueuedOrder extends Model
{
    protected $fillable = [
        'ticket_number',
        'qr_token',
        'branch_id',
        'listed_by',
        'processed_by',
        'sale_id',
        'customer_name',
        'subtotal',
        'total',
        'status',
        'payment_status',
        'processed_at',
        'expires_at',
    ];

    protected $casts = [
        'subtotal' => 'decimal:2',
        'total' => 'decimal:2',
        'processed_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (PosQueuedOrder $order) {
            if (! $order->qr_token) {
                $order->qr_token = Str::upper(Str::random(10));
            }
            if (! $order->ticket_number) {
                $order->ticket_number = static::nextTicketNumber((int) $order->branch_id);
            }
            if (! $order->expires_at) {
                $order->expires_at = now()->addHours(12);
            }
        });
    }

    public static function nextTicketNumber(int $branchId): string
    {
        $prefix = 'Q' . now()->format('ymd') . '-';
        $count = static::where('branch_id', $branchId)->whereDate('created_at', today())->count() + 1;
        return $prefix . str_pad((string) $count, 4, '0', STR_PAD_LEFT);
    }

    public function branch(): BelongsTo { return $this->belongsTo(Branch::class); }
    public function listedBy(): BelongsTo { return $this->belongsTo(User::class, 'listed_by'); }
    public function processedBy(): BelongsTo { return $this->belongsTo(User::class, 'processed_by'); }
    public function sale(): BelongsTo { return $this->belongsTo(Sale::class); }
    public function items(): HasMany { return $this->hasMany(PosQueuedOrderItem::class); }

    public function isPending(): bool
    {
        return $this->status === 'pending'
            && ($this->payment_status ?? 'pending_payment') === 'pending_payment'
            && (! $this->expires_at || $this->expires_at->isFuture());
    }

    public function scopePendingPayment($query)
    {
        return $query
            ->where('status', 'pending')
            ->where('payment_status', 'pending_payment')
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()));
    }
}
