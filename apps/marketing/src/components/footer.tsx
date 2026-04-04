import { marketingConfig } from '@/config/marketing.config';
import Link from 'next/link';

export function Footer() {
  const { brand, footer, urls, nav } = marketingConfig;
  const calendly = urls.calendly || '#demo';

  const links = footer.links.map((l) =>
    l.href === '' ? { ...l, href: calendly } : l,
  );

  return (
    <footer className="bg-slate-900 border-t border-slate-800">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-3">
              <svg className="h-9 w-9 shrink-0 text-indigo-400" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="15" width="6" height="8" rx="1.5" fill="currentColor" opacity="0.35"/>
                <rect x="9" y="9" width="6" height="14" rx="1.5" fill="currentColor" opacity="0.65"/>
                <rect x="17" y="2" width="6" height="21" rx="1.5" fill="currentColor"/>
              </svg>
              <div className="leading-tight">
                <p className="font-bold text-xl text-white leading-none">{brand.logoText}</p>
                <p className="text-[10px] text-slate-500 leading-none">by {brand.parentCompany}</p>
              </div>
            </Link>
            <p className="text-sm text-slate-400 max-w-xs leading-relaxed">{footer.tagline}</p>
            <p className="mt-4 text-xs text-slate-500">{footer.madeIn}</p>
          </div>

          {/* Nav links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
              Product
            </h4>
            <ul className="space-y-2.5">
              {nav.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">
              Get started
            </h4>
            <ul className="space-y-2.5">
              {links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target={link.href.startsWith('http') ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href={urls.app}
                  className="text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Sign in
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-slate-500">{footer.copyright}</p>
          <div className="flex gap-6">
            {Object.entries(urls.social).map(([platform, href]) =>
              href ? (
                <a
                  key={platform}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-500 hover:text-slate-300 capitalize transition-colors"
                >
                  {platform}
                </a>
              ) : null,
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
