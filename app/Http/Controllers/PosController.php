<?php

namespace App\Http\Controllers;

use App\Models\CashSession;
use App\Models\Category;
use App\Models\DiningTable;
use App\Models\Product;
use App\Models\ProductBundle;
use App\Models\RecipeIngredient;
use App\Models\ProductStock;
use App\Models\PosQueuedOrder;
use App\Models\Promo;
use App\Models\Sale;
use App\Models\SystemSetting;
use App\Models\TableOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class PosController extends Controller
{
    private function authorizeSale(Sale $sale): void
    {
        $user = Auth::user();
        if ($user->isSuperAdmin() || $user->isAdministrator()) return;
        if ($sale->branch_id !== $user->branch_id) abort(403, 'Unauthorized access to this sale.');
    }

    // ─── POS Screen ───────────────────────────────────────────────────────────

    public function index(): Response
    {
        $user     = Auth::user();
        $branchId = $user->branch_id;

        if (! $branchId && ! $user->isSuperAdmin()) abort(403, 'No branch assigned.');

        $session = CashSession::where('branch_id', $branchId)
            ->where('user_id', $user->id)
            ->where('status', 'open')->latest()->first();

        // ── Load products for the POS screen ──────────────────────────────────
        //
        // Inclusion rules per product type:
        //   standard      → must have stock > 0 in this branch
        //   bundle        → always include (stock is virtual; components are checked at sale time)
        //   made_to_order → always include (ingredients are deducted at sale time, not the product itself)
        //
        // Variant products: a standard product whose base stock is 0 but whose
        //   variants have stock should still appear so the cashier can pick a variant.
        //   We include it and let the variant picker handle availability.

        $products = Product::query()
            ->with([
                'category:id,name',
                // Load stock without the >0 filter so we always get the price/capital row
                'stocks'                               => fn ($q) => $q->where('branch_id', $branchId),
                'variants'                             => fn ($q) => $q->where('is_available', true)
                    ->with(['stocks' => fn ($s) => $s->where('branch_id', $branchId)])
                    ->orderBy('sort_order'),
                'bundle.items.componentProduct:id,name',
                'bundle.items.componentVariant:id,name',
                'recipeIngredients.ingredient:id,name',
            ])
            ->where(fn ($q) => $q
                // Standard products: own stock > 0 in this branch
                ->where(fn ($inner) => $inner
                    ->where('product_type', 'standard')
                    ->whereHas('stocks', fn ($s) => $s
                        ->where('branch_id', $branchId)
                        ->where('stock', '>', 0)
                        ->where(fn ($x) => $x->whereNull('expiry_date')->orWhereDate('expiry_date', '>=', today()))
                    )
                )
                // Variant products: base stock may be 0 — include if any available variant exists
                // (variant stock is tracked at sale; we show the product so the cashier can pick)
                ->orWhere(fn ($inner) => $inner
                    ->where('product_type', 'standard')
                    ->whereHas('variants', fn ($v) => $v->where('is_available', true))
                    // Still require a stock record so we have a price
                    ->whereHas('stocks', fn ($s) => $s->where('branch_id', $branchId))
                )
                // Bundle products: always show — stock deducted from components at sale time
                ->orWhere('product_type', 'bundle')
                // Made-to-order: always show — ingredients deducted from recipe at sale time
                ->orWhere('product_type', 'made_to_order')
            )
            ->where('product_type', '!=', 'ingredient')
            ->whereHas('stocks', fn ($q) => $q->where('branch_id', $branchId))  // must have a price row
            ->latest()->get()
            ->map(fn (Product $p) => $this->mapProduct($p, $branchId))
            ->values();

        $categories = Category::select('id', 'name')
            ->where('is_active', true)->orderBy('name')->get();

        $promos = Promo::tableExists()
            ? Promo::with(['products:id', 'categories:id'])->active()->get()
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
                ])->values()
            : collect();

        $openTableOrders = [];
        $diningTables    = [];

        if ($user->branch?->usesTableOrdering()) {
            $openTableOrders = TableOrder::with('table:id,table_number,section')
                ->where('branch_id', $branchId)->whereIn('status', ['open', 'billed'])->get()
                ->map(fn ($to) => [
                    'id' => $to->id, 'table_id' => $to->table_id,
                    'table_number' => $to->table?->table_number,
                    'section' => $to->table?->section,
                    'label' => $to->table?->label ?? "Table {$to->table?->table_number}",
                    'status' => $to->status, 'total' => (float) $to->total,
                    'customer_name' => $to->customer_name,
                ])->values();

            $diningTables = DiningTable::where('branch_id', $branchId)->where('is_active', true)
                ->orderBy('section')->orderBy('table_number')
                ->get(['id', 'table_number', 'section', 'capacity', 'status'])
                ->map(fn ($t) => [
                    'id' => $t->id, 'table_number' => $t->table_number, 'section' => $t->section,
                    'label' => $t->label ?? "Table {$t->table_number}", 'capacity' => $t->capacity, 'status' => $t->status,
                ])->values();
        }

        $pendingOrders = $user->canCollectPosPayments()
            ? PosQueuedOrder::with(['items.product', 'items.variant', 'listedBy'])
                ->where('branch_id', $branchId)
                ->pendingPayment()
                ->latest()
                ->limit(50)
                ->get()
                ->map(fn (PosQueuedOrder $order) => $this->mapQueuedOrder($order))
                ->values()
            : collect();

        return Inertia::render('Pos/Index', [
            'products'          => $products,
            'categories'        => $categories,
            'promos'            => $promos,
            'session'           => $session ? [
                'id' => $session->id, 'opening_cash' => (float) $session->opening_cash,
                'opened_at' => $session->opened_at?->toIso8601String(), 'status' => $session->status,
            ] : null,
            'branch'            => $user->branch ? [
                'id' => $user->branch->id, 'name' => $user->branch->name,
                'business_type' => $user->branch->business_type, 'feature_flags' => $user->branch->feature_flags,
            ] : null,
            'open_table_orders' => $openTableOrders,
            'dining_tables'     => $diningTables,
            'preferred_layout'  => $user->pos_layout ?? 'grid',
            'cashier_type'      => $user->cashier_type ?? 'counter_cashier',
            'can_collect_payments' => $user->canCollectPosPayments(),
            'pending_orders'    => $pendingOrders,
        ]);
    }

    // ─── Stock helpers ────────────────────────────────────────────────────────

    private function assertStockIsSellable(?ProductStock $stock, string $name): void
    {
        if ($stock?->expiry_date && $stock->expiry_date->isPast()) {
            throw new \RuntimeException("\"{$name}\" is expired and cannot be sold.");
        }
    }

    /**
     * Deduct stock for one product (standard, bundle, or MTO).
     * All relations must already be eager-loaded with lockForUpdate().
     */
    private function deductProductStock(Product $product, int $qty, int $branchId, bool $allowNeg): void
    {
        if ($product->product_type === 'bundle' && $product->bundle) {
            foreach ($product->bundle->items->where('is_required', true) as $bi) {
                $comp   = $bi->componentProduct;
                $cs     = $comp?->stocks->firstWhere('branch_id', $branchId);
                $needed = $bi->quantity * $qty;
                if (! $cs) throw new \RuntimeException("Bundle component \"{$comp?->name}\" has no stock in this branch.");
                $this->assertStockIsSellable($cs, $comp?->name ?? 'Bundle component');
                if (! $allowNeg && $cs->stock < $needed) throw new \RuntimeException("Insufficient stock for bundle component \"{$comp?->name}\". Need {$needed}, have {$cs->stock}.");
                $cs->decrement('stock', $needed);
            }
        } elseif ($product->product_type === 'made_to_order') {
            $recipes = $product->recipeIngredients;
            if ($recipes->isNotEmpty()) {
                foreach ($recipes as $recipe) {
                    $ing      = $recipe->ingredient;
                    $ingStock = $ing?->stocks->firstWhere('branch_id', $branchId);
                    $needed   = $recipe->quantityNeededFor($qty);
                    if (! $ingStock) throw new \RuntimeException("Ingredient \"{$ing?->name}\" has no stock in this branch.");
                    $this->assertStockIsSellable($ingStock, $ing?->name ?? 'Ingredient');
                    if (! $allowNeg && $ingStock->stock < $needed) throw new \RuntimeException("Insufficient stock for ingredient \"{$ing?->name}\". Need {$needed}, have {$ingStock->stock}.");
                    $ingStock->decrement('stock', $needed);
                }
            } else {
                $stock = $product->stocks->firstWhere('branch_id', $branchId) ?? $product->stocks->first();
                if (! $stock) throw new \RuntimeException("Product \"{$product->name}\" has no stock in this branch.");
                $this->assertStockIsSellable($stock, $product->name);
                if (! $allowNeg && $stock->stock < $qty) throw new \RuntimeException("Insufficient stock for \"{$product->name}\". Only {$stock->stock} left.");
                $stock->decrement('stock', $qty);
            }
        } else {
            $stock = $product->stocks->firstWhere('branch_id', $branchId) ?? $product->stocks->first();
            if (! $stock) throw new \RuntimeException("Product \"{$product->name}\" has no stock in this branch.");
            $this->assertStockIsSellable($stock, $product->name);
            if (! $allowNeg && $stock->stock < $qty) throw new \RuntimeException("Insufficient stock for \"{$product->name}\". Only {$stock->stock} left.");
            $stock->decrement('stock', $qty);
        }
    }

    private function deductVariantStock(\App\Models\ProductVariant $variant, int $qty, int $branchId, bool $allowNeg): void
    {
        $stock = $variant->stocks->firstWhere('branch_id', $branchId) ?? $variant->stocks->first();
        if (! $stock) throw new \RuntimeException("Variant \"{$variant->name}\" has no stock in this branch.");
        $this->assertStockIsSellable($stock, $variant->name);
        if (! $allowNeg && $stock->stock < $qty) throw new \RuntimeException("Insufficient stock for \"{$variant->name}\". Only {$stock->stock} left.");
        $stock->decrement('stock', $qty);
    }

    /**
     * Restore stock for a set of sale items — mirrors deductProductStock.
     * Items must be loaded with: product.stocks, product.bundle.items.componentProduct.stocks,
     * product.recipeIngredients.ingredient.stocks
     */
    private function restoreStockForItems(\Illuminate\Database\Eloquent\Collection $items, int $branchId): void
    {
        foreach ($items as $item) {
            if ($item->product_variant_id && $item->variant) {
                $variantStock = $item->variant->stocks->firstWhere('branch_id', $branchId);
                if ($variantStock) $variantStock->increment('stock', $item->quantity);
                continue;
            }

            $product = $item->product;
            if (! $product) continue;

            if ($product->product_type === 'bundle' && $product->bundle) {
                foreach ($product->bundle->items->where('is_required', true) as $bi) {
                    $cs = $bi->componentProduct?->stocks->firstWhere('branch_id', $branchId);
                    if ($cs) $cs->increment('stock', $bi->quantity * $item->quantity);
                }
            } elseif ($product->product_type === 'made_to_order') {
                $recipes = $product->recipeIngredients;
                if ($recipes->isNotEmpty()) {
                    foreach ($recipes as $recipe) {
                        $ingStock = $recipe->ingredient?->stocks->firstWhere('branch_id', $branchId);
                        if ($ingStock) $ingStock->increment('stock', $recipe->quantityNeededFor($item->quantity));
                    }
                } else {
                    $stock = $product->stocks->firstWhere('branch_id', $branchId);
                    if ($stock) $stock->increment('stock', $item->quantity);
                }
            } else {
                $stock = $product->stocks->firstWhere('branch_id', $branchId);
                if ($stock) $stock->increment('stock', $item->quantity);
            }
        }
    }

    // ─── Store (checkout) ─────────────────────────────────────────────────────

    public function queueOrder(Request $request): RedirectResponse
    {
        $user = Auth::user();
        $branchId = $user->branch_id;
        if (! $branchId) return back()->withErrors(['error' => 'No branch assigned.']);

        $validated = $request->validate([
            'items'              => ['required', 'array', 'min:1'],
            'items.*.id'         => ['required', 'exists:products,id'],
            'items.*.qty'        => ['required', 'integer', 'min:1'],
            'items.*.variant_id' => ['nullable', 'exists:product_variants,id'],
            'customer_name'      => ['nullable', 'string', 'max:80'],
        ]);

        try {
            $order = DB::transaction(function () use ($validated, $user, $branchId) {
                $allowNeg = (bool) SystemSetting::get('inventory.allow_negative_stock', $branchId, false);
                $subtotal = 0;
                $lines = [];

                foreach ($validated['items'] as $item) {
                    $product = Product::with([
                        'variants.stocks' => fn ($q) => $q->where('branch_id', $branchId),
                        'stocks' => fn ($q) => $q->where('branch_id', $branchId),
                    ])->findOrFail($item['id']);

                    $stock = $product->stocks->first();
                    $variant = ! empty($item['variant_id']) ? $product->variants->firstWhere('id', $item['variant_id']) : null;
                    $variantStock = $variant?->stocks->first();
                    $qty = (int) $item['qty'];

                    if (! empty($item['variant_id']) && ! $variant) {
                        throw new \RuntimeException("Selected variant is not available for \"{$product->name}\".");
                    }
                    if ($variant && ! $variantStock) {
                        throw new \RuntimeException("Variant \"{$variant->name}\" has no stock in this branch.");
                    }
                    if (! $variant && ! $stock && ! in_array($product->product_type, ['bundle', 'made_to_order'], true)) {
                        throw new \RuntimeException("Product \"{$product->name}\" has no stock in this branch.");
                    }
                    $this->assertStockIsSellable($variantStock ?? $stock, $variant?->name ?? $product->name);
                    if (! $allowNeg && $variantStock && $variantStock->stock < $qty) {
                        throw new \RuntimeException("Insufficient stock for \"{$variant->name}\". Only {$variantStock->stock} left.");
                    }
                    if (! $allowNeg && ! $variant && $stock && $stock->stock < $qty) {
                        throw new \RuntimeException("Insufficient stock for \"{$product->name}\". Only {$stock->stock} left.");
                    }

                    $unitPrice = (float) ($variantStock?->price ?? $stock?->price ?? 0);

                    $lineTotal = round($unitPrice * $qty, 2);
                    $subtotal += $lineTotal;
                    $lines[] = [
                        'product_id' => $product->id,
                        'product_variant_id' => $item['variant_id'] ?? null,
                        'quantity' => $qty,
                        'price' => $unitPrice,
                        'total' => $lineTotal,
                    ];
                }

                $order = PosQueuedOrder::create([
                    'branch_id' => $branchId,
                    'listed_by' => $user->id,
                    'customer_name' => $validated['customer_name'] ?? null,
                    'subtotal' => $subtotal,
                    'total' => $subtotal,
                    'status' => 'pending',
                    'payment_status' => 'pending_payment',
                ]);

                foreach ($lines as $line) $order->items()->create($line);

                return $order->load(['items.product', 'items.variant', 'listedBy']);
            });

            return back()->with('queued_order', $this->mapQueuedOrder($order));
        } catch (\Throwable $e) {
            return back()->withErrors(['error' => $e->getMessage() ?: 'Unable to queue order.']);
        }
    }

    public function queuedOrder(string $token): JsonResponse
    {
        $user = Auth::user();

        if (! $user->canCollectPosPayments()) {
            return response()->json(['message' => 'Order takers cannot collect payments for queued orders.'], 403);
        }

        $lookup = strtoupper(trim($token));

        $order = PosQueuedOrder::with(['items.product', 'items.variant', 'listedBy'])
            ->where(fn ($q) => $q
                ->where('qr_token', $lookup)
                ->orWhere('ticket_number', $lookup)
            )
            ->first();

        if (! $order || $order->branch_id !== $user->branch_id) {
            return response()->json(['message' => 'Queued order not found.'], 404);
        }

        if (! $order->isPending()) {
            return response()->json(['message' => 'This queued order is no longer pending.'], 422);
        }

        return response()->json(['order' => $this->mapQueuedOrder($order)]);
    }

    public function cancelQueuedOrder(PosQueuedOrder $order): RedirectResponse
    {
        $user = Auth::user();

        if (! $user->canCollectPosPayments()) {
            return back()->withErrors(['error' => 'Only counter cashiers can remove pending payment orders.']);
        }

        if ($order->branch_id !== $user->branch_id) {
            abort(403, 'Unauthorized access to this queued order.');
        }

        if (! $order->isPending()) {
            return back()->withErrors(['error' => 'This queued order is no longer pending.']);
        }

        $order->update([
            'status' => 'cancelled',
            'payment_status' => 'cancelled',
            'processed_by' => $user->id,
            'processed_at' => now(),
        ]);

        return back()->with('success', 'Pending order removed.');
    }

    public function store(Request $request): RedirectResponse
    {
        $user     = Auth::user();
        $branchId = $user->branch_id;

        if (! $branchId) return back()->withErrors(['error' => 'No branch assigned.']);

        if (! $user->canCollectPosPayments()) {
            return back()->withErrors(['error' => 'Order takers can only send orders to Pending Payment. A counter cashier must collect payment.']);
        }

        // Enforce cash session requirement — tied to the cashier's own session
        $requireSession = (bool) SystemSetting::get('pos.require_cash_session', $branchId, true);
        $openSession = \App\Models\CashSession::where('branch_id', $branchId)
            ->where('user_id', $user->id)
            ->open()
            ->first();
        if ($requireSession && ! $openSession) {
            return back()->withErrors(['error' => 'No open cash session. Please open a cash session before processing sales.']);
        }

        $validated = $request->validate([
            'items'              => ['required', 'array', 'min:1'],
            'items.*.id'         => ['required', 'exists:products,id'],
            'items.*.qty'        => ['required', 'integer', 'min:1'],
            'items.*.variant_id' => ['nullable', 'exists:product_variants,id'],
            'payment_method'     => ['required', 'in:cash,gcash,card,others,installment'],
            'payment_amount'     => ['nullable', 'numeric', 'min:0'],
            'customer_name'      => ['nullable', 'string', 'max:80'],
            'discount_percent'   => ['nullable', 'numeric', 'between:0,100'],
            'promo_id'           => ['nullable', 'exists:promos,id'],
            'cash_session_id'    => ['nullable', 'exists:cash_sessions,id'],
            'table_order_id'     => ['nullable', 'exists:table_orders,id'],
            'queued_order_id'    => ['nullable', 'exists:pos_queued_orders,id'],
            // Financing / installment fields (used when payment_method = installment)
            'installment_provider'        => ['nullable', 'in:home_credit,skyro,other'],
            'installment_reference'       => ['nullable', 'string', 'max:100'],
            'installment_customer_phone'  => ['nullable', 'string', 'max:30'],
            'installment_down_payment'    => ['nullable', 'numeric', 'min:0'],
            'installments_count'          => ['nullable', 'integer', 'between:1,36'],
            'installment_notes'           => ['nullable', 'string', 'max:500'],
        ]);

        // Extra validation for installment/financing payment
        if ($validated['payment_method'] === 'installment') {
            if (empty($validated['customer_name'])) {
                return back()->withErrors(['error' => 'Customer name is required for financed sales.']);
            }
            if (empty($validated['installment_provider'])) {
                return back()->withErrors(['error' => 'Financing provider (Home Credit / Skyro) is required.']);
            }
        }

        try {
            $result = DB::transaction(function () use ($validated, $user, $branchId, $openSession) {
                $queuedOrder = null;
                if (! empty($validated['queued_order_id'])) {
                    $queuedOrder = PosQueuedOrder::where('id', $validated['queued_order_id'])
                        ->where('branch_id', $branchId)
                        ->with(['items'])
                        ->lockForUpdate()
                        ->firstOrFail();

                    if (! $queuedOrder->isPending()) {
                        throw new \RuntimeException('This queued order has already been processed or expired.');
                    }
                }

                $allowNeg = (bool) SystemSetting::get('inventory.allow_negative_stock', $branchId, false);
                $subtotal         = 0;
                $taxableSubtotal  = 0;
                $saleItems        = [];

                foreach ($validated['items'] as $item) {
                    $product = Product::with([
                        'variants.stocks' => fn ($q) => $q->where('branch_id', $branchId)->lockForUpdate(),
                        'stocks'                                => fn ($q) => $q->where('branch_id', $branchId)->lockForUpdate(),
                        'bundle.items.componentProduct.stocks'  => fn ($q) => $q->where('branch_id', $branchId)->lockForUpdate(),
                        'recipeIngredients.ingredient.stocks'   => fn ($q) => $q->where('branch_id', $branchId)->lockForUpdate(),
                    ])->findOrFail($item['id']);

                    $stock        = $product->stocks->first();
                    $saleQty      = (int) $item['qty'];
                    $variant      = ! empty($item['variant_id']) ? $product->variants->firstWhere('id', $item['variant_id']) : null;
                    $variantStock = $variant?->stocks->first();

                    // ── Resolve variant price add-on ───────────────────────
                    if (! empty($item['variant_id']) && ! $variant) {
                        throw new \RuntimeException("Selected variant is not available for \"{$product->name}\".");
                    }

                    $unitPrice = (float) ($variantStock?->price ?? $stock?->price ?? 0);

                    // ── Deduct stock based on product type ─────────────────
                    if ($variant) {
                        $this->deductVariantStock($variant, $saleQty, $branchId, $allowNeg);
                    } else {
                        $this->deductProductStock($product, $saleQty, $branchId, $allowNeg);
                    }

                    $line      = round($unitPrice * $saleQty, 2);
                    $subtotal += $line;
                    if ($product->is_taxable) {
                        $taxableSubtotal += $line;
                    }
                    $saleItems[] = [
                        'product_id'         => $item['id'],
                        'product_variant_id' => $item['variant_id'] ?? null,
                        'quantity'           => $saleQty,
                        'price'              => $unitPrice,
                        'total'              => $line,
                    ];
                }

                // Percentage discount
                $maxDisc  = (float) SystemSetting::get('pos.max_discount_percent', $branchId, 100);
                $discPct  = min((float) ($validated['discount_percent'] ?? 0), $maxDisc);
                $discAmt  = round($subtotal * ($discPct / 100), 2);

                // Promo discount
                $promoAmt   = 0;
                $promoLabel = null;
                if (! empty($validated['promo_id'])) {
                    $promo = Promo::find($validated['promo_id']);
                    if ($promo && $promo->isValid()) {
                        $promoAmt   = $promo->computeDiscount($subtotal - $discAmt);
                        $promoLabel = "{$promo->name}" . ($promo->code ? " [{$promo->code}]" : '');
                        $promo->increment('uses_count');
                    }
                }

                $afterDisc = round($subtotal - $discAmt - $promoAmt, 2);

                // VAT — only applied to taxable items' portion of the total
                $vatEnabled   = (bool)  SystemSetting::get('tax.vat_enabled',   $branchId, false);
                $vatRate      = (float) SystemSetting::get('tax.vat_rate',       $branchId, 0);
                $vatInclusive = (bool)  SystemSetting::get('tax.vat_inclusive',  $branchId, true);
                // Compute how much of the post-discount total is taxable (proportional)
                $taxableFraction     = $subtotal > 0 ? ($taxableSubtotal / $subtotal) : 0;
                $taxableAfterDisc    = round($afterDisc * $taxableFraction, 2);
                $vatAmt              = ($vatEnabled && $vatRate > 0 && ! $vatInclusive)
                    ? round($taxableAfterDisc * ($vatRate / 100), 2) : 0;

                $totalDue       = $afterDisc + $vatAmt;
                $isInstallment  = $validated['payment_method'] === 'installment';
                $downPayment    = $isInstallment ? (float) ($validated['installment_down_payment'] ?? 0) : null;
                $paid           = $isInstallment ? ($downPayment ?? 0) : (float) ($validated['payment_amount'] ?? $totalDue);
                $change         = $isInstallment ? 0 : max(0, round($paid - $totalDue, 2));

                $notes = implode(' | ', array_filter([
                    $discPct > 0   ? "Discount {$discPct}% (−₱" . number_format($discAmt, 2) . ")"        : null,
                    $promoAmt > 0  ? "Promo {$promoLabel}: −₱" . number_format($promoAmt, 2)              : null,
                    $vatAmt > 0    ? "VAT {$vatRate}%: ₱" . number_format($vatAmt, 2)                     : null,
                ]));

                $sale = Sale::create([
                    'receipt_number'  => $this->generateReceiptNumber($branchId),
                    'user_id'         => $user->id,
                    'order_created_by' => $queuedOrder?->listed_by ?? $user->id,
                    'payment_received_by' => $user->id,
                    'branch_id'       => $branchId,
                    'cash_session_id' => $openSession?->id ?? $validated['cash_session_id'] ?? null,
                    'table_order_id'  => $validated['table_order_id']  ?? null,
                    'payment_method'  => $validated['payment_method'],
                    'payment_amount'  => $paid,
                    'change_amount'   => $change,
                    'discount_amount' => $discAmt + $promoAmt,
                    'customer_name'   => $validated['customer_name'] ?? null,
                    'status'          => 'completed',
                    'total'           => $totalDue,
                    'notes'           => $notes ?: null,
                ]);

                foreach ($saleItems as $data) $sale->items()->create($data);

                if (! empty($validated['table_order_id'])) {
                    TableOrder::where('id', $validated['table_order_id'])
                        ->update(['status' => 'closed', 'sale_id' => $sale->id]);
                }

                if ($queuedOrder) {
                    $queuedOrder->update([
                        'status' => 'processed',
                        'payment_status' => 'paid',
                        'processed_by' => $user->id,
                        'sale_id' => $sale->id,
                        'processed_at' => now(),
                    ]);
                }

                // ── Create financing record if payment method is installment ──
                $installmentPlanId = null;
                if ($isInstallment) {
                    $downPaymentAmt = max(0, (float) ($validated['installment_down_payment'] ?? 0));
                    $balance        = round($totalDue - $downPaymentAmt, 2);
                    $instCount      = max(1, (int) ($validated['installments_count'] ?? 3));
                    $instAmount     = $instCount > 0 ? round($balance / $instCount, 2) : $balance;

                    $plan = \App\Models\InstallmentPlan::create([
                        'sale_id'            => $sale->id,
                        'branch_id'          => $branchId,
                        'user_id'            => $user->id,
                        'provider'           => $validated['installment_provider'] ?? 'other',
                        'reference_number'   => $validated['installment_reference'] ?? null,
                        'customer_name'      => $validated['customer_name'],
                        'customer_phone'     => $validated['installment_customer_phone'] ?? null,
                        'total_amount'       => $totalDue,
                        'down_payment'       => $downPaymentAmt,
                        'balance'            => $balance,
                        'installment_amount' => $instAmount,
                        'total_paid'         => 0,
                        'installments_count' => $instCount,
                        'paid_count'         => 0,
                        'interval'           => 'monthly',
                        'next_due_date'      => $balance > 0 ? now()->addMonth() : null,
                        'status'             => $balance > 0 ? 'active' : 'completed',
                        'notes'              => $validated['installment_notes'] ?? null,
                    ]);

                    $installmentPlanId = $plan->id;
                }

                return [
                    'sale_id'            => $sale->id,
                    'receipt_number'     => $sale->receipt_number,
                    'total'              => $totalDue,
                    'change'             => $change,
                    'discount_amount'    => $discAmt,
                    'promo_discount'     => $promoAmt,
                    'promo_name'         => $promoLabel,
                    'vat_amount'         => $vatAmt,
                    'installment_plan_id'=> $installmentPlanId,
                    'is_installment'     => $isInstallment,
                    'down_payment'       => $isInstallment ? ($downPayment ?? 0) : null,
                    'queued_order_id'    => $queuedOrder?->id,
                    'hide_product_names' => (bool) SystemSetting::get('receipt.hide_product_names', $branchId, false),
                ];
            });

            return back()->with('pos_result', $result);

        } catch (\Throwable $e) {
            return back()->withErrors(['error' => $e->getMessage() ?: 'Checkout failed.']);
        }
    }

    // ─── Show ─────────────────────────────────────────────────────────────────

    public function show(Sale $sale): Response
    {
        $this->authorizeSale($sale);
        $sale->load(['items.product', 'items.variant', 'user', 'orderCreator', 'paymentReceiver', 'branch', 'cashSession', 'tableOrder.table']);
        return Inertia::render('Pos/Show', ['sale' => $this->mapSale($sale)]);
    }

    // ─── History ──────────────────────────────────────────────────────────────

    public function history(Request $request): Response
    {
        $user     = Auth::user();
        $branchId = $user->branch_id;
        $isAdmin  = $user->isAdmin();
        $today    = today()->toDateString();

        // Cashiers are always locked to today; admins default to today on first visit
        $from = $isAdmin ? ($request->input('from') ?? $today) : $today;
        $to   = $isAdmin ? ($request->input('to')   ?? $today) : $today;

        $search = $request->input('search');
        $status = $request->input('status');
        $method = $request->input('payment_method');

        $query = Sale::with(['items.product', 'items.variant', 'user', 'orderCreator', 'paymentReceiver', 'tableOrder.table'])
            ->where('branch_id', $branchId)
            ->whereDate('created_at', '>=', $from)
            ->whereDate('created_at', '<=', $to)
            ->orderByDesc('created_at');

        if ($search) $query->where(fn ($q) => $q->where('receipt_number', 'like', "%{$search}%")->orWhere('customer_name', 'like', "%{$search}%"));
        if ($status) $query->where('status', $status);
        if ($method) $query->where('payment_method', $method);

        $sales = $query->paginate(25)->withQueryString();

        $base = Sale::where('branch_id', $branchId)->completed()
            ->whereDate('created_at', '>=', $from)
            ->whereDate('created_at', '<=', $to);

        $branch = Auth::user()->branch;

        return Inertia::render('Pos/History', [
            'sales'    => $sales->through(fn ($s) => $this->mapSale($s, brief: true)),
            'summary'  => [
                // For installment sales only the down-payment was collected at POS; use payment_amount for those
                'total_sales'       => (float) (clone $base)
                    ->selectRaw('SUM(CASE WHEN payment_method = "installment" THEN payment_amount ELSE total END) as collected')
                    ->value('collected')
                    + \App\Models\InstallmentPayment::totalsForRange($from, $to, $branchId)['total'],
                'total_count'       => $base->count(),
                'cash_total'        => (float) (clone $base)->where('payment_method', 'cash')->sum('total'),
                'gcash_total'       => (float) (clone $base)->where('payment_method', 'gcash')->sum('total'),
                'card_total'        => (float) (clone $base)->where('payment_method', 'card')->sum('total'),
                'installment_dp'    => (float) (clone $base)->where('payment_method', 'installment')->sum('payment_amount'),
                'remittance_total'  => \App\Models\InstallmentPayment::totalsForRange($from, $to, $branchId)['total'],
                'discount_total'    => (float) (clone $base)->sum('discount_amount'),
            ],
            'filters'  => [
                'search'         => $search,
                'status'         => $status,
                'payment_method' => $method,
                'from'           => $from,
                'to'             => $to,
            ],
            'branch'   => $branch ? [
                'id'            => $branch->id,
                'name'          => $branch->name,
                'business_type' => $branch->business_type,
            ] : null,
            'is_admin' => $isAdmin,
        ]);
    }

    // ─── Edit ─────────────────────────────────────────────────────────────────

    public function edit(Sale $sale): Response
    {
        $this->authorizeSale($sale);
        $user = Auth::user();
        if ($sale->created_at->isBefore(today()) && ! $user->isAdmin()) abort(403, 'You can only edit sales made today.');

        $sale->load(['items.product', 'items.variant']);
        $branchId = $user->branch_id;

        $products = Product::query()
            ->with([
                'category:id,name',
                'stocks' => fn ($q) => $q->where('branch_id', $branchId),
                'variants' => fn ($q) => $q->where('is_available', true)
                    ->with(['stocks' => fn ($s) => $s->where('branch_id', $branchId)])
                    ->orderBy('sort_order'),
            ])
            ->whereHas('stocks', fn ($q) => $q->where('branch_id', $branchId))
            ->get()->map(fn ($p) => $this->mapProduct($p, $branchId))->values();

        return Inertia::render('Pos/Edit', ['sale' => $this->mapSale($sale), 'products' => $products]);
    }

    // ─── Update ───────────────────────────────────────────────────────────────

    public function update(Request $request, Sale $sale): RedirectResponse
    {
        $this->authorizeSale($sale);
        $user     = Auth::user();
        $branchId = $user->branch_id;

        if ($sale->created_at->isBefore(today()) && ! $user->isAdmin()) return back()->withErrors(['error' => "Only today's sales can be edited."]);

        if (! $user->canCollectPosPayments()) {
            return back()->withErrors(['error' => 'Order takers cannot edit paid sales or payment details.']);
        }

        $validated = $request->validate([
            'items'              => ['required', 'array', 'min:1'],
            'items.*.id'         => ['required', 'exists:products,id'],
            'items.*.qty'        => ['required', 'integer', 'min:1'],
            'items.*.variant_id' => ['nullable', 'exists:product_variants,id'],
            'payment_method'     => ['required', 'in:cash,gcash,card,others'],
            'payment_amount'     => ['nullable', 'numeric', 'min:0'],
            'customer_name'      => ['nullable', 'string', 'max:80'],
            'discount_percent'   => ['nullable', 'numeric', 'between:0,100'],
        ]);

        try {
            DB::transaction(function () use ($sale, $validated, $branchId) {
                $allowNeg = (bool) SystemSetting::get('inventory.allow_negative_stock', $branchId, false);

                // Restore old stock (type-aware for bundles and MTO)
                $sale->load([
                    'items.product.stocks',
                    'items.variant.stocks',
                    'items.product.bundle.items.componentProduct.stocks',
                    'items.product.recipeIngredients.ingredient.stocks',
                ]);
                $this->restoreStockForItems($sale->items, $branchId);
                $sale->items()->delete();

                $subtotal = 0;
                $saleItems = [];

                foreach ($validated['items'] as $item) {
                    $product = Product::with([
                        'variants.stocks' => fn ($q) => $q->where('branch_id', $branchId)->lockForUpdate(),
                        'stocks'                               => fn ($q) => $q->where('branch_id', $branchId)->lockForUpdate(),
                        'bundle.items.componentProduct.stocks' => fn ($q) => $q->where('branch_id', $branchId)->lockForUpdate(),
                        'recipeIngredients.ingredient.stocks'  => fn ($q) => $q->where('branch_id', $branchId)->lockForUpdate(),
                    ])->findOrFail($item['id']);

                    $stock        = $product->stocks->firstWhere('branch_id', $branchId) ?? $product->stocks->first();
                    $saleQty      = (int) $item['qty'];
                    $variant      = ! empty($item['variant_id']) ? $product->variants->firstWhere('id', $item['variant_id']) : null;
                    $variantStock = $variant?->stocks->first();

                    if (! empty($item['variant_id']) && ! $variant) {
                        throw new \RuntimeException("Selected variant is not available for \"{$product->name}\".");
                    }

                    $unitPrice = (float) ($variantStock?->price ?? $stock?->price ?? 0);

                    if ($variant) {
                        $this->deductVariantStock($variant, $saleQty, $branchId, $allowNeg);
                    } else {
                        $this->deductProductStock($product, $saleQty, $branchId, $allowNeg);
                    }

                    $lt = round($unitPrice * $saleQty, 2);
                    $subtotal += $lt;
                    $saleItems[] = ['product_id' => $item['id'], 'product_variant_id' => $item['variant_id'] ?? null, 'quantity' => $saleQty, 'price' => $unitPrice, 'total' => $lt];
                }

                $discPct = (float) ($validated['discount_percent'] ?? 0);
                $discAmt = round($subtotal * ($discPct / 100), 2);
                $total   = round($subtotal - $discAmt, 2);
                $paid    = (float) ($validated['payment_amount'] ?? $total);

                $sale->update([
                    'payment_method' => $validated['payment_method'], 'payment_amount' => $paid,
                    'change_amount'  => max(0, round($paid - $total, 2)), 'discount_amount' => $discAmt,
                    'customer_name'  => $validated['customer_name'] ?? null, 'total' => $total,
                    'notes'          => $discPct > 0 ? "Discount {$discPct}% (−₱" . number_format($discAmt, 2) . ")" : null,
                ]);

                foreach ($saleItems as $data) {
                    $sale->items()->create($data);
                }
            });

            return redirect()->route('pos.show', $sale->id)->with('success', 'Sale updated.');

        } catch (\Throwable $e) {
            return back()->withErrors(['error' => $e->getMessage()]);
        }
    }

    // ─── Void ─────────────────────────────────────────────────────────────────

    public function void(Request $request, Sale $sale): RedirectResponse
    {
        $this->authorizeSale($sale);
        if ($sale->isVoided()) return back()->withErrors(['error' => 'Already voided.']);

        $user = Auth::user();
        if ($sale->created_at->isBefore(today()) && ! $user->isAdmin()) return back()->withErrors(['error' => "Only today's sales can be voided."]);

        DB::transaction(function () use ($sale, $user, $request) {
            $branchId = $sale->branch_id;

            // Load items with all relations needed for type-aware stock restore
            $sale->load([
                'items.product.stocks',
                'items.variant.stocks',
                'items.product.bundle.items.componentProduct.stocks',
                'items.product.recipeIngredients.ingredient.stocks',
            ]);

            $this->restoreStockForItems($sale->items, $branchId);

            if ($sale->table_order_id) {
                TableOrder::where('id', $sale->table_order_id)->where('sale_id', $sale->id)->update(['status' => 'open', 'sale_id' => null]);
            }
            $sale->update(['status' => 'voided', 'notes' => trim(($sale->notes ?? '') . ' | Voided: ' . ($request->input('reason', 'No reason provided')))]);
        });

        return back()->with('success', 'Sale voided and stock restored.');
    }

    // ─── Barcode lookup ───────────────────────────────────────────────────────

    public function lookupBarcode(Request $request): JsonResponse
    {
        $barcode  = $request->string('barcode');
        $branchId = Auth::user()->branch_id;

        $product = Product::with([
            'stocks'   => fn ($q) => $q->where('branch_id', $branchId),
            'variants' => fn ($q) => $q->where('is_available', true)
                ->with(['stocks' => fn ($s) => $s->where('branch_id', $branchId)]),
            'category:id,name',
            'bundle.items.componentProduct:id,name',
            'recipeIngredients.ingredient:id,name',
        ])->where('barcode', $barcode)->first();

        if (! $product) return response()->json(['found' => false, 'message' => 'Product not found.'], 404);

        return response()->json(['found' => true, 'product' => $this->mapProduct($product, $branchId)]);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private function mapProduct(Product $p, int $branchId): array
    {
        $stock = $p->stocks->firstWhere('branch_id', $branchId) ?? $p->stocks->first();
        $variantStockTotal = $p->variants
            ->flatMap(fn ($v) => $v->stocks)
            ->where('branch_id', $branchId)
            ->sum('stock');

        // ── Determine the effective "stock" number shown on the POS card ──────
        //
        // standard   → own stock count in this branch
        // bundle     → 999 (virtual; components checked at checkout)
        // made_to_order → 999 (ingredients checked at checkout; no own stock row)
        // variant product → sum of available variant stocks (approximate; real
        //                   variant stock lives in product_variant_stocks but we
        //                   use the base stock row as a price anchor)
        $displayStock = match ($p->product_type) {
            'bundle', 'made_to_order' => 999,
            default                   => $variantStockTotal > 0 ? (int) $variantStockTotal : (int) ($stock?->stock ?? 0),
        };

        return [
            'id'           => $p->id,
            'name'         => $p->name,
            'barcode'      => $p->barcode,
            'product_img'  => $p->product_img ? asset('storage/' . $p->product_img) : null,
            'product_type' => $p->product_type,
            'is_taxable'   => (bool) $p->is_taxable,
            'price'        => (float) ($stock?->price ?? 0),
            'base_stock'   => (int) ($stock?->stock ?? 0),
            'stock'        => $displayStock,
            'category'     => $p->category ? ['id' => $p->category->id, 'name' => $p->category->name] : null,
            'variants'     => $p->variants->map(function ($v) use ($branchId, $stock) {
                $variantStock = $v->stocks->firstWhere('branch_id', $branchId) ?? $v->stocks->first();
                $basePrice = (float) ($stock?->price ?? 0);
                $variantPrice = $variantStock ? (float) $variantStock->price : null;

                return [
                    'id'          => $v->id,
                    'name'        => $v->name,
                    'extra_price' => $variantPrice !== null ? round($variantPrice - $basePrice, 2) : (float) $v->extra_price,
                    'price'       => $variantPrice,
                    'stock'       => (int) ($variantStock?->stock ?? 0),
                    'attributes'  => $v->attributes ?? [],
                    'is_available'=> $v->is_available,
                    'expiry_date' => $variantStock?->expiry_date?->toDateString(),
                    'is_expired'  => (bool) ($variantStock?->expiry_date?->isPast() ?? false),
                ];
            })->values(),
            'has_variants' => $p->variants->count() > 0,
            // Bundle components — info shown on POS card
            'bundle_items' => $p->bundle
                ? $p->bundle->items->map(fn ($i) => [
                    'name'     => $i->componentProduct?->name ?? '?',
                    'qty'      => $i->quantity,
                    'required' => $i->is_required,
                ])->values()
                : null,
            // Recipe ingredients — info shown for MTO products
            'recipe_items' => $p->recipeIngredients?->count() > 0
                ? $p->recipeIngredients->map(fn ($r) => [
                    'name'     => $r->ingredient?->name ?? '?',
                    'quantity' => $r->quantity,
                    'unit'     => $r->unit,
                ])->values()
                : null,
            'expiry_date'    => $stock?->expiry_date?->toDateString(),
            'batch_number'   => $stock?->batch_number,
            'is_expired'     => (bool) ($stock?->expiry_date?->isPast() ?? false),
            'is_near_expiry' => (bool) ($stock?->isNearExpiry() ?? false),
        ];
    }

    private function mapQueuedOrder(PosQueuedOrder $order): array
    {
        return [
            'id'            => $order->id,
            'ticket_number' => $order->ticket_number,
            'qr_token'      => $order->qr_token,
            'customer_name' => $order->customer_name,
            'status'        => $order->status,
            'subtotal'      => (float) $order->subtotal,
            'total'         => (float) $order->total,
            'expires_at'    => $order->expires_at?->toIso8601String(),
            'payment_status'=> $order->payment_status ?? 'pending_payment',
            'created_at'    => $order->created_at?->toIso8601String(),
            'listed_by'     => $order->listedBy ? trim("{$order->listedBy->fname} {$order->listedBy->lname}") : null,
            'items'         => $order->items->map(fn ($item) => [
                'product_id'   => $item->product_id,
                'variant_id'   => $item->product_variant_id,
                'product_name' => $item->product?->name ?? 'Unknown',
                'variant_name' => $item->variant?->name,
                'quantity'     => (int) $item->quantity,
                'price'        => (float) $item->price,
                'total'        => (float) $item->total,
            ])->values(),
        ];
    }

    private function mapSale(Sale $sale, bool $brief = false): array
    {
        $hideProductNames = (bool) SystemSetting::get('receipt.hide_product_names', $sale->branch_id, false);

        $base = [
            'id'              => $sale->id,
            'receipt_number'  => $sale->receipt_number,
            'status'          => $sale->status,
            'payment_method'  => $sale->payment_method,
            'payment_amount'  => (float) $sale->payment_amount,
            'change_amount'   => (float) $sale->change_amount,
            'discount_amount' => (float) $sale->discount_amount,
            'total'           => (float) $sale->total,
            'customer_name'   => $sale->customer_name,
            'notes'           => $sale->notes,
            'created_at'      => $sale->created_at?->toIso8601String(),
            'cashier'         => $sale->paymentReceiver
                ? trim("{$sale->paymentReceiver->fname} {$sale->paymentReceiver->lname}")
                : ($sale->user ? trim("{$sale->user->fname} {$sale->user->lname}") : 'Unknown'),
            'order_created_by' => $sale->orderCreator
                ? trim("{$sale->orderCreator->fname} {$sale->orderCreator->lname}")
                : ($sale->user ? trim("{$sale->user->fname} {$sale->user->lname}") : 'Unknown'),
            'payment_received_by' => $sale->paymentReceiver
                ? trim("{$sale->paymentReceiver->fname} {$sale->paymentReceiver->lname}")
                : ($sale->user ? trim("{$sale->user->fname} {$sale->user->lname}") : 'Unknown'),
            'table_order_id'  => $sale->table_order_id,
            'table_label'     => $sale->tableOrder?->table?->label,
            'hide_product_names' => $hideProductNames,
        ];

        $base['items'] = $brief
            ? $sale->items->map(fn ($i) => ['product_name' => $i->product?->name ?? '(deleted)', 'variant_name' => $i->variant?->name, 'quantity' => (int) $i->quantity, 'price' => (float) $i->price])->values()
            : $sale->items->map(fn ($i) => ['id' => $i->id, 'product_id' => $i->product_id, 'product_variant_id' => $i->product_variant_id, 'product_name' => $i->product?->name ?? '(deleted)', 'variant_name' => $i->variant?->name, 'quantity' => (int) $i->quantity, 'price' => (float) $i->price, 'total' => (float) $i->total])->values();

        if ($brief) $base['item_count'] = $sale->items->count();
        return $base;
    }

    private function generateReceiptNumber(int $branchId): string
    {
        $code  = Auth::user()->branch?->code ?? 'POS';
        $date  = now()->format('ymd');
        $count = Sale::where('branch_id', $branchId)->whereDate('created_at', today())->count() + 1;
        return strtoupper("{$code}-{$date}-" . str_pad($count, 4, '0', STR_PAD_LEFT));
    }
}
