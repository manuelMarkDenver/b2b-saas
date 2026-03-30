'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { apiFetch } from '@/lib/api';
import { clearToken, getToken } from '@/lib/auth';
import { cn } from '@/lib/utils';

type TenantFeatures = {
  inventory: boolean;
  orders: boolean;
  payments: boolean;
  marketplace: boolean;
  reports: boolean;
};

type Membership = {
  status: string;
  role: string;
  tenant: {
    slug: string;
    name: string;
    features: TenantFeatures;
    logoUrl?: string | null;
  };
};

interface TenantShellProps {
  tenantSlug: string;
  tenantName: string;
  children: React.ReactNode;
}

export function TenantShell({ tenantSlug, tenantName, children }: TenantShellProps) {
  const router = useRouter();
  const [features, setFeatures] = useState<TenantFeatures>({
    inventory: true,
    orders: true,
    payments: true,
    marketplace: false,
    reports: false,
  });
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [tenantLogoUrl, setTenantLogoUrl] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (window.innerWidth >= 768) setSidebarOpen(true);
  }, []);

  useEffect(() => {
    if (!getToken()) router.replace('/login');
  }, [router]);

  useEffect(() => {
    async function load() {
      const [membershipsRes, meRes] = await Promise.all([
        apiFetch('/memberships'),
        apiFetch('/auth/me'),
      ]);

      if (membershipsRes.ok) {
        const memberships = await membershipsRes.json() as Membership[];
        const current = memberships.find(
          (m) => m.tenant.slug === tenantSlug && m.status === 'ACTIVE',
        );
        if (current?.tenant.features) {
          setFeatures(current.tenant.features);
          setTenantLogoUrl(current.tenant.logoUrl ?? null);
          setUserRole(current.role);
        } else {
          const first = memberships.find((m) => m.status === 'ACTIVE');
          router.replace(first ? `/t/${first.tenant.slug}` : '/login');
          return;
        }
      } else if (membershipsRes.status === 401) {
        router.replace('/login');
        return;
      }

      if (meRes.ok) {
        const data = await meRes.json() as { user: { email: string; avatarUrl?: string | null; isPlatformAdmin: boolean } };
        if (data.user.isPlatformAdmin) {
          router.replace('/admin');
          return;
        }
        setUserEmail(data.user.email);
        setUserAvatarUrl(data.user.avatarUrl ?? null);
      }
    }
    load();
  }, [tenantSlug]);

  function handleLogout() {
    clearToken();
    router.push('/login');
  }

  return (
    <div className="flex h-dvh overflow-hidden safe-top safe-bottom safe-left safe-right">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex shrink-0 transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'md:relative md:inset-auto md:z-auto md:translate-x-0 md:transition-[width] md:duration-200',
          sidebarOpen ? 'md:w-64' : 'md:w-0 md:overflow-hidden',
        )}
      >
        <Sidebar
          tenantSlug={tenantSlug}
          tenantName={tenantName}
          features={features}
          logoUrl={tenantLogoUrl}
          userRole={userRole}
          userEmail={userEmail}
          userAvatarUrl={userAvatarUrl}
          onLogoChange={(url) => setTenantLogoUrl(url)}
          onLogout={handleLogout}
        />
      </div>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile-only header — hamburger + workspace name */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 md:hidden">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Toggle sidebar"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="truncate text-sm font-semibold">{tenantName}</span>
        </header>

        {/* Page content — breadcrumbs sit at top of the scroll area */}
        <main className="flex-1 overflow-y-auto bg-muted/30">
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 pb-6 md:px-6 lg:px-8">
            {/* Desktop breadcrumbs — inside content flow, no fixed header */}
            <div className="mb-4 hidden md:block">
              <Breadcrumbs tenantSlug={tenantSlug} tenantName={tenantName} />
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
