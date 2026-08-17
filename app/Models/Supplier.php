<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Supplier extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'is_campus',
        'phone',
        'address',
        'contact_person',
    ];

    protected $casts = [
        'is_campus' => 'boolean',
    ];

    // ── Relationships ──────────────────────────────────────────────

    /** Orders placed WITH this supplier (as the selling party) */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /** GRNs where this supplier was the delivering party */
    public function goodsReceivedNotes(): HasMany
    {
        return $this->hasMany(GoodsReceivedNote::class);
    }

    // ── Helpers ────────────────────────────────────────────────────

    public function isCampus(): bool { return (bool) $this->is_campus; }

    // ── Scopes ─────────────────────────────────────────────────────

    public function scopeCampus($query)    { return $query->where('is_campus', true); }
    public function scopeNonCampus($query) { return $query->where('is_campus', false); }

    // ── Accessors ──────────────────────────────────────────────────

}
