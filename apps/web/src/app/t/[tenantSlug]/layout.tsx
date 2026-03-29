import type { Metadata } from 'next';
import { TenantShell } from '@/components/tenant-shell';
import { getTenantTheme } from '@/lib/tenant-theme';

export const metadata: Metadata = {
  title: 'Platform',
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
