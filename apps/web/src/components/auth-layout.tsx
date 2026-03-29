'use client';

import * as React from 'react';

const QUOTES = [
  {
    text: 'The best businesses run on systems that scale without the chaos.',
    author: 'Built for operators, not just owners.',
  },
  {
    text: "Inventory that's accurate, orders that close, payments that clear \u2014 all in one place.",
    author: 'Your operations, finally under control.',
  },
  {
    text: 'From the warehouse floor to the back office, every movement tracked and every peso accounted.',
    author: 'Built for Philippine businesses.',
  },
];

export function AuthLayout({
  children,
  quoteIndex = 0,
}: {
  children: React.ReactNode;
  quoteIndex?: number;
}) {
  const quote = QUOTES[quoteIndex % QUOTES.length];

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      {/* ── Left: form pane ── */}
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-[45%] lg:px-16">
        {/* Logo */}
        <div className="mb-10 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-primary-foreground">
              <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z" />
            </svg>
          </div>
          <span className="text-sm font-semibold tracking-tight">B2B Platform</span>
        </div>

        {/* Form content */}
        <div className="w-full max-w-sm">{children}</div>
      </div>

      {/* ── Right: hero pane (hidden on mobile) ── */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-[55%]">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-primary" />

        {/* Geometric grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Floating blobs */}
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground">
          {/* Top badge */}
          <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium backdrop-blur-sm w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            All systems operational
          </div>

          {/* Center quote */}
          <div className="space-y-6">
            <div className="text-3xl font-bold leading-tight tracking-tight lg:text-4xl">
              {quote.text}
            </div>
            <div className="flex items-center gap-3">
              <div className="h-px w-8 bg-white/40" />
              <span className="text-sm text-white/70">{quote.author}</span>
            </div>
          </div>

          {/* Bottom stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: '3 modules', label: 'Inventory, Orders, Payments' },
              { value: '100% yours', label: 'Multi-tenant, your data only' },
              { value: 'MVP ready', label: 'Phase 1–8 complete' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                <div className="text-lg font-bold">{stat.value}</div>
                <div className="mt-0.5 text-xs text-white/60">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
