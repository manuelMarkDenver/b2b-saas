import { BranchesSettingsClient } from '@/components/settings/branches-page-client';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function BranchesSettingsPage({ params }: Props) {
  const { tenantSlug } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Branches</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage locations within your business.</p>
      </div>
      <BranchesSettingsClient tenantSlug={tenantSlug} />
    </div>
  );
}
