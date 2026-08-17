"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { usePage, router } from "@inertiajs/react";
import AdminLayout from "@/layouts/AdminLayout";
import ReceiptTemplate, { fmtMoney, ReceiptData } from "./ReceiptTemplate";
import { routes } from "@/routes";
import { cn } from "@/lib/utils";
import {
    Search, X, Plus, Minus, Trash2, ShoppingCart, Tag,
    CreditCard, Banknote, Smartphone, CheckCircle2,
    AlertTriangle, Package, History, ScanLine,
    RefreshCw, Zap, User, ChevronDown,
    UtensilsCrossed, Scissors, Clock, Table2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Variant {
    id: number; name: string; extra_price: number;
    attributes: Record<string, string>; is_available: boolean;
}
interface BundleItem { name: string; qty: number; required: boolean; }
interface RecipeItem  { name: string; quantity: number; unit: string; }
interface ActivePromo {
    id: number; name: string; code: string | null;
    discount_type: 'percent' | 'fixed'; discount_value: number;
    applies_to: 'all' | 'specific_products' | 'specific_categories';
    minimum_purchase: number | null;
    product_ids: number[]; category_ids: number[];
    expires_at: string | null;
}
interface Product {
    id: number; name: string; barcode: string | null;
    product_img: string | null; product_type: string;
    price: number; stock: number;
    category: { id: number; name: string } | null;
    variants: Variant[]; has_variants: boolean;
    bundle_items: BundleItem[] | null;
    recipe_items: RecipeItem[] | null;
}
interface Category { id: number; name: string; }
interface Session  { id: number; opening_cash: number; opened_at: string; status: string; }
interface Branch   { id: number; name: string; business_type: string; feature_flags: Record<string, boolean>; }
interface TableOrder {
    id: number; table_number: number | null; section: string | null;
    label: string; status: string; total: number; customer_name: string | null;
}
interface DiningTable {
    id: number; table_number: number; section: string | null;
    label: string; capacity: number; status: string;
}
interface CartItem {
    key: string; product_id: number; variant_id: number | null;
    name: string; variant_name: string | null;
    price: number; qty: number; stock: number;
    product_type: string;
    bundle_items: BundleItem[] | null;
    recipe_items: RecipeItem[] | null;
}
interface PageProps {
    auth:     { user: { fname: string; lname: string; role_label: string } | null };
    settings: {
        allow_discount: boolean; max_discount_percent: number;
        default_payment: string; vat_enabled: boolean;
        vat_rate: number; vat_inclusive: boolean;
        require_cash_session: boolean;
    } | null;
    app:               { currency: string };
    products:          Product[];
    categories:        Category[];
    session:           Session | null;
    branch:            Branch | null;
    open_table_orders:  TableOrder[];
    dining_tables:      DiningTable[];
    preferred_layout:   string;
    promos:             ActivePromo[];
    [key: string]: unknown;
}

type PayMethod  = "cash" | "gcash" | "card" | "others";
type LayoutMode = "grid" | "tablet" | "grocery" | "restaurant" | "cafe" | "salon" | "kiosk" | "mobile";

const METHODS: { value: PayMethod; label: string; icon: React.ElementType }[] = [
    { value: "cash",   label: "Cash",   icon: Banknote   },
    { value: "gcash",  label: "GCash",  icon: Smartphone },
    { value: "card",   label: "Card",   icon: CreditCard },
    { value: "others", label: "Others", icon: Tag        },
];

// ─── Shared helpers ───────────────────────────────────────────────────────────

function tableStatusColor(status: string) {
    if (status === "available") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    if (status === "occupied")  return "bg-amber-500/15 text-amber-500 border-amber-500/30";
    if (status === "reserved")  return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    return "bg-muted text-muted-foreground border-border";
}

// ─── CategoryBar ─────────────────────────────────────────────────────────────
// Wraps into multiple rows when there are many categories.
// Collapses to a single "show more" toggle after CAT_SHOW_DEFAULT items.

const CAT_SHOW_DEFAULT = 8;

function CategoryBar({ categories, activeCat, onChange, className }: {
    categories: Category[];
    activeCat: number | null;
    onChange: (id: number | null) => void;
    className?: string;
}) {
    const [expanded, setExpanded] = useState(false);

    const total       = categories.length;
    const showAll     = expanded || total <= CAT_SHOW_DEFAULT;
    const visible     = showAll ? categories : categories.slice(0, CAT_SHOW_DEFAULT - 1);
    const hiddenCount = total - (CAT_SHOW_DEFAULT - 1);

    // If the active category is in the hidden group, always show it
    const activeIsHidden = !showAll && activeCat !== null &&
        !visible.find(c => c.id === activeCat);

    const btnBase   = "shrink-0 px-3 h-7 rounded-full font-bold border text-xs transition-all";
    const btnActive = "bg-primary text-primary-foreground border-primary";
    const btnIdle   = "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground";

    return (
        <div className={cn("flex flex-wrap gap-1.5", className)}>
            <button onClick={() => onChange(null)} className={cn(btnBase, activeCat === null ? btnActive : btnIdle)}>
                All
            </button>

            {visible.map(c => (
                <button key={c.id} onClick={() => onChange(activeCat === c.id ? null : c.id)}
                    className={cn(btnBase, activeCat === c.id ? btnActive : btnIdle)}>
                    {c.name}
                </button>
            ))}

            {/* Always show the active category even when it's in the hidden group */}
            {activeIsHidden && (() => {
                const ac = categories.find(c => c.id === activeCat);
                return ac ? (
                    <button onClick={() => onChange(null)} className={cn(btnBase, btnActive)}>
                        {ac.name} ✕
                    </button>
                ) : null;
            })()}

            {/* Show more / less */}
            {total > CAT_SHOW_DEFAULT && (
                <button onClick={() => setExpanded(e => !e)}
                    className={cn(btnBase, "border-dashed text-muted-foreground hover:border-primary/40 hover:text-foreground")}>
                    {expanded ? "← Less" : `+${hiddenCount} more`}
                </button>
            )}
        </div>
    );
}

// ─── Shared modals ────────────────────────────────────────────────────────────

function VariantPicker({ product, currency, onSelect, onClose }: {
    product: Product; currency: string;
    onSelect: (id: number | null, name: string | null) => void;
    onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
                <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-border">
                    <div className="min-w-0 flex-1 pr-3">
                        <p className="font-semibold text-foreground leading-snug">{product.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Choose a variant</p>
                    </div>
                    <button onClick={onClose} className="shrink-0 p-1 rounded-md hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
                </div>
                <div className="p-4 grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                    <button onClick={() => onSelect(null, null)}
                        className="flex flex-col items-start gap-1 p-3 rounded-xl border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all text-left">
                        <span className="text-sm font-semibold text-foreground">Base</span>
                        <span className="text-xs text-muted-foreground">{fmtMoney(product.price, currency)}</span>
                    </button>
                    {product.variants.filter(v => v.is_available).map(v => (
                        <button key={v.id} onClick={() => onSelect(v.id, v.name)}
                            className="flex flex-col items-start gap-1 p-3 rounded-xl border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all text-left">
                            <span className="text-sm font-semibold text-foreground">{v.name}</span>
                            <span className="text-xs text-muted-foreground">
                                {v.extra_price > 0 ? `+${fmtMoney(v.extra_price, currency)}` : fmtMoney(product.price, currency)}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

function PaymentModal({ subtotal, settings, currency, customerNameRequired, promos, cart, onConfirm, onClose, loading }: {
    subtotal: number; settings: PageProps["settings"]; currency: string;
    customerNameRequired?: boolean;
    promos: ActivePromo[];
    cart: CartItem[];
    onConfirm: (d: { payment_method: PayMethod; payment_amount: number; customer_name: string; discount_percent: number; promo_id: number | null }) => void;
    onClose: () => void; loading: boolean;
}) {
    const [method,       setMethod]       = useState<PayMethod>((settings?.default_payment ?? "cash") as PayMethod);
    const [tender,       setTender]       = useState("");
    const [customer,     setCustomer]     = useState("");
    const [discPct,      setDiscPct]      = useState("");
    const [promoCode,    setPromoCode]    = useState("");
    const [appliedPromo, setAppliedPromo] = useState<ActivePromo | null>(null);
    const [promoError,   setPromoError]   = useState("");
    const [showPromoList, setShowPromoList] = useState(false);

    const disc      = Math.min(parseFloat(discPct) || 0, settings?.max_discount_percent ?? 100);
    const discAmt   = (subtotal * disc) / 100;
    const afterDisc = subtotal - discAmt;

    // ── Check if a promo applies to the current cart ───────────────────────────
    const promoAppliesToCart = (promo: ActivePromo): boolean => {
        if (promo.applies_to === 'all') return true;
        if (promo.applies_to === 'specific_products') {
            return cart.some(i => promo.product_ids.includes(i.product_id));
        }
        if (promo.applies_to === 'specific_categories') {
            // We need category_id — check via products list not available here,
            // so we allow it and let server validate. Show it as eligible.
            return promo.category_ids.length > 0;
        }
        return false;
    };

    // ── Compute promo discount amount ──────────────────────────────────────────
    const computePromoAmt = (promo: ActivePromo | null): number => {
        if (!promo) return 0;
        const base = afterDisc;
        if (promo.minimum_purchase && base < promo.minimum_purchase) return 0;
        if (promo.discount_type === 'percent') return Math.round((base * promo.discount_value / 100) * 100) / 100;
        return Math.min(promo.discount_value, base);
    };

    const promoAmt   = computePromoAmt(appliedPromo);
    const afterPromo = afterDisc - promoAmt;
    const vatRate    = (settings?.vat_enabled && !settings?.vat_inclusive) ? (settings.vat_rate ?? 0) : 0;
    const vatAmt     = (afterPromo * vatRate) / 100;
    const total      = afterPromo + vatAmt;
    const tenderN    = parseFloat(tender) || 0;
    const change     = Math.max(0, tenderN - total);
    const isCash     = method === "cash";
    const canPay     = total > 0 && (!isCash || tenderN >= total) && (!customerNameRequired || customer.trim().length > 0);

    const append    = (v: string) => setTender(p => (p === "0" || p === "") ? v : p + v);
    const backspace = ()          => setTender(p => p.slice(0, -1));

    // ── Promos eligible for this cart ──────────────────────────────────────────
    const eligiblePromos = promos.filter(p => promoAppliesToCart(p));
    // No-code promos eligible for this cart (auto-apply candidates)
    const noCodePromos   = eligiblePromos.filter(p => !p.code);
    // Code-required promos (cashier must type the code)
    const codePromos     = eligiblePromos.filter(p => !!p.code);

    const applyPromoCode = () => {
        setPromoError("");
        const code = promoCode.trim().toUpperCase();
        if (!code) return;
        // Find in full promos list (code could belong to a specific-product promo)
        const found = promos.find(p => p.code?.toUpperCase() === code);
        if (!found) { setPromoError("Promo code not found or expired."); return; }
        if (!promoAppliesToCart(found)) {
            setPromoError("This promo does not apply to any item in the cart.");
            return;
        }
        if (found.minimum_purchase && afterDisc < found.minimum_purchase) {
            setPromoError("Minimum purchase of " + fmtMoney(found.minimum_purchase, currency) + " required.");
            return;
        }
        const amt = computePromoAmt(found);
        if (amt <= 0) {
            setPromoError("This promo gives no discount on the current cart total.");
            return;
        }
        setAppliedPromo(found);
        setPromoError("");
        setShowPromoList(false);
    };

    const applyDirect = (promo: ActivePromo) => {
        if (promo.minimum_purchase && afterDisc < promo.minimum_purchase) {
            setPromoError("Minimum purchase of " + fmtMoney(promo.minimum_purchase, currency) + " required for " + promo.name + ".");
            return;
        }
        setAppliedPromo(promo);
        setPromoError("");
        setShowPromoList(false);
    };

    const removePromo = () => { setAppliedPromo(null); setPromoCode(""); setPromoError(""); };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl flex flex-col max-h-[92vh]">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                    <p className="font-bold text-foreground">Checkout</p>
                    <button onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Summary */}
                    <div className="bg-muted/30 rounded-xl p-3.5 space-y-1.5 text-sm">
                        <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmtMoney(subtotal, currency)}</span></div>
                        {disc > 0 && <div className="flex justify-between text-emerald-600 dark:text-emerald-400"><span>Discount ({disc}%)</span><span>−{fmtMoney(discAmt, currency)}</span></div>}
                        {promoAmt > 0 && (
                            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                                <span className="flex items-center gap-1.5"><Tag className="h-3 w-3" />{appliedPromo?.name}</span>
                                <span>−{fmtMoney(promoAmt, currency)}</span>
                            </div>
                        )}
                        {vatAmt > 0 && <div className="flex justify-between text-muted-foreground"><span>VAT ({vatRate}%)</span><span>+{fmtMoney(vatAmt, currency)}</span></div>}
                        <div className="flex justify-between font-bold text-base text-foreground border-t border-border pt-2 mt-1"><span>Total</span><span>{fmtMoney(total, currency)}</span></div>
                    </div>

                    {/* Discount */}
                    {settings?.allow_discount && (
                        <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Discount %</label>
                            <div className="flex gap-2 flex-wrap">
                                <input value={discPct} onChange={e => setDiscPct(e.target.value)} placeholder="0" type="number" min="0" max={settings.max_discount_percent}
                                    className="h-9 w-20 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground" />
                                {[5, 10, 20].filter(v => v <= (settings.max_discount_percent ?? 100)).map(v => (
                                    <button key={v} onClick={() => setDiscPct(String(v))}
                                        className={cn("h-9 px-3 rounded-lg border text-sm font-medium transition-all", disc === v ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40")}>
                                        {v}%
                                    </button>
                                ))}
                                {disc > 0 && <button onClick={() => setDiscPct("")} className="h-9 px-2 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted">Clear</button>}
                            </div>
                        </div>
                    )}

                    {/* Promo / Discount */}
                    {eligiblePromos.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                    Promo
                                    {eligiblePromos.length > 0 && !appliedPromo && (
                                        <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                                            {eligiblePromos.length} available
                                        </span>
                                    )}
                                </label>
                                {!appliedPromo && eligiblePromos.length > 0 && (
                                    <button onClick={() => setShowPromoList(v => !v)}
                                        className="text-[10px] text-primary hover:underline">
                                        {showPromoList ? "Hide" : "Browse promos"}
                                    </button>
                                )}
                            </div>

                            {/* Applied promo badge */}
                            {appliedPromo ? (
                                <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                                    <Tag className="h-4 w-4 text-emerald-500 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{appliedPromo.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {appliedPromo.discount_type === 'percent'
                                                ? `${appliedPromo.discount_value}% off`
                                                : `₱${appliedPromo.discount_value.toFixed(2)} off`}
                                            {appliedPromo.code && <span className="ml-1.5 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded">{appliedPromo.code}</span>}
                                            {appliedPromo.applies_to !== 'all' && (
                                                <span className="ml-1.5 italic opacity-70">
                                                    {appliedPromo.applies_to === 'specific_products' ? '(selected products)' : '(selected categories)'}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">−{fmtMoney(promoAmt, currency)}</p>
                                        <button onClick={removePromo} className="text-[10px] text-muted-foreground hover:text-destructive">Remove</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {/* Code input */}
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                            <input value={promoCode}
                                                onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoError(""); }}
                                                onKeyDown={e => e.key === 'Enter' && applyPromoCode()}
                                                placeholder="Enter promo code…"
                                                className="w-full h-9 pl-9 pr-3 text-sm font-mono tracking-wider bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground uppercase placeholder:normal-case placeholder:font-sans placeholder:tracking-normal" />
                                        </div>
                                        <button onClick={applyPromoCode} disabled={!promoCode.trim()}
                                            className="h-9 px-4 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors shrink-0">
                                            Apply
                                        </button>
                                    </div>

                                    {promoError && (
                                        <p className="text-xs text-destructive flex items-center gap-1.5">
                                            <AlertTriangle className="h-3 w-3 shrink-0" />{promoError}
                                        </p>
                                    )}

                                    {/* No-code promos — tap to apply */}
                                    {noCodePromos.length > 0 && (
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Available promos</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {noCodePromos.map(p => {
                                                    const amt = computePromoAmt(p);
                                                    const locked = !!(p.minimum_purchase && afterDisc < p.minimum_purchase);
                                                    return (
                                                        <button key={p.id}
                                                            onClick={() => !locked && applyDirect(p)}
                                                            disabled={locked}
                                                            className={cn(
                                                                "flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl border transition-all",
                                                                locked
                                                                    ? "border-border text-muted-foreground/50 cursor-not-allowed"
                                                                    : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                                                            )}>
                                                            <Tag className="h-3 w-3 shrink-0" />
                                                            <span>{p.name}</span>
                                                            {amt > 0 && <span className="font-bold">−{fmtMoney(amt, currency)}</span>}
                                                            {locked && <span className="text-[9px] opacity-60">min {fmtMoney(p.minimum_purchase!, currency)}</span>}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Promo list (code promos) — shown when "Browse promos" clicked */}
                                    {showPromoList && codePromos.length > 0 && (
                                        <div className="border border-border rounded-xl overflow-hidden">
                                            <p className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/30">
                                                Code-required promos for this cart
                                            </p>
                                            <div className="divide-y divide-border">
                                                {codePromos.map(p => {
                                                    const amt    = computePromoAmt(p);
                                                    const locked = !!(p.minimum_purchase && afterDisc < p.minimum_purchase);
                                                    return (
                                                        <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-semibold text-foreground">{p.name}</p>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <span className="font-mono text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">{p.code}</span>
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {p.discount_type === 'percent' ? `${p.discount_value}%` : `₱${p.discount_value.toFixed(2)}`} off
                                                                    </span>
                                                                    {p.minimum_purchase && (
                                                                        <span className="text-xs text-muted-foreground/60">min {fmtMoney(p.minimum_purchase, currency)}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {amt > 0 && !locked && (
                                                                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                                                    −{fmtMoney(amt, currency)}
                                                                </span>
                                                            )}
                                                            {locked && (
                                                                <span className="text-xs text-muted-foreground/50 shrink-0">locked</span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Customer */}
                    <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                            Customer name {customerNameRequired && <span className="text-destructive">*</span>}
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <input value={customer} onChange={e => setCustomer(e.target.value)}
                                placeholder={customerNameRequired ? "Required for this service" : "Walk-in customer"}
                                className="w-full h-9 pl-9 pr-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground" />
                        </div>
                    </div>

                    {/* Payment method */}
                    <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Payment method</label>
                        <div className="grid grid-cols-4 gap-1.5">
                            {METHODS.map(m => { const Icon = m.icon; return (
                                <button key={m.value} onClick={() => setMethod(m.value)}
                                    className={cn("flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-semibold transition-all",
                                        method === m.value ? "bg-primary text-primary-foreground border-primary shadow-sm" : "border-border hover:border-primary/40 hover:bg-accent text-foreground")}>
                                    <Icon className="h-4 w-4" />{m.label}
                                </button>
                            ); })}
                        </div>
                    </div>

                    {/* Cash numpad */}
                    {isCash && (
                        <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Cash tendered</label>
                            <div className="bg-background border border-border rounded-xl px-4 py-3 mb-3 flex items-center justify-between gap-3">
                                <span className="text-3xl font-bold tabular-nums text-foreground">
                                    {currency}{(parseFloat(tender || "0")).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                </span>
                                {tenderN >= total && total > 0 && (
                                    <div className="text-right shrink-0">
                                        <p className="text-[10px] text-muted-foreground">Change</p>
                                        <p className="text-xl font-bold tabular-nums text-green-600 dark:text-green-400">{fmtMoney(change, currency)}</p>
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-1.5 mb-3 flex-wrap">
                                {[total, 100, 200, 500, 1000].filter((v, i) => i === 0 || v >= total).slice(0, 5).map((v, i) => (
                                    <button key={i} onClick={() => setTender(v.toFixed(2))}
                                        className="px-2.5 py-1 rounded-lg border border-border text-xs font-medium hover:border-primary/40 hover:bg-accent transition-colors">
                                        {i === 0 ? "Exact" : fmtMoney(Math.ceil(v / 100) * 100, currency)}
                                    </button>
                                ))}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {["7","8","9","4","5","6","1","2","3","00","0","⌫"].map(k => (
                                    <button key={k} onClick={() => k === "⌫" ? backspace() : append(k)}
                                        className="rounded-xl border h-12 text-base font-semibold transition-all active:scale-95 border-border hover:border-primary/30 hover:bg-accent">
                                        {k}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="px-4 pb-5 pt-3 border-t border-border shrink-0">
                    <Button className="w-full h-12 text-base font-bold gap-2" disabled={!canPay || loading}
                        onClick={() => onConfirm({ payment_method: method, payment_amount: isCash ? tenderN : total, customer_name: customer, discount_percent: disc, promo_id: appliedPromo?.id ?? null })}>
                        {loading ? <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" /> : <><Zap className="h-4 w-4" />Charge {fmtMoney(total, currency)}</>}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function SaleSuccessModal({ receipt, currency, onNewSale }: { receipt: ReceiptData; currency: string; onNewSale: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm shadow-2xl flex flex-col max-h-[92vh]">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
                    <div className="p-1.5 rounded-full bg-green-100 dark:bg-green-900/40">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                        <p className="font-bold text-foreground">Sale completed</p>
                        <p className="text-xs text-muted-foreground font-mono">{receipt.receipt_number}</p>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                    <ReceiptTemplate sale={receipt} currency={currency} showActions={true} />
                </div>
                <div className="px-4 pb-5 pt-3 border-t border-border shrink-0">
                    <Button className="w-full h-11 font-bold gap-2" onClick={onNewSale}>
                        <ShoppingCart className="h-4 w-4" />New Sale
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Cart panel ───────────────────────────────────────────────────────────────

function CartPanel({ cart, subtotal, itemCount, currency, error, onUpdateQty, onRemove, onClear, onCharge }: {
    cart: CartItem[]; subtotal: number; itemCount: number; currency: string;
    error: string | null; onUpdateQty: (key: string, d: number) => void;
    onRemove: (key: string) => void; onClear: () => void; onCharge: () => void;
}) {
    return (
        <div className="flex flex-col bg-card h-full">
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold">Cart</span>
                    {itemCount > 0 && (
                        <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center px-1">
                            {itemCount}
                        </span>
                    )}
                </div>
                {cart.length > 0 && (
                    <button onClick={onClear} className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1">
                        <Trash2 className="h-3 w-3" />Clear
                    </button>
                )}
            </div>
            <div className="flex-1 overflow-y-auto">
                {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground px-4 text-center">
                        <ShoppingCart className="h-10 w-10 opacity-15" />
                        <div>
                            <p className="text-sm font-medium">Cart is empty</p>
                            <p className="text-xs opacity-60 mt-1">Select a product to add it<br />Press F9 to checkout</p>
                        </div>
                    </div>
                ) : (
                    <div className="px-3 py-2">
                        {cart.map(item => (
                            <div key={item.key} className="group flex items-start gap-2 py-2.5 border-b border-border/50 last:border-0">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground leading-snug break-words">{item.name}</p>
                                    {item.variant_name && <p className="text-[10px] text-muted-foreground mt-0.5">{item.variant_name}</p>}
                                    {/* Bundle components hint */}
                                    {item.product_type === 'bundle' && item.bundle_items && item.bundle_items.length > 0 && (
                                        <p className="text-[9px] text-purple-400 mt-0.5 leading-relaxed">
                                            📦 {item.bundle_items.filter(b => b.required).map(b => `${b.name}×${b.qty}`).join(', ')}
                                        </p>
                                    )}
                                    {/* Recipe ingredients hint */}
                                    {item.product_type === 'made_to_order' && item.recipe_items && item.recipe_items.length > 0 && (
                                        <p className="text-[9px] text-cyan-400 mt-0.5 leading-relaxed">
                                            🍳 {item.recipe_items.map(r => `${r.name} ${r.quantity}${r.unit}`).join(', ')}
                                        </p>
                                    )}
                                    <p className="text-xs font-bold text-primary tabular-nums mt-0.5">{fmtMoney(item.price, currency)}</p>
                                </div>
                                <div className="shrink-0 flex flex-col items-end gap-1 pt-0.5">
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => onUpdateQty(item.key, -1)}
                                            className="h-6 w-6 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                                            <Minus className="h-3 w-3" />
                                        </button>
                                        <span className="w-6 text-center text-sm font-bold tabular-nums">{item.qty}</span>
                                        <button onClick={() => onUpdateQty(item.key, 1)} disabled={item.qty >= item.stock}
                                            className="h-6 w-6 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30">
                                            <Plus className="h-3 w-3" />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs font-bold tabular-nums text-foreground">{fmtMoney(item.price * item.qty, currency)}</span>
                                        <button onClick={() => onRemove(item.key)}
                                            className="h-4 w-4 rounded flex items-center justify-center text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all">
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {cart.length > 0 && (
                <div className="shrink-0 border-t border-border p-4 space-y-3">
                    <div className="flex items-end justify-between">
                        <span className="text-xs text-muted-foreground">{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
                        <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Subtotal</p>
                            <p className="text-2xl font-bold tabular-nums text-foreground">{fmtMoney(subtotal, currency)}</p>
                        </div>
                    </div>
                    <Button className="w-full h-12 text-base font-bold gap-2" onClick={onCharge}>
                        <Zap className="h-4 w-4" />Charge
                        <span className="text-xs opacity-60 ml-auto font-normal">F9</span>
                    </Button>
                    {error && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{error}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── LAYOUT: Grid ─────────────────────────────────────────────────────────────

function GridLayout({ filtered, cart, currency, onProductClick }: {
    filtered: Product[]; cart: CartItem[]; currency: string; onProductClick: (p: Product) => void;
}) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {filtered.map(p => {
                const inCart      = cart.find(i => i.product_id === p.id);
                const isBundleOrMTO = p.product_type === 'bundle' || p.product_type === 'made_to_order';
                const outStock    = !isBundleOrMTO && p.stock <= 0;
                const lowStock    = !isBundleOrMTO && p.stock > 0 && p.stock <= 5;
                return (
                    <button key={p.id} onClick={() => onProductClick(p)} disabled={outStock}
                        className={cn("relative flex flex-col rounded-xl border p-2.5 text-left transition-all overflow-hidden",
                            outStock ? "opacity-40 cursor-not-allowed border-border bg-card"
                                : inCart ? "border-primary/60 bg-primary/5 shadow-md"
                                : "border-border bg-card hover:border-primary/40 hover:shadow-sm")}>
                        <div className="aspect-square w-full bg-muted/40 overflow-hidden rounded-md mb-2 shrink-0">
                            {p.product_img
                                ? <img src={p.product_img} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                                : <div className="w-full h-full flex items-center justify-center"><Package className="h-7 w-7 text-muted-foreground/25" /></div>}
                        </div>
                        {inCart && (
                            <div className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1 shadow">
                                {inCart.qty}
                            </div>
                        )}
                        {outStock && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl">
                                <span className="text-[9px] font-black text-destructive uppercase tracking-widest bg-background/80 px-2 py-0.5 rounded">Out</span>
                            </div>
                        )}
                        <p title={p.name} className="text-xs font-semibold text-foreground leading-tight line-clamp-2 flex-1">{p.name}</p>
                        <div className="flex items-center justify-between mt-1.5 gap-1 shrink-0">
                            <span className="text-xs font-bold text-primary tabular-nums">{fmtMoney(p.price, currency)}</span>
                            <span className={cn("text-[10px] font-medium shrink-0", lowStock ? "text-amber-500" : "text-muted-foreground")}>
                                {p.product_type === 'made_to_order' ? 'MTO' : p.product_type === 'bundle' ? '📦' : p.stock}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap mt-0.5">
                            {p.has_variants && <p className="text-[9px] text-muted-foreground">{p.variants.length} var.</p>}
                            {p.product_type === 'bundle' && p.bundle_items && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-bold">Bundle ×{p.bundle_items.length}</span>
                            )}
                            {p.product_type === 'made_to_order' && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-bold">MTO</span>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

// ─── LAYOUT: Tablet ───────────────────────────────────────────────────────────

function TabletLayout({ filtered, cart, currency, onProductClick }: {
    filtered: Product[]; cart: CartItem[]; currency: string; onProductClick: (p: Product) => void;
}) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtered.map(p => {
                const inCart      = cart.find(i => i.product_id === p.id);
                const isBundleOrMTO = p.product_type === 'bundle' || p.product_type === 'made_to_order';
                const outStock    = !isBundleOrMTO && p.stock <= 0;
                const lowStock    = !isBundleOrMTO && p.stock > 0 && p.stock <= 5;
                return (
                    <button key={p.id} onClick={() => onProductClick(p)} disabled={outStock}
                        className={cn("relative flex flex-col rounded-2xl border text-left transition-all duration-150 overflow-hidden active:scale-[0.97] select-none",
                            outStock ? "opacity-40 cursor-not-allowed border-border bg-card"
                                : inCart ? "border-primary/60 bg-primary/5 shadow-md"
                                : "border-border bg-card hover:border-primary/40 hover:shadow-md")}>
                        <div className="w-full bg-muted/40 overflow-hidden shrink-0" style={{ aspectRatio: "4/3" }}>
                            {p.product_img
                                ? <img src={p.product_img} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                                : <div className="w-full h-full flex items-center justify-center"><Package className="h-10 w-10 text-muted-foreground/20" /></div>}
                        </div>
                        {inCart && (
                            <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs font-black rounded-full h-6 min-w-[24px] flex items-center justify-center px-1.5 shadow-lg">
                                ×{inCart.qty}
                            </div>
                        )}
                        {outStock && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                                <span className="text-[10px] font-black text-destructive uppercase tracking-widest bg-background/90 px-3 py-1 rounded-full">Out of stock</span>
                            </div>
                        )}
                        <div className="p-3 flex-1 flex flex-col">
                            <p title={p.name} className="text-sm font-bold text-foreground leading-snug line-clamp-3 flex-1">{p.name}</p>
                            <div className="mt-2 flex items-center justify-between gap-1">
                                <span className="text-base font-black text-primary tabular-nums">{fmtMoney(p.price, currency)}</span>
                                <span className={cn("text-xs font-semibold shrink-0", lowStock ? "text-amber-500" : "text-muted-foreground")}>
                                    {p.product_type === 'made_to_order' ? 'MTO' : p.product_type === 'bundle' ? '📦' : lowStock ? `⚠ ${p.stock}` : `${p.stock}`}
                                </span>
                            </div>
                            {p.has_variants && <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><ChevronDown className="h-2.5 w-2.5" />{p.variants.length} variants</p>}
                            {p.product_type === 'bundle' && p.bundle_items && (
                                <p className="text-[10px] text-purple-400 mt-0.5 font-semibold">📦 {p.bundle_items.length} items in bundle</p>
                            )}
                            {p.product_type === 'made_to_order' && (
                                <p className="text-[10px] text-cyan-400 mt-0.5 font-semibold">🍳 Made to order</p>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

// ─── LAYOUT: Grocery ──────────────────────────────────────────────────────────

function GroceryLayout({ filtered, cart, currency, onProductClick }: {
    filtered: Product[]; cart: CartItem[]; currency: string; onProductClick: (p: Product) => void;
}) {
    return (
        <div className="divide-y divide-border/50">
            {filtered.map(p => {
                const inCart      = cart.find(i => i.product_id === p.id);
                const isBundleOrMTO = p.product_type === 'bundle' || p.product_type === 'made_to_order';
                const outStock    = !isBundleOrMTO && p.stock <= 0;
                const lowStock    = !isBundleOrMTO && p.stock > 0 && p.stock <= 5;
                return (
                    <button key={p.id} onClick={() => onProductClick(p)} disabled={outStock}
                        className={cn("w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors select-none",
                            outStock ? "opacity-40 cursor-not-allowed" : inCart ? "bg-primary/5" : "hover:bg-accent")}>
                        <div className={cn("h-9 w-9 rounded-lg overflow-hidden shrink-0 flex items-center justify-center text-sm font-black",
                            inCart ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                            {inCart ? inCart.qty : p.product_img
                                ? <img src={p.product_img} alt="" className="w-full h-full object-cover" loading="lazy" />
                                : <span>{p.name.charAt(0).toUpperCase()}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className={cn("text-sm font-semibold leading-snug", outStock ? "text-muted-foreground" : "text-foreground")}>
                                {p.name}
                                {p.has_variants && <span className="text-[10px] text-muted-foreground font-normal ml-1">({p.variants.length} var.)</span>}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                {p.barcode && <p className="text-[10px] text-muted-foreground font-mono">{p.barcode}</p>}
                                {p.product_type === 'bundle' && <span className="text-[9px] font-bold text-purple-400">BUNDLE</span>}
                                {p.product_type === 'made_to_order' && <span className="text-[9px] font-bold text-cyan-400">MTO</span>}
                            </div>
                        </div>
                        <span className={cn("text-xs font-semibold shrink-0 tabular-nums",
                            outStock ? "text-destructive" : lowStock ? "text-amber-500" : "text-muted-foreground")}>
                            {outStock ? "Out" : p.product_type === 'made_to_order' ? 'MTO' : p.product_type === 'bundle' ? 'Bundle' : `${p.stock}`}
                        </span>
                        <span className="text-sm font-black text-primary tabular-nums shrink-0 ml-2">{fmtMoney(p.price, currency)}</span>
                        <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                            outStock ? "bg-muted/50 text-muted-foreground/30"
                                : inCart ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary")}>
                            <Plus className="h-3.5 w-3.5" />
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

// ─── LAYOUT: Cafe / Quick-serve ───────────────────────────────────────────────
// Category pills are huge + prominent. Products shown as compact text tiles — no images.
// Best for cafes, bakeries, food stalls where speed matters more than visuals.

function CafeLayout({ filtered, allProducts, categories, activeCat, onCatChange, cart, currency, onProductClick }: {
    filtered: Product[]; allProducts: Product[]; categories: Category[];
    activeCat: number | null; onCatChange: (id: number | null) => void;
    cart: CartItem[]; currency: string; onProductClick: (p: Product) => void;
}) {
    return (
        <div className="flex flex-col h-full">
            {/* Category bar — wraps when many categories, shows count per category */}
            <div className="shrink-0 border-b border-border px-3 py-2.5">
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => onCatChange(null)}
                        className={cn("shrink-0 px-4 py-1.5 rounded-xl font-bold text-sm border transition-all",
                            activeCat === null ? "bg-primary text-primary-foreground border-primary shadow" : "border-border text-foreground hover:border-primary/40 hover:bg-accent")}>
                        All
                        <span className="ml-1.5 text-[10px] opacity-60 font-normal">{allProducts.length}</span>
                    </button>
                    {categories.map(c => {
                        const count = allProducts.filter(p => p.category?.id === c.id).length;
                        return (
                            <button key={c.id} onClick={() => onCatChange(activeCat === c.id ? null : c.id)}
                                className={cn("shrink-0 px-4 py-1.5 rounded-xl font-bold text-sm border transition-all",
                                    activeCat === c.id ? "bg-primary text-primary-foreground border-primary shadow" : "border-border text-foreground hover:border-primary/40 hover:bg-accent")}>
                                {c.name}
                                <span className="ml-1.5 text-[10px] opacity-60 font-normal">{count}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
            {/* Product grid — no images, just name + price */}
            <div className="flex-1 overflow-y-auto p-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {filtered.map(p => {
                        const inCart      = cart.find(i => i.product_id === p.id);
                        const isBundleOrMTO = p.product_type === 'bundle' || p.product_type === 'made_to_order';
                        const outStock    = !isBundleOrMTO && p.stock <= 0;
                        return (
                            <button key={p.id} onClick={() => onProductClick(p)} disabled={outStock}
                                className={cn("relative flex flex-col items-start gap-1 p-4 rounded-2xl border text-left transition-all active:scale-[0.97]",
                                    outStock ? "opacity-40 cursor-not-allowed border-border bg-card"
                                        : inCart ? "border-primary bg-primary/8 shadow-md"
                                        : "border-border bg-card hover:border-primary/50 hover:bg-accent/50")}>
                                {inCart && (
                                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] font-black rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">
                                        {inCart.qty}
                                    </div>
                                )}
                                <p className="text-sm font-bold text-foreground leading-snug pr-5">{p.name}</p>
                                {p.has_variants && <p className="text-[10px] text-muted-foreground">{p.variants.length} sizes</p>}
                                {p.product_type === 'bundle' && <p className="text-[9px] font-bold text-purple-400">📦 BUNDLE</p>}
                                {p.product_type === 'made_to_order' && <p className="text-[9px] font-bold text-cyan-400">🍳 MTO</p>}
                                <div className="mt-auto pt-2 flex items-center justify-between w-full">
                                    <span className="text-base font-black text-primary tabular-nums">{fmtMoney(p.price, currency)}</span>
                                    {p.stock <= 5 && p.stock > 0 && <span className="text-[10px] text-amber-500">⚠ {p.stock}</span>}
                                    {outStock && <span className="text-[10px] text-destructive font-bold">Out</span>}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ─── LAYOUT: Restaurant / Table ───────────────────────────────────────────────
// Left: table map. Click a table → opens the product panel for that table.
// Right: products (same as tablet but with table context shown in cart header).

function RestaurantLayout({ filtered, cart, currency, onProductClick,
    openTableOrders, diningTables, activeTableOrderId, onSelectTable, onNewTable }: {
    filtered: Product[]; cart: CartItem[]; currency: string; onProductClick: (p: Product) => void;
    openTableOrders: TableOrder[]; diningTables: DiningTable[];
    activeTableOrderId: number | null; onSelectTable: (id: number | null) => void; onNewTable: () => void;
}) {
    const [tab, setTab] = useState<"tables" | "takeout">("tables");

    // Group dining tables by section
    const sections = useMemo(() => {
        const map: Record<string, DiningTable[]> = {};
        diningTables.forEach(t => {
            const s = t.section ?? "Main";
            if (!map[s]) map[s] = [];
            map[s].push(t);
        });
        return map;
    }, [diningTables]);

    const activeOrder = openTableOrders.find(o => o.id === activeTableOrderId);

    return (
        <div className="flex h-full overflow-hidden">
            {/* Table map panel */}
            <div className="w-64 xl:w-72 shrink-0 border-r border-border flex flex-col bg-card overflow-hidden">
                <div className="flex border-b border-border shrink-0">
                    {(["tables", "takeout"] as const).map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={cn("flex-1 py-2.5 text-xs font-bold transition-colors",
                                tab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground")}>
                            {t === "tables" ? `Tables (${diningTables.length})` : "Takeout"}
                        </button>
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                    {tab === "tables" ? (
                        <>
                            {Object.keys(sections).length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-8">No tables configured</p>
                            ) : Object.entries(sections).map(([section, tables]) => (
                                <div key={section}>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{section}</p>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {tables.map(t => {
                                            const order = openTableOrders.find(o => o.table_number === t.table_number);
                                            const isActive = order && order.id === activeTableOrderId;
                                            return (
                                                <button key={t.id}
                                                    onClick={() => order ? onSelectTable(order.id) : onSelectTable(null)}
                                                    className={cn("flex flex-col items-center justify-center rounded-xl border p-2 transition-all text-center",
                                                        isActive ? "border-primary bg-primary/15 shadow-sm"
                                                            : order ? "border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/15"
                                                            : "border-border hover:border-primary/40 hover:bg-accent")}>
                                                    <span className="text-xs font-black">{t.table_number}</span>
                                                    <span className={cn("text-[9px] font-medium mt-0.5",
                                                        order ? "text-amber-500" : "text-emerald-500")}>
                                                        {order ? "Occupied" : "Free"}
                                                    </span>
                                                    {order && <span className="text-[9px] text-muted-foreground tabular-nums">{fmtMoney(order.total, currency)}</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                            {/* Open orders not yet linked to a table */}
                            {openTableOrders.filter(o => !o.table_number).length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Open Orders</p>
                                    {openTableOrders.filter(o => !o.table_number).map(o => (
                                        <button key={o.id} onClick={() => onSelectTable(o.id)}
                                            className={cn("w-full flex items-center justify-between px-3 py-2 rounded-xl border mb-1 transition-all text-left",
                                                o.id === activeTableOrderId ? "border-primary bg-primary/10" : "border-border hover:bg-accent")}>
                                            <span className="text-xs font-semibold">{o.label}</span>
                                            <span className="text-xs font-bold text-primary">{fmtMoney(o.total, currency)}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-xs text-muted-foreground mb-3">Add items to cart for takeout — no table needed</p>
                            <button onClick={() => onSelectTable(null)}
                                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold">
                                New Takeout Order
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Products */}
            <div className="flex-1 overflow-y-auto p-3">
                {activeOrder && (
                    <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/25 rounded-xl">
                        <Table2 className="h-4 w-4 text-amber-500 shrink-0" />
                        <span className="text-sm font-bold text-amber-500">{activeOrder.label}</span>
                        {activeOrder.customer_name && <span className="text-xs text-muted-foreground">· {activeOrder.customer_name}</span>}
                        <span className="ml-auto text-sm font-bold text-foreground tabular-nums">{fmtMoney(activeOrder.total, currency)}</span>
                        <button onClick={() => onSelectTable(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                    </div>
                )}
                <TabletLayout filtered={filtered} cart={cart} currency={currency} onProductClick={onProductClick} />
            </div>
        </div>
    );
}

// ─── LAYOUT: Salon / Service ──────────────────────────────────────────────────
// Service cards with duration hint from product name (e.g. "Haircut • 30 min").
// Large cards, customer name required in cart, no stock numbers.

function SalonLayout({ filtered, cart, currency, onProductClick }: {
    filtered: Product[]; cart: CartItem[]; currency: string; onProductClick: (p: Product) => void;
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
            {filtered.map(p => {
                const inCart      = cart.find(i => i.product_id === p.id);
                const isBundleOrMTO = p.product_type === 'bundle' || p.product_type === 'made_to_order';
                const outStock    = !isBundleOrMTO && p.stock <= 0;
                // Extract duration hint from name e.g. "Haircut 30min" or "Massage - 1hr"
                const durationMatch = p.name.match(/(\d+\s*(?:min|hr|hour|mins|hours))/i);
                const duration      = durationMatch?.[1];
                return (
                    <button key={p.id} onClick={() => onProductClick(p)} disabled={outStock}
                        className={cn("relative flex flex-col gap-2 p-5 rounded-2xl border text-left transition-all active:scale-[0.98]",
                            outStock ? "opacity-40 cursor-not-allowed border-border bg-card"
                                : inCart ? "border-primary bg-primary/8 shadow-lg"
                                : "border-border bg-card hover:border-primary/50 hover:shadow-md")}>
                        {inCart && (
                            <div className="absolute top-3 right-3 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">
                                {inCart.qty}
                            </div>
                        )}
                        {/* Service icon area */}
                        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center",
                            inCart ? "bg-primary/20" : "bg-muted")}>
                            <Scissors className={cn("h-5 w-5", inCart ? "text-primary" : "text-muted-foreground")} />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold text-foreground leading-snug">{p.name}</p>
                            {p.category && <p className="text-[11px] text-muted-foreground mt-0.5">{p.category.name}</p>}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-lg font-black text-primary tabular-nums">{fmtMoney(p.price, currency)}</span>
                            {duration && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />{duration}
                                </span>
                            )}
                        </div>
                        {p.has_variants && (
                            <div className="flex gap-1 flex-wrap">
                                {p.variants.slice(0, 3).map(v => (
                                    <span key={v.id} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{v.name}</span>
                                ))}
                                {p.variants.length > 3 && <span className="text-[10px] text-muted-foreground">+{p.variants.length - 3}</span>}
                            </div>
                        )}
                        {outStock && <p className="text-[10px] text-destructive font-bold">Not available</p>}
                    </button>
                );
            })}
        </div>
    );
}

// ─── LAYOUT: Mobile (Android phone) ──────────────────────────────────────────
// Single-column compact layout for cashiers using an Android phone.
// Products fill the screen as a scrollable list.
// Cart is a collapsible bottom sheet — tap the bar to expand, Pay to checkout.

function MobileLayout({ filtered, cart, currency, onProductClick, onCharge, subtotal, itemCount, onClear, onUpdateQty, onRemove }: {
    filtered: Product[]; cart: CartItem[]; currency: string;
    onProductClick: (p: Product) => void;
    onCharge: () => void;
    subtotal: number; itemCount: number;
    onClear: () => void;
    onUpdateQty: (key: string, delta: number) => void;
    onRemove: (key: string) => void;
}) {
    const [cartOpen, setCartOpen] = useState(false);

    return (
        <div className="flex flex-col h-full relative">
            {/* Products list */}
            <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                        <Package className="h-8 w-8 opacity-20" />
                        <p className="text-sm">No products found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {filtered.map(p => {
                            const inCart        = cart.find(i => i.product_id === p.id);
                            const isBundleOrMTO = p.product_type === "bundle" || p.product_type === "made_to_order";
                            const outStock      = !isBundleOrMTO && p.stock <= 0;
                            return (
                                <button key={p.id} onClick={() => onProductClick(p)} disabled={outStock}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors active:scale-[0.99]",
                                        outStock ? "opacity-40 cursor-not-allowed bg-transparent"
                                            : inCart ? "bg-primary/5 border-l-2 border-l-primary"
                                            : "hover:bg-muted/30"
                                    )}>
                                    {/* Thumbnail */}
                                    <div className="h-11 w-11 rounded-xl overflow-hidden bg-muted/40 shrink-0 flex items-center justify-center">
                                        {p.product_img
                                            ? <img src={p.product_img} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                                            : <span className="text-lg opacity-30">
                                                {p.product_type === "bundle" ? "📦" : p.product_type === "made_to_order" ? "🍳" : "🛍"}
                                              </span>}
                                    </div>
                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground leading-snug">{p.name}</p>
                                        {p.category && <p className="text-[11px] text-muted-foreground mt-0.5">{p.category.name}</p>}
                                    </div>
                                    {/* Price + cart count */}
                                    <div className="shrink-0 text-right">
                                        <p className="text-base font-black text-primary tabular-nums">{fmtMoney(p.price, currency)}</p>
                                        {inCart ? (
                                            <span className="text-[10px] font-bold text-emerald-500">×{inCart.qty} added</span>
                                        ) : outStock ? (
                                            <span className="text-[10px] text-destructive font-semibold">Out</span>
                                        ) : (
                                            <span className="text-[10px] text-muted-foreground tabular-nums">
                                                {isBundleOrMTO ? (p.product_type === "made_to_order" ? "MTO" : "Bundle") : p.stock}
                                            </span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
                {/* Bottom spacer so last product isn't hidden behind the cart bar */}
                <div className="h-20" />
            </div>

            {/* Bottom cart sheet */}
            <div className="absolute bottom-0 left-0 right-0 z-20">
                {/* Expanded cart items */}
                {cartOpen && cart.length > 0 && (
                    <div className="bg-card border-t border-border max-h-[55vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Cart · {itemCount} item{itemCount !== 1 ? "s" : ""}</p>
                            <button onClick={() => { onClear(); setCartOpen(false); }}
                                className="text-xs text-destructive hover:underline font-medium">Clear all</button>
                        </div>
                        <div className="divide-y divide-border">
                            {cart.map(item => (
                                <div key={item.key} className="flex items-center gap-3 px-4 py-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                                        {item.variant_name && <p className="text-xs text-muted-foreground">{item.variant_name}</p>}
                                        <p className="text-xs font-bold text-primary tabular-nums mt-0.5">
                                            {fmtMoney(item.price, currency)} × {item.qty} = {fmtMoney(item.price * item.qty, currency)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={() => onUpdateQty(item.key, -1)}
                                            className="h-8 w-8 flex items-center justify-center rounded-xl border border-border text-lg font-bold hover:bg-muted transition-colors">−</button>
                                        <span className="w-8 text-center text-sm font-black tabular-nums">{item.qty}</span>
                                        <button onClick={() => onUpdateQty(item.key, 1)} disabled={item.qty >= item.stock}
                                            className="h-8 w-8 flex items-center justify-center rounded-xl border border-border text-lg font-bold hover:bg-muted transition-colors disabled:opacity-30">+</button>
                                        <button onClick={() => onRemove(item.key)}
                                            className="h-8 w-8 ml-1 flex items-center justify-center rounded-xl text-destructive hover:bg-destructive/10 transition-colors">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Cart subtotal */}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/10">
                            <span className="text-sm text-muted-foreground">Subtotal</span>
                            <span className="text-base font-black text-foreground tabular-nums">{fmtMoney(subtotal, currency)}</span>
                        </div>
                    </div>
                )}

                {/* Sticky bar — always visible */}
                <div className="flex items-center gap-2 px-3 py-2.5 bg-card border-t border-border shadow-xl">
                    <button onClick={() => setCartOpen(o => !o)}
                        className={cn(
                            "flex items-center gap-2 flex-1 h-12 px-4 rounded-2xl border text-sm font-semibold transition-all",
                            itemCount > 0
                                ? "border-primary/30 bg-primary/8 text-foreground"
                                : "border-border text-muted-foreground"
                        )}>
                        <ShoppingCart className="h-4 w-4 shrink-0" />
                        <span className="flex-1 text-left truncate">
                            {itemCount > 0
                                ? `${itemCount} item${itemCount !== 1 ? "s" : ""} · ${fmtMoney(subtotal, currency)}`
                                : "Cart empty"}
                        </span>
                        {itemCount > 0 && (
                            <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", cartOpen && "rotate-180")} />
                        )}
                    </button>
                    <button onClick={onCharge} disabled={itemCount === 0}
                        className="h-12 px-6 rounded-2xl bg-primary text-primary-foreground font-bold text-sm flex items-center gap-1.5 disabled:opacity-40 active:scale-95 transition-all">
                        <Zap className="h-4 w-4" />
                        Pay
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── LAYOUT: Kiosk ───────────────────────────────────────────────────────────
// Large full-width product buttons. Very accessible, self-service friendly.
// No sidebar — cart lives in a floating bottom bar.

function KioskLayout({ filtered, cart, currency, onProductClick, onCharge, subtotal, itemCount, onClear }: {
    filtered: Product[]; cart: CartItem[]; currency: string; onProductClick: (p: Product) => void;
    onCharge: () => void; subtotal: number; itemCount: number; onClear: () => void;
}) {
    return (
        <div className="flex flex-col h-full">
            {/* Products — huge cards */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {filtered.map(p => {
                        const inCart      = cart.find(i => i.product_id === p.id);
                        const isBundleOrMTO = p.product_type === 'bundle' || p.product_type === 'made_to_order';
                        const outStock    = !isBundleOrMTO && p.stock <= 0;
                        return (
                            <button key={p.id} onClick={() => onProductClick(p)} disabled={outStock}
                                className={cn("relative flex flex-col rounded-3xl border text-left transition-all duration-150 overflow-hidden active:scale-[0.96] select-none shadow-sm",
                                    outStock ? "opacity-40 cursor-not-allowed border-border bg-card"
                                        : inCart ? "border-primary/70 bg-primary/8 shadow-xl ring-2 ring-primary/20"
                                        : "border-border bg-card hover:border-primary/50 hover:shadow-lg")}>
                                {/* Image — tall */}
                                <div className="w-full bg-muted/40 overflow-hidden shrink-0" style={{ aspectRatio: "1/1" }}>
                                    {p.product_img
                                        ? <img src={p.product_img} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                                        : <div className="w-full h-full flex items-center justify-center">
                                            <span className="text-5xl opacity-20">🛍</span>
                                        </div>}
                                </div>
                                {inCart && (
                                    <div className="absolute top-3 right-3 bg-primary text-primary-foreground text-sm font-black rounded-full h-8 min-w-[32px] flex items-center justify-center px-2 shadow-xl">
                                        ×{inCart.qty}
                                    </div>
                                )}
                                {outStock && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                                        <span className="text-sm font-black text-destructive uppercase tracking-widest bg-background/90 px-4 py-2 rounded-full">Out of Stock</span>
                                    </div>
                                )}
                                <div className="p-4">
                                    <p className="text-base font-bold text-foreground leading-snug line-clamp-2">{p.name}</p>
                                    {p.category && <p className="text-xs text-muted-foreground mt-0.5">{p.category.name}</p>}
                                    <p className="text-2xl font-black text-primary tabular-nums mt-2">{fmtMoney(p.price, currency)}</p>
                                    {p.has_variants && <p className="text-xs text-muted-foreground mt-1">{p.variants.length} options available</p>}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Floating cart bar at bottom */}
            {itemCount > 0 && (
                <div className="shrink-0 border-t border-border bg-card px-4 py-3 flex items-center gap-4 shadow-lg">
                    <button onClick={onClear} className="text-muted-foreground hover:text-destructive p-2 rounded-xl hover:bg-destructive/10 transition-colors">
                        <Trash2 className="h-5 w-5" />
                    </button>
                    <div className="flex-1">
                        <p className="text-sm text-muted-foreground">{itemCount} item{itemCount !== 1 ? "s" : ""}</p>
                        <p className="text-xl font-black text-foreground tabular-nums">{fmtMoney(subtotal, currency)}</p>
                    </div>
                    <Button className="h-14 px-8 text-base font-black gap-3 rounded-2xl shadow-lg shadow-primary/25" onClick={onCharge}>
                        <Zap className="h-5 w-5" />Pay Now
                    </Button>
                </div>
            )}
        </div>
    );
}

// ─── Main POS ─────────────────────────────────────────────────────────────────

export default function PosIndex() {
    const { props } = usePage<PageProps>();
    const { products, categories, session, branch, settings, app, open_table_orders, dining_tables } = props;
    const promos: ActivePromo[] = (props.promos as ActivePromo[]) ?? [];
    const user     = props.auth?.user;
    const currency = app?.currency ?? "₱";

    const businessType = branch?.business_type;

    // Layout is set per-user by admin in Users → POS Settings. Read-only here.
    const layout = (props.preferred_layout ?? "grid") as LayoutMode;

    const [cart,                setCart]                = useState<CartItem[]>([]);
    const [search,              setSearch]              = useState("");
    const [activeCat,           setActiveCat]           = useState<number | null>(null);
    const [showPayment,         setShowPayment]         = useState(false);
    const [receipt,             setReceipt]             = useState<ReceiptData | null>(null);
    const [loading,             setLoading]             = useState(false);
    const [error,               setError]               = useState<string | null>(null);
    const [variantFor,          setVariantFor]          = useState<Product | null>(null);
    const [barcodeVal,          setBarcodeVal]          = useState("");
    const [activeTableOrderId,  setActiveTableOrderId]  = useState<number | null>(null);

    const searchRef  = useRef<HTMLInputElement>(null);
    const barcodeRef = useRef<HTMLInputElement>(null);

    // Derived
    const filtered = useMemo(() => {
        let list = products;
        if (activeCat)     list = list.filter(p => p.category?.id === activeCat);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(p => p.name.toLowerCase().includes(q) || p.barcode?.includes(q));
        }
        return list;
    }, [products, activeCat, search]);

    const subtotal  = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
    const itemCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

    // Customer name required for salon
    const requireCustomerName = businessType === "salon";

    // Cart operations
    const addItem = useCallback((product: Product, variantId: number | null = null, variantName: string | null = null) => {
        const extra = variantId ? (product.variants.find(v => v.id === variantId)?.extra_price ?? 0) : 0;
        const price = product.price + extra;
        const key   = `${product.id}-${variantId ?? "base"}`;

        // Bundles and MTO products deduct their components on the server.
        // Their own stock row may be 0 or virtual, so we use a high cap (999)
        // to avoid blocking the cashier. The server enforces real stock checks.
        const isBundleOrMTO = product.product_type === 'bundle' || product.product_type === 'made_to_order';
        const stockLimit    = isBundleOrMTO ? 999 : product.stock;

        setCart(prev => {
            const ex = prev.find(i => i.key === key);
            if (ex) {
                if (ex.qty >= stockLimit) return prev;
                return prev.map(i => i.key === key ? { ...i, qty: i.qty + 1 } : i);
            }
            return [...prev, {
                key,
                product_id:   product.id,
                variant_id:   variantId,
                name:         product.name,
                variant_name: variantName,
                price,
                qty:          1,
                stock:        stockLimit,
                product_type: product.product_type,
                bundle_items: product.bundle_items ?? null,
                recipe_items: product.recipe_items ?? null,
            }];
        });
    }, []);

    const handleProductClick = (p: Product) => {
        const isBundleOrMTO = p.product_type === 'bundle' || p.product_type === 'made_to_order';
        // Bundles/MTO may have stock=0 on their own row — their components are checked server-side
        if (!isBundleOrMTO && p.stock <= 0) return;
        // Show variant picker for products with variants
        if (p.has_variants && p.variants.filter(v => v.is_available).length > 0) {
            setVariantFor(p); return;
        }
        addItem(p);
    };

    const updateQty  = (key: string, delta: number) =>
        setCart(prev => prev.flatMap(i => {
            if (i.key !== key) return [i];
            const nq = i.qty + delta;
            if (nq <= 0) return [];
            if (nq > i.stock) return [i];
            return [{ ...i, qty: nq }];
        }));

    const removeItem = (key: string) => setCart(prev => prev.filter(i => i.key !== key));
    const clearCart  = ()            => setCart([]);

    // Barcode
    const handleBarcode = (code: string) => {
        const found = products.find(p => p.barcode === code.trim());
        if (found) { handleProductClick(found); setBarcodeVal(""); }
    };

    // Checkout
    const handleConfirm = (payData: { payment_method: PayMethod; payment_amount: number; customer_name: string; discount_percent: number; promo_id: number | null }) => {
        if (!cart.length) return;
        setLoading(true); setError(null);
        router.post(routes.pos.store(), {
            items:             cart.map(i => ({ id: i.product_id, qty: i.qty, variant_id: i.variant_id })),
            payment_method:    payData.payment_method,
            payment_amount:    payData.payment_amount,
            customer_name:     payData.customer_name || null,
            discount_percent:  payData.discount_percent,
            promo_id:          payData.promo_id ?? null,
            cash_session_id:   session?.id ?? null,
            table_order_id:    activeTableOrderId ?? null,
        }, {
            preserveScroll: true,
            onSuccess: page => {
                const flash = (page.props as any).flash ?? {};
                if (!flash.pos_result) {
                    setError(flash.errors?.error ?? "Checkout failed — please try again.");
                    setLoading(false);
                    return;
                }
                const r         = flash.pos_result;
                const disc      = (subtotal * payData.discount_percent) / 100;
                const promoDisc = r.promo_discount ?? 0;
                const vr        = settings?.vat_enabled && !settings?.vat_inclusive ? (settings.vat_rate ?? 0) : 0;
                const vat       = ((subtotal - disc - promoDisc) * vr) / 100;
                const noteParts = [
                    payData.discount_percent > 0 ? `Discount ${payData.discount_percent}%` : null,
                    r.promo_name ? `Promo: ${r.promo_name}` : null,
                ].filter(Boolean);
                setReceipt({
                    receipt_number:  r.receipt_number ?? "—",
                    status:          "completed",
                    payment_method:  payData.payment_method,
                    payment_amount:  payData.payment_amount,
                    change_amount:   r.change ?? 0,
                    discount_amount: disc + promoDisc,
                    total:           r.total ?? (subtotal - disc - promoDisc + vat),
                    customer_name:   payData.customer_name || null,
                    notes:           noteParts.length ? noteParts.join(' | ') : null,
                    created_at:      new Date().toISOString(),
                    cashier:         user ? `${user.fname} ${user.lname}` : "—",
                    branch_name:     branch?.name,
                    items:           cart.map(i => ({ product_name: i.name, variant_name: i.variant_name, quantity: i.qty, price: i.price })),
                });
                setShowPayment(false);
                setActiveTableOrderId(null);
                setCart([]);
                setLoading(false);
            },
            onError: errors => {
                setError(Object.values(errors)[0] as string ?? "Transaction failed.");
                setLoading(false);
            },
        });
    };

    // Keyboard shortcuts
    useEffect(() => {
        const fn = (e: KeyboardEvent) => {
            if (e.key === "F2")                { e.preventDefault(); searchRef.current?.focus(); }
            if (e.key === "F5")                { e.preventDefault(); barcodeRef.current?.focus(); }
            if (e.key === "F9" && cart.length) { e.preventDefault(); setShowPayment(true); }
            if (e.key === "Escape")            { setShowPayment(false); setVariantFor(null); }
        };
        window.addEventListener("keydown", fn);
        return () => window.removeEventListener("keydown", fn);
    }, [cart]);

    // ── Kiosk / Mobile: full-screen layout, no sidebar ────────────────────────
    if (layout === "kiosk" || layout === "mobile") {
        const isMobile = layout === "mobile";
        return (
            <AdminLayout>
                <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden -m-6">
                    {/* Kiosk top bar */}
                    {/* Top bar — compact on mobile, full on kiosk */}
                    <div className={cn("shrink-0 flex items-center gap-2 border-b border-border bg-card",
                        isMobile ? "px-3 py-2 flex-wrap" : "px-4 py-2")}>
                        <span className="text-sm font-bold text-foreground truncate">{branch?.name ?? "POS"}</span>
                        <div className={cn("relative", isMobile ? "flex-1 min-w-[160px]" : "w-56")}>
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Search…"
                                className="w-full h-9 pl-9 pr-3 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary" />
                        </div>
                        {/* Category bar */}
                        <CategoryBar
                            categories={categories}
                            activeCat={activeCat}
                            onChange={setActiveCat}
                            className={cn("flex-wrap", isMobile ? "w-full" : "max-w-[60vw]")}
                        />
                    </div>

                    {isMobile ? (
                        <MobileLayout
                            filtered={filtered} cart={cart} currency={currency}
                            onProductClick={handleProductClick}
                            onCharge={() => { setError(null); setShowPayment(true); }}
                            subtotal={subtotal} itemCount={itemCount}
                            onClear={clearCart}
                            onUpdateQty={updateQty}
                            onRemove={removeItem}
                        />
                    ) : (
                        <KioskLayout
                            filtered={filtered} cart={cart} currency={currency}
                            onProductClick={handleProductClick}
                            onCharge={() => { setError(null); setShowPayment(true); }}
                            subtotal={subtotal} itemCount={itemCount} onClear={clearCart}
                        />
                    )}
                </div>

                {variantFor && (
                    <VariantPicker product={variantFor} currency={currency}
                        onSelect={(vid, vname) => { addItem(variantFor, vid, vname); setVariantFor(null); }}
                        onClose={() => setVariantFor(null)} />
                )}
                {showPayment && (
                    <PaymentModal subtotal={subtotal} settings={settings} currency={currency}
                        customerNameRequired={requireCustomerName}
                        promos={promos}
                        cart={cart}
                        onConfirm={handleConfirm}
                        onClose={() => { setShowPayment(false); setError(null); }}
                        loading={loading} />
                )}
                {receipt && <SaleSuccessModal receipt={receipt} currency={currency} onNewSale={() => setReceipt(null)} />}
            </AdminLayout>
        );
    }

    // ── Restaurant mode: no sidebar cart, table panel + product panel ─────────
    const isRestaurantMode = layout === "restaurant";

    return (
        <AdminLayout>
            <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden -m-6">

                {/* Top bar */}
                <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border bg-card">
                    {/* Session */}
                    <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0",
                        session ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400")}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", session ? "bg-green-500" : "bg-amber-500")} />
                        {session ? "Session open" : "No session"}
                    </div>

                    <span className="text-sm font-bold text-foreground hidden sm:block truncate max-w-[160px]">{branch?.name ?? "POS"}</span>

                    {/* Business type badge */}
                    {businessType && (
                        <span className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold capitalize">
                            {businessType.replace("_", " ")}
                        </span>
                    )}

                    {/* Barcode */}
                    <div className={cn("relative w-48", layout !== "grocery" && "hidden sm:block")}>
                        <ScanLine className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input ref={barcodeRef} value={barcodeVal}
                            onChange={e => setBarcodeVal(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") handleBarcode(barcodeVal); }}
                            placeholder="Barcode (F5)"
                            className="w-full h-8 pl-8 pr-3 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground" />
                    </div>

                    <div className="flex-1" />
                    <a href={routes.sales.history()}
                        className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <History className="h-3.5 w-3.5" />
                        <span className="hidden sm:block">History</span>
                    </a>
                    <button onClick={() => window.location.reload()}
                        className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                </div>

                {/* Main content */}
                <div className="flex flex-1 overflow-hidden">

                    {/* Product panel */}
                    <div className="flex-1 flex flex-col overflow-hidden border-r border-border">

                        {/* Search + categories — not shown for cafe (has its own) or restaurant (table panel) */}
                        {layout !== "cafe" && layout !== "restaurant" && (
                            <div className={cn("shrink-0 border-b border-border bg-background p-3 space-y-2.5",
                                layout === "grocery" && "p-2 space-y-1.5")}>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
                                        placeholder="Search products… (F2)"
                                        className={cn("w-full pl-9 pr-9 text-sm bg-card border border-border focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground",
                                            layout === "grocery" ? "h-10 rounded-xl font-medium" : "h-9 rounded-xl")} />
                                    {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
                                </div>
                                <CategoryBar
                                    categories={categories}
                                    activeCat={activeCat}
                                    onChange={setActiveCat}
                                />
                            </div>
                        )}

                        {/* Salon search bar */}
                        {layout === "salon" && (
                            <div className="shrink-0 border-b border-border bg-background px-3 py-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
                                        placeholder="Search services…"
                                        className="w-full h-9 pl-9 pr-9 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground" />
                                    {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="h-3.5 w-3.5" /></button>}
                                </div>
                            </div>
                        )}

                        {/* Products area */}
                        <div className={cn("flex-1 overflow-hidden", layout === "cafe" || layout === "restaurant" ? "" : "overflow-y-auto",
                            layout !== "grocery" && layout !== "cafe" && layout !== "restaurant" && layout !== "salon" && layout !== "mobile" && "p-3")}>
                            {filtered.length === 0 && layout !== "cafe" && layout !== "restaurant" && layout !== "mobile" ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                                    <Package className="h-10 w-10 opacity-20" />
                                    <p className="text-sm">No products found</p>
                                </div>
                            ) : layout === "grid" ? (
                                <GridLayout filtered={filtered} cart={cart} currency={currency} onProductClick={handleProductClick} />
                            ) : layout === "tablet" ? (
                                <TabletLayout filtered={filtered} cart={cart} currency={currency} onProductClick={handleProductClick} />
                            ) : layout === "grocery" ? (
                                <GroceryLayout filtered={filtered} cart={cart} currency={currency} onProductClick={handleProductClick} />
                            ) : layout === "cafe" ? (
                                <CafeLayout
                                    filtered={filtered} allProducts={products} categories={categories}
                                    activeCat={activeCat} onCatChange={setActiveCat}
                                    cart={cart} currency={currency} onProductClick={handleProductClick} />
                            ) : layout === "restaurant" ? (
                                <RestaurantLayout
                                    filtered={filtered} cart={cart} currency={currency} onProductClick={handleProductClick}
                                    openTableOrders={open_table_orders ?? []} diningTables={dining_tables ?? []}
                                    activeTableOrderId={activeTableOrderId}
                                    onSelectTable={setActiveTableOrderId} onNewTable={() => setActiveTableOrderId(null)} />
                            ) : layout === "salon" ? (
                                <SalonLayout filtered={filtered} cart={cart} currency={currency} onProductClick={handleProductClick} />
                            ) : null}
                        </div>
                    </div>

                    {/* Cart panel — hidden in restaurant (table panel handles flow) */}
                    {!isRestaurantMode && (
                        <div className={cn("shrink-0 flex flex-col border-l border-border",
                            layout === "tablet" || layout === "salon" ? "w-80 xl:w-96" : "w-72 lg:w-80 xl:w-96")}>
                            <CartPanel
                                cart={cart} subtotal={subtotal} itemCount={itemCount}
                                currency={currency} error={error}
                                onUpdateQty={updateQty} onRemove={removeItem}
                                onClear={clearCart}
                                onCharge={() => { setError(null); setShowPayment(true); }}
                            />
                        </div>
                    )}

                    {/* Restaurant: cart is a floating panel inside the layout itself, but charge button in top right */}
                    {isRestaurantMode && cart.length > 0 && (
                        <div className="shrink-0 w-72 lg:w-80 xl:w-96 flex flex-col border-l border-border">
                            <CartPanel
                                cart={cart} subtotal={subtotal} itemCount={itemCount}
                                currency={currency} error={error}
                                onUpdateQty={updateQty} onRemove={removeItem}
                                onClear={clearCart}
                                onCharge={() => { setError(null); setShowPayment(true); }}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            {variantFor && (
                <VariantPicker product={variantFor} currency={currency}
                    onSelect={(vid, vname) => { addItem(variantFor, vid, vname); setVariantFor(null); }}
                    onClose={() => setVariantFor(null)} />
            )}
            {showPayment && (
                <PaymentModal subtotal={subtotal} settings={settings} currency={currency}
                    customerNameRequired={requireCustomerName}
                    promos={promos}
                    cart={cart}
                    onConfirm={handleConfirm}
                    onClose={() => { setShowPayment(false); setError(null); }}
                    loading={loading} />
            )}
            {receipt && <SaleSuccessModal receipt={receipt} currency={currency} onNewSale={() => setReceipt(null)} />}
        </AdminLayout>
    );
}