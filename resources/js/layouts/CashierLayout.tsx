"use client";

import { ReactNode, useEffect } from "react";
import { Link, Head, router, usePage } from "@inertiajs/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import {
    ShoppingCart, History, Wallet, Calculator,
    PiggyBank, LogOut, Sun, Moon, CalendarClock, Store,
} from "lucide-react";

// ─── Menu IDs (must match MenuHelper.php) ─────────────────────────────────────
const M = {
    POS:           "2",
    SALES_HISTORY: "3",
    CASH_SESSIONS: "14",
    CASH_COUNTS:   "15",
    PETTY_CASH:    "16",
    INSTALLMENTS:  "32",
} as const;

// Alt+1…6 — reliably interceptable, don't clash with browser or POS F-key bindings
const NAV = [
    { id: M.POS,           href: "/pos",           icon: ShoppingCart,  label: "Cashier",      key: "Alt+1", accent: "emerald" },
    { id: M.SALES_HISTORY, href: "/sales/history", icon: History,       label: "History",      key: "Alt+2", accent: "sky" },
    { id: M.CASH_SESSIONS, href: "/cash-sessions", icon: Wallet,        label: "Cash Session", key: "Alt+3", accent: "violet" },
    { id: M.CASH_COUNTS,   href: "/cash-counts",   icon: Calculator,    label: "Cash Count",   key: "Alt+4", accent: "amber" },
    { id: M.PETTY_CASH,    href: "/petty-cash",    icon: PiggyBank,     label: "Petty Cash",   key: "Alt+5", accent: "rose" },
    { id: M.INSTALLMENTS,  href: "/installments",  icon: CalendarClock, label: "Installments", key: "Alt+6", accent: "cyan" },
] as const;

const navAccentClass: Record<typeof NAV[number]["accent"], { active: string; icon: string; idleIcon: string; glow: string }> = {
    emerald: {
        active: "border-emerald-400 bg-emerald-500/15 text-emerald-50 shadow-[0_8px_22px_rgba(16,185,129,0.22)]",
        icon: "bg-emerald-400 text-emerald-950",
        idleIcon: "bg-emerald-500/15 text-emerald-200",
        glow: "bg-emerald-300",
    },
    sky: {
        active: "border-sky-400 bg-sky-500/15 text-sky-50 shadow-[0_8px_22px_rgba(14,165,233,0.22)]",
        icon: "bg-sky-400 text-sky-950",
        idleIcon: "bg-sky-500/15 text-sky-200",
        glow: "bg-sky-300",
    },
    violet: {
        active: "border-violet-400 bg-violet-500/15 text-violet-50 shadow-[0_8px_22px_rgba(139,92,246,0.22)]",
        icon: "bg-violet-400 text-violet-950",
        idleIcon: "bg-violet-500/15 text-violet-200",
        glow: "bg-violet-300",
    },
    amber: {
        active: "border-amber-400 bg-amber-500/15 text-amber-50 shadow-[0_8px_22px_rgba(245,158,11,0.22)]",
        icon: "bg-amber-300 text-amber-950",
        idleIcon: "bg-amber-500/15 text-amber-100",
        glow: "bg-amber-300",
    },
    rose: {
        active: "border-rose-400 bg-rose-500/15 text-rose-50 shadow-[0_8px_22px_rgba(244,63,94,0.22)]",
        icon: "bg-rose-400 text-rose-950",
        idleIcon: "bg-rose-500/15 text-rose-100",
        glow: "bg-rose-300",
    },
    cyan: {
        active: "border-cyan-400 bg-cyan-500/15 text-cyan-50 shadow-[0_8px_22px_rgba(6,182,212,0.22)]",
        icon: "bg-cyan-300 text-cyan-950",
        idleIcon: "bg-cyan-500/15 text-cyan-100",
        glow: "bg-cyan-300",
    },
};

