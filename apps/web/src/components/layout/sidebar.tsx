'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  CreditCard,
  Boxes,
  Settings,
  BookOpen,
  Users,
  GitBranch,
  FileText,
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { ImageUpload } from '@/components/image-upload';
import { apiFetch } from '@/lib/api';
import { isFeatureActive } from '@repo/shared';

// TenantFeatures shape — matches Tenant.features JSON from the API
export type TenantFeatures = Record<string, boolean>;

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  /** Matches a key in PLATFORM_FEATURES. Undefined = always shown (no feature flag). */
  featureKey?: string;
};

/**
 * Sidebar navigation items.
 * featureKey must match a key in packages/shared/src/features.ts exactly.
 * Items without featureKey are always visible (Dashboard, Settings).
 */
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '', icon: LayoutDashboard },
  { label: 'Inventory', href: '/inventory', icon: Boxes, featureKey: 'inventory' },
  { label: 'Orders', href: '/orders', icon: ShoppingCart, featureKey: 'orders' },
  { label: 'Payments', href: '/payments', icon: CreditCard, featureKey: 'payments' },
  { label: 'Reports', href: '/reports', icon: FileText, featureKey: 'reports' },
  { label: 'Catalog', href: '/catalog', icon: BookOpen, featureKey: 'catalog' },
  { label: 'Team', href: '/settings/team', icon: Users, featureKey: 'team' },
  { label: 'Branches', href: '/settings/branches', icon: GitBranch },
  { label: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  tenantSlug: string;
  tenantName: string;
  features: TenantFeatures;
  logoUrl?: string | null;
  userRole?: string | null;
  onLogoChange?: (url: string | null) => void;
}

export function Sidebar({ tenantSlug, tenantName, features, logoUrl, userRole, onLogoChange }: SidebarProps) {
  const pathname = usePathname();
  const base = `/t/${tenantSlug}`;
  const canEditLogo = userRole === 'OWNER' || userRole === 'ADMIN';

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.featureKey) return true;
    // isFeatureActive checks BOTH: feature is shipped AND tenant has it enabled
    return isFeatureActive(item.featureKey, features);
  });

  async function handleLogoUploaded(url: string) {
    await apiFetch('/tenant/logo', { tenantSlug, method: 'PATCH', body: JSON.stringify({ logoUrl: url }) });
    onLogoChange?.(url);
  }

  async function handleLogoRemoved() {
    await apiFetch('/tenant/logo', { tenantSlug, method: 'PATCH', body: JSON.stringify({ logoUrl: null }) });
    onLogoChange?.(null);
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-background">
      {/* Tenant logo / branding header */}
      <div className="flex items-center gap-2.5 border-b border-border px-3 py-3">
        {canEditLogo ? (
          <ImageUpload
            currentUrl={logoUrl}
            tenantSlug={tenantSlug}
            size={32}
            onUploaded={handleLogoUploaded}
            onRemoved={handleLogoRemoved}
          />
        ) : (
          <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-primary/10">
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
      <nav className="flex flex-col gap-0.5 p-3">
        {visibleItems.map((item) => {
          const href = `${base}${item.href}`;
          const isActive = item.href === ''
            ? pathname === base || pathname === `${base}/`
            : pathname === href || pathname.startsWith(`${href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                'group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-foreground'
                  : 'text-muted-foreground hover:bg-primary/10 hover:text-foreground',
              )}
            >
              {isActive ? (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary" />
              ) : null}
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                )}
              />
              <span className="flex-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
