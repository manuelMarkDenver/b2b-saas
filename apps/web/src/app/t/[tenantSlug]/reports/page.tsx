import { redirect } from 'next/navigation';
import { OrdersReport } from '@/components/reports/orders-report';
import { apiFetch } from '@/lib/api';
import { isFeatureActive } from '@repo/shared';

type Props = { params: Promise<{ tenantSlug: string }> };

async function getFeatures(tenantSlug: string) {
  const res = await apiFetch(`/tenant/context`, { tenantSlug });
  if (!res.ok) return null;
  const data = await res.json();
  return data.features as Record<string, boolean> | null;
}

export default async function ReportsPage({ params }: Props) {
  const { tenantSlug } = await params;
  const features = await getFeatures(tenantSlug);

  if (!isFeatureActive('reports', features)) {
    redirect(`/t/${tenantSlug}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View and export your order data.
        </p>
      </div>
      <OrdersReport tenantSlug={tenantSlug} />
    </div>
  );
}
