import { TeamSettings } from '@/components/settings/team';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function TeamSettingsPage({ params }: Props) {
  const { tenantSlug } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team & Permissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage team members and their roles.</p>
      </div>
      <TeamSettings tenantSlug={tenantSlug} />
    </div>
  );
}
