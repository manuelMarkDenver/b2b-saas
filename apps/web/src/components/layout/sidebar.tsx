'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  ShoppingBag,
  Boxes,
  ShoppingCart,
  Users,
  CreditCard,
  BarChart2,
  Settings,
  LogOut,
  Menu,
  ChevronDown,
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { isFeatureActive } from '@repo/shared';
import { BranchSwitcher } from '@/components/branch-switcher';
import { NotificationBell } from '@/components/notifications/bell';
import { ModeToggle } from '@/components/mode-toggle';
import { platformConfig } from '@/lib/platform-config';

export type TenantFeatures = Record<string, boolean>;

type NavSubItem = {
  label: string;
  href: string;
  featureKey?: string;
  roles?: string[];
};

type NavGroup =
  | {
      type: 'single';
      id: string;
      label: string;
      icon: React.ElementType;
      href: string;
      featureKey?: string;
      roles?: string[];
    }
  | {
      type: 'group';
      id: string;
      label: string;
      icon: React.ElementType;
      featureKey?: string;
      roles?: string[];
      items: NavSubItem[];
    };

const NAV_GROUPS: NavGroup[] = [
  {
    type: 'single',
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '',
  },
  {
    type: 'group',
    id: 'items',
    label: 'Items',
    icon: ShoppingBag,
    items: [
      { label: 'Item list', href: '/products', featureKey: 'inventory', roles: ['OWNER', 'ADMIN'] },
    ],
  },
  {
    type: 'group',
    id: 'inventory',
    label: 'Inventory',
    icon: Boxes,
    items: [
      { label: 'Adjustments', href: '/inventory/adjustments', featureKey: 'inventory' },
      { label: 'Transfers', href: '/transfers', featureKey: 'stockTransfers', roles: ['OWNER', 'ADMIN'] },
      { label: 'History', href: '/inventory/history', featureKey: 'inventory' },
    ],
  },
  {
    type: 'single',
    id: 'orders',
    label: 'Orders',
    icon: ShoppingCart,
    href: '/orders',
    featureKey: 'orders',
  },
  {
    type: 'single',
    id: 'customers',
    label: 'Customers',
    icon: Users,
    href: '/customers',
    roles: ['OWNER', 'ADMIN'],
  },
  {
    type: 'single',
    id: 'payments',
    label: 'Payments',
    icon: CreditCard,
    href: '/payments',
    featureKey: 'accounting',
  },
  {
    type: 'single',
    id: 'reports',
    label: 'Reports',
    icon: BarChart2,
    href: '/reports',
    featureKey: 'reports',
  },
];

const SETTINGS_ITEMS: NavSubItem[] = [
  { label: 'Branches', href: '/settings/branches' },
  { label: 'Team', href: '/settings/team' },
  { label: 'Settings', href: '/settings' },
];

interface SidebarProps {
  tenantSlug: string;
  tenantName: string;
  features: TenantFeatures;
  logoUrl?: string | null;
  userRole?: string | null;
  userEmail?: string | null;
  userAvatarUrl?: string | null;
  onLogout?: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({
  tenantSlug,
  tenantName,
  features,
  logoUrl,
  userRole,
  userEmail,
  userAvatarUrl,
  onLogout,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const base = `/t/${tenantSlug}`;

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['items', 'inventory']));

  useEffect(() => {
    const stored = localStorage.getItem('zentral:sidebar:groups');
    if (stored) {
      try { setExpandedGroups(new Set(JSON.parse(stored))); } catch {}
    }
  }, []);

