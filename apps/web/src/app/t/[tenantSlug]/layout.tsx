import type { Metadata } from 'next';
import { TenantShell } from '@/components/tenant-shell';
import { getTenantTheme } from '@/lib/tenant-theme';

const PLATFORM_NAME = process.env.NEXT_PUBLIC_PLATFORM_NAME ?? 'Zentral';

export const metadata: Metadata = {
  title: PLATFORM_NAME,
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
          '--tenant-primary': theme.primary,
          '--tenant-primary-foreground': theme.primaryForeground,
          '--tenant-accent': theme.accent,
          '--tenant-accent-foreground': theme.accentForeground,
          '--tenant-radius': theme.radius,
          ...(theme.statusPending     && { '--status-pending':      theme.statusPending }),
          ...(theme.statusPendingFg   && { '--status-pending-fg':   theme.statusPendingFg }),
          ...(theme.statusConfirmed   && { '--status-confirmed':    theme.statusConfirmed }),
          ...(theme.statusConfirmedFg && { '--status-confirmed-fg': theme.statusConfirmedFg }),
          ...(theme.statusCompleted   && { '--status-completed':    theme.statusCompleted }),
          ...(theme.statusCompletedFg && { '--status-completed-fg': theme.statusCompletedFg }),
          ...(theme.statusCancelled   && { '--status-cancelled':    theme.statusCancelled }),
          ...(theme.statusCancelledFg && { '--status-cancelled-fg': theme.statusCancelledFg }),
        } as React.CSSProperties
      }
      className="min-h-dvh bg-background text-foreground"
    >
      <TenantShell tenantSlug={tenantSlug} tenantName={theme.brandName}>
        {children}
      </TenantShell>
    </div>
  );
}
