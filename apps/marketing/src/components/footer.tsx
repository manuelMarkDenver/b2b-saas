import { marketingConfig } from '@/config/marketing.config';

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
            <a href="/" className="flex items-center gap-2 font-bold text-xl text-white mb-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-black text-sm">
                Op
              </span>
              {brand.logoText}
            </a>
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
