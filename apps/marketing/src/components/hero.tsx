import { ArrowRight, CheckCircle } from 'lucide-react';
import { marketingConfig } from '@/config/marketing.config';
import { ImagePlaceholder } from './image-placeholder';

const proof = [
  'No credit card required',
  'Set up in minutes',
  'Filipino-built, globally ready',
];

export function Hero() {
  const { brand, hero, urls } = marketingConfig;
  const calendly = urls.calendly || '#demo';

  const headlineParts = brand.headline.split('\n');

  return (
    <section className="relative overflow-hidden pt-28 pb-20 md:pt-36 md:pb-28">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-indigo-100/60 blur-3xl" />
        <div className="absolute -bottom-20 -left-40 h-[400px] w-[400px] rounded-full bg-emerald-100/40 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-6">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Copy */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-slow" />
              Made for Filipino businesses
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.1]">
              {headlineParts.map((part, i) => (
                <span key={i}>
                  {i === 1 ? <span className="gradient-text">{part}</span> : part}
                  {i < headlineParts.length - 1 && <br />}
                </span>
              ))}
            </h1>

            <p className="mt-6 text-lg md:text-xl text-slate-600 leading-relaxed max-w-lg">
              {brand.subheadline}
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href={calendly}
                target={urls.calendly ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3.5 text-base font-semibold text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
              >
                {hero.ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            <p className="mt-3 text-sm text-slate-500">{hero.ctaSubtext}</p>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
              {proof.map((item) => (
                <li key={item} className="flex items-center gap-1.5 text-sm text-slate-600">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Hero image */}
          <div className="relative">
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-indigo-100 ring-1 ring-slate-200">
              {hero.image.src ? (
                <img
                  src={hero.image.src}
                  alt={hero.image.alt}
                  width={hero.image.width}
                  height={hero.image.height}
                  className="w-full h-auto"
                />
              ) : (
                <ImagePlaceholder
                  width={hero.image.width}
                  height={hero.image.height}
                  label="Hero image"
                  hint="Run /generate-image to fill this"
                />
              )}
            </div>
            {/* Floating stat badge */}
            <div className="absolute -bottom-4 -left-4 rounded-xl bg-white shadow-lg border border-slate-100 px-4 py-3">
              <p className="text-xs text-slate-500 font-medium">Stock tracked</p>
              <p className="text-2xl font-extrabold text-slate-900">100%</p>
              <p className="text-xs text-emerald-600 font-medium">↑ real-time</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
