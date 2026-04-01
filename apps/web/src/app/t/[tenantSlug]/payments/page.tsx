import { PaymentsPanel } from '@/components/payments-panel';
import { PageHeader } from '@/components/layout/page-header';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function PaymentsPage({ params }: Props) {
  const { tenantSlug } = await params;
  return (
    <div className="space-y-6">
      <PageHeader tenantSlug={tenantSlug} title="Payments" description="Submit and verify payments." />
      <PaymentsPanel tenantSlug={tenantSlug} />
    </div>
  );
}
