"use client";

import React, { useState, useEffect, FormEvent } from "react";
import { Head, useForm, usePage } from "@inertiajs/react";
import { cn } from "@/lib/utils";
import { routes } from "@/routes";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Eye,
    EyeOff,
    Sun,
    Moon,
    AlertCircle,
    ArrowRight,
    Sparkles,
    ShoppingBag,
    Boxes,
    Receipt,
    UserCheck,
    Lock,
    User,
    Clock,
} from "lucide-react";

interface LoginProps {
    errors?: Record<string, string>;
    logo_url?: string | null;
    business_name?: string | null;
    tagline?: string | null;
}

interface LoginFormData {
    username: string;
    password: string;
    remember: boolean;
}

const PRESET_ROLES = [
    { label: "Super Admin", roleTitle: "GLOBAL ACCESS", username: "superadmin", password: "superadmin123" },
    { label: "Admin", roleTitle: "STORE MANAGER", username: "admin.coop.main", password: "admin123" },
    { label: "Manager", roleTitle: "SHIFT SUPERVISOR", username: "ana.manager", password: "manager123" },
    { label: "Cashier", roleTitle: "COUNTER POS", username: "carlo.cashier", password: "cashier123" },
];

export default function Login({
    errors: serverErrors,
    logo_url: propLogoUrl,
    business_name: propBusinessName,
}: LoginProps) {
    const { props } = usePage<{ app?: { logo_url?: string | null; business_name?: string | null; name?: string | null } }>();

    // Dynamic White-Label Brand Settings
    const logoUrl = propLogoUrl ?? props.app?.logo_url ?? null;
    const businessName = propBusinessName ?? props.app?.business_name ?? props.app?.name ?? "Point of Sale";

    const [showPassword, setShowPassword] = useState(false);
    const [currentTime, setCurrentTime] = useState<string>("");
    const [selectedRole, setSelectedRole] = useState<string | null>(null);
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    const { data, setData, post, processing, reset, errors } = useForm<LoginFormData>({
        username: "",
        password: "",
        remember: true,
    });

    useEffect(() => {
        setMounted(true);
        const updateTime = () => {
            const now = new Date();
            setCurrentTime(
                now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
            );
        };
        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => {
            clearInterval(interval);
            reset("password");
        };
    }, [reset]);

    const submit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        post(routes.loginPost());
    };

    const handleSelectPreset = (preset: typeof PRESET_ROLES[0]) => {
        setSelectedRole(preset.label);
        setData({
            username: preset.username,
            password: preset.password,
            remember: true,
        });
    };

    const displayErrors =
        serverErrors?.username ||
        serverErrors?.password ||
        errors?.username ||
        errors?.password;

    return (
        <>
            <Head title={`Sign In — ${businessName}`} />

            <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#FCFCFD] dark:bg-[#121620] text-[#202638] dark:text-[#F9FAFB] font-sans selection:bg-[#FDE7F0] selection:text-[#F50069]">
                
                {/* ══════════════════════════════════════════════════════════════════════
                    LEFT PANEL (50% Desktop — Split Screen Showcase)
                    Palette: #35425F (Primary), #4D5D81 (Secondary), #F50069 (Accent), #FDE7F0 (Accent Light)
                   ══════════════════════════════════════════════════════════════════════ */}
                <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-10 xl:p-14 bg-[#35425F] text-[#FFFFFF] relative overflow-hidden border-r border-[#4D5D81]/40">
                    
                    {/* Dotted Texture Layer (Tactile Modern Grid) */}
                    <div
                        className="absolute inset-0 pointer-events-none opacity-25"
                        style={{
                            backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.45) 1.2px, transparent 1.2px)",
                            backgroundSize: "22px 22px",
                        }}
                    />

                    {/* Background Constellation Lines & Ambient Glow (from imgview/image.png) */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#F50069]/15 rounded-full blur-3xl" />
                        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#4D5D81]/30 rounded-full blur-3xl" />
                        
                        <svg className="absolute inset-0 w-full h-full stroke-white/10" xmlns="http://www.w3.org/2000/svg" fill="none">
                            <line x1="10%" y1="15%" x2="28%" y2="30%" strokeDasharray="3 3" />
                            <line x1="28%" y1="30%" x2="18%" y2="60%" strokeDasharray="3 3" />
                            <line x1="18%" y1="60%" x2="45%" y2="75%" strokeDasharray="3 3" />
                            <line x1="28%" y1="30%" x2="52%" y2="22%" strokeDasharray="3 3" />
                            <line x1="52%" y1="22%" x2="75%" y2="40%" strokeDasharray="3 3" />
                            
                            <circle cx="10%" cy="15%" r="3.5" fill="#F50069" fillOpacity="0.7" />
                            <circle cx="28%" cy="30%" r="4.5" fill="#FDE7F0" fillOpacity="0.9" />
                            <circle cx="18%" cy="60%" r="3.5" fill="#F50069" fillOpacity="0.6" />
                            <circle cx="45%" cy="75%" r="4.5" fill="#FDE7F0" fillOpacity="0.8" />
                            <circle cx="52%" cy="22%" r="3.5" fill="#F50069" fillOpacity="0.7" />
                            <circle cx="75%" cy="40%" r="4" fill="#FDE7F0" fillOpacity="0.7" />
                        </svg>
                    </div>

                    {/* Top Brand Mark */}
                    <div className="relative z-10 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-white p-1.5 flex items-center justify-center shadow-md">
                            <img
                                src={logoUrl || "/eajicon.png"}
                                alt={businessName}
                                className="h-full w-full object-contain"
                            />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-base tracking-tight text-[#FFFFFF] leading-tight">
                                {businessName}
                            </span>
                            <span className="text-xs text-[#D0D7E4]">
                                Point of Sale System
                            </span>
                        </div>
                    </div>

                    {/* Middle Hero Showcase (Exact Reference Formula: Two-Tone Typography + Accent Highlight) */}
                    <div className="relative z-10 my-auto max-w-lg space-y-7 py-8">
                        
                        {/* Top Pill Tag */}
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FDE7F0] border border-[#F50069]/30 text-[#F50069] text-xs font-bold tracking-wide shadow-xs">
                            <Sparkles className="h-3.5 w-3.5 text-[#F50069]" />
                            <span>Fast Point of Sale. Reliable Operations.</span>
                        </div>

                        {/* Bold Display Headline from reference image */}
                        <div className="space-y-1">
                            <h1 className="text-4xl xl:text-5xl font-black tracking-tight text-[#FFFFFF] leading-[1.12]">
                                All Store Sales.
                            </h1>
                            <h1 className="text-4xl xl:text-5xl font-black tracking-tight text-[#FFFFFF] leading-[1.12]">
                                All Inventory.
                            </h1>
                            <h1 className="text-4xl xl:text-5xl font-black tracking-tight text-[#F50069] leading-[1.12]">
                                Made Simple.
                            </h1>
                        </div>

                        {/* Subtitle */}
                        <p className="text-sm xl:text-base text-[#D0D7E4] leading-relaxed font-normal">
                            Everyday point of sale built for your team — fast counter checkout, live stock tracking, and daily cash summaries with zero hassle.
                        </p>

                        {/* 3 Bottom Feature Cards (Styled like the bottom cards in imgview/image.png) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                            
                            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white text-[#202638] shadow-md border border-white/40">
                                <div className="h-9 w-9 rounded-xl bg-[#FDE7F0] text-[#F50069] flex items-center justify-center shrink-0">
                                    <ShoppingBag className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[9px] uppercase font-bold tracking-wider text-[#6B7280]">Fast POS</div>
                                    <div className="text-xs font-bold truncate text-[#202638]">Quick Checkout</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white text-[#202638] shadow-md border border-white/40">
                                <div className="h-9 w-9 rounded-xl bg-[#35425F]/10 text-[#35425F] flex items-center justify-center shrink-0">
                                    <Boxes className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[9px] uppercase font-bold tracking-wider text-[#6B7280]">Live Count</div>
                                    <div className="text-xs font-bold truncate text-[#202638]">Stock Tracking</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white text-[#202638] shadow-md border border-white/40">
                                <div className="h-9 w-9 rounded-xl bg-[#FDE7F0] text-[#F50069] flex items-center justify-center shrink-0">
                                    <Receipt className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[9px] uppercase font-bold tracking-wider text-[#6B7280]">End of Day</div>
                                    <div className="text-xs font-bold truncate text-[#202638]">Cash Shifts</div>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* Bottom Status & Live Clock */}
                    <div className="relative z-10 flex items-center justify-between text-xs text-[#D0D7E4] border-t border-white/15 pt-4">
                        <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-[#FDE7F0]" />
                            <span className="font-mono text-[#FDE7F0] font-medium">{currentTime}</span>
                        </div>
                        <span className="font-medium text-[#D0D7E4]">Ready for sales</span>
                    </div>
                </div>

                {/* ══════════════════════════════════════════════════════════════════════
                    RIGHT PANEL (50% Desktop — Sign-In Form)
                    Palette: #FCFCFD (Background), #FFFFFF (Surface), #202638 (Text), #6B7280 (Muted)
                   ══════════════════════════════════════════════════════════════════════ */}
                <div className="w-full lg:w-1/2 flex flex-col justify-between p-6 sm:p-10 xl:p-14 relative overflow-hidden">
                    
                    {/* Dotted Texture Accent: Upper Right Corner */}
                    <div
                        className="absolute top-0 right-0 w-80 h-80 pointer-events-none opacity-55 dark:opacity-25"
                        style={{
                            backgroundImage: "radial-gradient(#4D5D81 1.1px, transparent 1.1px)",
                            backgroundSize: "20px 20px",
                            maskImage: "radial-gradient(circle at top right, black 35%, transparent 80%)",
                            WebkitMaskImage: "radial-gradient(circle at top right, black 35%, transparent 80%)",
                        }}
                    />

                    {/* Dotted Texture Accent: Lower Left Corner */}
                    <div
                        className="absolute bottom-0 left-0 w-80 h-80 pointer-events-none opacity-55 dark:opacity-25"
                        style={{
                            backgroundImage: "radial-gradient(#4D5D81 1.1px, transparent 1.1px)",
                            backgroundSize: "20px 20px",
                            maskImage: "radial-gradient(circle at bottom left, black 35%, transparent 80%)",
                            WebkitMaskImage: "radial-gradient(circle at bottom left, black 35%, transparent 80%)",
                        }}
                    />

                    {/* Header: Mobile Brand & Theme Toggle */}
                    <header className="relative z-10 flex items-center justify-between w-full pb-4">
                        {/* Mobile Brand Header */}
                        <div className="lg:hidden flex items-center gap-2.5">
                            <div className="h-9 w-9 rounded-xl bg-white dark:bg-[#202638] p-1.5 flex items-center justify-center shadow-xs border border-[#E5E7EB] dark:border-[#2B364E]">
                                <img src={logoUrl || "/eajicon.png"} alt={businessName} className="h-full w-full object-contain" />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-sm text-[#202638] dark:text-[#F9FAFB] leading-tight">{businessName}</span>
                                <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">Point of Sale</span>
                            </div>
                        </div>

                        {/* Theme Toggle */}
                        {mounted && (
                            <button
                                type="button"
                                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                                className="ml-auto h-9 w-9 rounded-xl bg-white dark:bg-[#202638] border border-[#E5E7EB] dark:border-[#2B364E] text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#202638] dark:hover:text-[#F9FAFB] flex items-center justify-center shadow-xs transition-all"
                                aria-label="Toggle theme"
                            >
                                {theme === "dark" ? (
                                    <Sun className="h-4 w-4 text-amber-400" />
                                ) : (
                                    <Moon className="h-4 w-4 text-[#35425F]" />
                                )}
                            </button>
                        )}
                    </header>

                    {/* Main Sign-In Center */}
                    <div className="my-auto w-full max-w-[400px] mx-auto py-6">
                        
                        {/* Title & Subtitle */}
                        <div className="mb-7">
                            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#202638] dark:text-[#F9FAFB]">
                                Sign In
                            </h2>
                            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-1.5 leading-relaxed">
                                Enter your username and password to start your shift.
                            </p>
                        </div>

                        {/* Error Alert Banner */}
                        {displayErrors && (
                            <div className="mb-6 p-3.5 rounded-2xl bg-[#FDE7F0] dark:bg-[#3D1426] border border-[#F50069]/30 text-[#F50069] flex items-start gap-2.5 text-xs font-semibold">
                                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                <span>
                                    {serverErrors?.username ||
                                        serverErrors?.password ||
                                        errors?.username ||
                                        errors?.password ||
                                        "Incorrect username or password. Please try again."}
                                </span>
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={submit} className="space-y-4">
                            
                            {/* Username Input */}
                            <div className="space-y-1.5">
                                <Label
                                    htmlFor="username"
                                    className="text-xs font-bold uppercase tracking-wider text-[#202638]/80 dark:text-[#F9FAFB]/80"
                                >
                                    Username
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="username"
                                        type="text"
                                        autoComplete="username"
                                        placeholder="Enter your username"
                                        value={data.username}
                                        onChange={(e) => {
                                            setSelectedRole(null);
                                            setData("username", e.target.value);
                                        }}
                                        className={cn(
                                            "h-11 pl-10 rounded-xl bg-white dark:bg-[#202638] border-[#E5E7EB] dark:border-[#2B364E] text-sm text-[#202638] dark:text-[#F9FAFB] focus-visible:ring-2 focus-visible:ring-[#35425F] dark:focus-visible:ring-[#F50069] focus-visible:border-transparent transition-all placeholder:text-[#6B7280]/60",
                                            (serverErrors?.username || errors?.username) &&
                                                "border-[#F50069] focus-visible:ring-[#F50069]"
                                        )}
                                        autoFocus
                                        disabled={processing}
                                        required
                                    />
                                    <User className="h-4 w-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                                </div>
                            </div>

                            {/* Password Input */}
                            <div className="space-y-1.5">
                                <Label
                                    htmlFor="password"
                                    className="text-xs font-bold uppercase tracking-wider text-[#202638]/80 dark:text-[#F9FAFB]/80"
                                >
                                    Password
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="current-password"
                                        placeholder="••••••••"
                                        value={data.password}
                                        onChange={(e) => {
                                            setSelectedRole(null);
                                            setData("password", e.target.value);
                                        }}
                                        className={cn(
                                            "h-11 pl-10 pr-10 rounded-xl bg-white dark:bg-[#202638] border-[#E5E7EB] dark:border-[#2B364E] text-sm text-[#202638] dark:text-[#F9FAFB] focus-visible:ring-2 focus-visible:ring-[#35425F] dark:focus-visible:ring-[#F50069] focus-visible:border-transparent transition-all placeholder:text-[#6B7280]/60",
                                            (serverErrors?.password || errors?.password) &&
                                                "border-[#F50069] focus-visible:ring-[#F50069]"
                                        )}
                                        disabled={processing}
                                        required
                                    />
                                    <Lock className="h-4 w-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#202638] dark:hover:text-[#F9FAFB] focus:outline-none p-0.5 transition-colors"
                                        tabIndex={-1}
                                        aria-label={showPassword ? "Hide password" : "Show password"}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Remember Me Checkbox */}
                            <div className="pt-1">
                                <label className="flex items-center gap-2.5 text-xs text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#202638] dark:hover:text-[#F9FAFB] cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={data.remember}
                                        onChange={(e) => setData("remember", e.target.checked)}
                                        className="rounded-md border-[#E5E7EB] dark:border-[#2B364E] text-[#35425F] focus:ring-2 focus:ring-[#35425F] h-4 w-4 accent-[#35425F]"
                                    />
                                    <span className="font-medium">Keep me signed in on this counter</span>
                                </label>
                            </div>

                            {/* Submit Button (Pill Gradient in Reference Style) */}
                            <Button
                                type="submit"
                                disabled={processing}
                                className="w-full h-12 rounded-full font-bold text-sm bg-gradient-to-r from-[#35425F] to-[#4D5D81] hover:from-[#283248] hover:to-[#35425F] text-[#FFFFFF] shadow-md shadow-[#35425F]/20 hover:shadow-lg transition-all flex items-center justify-center gap-2 mt-4 active:scale-[0.98]"
                            >
                                {processing ? (
                                    <>
                                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        <span>Signing in...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Sign In to POS</span>
                                        <ArrowRight className="h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </form>

                        {/* Quick Accounts Preset Section */}
                        <div className="mt-8 pt-6 border-t border-[#E5E7EB] dark:border-[#2B364E]">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#9CA3AF]">
                                    Quick Accounts
                                </span>
                                <span className="text-[11px] text-[#6B7280]/70 dark:text-[#9CA3AF]/70 font-normal">
                                    Demo accounts
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                {PRESET_ROLES.map((preset) => {
                                    const active = selectedRole === preset.label;
                                    return (
                                        <button
                                            key={preset.label}
                                            type="button"
                                            onClick={() => handleSelectPreset(preset)}
                                            className={cn(
                                                "flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all",
                                                active
                                                    ? "bg-[#35425F] border-[#35425F] text-white shadow-xs"
                                                    : "bg-white dark:bg-[#202638] border-[#E5E7EB] dark:border-[#2B364E] text-[#202638] dark:text-[#F9FAFB] hover:border-[#35425F]/50 dark:hover:border-white/30"
                                            )}
                                        >
                                            <div className={cn(
                                                "h-6 w-6 rounded-lg flex items-center justify-center text-xs shrink-0 font-bold",
                                                active ? "bg-white/20 text-white" : "bg-[#FDE7F0] dark:bg-[#3D1426] text-[#F50069]"
                                            )}>
                                                <UserCheck className="h-3.5 w-3.5" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className={cn("text-[9px] uppercase font-bold tracking-wider truncate", active ? "text-white/80" : "text-[#6B7280] dark:text-[#9CA3AF]")}>
                                                    {preset.roleTitle}
                                                </div>
                                                <div className="text-xs font-bold truncate">
                                                    {preset.label}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <footer className="w-full pt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#6B7280] dark:text-[#9CA3AF] border-t border-[#E5E7EB] dark:border-[#2B364E]">
                        <div>
                            © {new Date().getFullYear()} {businessName}. All rights reserved.
                        </div>
                        <div className="text-[11px]">
                            Point of Sale System
                        </div>
                    </footer>
                </div>

            </div>
        </>
    );
}