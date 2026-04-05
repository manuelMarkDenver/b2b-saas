import { SuppliersPageClient } from '@/components/suppliers-page-client';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function SuppliersPage({ params }: Props) {
  const { tenantSlug } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your supplier contacts and details.
        </p>
      </div>
      <SuppliersPageClient tenantSlug={tenantSlug} />
    </div>
  );
}
