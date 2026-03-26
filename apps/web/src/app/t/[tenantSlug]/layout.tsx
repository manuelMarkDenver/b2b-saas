import type { Metadata } from "next";

import { AuthStatus } from "@/components/auth-status";
import { ModeToggle } from "@/components/mode-toggle";
import { TenantSwitcher } from "@/components/tenant-switcher";
import { getTenantTheme } from "@/lib/tenant-theme";

export const metadata: Metadata = {
  title: "B2B Marketplace",
};

export default async function TenantLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ tenantSlug: string }> }>) {
  const { tenantSlug } = await params;
  const theme = getTenantTheme(tenantSlug);

  return (
    <div
      style={
        {
          "--tenant-primary": theme.primary,
          "--tenant-primary-foreground": theme.primaryForeground,
          "--tenant-accent": theme.accent,
          "--tenant-accent-foreground": theme.accentForeground,
          "--tenant-radius": theme.radius,
        } as React.CSSProperties
      }
      className="min-h-dvh bg-background text-foreground"
    >
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-baseline gap-2">
            <div className="text-sm font-semibold tracking-wide">{theme.brandName}</div>
            <div className="text-xs text-muted-foreground">/t/{tenantSlug}</div>
          </div>
          <div className="flex items-center gap-2">
            <TenantSwitcher currentSlug={tenantSlug} />
            <AuthStatus />
            <ModeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
