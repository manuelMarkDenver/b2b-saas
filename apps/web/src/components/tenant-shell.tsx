'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, User, ChevronDown } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { NotificationBell } from '@/components/notifications/bell';
import { ModeToggle } from '@/components/mode-toggle';
import { TenantSwitcher } from '@/components/tenant-switcher';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
};

type Membership = {
  status: string;
  tenant: {
    slug: string;
    name: string;
    features: TenantFeatures;
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
  });
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
        const data = await meRes.json() as { user: { email: string } };
        setUserEmail(data.user.email);
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
      {/* Sidebar */}
      <div className={cn('flex shrink-0 transition-all duration-200', sidebarOpen ? 'w-56' : 'w-0 overflow-hidden')}>
        <Sidebar tenantSlug={tenantSlug} features={features} />
      </div>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Toggle sidebar"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <Breadcrumbs tenantSlug={tenantSlug} tenantName={tenantName} />
          </div>

          <div className="flex items-center gap-1">
            <TenantSwitcher currentSlug={tenantSlug} />
            <NotificationBell tenantSlug={tenantSlug} />
            <ModeToggle />

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none">
                <User className="h-4 w-4" />
                <span className="max-w-[120px] truncate hidden sm:block">
                  {userEmail ?? '…'}
                </span>
                <ChevronDown className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{userEmail ?? 'Account'}</DropdownMenuLabel>
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
