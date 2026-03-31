'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Settings, Users, Palette, Moon, Sun, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

const SETTINGS_NAV = [
  { label: 'Profile', href: 'profile', icon: Settings },
  { label: 'Team & Permissions', href: 'team', icon: Users },
  { label: 'Appearance', href: 'appearance', icon: Palette },
];

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const;

export function AppearanceSettings({ tenantSlug }: { tenantSlug: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-6">
      {/* Settings nav */}
      <aside className="shrink-0 md:w-44">
        <nav className="flex flex-row flex-wrap gap-1 md:flex-col md:gap-0.5">
          {SETTINGS_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === 'appearance';
            return (
              <Link
                key={item.href}
                href={`/t/${tenantSlug}/settings/${item.href}`}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Appearance content */}
      <div className="flex-1 space-y-4">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-base font-semibold">Appearance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Customize how the app looks on your device.
          </p>

          <div className="mt-6 space-y-3">
            <p className="text-sm font-medium">Theme</p>
            <div className="flex gap-3">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-2 rounded-lg border-2 p-4 text-sm font-medium transition-colors',
                    theme === value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              "System" follows your device's dark/light mode preference.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
