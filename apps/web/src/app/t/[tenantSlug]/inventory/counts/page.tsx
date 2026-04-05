import { InventoryCountsPanel } from '@/components/inventory-counts-panel';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function InventoryCountsPage({ params }: Props) {
  const { tenantSlug } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory Counts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter actual counts to reconcile stock for the selected branch.
        </p>
      </div>
      <InventoryCountsPanel tenantSlug={tenantSlug} />
    </div>
  );
}
