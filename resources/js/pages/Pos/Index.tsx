"use client";
import { lazy, Suspense, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { usePage, router } from "@inertiajs/react";
import AdminLayout from "@/layouts/AdminLayout";
import ReceiptTemplate, { fmtMoney, ReceiptData } from "./ReceiptTemplate";
import { QRCodeSVG } from "qrcode.react";
import { routes } from "@/routes";
import { cn } from "@/lib/utils";
import {
    Search, X, Plus, Minus, Trash2, ShoppingCart, Tag,
    CreditCard, Banknote, Smartphone, CheckCircle2,
    AlertTriangle, Package, History, ScanLine, Printer, QrCode,
    RefreshCw, Zap, User, ChevronDown, Wallet, CalendarClock, Unlock,
    Check, Layers, Bell, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { echo } from "@/echo";
import type { Product, CartItem, Category, TableOrder, DiningTable, ActivePromo, QueuedOrder } from "./posTypes";

function playOrderChime() {
    try {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtxClass) return;
        const audioCtx = new AudioCtxClass();
        if (audioCtx.state === "suspended") {
            void audioCtx.resume();
        }
        const now = audioCtx.currentTime;

        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(587.33, now); // D5
        gain1.gain.setValueAtTime(0.18, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc1.connect(gain1);
        gain1.connect(audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.28);

        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(880, now + 0.1); // A5
        gain2.gain.setValueAtTime(0.18, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start(now + 0.1);
        osc2.stop(now + 0.48);
    } catch {
        // Ignore audio playback errors if user hasn't interacted yet
    }
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface Session  { id: number; opening_cash: number; opened_at: string; status: string; }
interface Branch   { id: number; name: string; business_type: string; feature_flags: Record<string, boolean>; }
interface PageProps {
    auth: { user: { fname: string; lname: string; role_label: string; is_cashier: boolean; cashier_type?: string; can_collect_payments?: boolean } | null };
    settings: {
        allow_discount: boolean; max_discount_percent: number;
        default_payment: string; vat_enabled: boolean;
        vat_rate: number; vat_inclusive: boolean; require_cash_session: boolean;
        enable_installments: boolean;
        hide_product_names_on_receipt: boolean;
    } | null;
    app: { currency: string };
    products: Product[];
    categories: Category[];
    session: Session | null;
    branch: Branch | null;
    open_table_orders: TableOrder[];
    dining_tables: DiningTable[];
    preferred_layout: string;
    cashier_type?: string;
    can_collect_payments?: boolean;
    pending_orders?: QueuedOrder[];
    promos: ActivePromo[];
    [key: string]: unknown;
}
type PayMethod   = "cash" | "gcash" | "card" | "others" | "installment";
type LayoutMode  = "grid" | "tablet" | "grocery" | "restaurant" | "cafe" | "salon" | "kiosk" | "mobile" | "order_only" | "fast_cashier";

const METHODS: { value: PayMethod; label: string; icon: React.ElementType }[] = [
    { value: "cash",        label: "Cash",        icon: Banknote   },
    { value: "gcash",       label: "GCash",       icon: Smartphone },
    { value: "card",        label: "Card",        icon: CreditCard },
    { value: "others",      label: "Others",      icon: Wallet     },
    { value: "installment", label: "Installment", icon: CalendarClock },
];

// ─── Lazy-loaded layout chunks (each downloads only when that layout is used) ─
const GridLayout       = lazy(() => import("./layouts/GridLayout"));
const TabletLayout     = lazy(() => import("./layouts/TabletLayout"));
const GroceryLayout    = lazy(() => import("./layouts/GroceryLayout"));
const CafeLayout       = lazy(() => import("./layouts/CafeLayout"));
const RestaurantLayout = lazy(() => import("./layouts/RestaurantLayout"));
const SalonLayout      = lazy(() => import("./layouts/SalonLayout"));
const KioskLayout      = lazy(() => import("./layouts/KioskLayout"));
const MobileLayout     = lazy(() => import("./layouts/MobileLayout"));

function LayoutSpinner() {
    return (
        <div className="flex items-center justify-center h-full min-h-[300px]">
            <span className="h-7 w-7 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>
    );
}

// ─── CategoryDropdown (shadcn Popover & Searchable Filter) ───────────────────
function CategoryDropdown({ categories, activeCat, onChange }: {
    categories: Category[]; activeCat: number | null; onChange: (id: number | null) => void;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    if (!categories.length) return null;

    const current = activeCat ? categories.find(c => c.id === activeCat) : null;
    const filtered = search.trim()
        ? categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
        : categories;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                        "h-9 px-3 text-xs font-medium rounded-xl justify-between gap-2 min-w-[130px] max-w-[200px] transition-all bg-background border-border",
                        activeCat !== null && "border-[#35425F] bg-[#35425F]/5 text-[#35425F] dark:border-[#F50069] dark:bg-[#F50069]/10 dark:text-[#F50069] font-semibold"
                    )}
                >
                    <div className="flex items-center gap-1.5 min-w-0 truncate">
                        <Tag className={cn("h-3.5 w-3.5 shrink-0", activeCat !== null ? "text-[#F50069]" : "text-[#6B7280]")} />
                        <span className="truncate">{current?.name ?? "All Categories"}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {activeCat !== null ? (
                            <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onChange(null);
                                }}
                                className="h-4 w-4 rounded-full flex items-center justify-center hover:bg-muted text-[#6B7280] hover:text-foreground transition-colors cursor-pointer"
                                title="Clear filter"
                            >
                                <X className="h-3 w-3" />
                            </span>
                        ) : (
                            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                        )}
                    </div>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2 rounded-2xl shadow-xl border-border bg-popover" align="start">
                <div className="px-2 pt-1 pb-2">
                    <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">
                        Filter by Category
                    </p>
                </div>
                {categories.length > 6 && (
                    <div className="relative mb-2 px-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6B7280]" />
                        <input
                            type="text"
                            placeholder="Search categories..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full h-8 pl-8 pr-2.5 text-xs bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                        />
                    </div>
                )}
                <div className="max-h-60 overflow-y-auto space-y-0.5">
                    <button
                        onClick={() => { onChange(null); setOpen(false); }}
                        className={cn(
                            "w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-left transition-colors",
                            activeCat === null
                                ? "bg-[#35425F] text-white dark:bg-[#F50069] dark:text-white font-bold"
                                : "text-foreground hover:bg-accent"
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <Layers className="h-3.5 w-3.5 opacity-70 shrink-0" />
                            <span>All Categories</span>
                        </div>
                        {activeCat === null && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                    <div className="my-1 border-t border-border/50" />
                    {filtered.length === 0 ? (
                        <p className="text-center text-xs text-muted-foreground py-3">No categories match "{search}"</p>
                    ) : (
                        filtered.map(c => (
                            <button
                                key={c.id}
                                onClick={() => { onChange(c.id); setOpen(false); }}
                                className={cn(
                                    "w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-left transition-colors",
                                    activeCat === c.id
                                        ? "bg-[#35425F] text-white dark:bg-[#F50069] dark:text-white font-bold"
                                        : "text-foreground hover:bg-accent"
                                )}
                            >
                                <span className="truncate">{c.name}</span>
                                {activeCat === c.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                            </button>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}

// ─── VariantPicker ────────────────────────────────────────────────────────────
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
                    <button
                        onClick={() => onSelect(null, null)}
                        disabled={(product.base_stock ?? product.stock) <= 0}
                        className="flex flex-col items-start gap-1 p-3 rounded-xl border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all text-left disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-background"
                    >
                        <span className="text-sm font-semibold text-foreground">Base</span>
                        <span className="text-xs text-muted-foreground">{fmtMoney(product.price, currency)}</span>
                    </button>
                    {product.variants.filter(v => v.is_available).map(v => {
                        const disabled = (v.stock ?? 0) <= 0 || !!v.is_expired;
                        const price = v.price ?? product.price + v.extra_price;

                        return (
                        <button key={v.id} onClick={() => onSelect(v.id, v.name)} disabled={disabled}
                            className="flex flex-col items-start gap-1 p-3 rounded-xl border border-border bg-background hover:border-primary/50 hover:bg-primary/5 transition-all text-left disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-background">
                            <span className="text-sm font-semibold text-foreground">{v.name}</span>
                            <span className="text-xs text-muted-foreground">
                                {fmtMoney(price, currency)}{disabled ? " · unavailable" : ""}
                            </span>
                        </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// ─── PaymentModal ─────────────────────────────────────────────────────────────
function PaymentModal({ subtotal, settings, currency, customerNameRequired, promos, cart, onConfirm, onClose, loading, serverError }: {
    subtotal: number; settings: PageProps["settings"]; currency: string;
    customerNameRequired?: boolean; promos: ActivePromo[]; cart: CartItem[];
    onConfirm: (d: {
        payment_method: PayMethod; payment_amount: number; customer_name: string;
        discount_percent: number; promo_id: number | null;
        installment_provider?: string; installment_reference?: string;
        installment_customer_phone?: string; installment_down_payment?: number;
        installments_count?: number; installment_notes?: string;
    }) => void;
    onClose: () => void; loading: boolean; serverError?: string | null;
}) {
    const enableInstallments = settings?.enable_installments ?? false;
    const [method,       setMethod]       = useState<PayMethod>((settings?.default_payment ?? "cash") as PayMethod);
    const [tender,       setTender]       = useState("");
    const [customer,     setCustomer]     = useState("");
    const [discPct,      setDiscPct]      = useState("");
    const [promoCode,    setPromoCode]    = useState("");
    const [appliedPromo, setAppliedPromo] = useState<ActivePromo | null>(null);
    const [promoError,   setPromoError]   = useState("");
    const [showPromos,   setShowPromos]   = useState(false);
    // Financing / installment fields
    const [instProvider,   setInstProvider]   = useState<"home_credit"|"skyro"|"other">("home_credit");
    const [instReference,  setInstReference]  = useState("");
    const [instPhone,      setInstPhone]      = useState("");
    const [instDown,       setInstDown]       = useState("0");
    const [instCount,      setInstCount]      = useState("6");
    const [instNotes,      setInstNotes]      = useState("");

    const isInstallment = method === "installment";

    const r2 = (v: number) => Math.round(v * 100) / 100; // round to 2 decimal places — matches PHP round($v, 2)

    const disc      = Math.min(parseFloat(discPct) || 0, settings?.max_discount_percent ?? 100);
    const discAmt   = r2(subtotal * disc / 100);
    const afterDisc = r2(subtotal - discAmt);

    const promoAppliesToCart = (p: ActivePromo) => {
        if (p.applies_to === 'all') return true;
        if (p.applies_to === 'specific_products') return cart.some(i => p.product_ids.includes(i.product_id));
        return p.category_ids.length > 0;
    };
    const computePromoAmt = (p: ActivePromo | null) => {
        if (!p) return 0;
        if (p.minimum_purchase && afterDisc < p.minimum_purchase) return 0;
        return p.discount_type === 'percent'
            ? r2(afterDisc * p.discount_value / 100)
            : Math.min(r2(p.discount_value), afterDisc);
    };
    const promoAmt   = computePromoAmt(appliedPromo);
    const afterPromo = r2(afterDisc - promoAmt);
    const vatRate    = (settings?.vat_enabled && !settings?.vat_inclusive) ? (settings.vat_rate ?? 0) : 0;
    const vatAmt     = r2(afterPromo * vatRate / 100);
    const total      = afterPromo + vatAmt;
    const tenderN    = parseFloat(tender) || 0;
    const change     = Math.max(0, tenderN - total);
    const isCash     = method === "cash";
    const downN      = parseFloat(instDown) || 0;
    const canPay     = total > 0
        && (!isCash || tenderN >= total)
        && (!customerNameRequired || customer.trim().length > 0)
        && (!isInstallment || (customer.trim().length > 0 && !!instProvider && parseInt(instCount) >= 1 && downN >= 0));
    const append     = (v: string) => setTender(p => (p === "0" || p === "") ? v : p + v);
    const backspace  = () => setTender(p => p.slice(0, -1));

    const eligiblePromos  = promos.filter(promoAppliesToCart);
    const noCodePromos    = eligiblePromos.filter(p => !p.code);
    const codePromos      = eligiblePromos.filter(p => !!p.code);

    const applyPromoCode = () => {
        setPromoError("");
        const code = promoCode.trim().toUpperCase();
        if (!code) return;
        const found = promos.find(p => p.code?.toUpperCase() === code);
        if (!found) { setPromoError("Promo code not found or expired."); return; }
        if (!promoAppliesToCart(found)) { setPromoError("This promo does not apply to any item in the cart."); return; }
        if (found.minimum_purchase && afterDisc < found.minimum_purchase) {
            setPromoError("Minimum purchase of " + fmtMoney(found.minimum_purchase, currency) + " required."); return;
        }
        if (computePromoAmt(found) <= 0) { setPromoError("This promo gives no discount on the current cart total."); return; }
        setAppliedPromo(found); setPromoError(""); setShowPromos(false);
    };
    const applyDirect = (p: ActivePromo) => {
        if (p.minimum_purchase && afterDisc < p.minimum_purchase) {
            setPromoError("Minimum purchase of " + fmtMoney(p.minimum_purchase, currency) + " required for " + p.name + "."); return;
        }
        setAppliedPromo(p); setPromoError(""); setShowPromos(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl flex flex-col max-h-[92vh]">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                    <p className="font-bold text-foreground">Checkout</p>
                    <button onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Order summary */}
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

                    {/* Promos */}
                    {eligiblePromos.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                    Promo {!appliedPromo && <span className="ml-2 text-emerald-600 dark:text-emerald-400">{eligiblePromos.length} available</span>}
                                </label>
                                {!appliedPromo && <button onClick={() => setShowPromos(v => !v)} className="text-[10px] text-primary hover:underline">{showPromos ? "Hide" : "Browse promos"}</button>}
                            </div>
                            {appliedPromo ? (
                                <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                                    <Tag className="h-4 w-4 text-emerald-500 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{appliedPromo.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {appliedPromo.discount_type === 'percent' ? `${appliedPromo.discount_value}% off` : `₱${appliedPromo.discount_value.toFixed(2)} off`}
                                            {appliedPromo.code && <span className="ml-1.5 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded">{appliedPromo.code}</span>}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">−{fmtMoney(promoAmt, currency)}</p>
                                        <button onClick={() => { setAppliedPromo(null); setPromoCode(""); setPromoError(""); }} className="text-[10px] text-muted-foreground hover:text-destructive">Remove</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2">
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
                                    {promoError && <p className="text-xs text-destructive flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 shrink-0" />{promoError}</p>}
                                    {noCodePromos.length > 0 && (
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Available promos</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {noCodePromos.map(p => {
                                                    const amt    = computePromoAmt(p);
                                                    const locked = !!(p.minimum_purchase && afterDisc < p.minimum_purchase);
                                                    return (
                                                        <button key={p.id} onClick={() => !locked && applyDirect(p)} disabled={locked}
                                                            className={cn("flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl border transition-all",
                                                                locked ? "border-border text-muted-foreground/50 cursor-not-allowed"
                                                                    : "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10")}>
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
                                    {showPromos && codePromos.length > 0 && (
                                        <div className="border border-border rounded-xl overflow-hidden">
                                            <p className="px-3 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/30">Code-required promos</p>
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
                                                                    <span className="text-xs text-muted-foreground">{p.discount_type === 'percent' ? `${p.discount_value}%` : `₱${p.discount_value.toFixed(2)}`} off</span>
                                                                    {p.minimum_purchase && <span className="text-xs text-muted-foreground/60">min {fmtMoney(p.minimum_purchase, currency)}</span>}
                                                                </div>
                                                            </div>
                                                            {amt > 0 && !locked && <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 shrink-0">−{fmtMoney(amt, currency)}</span>}
                                                            {locked && <span className="text-xs text-muted-foreground/50 shrink-0">locked</span>}
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

                    {/* Customer name */}
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
                        <div className={cn("grid gap-1.5", enableInstallments ? "grid-cols-5" : "grid-cols-4")}>
                            {METHODS.filter(m => m.value !== "installment" || enableInstallments).map(m => { const Icon = m.icon; return (
                                <button key={m.value} onClick={() => setMethod(m.value)}
                                    className={cn("flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border text-[11px] font-semibold transition-all",
                                        method === m.value ? "bg-primary text-primary-foreground border-primary shadow-sm" : "border-border hover:border-primary/40 hover:bg-accent text-foreground")}>
                                    <Icon className="h-4 w-4" />{m.label}
                                </button>
                            ); })}
                        </div>
                    </div>

                    {/* Financing details panel */}
                    {isInstallment && (
                        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 space-y-3">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                                <CalendarClock className="h-3.5 w-3.5" /> Financing Details
                            </p>

                            {/* Provider — required */}
                            <div>
                                <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">
                                    Financing Provider <span className="text-destructive">*</span>
                                </label>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {(["home_credit","skyro","other"] as const).map(p => (
                                        <button key={p} type="button" onClick={() => setInstProvider(p)}
                                            className={cn("h-9 rounded-lg border text-xs font-semibold transition-all",
                                                instProvider === p
                                                    ? "bg-primary text-primary-foreground border-primary"
                                                    : "border-border text-foreground hover:border-primary/40 hover:bg-accent")}>
                                            {p === "home_credit" ? "Home Credit" : p === "skyro" ? "Skyro" : "Other"}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Reference / Application number */}
                            <div>
                                <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">Application / Reference No. <span className="text-muted-foreground/50">(optional)</span></label>
                                <input value={instReference} onChange={e => setInstReference(e.target.value)}
                                    placeholder="e.g. HC-2024-XXXXXX"
                                    className="w-full h-9 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground" />
                            </div>

                            {/* Customer phone */}
                            <div>
                                <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">Customer Phone <span className="text-muted-foreground/50">(optional)</span></label>
                                <input value={instPhone} onChange={e => setInstPhone(e.target.value)}
                                    placeholder="e.g. 09XX-XXX-XXXX"
                                    className="w-full h-9 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground" />
                            </div>

                            {/* Down payment — optional, 0 = no DP */}
                            <div>
                                <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">Down Payment <span className="text-muted-foreground/50">(0 = no DP)</span></label>
                                <div className="flex gap-2 items-center">
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{currency}</span>
                                        <input value={instDown} onChange={e => setInstDown(e.target.value)}
                                            type="number" min="0" step="0.01"
                                            className="w-full h-9 pl-8 pr-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground" />
                                    </div>
                                    <button onClick={() => setInstDown("0")}
                                        className="h-9 px-3 rounded-lg border border-border text-xs font-medium hover:border-primary/40 hover:bg-accent transition-colors whitespace-nowrap">
                                        No DP
                                    </button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Financed amount: <span className="font-semibold text-foreground">{fmtMoney(Math.max(0, total - downN), currency)}</span>
                                </p>
                            </div>

                            {/* Terms (months) */}
                            <div>
                                <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">Terms (months)</label>
                                <div className="grid grid-cols-5 gap-1.5">
                                    {[3, 6, 9, 12, 18, 24, 30, 36].map(n => (
                                        <button key={n} type="button" onClick={() => setInstCount(String(n))}
                                            className={cn("h-9 rounded-lg border text-xs font-semibold transition-all",
                                                instCount === String(n)
                                                    ? "bg-primary text-primary-foreground border-primary"
                                                    : "border-border text-foreground hover:border-primary/40 hover:bg-accent")}>
                                            {n}mo
                                        </button>
                                    ))}
                                </div>
                                {downN < total && parseInt(instCount) > 0 && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        ≈ {fmtMoney(Math.round((total - downN) / parseInt(instCount) * 100) / 100, currency)}/month
                                    </p>
                                )}
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block mb-1">Notes <span className="text-muted-foreground/50">(optional)</span></label>
                                <input value={instNotes} onChange={e => setInstNotes(e.target.value)}
                                    placeholder="e.g. voucher, special terms…"
                                    className="w-full h-9 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground" />
                            </div>
                        </div>
                    )}

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
                    {/* Server-side validation errors — shown inside the modal so they're never hidden */}
                    {serverError && (
                        <div className="mb-3 flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/30 px-3 py-2.5 text-xs text-destructive">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>{serverError}</span>
                        </div>
                    )}
                    {isInstallment && !customer.trim() && (
                        <p className="text-xs text-destructive mb-2 flex items-center gap-1.5"><AlertTriangle className="h-3 w-3 shrink-0" />Customer name is required for installments.</p>
                    )}
                    <Button className="w-full h-12 text-base font-bold gap-2" disabled={!canPay || loading}
                        onClick={() => onConfirm({
                            payment_method:           method,
                            payment_amount:           isCash ? tenderN : (isInstallment ? downN : total),
                            customer_name:            customer,
                            discount_percent:         disc,
                            promo_id:                 appliedPromo?.id ?? null,
                            ...(isInstallment ? {
                                installment_provider:       instProvider,
                                installment_reference:      instReference || undefined,
                                installment_customer_phone: instPhone || undefined,
                                installment_down_payment:   downN,
                                installments_count:         parseInt(instCount),
                                installment_notes:          instNotes || undefined,
                            } : {}),
                        })}>
                        {loading ? <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" /> : (
                            isInstallment
                                ? <><CalendarClock className="h-4 w-4" />
                                    Record {instProvider === "home_credit" ? "Home Credit" : instProvider === "skyro" ? "Skyro" : "Financing"}
                                    {downN > 0 ? ` · DP ${fmtMoney(downN, currency)}` : " · No DP"}
                                  </>
                                : <><Zap className="h-4 w-4" />Checkout {fmtMoney(total, currency)}</>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── SaleSuccessModal ─────────────────────────────────────────────────────────
function SaleSuccessModal({ receipt, currency, installmentPlanId, onNewSale }: {
    receipt: ReceiptData; currency: string;
    installmentPlanId?: number | null;
    onNewSale: () => void;
}) {
    const isInstallment = receipt.payment_method === "installment";
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm shadow-2xl flex flex-col max-h-[92vh]">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
                    <div className={cn("p-1.5 rounded-full", isInstallment ? "bg-primary/10" : "bg-green-100 dark:bg-green-900/40")}>
                        {isInstallment
                            ? <CalendarClock className="h-5 w-5 text-primary" />
                            : <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />}
                    </div>
                    <div>
                        <p className="font-bold text-foreground">
                            {isInstallment ? "Installment plan created" : "Sale completed"}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">{receipt.receipt_number}</p>
                    </div>
                </div>

                {/* Installment summary banner */}
                {isInstallment && installmentPlanId && (
                    <div className="mx-4 mt-4 p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                        <p className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                            <CalendarClock className="h-3.5 w-3.5" /> Installment Plan Active
                        </p>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Total</span>
                            <span className="font-bold">{fmtMoney(receipt.total, currency)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Down payment collected</span>
                            <span className="font-semibold text-green-600 dark:text-green-400">
                                {fmtMoney(receipt.payment_amount, currency)}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Remaining balance</span>
                            <span className="font-bold text-foreground">
                                {fmtMoney(Math.max(0, receipt.total - receipt.payment_amount), currency)}
                            </span>
                        </div>
                        <a href={`/installments/${installmentPlanId}`}
                            className="mt-1 flex items-center justify-center gap-1.5 w-full h-9 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
                            <CalendarClock className="h-3.5 w-3.5" /> View Installment Plan
                        </a>
                    </div>
                )}

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

// ─── CartPanel ────────────────────────────────────────────────────────────────
function QueuedOrderModal({ order, currency, onClose }: {
    order: QueuedOrder; currency: string; onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm shadow-2xl flex flex-col max-h-[92vh]">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0 print:hidden">
                    <div className="p-1.5 rounded-full bg-primary/10"><QrCode className="h-5 w-5 text-primary" /></div>
                    <div className="min-w-0 flex-1">
                        <p className="font-bold text-foreground">Order listed</p>
                        <p className="text-xs text-muted-foreground font-mono">{order.ticket_number}</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                    <div className="mx-auto w-[280px] bg-white text-black p-5 rounded-sm print:w-full print:p-0">
                        <div className="text-center border-b border-dashed border-black/40 pb-3">
                            <p className="text-lg font-black">ORDER TICKET</p>
                            <p className="font-mono text-sm">{order.ticket_number}</p>
                            {order.customer_name && <p className="text-sm mt-1">{order.customer_name}</p>}
                        </div>
                        <div className="flex justify-center py-4">
                            <QRCodeSVG value={order.qr_token} size={150} level="M" />
                        </div>
                        <p className="text-center font-mono text-xs tracking-widest">{order.qr_token}</p>
                        <div className="my-3 border-y border-dashed border-black/40 py-2 space-y-1">
                            {order.items.map((item, index) => (
                                <div key={`${item.product_id}-${item.variant_id ?? "base"}-${index}`} className="flex gap-2 text-xs">
                                    <span className="w-6 text-right">{item.quantity}x</span>
                                    <span className="flex-1">{item.product_name}{item.variant_name ? ` (${item.variant_name})` : ""}</span>
                                    <span>{fmtMoney(item.total, currency)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between text-sm font-black">
                            <span>Total</span>
                            <span>{fmtMoney(order.total, currency)}</span>
                        </div>
                        <p className="mt-3 text-center text-[10px] uppercase tracking-wide">Present this for payment</p>
                    </div>
                </div>
                <div className="px-4 pb-5 pt-3 border-t border-border shrink-0 print:hidden grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-11 font-bold" onClick={onClose}>Done</Button>
                    <Button className="h-11 font-bold gap-2" onClick={() => window.print()}>
                        <Printer className="h-4 w-4" />Print
                    </Button>
                </div>
            </div>
        </div>
    );
}

function OpenSessionModal({ currency, onClose }: { currency: string; onClose: () => void }) {
    const amountRef = useRef<HTMLInputElement>(null);
    const [amount, setAmount] = useState(() => localStorage.getItem("pos:lastOpeningCash") ?? "0");
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const openingCash = Math.max(0, parseFloat(amount) || 0);

    useEffect(() => {
        setTimeout(() => {
            amountRef.current?.focus();
            amountRef.current?.select();
        }, 50);
    }, []);

    const openSession = () => {
        setLoading(true);
        setError("");
        router.post(routes.cashSessions.open(), {
            opening_cash: openingCash,
            notes: notes.trim() || null,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                localStorage.setItem("pos:lastOpeningCash", String(openingCash));
                setLoading(false);
                onClose();
                router.reload({ only: ["session"] });
            },
            onError: errors => {
                setError(Object.values(errors)[0] as string ?? "Unable to start cash session.");
                setLoading(false);
            },
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/45 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm shadow-2xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <div>
                        <p className="font-bold text-foreground flex items-center gap-2">
                            <Unlock className="h-4 w-4 text-emerald-500" /> Start Cash Session
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">Enter drawer opening cash.</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Opening cash</label>
                        <input
                            ref={amountRef}
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            inputMode="decimal"
                            className="w-full h-12 rounded-xl border border-border bg-background px-3 text-xl font-black tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {[0, 500, 1000, 2000].map(value => (
                            <button key={value} type="button" onClick={() => setAmount(String(value))}
                                className="h-9 rounded-lg border border-border text-xs font-bold hover:bg-muted">
                                {value === 0 ? "Zero" : fmtMoney(value, currency)}
                            </button>
                        ))}
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Notes</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={2}
                            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            placeholder="Optional"
                        />
                    </div>
                    {error && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{error}
                        </div>
                    )}
                </div>
                <div className="px-5 pb-5 grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-11 font-bold" onClick={onClose} disabled={loading}>Cancel</Button>
                    <Button className="h-11 font-bold gap-2" onClick={openSession} disabled={loading}>
                        {loading ? <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" /> : <Unlock className="h-4 w-4" />}
                        Start
                    </Button>
                </div>
            </div>
        </div>
    );
}

function CartPanel({ cart, subtotal, itemCount, currency, error, canCharge, orderOnly, activeQueuedOrder, onClearQueuedOrder, onUpdateQty, onRemove, onClear, onCharge, onQueue }: {
    cart: CartItem[]; subtotal: number; itemCount: number; currency: string;
    error: string | null; canCharge: boolean; orderOnly?: boolean;
    activeQueuedOrder?: QueuedOrder | null;
    onClearQueuedOrder?: () => void;
    onUpdateQty: (key: string, d: number) => void;
    onRemove: (key: string) => void; onClear: () => void; onCharge: () => void; onQueue: () => void;
}) {
    return (
        <div className="flex flex-col bg-card h-full">
            <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold">Cart</span>
                    {itemCount > 0 && (
                        <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 min-w-[16px] flex items-center justify-center px-1">{itemCount}</span>
                    )}
                </div>
                {cart.length > 0 && (
                    <button onClick={onClear} className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1">
                        <Trash2 className="h-3 w-3" />Clear
                    </button>
                )}
            </div>

            {activeQueuedOrder && (
                <div className="mx-3 mt-2.5 p-2.5 rounded-xl border border-primary/30 bg-primary/5 dark:bg-primary/10 flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black font-mono text-primary truncate">
                                    {activeQueuedOrder.ticket_number}
                                </span>
                                <span className="text-[10px] bg-primary/15 text-primary font-bold px-1.5 py-0.5 rounded-md">
                                    Pending
                                </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                                {activeQueuedOrder.customer_name ? `${activeQueuedOrder.customer_name} • ` : ""}{activeQueuedOrder.listed_by ?? "Order taker"}
                            </p>
                        </div>
                    </div>
                    {onClearQueuedOrder && (
                        <button
                            type="button"
                            onClick={onClearQueuedOrder}
                            className="text-[11px] font-bold text-muted-foreground hover:text-destructive px-2 py-1 rounded-lg hover:bg-destructive/10 transition-colors shrink-0"
                            title="Unlink pending ticket"
                        >
                            Unlink
                        </button>
                    )}
                </div>
            )}

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
                    {orderOnly ? (
                        <Button variant="outline" className="h-12 w-full text-sm font-bold gap-2" onClick={onQueue}>
                            <QrCode className="h-4 w-4" />PRINT QR
                        </Button>
                    ) : (
                        <Button className="h-12 w-full text-sm font-bold gap-2" onClick={onCharge} disabled={!canCharge}>
                            <Zap className="h-4 w-4" />Checkout
                        </Button>
                    )}
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

function FastCashierLayout({ cart, subtotal, itemCount, currency, settings, error, loading, canCollectPayments, sessionBlocked, activeQueuedOrder, onClearQueuedOrder, onUpdateQty, onRemove, onClear, onCheckout, onQueue, onStartSession }: {
    cart: CartItem[];
    subtotal: number;
    itemCount: number;
    currency: string;
    settings: PageProps["settings"];
    error: string | null;
    loading: boolean;
    canCollectPayments: boolean;
    sessionBlocked: boolean;
    activeQueuedOrder?: QueuedOrder | null;
    onClearQueuedOrder?: () => void;
    onUpdateQty: (key: string, delta: number) => void;
    onRemove: (key: string) => void;
    onClear: () => void;
    onCheckout: (data: { payment_method: PayMethod; payment_amount: number; discount_percent: number; customer_name: string }) => void;
    onQueue: () => void;
    onStartSession: () => void;
}) {
    const [method, setMethod] = useState<PayMethod>((settings?.default_payment ?? "cash") as PayMethod);
    const [tender, setTender] = useState("");
    const [discount, setDiscount] = useState("");
    const [customer, setCustomer] = useState(activeQueuedOrder?.customer_name ?? "");

    // Sync customer name when activeQueuedOrder changes
    useEffect(() => {
        if (activeQueuedOrder?.customer_name) {
            setCustomer(activeQueuedOrder.customer_name);
        }
    }, [activeQueuedOrder]);

    const maxDiscount = settings?.max_discount_percent ?? 100;
    const discountPct = Math.min(Math.max(parseFloat(discount) || 0, 0), maxDiscount);
    const discountAmount = Math.round((subtotal * discountPct / 100) * 100) / 100;
    const afterDiscount = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
    const vatRate = settings?.vat_enabled && !settings?.vat_inclusive ? settings.vat_rate ?? 0 : 0;
    const vatAmount = Math.round((afterDiscount * vatRate / 100) * 100) / 100;
    const total = Math.round((afterDiscount + vatAmount) * 100) / 100;
    const tenderAmount = method === "cash" ? parseFloat(tender) || 0 : total;
    const change = Math.max(0, tenderAmount - total);
    const canCheckout = cart.length > 0 && canCollectPayments && !loading && (method !== "cash" || tenderAmount >= total);

    const appendTender = (value: string) => setTender(prev => value === "." && prev.includes(".") ? prev : (prev === "0" ? value : prev + value));
    const clearTender = () => setTender("");
    const backspaceTender = () => setTender(prev => prev.slice(0, -1));
    const roundTo = (step: number) => Math.ceil(total / step) * step;
    const suggested = Array.from(new Set([total, roundTo(50), roundTo(100), roundTo(500)].filter(v => v >= total))).slice(0, 4);

    const submit = () => {
        if (!canCollectPayments) {
            onQueue();
            return;
        }
        if (sessionBlocked) {
            onStartSession();
            return;
        }
        onCheckout({
            payment_method: method,
            payment_amount: method === "cash" ? tenderAmount : total,
            discount_percent: discountPct,
            customer_name: customer.trim(),
        });
    };

    return (
        <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(160px,1fr)_minmax(300px,1fr)] overflow-hidden bg-background lg:grid-cols-[minmax(420px,1fr)_minmax(340px,430px)] lg:grid-rows-1 xl:grid-cols-[minmax(520px,1fr)_440px]">
            <div className="min-h-0 flex flex-col border-b border-border bg-card lg:border-b-0 lg:border-r">
                <div className="shrink-0 px-4 py-3 border-b border-border">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <p className="text-sm font-black text-foreground">Order Cart</p>
                            <p className="text-xs text-muted-foreground">{itemCount} item{itemCount !== 1 ? "s" : ""} in current order</p>
                        </div>
                        {cart.length > 0 && (
                            <button type="button" onClick={onClear} className="h-8 px-2.5 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-muted">
                                Clear
                            </button>
                        )}
                    </div>
                </div>

                {activeQueuedOrder && (
                    <div className="mx-3 mt-2.5 p-2.5 rounded-xl border border-primary/30 bg-primary/5 dark:bg-primary/10 flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm shrink-0">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="relative flex h-2.5 w-2.5 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-black font-mono text-primary truncate">
                                        {activeQueuedOrder.ticket_number}
                                    </span>
                                    <span className="text-[10px] bg-primary/15 text-primary font-bold px-1.5 py-0.5 rounded-md">
                                        Pending Ticket
                                    </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground truncate">
                                    {activeQueuedOrder.customer_name ? `${activeQueuedOrder.customer_name} • ` : ""}{activeQueuedOrder.listed_by ?? "Order taker"}
                                </p>
                            </div>
                        </div>
                        {onClearQueuedOrder && (
                            <button
                                type="button"
                                onClick={onClearQueuedOrder}
                                className="text-[11px] font-bold text-muted-foreground hover:text-destructive px-2 py-1 rounded-lg hover:bg-destructive/10 transition-colors shrink-0"
                                title="Unlink pending ticket"
                            >
                                Unlink
                            </button>
                        )}
                    </div>
                )}

                <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
                    {cart.length === 0 ? (
                        <div className="h-full min-h-40 flex flex-col items-center justify-center text-center text-muted-foreground">
                            <ShoppingCart className="h-11 w-11 opacity-20 mb-2" />
                            <p className="text-sm font-bold">Order cart is empty</p>
                            <p className="mt-1 max-w-xs text-xs">Search or scan a product above, then choose one of the suggested items.</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.key} className="flex items-center gap-2 py-3 border-b border-border/60 last:border-0">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-foreground truncate">{item.name}</p>
                                    {item.variant_name && <p className="text-[10px] text-muted-foreground">{item.variant_name}</p>}
                                    <p className="text-xs font-semibold text-primary tabular-nums">{fmtMoney(item.price, currency)}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button type="button" onClick={() => onUpdateQty(item.key, -1)} className="h-8 w-8 rounded-lg border border-border font-black hover:bg-muted">-</button>
                                    <span className="w-8 text-center text-sm font-black tabular-nums">{item.qty}</span>
                                    <button type="button" onClick={() => onUpdateQty(item.key, 1)} disabled={item.qty >= item.stock} className="h-8 w-8 rounded-lg border border-border font-black hover:bg-muted disabled:opacity-30">+</button>
                                </div>
                                <div className="w-20 text-right">
                                    <p className="text-sm font-black tabular-nums text-foreground">{fmtMoney(item.price * item.qty, currency)}</p>
                                    <button type="button" onClick={() => onRemove(item.key)} className="text-[10px] font-semibold text-destructive">Remove</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                <div className="shrink-0 border-t border-border bg-background/70 p-3">
                    <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="rounded-lg border border-border bg-card px-3 py-2">
                            <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Items</p>
                            <p className="text-lg font-black tabular-nums text-foreground">{itemCount}</p>
                        </div>
                        <div className="rounded-lg border border-border bg-card px-3 py-2">
                            <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Lines</p>
                            <p className="text-lg font-black tabular-nums text-foreground">{cart.length}</p>
                        </div>
                        <div className="rounded-lg border border-border bg-card px-3 py-2 text-right">
                            <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Subtotal</p>
                            <p className="text-lg font-black tabular-nums text-primary">{fmtMoney(subtotal, currency)}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="min-h-0 flex flex-col bg-card">
                <div className="shrink-0 border-b border-border px-4 py-3">
                    <p className="text-sm font-black text-foreground">Payment</p>
                    <p className="text-xs text-muted-foreground">Discount, tender, and checkout stay visible.</p>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        {METHODS.filter(m => m.value !== "installment").map(({ value, label, icon: Icon }) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setMethod(value)}
                                className={cn(
                                    "h-10 rounded-lg border text-xs font-black flex items-center justify-center gap-1.5",
                                    method === value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted",
                                )}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-[1fr_92px] gap-2">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Customer</label>
                            <input value={customer} onChange={e => setCustomer(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Optional" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Disc %</label>
                            <input value={discount} onChange={e => setDiscount(e.target.value)} inputMode="decimal" className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-2 text-sm font-black tabular-nums focus:outline-none focus:ring-1 focus:ring-primary" placeholder="0" />
                        </div>
                    </div>

                    {method === "cash" && (
                        <div className="space-y-2">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Amount received</label>
                                <div className="mt-1 h-12 rounded-lg border border-border bg-background px-3 flex items-center justify-end text-2xl font-black tabular-nums text-foreground">
                                    {tender ? fmtMoney(tenderAmount, currency) : fmtMoney(0, currency)}
                                </div>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                                {suggested.map(value => (
                                    <button key={value} type="button" onClick={() => setTender(String(value))} className="h-8 rounded-lg border border-border text-[11px] font-black hover:bg-muted">
                                        {value === total ? "Exact" : fmtMoney(value, currency)}
                                    </button>
                                ))}
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                                {["7","8","9","C","4","5","6","Back","1","2","3",".","00","0","000","Exact"].map(key => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => {
                                            if (key === "C") clearTender();
                                            else if (key === "Back") backspaceTender();
                                            else if (key === "Exact") setTender(String(total));
                                            else appendTender(key);
                                        }}
                                        className={cn("h-10 rounded-lg border border-border text-sm font-black hover:bg-muted", key === "Exact" && "bg-primary text-primary-foreground border-primary hover:bg-primary/90")}
                                    >
                                        {key}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-1.5 rounded-lg bg-muted/40 p-3 text-sm">
                        <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmtMoney(subtotal, currency)}</span></div>
                        {discountAmount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount</span><span>-{fmtMoney(discountAmount, currency)}</span></div>}
                        {vatAmount > 0 && <div className="flex justify-between text-muted-foreground"><span>VAT</span><span>{fmtMoney(vatAmount, currency)}</span></div>}
                        <div className="flex justify-between border-t border-border/70 pt-2 text-lg font-black text-foreground"><span>Total</span><span>{fmtMoney(total, currency)}</span></div>
                        {method === "cash" && <div className="flex justify-between text-base font-black text-primary"><span>Change</span><span>{fmtMoney(change, currency)}</span></div>}
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{error}
                        </div>
                    )}

                </div>
                <div className="shrink-0 border-t border-border bg-card p-3 sm:p-4">
                    <Button className="h-14 w-full text-base font-black gap-2" disabled={!cart.length || (!canCheckout && !sessionBlocked && canCollectPayments)} onClick={submit}>
                        {loading ? <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" /> : sessionBlocked ? <Unlock className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                        {!canCollectPayments ? "PRINT QR" : sessionBlocked ? "Start Session" : `Checkout ${fmtMoney(total, currency)}`}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function PendingPaymentModal({ orders, currency, activeOrderId, onSelect, onDelete, onClose }: {
    orders: QueuedOrder[];
    currency: string;
    activeOrderId: number | null;
    onSelect: (order: QueuedOrder) => void;
    onDelete: (order: QueuedOrder) => void;
    onClose: () => void;
}) {
    const [orderToRemove, setOrderToRemove] = useState<QueuedOrder | null>(null);
    const [loadingId, setLoadingId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    const confirmRemove = () => {
        if (!orderToRemove) return;
        onDelete(orderToRemove);
        setOrderToRemove(null);
    };

    const handleSelect = (order: QueuedOrder) => {
        setLoadingId(order.id);
        onSelect(order);
    };

    const filteredOrders = useMemo(() => {
        if (!searchQuery.trim()) return orders;
        const q = searchQuery.toLowerCase();
        return orders.filter(o =>
            (o.ticket_number || "").toLowerCase().includes(q) ||
            (o.customer_name || "").toLowerCase().includes(q) ||
            (o.listed_by || "").toLowerCase().includes(q) ||
            o.items.some(it => (it.product_name || "").toLowerCase().includes(q))
        );
    }, [orders, searchQuery]);

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card border border-border/80 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg shadow-2xl flex flex-col max-h-[88vh] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 sm:slide-in-from-bottom-4 duration-300 ease-out">
                {/* Header */}
                <div className="shrink-0 relative flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-4 ring-primary/5 shrink-0">
                            <QrCode className="h-5 w-5" />
                            {orders.length > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                                </span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-black text-foreground tracking-tight">Pending Payment Queue</h3>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-primary text-primary-foreground shadow-sm">
                                    {orders.length}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                                Select an unpaid order ticket to process at cashier counter
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-150 active:scale-95 shrink-0"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Optional Search if more than 3 orders */}
                {orders.length > 3 && (
                    <div className="p-3 border-b border-border/60 bg-background/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                            <input
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search ticket #, customer, order taker..."
                                className="w-full h-8 pl-8 pr-3 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>
                    </div>
                )}

                {/* Orders List */}
                <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-2.5">
                    {orders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-52 px-4 text-center text-muted-foreground animate-in fade-in duration-300">
                            <div className="h-14 w-14 rounded-full bg-muted/60 flex items-center justify-center mb-3 text-muted-foreground/40">
                                <QrCode className="h-7 w-7" />
                            </div>
                            <p className="text-sm font-bold text-foreground">No Pending Orders</p>
                            <p className="text-xs text-muted-foreground max-w-xs mt-1">
                                Unpaid tickets sent by order takers will automatically show up here in real-time.
                            </p>
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="py-8 text-center text-xs text-muted-foreground">
                            No pending tickets matching "{searchQuery}"
                        </div>
                    ) : (
                        filteredOrders.map((order, idx) => {
                            const active = activeOrderId === order.id;
                            const isLoading = loadingId === order.id;

                            return (
                                <div
                                    key={order.id}
                                    style={{ animationDelay: `${idx * 40}ms` }}
                                    className={cn(
                                        "group relative w-full rounded-2xl border transition-all duration-200 p-3.5 flex flex-col gap-2.5 animate-in fade-in-50 slide-in-from-bottom-2 duration-300",
                                        active
                                            ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-md ring-1 ring-primary/30"
                                            : "border-border bg-card hover:bg-muted/30 hover:border-primary/40 hover:shadow-sm",
                                    )}
                                >
                                    {/* Top Row: Ticket & Amount */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-mono text-xs font-black text-foreground bg-muted px-2 py-0.5 rounded-lg border border-border/60">
                                                    {order.ticket_number}
                                                </span>
                                                {active && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        Currently In Cart
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground truncate">
                                                <span className="font-semibold text-foreground truncate">
                                                    {order.customer_name || "Walk-in Customer"}
                                                </span>
                                                <span>•</span>
                                                <span className="truncate text-muted-foreground/80">
                                                    by {order.listed_by ?? "Order taker"}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <p className="text-base font-black text-primary tabular-nums">
                                                {fmtMoney(order.total, currency)}
                                            </p>
                                            <span className="text-[10px] font-semibold text-muted-foreground">
                                                {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Items Preview Chips */}
                                    <div className="flex items-center gap-1.5 overflow-hidden text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1.5 rounded-xl">
                                        <span className="truncate flex-1 font-medium">
                                            {order.items.map(i => `${i.quantity}x ${i.product_name}${i.variant_name ? ` (${i.variant_name})` : ""}`).join(", ")}
                                        </span>
                                    </div>

                                    {/* Actions Bottom Bar */}
                                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                                        <button
                                            type="button"
                                            onClick={() => setOrderToRemove(order)}
                                            className="h-8 px-2 rounded-lg text-xs font-semibold text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-1"
                                            title="Delete ticket"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            <span>Remove</span>
                                        </button>

                                        <Button
                                            size="sm"
                                            onClick={() => handleSelect(order)}
                                            disabled={isLoading}
                                            className={cn(
                                                "h-8 px-3.5 text-xs font-bold gap-1.5 rounded-xl transition-all shadow-sm active:scale-95",
                                                active ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""
                                            )}
                                        >
                                            {isLoading ? (
                                                <span className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                                            ) : active ? (
                                                <>
                                                    <Check className="h-3.5 w-3.5" />
                                                    <span>Reload Cart</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span>Select & Charge</span>
                                                    <ArrowRight className="h-3.5 w-3.5" />
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Remove confirmation modal */}
            <Dialog open={!!orderToRemove} onOpenChange={(open) => !open && setOrderToRemove(null)}>
                <DialogContent className="sm:max-w-md" showCloseButton={false}>
                    <DialogHeader>
                        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                        </div>
                        <DialogTitle>Remove Pending Order</DialogTitle>
                        <DialogDescription>
                            This will remove the unpaid ticket from the pending payment queue.
                        </DialogDescription>
                    </DialogHeader>

                    {orderToRemove && (
                        <div className="rounded-xl border border-border bg-muted/40 p-3.5 space-y-1">
                            <div className="flex items-center justify-between gap-3">
                                <span className="font-mono text-sm font-black text-foreground">
                                    {orderToRemove.ticket_number}
                                </span>
                                <span className="text-sm font-black tabular-nums text-primary">
                                    {fmtMoney(orderToRemove.total, currency)}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                                <span className="truncate">{orderToRemove.customer_name || orderToRemove.listed_by || "Walk-in customer"}</span>
                                <span>{orderToRemove.items.length} line{orderToRemove.items.length !== 1 ? "s" : ""}</span>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setOrderToRemove(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmRemove}>Remove Order</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─── Main POS component ───────────────────────────────────────────────────────
export default function PosIndex() {
    const { props }   = usePage<PageProps>();
    const { products, categories, session, branch, settings, app, open_table_orders, dining_tables } = props;
    const promos      = (props.promos as ActivePromo[]) ?? [];
    const user        = props.auth?.user;
    const currency    = app?.currency ?? "₱";
    const layout      = (props.preferred_layout ?? "grid") as LayoutMode;
    const isOrderTaker = (props.cashier_type ?? user?.cashier_type) === "order_taker";
    const canCollectPayments = props.can_collect_payments ?? user?.can_collect_payments ?? !isOrderTaker;
    const isOrderOnly = layout === "order_only" || !canCollectPayments;

    const [pendingOrders,      setPendingOrders]      = useState<QueuedOrder[]>((props.pending_orders as QueuedOrder[]) ?? []);
    const [cart,               setCart]               = useState<CartItem[]>([]);
    const [search,             setSearch]             = useState("");
    const [activeCat,          setActiveCat]          = useState<number | null>(null);
    const [showPayment,        setShowPayment]        = useState(false);
    const [showPendingPayments,setShowPendingPayments]= useState(false);
    const [showOpenSession,    setShowOpenSession]    = useState(false);
    const [receipt,            setReceipt]            = useState<ReceiptData | null>(null);
    const [queuedOrder,        setQueuedOrder]        = useState<QueuedOrder | null>(null);
    const [activeQueuedOrder,  setActiveQueuedOrder]  = useState<QueuedOrder | null>(null);
    const [installmentPlanId,  setInstallmentPlanId]  = useState<number | null>(null);
    const [loading,            setLoading]            = useState(false);
    const [error,              setError]              = useState<string | null>(null);
    const [variantFor,         setVariantFor]         = useState<Product | null>(null);
    const [activeTableOrderId, setActiveTableOrderId] = useState<number | null>(null);
    const [pendingTableId,     setPendingTableId]     = useState<number | null>(null);

    const searchRef = useRef<HTMLInputElement>(null);
    const seenOrderIds = useRef<Set<number>>(
        new Set(((props.pending_orders as QueuedOrder[]) ?? []).map(o => o.id))
    );

    const notifyNewOrder = useCallback((order: QueuedOrder) => {
        playOrderChime();
        toast.info(`New order queued: ${order.ticket_number}`, {
            icon: <Bell className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
            description: `${order.customer_name || order.listed_by || "Walk-in customer"} • ${fmtMoney(order.total, currency)}`,
            action: {
                label: "View",
                onClick: () => setShowPendingPayments(true),
            },
            duration: 6000,
        });
    }, [currency]);

    // Keep pendingOrders in sync with page props and notify on new orders via polling
    useEffect(() => {
        const incoming = (props.pending_orders as QueuedOrder[]) ?? [];
        setPendingOrders(incoming);

        if (canCollectPayments) {
            for (const order of incoming) {
                if (!seenOrderIds.current.has(order.id)) {
                    seenOrderIds.current.add(order.id);
                    notifyNewOrder(order);
                }
            }
        }
    }, [props.pending_orders, canCollectPayments, notifyNewOrder]);

    // ── Real-time Reverb WebSocket Listener ────────────────────────────────────
    useEffect(() => {
        if (!branch?.id || !canCollectPayments) return;

        try {
            const channel = echo.private(`branch.${branch.id}`);

            channel.listen('.OrderQueued', (e: { order: QueuedOrder }) => {
                if (!e?.order) return;
                const incomingOrder = e.order;

                setPendingOrders(prev => {
                    const exists = prev.some(o => o.id === incomingOrder.id);
                    if (exists) return prev;
                    return [incomingOrder, ...prev];
                });

                if (!seenOrderIds.current.has(incomingOrder.id)) {
                    seenOrderIds.current.add(incomingOrder.id);
                    notifyNewOrder(incomingOrder);
                }
            });

            channel.listen('.OrderProcessed', (e: { order_id: number; reason?: string; processed_by?: number }) => {
                if (!e?.order_id) return;
                setPendingOrders(prev => prev.filter(o => o.id !== e.order_id));
                if (activeQueuedOrder?.id === e.order_id) {
                    setActiveQueuedOrder(null);
                    if (e.processed_by && user?.id && e.processed_by !== user.id) {
                        toast.warning(`Order was ${e.reason === 'cancelled' ? 'cancelled' : 'paid'} on another terminal.`);
                    }
                }
            });

            return () => {
                try {
                    channel.stopListening('.OrderQueued');
                    channel.stopListening('.OrderProcessed');
                } catch {
                    // Ignore cleanup errors
                }
            };
        } catch {
            // Fallback gracefully if Reverb connection is not available
        }
    }, [branch?.id, canCollectPayments, notifyNewOrder, activeQueuedOrder?.id, user?.id]);

    // ── Background Polling Fallback (every 4s when visible) ────────────────────
    useEffect(() => {
        if (!branch?.id || !canCollectPayments) return;

        const interval = setInterval(() => {
            if (document.hidden) return;
            router.reload({ only: ["pending_orders"] });
        }, 4000);

        return () => clearInterval(interval);
    }, [branch?.id, canCollectPayments]);

    // Auto-focus on mount
    useEffect(() => { searchRef.current?.focus(); }, []);

    // When a new table order is created, auto-select it once open_table_orders reloads
    useEffect(() => {
        if (pendingTableId === null) return;
        const newOrder = open_table_orders.find(o => o.table_id === pendingTableId);
        if (newOrder) {
            setActiveTableOrderId(newOrder.id);
            setPendingTableId(null);
        }
    }, [open_table_orders, pendingTableId]);

    const handleStartTableOrder = useCallback((tableId: number, covers: number) => {
        setPendingTableId(tableId);
        router.post(routes.tableOrders.store(), { table_id: tableId, covers }, {
            preserveScroll: true,
            only: ['open_table_orders'],
        });
    }, []);

    // Auto-refocus the search/barcode input after any transient action
    const refocus = useCallback((delay = 0) => {
        setTimeout(() => searchRef.current?.focus(), delay);
    }, []);

    const filtered = useMemo(() => {
        let list = products.filter(p => p.product_type !== 'ingredient');
        if (activeCat)      list = list.filter(p => p.category?.id === activeCat);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(p => p.name.toLowerCase().includes(q) || (p.barcode ?? "").includes(q));
        }
        return list;
    }, [products, activeCat, search]);

    const fastSearchSuggestions = useMemo(() => {
        if (!search.trim()) return [];
        return filtered.slice(0, 10);
    }, [filtered, search]);

    const subtotal  = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
    const itemCount = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

    const requireCustomerName = branch?.business_type === "salon";

    const addItem = useCallback((product: Product, variantId: number | null = null, variantName: string | null = null) => {
        const variant   = variantId ? product.variants.find(v => v.id === variantId) : null;
        const extra     = variant?.extra_price ?? 0;
        const price     = variant?.price ?? product.price + extra;
        const key       = `${product.id}-${variantId ?? "base"}`;
        const stockLim  = (product.product_type === 'bundle' || product.product_type === 'made_to_order')
            ? 999
            : (variant ? (variant.stock ?? 0) : (product.base_stock ?? product.stock));
        if (stockLim <= 0) return;
        setCart(prev => {
            const ex = prev.find(i => i.key === key);
            if (ex) {
                if (ex.qty >= stockLim) return prev;
                return prev.map(i => i.key === key ? { ...i, qty: i.qty + 1 } : i);
            }
            return [...prev, { key, product_id: product.id, variant_id: variantId, name: product.name, variant_name: variantName, price, qty: 1, stock: stockLim, product_type: product.product_type, bundle_items: product.bundle_items ?? null, recipe_items: product.recipe_items ?? null }];
        });
    }, []);

    const handleProductClick = useCallback((p: Product) => {
        const isBundleMTO = p.product_type === 'bundle' || p.product_type === 'made_to_order';
        if (!isBundleMTO && p.stock <= 0) return;
        if (p.is_expired) { setError("This product is expired and cannot be sold."); return; }
        if (p.has_variants && p.variants.filter(v => v.is_available).length > 0) {
            setVariantFor(p);
            return;
        }
        addItem(p);
        setSearch("");
        refocus();
    }, [addItem, refocus]);

    const normalizePendingPaymentScan = useCallback((value: string) => {
        const raw = value.trim();
        if (!raw) return "";

        try {
            const parsed = new URL(raw);
            const pathToken = parsed.pathname.split("/").filter(Boolean).pop();
            return (parsed.searchParams.get("token") || parsed.searchParams.get("qr") || pathToken || raw)
                .trim()
                .toUpperCase();
        } catch {
            const maybePathToken = raw.split(/[/?#]/).filter(Boolean).pop() ?? raw;
            return maybePathToken.trim().toUpperCase();
        }
    }, []);

    const looksLikePendingPaymentCode = useCallback((value: string) => {
        const code = normalizePendingPaymentScan(value);
        return /^[A-Z0-9]{8,20}$/.test(code) || /^Q\d{6}-\d{4,}$/.test(code);
    }, [normalizePendingPaymentScan]);

    const loadQueuedOrder = useCallback(async (token: string) => {
        const lookup = normalizePendingPaymentScan(token);
        if (!lookup) return false;
        try {
            const res = await fetch(`/pos/queued-orders/${encodeURIComponent(lookup)}`, {
                headers: { "Accept": "application/json" },
            });
            if (!res.ok) {
                toast.error("Could not find pending order", {
                    description: `Token: ${lookup}`,
                });
                return false;
            }
            const data = await res.json();
            const order = data.order as QueuedOrder;
            setActiveQueuedOrder(order);
            setCart(order.items.map(item => ({
                key: `${item.product_id}-${item.variant_id ?? "base"}`,
                product_id: item.product_id,
                variant_id: item.variant_id,
                name: item.product_name,
                variant_name: item.variant_name,
                price: item.price,
                qty: item.quantity,
                stock: 999,
                product_type: "standard",
                bundle_items: null,
                recipe_items: null,
            })));
            setError(null);
            setSearch("");
            setShowPendingPayments(false);
            refocus(50);
            playOrderChime();
            toast.success(`Loaded Ticket #${order.ticket_number}`, {
                description: `${order.customer_name ? `${order.customer_name} • ` : ""}${order.items.length} line item${order.items.length !== 1 ? "s" : ""} (${fmtMoney(order.total, currency)})`,
            });
            return true;
        } catch {
            toast.error("Failed to load pending order");
            return false;
        }
    }, [normalizePendingPaymentScan, refocus, currency]);

    const selectPendingOrder = useCallback((order: QueuedOrder) => {
        void loadQueuedOrder(order.qr_token);
    }, [loadQueuedOrder]);

    const deletePendingOrder = useCallback((order: QueuedOrder) => {
        router.delete(`/pos/queued-orders/${order.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                if (activeQueuedOrder?.id === order.id) {
                    setActiveQueuedOrder(null);
                    setCart([]);
                }
                router.reload({ only: ["pending_orders"] });
                refocus(50);
            },
            onError: errors => {
                setError(Object.values(errors)[0] as string ?? "Unable to remove pending order.");
            },
        });
    }, [activeQueuedOrder, refocus]);

    // Combined search + instant barcode: if the current value exactly matches a barcode, add it
    const handleSearchOrScan = useCallback((value: string) => {
        setSearch(value);
        const code = value.trim();
        if (!code) return;
        const exact = products.find(p => (p.barcode ?? "").trim() === code);
        if (exact) {
            handleProductClick(exact);
            setSearch("");
            return;
        }
        if (canCollectPayments && looksLikePendingPaymentCode(code)) void loadQueuedOrder(code);
    }, [products, handleProductClick, loadQueuedOrder, canCollectPayments, looksLikePendingPaymentCode]);

    // Enter key: 1) exact barcode match, 2) exact name match, 3) single filtered result
    const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const code = search.trim();
        if (!code) return;

        // Priority 1: exact barcode
        const byBarcode = products.find(p => (p.barcode ?? "").trim() === code);
        if (byBarcode) { handleProductClick(byBarcode); setSearch(""); return; }

        // Priority 2: exact product name (case-insensitive)
        const lower    = code.toLowerCase();
        const byName   = products.find(p => p.name.toLowerCase() === lower);
        if (byName)  { handleProductClick(byName); setSearch(""); return; }

        // Priority 3: only one result in the filtered list → treat as unambiguous
        if (filtered.length === 1) { handleProductClick(filtered[0]); setSearch(""); }
        else if (canCollectPayments && looksLikePendingPaymentCode(code)) void loadQueuedOrder(code);
    }, [search, products, filtered, handleProductClick, loadQueuedOrder, canCollectPayments, looksLikePendingPaymentCode]);

    const updateQty    = (key: string, delta: number) =>
        setCart(prev => prev.flatMap(i => {
            if (i.key !== key) return [i];
            const nq = i.qty + delta;
            if (nq <= 0) return [];
            if (nq > i.stock) return [i];
            return [{ ...i, qty: nq }];
        }));

    const removeItem = (key: string) => setCart(prev => prev.filter(i => i.key !== key));
    const clearCart  = () => setCart([]);

    const handleQueue = () => {
        if (!cart.length) return;
        setLoading(true); setError(null);
        router.post(routes.pos.queue(), {
            items: cart.map(i => ({ id: i.product_id, qty: i.qty, variant_id: i.variant_id })),
        }, {
            preserveScroll: true,
            onSuccess: page => {
                const flash = (page.props as any).flash ?? {};
                if (!flash.queued_order) {
                    const pageErrors = (page.props as any).errors ?? {};
                    const firstError = Object.values(pageErrors)[0] as string | undefined;
                    setError(pageErrors.error ?? firstError ?? "Unable to print QR ticket.");
                    setLoading(false);
                    return;
                }
                setQueuedOrder(flash.queued_order as QueuedOrder);
                setActiveQueuedOrder(null);
                setCart([]);
                setLoading(false);
            },
            onError: errors => {
                setError(Object.values(errors)[0] as string ?? "Unable to print QR ticket.");
                setLoading(false);
            },
        });
    };

    const handleConfirm = (payData: {
        payment_method: PayMethod; payment_amount: number; customer_name: string;
        discount_percent: number; promo_id: number | null;
        installment_provider?: string; installment_reference?: string;
        installment_customer_phone?: string; installment_down_payment?: number;
        installments_count?: number; installment_notes?: string;
    }) => {
        if (!cart.length) return;
        setLoading(true); setError(null);
        router.post(routes.pos.store(), {
            items:            cart.map(i => ({ id: i.product_id, qty: i.qty, variant_id: i.variant_id })),
            payment_method:   payData.payment_method,
            payment_amount:   payData.payment_amount,
            customer_name:    payData.customer_name || activeQueuedOrder?.customer_name || null,
            discount_percent: payData.discount_percent,
            promo_id:         payData.promo_id ?? null,
            cash_session_id:  session?.id ?? null,
            table_order_id:   activeTableOrderId ?? null,
            queued_order_id:  activeQueuedOrder?.id ?? null,
            // Financing/installment fields (sent only when method = installment)
            installment_provider:       payData.installment_provider ?? null,
            installment_reference:      payData.installment_reference ?? null,
            installment_customer_phone: payData.installment_customer_phone ?? null,
            installment_down_payment:   payData.installment_down_payment ?? null,
            installments_count:         payData.installments_count ?? null,
            installment_notes:          payData.installment_notes ?? null,
        }, {
            preserveScroll: true,
            onSuccess: page => {
                const flash = (page.props as any).flash ?? {};
                if (!flash.pos_result) {
                    setError(flash.errors?.error ?? "Checkout failed — please try again.");
                    setLoading(false);
                    return;
                }
                const r    = flash.pos_result;
                // Use server-computed values — avoids float drift between UI and DB
                const disc = r.discount_amount ?? 0;
                const pd   = r.promo_discount   ?? 0;
                const activeOrder = activeTableOrderId
                    ? open_table_orders.find(o => o.id === activeTableOrderId)
                    : null;
                setInstallmentPlanId(r.installment_plan_id ?? null);
                setReceipt({
                    receipt_number: r.receipt_number ?? "—",
                    status: "completed",
                    payment_method: payData.payment_method,
                    payment_amount: payData.payment_amount,
                    change_amount:  r.change ?? 0,
                    discount_amount: disc + pd,
                    total:           r.total,
                    customer_name:   payData.customer_name || null,
                    notes: [payData.discount_percent > 0 ? `Discount ${payData.discount_percent}%` : null, r.promo_name ? `Promo: ${r.promo_name}` : null].filter(Boolean).join(' | ') || null,
                    created_at:      new Date().toISOString(),
                    cashier:         user ? `${user.fname} ${user.lname}` : "—",
                    order_created_by: activeQueuedOrder?.listed_by ?? (user ? `${user.fname} ${user.lname}` : "—"),
                    payment_received_by: user ? `${user.fname} ${user.lname}` : "—",
                    branch_name:     branch?.name,
                    table_label:     activeOrder?.label ?? null,
                    business_type:   branch?.business_type,
                    hide_product_names: r.hide_product_names ?? settings?.hide_product_names_on_receipt ?? false,
                    items:           cart.map(i => ({ product_name: i.name, variant_name: i.variant_name, quantity: i.qty, price: i.price })),
                });
                setShowPayment(false);
                setActiveTableOrderId(null);
                setActiveQueuedOrder(null);
                setCart([]);
                setLoading(false);

                toast.success("Checkout successful!", {
                    description: `Receipt #${r.receipt_number ?? "—"} • Total: ${fmtMoney(r.total, currency)}`,
                });
            },
            onError: errors => {
                setError(Object.values(errors)[0] as string ?? "Transaction failed.");
                setLoading(false);
            },
        });
    };

    // Keyboard shortcuts — F2 and F5 both focus combined search/barcode field
    useEffect(() => {
        const fn = (e: KeyboardEvent) => {
            if (e.key === "F2" || e.key === "F5") { e.preventDefault(); searchRef.current?.focus(); }
            if (e.key === "F9" && cart.length)    { e.preventDefault(); canCollectPayments ? startCharge() : handleQueue(); }
            if (e.key === "Escape")               { setShowPayment(false); setShowPendingPayments(false); setShowOpenSession(false); setVariantFor(null); }
        };
        window.addEventListener("keydown", fn);
        return () => window.removeEventListener("keydown", fn);
    }, [cart, canCollectPayments, handleQueue]);

    // ── Combined search/barcode input ─────────────────────────────────────────
    const searchInput = (
        <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
                ref={searchRef}
                value={search}
                onChange={e => handleSearchOrScan(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search or scan barcode… (F2)"
                className="w-full h-9 pl-9 pr-8 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                // Suppress browser floating toolbars (Translate / Clipboard / Web Search)
                // that appear on Android Chrome when text is entered via OTG barcode scanner
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                data-gramm="false"
            />
            {search
                ? <button onClick={() => { setSearch(""); refocus(); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                : <ScanLine className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />}
        </div>
    );

    const pendingPaymentButton = canCollectPayments ? (
        <button
            type="button"
            onClick={() => setShowPendingPayments(true)}
            className={cn(
                "relative flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-bold transition-all duration-200 shrink-0 active:scale-95",
                pendingOrders.length > 0
                    ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 shadow-sm shadow-primary/10"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
            title="Pending payments"
        >
            <QrCode className={cn("h-3.5 w-3.5", pendingOrders.length > 0 && "text-primary animate-pulse")} />
            <span className="hidden sm:block">Pending</span>
            {pendingOrders.length > 0 && (
                <span className="relative flex items-center">
                    <span className="h-4 min-w-4 rounded-full bg-primary px-1 text-[10px] font-black leading-4 text-primary-foreground flex items-center justify-center shadow-sm">
                        {pendingOrders.length}
                    </span>
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                    </span>
                </span>
            )}
        </button>
    ) : null;

    // ── Session guard ─────────────────────────────────────────────────────────
    const sessionRequired = settings?.require_cash_session ?? true;
    const sessionBlocked  = canCollectPayments && sessionRequired && !session;
    const startCharge = () => {
        if (!canCollectPayments) {
            setError("Order takers can only send orders to Pending Payment. A counter cashier must collect payment.");
            return;
        }
        if (sessionBlocked) {
            setError("Start a cash session before checkout.");
            setShowOpenSession(true);
            return;
        }
        setError(null);
        setShowPayment(true);
    };

    // ── No-session overlay — shown on top of any layout ───────────────────────
    const noSessionOverlay = false && sessionBlocked ? (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 p-8 rounded-2xl border border-border bg-card shadow-2xl max-w-sm w-full mx-4 text-center">
                <div className="h-14 w-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <AlertTriangle className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                    <p className="font-bold text-foreground text-lg">No Open Cash Session</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        You must open a cash session before you can process sales.
                    </p>
                </div>
                <a
                    href="/cash-sessions"
                    className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
                >
                    <Wallet className="h-4 w-4" />
                    Go to Cash Sessions
                </a>
            </div>
        </div>
    ) : null;

    // ── Kiosk: truly full-screen (no layout wrapper at all) ──────────────────
    if (layout === "kiosk") {
        return (
            <div className="fixed inset-0 flex flex-col overflow-hidden bg-background text-foreground relative">
                {noSessionOverlay}
                {/* Kiosk header */}
                <div className="shrink-0 flex items-center gap-3 bg-primary px-5 py-3.5">
                    <span className="font-black text-primary-foreground text-xl tracking-tight shrink-0">
                        {branch?.name ?? "POS"}
                    </span>
                    {/* Kiosk search — white background for contrast on primary header */}
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <input
                            ref={searchRef}
                            value={search}
                            onChange={e => handleSearchOrScan(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            placeholder="Search or scan… (F2)"
                            className="w-full h-10 pl-9 pr-8 text-sm bg-white dark:bg-background border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/50 placeholder:text-muted-foreground shadow-sm"
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            data-gramm="false"
                        />
                        {search
                            ? <button onClick={() => { setSearch(""); refocus(); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                            : <ScanLine className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />}
                    </div>
                    <CategoryDropdown categories={categories} activeCat={activeCat} onChange={setActiveCat} />
                    <button onClick={() => window.location.reload()}
                        className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 text-primary-foreground transition-colors shrink-0">
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>
                {/* Kiosk body */}
                <div className="flex-1 min-h-0 overflow-hidden">
                    <Suspense fallback={<LayoutSpinner />}>
                        <KioskLayout filtered={filtered} cart={cart} currency={currency} onProductClick={handleProductClick}
                            onCharge={startCharge}
                            subtotal={subtotal} itemCount={itemCount} onClear={clearCart} />
                    </Suspense>
                </div>

                {variantFor && (
                    <VariantPicker product={variantFor} currency={currency}
                        onSelect={(vid, vname) => { addItem(variantFor, vid, vname); setVariantFor(null); refocus(50); }}
                        onClose={() => { setVariantFor(null); refocus(50); }} />
                )}
                {showPayment && (
                    <PaymentModal subtotal={subtotal} settings={settings} currency={currency}
                        customerNameRequired={requireCustomerName} promos={promos} cart={cart}
                        onConfirm={handleConfirm}
                        onClose={() => { setShowPayment(false); setError(null); refocus(50); }}
                        loading={loading} serverError={error} />
                )}
                {showOpenSession && (
                    <OpenSessionModal currency={currency} onClose={() => { setShowOpenSession(false); refocus(50); }} />
                )}
                {receipt && <SaleSuccessModal receipt={receipt} currency={currency} installmentPlanId={installmentPlanId} onNewSale={() => { setReceipt(null); setInstallmentPlanId(null); refocus(100); }} />}
                {queuedOrder && <QueuedOrderModal order={queuedOrder} currency={currency} onClose={() => { setQueuedOrder(null); refocus(100); }} />}
            </div>
        );
    }

    // ── Mobile: full AdminLayout with sidebar
    // Use dvh (dynamic viewport height) so the cart bar is never hidden behind browser chrome.
    // Falls back gracefully to 100vh on older browsers.
    if (layout === "mobile") {
        return (
            <AdminLayout>
                <div className="relative flex flex-col overflow-hidden -m-6"
                    style={{ height: 'calc(100dvh - 4rem)' }}>
                    {noSessionOverlay}
                    <div className="shrink-0 flex items-center gap-2 border-b border-border bg-card px-4 py-2">
                        {searchInput}
                        <a href={routes.sales.history()}
                            className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0">
                            <History className="h-3.5 w-3.5" />
                        </a>
                        {pendingPaymentButton}
                        {sessionBlocked && (
                            <button
                                type="button"
                                onClick={() => setShowOpenSession(true)}
                                className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shrink-0"
                            >
                                <Unlock className="h-3.5 w-3.5" />
                                <span className="hidden sm:block">Start Session</span>
                            </button>
                        )}
                    </div>
                    <div className="flex-1 min-h-0 overflow-hidden">
                        <Suspense fallback={<LayoutSpinner />}>
                            <MobileLayout filtered={filtered} cart={cart} currency={currency} onProductClick={handleProductClick}
                                onCharge={startCharge} onQueue={handleQueue}
                                subtotal={subtotal} itemCount={itemCount} onClear={clearCart}
                                onUpdateQty={updateQty} onRemove={removeItem}
                                orderOnly={isOrderOnly} canCharge={canCollectPayments} />
                        </Suspense>
                    </div>
                </div>

                {variantFor && (
                    <VariantPicker product={variantFor} currency={currency}
                        onSelect={(vid, vname) => { addItem(variantFor, vid, vname); setVariantFor(null); refocus(50); }}
                        onClose={() => { setVariantFor(null); refocus(50); }} />
                )}
                {showPayment && (
                    <PaymentModal subtotal={subtotal} settings={settings} currency={currency}
                        customerNameRequired={requireCustomerName} promos={promos} cart={cart}
                        onConfirm={handleConfirm}
                        onClose={() => { setShowPayment(false); setError(null); refocus(50); }}
                        loading={loading} serverError={error} />
                )}
                {showOpenSession && (
                    <OpenSessionModal currency={currency} onClose={() => { setShowOpenSession(false); refocus(50); }} />
                )}
                {showPendingPayments && (
                        <PendingPaymentModal
                            orders={pendingOrders}
                            currency={currency}
                            activeOrderId={activeQueuedOrder?.id ?? null}
                            onSelect={selectPendingOrder}
                            onDelete={deletePendingOrder}
                            onClose={() => { setShowPendingPayments(false); refocus(50); }}
                        />
                    )}
                    {receipt && <SaleSuccessModal receipt={receipt} currency={currency} installmentPlanId={installmentPlanId} onNewSale={() => { setReceipt(null); setInstallmentPlanId(null); refocus(100); }} />}
                {queuedOrder && <QueuedOrderModal order={queuedOrder} currency={currency} onClose={() => { setQueuedOrder(null); refocus(100); }} />}
            </AdminLayout>
        );
    }

    // ── Standard layouts ──────────────────────────────────────────────────────
    if (layout === "fast_cashier") {
        return (
            <AdminLayout>
                <div className={cn(
                    "relative flex flex-col overflow-hidden",
                    user?.is_cashier
                        ? "h-[calc(100dvh-7rem)]"
                        : "h-[calc(100dvh-4rem)] -m-6"
                )}>
                    {noSessionOverlay}
                    <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border bg-card sm:px-4">
                        <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0",
                            isOrderOnly
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                                : session ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                                          : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400")}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", isOrderOnly ? "bg-emerald-500" : session ? "bg-green-500" : "bg-amber-500")} />
                            {isOrderOnly ? "Order taker" : session ? "Fast cashier" : "No session"}
                        </div>
                        <div className="relative order-last w-full flex-[1_1_420px] sm:order-none sm:min-w-[280px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                            <input
                                ref={searchRef}
                                value={search}
                                onChange={e => handleSearchOrScan(e.target.value)}
                                onKeyDown={handleSearchKeyDown}
                                placeholder="Search or scan product barcode... (F2)"
                                className="w-full h-10 pl-9 pr-8 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                data-gramm="false"
                            />
                            {search
                                ? <button onClick={() => { setSearch(""); refocus(); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
                                : <ScanLine className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40 pointer-events-none" />}
                            {search.trim() && (
                                <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
                                    {fastSearchSuggestions.length === 0 ? (
                                        <div className="px-3 py-4 text-center text-sm text-muted-foreground">No matching products</div>
                                    ) : (
                                        <div className="max-h-[min(60dvh,420px)] overflow-y-auto p-1.5">
                                            {fastSearchSuggestions.map(product => {
                                                const isBundleMTO = product.product_type === "bundle" || product.product_type === "made_to_order";
                                                const outStock = !isBundleMTO && product.stock <= 0;
                                                const inCart = cart.find(item => item.product_id === product.id);

                                                return (
                                                    <button
                                                        key={product.id}
                                                        type="button"
                                                        disabled={outStock}
                                                        onClick={() => handleProductClick(product)}
                                                        className={cn(
                                                            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                                                            outStock ? "cursor-not-allowed opacity-45" : "hover:bg-muted",
                                                        )}
                                                    >
                                                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                                                            <Package className="h-5 w-5" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-sm font-black text-foreground">{product.name}</p>
                                                            <p className="truncate text-xs text-muted-foreground">
                                                                {product.category?.name ?? "Uncategorized"} - {isBundleMTO ? product.product_type.replace("_", " ") : `${product.stock} stock`}
                                                            </p>
                                                        </div>
                                                        {inCart && (
                                                            <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-black text-primary">
                                                                x{inCart.qty}
                                                            </span>
                                                        )}
                                                        <p className="w-24 shrink-0 text-right text-sm font-black tabular-nums text-primary">{fmtMoney(product.price, currency)}</p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="shrink-0">
                            <CategoryDropdown categories={categories} activeCat={activeCat} onChange={setActiveCat} />
                        </div>
                        <div className="flex-1" />
                        <a href={routes.sales.history()}
                            className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                            <History className="h-3.5 w-3.5" /><span className="hidden sm:block">History</span>
                        </a>
                        {pendingPaymentButton}
                        {sessionBlocked && (
                            <button type="button" onClick={() => setShowOpenSession(true)}
                                className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors">
                                <Unlock className="h-3.5 w-3.5" />
                                <span className="hidden sm:block">Start Session</span>
                            </button>
                        )}
                    </div>
                    <div className="flex-1 min-h-0 overflow-hidden">
                        <FastCashierLayout
                            cart={cart}
                            subtotal={subtotal}
                            itemCount={itemCount}
                            currency={currency}
                            settings={settings}
                            error={error}
                            loading={loading}
                            canCollectPayments={canCollectPayments}
                            sessionBlocked={sessionBlocked}
                            activeQueuedOrder={activeQueuedOrder}
                            onClearQueuedOrder={() => {
                                setActiveQueuedOrder(null);
                                setCart([]);
                            }}
                            onUpdateQty={updateQty}
                            onRemove={removeItem}
                            onClear={clearCart}
                            onQueue={handleQueue}
                            onStartSession={() => setShowOpenSession(true)}
                            onCheckout={data => handleConfirm({
                                payment_method: data.payment_method,
                                payment_amount: data.payment_amount,
                                customer_name: data.customer_name,
                                discount_percent: data.discount_percent,
                                promo_id: null,
                            })}
                        />
                    </div>
                </div>

                {variantFor && (
                    <VariantPicker product={variantFor} currency={currency}
                        onSelect={(vid, vname) => { addItem(variantFor, vid, vname); setVariantFor(null); refocus(50); }}
                        onClose={() => { setVariantFor(null); refocus(50); }} />
                )}
                {showOpenSession && (
                    <OpenSessionModal currency={currency} onClose={() => { setShowOpenSession(false); refocus(50); }} />
                )}
                {showPendingPayments && (
                    <PendingPaymentModal
                        orders={pendingOrders}
                        currency={currency}
                        activeOrderId={activeQueuedOrder?.id ?? null}
                        onSelect={selectPendingOrder}
                        onDelete={deletePendingOrder}
                        onClose={() => { setShowPendingPayments(false); refocus(50); }}
                    />
                )}
                {receipt && <SaleSuccessModal receipt={receipt} currency={currency} installmentPlanId={installmentPlanId} onNewSale={() => { setReceipt(null); setInstallmentPlanId(null); refocus(100); }} />}
                {queuedOrder && <QueuedOrderModal order={queuedOrder} currency={currency} onClose={() => { setQueuedOrder(null); refocus(100); }} />}
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            {/* CashierLayout (bottom-nav): header=3rem + nav=4rem = 7rem chrome, no padding */}
            {/* AdminLayout: header=4rem, p-6 padding → -m-6 escape */}
            <div className={cn(
                "relative flex flex-col overflow-hidden",
                user?.is_cashier
                    ? "h-[calc(100vh-7rem)]"
                    : "h-[calc(100vh-4rem)] -m-6"
            )}>
                {noSessionOverlay}
                {/* Top bar with combined search/barcode */}
                <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border bg-card">
                    <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0",
                        isOrderOnly
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                            : session ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                                      : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400")}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", isOrderOnly ? "bg-emerald-500" : session ? "bg-green-500" : "bg-amber-500")} />
                        {isOrderOnly ? "Order taker" : session ? "Counter cashier" : "No session"}
                    </div>
                    <span className="text-sm font-bold text-foreground hidden sm:block truncate max-w-[140px]">{branch?.name ?? "POS"}</span>
                    {branch?.business_type && (
                        <span className="hidden md:flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold capitalize">
                            {branch.business_type.replace("_", " ")}
                        </span>
                    )}
                    {/* Combined search + barcode */}
                    {searchInput}
                    {/* Category dropdown — hidden for cafe/restaurant/mobile (they have their own navigation) */}
                    {layout !== "cafe" && layout !== "restaurant" && layout !== "mobile" && (
                        <CategoryDropdown categories={categories} activeCat={activeCat} onChange={setActiveCat} />
                    )}
                    <div className="flex-1" />
                    <a href={routes.sales.history()}
                        className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <History className="h-3.5 w-3.5" /><span className="hidden sm:block">History</span>
                    </a>
                    {pendingPaymentButton}
                    {sessionBlocked && (
                        <button
                            type="button"
                            onClick={() => setShowOpenSession(true)}
                            className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors"
                        >
                            <Unlock className="h-3.5 w-3.5" />
                            <span className="hidden sm:block">Start Session</span>
                        </button>
                    )}
                    <button onClick={() => window.location.reload()}
                        className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                </div>

                <div className="flex flex-1 min-h-0 overflow-hidden flex-col lg:flex-row">
                    <div className="flex-1 flex flex-col overflow-hidden border-b lg:border-b-0 lg:border-r border-border">
                        <div className="flex-1 overflow-y-auto p-3">
                            <Suspense fallback={<LayoutSpinner />}>
                                {(layout === "grid" || layout === "order_only") && <GridLayout filtered={filtered} cart={cart} currency={currency} onProductClick={handleProductClick} />}
                                {layout === "tablet"     && <TabletLayout     filtered={filtered} cart={cart} currency={currency} onProductClick={handleProductClick} />}
                                {layout === "grocery"    && <GroceryLayout    filtered={filtered} cart={cart} currency={currency} onProductClick={handleProductClick} />}
                                {layout === "cafe"       && <CafeLayout       filtered={filtered} allProducts={products} categories={categories} activeCat={activeCat} onCatChange={setActiveCat} cart={cart} currency={currency} onProductClick={handleProductClick} />}
                                {layout === "restaurant" && <RestaurantLayout filtered={filtered} cart={cart} currency={currency} onProductClick={handleProductClick} openTableOrders={open_table_orders} diningTables={dining_tables} activeTableOrderId={activeTableOrderId} onSelectTable={setActiveTableOrderId} onStartTableOrder={handleStartTableOrder} />}
                                {layout === "salon"      && <SalonLayout      filtered={filtered} cart={cart} currency={currency} onProductClick={handleProductClick} />}
                            </Suspense>
                        </div>
                    </div>

                    {/* Cart sidebar */}
                    <div className={cn(
                        "shrink-0 flex flex-col border-t lg:border-t-0 lg:border-l border-border w-full lg:w-80 xl:w-96 min-h-0",
                        isOrderOnly ? "h-[42%] lg:h-auto xl:w-[26rem]" : "h-[48%] lg:h-auto",
                    )}>
                        <CartPanel cart={cart} subtotal={subtotal} itemCount={itemCount} currency={currency} error={error}
                            canCharge={canCollectPayments}
                            orderOnly={isOrderOnly}
                            activeQueuedOrder={activeQueuedOrder}
                            onClearQueuedOrder={() => {
                                setActiveQueuedOrder(null);
                                setCart([]);
                            }}
                            onUpdateQty={updateQty} onRemove={removeItem} onClear={clearCart}
                            onCharge={startCharge} onQueue={handleQueue} />
                    </div>
                </div>
            </div>

            {variantFor && (
                <VariantPicker product={variantFor} currency={currency}
                    onSelect={(vid, vname) => { addItem(variantFor, vid, vname); setVariantFor(null); refocus(50); }}
                    onClose={() => { setVariantFor(null); refocus(50); }} />
            )}
            {showPayment && (
                <PaymentModal subtotal={subtotal} settings={settings} currency={currency}
                    customerNameRequired={requireCustomerName} promos={promos} cart={cart}
                    onConfirm={handleConfirm}
                    onClose={() => { setShowPayment(false); setError(null); refocus(50); }}
                    loading={loading} />
            )}
            {showOpenSession && (
                <OpenSessionModal currency={currency} onClose={() => { setShowOpenSession(false); refocus(50); }} />
            )}
            {showPendingPayments && (
                <PendingPaymentModal
                    orders={pendingOrders}
                    currency={currency}
                    activeOrderId={activeQueuedOrder?.id ?? null}
                    onSelect={selectPendingOrder}
                    onDelete={deletePendingOrder}
                    onClose={() => { setShowPendingPayments(false); refocus(50); }}
                />
            )}
            {receipt && <SaleSuccessModal receipt={receipt} currency={currency} installmentPlanId={installmentPlanId} onNewSale={() => { setReceipt(null); setInstallmentPlanId(null); refocus(100); }} />}
            {queuedOrder && <QueuedOrderModal order={queuedOrder} currency={currency} onClose={() => { setQueuedOrder(null); refocus(100); }} />}
        </AdminLayout>
    );
}
