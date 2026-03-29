import { PaymentsPanel } from '@/components/payments-panel';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function PaymentsPage({ params }: Props) {
  const { tenantSlug } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">Submit and verify payments.</p>
      </div>
      <PaymentsPanel tenantSlug={tenantSlug} />
    </div>
  );
}
