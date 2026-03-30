import { ArrowRight } from 'lucide-react';
import { marketingConfig } from '@/config/marketing.config';

export function CtaSection() {
  const { finalCta, urls } = marketingConfig;
  const calendly = urls.calendly || '#demo';

  return (
    <section className="py-20 md:py-28 bg-indigo-600 relative overflow-hidden">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/5" />
        <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-white/5" />
      </div>

      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
          {finalCta.title}
        </h2>
        <p className="mt-4 text-lg text-indigo-200 leading-relaxed">
          {finalCta.subtitle}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href={calendly}
            target={urls.calendly ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors shadow-lg"
          >
            {finalCta.ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href={finalCta.secondaryHref}
            className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-7 py-3.5 text-base font-semibold text-white hover:bg-white/10 transition-colors"
          >
            {finalCta.secondaryLabel}
          </a>
        </div>
      </div>
    </section>
  );
}
