import { OrdersReport } from '@/components/reports/orders-report';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function ReportsPage({ params }: Props) {
  const { tenantSlug } = await params;

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
