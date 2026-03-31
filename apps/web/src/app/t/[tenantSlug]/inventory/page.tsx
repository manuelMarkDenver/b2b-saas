import { InventoryPanel } from '@/components/inventory-panel';
import { PageHeader } from '@/components/layout/page-header';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function InventoryPage({ params }: Props) {
  const { tenantSlug } = await params;
  return (
    <div className="space-y-6">
      <PageHeader tenantSlug={tenantSlug} title="Inventory" description="Live stock levels for all products." />
      <InventoryPanel tenantSlug={tenantSlug} />
    </div>
  );
}
