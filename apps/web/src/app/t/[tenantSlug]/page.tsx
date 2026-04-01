import { getTenantTheme } from '@/lib/tenant-theme';
import { DashboardStats } from '@/components/dashboard/stats';
import { PageHeader } from '@/components/layout/page-header';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function TenantDashboard({ params }: Props) {
  const { tenantSlug } = await params;
  const theme = getTenantTheme(tenantSlug);

  return (
    <div className="space-y-6">
      <PageHeader
        tenantSlug={tenantSlug}
        title={theme.brandName}
        description="Overview of your inventory, orders, and payments."
      />
      <DashboardStats tenantSlug={tenantSlug} />
    </div>
  );
}
