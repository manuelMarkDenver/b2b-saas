import { InventoryHistoryPanel } from '@/components/inventory-history-panel';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function InventoryHistoryPage({ params }: Props) {
  const { tenantSlug } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View all stock movements for the active branch.
        </p>
      </div>
      <InventoryHistoryPanel tenantSlug={tenantSlug} />
    </div>
  );
}
