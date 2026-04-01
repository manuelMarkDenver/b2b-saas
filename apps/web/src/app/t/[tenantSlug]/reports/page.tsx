import { OrdersReport } from '@/components/reports/orders-report';
import { PageHeader } from '@/components/layout/page-header';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function ReportsPage({ params }: Props) {
  const { tenantSlug } = await params;

  return (
    <div className="space-y-6">
      <PageHeader tenantSlug={tenantSlug} title="Reports" description="View and export your order data." />
      <OrdersReport tenantSlug={tenantSlug} />
    </div>
  );
}
