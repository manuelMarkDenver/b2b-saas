import { CustomersPanel } from '@/components/customers-panel';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function CustomersPage({ params }: Props) {
  const { tenantSlug } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage contacts, track outstanding balances, and monitor credit accounts.
        </p>
      </div>
      <CustomersPanel tenantSlug={tenantSlug} />
    </div>
  );
}
