import { OrdersPanel } from '@/components/orders-panel';
import { PageHeader } from '@/components/layout/page-header';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function OrdersPage({ params }: Props) {
  const { tenantSlug } = await params;
  return (
    <div className="space-y-6">
      <PageHeader tenantSlug={tenantSlug} title="Orders" description="Create and manage customer orders." />
      <OrdersPanel tenantSlug={tenantSlug} />
    </div>
  );
}
