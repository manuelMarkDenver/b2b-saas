import { InventoryPanel } from '@/components/inventory-panel';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function InventoryPage({ params }: Props) {
  const { tenantSlug } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track stock movements and levels.</p>
      </div>
      <InventoryPanel tenantSlug={tenantSlug} />
    </div>
  );
}