export default function CashierLayout({ children }: { children: ReactNode }) {
    const { props } = usePage<any>();
    const { theme, setTheme } = useTheme();
    const logoUrl = props.app?.logo_url ?? null;
    const iconUrl = props.app?.icon_url ?? null;
    const businessName = props.app?.business_name ?? props.app?.name ?? "Point of Sale";
    const logoKey = `${logoUrl ?? "emblem"}|${props.app?.logo_version ?? ""}`;
    const currentPath = usePage().url.split("?")[0].replace(/\/$/, "");

    const access: string[] = props.auth?.user?.access ?? [];
    const has = (id: string) => access.includes(id);

    const user   = props.auth?.user;
    const branch = (props.branch as any) ?? user?.branch;
    const session = props.session as any;   // only present on POS page

    const isActive = (href: string) => {
        const h = href.replace(/\/$/, "");
        return currentPath === h || currentPath.startsWith(h + "/");
    };

    // Global nav shortcuts — disabled on /pos (it registers its own F-key handlers)
    useEffect(() => {
        if (currentPath === "/pos") return;
        const fn = (e: KeyboardEvent) => {
            if (!e.altKey) return;
            const digit = e.key; // "1"–"5" when altKey is held
            const item = NAV.find(n => n.key === `Alt+${digit}`);
            if (!item) return;
            // Always suppress the browser's Alt+key action first
            e.preventDefault();
            if (has(item.id)) router.visit(item.href);
        };
        window.addEventListener("keydown", fn);
        return () => window.removeEventListener("keydown", fn);
    }, [currentPath, access.join(",")]);

    const visibleNav = NAV.filter(n => has(n.id));

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
            <Head>
                <title>{(props as any).title ? `${(props as any).title} | ${businessName}` : businessName}</title>
                {iconUrl && <link rel="icon" href={iconUrl} type="image/png" />}
            </Head>

            {/* ── Top bar (h-12) ───────────────────────────────────── */}
            <header className="shrink-0 h-12 bg-card border-b border-border flex items-center justify-between px-4 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    {logoUrl ? (
                        <div className="shrink-0 h-8 w-14 flex items-center justify-center p-0.5">
                            <img key={logoKey} src={logoUrl} alt={businessName} className="max-h-full max-w-full object-contain" />
                        </div>
                    ) : (
                        <div className="shrink-0 h-8 w-8 flex items-center justify-center p-0.5">
                            <img src="/eajicon.png" alt={businessName} className="max-h-full max-w-full object-contain" />
                        </div>
                    )}
                    <span className="font-semibold text-sm truncate text-foreground">
                        {branch?.name ?? businessName}
                    </span>
                    {/* Session status — only shown when POS passes it as a prop */}
                    {session !== undefined && (
                        <div className={cn(
                            "hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0",
                            session
                                ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                        )}>
                            <span className={cn("h-1.5 w-1.5 rounded-full",
                                session ? "bg-green-500" : "bg-amber-500")} />
                            {session ? "Session Open" : "No Session"}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden md:block text-xs text-muted-foreground">
                        {user?.fname} {user?.lname}
                        <span className="ml-1 px-1.5 py-0.5 rounded bg-muted text-[10px] font-bold uppercase">Cashier</span>
                    </span>
                    <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                        aria-label="Toggle theme"
                    >
                        <Sun className="h-3.5 w-3.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute h-3.5 w-3.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    </Button>
                </div>
            </header>

            {/* ── Page content ─────────────────────────────────────── */}
            {/* POS page manages its own layout — no padding, no overflow */}
            <main className={cn("flex-1 min-h-0 overflow-hidden", currentPath !== "/pos" && "overflow-y-auto p-6")}>
                {children}
            </main>

            {/* ── Bottom nav bar (h-16) ────────────────────────────── */}
            <nav className="shrink-0 h-16 select-none border-t border-border bg-slate-950 px-2 py-1.5">
                <div className="flex h-full items-stretch gap-1.5">
                {visibleNav.map(item => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    const accent = navAccentClass[item.accent];
                    return (
                        <Link
                            key={item.id}
                            href={item.href}
                            className={cn(
                                "group relative flex-1 min-w-0 overflow-hidden rounded-xl border px-1.5 transition-all duration-150",
                                "flex items-center justify-center gap-2 sm:flex-col sm:gap-0.5",
                                active
                                    ? accent.active
                                    : "border-white/10 bg-white/[0.045] text-slate-300 hover:border-white/25 hover:bg-white/[0.075] hover:text-white"
                            )}
                        >
                            {active && <span className={cn("absolute left-3 right-3 top-0 h-0.5 rounded-full", accent.glow)} />}
                            <span className={cn(
                                "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-all sm:h-7 sm:w-7",
                                active ? accent.icon : accent.idleIcon
                            )}>
                                <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 text-left sm:text-center">
                                <span className="block truncate text-[11px] font-black leading-none sm:text-[10px]">{item.label}</span>
                                <span className={cn(
                                    "mt-0.5 hidden text-[8px] font-bold leading-none sm:block",
                                    active ? "text-white/70" : "text-slate-500"
                                )}>
                                    {item.key}
                                </span>
                            </span>
                            <span className={cn(
                                "absolute bottom-1 right-1 hidden h-1.5 w-1.5 rounded-full md:block",
                                active ? accent.glow : "bg-slate-700"
                            )} />
                        </Link>
                    );
                })}

                {/* Logout */}
                <button
                    onClick={() => router.post("/logout", {}, { preserveState: false })}
                    className="shrink-0 w-16 rounded-xl border border-white/10 bg-white/[0.045] text-slate-300 transition-all hover:border-red-400/50 hover:bg-red-500/15 hover:text-red-100 sm:w-20 flex flex-col items-center justify-center gap-0.5"
                >
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-red-500/15 text-red-200">
                        <LogOut className="h-4 w-4" />
                    </span>
                    <span className="text-[10px] font-black leading-none">Logout</span>
                </button>
                </div>
            </nav>
        </div>
    );
}
