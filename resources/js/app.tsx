"use client";

import React from 'react';
import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import '../css/app.css';

// ── Theme support ───────────────────────────────────────────────────────────────
import { ThemeProvider } from 'next-themes';

// ── Sonner toast (global toaster) ──────────────────────────────────────────────
import { Toaster } from "@/components/ui/sonner";

// ── Optional: StrictMode only in development ───────────────────────────────────
const StrictModeWrapper = import.meta.env.DEV
  ? React.StrictMode
  : React.Fragment;

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="psis-theme"
    >
      {children}
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        duration={4500}
        toastOptions={{
          className: 'border shadow-lg',
          style: { borderRadius: '8px' },
        }}
      />
    </ThemeProvider>
  );
}

const appName = import.meta.env.VITE_APP_NAME || 'EAJ Pharmacy Management System';

createInertiaApp({
  title: (title) => title || appName,

  resolve: (name) =>
    resolvePageComponent(
      `./pages/${name}.tsx`,
      import.meta.glob('./pages/**/*.tsx')
    ),

  setup({ el, App, props }) {
    // Sync data-theme on every Inertia navigation (after blade sets it on first load)
    router.on('navigate', (event) => {
      const theme = (event.detail.page.props as any)?.app?.color_theme ?? 'ea';
      document.documentElement.dataset.theme = theme;
    });

    createRoot(el).render(
      <StrictModeWrapper>
        <Providers>
          <App {...props} />
        </Providers>
      </StrictModeWrapper>
    );
  },

  progress: {
    color: '#4B5563',
    delay: 250,
  },
});
