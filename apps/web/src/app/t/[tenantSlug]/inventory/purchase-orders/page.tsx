import { PurchaseOrdersPageClient } from '@/components/purchase-orders-page-client';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function PurchaseOrdersPage({ params }: Props) {
  const { tenantSlug } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Purchase orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create purchase orders and receive stock into the selected branch.
        </p>
      </div>
      <PurchaseOrdersPageClient tenantSlug={tenantSlug} />
    </div>
  );
}
