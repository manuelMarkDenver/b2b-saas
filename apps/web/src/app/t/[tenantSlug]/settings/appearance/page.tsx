import { AppearanceSettings } from '@/components/settings/appearance';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function AppearancePage({ params }: Props) {
  const { tenantSlug } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Appearance</h1>
        <p className="mt-1 text-sm text-muted-foreground">Customize how the app looks on your device.</p>
      </div>
      <AppearanceSettings tenantSlug={tenantSlug} />
    </div>
  );
}
