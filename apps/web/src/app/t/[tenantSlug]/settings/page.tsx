import { redirect } from 'next/navigation';

type Props = { params: Promise<{ tenantSlug: string }> };

export default async function SettingsPage({ params }: Props) {
  const { tenantSlug } = await params;
  redirect(`/t/${tenantSlug}/settings/profile`);
}
