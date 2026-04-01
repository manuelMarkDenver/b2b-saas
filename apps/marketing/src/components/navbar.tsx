'use client';

import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { marketingConfig } from '@/config/marketing.config';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { brand, nav, urls } = marketingConfig;
  const calendly = urls.calendly || '#demo';

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled ? 'bg-white/95 backdrop-blur shadow-sm border-b border-slate-100' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto max-w-6xl px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <a href="/" className="flex items-center gap-3">
          <svg className="h-9 w-9 shrink-0 text-indigo-600" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="15" width="6" height="8" rx="1.5" fill="currentColor" opacity="0.35"/>
            <rect x="9" y="9" width="6" height="14" rx="1.5" fill="currentColor" opacity="0.65"/>
            <rect x="17" y="2" width="6" height="21" rx="1.5" fill="currentColor"/>
          </svg>
          <div className="leading-tight">
            <p className="font-bold text-xl text-slate-900 leading-none">{brand.logoText}</p>
            <p className="text-[10px] text-slate-400 leading-none">by {brand.parentCompany}</p>
          </div>
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {nav.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              {link.label}
            </a>
          ))}
          <a
            href={urls.app}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            Sign in
          </a>
          <a
            href={calendly}
            target={urls.calendly ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm"
          >
            {nav.ctaLabel}
          </a>
        </nav>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-2 text-slate-600 hover:text-slate-900"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-b border-slate-100 px-6 pb-4 space-y-3">
          {nav.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block text-base font-medium text-slate-700 hover:text-slate-900 py-1"
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <a
            href={urls.app}
            className="block text-base font-medium text-slate-700 py-1"
            onClick={() => setOpen(false)}
          >
            Sign in
          </a>
          <a
            href={calendly}
            target={urls.calendly ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="block w-full text-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
            onClick={() => setOpen(false)}
          >
            {nav.ctaLabel}
          </a>
        </div>
      )}
    </header>
  );
}
