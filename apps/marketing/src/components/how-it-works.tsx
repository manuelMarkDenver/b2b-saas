import { marketingConfig } from '@/config/marketing.config';
import { ImagePlaceholder } from './image-placeholder';

export function HowItWorks() {
  const { howItWorks } = marketingConfig;

  return (
    <section id="how-it-works" className="py-20 md:py-28 bg-white">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 mb-3">
            How it works
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            {howItWorks.title}
          </h2>
          <p className="mt-4 text-lg text-slate-500">{howItWorks.subtitle}</p>
        </div>

        <div className="mt-16 space-y-20">
          {howItWorks.steps.map((step, i) => {
            const isEven = i % 2 === 1;
            return (
              <div
                key={step.number}
                className={`grid md:grid-cols-2 gap-12 items-center ${isEven ? 'md:[&>*:first-child]:order-2' : ''}`}
              >
                {/* Copy */}
                <div>
                  <span className="inline-block text-5xl font-black text-indigo-100 leading-none mb-4 select-none">
                    {step.number}
                  </span>
                  <h3 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">
                    {step.title}
                  </h3>
                  <p className="mt-4 text-lg text-slate-500 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Image */}
                <div className="rounded-2xl overflow-hidden shadow-lg ring-1 ring-slate-200">
                  {step.image.src ? (
                    <img
                      src={step.image.src}
                      alt={step.image.alt}
                      width={step.image.width}
                      height={step.image.height}
                      className="w-full h-auto"
                    />
                  ) : (
                    <ImagePlaceholder
                      width={step.image.width}
                      height={step.image.height}
                      label={`Step ${step.number} image`}
                      hint="Run /generate-image to fill this"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
