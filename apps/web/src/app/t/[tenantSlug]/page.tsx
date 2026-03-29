import { getTenantTheme } from '@/lib/tenant-theme';
import { DashboardStats } from '@/components/dashboard/stats';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function TenantDashboard({ params }: Props) {
  const { tenantSlug } = await params;
  const theme = getTenantTheme(tenantSlug);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{theme.brandName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of your inventory, orders, and payments.
        </p>
      </div>
      <DashboardStats tenantSlug={tenantSlug} />
    </div>
  );
}