  function toggleGroup(id: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem('zentral:sidebar:groups', JSON.stringify([...next]));
      return next;
    });
  }

  function handleGroupIconClick(groupId: string) {
    if (collapsed) {
      onToggleCollapse();
      setExpandedGroups((prev) => {
        const next = new Set(prev);
        next.add(groupId);
        localStorage.setItem('zentral:sidebar:groups', JSON.stringify([...next]));
        return next;
      });
    } else {
      toggleGroup(groupId);
    }
  }

  function isSubItemVisible(item: NavSubItem): boolean {
    if (item.roles && !item.roles.includes(userRole ?? '')) return false;
    if (item.featureKey) return isFeatureActive(item.featureKey, features);
    return true;
  }

  function isGroupVisible(group: NavGroup): boolean {
    if ('roles' in group && group.roles && !group.roles.includes(userRole ?? '')) return false;
    if ('featureKey' in group && group.featureKey) return isFeatureActive(group.featureKey, features);
    if (group.type === 'group') {
      return group.items.some((item) => isSubItemVisible(item));
    }
    return true;
  }

  function isPathActive(href: string): boolean {
    const full = `${base}${href}`;
    if (href === '') return pathname === base || pathname === `${base}/`;
    // Exact match only — do NOT prefix-match to avoid double-highlighting sibling sub-items
    return pathname === full;
  }

  function isGroupActive(group: Extract<NavGroup, { type: 'group' }>): boolean {
    return group.items.some((item) => isSubItemVisible(item) && isPathActive(item.href));
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-background overflow-hidden">
      {/* Hamburger + platform header */}
      <div className="flex h-14 shrink-0 items-center border-b border-border px-3 gap-3">
        <button
          onClick={onToggleCollapse}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu className="h-4 w-4" />
        </button>
        {!collapsed && (
          <>
            {platformConfig.logoIconUrl ? (
              <img src={platformConfig.logoIconUrl} alt={platformConfig.name} className="h-6 w-6 shrink-0" />
            ) : (
              <svg className="h-6 w-6 shrink-0 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            )}
            <span className="text-sm font-bold tracking-tight truncate">{platformConfig.name}</span>
          </>
        )}
      </div>

      {/* Workspace section — only when expanded */}
      {!collapsed && (
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Workspace</p>
          <div className="flex items-center gap-2.5">
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-muted">
              {logoUrl ? (
                <Image src={logoUrl} alt={tenantName} fill className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-bold text-primary">
                  {tenantName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{tenantName}</span>
          </div>
          <div className="mt-2">
            <BranchSwitcher tenantSlug={tenantSlug} compact />
          </div>
        </div>
      )}

      {/* Main nav — scrollable */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV_GROUPS.map((group) => {
          if (!isGroupVisible(group)) return null;

          if (group.type === 'single') {
            const href = `${base}${group.href}`;
            const active = isPathActive(group.href);
            const Icon = group.icon;
            return (
              <div key={group.id} className="relative group/tip">
                <Link
                  href={href}
                  className={cn(
                    'flex items-center rounded-lg transition-colors',
                    collapsed ? 'h-10 w-10 justify-center mx-auto' : 'gap-3 px-3 py-2',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span className="text-sm font-medium">{group.label}</span>}
                </Link>
                {collapsed && (
                  <div
                    className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background opacity-0 transition-opacity group-hover/tip:opacity-100"
                    aria-hidden="true"
                  >
                    {group.label}
                  </div>
                )}
              </div>
            );
          }

          // group type
          const isOpen = expandedGroups.has(group.id);
          const Icon = group.icon;
          const anySubActive = isGroupActive(group);
          return (
            <div key={group.id}>
              <div className="relative group/tip">
                <button
                  type="button"
                  onClick={() => handleGroupIconClick(group.id)}
                  className={cn(
                    'flex w-full items-center rounded-lg transition-colors',
                    collapsed ? 'h-10 w-10 justify-center mx-auto' : 'gap-3 px-3 py-2',
                    'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left text-sm font-medium">{group.label}</span>
                      <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isOpen && 'rotate-180')} />
                    </>
                  )}
                </button>
                {collapsed && (
                  <div
                    className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background opacity-0 transition-opacity group-hover/tip:opacity-100"
                    aria-hidden="true"
                  >
                    {group.label}
                  </div>
                )}
              </div>

              {/* Sub-items */}
              {!collapsed && isOpen && (
                <div className="mt-0.5 ml-4 space-y-0.5 border-l border-border pl-3">
                  {group.items.map((item) => {
                    if (!isSubItemVisible(item)) return null;
                    const href = `${base}${item.href}`;
                    const active = isPathActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={href}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                          active
                            ? 'font-medium text-primary'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        )}
                      >
                        <span className={cn('h-1 w-1 rounded-full shrink-0', active ? 'bg-primary' : 'bg-muted-foreground/40')} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom utility */}
      <div className="shrink-0 border-t border-border px-2 py-2 space-y-0.5">
        {/* Notification bell + mode toggle */}
        <div className={cn('flex items-center gap-1', collapsed ? 'justify-center px-1' : 'px-2 py-1')}>
          <NotificationBell tenantSlug={tenantSlug} />
          <ModeToggle />
        </div>

        {/* User info row — only when expanded */}
        {!collapsed && (
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {userAvatarUrl ? (
                <Image src={userAvatarUrl} alt="" width={32} height={32} className="rounded-full" />
              ) : (
                (userEmail ?? '').charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{userEmail}</p>
              <p className="truncate text-[10px] text-muted-foreground">{userRole ?? ''}</p>
            </div>
          </div>
        )}

        {/* Settings group */}
        <div>
          <div className="relative group/tip">
            <button
              type="button"
              onClick={() => handleGroupIconClick('settings')}
              className={cn(
                'flex w-full items-center rounded-lg transition-colors',
                collapsed ? 'h-10 w-10 justify-center mx-auto' : 'gap-3 px-3 py-2',
                'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Settings className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left text-sm font-medium">Settings</span>
                  <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', expandedGroups.has('settings') && 'rotate-180')} />
                </>
              )}
            </button>
            {collapsed && (
              <div
                className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background opacity-0 transition-opacity group-hover/tip:opacity-100"
                aria-hidden="true"
              >
                Settings
              </div>
            )}
          </div>

          {!collapsed && expandedGroups.has('settings') && (
            <div className="mt-0.5 ml-4 space-y-0.5 border-l border-border pl-3">
              {SETTINGS_ITEMS.map((item) => {
                const href = `${base}${item.href}`;
                const active = isPathActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={href}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                      active
                        ? 'font-medium text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <span className={cn('h-1 w-1 rounded-full shrink-0', active ? 'bg-primary' : 'bg-muted-foreground/40')} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Sign out */}
        <div className="relative group/tip">
          <button
            onClick={onLogout}
            className={cn(
              'flex w-full items-center rounded-lg transition-colors text-muted-foreground hover:bg-accent hover:text-foreground',
              collapsed ? 'h-10 w-10 justify-center mx-auto' : 'gap-3 px-3 py-2',
            )}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Sign out</span>}
          </button>
          {collapsed && (
            <div
              className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background opacity-0 transition-opacity group-hover/tip:opacity-100"
              aria-hidden="true"
            >
              Sign out
            </div>
          )}
        </div>

        {/* Powered by — only when expanded */}
        {!collapsed && platformConfig.showPoweredBy && platformConfig.parentCompanyName && (
          <p className="pt-1 text-center text-[10px] text-muted-foreground/50">
            Powered by {platformConfig.parentCompanyName}
          </p>
        )}
      </div>
    </aside>
  );
}
