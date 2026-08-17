<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class LoginAuthController extends Controller
{
    private const MAX_ATTEMPTS   = 5;
    private const DECAY_SECONDS  = 300;

    public function getLogin(): Response
    {
        $logo = SystemSetting::whereNull('branch_id')
            ->where('key', 'general.logo')
            ->first(['value', 'updated_at']);
        $logoPath = (string) ($logo?->value ?? '');
        $logoVersion = $logo?->updated_at?->timestamp;

        $businessName = SystemSetting::get('general.business_name', null, config('app.name', 'Point of Sale'));
        $tagline = SystemSetting::get('general.tagline', null, 'Point of Sale & Retail Management Suite');

        return Inertia::render('Login', [
            'logo_url'      => $logoPath ? route('brand.logo', $logoVersion ? ['v' => $logoVersion] : []) : null,
            'business_name' => $businessName,
            'tagline'       => $tagline,
        ]);
    }

    public function postLogin(Request $request): RedirectResponse
    {
        $request->validate([
            'username' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $throttleKey = $this->throttleKey($request);

        if (RateLimiter::tooManyAttempts($throttleKey, self::MAX_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($throttleKey);
            return back()->withErrors([
                'username' => "Too many login attempts. Please try again in {$seconds} seconds.",
            ]);
        }

        if (! Auth::attempt(
            ['username' => $request->username, 'password' => $request->password],
            $request->boolean('remember')
        )) {
            RateLimiter::hit($throttleKey, self::DECAY_SECONDS);

            ActivityLog::create([
                'user_id'    => null,
                'action'     => 'login_failed',
                'properties' => [
                    'username'   => $request->username,
                    'ip'         => $request->ip(),
                    'user_agent' => $request->userAgent(),
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'method'     => $request->method(),
                'url'        => $request->fullUrl(),
            ]);

            return back()->withErrors([
                'username' => 'Invalid username or password.',
            ])->onlyInput('username');
        }

        RateLimiter::clear($throttleKey);
        $request->session()->regenerate();

        $user = Auth::user();

        ActivityLog::create([
            'user_id'      => $user->id,
            'action'       => 'login',
            'subject_type' => get_class($user),
            'subject_id'   => $user->id,
            'properties'   => [
                'username'   => $user->username,
                'role'       => $user->role,
                'branch_id'  => $user->branch_id,
                'ip'         => $request->ip(),
                'user_agent' => $request->userAgent(),
            ],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'method'     => $request->method(),
            'url'        => $request->fullUrl(),
        ]);

        return redirect()->to($this->defaultRouteFor($user));
    }

    public function postLogout(Request $request): RedirectResponse
    {
        $user = Auth::user();

        if ($user) {
            ActivityLog::create([
                'user_id'      => $user->id,
                'action'       => 'logout',
                'subject_type' => get_class($user),
                'subject_id'   => $user->id,
                'properties'   => [
                    'username'   => $user->username,
                    'ip'         => $request->ip(),
                    'user_agent' => $request->userAgent(),
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'method'     => $request->method(),
                'url'        => $request->fullUrl(),
            ]);
        }

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }

    private function throttleKey(Request $request): string
    {
        return Str::lower($request->input('username')) . '|' . $request->ip();
    }

    private function defaultRouteFor(\App\Models\User $user): string
    {
        if ($user->isSuperAdmin() || $user->isAdministrator()) {
            return route('dashboard');
        }

        // Cashiers always land on POS — never on dashboard
        if ($user->isCashier()) {
            return route('pos.index');
        }

        $access = array_map('strval', $user->access ?? []);

        if (in_array('1', $access)) {
            return route('dashboard');
        }

        $routeMap = [
            '2'  => 'pos.index',
            '5'  => 'shop.orders',
            '6'  => 'products.index',
            '14' => 'cash-sessions.index',
            '18' => 'reports.daily',
            '22' => 'logs.index',
            '23' => 'users.index',
        ];

        foreach ($routeMap as $menuId => $routeName) {
            if (in_array($menuId, $access)) {
                try { return route($routeName); } catch (\Exception) { continue; }
            }
        }

        return route('dashboard');
    }
}
