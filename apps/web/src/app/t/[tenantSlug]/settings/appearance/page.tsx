import { AppearanceSettings } from '@/components/settings/appearance';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function AppearancePage({ params }: Props) {
  const { tenantSlug } = await params;
  return <AppearanceSettings tenantSlug={tenantSlug} />;
}
