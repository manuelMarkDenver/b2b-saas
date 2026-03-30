import { Quote } from 'lucide-react';
import { marketingConfig } from '@/config/marketing.config';

export function Testimonials() {
  const { testimonial } = marketingConfig;

  // Don't render placeholder if explicitly disabled
  if (!testimonial.isPlaceholder && !testimonial.quote) return null;

  return (
    <section className="py-20 md:py-28 bg-white">
      <div className="mx-auto max-w-4xl px-6">
        <div className="relative rounded-3xl bg-gradient-to-br from-indigo-50 to-slate-50 border border-indigo-100 p-10 md:p-14 text-center">
          <Quote className="h-10 w-10 text-indigo-200 mx-auto mb-6" />

          <blockquote className="text-xl md:text-2xl font-medium text-slate-800 leading-relaxed">
            &ldquo;{testimonial.quote}&rdquo;
          </blockquote>

          <div className="mt-8 flex items-center justify-center gap-4">
            {testimonial.avatarSrc ? (
              <img
                src={testimonial.avatarSrc}
                alt={testimonial.author}
                className="h-12 w-12 rounded-full object-cover ring-2 ring-indigo-100"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-indigo-100 ring-2 ring-indigo-200 flex items-center justify-center">
                <span className="text-lg font-bold text-indigo-600">
                  {testimonial.author[0]}
                </span>
              </div>
            )}
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-900">{testimonial.author}</p>
              <p className="text-sm text-slate-500">{testimonial.company}</p>
            </div>
          </div>

          {testimonial.isPlaceholder && (
            <p className="mt-6 text-xs text-slate-400 italic">
              Placeholder — replace with real client quote in marketing.config.ts
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
