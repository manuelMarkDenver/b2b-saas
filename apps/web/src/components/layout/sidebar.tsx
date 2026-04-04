'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  CreditCard,
  Boxes,
  Package,
  Users,
  ArrowLeftRight,
  Settings,
  GitBranch,
  FileText,
  LogOut,
  User,
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { ImageUpload } from '@/components/image-upload';
import { apiFetch } from '@/lib/api';
import { isFeatureActive } from '@repo/shared';
import { BranchSwitcher } from '@/components/branch-switcher';
import { NotificationBell } from '@/components/notifications/bell';
import { ModeToggle } from '@/components/mode-toggle';
import { platformConfig } from '@/lib/platform-config';

export type TenantFeatures = Record<string, boolean>;

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  featureKey?: string;
  /** If set, only these roles can see this item */
  roles?: string[];
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Orders', href: '/orders', icon: ShoppingCart, featureKey: 'orders' },
      { label: 'Inventory', href: '/inventory', icon: Boxes, featureKey: 'inventory' },
      { label: 'Payments', href: '/payments', icon: CreditCard, featureKey: 'payments' },
      { label: 'Customers', href: '/customers', icon: Users, roles: ['OWNER', 'ADMIN'] },
      { label: 'Stock Transfers', href: '/transfers', icon: ArrowLeftRight, featureKey: 'stockTransfers', roles: ['OWNER', 'ADMIN'] },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { label: 'Products', href: '/products', icon: Package, featureKey: 'inventory', roles: ['OWNER', 'ADMIN'] },
    ],
  },
  {
    label: 'Reports',
    items: [
      { label: 'Reports', href: '/reports', icon: FileText, featureKey: 'reports' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { label: 'Branches', href: '/settings/branches', icon: GitBranch },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

interface SidebarProps {
  tenantSlug: string;
  tenantName: string;
  features: TenantFeatures;
  logoUrl?: string | null;
  userRole?: string | null;
  userEmail?: string | null;
  userAvatarUrl?: string | null;
  onLogoChange?: (url: string | null) => void;
  onLogout?: () => void;
}

export function Sidebar({
  tenantSlug,
  tenantName,
  features,
  logoUrl,
  userRole,
  userEmail,
  userAvatarUrl,
  onLogoChange,
  onLogout,
}: SidebarProps) {
  const pathname = usePathname();
  const base = `/t/${tenantSlug}`;
  const canEditLogo = userRole === 'OWNER' || userRole === 'ADMIN';

  function isItemVisible(item: NavItem) {
    if (item.roles && !item.roles.includes(userRole ?? '')) return false;
    if (!item.featureKey) return true;
    return isFeatureActive(item.featureKey, features);
  }

  function isItemActive(item: NavItem) {
    const href = `${base}${item.href}`;
    if (item.href === '') return pathname === base || pathname === `${base}/`;
    if (pathname === href) return true;
    // Prefix match only if no more specific sibling matches the current path
    const allHrefs = NAV_SECTIONS.flatMap((s) => s.items.map((i) => `${base}${i.href}`));
    const moreSpecificSiblingMatches = allHrefs.some(
      (h) => h !== href && h.startsWith(href) && (pathname === h || pathname.startsWith(`${h}/`)),
    );
    return !moreSpecificSiblingMatches && pathname.startsWith(`${href}/`);
  }

  async function handleLogoUploaded(url: string) {
    await apiFetch('/tenant/logo', { tenantSlug, method: 'PATCH', body: JSON.stringify({ logoUrl: url }) });
    onLogoChange?.(url);
  }

  async function handleLogoRemoved() {
    await apiFetch('/tenant/logo', { tenantSlug, method: 'PATCH', body: JSON.stringify({ logoUrl: null }) });
    onLogoChange?.(null);
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-background">
      {/* Platform header — swappable for white-label via NEXT_PUBLIC_PLATFORM_* env vars */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        {platformConfig.logoIconUrl ? (
          // White-label: hosted image URL (PNG/SVG — color already baked in)
          // eslint-disable-next-line @next/next/no-img-element
          <img src={platformConfig.logoIconUrl} alt={platformConfig.name} className="h-8 w-8 shrink-0" />
        ) : (
          // Default Ascendex inline SVG — currentColor adapts to dark/light mode
          <svg className="h-8 w-8 shrink-0 text-primary" viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="15" width="6" height="8" rx="1.5" fill="currentColor" opacity="0.35"/>
            <rect x="9" y="9" width="6" height="14" rx="1.5" fill="currentColor" opacity="0.65"/>
            <rect x="17" y="2" width="6" height="21" rx="1.5" fill="currentColor"/>
          </svg>
        )}
        <span className="text-lg font-extrabold tracking-tight">{platformConfig.name}</span>
      </div>

      {/* Workspace header */}
      <div className="px-4 pt-5 pb-4 border-b border-border">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Workspace
        </p>
        <div className="flex items-center gap-2.5">
          {canEditLogo ? (
            <ImageUpload
              currentUrl={logoUrl}
              tenantSlug={tenantSlug}
              size={32}
              resourceType="tenant-logo"
              onUploaded={handleLogoUploaded}
              onRemoved={handleLogoRemoved}
            />
          ) : (
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-primary/10">
              {logoUrl ? (
                <Image src={logoUrl} alt={tenantName} fill className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-bold text-primary">
                  {tenantName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          )}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{tenantName}</span>
        </div>
        <div className="mt-2">
          <BranchSwitcher tenantSlug={tenantSlug} compact />
        </div>
      </div>

      {/* Navigation sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_SECTIONS.map((section) => {
          const visibleItems = section.items.filter(isItemVisible);
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.label}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const href = `${base}${item.href}`;
                  const active = isItemActive(item);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom: tools + user + logout */}
      <div className="border-t border-border px-3 py-3 space-y-1">
        {/* Notification bell + mode toggle */}
        <div className="flex items-center gap-1 px-2 py-1">
          <NotificationBell tenantSlug={tenantSlug} />
          <ModeToggle />
        </div>

        {/* User info */}
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-muted">
            {userAvatarUrl ? (
              <Image src={userAvatarUrl} alt="avatar" fill className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-muted-foreground">
                {userEmail ? userEmail[0].toUpperCase() : <User className="h-3 w-3" />}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{userEmail ?? 'Account'}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{userRole?.toLowerCase() ?? ''}</p>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          <span>Sign out</span>
        </button>

        {/* Powered by — hidden for white-label via NEXT_PUBLIC_PLATFORM_SHOW_POWERED_BY=false */}
        {platformConfig.showPoweredBy && platformConfig.parentCompanyName && (
          <p className="pt-1 text-center text-[10px] text-muted-foreground/50">
            Powered by {platformConfig.parentCompanyName}
          </p>
        )}
      </div>
    </aside>
  );
}
