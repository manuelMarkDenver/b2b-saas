import { InventoryAdjustmentsPanel } from '@/components/inventory-adjustments-panel';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function InventoryAdjustmentsPage({ params }: Props) {
  const { tenantSlug } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory Adjustments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Log stock corrections and review adjustment history for the active branch.
        </p>
      </div>
      <InventoryAdjustmentsPanel tenantSlug={tenantSlug} />
    </div>
  );
}
