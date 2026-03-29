'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Settings, Users } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type TenantInfo = {
  id: string;
  name: string;
  slug: string;
  businessType: string;
  features: Record<string, boolean>;
  status?: string;
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
  const [tenant, setTenant] = useState<TenantInfo | null>(null);

  useEffect(() => {
    async function load() {
      const res = await apiFetch('/memberships');
      if (!res.ok) return;
      const memberships = await res.json() as Array<{ tenant: TenantInfo; status: string }>;
      const current = memberships.find((m) => m.tenant.slug === tenantSlug && m.status === 'ACTIVE');
      if (current) setTenant(current.tenant);
    }
    load();
  }, [tenantSlug]);

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
          ) : (
            <div className="mt-5 text-sm text-muted-foreground">Loading…</div>
          )}
        </div>
      </div>
    </div>
  );
}
