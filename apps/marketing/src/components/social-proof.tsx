import { marketingConfig } from '@/config/marketing.config';

export function SocialProof() {
  const { socialProof } = marketingConfig;

  return (
    <section className="border-y border-slate-100 bg-white py-10">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center text-sm font-semibold uppercase tracking-widest text-slate-400">
          {socialProof.label}
        </p>

        {socialProof.logos.length > 0 ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-8">
            {socialProof.logos.map((logo) => (
              <img
                key={logo.name}
                src={logo.logoSrc}
                alt={logo.name}
                className="h-8 opacity-50 grayscale hover:opacity-80 hover:grayscale-0 transition-all"
              />
            ))}
          </div>
        ) : (
          /* Placeholder blocks until real logos are added */
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6">
            {['Partner A', 'Partner B', 'Partner C', 'Partner D'].map((name) => (
              <div
                key={name}
                className="h-8 w-28 rounded-md bg-slate-100 animate-pulse"
                aria-hidden="true"
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
