import { CatalogPanel } from '@/components/catalog-panel';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function ProductsPage({ params }: Props) {
  const { tenantSlug } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your product catalog, SKUs, prices, and costs. Use CSV import to bulk-upload.
        </p>
      </div>
      <CatalogPanel tenantSlug={tenantSlug} />
    </div>
  );
}
