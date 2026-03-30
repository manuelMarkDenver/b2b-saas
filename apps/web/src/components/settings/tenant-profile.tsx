'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Settings, Users } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ImageUpload } from '@/components/image-upload';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

type TenantInfo = {
  id: string;
  name: string;
  slug: string;
  businessType: string;
  features: Record<string, boolean>;
  status?: string;
  logoUrl?: string | null;
};

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  general_retail: 'General Retail',
  hardware: 'Hardware Supply',
  food_beverage: 'Food & Beverage',
  packaging_supply: 'Packaging Supply',
};

interface TenantProfileSettingsProps {
  tenantSlug: string;
}

const SETTINGS_NAV = [
  { label: 'Profile', href: 'profile', icon: Settings },
  { label: 'Team & Permissions', href: 'team', icon: Users },
];

export function TenantProfileSettings({ tenantSlug }: TenantProfileSettingsProps) {
  const { pushToast } = useToast();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [role, setRole] = useState<string | null>(null);

  // Password change form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      pushToast({ variant: 'error', title: 'Passwords do not match', message: 'New password and confirmation must match.' });
      return;
    }
    setPwSaving(true);
    try {
      const res = await apiFetch('/auth/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        pushToast({ variant: 'error', title: 'Password change failed', message: err.message ?? 'Please try again.' });
      } else {
        pushToast({ variant: 'success', title: 'Password updated', message: 'Your password has been changed.' });
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      }
    } finally {
      setPwSaving(false);
    }
  }

  useEffect(() => {
    async function load() {
      const res = await apiFetch('/memberships');
      if (!res.ok) return;
      const memberships = await res.json() as Array<{ tenant: TenantInfo; status: string; role: string }>;
      const current = memberships.find((m) => m.tenant.slug === tenantSlug && m.status === 'ACTIVE');
      if (current) {
        setTenant(current.tenant);
        setRole(current.role);
      }
    }
    load();
  }, [tenantSlug]);

  const canEditLogo = role === 'OWNER' || role === 'ADMIN';

  async function handleLogoUploaded(url: string) {
    await apiFetch('/tenant/logo', { tenantSlug, method: 'PATCH', body: JSON.stringify({ logoUrl: url }) });
    setTenant((t) => t ? { ...t, logoUrl: url } : t);
  }

  async function handleLogoRemoved() {
    await apiFetch('/tenant/logo', { tenantSlug, method: 'PATCH', body: JSON.stringify({ logoUrl: null }) });
    setTenant((t) => t ? { ...t, logoUrl: null } : t);
  }

  return (
    <div className="flex gap-6">
      {/* Settings nav */}
      <aside className="w-44 shrink-0">
        <nav className="flex flex-col gap-0.5">
          {SETTINGS_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === 'profile';
            return (
              <Link
                key={item.href}
                href={`/t/${tenantSlug}/settings/${item.href}`}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Profile content */}
      <div className="flex-1 space-y-4">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-base font-semibold">Workspace Profile</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your tenant configuration as set up by the platform admin.
          </p>

          {tenant ? (
            <>
              {/* Logo */}
              <div className="mt-5 flex items-center gap-4">
                {canEditLogo ? (
                  <ImageUpload
                    currentUrl={tenant.logoUrl}
                    tenantSlug={tenantSlug}
                    size={64}
                    onUploaded={handleLogoUploaded}
                    onRemoved={handleLogoRemoved}
                  />
                ) : tenant.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={tenant.logoUrl} alt="logo" className="h-16 w-16 rounded-md object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-md bg-primary/10 text-xl font-bold text-primary">
                    {tenant.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium">{tenant.name}</div>
                  {canEditLogo ? (
                    <div className="mt-0.5 text-xs text-muted-foreground">Click logo to upload or remove</div>
                  ) : null}
                </div>
              </div>

            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <dt className="font-medium text-muted-foreground">Name</dt>
              <dd>{tenant.name}</dd>

              <dt className="font-medium text-muted-foreground">Slug</dt>
              <dd>
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{tenant.slug}</code>
              </dd>

              <dt className="font-medium text-muted-foreground">Business type</dt>
              <dd>{BUSINESS_TYPE_LABELS[tenant.businessType] ?? tenant.businessType}</dd>

              <dt className="font-medium text-muted-foreground">Status</dt>
              <dd>
                <Badge variant={tenant.status === 'SUSPENDED' ? 'destructive' : 'success'}>
                  {tenant.status ?? 'ACTIVE'}
                </Badge>
              </dd>

              <dt className="font-medium text-muted-foreground">Enabled modules</dt>
              <dd className="flex flex-wrap gap-1">
                {Object.entries(tenant.features ?? {})
                  .filter(([, enabled]) => enabled)
                  .map(([key]) => (
                    <Badge key={key} variant="secondary" className="capitalize">
                      {key}
                    </Badge>
                  ))}
              </dd>
            </dl>
            </>
          ) : (
            <div className="mt-5 text-sm text-muted-foreground">Loading…</div>
          )}
        </div>

        {/* Change password */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-base font-semibold">Change Password</h2>
          <p className="mt-1 text-sm text-muted-foreground">Update your login password.</p>
          <form onSubmit={handlePasswordChange} className="mt-5 space-y-4 max-w-sm">
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                minLength={8}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={pwSaving}>
              {pwSaving ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
