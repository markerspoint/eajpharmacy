"use client";

import { ReactNode, useEffect, useState } from "react";
import { Link, Head, router, usePage } from "@inertiajs/react";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger,
} from "@/components/ui/sidebar";

import {
    Avatar,
    AvatarFallback,
} from "@/components/ui/avatar";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Button } from "@/components/ui/button";

import {
    LayoutDashboard,
    ShoppingCart,
    History,
    TableProperties,
    ShoppingBag,
    Package,
    Tag,
    Layers,
    GitMerge,
    ChefHat,
    Boxes,
    ClipboardList,
    PackageCheck,
    Wallet,
    Calculator,
    PiggyBank,
    Receipt,
    BarChart2,
    TrendingUp,
    ArchiveX,
    PackageX,
    FileText,
    ScrollText,
    Users,
    Truck,
    Building2,
    Armchair,
    FolderOpen,
    Settings,
    LogOut,
    Bell,
    Sun,
    Moon,
    ChevronDown,
    CalendarClock,
    LayoutList,
    ArrowLeftRight,
    Warehouse,
    ClipboardCheck,
    BookImage,
    Store,
} from "lucide-react";

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { routes } from "@/routes";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import FloatingChat from "@/components/FloatingChat";
import CashierLayout from "./CashierLayout";

interface AdminLayoutProps {
    children: ReactNode;
}

// ─── Menu ID constants (must match MenuHelper.php) ───────────────────────────
const MENU = {
    DASHBOARD:          "1",
    POS:                "2",
    SALES_HISTORY:      "3",
    TABLE_ORDERS:       "4",
    SHOP_ORDERS:        "5",
    PRODUCTS:           "6",
    CATEGORIES:         "7",
    VARIANTS:           "8",
    BUNDLES:            "9",
    RECIPES:            "10",
    STOCK:              "11",
    PURCHASE_ORDERS:    "12",
    GRN:                "13",
    CASH_SESSIONS:      "14",
    CASH_COUNTS:        "15",
    PETTY_CASH:         "16",
    EXPENSES:           "17",
    DAILY_SUMMARY:      "18",
    SALES_REPORT:       "19",
    INVENTORY_REPORT:   "20",
    EXPENSE_REPORT:           "21",
    INGREDIENT_USAGE_REPORT:  "30",
    ACTIVITY_LOGS:            "22",
    USERS:              "23",
    SUPPLIERS:          "24",
    BRANCHES:           "25",
    DINING_TABLES:      "26",
    EXPENSE_CATEGORIES: "27",
    SYSTEM_SETTINGS:    "28",
    PROMOS:             "29",
    STOCK_ADJUSTMENTS:  "31",
    INSTALLMENTS:       "32",
    INVENTORY:          "33",
    STOCK_TRANSFERS:    "34",
    WAREHOUSES:         "35",
    STOCK_COUNT:        "36",
    BROCHURE:           "37",
} as const;

// ─── Sidebar section header ───────────────────────────────────────────────────
function SidebarSectionLabel({ label }: { label: string }) {
    return (
        <p className="px-3 pt-5 pb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF] group-data-[collapsible=icon]:hidden">
            {label}
        </p>
    );
}

// ─── Simple flat link ─────────────────────────────────────────────────────────
function NavItem({
    href,
    icon: Icon,
    label,
    active,
    tooltip,
}: {
    href: string;
    icon: React.ElementType;
    label: string;
    active: boolean;
    tooltip?: string;
}) {
    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                asChild
                tooltip={tooltip ?? label}
                className={cn(
                    "h-10 px-3 rounded-xl text-sm font-medium transition-all duration-150 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center",
                    active
                        ? "bg-[#35425F] text-[#FFFFFF] dark:bg-[#F50069] dark:text-[#FFFFFF] shadow-sm font-semibold hover:bg-[#283248] dark:hover:bg-[#D9005B] hover:text-white"
                        : "text-[#202638] dark:text-[#D1D5DB] hover:bg-[#F3F4F6] dark:hover:bg-[#202638] hover:text-[#202638] dark:hover:text-[#FFFFFF]"
                )}
            >
                <Link href={href} className="flex items-center gap-3 w-full group-data-[collapsible=icon]:justify-center">
                    <Icon className={cn("h-5 w-5 shrink-0", active ? "text-white" : "text-[#6B7280] dark:text-[#9CA3AF]")} />
                    <span className="truncate group-data-[collapsible=icon]:hidden">{label}</span>
                </Link>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}

