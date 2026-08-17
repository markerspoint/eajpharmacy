"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { usePage, Link } from "@inertiajs/react";
import AdminLayout from "@/layouts/AdminLayout";
import ReactApexChart from "react-apexcharts";
import { fmtDate, manilaNow, toDateStr, manilaRange, manilaFmt } from "@/lib/date";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";

import {
    ShoppingCart, TrendingUp, TrendingDown, Package, PiggyBank,
    Receipt, BarChart2, AlertTriangle, Users, CheckCircle2,
    Calendar as CalendarIcon, ArrowUpRight, ArrowDownRight,
    RefreshCw, Banknote, ClipboardList, PackageCheck,
    Building2, ChevronDown, Wallet, ChevronRight, CircleDot,
    LayoutGrid, Download, ExternalLink, Zap, PackageX,
    Clock, Activity, DollarSign, Sparkles, ArrowRight,
    ClipboardCheck, Store,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface BranchOption {
    id: number; name: string; code: string;
    business_type: string; is_active: boolean;
    feature_flags: Record<string, boolean>;
}
interface PageProps {
    auth: {
        user: {
            id: number; fname: string; lname: string; full_name: string;
            role: string; role_label: string; access: string[];
            is_super_admin: boolean; is_administrator: boolean;
            is_manager: boolean; is_cashier: boolean; is_admin: boolean;
            branch_id: number | null; branch: BranchOption | null;
        } | null;
    };
    settings: Record<string, unknown> | null;
    branches: BranchOption[];
    [key: string]: unknown;
}

interface DashData {
    kpis: {
        revenue: number; revenue_change: number | null;
        expenses: number; expenses_change: number | null;
        net_income: number; net_income_change: number | null;
        transactions: number; txn_change: number | null;
        avg_daily: number; void_count: number; void_total: number;
        discount_total: number; stock_loss_value: number;
    };
    daily_sales: { date: string; revenue: number; expenses: number; transactions: number; discounts: number }[];
    hourly_sales: { hour: number; label: string; revenue: number; transactions: number }[];
    payment_mix: { method: string; count: number; revenue: number }[];
    top_products: { name: string; revenue: number; qty_sold: number }[];
    stock_health: { inStock: number; lowStock: number; outStock: number };
    low_stock_items: { name: string; stock: number; status: string }[];
    exp_by_category: { category: string; total: number }[];
    stock_adj: { type: string; count: number; qty: number; value: number }[];
    recent_sales: { id: number; receipt_number: string; total: number; payment_method: string; status: string; cashier: string; created_at: string }[];
    recent_sessions: { id: number; cashier: string; opened_at: string; closed_at: string | null; opening_cash: number; expected_cash: number; counted_cash: number | null; over_short: number | null; status: string }[];
    pending_orders: { id: number; order_number: string; supplier: string; total: number; status: string; created_at: string }[];
    system_overview: { branch_count: number; user_count: number; product_count: number; pending_orders: number } | null;
    period: { from: string; to: string; days: number };
    generated_at: string;
}

// ─── Branch / business type meta ─────────────────────────────────────────────
const branchMeta: Record<string, { label: string; color: string }> = {
    cafe:       { label: "Cafe",       color: "bg-[#FDE7F0] text-[#F50069] dark:bg-[#3D1426] dark:text-[#F50069]" },
    retail:     { label: "Retail",     color: "bg-[#35425F]/10 text-[#35425F] dark:bg-[#35425F]/30 dark:text-[#FDE7F0]" },
    restaurant: { label: "Restaurant", color: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300" },
    mixed:      { label: "Mixed",      color: "bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300" },
};

// ─── Formatting helpers ───────────────────────────────────────────────────────
function fmtMoney(n: number, compact = false): string {
    if (compact) {
        if (n >= 1_000_000) return `₱${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000)     return `₱${(n / 1_000).toFixed(1)}k`;
    }
    return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtNum(n: number): string { return n.toLocaleString("en-PH"); }
function fmtActivity(iso: string): string {
    return new Date(iso).toLocaleDateString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Chart colours (Poppins + Palette Tokens) ─────────────────────────────────
function useChartColors(isDark: boolean) {
    return useMemo(() => ({
        c1: isDark ? "#6B7FA8" : "#35425F", // Primary Navy Slate
        c2: isDark ? "#4ade80" : "#16a34a", // Success Green
        c3: isDark ? "#F50069" : "#F50069", // Accent Magenta
        c4: isDark ? "#8294B8" : "#4D5D81", // Secondary
        c5: isDark ? "#f87171" : "#dc2626", // Red / Destructive
        c6: isDark ? "#fbbf24" : "#d97706", // Amber
        muted:    isDark ? "#9CA3AF" : "#6B7280",
        gridLine: isDark ? "rgba(255,255,255,0.06)" : "rgba(77,93,129,0.12)",
        bg:       isDark ? "#1A202C" : "#FFFFFF",
    }), [isDark]);
}

function baseOpts(c: ReturnType<typeof useChartColors>, isDark: boolean) {
    return {
        chart: { fontFamily: "Poppins, sans-serif", toolbar: { show: false }, background: "transparent", animations: { enabled: true, speed: 400 } },
        grid: { borderColor: c.gridLine, strokeDashArray: 3, padding: { left: 4, right: 8, top: -8 } },
        xaxis: { labels: { style: { colors: c.muted, fontSize: "11px", fontFamily: "Poppins, sans-serif" } }, axisBorder: { show: false }, axisTicks: { show: false } },
        yaxis: { labels: { style: { colors: c.muted, fontSize: "11px", fontFamily: "Poppins, sans-serif" } } },
        tooltip: { theme: isDark ? "dark" : "light" },
        legend: { labels: { colors: c.muted }, position: "top" as const, fontSize: "12px", horizontalAlign: "right" as const, fontFamily: "Poppins, sans-serif" },
    };
}

// ─── KPI Card Component ───────────────────────────────────────────────────────
const accentStyles = {
    primary: { icon: "bg-[#35425F]/10 text-[#35425F] dark:bg-[#35425F]/40 dark:text-[#FDE7F0]", bar: "bg-[#35425F]" },
    magenta: { icon: "bg-[#FDE7F0] text-[#F50069] dark:bg-[#3D1426] dark:text-[#F50069]", bar: "bg-[#F50069]" },
    green:   { icon: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400", bar: "bg-emerald-500" },
    amber:   { icon: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400", bar: "bg-amber-500" },
    red:     { icon: "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400", bar: "bg-rose-500" },
    slate:   { icon: "bg-[#4D5D81]/10 text-[#4D5D81] dark:bg-[#4D5D81]/30 dark:text-[#D1D5DB]", bar: "bg-[#4D5D81]" },
};

function KpiCard({ title, value, sub, change, icon: Icon, accent = "primary", href, loading }: {
    title: string; value: string | number; sub?: string; change?: number | null;
    icon: React.ElementType; accent?: keyof typeof accentStyles; href?: string; loading?: boolean;
}) {
    const style = accentStyles[accent];
    const inner = (
        <div className={cn(
            "group relative bg-white dark:bg-[#1A202C] border border-[#E5E7EB] dark:border-[#2B364E] rounded-2xl p-5 transition-all duration-200 overflow-hidden h-full flex flex-col shadow-xs",
            href && "cursor-pointer hover:shadow-md hover:border-[#35425F]/40 dark:hover:border-[#F50069]/40 hover:-translate-y-0.5",
            loading && "animate-pulse",
        )}>
            <div className={cn("absolute top-0 left-0 right-0 h-1", style.bar)} />
            <div className="flex items-start justify-between gap-2 mb-3">
                <p className="text-xs font-semibold text-[#6B7280] dark:text-[#9CA3AF] tracking-wide">{title}</p>
                <div className={cn("p-2 rounded-xl shrink-0 transition-transform group-hover:scale-110", style.icon)}>
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold tabular-nums text-[#202638] dark:text-[#F9FAFB] leading-none tracking-tight flex-1">
                {loading ? "—" : value}
            </p>
            <div className="mt-3 flex items-center gap-1.5 flex-wrap min-h-[22px]">
                {change !== undefined && change !== null && (
                    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full",
                        change >= 0 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                    : "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400",
                    )}>
                        {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {Math.abs(change)}% vs prev
                    </span>
                )}
                {sub && <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-medium">{sub}</span>}
            </div>
            {href && <ChevronRight className="absolute right-3.5 bottom-3.5 h-4 w-4 text-[#6B7280]/40 group-hover:text-[#35425F] dark:group-hover:text-[#F50069] transition-colors" />}
        </div>
    );
    return href ? <Link href={href} className="block h-full">{inner}</Link> : inner;
}

// ─── Chart Card Container ─────────────────────────────────────────────────────
function ChartCard({ title, subtitle, href, children, className, action }: {
    title: string; subtitle?: string; href?: string;
    children: React.ReactNode; className?: string; action?: React.ReactNode;
}) {
    return (
        <Card className={cn("rounded-2xl border-[#E5E7EB] dark:border-[#2B364E] bg-white dark:bg-[#1A202C] overflow-hidden shadow-xs", className)}>
            <div className="flex items-start justify-between px-6 pt-5 pb-1 gap-2">
                <div className="min-w-0">
                    <p className="text-sm font-bold text-[#202638] dark:text-[#F9FAFB] tracking-tight">{title}</p>
                    {subtitle && <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5 font-normal">{subtitle}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {action}
                    {href && (
                        <Link href={href}>
                            <button className="h-7 w-7 flex items-center justify-center rounded-lg text-[#6B7280] hover:text-[#202638] dark:hover:text-[#FFFFFF] hover:bg-[#F3F4F6] dark:hover:bg-[#202638] transition-colors">
                                <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                        </Link>
                    )}
                </div>
            </div>
            <CardContent className="px-4 pb-4 pt-1">{children}</CardContent>
        </Card>
    );
}

// ─── Section Title ────────────────────────────────────────────────────────────
function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between mb-3 mt-2">
            <h3 className="text-xs font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider">{children}</h3>
            {action}
        </div>
    );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40",
        paid:      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40",
        approved:  "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40",
        pending:   "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800/40",
        confirmed: "bg-[#35425F]/10 text-[#35425F] dark:bg-[#35425F]/30 dark:text-[#FDE7F0] border-[#35425F]/20",
        shipped:   "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/40",
        voided:    "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800/40",
        cancelled: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800/40",
        open:      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200",
        short:     "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200",
        over:      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200",
        balanced:  "bg-[#F3F4F6] text-[#6B7280] dark:bg-[#202638] dark:text-[#9CA3AF]",
        low:       "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200",
        out:       "bg-[#FDE7F0] text-[#F50069] dark:bg-[#3D1426] dark:text-[#F50069] border-[#F50069]/20 font-bold",
    };
    return (
        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md capitalize border", map[status] ?? "bg-[#F3F4F6] text-[#6B7280]")}>
            {status}
        </span>
    );
}

// ─── List Row ─────────────────────────────────────────────────────────────────
function ListRow({ children, last }: { children: React.ReactNode; last?: boolean }) {
    return <div className={cn("flex items-center gap-3 py-3", !last && "border-b border-[#E5E7EB]/70 dark:border-[#2B364E]/70")}>{children}</div>;
}

// ─── Branch Filter ────────────────────────────────────────────────────────────
function BranchFilter({ branches, selected, onChange }: { branches: BranchOption[]; selected: number | null; onChange: (id: number | null) => void }) {
    const [open, setOpen] = useState(false);
    const current = selected ? branches.find(b => b.id === selected) : null;
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-2 min-w-[160px] justify-between font-medium h-9 rounded-xl text-xs bg-white dark:bg-[#1A202C] border-[#E5E7EB] dark:border-[#2B364E]", selected && "border-[#35425F] bg-[#35425F]/5 text-[#35425F] dark:text-[#FDE7F0]")}>
                    <div className="flex items-center gap-1.5 min-w-0">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-[#6B7280]" />
                        <span className="truncate">{current?.name ?? "All branches"}</span>
                    </div>
                    <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-1.5 shadow-xl rounded-2xl border-[#E5E7EB] dark:border-[#2B364E]" align="end">
                <p className="text-[10px] font-bold text-[#6B7280] dark:text-[#9CA3AF] uppercase tracking-wider px-2 pt-1 pb-2">Filter Branch</p>
                <button onClick={() => { onChange(null); setOpen(false); }}
                    className={cn("w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-left hover:bg-[#F3F4F6] dark:hover:bg-[#202638] transition-colors", selected === null ? "bg-[#35425F]/10 text-[#35425F] dark:text-[#FDE7F0] font-bold" : "text-[#202638] dark:text-[#F9FAFB]")}>
                    <LayoutGrid className="h-3.5 w-3.5 opacity-60 shrink-0" />
                    <span className="flex-1">All branches</span>
                </button>
                <div className="my-1.5 border-t border-[#E5E7EB] dark:border-[#2B364E]" />
                {branches.map(b => {
                    const meta = branchMeta[b.business_type] ?? { label: b.business_type, color: "" };
                    return (
                        <button key={b.id} onClick={() => { onChange(b.id); setOpen(false); }}
                            className={cn("w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-left hover:bg-[#F3F4F6] dark:hover:bg-[#202638] transition-colors",
                                selected === b.id ? "bg-[#35425F]/10 text-[#35425F] dark:text-[#FDE7F0] font-bold" : "text-[#202638] dark:text-[#F9FAFB]",
                                !b.is_active && "opacity-40")}>
                            <CircleDot className={cn("h-3.5 w-3.5 shrink-0", b.is_active ? "text-emerald-500" : "text-[#6B7280]")} />
                            <div className="flex-1 min-w-0">
                                <span className="block truncate font-medium">{b.name}</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] font-mono text-[#6B7280]">{b.code}</span>
                                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-md", meta.color)}>{meta.label}</span>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </PopoverContent>
        </Popover>
    );
}

// ─── Date Filter ──────────────────────────────────────────────────────────────
function DateFilter({ applied, onApply }: { applied: DateRange | undefined; onApply: (r: DateRange | undefined) => void }) {
    const [temp, setTemp] = useState<DateRange | undefined>(applied);
    const presets = [
        { label: "Today",        fn: () => manilaRange.today()       },
        { label: "This week",    fn: () => manilaRange.thisWeek()    },
        { label: "This month",   fn: () => manilaRange.thisMonth()   },
        { label: "Last month",   fn: () => manilaRange.lastMonth()   },
        { label: "Last 3 months",fn: () => manilaRange.last3Months() },
        { label: "Last 90 days", fn: () => manilaRange.last90Days()  },
    ];
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 min-w-[200px] justify-start font-medium h-9 rounded-xl text-xs bg-white dark:bg-[#1A202C] border-[#E5E7EB] dark:border-[#2B364E]">
                    <CalendarIcon className="h-3.5 w-3.5 text-[#6B7280] shrink-0" />
                    <span className="truncate">
                        {applied?.from
                            ? applied.to ? `${format(applied.from, "MMM d")} – ${format(applied.to, "MMM d, yyyy")}` : format(applied.from, "MMM d, yyyy")
                            : "Select date range"}
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 shadow-2xl rounded-2xl border-[#E5E7EB] dark:border-[#2B364E]" align="end">
                <div className="flex flex-wrap gap-1.5 p-3 border-b border-[#E5E7EB] dark:border-[#2B364E] bg-[#FCFCFD] dark:bg-[#121620]">
                    {presets.map(p => (
                        <button key={p.label} onClick={() => { const r = p.fn(); setTemp(r); onApply(r); }}
                            className="h-7 px-3 text-xs rounded-full bg-[#F3F4F6] dark:bg-[#202638] hover:bg-[#35425F] hover:text-white dark:hover:bg-[#F50069] transition-all font-medium text-[#202638] dark:text-[#D1D5DB]">
                            {p.label}
                        </button>
                    ))}
                </div>
                <Calendar mode="range" selected={temp} onSelect={setTemp} numberOfMonths={2} />
                <div className="flex justify-end gap-2 p-3 border-t border-[#E5E7EB] dark:border-[#2B364E]">
                    <Button variant="ghost" size="sm" onClick={() => setTemp(applied)} className="rounded-xl text-xs">Cancel</Button>
                    <Button size="sm" onClick={() => onApply(temp)} className="rounded-xl text-xs bg-[#35425F] hover:bg-[#283248] text-white">Apply Range</Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
    return <div className={cn("animate-pulse bg-[#E5E7EB]/70 dark:bg-[#2B364E]/70 rounded-xl", className)} />;
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
    const { props }  = usePage<PageProps>();
    const user       = props.auth?.user;
    const access     = user?.access ?? [];
    const branches   = props.branches ?? [];
    const has        = (id: string) => user?.is_super_admin || access.includes(id);

    const [isDark,           setIsDark]           = useState(false);
    const [mounted,          setMounted]          = useState(false);
    const [data,             setData]             = useState<DashData | null>(null);
    const [loading,          setLoading]          = useState(true);
    const [lastRefresh,      setLastRefresh]      = useState<Date | null>(null);
    const [autoRefresh,      setAutoRefresh]      = useState(true);
    const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
    const [dateRange,        setDateRange]        = useState<DateRange | undefined>(manilaRange.thisMonth());

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Detect dark mode
    useEffect(() => {
        setMounted(true);
        const sync = () => setIsDark(document.documentElement.classList.contains("dark"));
        sync();
        const obs = new MutationObserver(sync);
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => obs.disconnect();
    }, []);

    // Fetch data
    const fetchData = useCallback(async () => {
        const from = dateRange?.from ? toDateStr(dateRange.from) : toDateStr(manilaRange.thisMonth().from);
        const to   = dateRange?.to   ? toDateStr(dateRange.to)   : toDateStr(manilaRange.thisMonth().to);
        const params = new URLSearchParams({ from, to });
        if (selectedBranchId) params.set("branch_id", String(selectedBranchId));
        try {
            const res = await fetch(`/dashboard/data?${params}`, { headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" } });
            if (res.ok) { setData(await res.json()); setLastRefresh(new Date()); }
        } catch {}
        finally { setLoading(false); }
    }, [dateRange, selectedBranchId]);

    // Initial + filter change
    useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

    // Auto-refresh every 60 seconds
    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (autoRefresh) {
            intervalRef.current = setInterval(() => { fetchData(); }, 60_000);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [autoRefresh, fetchData]);

    const colors = useChartColors(isDark);
    const opts   = useMemo(() => baseOpts(colors, isDark), [colors, isDark]);

    if (!mounted || !user) return <AdminLayout><div className="min-h-screen bg-[#FCFCFD] dark:bg-[#121620] animate-pulse" /></AdminLayout>;

    const greet = () => { const h = manilaNow().getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };
    const selectedBranch = selectedBranchId ? branches.find(b => b.id === selectedBranchId) ?? null : null;
    const isAdmin   = user.is_super_admin || user.is_administrator;
    const isManager = user.is_manager;

    // ── Chart series derived from data ────────────────────────────────────────
    const dailyDates    = data?.daily_sales.map(d => fmtDate(d.date + "T00:00:00+08:00", "MMM d")) ?? [];
    const dailyRevenue  = data?.daily_sales.map(d => d.revenue)    ?? [];
    const dailyExpenses = data?.daily_sales.map(d => d.expenses)   ?? [];
    const dailyTxns     = data?.daily_sales.map(d => d.transactions) ?? [];

    const hourlyLabels  = data?.hourly_sales.map(h => h.label)     ?? [];
    const hourlyRevenue = data?.hourly_sales.map(h => h.revenue)   ?? [];

    const paymentLabels  = data?.payment_mix.map(p => p.method.charAt(0).toUpperCase() + p.method.slice(1)) ?? [];
    const paymentCounts  = data?.payment_mix.map(p => p.count)   ?? [];
    const paymentRevenue = data?.payment_mix.map(p => p.revenue) ?? [];

    const topNames    = data?.top_products.slice(0, 8).map(p => p.name)    ?? [];
    const topRevenue  = data?.top_products.slice(0, 8).map(p => p.revenue) ?? [];

    const expCatLabels = data?.exp_by_category.map(e => e.category) ?? [];
    const expCatValues = data?.exp_by_category.map(e => e.total)    ?? [];

    const stockAdjLabels = data?.stock_adj.map(a => a.type.charAt(0).toUpperCase() + a.type.slice(1)) ?? [];
    const stockAdjValues = data?.stock_adj.map(a => a.value) ?? [];

    // ── Chart options ─────────────────────────────────────────────────────────
    const areaOpts = {
        ...opts,
        chart: { ...opts.chart, id: "area-revenue", type: "area" as const },
        colors: [colors.c1, colors.c3],
        stroke: { curve: "smooth" as const, width: [3, 2] },
        fill: { type: "gradient", gradient: { shadeIntensity: 0, opacityFrom: 0.25, opacityTo: 0.0, stops: [0, 100] } },
        xaxis: { ...opts.xaxis, categories: dailyDates, tickAmount: Math.min(dailyDates.length, 10) },
        yaxis: { ...opts.yaxis, labels: { ...opts.yaxis.labels, formatter: (v: number) => fmtMoney(v, true) } },
        dataLabels: { enabled: false },
        tooltip: { ...opts.tooltip, y: { formatter: (v: number) => fmtMoney(v) } },
    };

    const txnBarOpts = {
        ...opts,
        chart: { ...opts.chart, id: "bar-txns", type: "bar" as const },
        colors: [colors.c4],
        plotOptions: { bar: { borderRadius: 5, columnWidth: "55%" } },
        xaxis: { ...opts.xaxis, categories: dailyDates, tickAmount: Math.min(dailyDates.length, 10) },
        dataLabels: { enabled: false },
        yaxis: { ...opts.yaxis, labels: { ...opts.yaxis.labels, formatter: (v: number) => fmtNum(v) } },
        tooltip: { ...opts.tooltip, y: { formatter: (v: number) => `${v} txns` } },
    };

    const hourlyOpts = {
        ...opts,
        chart: { ...opts.chart, id: "bar-hourly", type: "bar" as const },
        colors: [colors.c1],
        plotOptions: { bar: { borderRadius: 6, columnWidth: "50%" } },
        xaxis: { ...opts.xaxis, categories: hourlyLabels },
        yaxis: { ...opts.yaxis, labels: { ...opts.yaxis.labels, formatter: (v: number) => fmtMoney(v, true) } },
        dataLabels: { enabled: false },
        tooltip: { ...opts.tooltip, y: { formatter: (v: number) => fmtMoney(v) } },
    };

    const payCountOpts = {
        ...opts,
        chart: { ...opts.chart, id: "donut-pay-count", type: "donut" as const },
        labels: paymentLabels,
        colors: [colors.c1, colors.c3, colors.c4, colors.c2],
        legend: { ...opts.legend, position: "bottom" as const },
        plotOptions: { pie: { donut: { size: "68%", labels: { show: true, total: { show: true, label: "Txns", fontSize: "11px", color: colors.muted } } } } },
        dataLabels: { enabled: false },
        tooltip: { ...opts.tooltip, y: { formatter: (v: number) => `${v} txns` } },
    };

    const payRevOpts = {
        ...opts,
        chart: { ...opts.chart, id: "donut-pay-rev", type: "donut" as const },
        labels: paymentLabels,
        colors: [colors.c1, colors.c3, colors.c4, colors.c2],
        legend: { ...opts.legend, position: "bottom" as const },
        plotOptions: { pie: { donut: { size: "68%", labels: { show: true, total: { show: true, label: "Revenue", fontSize: "11px", color: colors.muted, formatter: () => fmtMoney(paymentRevenue.reduce((a, b) => a + b, 0), true) } } } } },
        dataLabels: { enabled: false },
        tooltip: { ...opts.tooltip, y: { formatter: (v: number) => fmtMoney(v) } },
    };

    const topProductsOpts = {
        ...opts,
        chart: { ...opts.chart, id: "bar-top-products", type: "bar" as const },
        colors: [colors.c1],
        plotOptions: { bar: { horizontal: true, borderRadius: 5, barHeight: "55%" } },
        xaxis: { ...opts.xaxis, categories: topNames, labels: { ...opts.xaxis.labels, formatter: (v: number) => fmtMoney(v, true) } },
        yaxis: { labels: { style: { colors: colors.muted, fontSize: "11px", fontFamily: "Poppins, sans-serif" } } },
        dataLabels: { enabled: false },
        grid: { ...opts.grid, xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
        tooltip: { ...opts.tooltip, y: { formatter: (v: number) => fmtMoney(v) } },
    };

    const stockHealthOpts = {
        ...opts,
        chart: { ...opts.chart, id: "donut-stock", type: "donut" as const },
        labels: ["In stock", "Low stock", "Out of stock"],
        colors: [colors.c2, colors.c6, colors.c5],
        legend: { ...opts.legend, position: "bottom" as const },
        plotOptions: { pie: { donut: { size: "70%", labels: { show: true, total: { show: true, label: "Products", fontSize: "11px", color: colors.muted } } } } },
        dataLabels: { enabled: false },
    };

    const expCatOpts = {
        ...opts,
        chart: { ...opts.chart, id: "bar-exp-cat", type: "bar" as const },
        colors: [colors.c3],
        plotOptions: { bar: { horizontal: true, borderRadius: 5, barHeight: "55%" } },
        xaxis: { ...opts.xaxis, categories: expCatLabels, labels: { ...opts.xaxis.labels, formatter: (v: number) => fmtMoney(v, true) } },
        yaxis: { labels: { style: { colors: colors.muted, fontSize: "11px", fontFamily: "Poppins, sans-serif" } } },
        dataLabels: { enabled: false },
        grid: { ...opts.grid, xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
        tooltip: { ...opts.tooltip, y: { formatter: (v: number) => fmtMoney(v) } },
    };

    const stockAdjOpts = {
        ...opts,
        chart: { ...opts.chart, id: "bar-adj", type: "bar" as const },
        colors: [colors.c6],
        plotOptions: { bar: { borderRadius: 5, columnWidth: "50%", distributed: true } },
        xaxis: { ...opts.xaxis, categories: stockAdjLabels },
        yaxis: { ...opts.yaxis, labels: { ...opts.yaxis.labels, formatter: (v: number) => fmtMoney(v, true) } },
        dataLabels: { enabled: false },
        legend: { show: false },
        tooltip: { ...opts.tooltip, y: { formatter: (v: number) => fmtMoney(v) } },
    };

    const kpis = data?.kpis;

    return (
        <AdminLayout>
            <div className="space-y-6 pb-12 max-w-[1400px] mx-auto font-sans">

                {/* ── 1. Manager Welcome & Operational Hero Banner ─────────── */}
                <div className="relative rounded-3xl p-6 sm:p-8 bg-[#35425F] text-white shadow-lg overflow-hidden border border-[#4D5D81]/40">
                    
                    {/* Dotted texture in corner */}
                    <div
                        className="absolute top-0 right-0 w-80 h-80 pointer-events-none opacity-20"
                        style={{
                            backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1.2px, transparent 1.2px)",
                            backgroundSize: "20px 20px",
                            maskImage: "radial-gradient(circle at top right, black 30%, transparent 80%)",
                            WebkitMaskImage: "radial-gradient(circle at top right, black 30%, transparent 80%)",
                        }}
                    />

                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="space-y-2 max-w-xl">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FDE7F0] text-[#F50069] text-xs font-bold shadow-xs">
                                <Sparkles className="h-3.5 w-3.5 text-[#F50069]" />
                                <span>Store Manager Command Center</span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                                {greet()}, {user.fname}!
                            </h1>
                            <p className="text-sm text-[#D0D7E4] leading-relaxed">
                                Here is the real-time operational overview for your store. Monitor counter sales, live stock counts, and daily cash sessions seamlessly.
                            </p>
                        </div>

                        {/* Fast Operational Action Buttons (Reference Pill Style) */}
                        <div className="flex flex-wrap items-center gap-2.5">
                            {has("2") && (
                                <Link href="/pos">
                                    <Button className="h-11 px-5 rounded-full font-bold text-xs bg-[#F50069] hover:bg-[#D9005B] text-white shadow-md transition-all active:scale-95 flex items-center gap-2">
                                        <ShoppingCart className="h-4 w-4" />
                                        <span>Open POS Counter</span>
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </Button>
                                </Link>
                            )}
                            {has("14") && (
                                <Link href="/cash-sessions">
                                    <Button variant="outline" className="h-11 px-4 rounded-full font-bold text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm transition-all flex items-center gap-2">
                                        <Wallet className="h-4 w-4 text-[#FDE7F0]" />
                                        <span>Cash Sessions</span>
                                    </Button>
                                </Link>
                            )}
                            {has("36") && (
                                <Link href="/stock-count">
                                    <Button variant="outline" className="h-11 px-4 rounded-full font-bold text-xs bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm transition-all flex items-center gap-2">
                                        <ClipboardCheck className="h-4 w-4 text-[#FDE7F0]" />
                                        <span>Stock Count</span>
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── 2. Filters & Status Strip ───────────────────────────── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#1A202C] border border-[#E5E7EB] dark:border-[#2B364E] shadow-xs">
                    <div className="flex items-center gap-2.5 flex-wrap text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#35425F]/10 dark:bg-[#35425F]/30 text-[#35425F] dark:text-[#FDE7F0] font-bold">
                            <Store className="h-3.5 w-3.5" />
                            <span>{user.branch?.name ?? "Store Terminal"}</span>
                        </div>
                        <span>•</span>
                        <div className="flex items-center gap-1 font-medium">
                            <CalendarIcon className="h-3.5 w-3.5" />
                            <span>{data ? `${fmtDate(data.period.from + "T00:00:00+08:00", "MMM d")} – ${fmtDate(data.period.to + "T00:00:00+08:00", "MMM d, yyyy")}` : "Loading range..."}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {isAdmin && branches.length > 1 && (
                            <BranchFilter branches={branches} selected={selectedBranchId} onChange={setSelectedBranchId} />
                        )}
                        <DateFilter applied={dateRange} onApply={setDateRange} />

                        {/* Auto-refresh toggle */}
                        <button
                            onClick={() => setAutoRefresh(v => !v)}
                            title={autoRefresh ? "Auto-refresh ON (every 60s)" : "Auto-refresh OFF"}
                            className={cn("h-9 px-3 flex items-center gap-1.5 rounded-xl border text-xs font-bold transition-all",
                                autoRefresh ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "border-[#E5E7EB] dark:border-[#2B364E] text-[#6B7280] hover:bg-[#F3F4F6]",
                            )}>
                            <Activity className="h-3.5 w-3.5" />
                            <span>{autoRefresh ? "Live" : "Paused"}</span>
                        </button>

                        <button
                            onClick={() => { setLoading(true); fetchData(); }}
                            className="h-9 w-9 flex items-center justify-center rounded-xl border border-[#E5E7EB] dark:border-[#2B364E] text-[#6B7280] hover:text-[#202638] dark:hover:text-white hover:bg-[#F3F4F6] dark:hover:bg-[#202638] transition-all"
                            title="Refresh now">
                            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                        </button>
                    </div>
                </div>

                {/* ── 3. Primary KPI Metric Cards (Top 4 Big Cards) ────────── */}
                <div>
                    <SectionTitle>Key Store Performance</SectionTitle>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
                        <KpiCard
                            title="Total Sales Revenue"
                            value={kpis ? fmtMoney(kpis.revenue, true) : "—"}
                            change={kpis?.revenue_change}
                            icon={TrendingUp}
                            accent="primary"
                            loading={loading}
                            href={has("19") ? "/reports/sales" : undefined}
                        />
                        <KpiCard
                            title="Total Store Expenses"
                            value={kpis ? fmtMoney(kpis.expenses, true) : "—"}
                            change={kpis?.expenses_change}
                            icon={TrendingDown}
                            accent="magenta"
                            loading={loading}
                            href={has("21") ? "/reports/expenses" : undefined}
                        />
                        <KpiCard
                            title="Net Store Profit"
                            value={kpis ? fmtMoney(kpis.net_income, true) : "—"}
                            change={kpis?.net_income_change}
                            icon={Banknote}
                            accent="green"
                            loading={loading}
                            href={has("18") ? "/reports/daily" : undefined}
                        />
                        <KpiCard
                            title="Completed Orders"
                            value={kpis ? fmtNum(kpis.transactions) : "—"}
                            change={kpis?.txn_change}
                            icon={ShoppingCart}
                            accent="slate"
                            loading={loading}
                            href={has("3") ? "/sales/history" : undefined}
                        />
                    </div>
                </div>

                {/* ── 4. Secondary Quick Metrics Row (6 Grid) ──────────────── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                        { title: "Avg Daily Sales", value: kpis ? fmtMoney(kpis.avg_daily, true) : "—", icon: BarChart2, accent: "primary" as const },
                        { title: "Discounts Given", value: kpis ? fmtMoney(kpis.discount_total, true) : "—", icon: Receipt, accent: "magenta" as const },
                        { title: "Voided Orders", value: kpis ? `${fmtNum(kpis.void_count)} txns` : "—", icon: ClipboardList, accent: "amber" as const },
                        { title: "Voided Total", value: kpis ? fmtMoney(kpis.void_total, true) : "—", icon: TrendingDown, accent: "red" as const },
                        { title: "Stock Loss / Damage", value: kpis ? fmtMoney(kpis.stock_loss_value, true) : "—", icon: PackageX, accent: "magenta" as const, href: has("31") ? "/reports/stock-loss" : undefined },
                        { title: "Avg Basket Size", value: kpis && kpis.transactions > 0 ? fmtMoney(kpis.revenue / kpis.transactions, true) : "—", icon: Zap, accent: "green" as const },
                    ].map((k, i) => (
                        <KpiCard key={i} title={k.title} value={k.value} icon={k.icon} accent={k.accent} loading={loading} href={(k as any).href} />
                    ))}
                </div>

                {/* ── 5. Analytics Charts Row ──────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <ChartCard
                        className="lg:col-span-2"
                        title="Revenue vs Expenses Trend"
                        subtitle={`Daily performance · ${data ? Math.round(data.period.days) : "—"} days`}
                        href={has("19") ? "/reports/sales" : undefined}
                    >
                        {loading ? <Skeleton className="h-64 w-full" /> : (
                            <ReactApexChart
                                options={areaOpts as any}
                                series={[{ name: "Revenue", data: dailyRevenue }, { name: "Expenses", data: dailyExpenses }]}
                                type="area"
                                height={260}
                            />
                        )}
                    </ChartCard>

                    <ChartCard title="Daily Order Volume" subtitle="Transactions per day">
                        {loading ? <Skeleton className="h-64 w-full" /> : (
                            <ReactApexChart
                                options={txnBarOpts as any}
                                series={[{ name: "Orders", data: dailyTxns }]}
                                type="bar"
                                height={260}
                            />
                        )}
                    </ChartCard>
                </div>

                {/* ── 6. Today's Hourly Sales Peak ─────────────────────────── */}
                <ChartCard title="Today's Hourly Sales & Peak Checkout Times" subtitle="Sales volume by hour (today)">
                    {loading ? <Skeleton className="h-48 w-full" /> : (
                        <ReactApexChart
                            options={hourlyOpts as any}
                            series={[{ name: "Hourly Sales", data: hourlyRevenue }]}
                            type="bar"
                            height={210}
                        />
                    )}
                </ChartCard>

                {/* ── 7. Payment Mix & Stock Health Row ────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <ChartCard title="Payment Mix (Txns)" subtitle="By transaction count">
                        {loading ? <Skeleton className="h-52 w-full" /> : paymentCounts.length > 0 ? (
                            <ReactApexChart options={payCountOpts as any} series={paymentCounts} type="donut" height={220} />
                        ) : <p className="text-center text-[#6B7280] py-8 text-sm">No data recorded</p>}
                    </ChartCard>

                    <ChartCard title="Payment Mix (Revenue)" subtitle="By revenue share">
                        {loading ? <Skeleton className="h-52 w-full" /> : paymentRevenue.length > 0 ? (
                            <ReactApexChart options={payRevOpts as any} series={paymentRevenue} type="donut" height={220} />
                        ) : <p className="text-center text-[#6B7280] py-8 text-sm">No data recorded</p>}
                    </ChartCard>

                    <ChartCard title="Inventory Health" subtitle="Products by availability" href={has("11") ? "/stock" : undefined}>
                        {loading ? <Skeleton className="h-52 w-full" /> : (
                            <ReactApexChart
                                options={stockHealthOpts as any}
                                series={[data?.stock_health.inStock ?? 0, data?.stock_health.lowStock ?? 0, data?.stock_health.outStock ?? 0]}
                                type="donut"
                                height={220}
                            />
                        )}
                    </ChartCard>

                    <ChartCard title="Stock Losses by Type" subtitle="Recorded loss value" href={has("31") ? "/reports/stock-loss" : undefined}>
                        {loading ? <Skeleton className="h-52 w-full" /> : stockAdjValues.length > 0 ? (
                            <ReactApexChart
                                options={stockAdjOpts as any}
                                series={[{ name: "Loss Value", data: stockAdjValues }]}
                                type="bar"
                                height={220}
                            />
                        ) : <p className="text-center text-[#6B7280] py-8 text-sm">No losses recorded</p>}
                    </ChartCard>
                </div>

                {/* ── 8. Best Sellers & Expense Breakdown ──────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <ChartCard title="Top Best-Selling Products" subtitle="Ranked by total revenue" href={has("6") ? "/products" : undefined}>
                        {loading ? <Skeleton className="h-72 w-full" /> : topRevenue.length > 0 ? (
                            <ReactApexChart
                                options={topProductsOpts as any}
                                series={[{ name: "Revenue", data: topRevenue }]}
                                type="bar"
                                height={280}
                            />
                        ) : <p className="text-center text-[#6B7280] py-8 text-sm">No sales data</p>}
                    </ChartCard>

                    <ChartCard title="Expenses by Category" subtitle="Store operational costs" href={has("17") ? "/expenses" : undefined}>
                        {loading ? <Skeleton className="h-72 w-full" /> : expCatValues.length > 0 ? (
                            <ReactApexChart
                                options={expCatOpts as any}
                                series={[{ name: "Amount", data: expCatValues }]}
                                type="bar"
                                height={280}
                            />
                        ) : <p className="text-center text-[#6B7280] py-8 text-sm">No expenses recorded</p>}
                    </ChartCard>
                </div>

                {/* ── 9. Live Operational Widgets (2x2 Grid) ───────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    
                    {/* Low Stock & Out of Stock */}
                    <Card className="rounded-2xl border-[#E5E7EB] dark:border-[#2B364E] bg-white dark:bg-[#1A202C] shadow-xs">
                        <div className="flex items-center justify-between px-6 pt-5 pb-2">
                            <div className="flex items-center gap-2.5">
                                <div className="h-8 w-8 rounded-xl bg-[#FDE7F0] dark:bg-[#3D1426] text-[#F50069] flex items-center justify-center">
                                    <AlertTriangle className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-[#202638] dark:text-[#F9FAFB]">Low &amp; Out of Stock Alerts</p>
                                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
                                        {data ? `${(data.stock_health.lowStock + data.stock_health.outStock)} products need reorder` : "—"}
                                    </p>
                                </div>
                            </div>
                            {has("11") && (
                                <Link href="/stock" className="text-xs font-bold text-[#F50069] hover:underline flex items-center gap-1">
                                    Manage <ExternalLink className="h-3 w-3" />
                                </Link>
                            )}
                        </div>
                        <CardContent className="px-6 pb-5 pt-1">
                            {loading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full mb-1.5" />) :
                             data?.low_stock_items.length === 0 ? (
                                <div className="text-center py-8">
                                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                                    <p className="text-sm font-semibold text-[#202638] dark:text-[#F9FAFB]">All shelves are well stocked!</p>
                                    <p className="text-xs text-[#6B7280]">No items currently below threshold.</p>
                                </div>
                            ) : data?.low_stock_items.map((item, i, arr) => (
                                <ListRow key={i} last={i === arr.length - 1}>
                                    <p className="text-sm font-medium flex-1 truncate text-[#202638] dark:text-[#F9FAFB]">{item.name}</p>
                                    <span className="text-xs font-bold tabular-nums text-[#6B7280] dark:text-[#9CA3AF]">{item.stock} left</span>
                                    <StatusBadge status={item.status} />
                                </ListRow>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Recent Counter Transactions */}
                    <Card className="rounded-2xl border-[#E5E7EB] dark:border-[#2B364E] bg-white dark:bg-[#1A202C] shadow-xs">
                        <div className="flex items-center justify-between px-6 pt-5 pb-2">
                            <div>
                                <p className="text-sm font-bold text-[#202638] dark:text-[#F9FAFB]">Recent Counter Receipts</p>
                                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">Latest 10 sales</p>
                            </div>
                            {has("3") && (
                                <Link href="/sales/history" className="text-xs font-bold text-[#35425F] dark:text-[#FDE7F0] hover:underline flex items-center gap-1">
                                    View All <ExternalLink className="h-3 w-3" />
                                </Link>
                            )}
                        </div>
                        <CardContent className="px-6 pb-5 pt-1">
                            {loading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full mb-1.5" />) :
                             data?.recent_sales.length === 0 ? (
                                <p className="text-sm text-[#6B7280] text-center py-8">No counter transactions yet</p>
                            ) : data?.recent_sales.map((s, i, arr) => (
                                <ListRow key={s.id} last={i === arr.length - 1}>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-[#202638] dark:text-[#F9FAFB] truncate">{s.receipt_number}</p>
                                        <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">{fmtActivity(s.created_at)} • {s.cashier || "Cashier"}</p>
                                    </div>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize bg-[#F3F4F6] dark:bg-[#202638] text-[#6B7280] dark:text-[#9CA3AF]">
                                        {s.payment_method}
                                    </span>
                                    <span className="text-sm font-bold tabular-nums text-[#202638] dark:text-[#F9FAFB]">{fmtMoney(s.total)}</span>
                                    <StatusBadge status={s.status} />
                                </ListRow>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Cash Sessions & Registers */}
                    {has("14") && (
                        <Card className="rounded-2xl border-[#E5E7EB] dark:border-[#2B364E] bg-white dark:bg-[#1A202C] shadow-xs">
                            <div className="flex items-center justify-between px-6 pt-5 pb-2">
                                <div>
                                    <p className="text-sm font-bold text-[#202638] dark:text-[#F9FAFB]">Cash Register Shifts</p>
                                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">Drawer floats &amp; reconciliations</p>
                                </div>
                                <Link href="/cash-sessions" className="text-xs font-bold text-[#35425F] dark:text-[#FDE7F0] hover:underline flex items-center gap-1">
                                    All Sessions <ExternalLink className="h-3 w-3" />
                                </Link>
                            </div>
                            <CardContent className="px-6 pb-5 pt-1">
                                {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full mb-1.5" />) :
                                 data?.recent_sessions.length === 0 ? (
                                    <p className="text-sm text-[#6B7280] text-center py-8">No active cash sessions found</p>
                                ) : data?.recent_sessions.map((s, i, arr) => {
                                    const overShort = s.over_short ?? (s.counted_cash !== null ? s.counted_cash - s.expected_cash : null);
                                    return (
                                        <ListRow key={s.id} last={i === arr.length - 1}>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-[#202638] dark:text-[#F9FAFB] truncate">{s.cashier || "Counter Register"}</p>
                                                <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                                                    {s.opened_at ? fmtDate(s.opened_at, "MMM d, h:mm a") : "—"}
                                                </p>
                                            </div>
                                            <span className="text-sm font-bold tabular-nums text-[#202638] dark:text-[#F9FAFB]">{fmtMoney(s.expected_cash, true)}</span>
                                            {s.status === "open" ? (
                                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">● Open</span>
                                            ) : overShort !== null ? (
                                                <span className={cn("text-xs font-bold tabular-nums", overShort >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600")}>
                                                    {overShort >= 0 ? "+" : ""}{fmtMoney(overShort, true)}
                                                </span>
                                            ) : null}
                                            <StatusBadge status={s.status} />
                                        </ListRow>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}

                    {/* Pending Purchase Orders */}
                    {has("12") && (
                        <Card className="rounded-2xl border-[#E5E7EB] dark:border-[#2B364E] bg-white dark:bg-[#1A202C] shadow-xs">
                            <div className="flex items-center justify-between px-6 pt-5 pb-2">
                                <div>
                                    <p className="text-sm font-bold text-[#202638] dark:text-[#F9FAFB]">Pending Purchase Orders</p>
                                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">Supplier shipments awaiting action</p>
                                </div>
                                <Link href="/purchase-orders" className="text-xs font-bold text-[#35425F] dark:text-[#FDE7F0] hover:underline flex items-center gap-1">
                                    All Orders <ExternalLink className="h-3 w-3" />
                                </Link>
                            </div>
                            <CardContent className="px-6 pb-5 pt-1">
                                {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full mb-1.5" />) :
                                 data?.pending_orders.length === 0 ? (
                                    <p className="text-sm text-[#6B7280] text-center py-8">No pending orders</p>
                                ) : data?.pending_orders.map((o, i, arr) => (
                                    <ListRow key={o.id} last={i === arr.length - 1}>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-[#202638] dark:text-[#F9FAFB] truncate">{o.order_number}</p>
                                            <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] truncate">{o.supplier}</p>
                                        </div>
                                        <span className="text-sm font-bold tabular-nums text-[#202638] dark:text-[#F9FAFB]">{fmtMoney(o.total, true)}</span>
                                        <StatusBadge status={o.status} />
                                    </ListRow>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                </div>

                {/* ── 10. Multi-Branch System Overview (Admins) ───────────── */}
                {isAdmin && data?.system_overview && (
                    <div>
                        <SectionTitle>Global Operations Overview</SectionTitle>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <KpiCard title="Active Branches" value={fmtNum(data.system_overview.branch_count)} icon={Building2} accent="primary" href="/branches" />
                            <KpiCard title="Total Staff" value={fmtNum(data.system_overview.user_count)} icon={Users} accent="slate" href="/users" />
                            <KpiCard title="Catalog Products" value={fmtNum(data.system_overview.product_count)} icon={Package} accent="green" href="/products" />
                            <KpiCard title="Pending Orders" value={fmtNum(data.system_overview.pending_orders)} icon={ClipboardList} accent="amber" href="/purchase-orders" />
                        </div>
                    </div>
                )}

            </div>
        </AdminLayout>
    );
}
