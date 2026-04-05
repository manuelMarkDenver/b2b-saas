import { PurchaseOrderDetailClient } from '@/components/purchase-order-detail-panel';

type Props = { params: Promise<{ tenantSlug: string; id: string }> };

export default async function PurchaseOrderDetailPage({ params }: Props) {
  const { tenantSlug, id } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Purchase Order</h1>
      </div>
      <PurchaseOrderDetailClient tenantSlug={tenantSlug} poId={id} />
    </div>
  );
}
