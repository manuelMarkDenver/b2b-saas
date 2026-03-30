'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { ImageUpload } from '@/components/image-upload';
import { Sidebar } from '@/components/layout/sidebar';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { NotificationBell } from '@/components/notifications/bell';
import { ModeToggle } from '@/components/mode-toggle';
import { TenantSwitcher } from '@/components/tenant-switcher';
import { BranchSwitcher } from '@/components/branch-switcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

  // Open sidebar by default on desktop after mount
  useEffect(() => {
    if (window.innerWidth >= 768) setSidebarOpen(true);
  }, []);

  // Auth guard — redirect if no token
  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
    }
  }, [router]);

  // Fetch features + user info
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
          // Not a member of this tenant — redirect to first active tenant or login
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
    <div className="flex h-dvh overflow-hidden">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed drawer on mobile, inline collapse on desktop */}
      <div
        className={cn(
          // Mobile: fixed drawer sliding in from left
          'fixed inset-y-0 left-0 z-30 flex shrink-0 transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: inline sidebar with width transition
          'md:relative md:inset-auto md:z-auto md:translate-x-0 md:transition-[width] md:duration-200',
          sidebarOpen ? 'md:w-56' : 'md:w-0 md:overflow-hidden',
        )}
      >
        <Sidebar
          tenantSlug={tenantSlug}
          tenantName={tenantName}
          features={features}
          logoUrl={tenantLogoUrl}
          userRole={userRole}
          onLogoChange={(url) => setTenantLogoUrl(url)}
        />
      </div>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Toggle sidebar"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="min-w-0 overflow-hidden">
              <Breadcrumbs tenantSlug={tenantSlug} tenantName={tenantName} />
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <div className="hidden md:flex md:items-center md:gap-1">
              <TenantSwitcher currentSlug={tenantSlug} />
              <BranchSwitcher tenantSlug={tenantSlug} />
              <NotificationBell tenantSlug={tenantSlug} />
            </div>
            <ModeToggle />

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none">
                <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full bg-muted">
                  {userAvatarUrl ? (
                    <Image src={userAvatarUrl} alt="avatar" fill className="object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
                      {userEmail ? userEmail[0].toUpperCase() : <User className="h-3 w-3" />}
                    </div>
                  )}
                </div>
                <span className="max-w-[120px] truncate hidden sm:block">
                  {userEmail ?? '…'}
                </span>
                <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center gap-3 px-3 py-2">
                  <ImageUpload
                    currentUrl={userAvatarUrl}
                    tenantSlug={tenantSlug}
                    size={40}
                    onUploaded={async (url) => {
                      setUserAvatarUrl(url);
                      await apiFetch('/auth/me', { method: 'PATCH', body: JSON.stringify({ avatarUrl: url }) });
                    }}
                    onRemoved={async () => {
                      setUserAvatarUrl(null);
                      await apiFetch('/auth/me', { method: 'PATCH', body: JSON.stringify({ avatarUrl: null }) });
                    }}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{userEmail ?? 'Account'}</div>
                    <div className="text-[10px] text-muted-foreground">Click photo to change</div>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
