import { TransfersPanel } from '@/components/transfers-panel';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function TransfersPage({ params }: Props) {
  const { tenantSlug } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Stock Transfers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stock moves only when the destination marks a transfer as received.
        </p>
      </div>
      <TransfersPanel tenantSlug={tenantSlug} />
    </div>
  );
}
