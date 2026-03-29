import { TenantProfileSettings } from '@/components/settings/tenant-profile';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function ProfileSettingsPage({ params }: Props) {
  const { tenantSlug } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your workspace settings.</p>
      </div>
      <TenantProfileSettings tenantSlug={tenantSlug} />
    </div>
  );
}
