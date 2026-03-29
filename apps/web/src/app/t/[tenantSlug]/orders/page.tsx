import { OrdersPanel } from '@/components/orders-panel';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function OrdersPage({ params }: Props) {
  const { tenantSlug } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">Create and manage customer orders.</p>
      </div>
      <OrdersPanel tenantSlug={tenantSlug} />
    </div>
  );
}