// ─── Collapsible group ────────────────────────────────────────────────────────
function NavGroup({
    icon: Icon,
    label,
    active,
    children,
}: {
    icon: React.ElementType;
    label: string;
    active: boolean;
    children: ReactNode;
}) {
    return (
        <SidebarMenuItem>
            <Collapsible defaultOpen={active}>
                <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                        tooltip={label}
                        className={cn(
                            "h-10 px-3 rounded-xl text-sm font-medium justify-between transition-all duration-150 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center [&[data-state=open]>svg:last-child]:rotate-180",
                            active
                                ? "bg-[#35425F]/10 dark:bg-[#35425F]/30 text-[#35425F] dark:text-[#F9FAFB] font-semibold"
                                : "text-[#202638] dark:text-[#D1D5DB] hover:bg-[#F3F4F6] dark:hover:bg-[#202638] hover:text-[#202638] dark:hover:text-[#FFFFFF]"
                        )}
                    >
                        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
                            <Icon className={cn("h-5 w-5 shrink-0", active ? "text-[#35425F] dark:text-[#F50069]" : "text-[#6B7280] dark:text-[#9CA3AF]")} />
                            <span className="truncate group-data-[collapsible=icon]:hidden">{label}</span>
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 transition-transform text-[#6B7280] dark:text-[#9CA3AF] group-data-[collapsible=icon]:hidden" />
                    </SidebarMenuButton>
                </CollapsibleTrigger>
                <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                    <div className="ml-4 mt-1 mb-1.5 flex flex-col gap-0.5 pl-2.5 border-l-2 border-[#E5E7EB] dark:border-[#2B364E]">
                        {children}
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </SidebarMenuItem>
    );
}

// ─── Sub-link inside a NavGroup ───────────────────────────────────────────────
function SubLink({
    href,
    label,
    active,
}: {
    href: string;
    label: string;
    active: boolean;
}) {
    return (
        <Link
            href={href}
            className={cn(
                "text-xs py-2 px-2.5 rounded-lg transition-all duration-150 truncate font-medium",
                active
                    ? "bg-[#35425F] text-[#FFFFFF] dark:bg-[#F50069] dark:text-[#FFFFFF] font-semibold shadow-xs"
                    : "text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#202638] hover:text-[#202638] dark:hover:text-[#FFFFFF]"
            )}
        >
            {label}
        </Link>
    );
}

// ─── Main layout ──────────────────────────────────────────────────────────────
export default function AdminLayout({ children }: AdminLayoutProps) {
    const { props } = usePage<any>();
    const { theme, setTheme } = useTheme();
    const logoUrl = props.app?.logo_url ?? null;
    const iconUrl = props.app?.icon_url ?? null;
    const businessName = props.app?.business_name ?? props.app?.name ?? "Point of Sale";
    const logoKey = `${logoUrl ?? "emblem"}|${props.app?.logo_version ?? ""}`;
    const currentPath = usePage().url.split("?")[0].replace(/\/$/, "") || "/";
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // tablet / restaurant / grocery / cafe / salon → bottom static nav (no sidebar)
    // mobile → keep sidebar as normal
    // kiosk  → handled inside Pos/Index.tsx (truly full-screen, no layout wrapper)
    const posLayout = props.auth?.user?.pos_layout ?? "grid";
    const BOTTOM_NAV_LAYOUTS = ["tablet", "restaurant", "grocery", "cafe", "salon"];
    if (BOTTOM_NAV_LAYOUTS.includes(posLayout)) {
        return <CashierLayout>{children}</CashierLayout>;
    }

    const isActive = (path: string): boolean => {
        const p = path.replace(/\/$/, "");
        return currentPath === p || currentPath.startsWith(p + "/");
    };

    const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

    const userAccess: string[] = props.auth?.user?.access ?? [];
    const has = (id: string) => userAccess.includes(id);

    const role: string = props.auth?.user?.role ?? "";
    const roleLabel = () => {
        if (role === "super_admin")   return "Super Admin";
        if (role === "administrator") return "Administrator";
        if (role === "manager")       return "Manager";
        if (role === "cashier")       return "Cashier";
        return role;
    };

    // Inventory group active if any sub-path is active
    const inventoryActive = ["/products", "/categories", "/variants", "/bundles", "/recipes", "/stock", "/purchase-orders", "/grn", "/stock-adjustments", "/inventory", "/stock-transfers", "/warehouses"].some(isActive);
    // Cash group active
    const cashActive = ["/cash-sessions", "/cash-counts", "/petty-cash", "/expenses"].some(isActive);
    // Reports group active
    const reportsActive = ["/reports", "/logs", "/stock-adjustments"].some(isActive);
    // Management group active
    const managementActive = ["/users", "/suppliers", "/branches", "/dining-tables", "/settings"].some(isActive);

    return (
        <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <div className="flex min-h-screen w-full bg-background text-foreground">

                {/* ── SIDEBAR ─────────────────────────────────────────── */}
                <Sidebar collapsible="icon" className="border-r border-border">
                    <Head>
                        <title>{props.title ? `${props.title} | ${businessName}` : businessName}</title>
                        {iconUrl && <link rel="icon" href={iconUrl} type="image/png" />}
                    </Head>

                    {/* Header / Logo */}
                    <SidebarHeader className="border-b border-border">
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton size="lg" asChild className="group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center">
                                    <Link href={has(MENU.DASHBOARD) ? routes.dashboard() : routes.pos.index()} className="flex items-center gap-3 w-full group-data-[collapsible=icon]:justify-center">
                                        {logoUrl ? (
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center p-0.5">
                                                <img key={logoKey} src={logoUrl} alt={businessName} className="max-h-full max-w-full object-contain" />
                                            </div>
                                        ) : (
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center p-0.5">
                                                <img src="/eajicon.png" alt={businessName} className="max-h-full max-w-full object-contain" />
                                            </div>
                                        )}
                                        <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                                            <span className="truncate font-semibold text-foreground">{businessName}</span>
                                            <span className="truncate text-xs text-muted-foreground">
                                                {props.auth?.user?.branch?.name ?? "Terminal Active"}
                                            </span>
                                        </div>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarHeader>

                    {/* Content */}
                    <SidebarContent className="overflow-y-auto">
                        <SidebarGroup>
                            <SidebarGroupContent>
                                <SidebarMenu>

                                    {/* ── MAIN ──────────────────────────── */}
                                    {has(MENU.DASHBOARD) && (
                                        <NavItem
                                            href={routes.dashboard()}
                                            icon={LayoutDashboard}
                                            label="Dashboard"
                                            active={isActive(routes.dashboard())}
                                        />
                                    )}

                                    {/* ── SALES ─────────────────────────── */}
                                    {(has(MENU.POS) || has(MENU.SALES_HISTORY) || has(MENU.TABLE_ORDERS) || has(MENU.SHOP_ORDERS) || has(MENU.PROMOS) || has(MENU.INSTALLMENTS)) && (
                                        <>
                                            <SidebarSectionLabel label="Sales" />

                                            {has(MENU.POS) && (
                                                <NavItem href="/pos" icon={ShoppingCart} label="POS / Cashier" active={isActive("/pos")} />
                                            )}
                                            {has(MENU.SALES_HISTORY) && (
                                                <NavItem href="/sales/history" icon={History} label="Sales History" active={isActive("/sales/history")} />
                                            )}
                                            {/* {has(MENU.TABLE_ORDERS) && (
                                                <NavItem href="/table-orders" icon={TableProperties} label="Table Orders" active={isActive("/table-orders")} />
                                            )}
                                            {has(MENU.SHOP_ORDERS) && (
                                                <NavItem href="/shop/orders" icon={ShoppingBag} label="Shop Orders" active={isActive("/shop/orders")} />
                                            )} */}
                                            {has(MENU.PROMOS) && (
                                                <NavItem href="/promos" icon={Tag} label="Promos & Discounts" active={isActive("/promos")} />
                                            )}
                                            {has(MENU.INSTALLMENTS) && (
                                                <NavItem href="/installments" icon={CalendarClock} label="Installments" active={isActive("/installments")} />
                                            )}
                                        </>
                                    )}

                                    {/* ── INVENTORY ─────────────────────── */}
                                    {(has(MENU.PRODUCTS) || has(MENU.PURCHASE_ORDERS) || has(MENU.STOCK_ADJUSTMENTS) || has(MENU.INVENTORY) || has(MENU.STOCK_TRANSFERS) || has(MENU.WAREHOUSES) || has(MENU.STOCK_COUNT) || has(MENU.BROCHURE)) && (
                                        <>
                                            <SidebarSectionLabel label="Inventory" />
                                            {has(MENU.INVENTORY) && (
                                                <NavItem href="/inventory" icon={LayoutList} label="Inventory" active={isActive("/inventory")} />
                                            )}
                                            {has(MENU.STOCK_COUNT) && (
                                                <NavItem href="/stock-count" icon={ClipboardCheck} label="Stock Count" active={isActive("/stock-count")} />
                                            )}
                                            {has(MENU.BROCHURE) && (
                                                <NavItem href="/brochure" icon={BookImage} label="Brochure Builder" active={isActive("/brochure")} />
                                            )}
                                            {has(MENU.PRODUCTS) && (
                                                <NavItem
                                                    href="/products"
                                                    icon={Package}
                                                    label="All Products"
                                                    active={currentPath === "/products"}
                                                />
                                            )}
                                            {has(MENU.STOCK_TRANSFERS) && (
                                                <NavItem href="/stock-transfers" icon={ArrowLeftRight} label="Stock Transfers" active={isActive("/stock-transfers")} />
                                            )}
                                            {has(MENU.WAREHOUSES) && (
                                                <NavItem href="/warehouses" icon={Warehouse} label="Warehouses" active={isActive("/warehouses")} />
                                            )}
                                            {has(MENU.PURCHASE_ORDERS) && (
                                                <NavItem
                                                    href="/purchase-orders"
                                                    icon={PackageCheck}
                                                    label="Purchase Orders"
                                                    active={isActive("/purchase-orders")}
                                                />
                                            )}
                                            {has(MENU.STOCK_ADJUSTMENTS) && (
                                                <NavItem
                                                    href="/stock-adjustments"
                                                    icon={PackageX}
                                                    label="Losses / Damages"
                                                    active={isActive("/stock-adjustments")}
                                                />
                                            )}
                                        </>
                                    )}

                                    {/* ── CASH ──────────────────────────── */}
                                    {(has(MENU.CASH_SESSIONS) || has(MENU.CASH_COUNTS) || has(MENU.PETTY_CASH) || has(MENU.EXPENSES)) && (
                                        <>
                                            <SidebarSectionLabel label="Cash" />

                                            <NavGroup icon={Wallet} label="Cash Management" active={cashActive}>
                                                {has(MENU.CASH_SESSIONS) && (
                                                    <SubLink href="/cash-sessions" label="Cash Sessions" active={isActive("/cash-sessions")} />
                                                )}
                                                {has(MENU.CASH_COUNTS) && (
                                                    <SubLink href="/cash-counts" label="Cash Counts" active={isActive("/cash-counts")} />
                                                )}
                                                {has(MENU.PETTY_CASH) && (
                                                    <SubLink href="/petty-cash" label="Petty Cash" active={isActive("/petty-cash")} />
                                                )}
                                                {has(MENU.EXPENSES) && (
                                                    <SubLink href="/expenses" label="Expenses" active={isActive("/expenses")} />
                                                )}
                                            </NavGroup>
                                        </>
                                    )}

                                    {/* ── REPORTS ───────────────────────── */}
                                    {(has(MENU.DAILY_SUMMARY) || has(MENU.SALES_REPORT) || has(MENU.INVENTORY_REPORT) || has(MENU.EXPENSE_REPORT) || has(MENU.INGREDIENT_USAGE_REPORT) || has(MENU.ACTIVITY_LOGS)) && (
                                        <>
                                            <SidebarSectionLabel label="Reports" />

                                            <NavGroup icon={BarChart2} label="Reports" active={reportsActive}>
                                                {has(MENU.DAILY_SUMMARY) && (
                                                    <SubLink href="/reports/daily" label="Daily Summary" active={isActive("/reports/daily")} />
                                                )}
                                                {has(MENU.SALES_REPORT) && (
                                                    <SubLink href="/reports/sales" label="Sales Report" active={isActive("/reports/sales")} />
                                                )}
                                                {has(MENU.INVENTORY_REPORT) && (
                                                    <SubLink href="/reports/inventory" label="Inventory Report" active={isActive("/reports/inventory")} />
                                                )}
                                                {has(MENU.EXPENSE_REPORT) && (
                                                    <SubLink href="/reports/expenses" label="Expense Report" active={isActive("/reports/expenses")} />
                                                )}
                                                {has(MENU.INGREDIENT_USAGE_REPORT) && (
                                                    <SubLink href="/reports/ingredient-usage" label="Ingredient Usage" active={isActive("/reports/ingredient-usage")} />
                                                )}
                                                {has(MENU.STOCK_ADJUSTMENTS) && (
                                                    <SubLink href="/reports/stock-loss" label="Stock Loss Report" active={isActive("/reports/stock-loss")} />
                                                )}
                                            </NavGroup>

                                            {has(MENU.ACTIVITY_LOGS) && (
                                                <NavItem href="/logs" icon={ScrollText} label="Activity Logs" active={isActive("/logs")} />
                                            )}
                                        </>
                                    )}

                                    {/* ── MANAGEMENT ────────────────────── */}
                                    {(has(MENU.USERS) || has(MENU.SUPPLIERS) || has(MENU.BRANCHES) || has(MENU.DINING_TABLES) || has(MENU.EXPENSE_CATEGORIES) || has(MENU.SYSTEM_SETTINGS)) && (
                                        <>
                                            <SidebarSectionLabel label="Management" />

                                            {has(MENU.USERS) && (
                                                <NavItem href="/users" icon={Users} label="Users" active={isActive("/users")} />
                                            )}
                                            {has(MENU.SUPPLIERS) && (
                                                <NavItem href="/suppliers" icon={Truck} label="Suppliers" active={isActive("/suppliers")} />
                                            )}
                                            {has(MENU.BRANCHES) && (
                                                <NavItem href="/branches" icon={Building2} label="Branches" active={isActive("/branches")} />
                                            )}
                                            {has(MENU.DINING_TABLES) && (
                                                <NavItem href="/dining-tables" icon={Armchair} label="Dining Tables" active={isActive("/dining-tables")} />
                                            )}
                                            {has(MENU.EXPENSE_CATEGORIES) && (
                                                <NavItem href="/expense-categories" icon={FolderOpen} label="Expense Categories" active={isActive("/expense-categories")} />
                                            )}
                                            {has(MENU.SYSTEM_SETTINGS) && (
                                                <NavItem href="/settings" icon={Settings} label="System Settings" active={isActive("/settings")} />
                                            )}
                                        </>
                                    )}

                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    </SidebarContent>

                    {/* Footer / Profile */}
                    <SidebarFooter className="border-t border-border">
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <SidebarMenuButton
                                            size="lg"
                                            className="data-[state=open]:bg-accent data-[state=open]:text-accent-foreground w-full group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:justify-center"
                                        >
                                            <Avatar className="h-8.5 w-8.5 rounded-xl shrink-0">
                                                <AvatarFallback className="rounded-xl bg-[#35425F] text-white text-xs font-bold">
                                                    {props.auth?.user?.fname?.[0]?.toUpperCase() ?? "?"}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                                                <span className="truncate font-semibold">
                                                    {props.auth?.user?.fname ?? ""} {props.auth?.user?.lname ?? ""}
                                                </span>
                                                <span className="truncate text-xs text-muted-foreground">
                                                    {roleLabel()}
                                                </span>
                                            </div>
                                            <ChevronDown className="ml-auto h-4 w-4 opacity-50 group-data-[collapsible=icon]:hidden" />
                                        </SidebarMenuButton>
                                    </DropdownMenuTrigger>

                                    <DropdownMenuContent className="w-56 rounded-lg" align="start" side="right">
                                        <DropdownMenuLabel>My Account</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem asChild>
                                            <Link href="/account" className="flex items-center gap-2 cursor-pointer">
                                                <Users className="h-4 w-4" />
                                                Profile
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-destructive cursor-pointer"
                                            onSelect={() => router.post("/logout", {}, { preserveState: false })}
                                        >
                                            <LogOut className="mr-2 h-4 w-4" />
                                            Logout
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarFooter>

                    <SidebarRail />
                </Sidebar>

                {/* ── MAIN CONTENT ────────────────────────────────────── */}
                <div className="flex flex-1 flex-col min-w-0">
                    {/* Top bar */}
                    <header className="sticky top-0 z-40 h-16 bg-[#FFFFFF] dark:bg-[#1A202C] border-b border-[#E5E7EB] dark:border-[#2B364E] flex items-center justify-between px-6 shadow-xs">
                        <div className="flex items-center gap-3">
                            <SidebarTrigger className="text-[#6B7280] hover:text-[#202638] dark:hover:text-[#FFFFFF]" />
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-base font-bold text-[#202638] dark:text-[#F9FAFB] tracking-tight">{props.title ?? "Dashboard"}</h1>
                                {props.auth?.user?.branch?.name && (
                                    <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#35425F]/10 dark:bg-[#35425F]/30 text-[#35425F] dark:text-[#FDE7F0] border border-[#35425F]/20">
                                        <Building2 className="h-3 w-3" />
                                        <span>{props.auth.user.branch.name}</span>
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Fast POS Launch Shortcut */}
                            <Link href="/pos">
                                <Button
                                    size="sm"
                                    className="hidden sm:inline-flex items-center gap-2 h-9 px-3.5 rounded-xl font-bold text-xs bg-[#35425F] hover:bg-[#283248] text-white shadow-xs transition-all active:scale-95"
                                >
                                    <ShoppingCart className="h-3.5 w-3.5" />
                                    <span>Open POS</span>
                                </Button>
                            </Link>

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={toggleTheme}
                                aria-label="Toggle theme"
                                className="h-9 w-9 rounded-xl text-[#6B7280] hover:text-[#202638] dark:hover:text-[#FFFFFF] hover:bg-[#F3F4F6] dark:hover:bg-[#202638]"
                            >
                                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-amber-400" />
                                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-[#35425F]" />
                            </Button>

                            <div className="flex items-center gap-2.5 pl-2 border-l border-[#E5E7EB] dark:border-[#2B364E]">
                                <Avatar className="h-8.5 w-8.5 rounded-xl border border-[#E5E7EB] dark:border-[#2B364E]">
                                    <AvatarFallback className="text-xs font-bold bg-[#35425F] text-white">
                                        {props.auth?.user?.fname?.[0]?.toUpperCase() ?? "?"}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="hidden md:flex flex-col text-left">
                                    <span className="text-xs font-bold text-[#202638] dark:text-[#F9FAFB] leading-none">
                                        {props.auth?.user?.fname ?? ""} {props.auth?.user?.lname ?? ""}
                                    </span>
                                    <span className="text-[10px] font-medium text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
                                        {roleLabel()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </header>

                    {/* Page content */}
                    <main className="flex-1 overflow-y-auto p-6 bg-[#FCFCFD] dark:bg-[#121620]">
                        {children}
                    </main>
                </div>
            </div>

            {/* Floating AI Assistant — hidden on /pos and for admin/super_admin */}
            <FloatingChat />
        </SidebarProvider>
    );
}
