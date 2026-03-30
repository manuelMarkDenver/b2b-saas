import {
  Package,
  ShoppingCart,
  CreditCard,
  Users,
  BookOpen,
  BarChart2,
  GitBranch,
  Store,
} from 'lucide-react';
import { featuresConfig, type FeatureCard } from '@/config/features.config';
import type { PlatformFeature } from '@repo/shared';

/**
 * Icon map — add new Lucide icons here as new features are added.
 * Keys must match the `icon` field in features.config.ts exactly.
 */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Package,
  ShoppingCart,
  CreditCard,
  Users,
  BookOpen,
  BarChart2,
  GitBranch,
  Store,
};

function FeatureCardComponent({ feature }: { feature: PlatformFeature }) {
  const Icon = ICON_MAP[feature.icon] ?? Package;
  return (
    <div className="group relative rounded-2xl border border-slate-200 bg-white p-6 hover:border-indigo-200 hover:shadow-md transition-all duration-200">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
        <Icon className="h-5 w-5 text-indigo-600" />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <h3 className="text-base font-semibold text-slate-900">{feature.label}</h3>
        {feature.badge && (
          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-700">
            {feature.badge}
          </span>
        )}
      </div>

      <p className="mt-2 text-sm text-slate-500 leading-relaxed">{feature.description}</p>
    </div>
  );
}

export function FeaturesGrid() {
  const enabled = featuresConfig.filter((f) => f.shipped);

  return (
    <section id="features" className="py-20 md:py-28 bg-slate-50">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 mb-3">
            Everything you need
          </p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            Built for how businesses actually work
          </h2>
          <p className="mt-4 text-lg text-slate-500">
            No bloated enterprise tools. No missing features. Just the right set of tools for growing operations teams.
          </p>
        </div>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {enabled.map((feature) => (
            <FeatureCardComponent key={feature.key} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
