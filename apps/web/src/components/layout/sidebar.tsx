'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  CreditCard,
  Boxes,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TenantFeatures = {
  inventory?: boolean;
  orders?: boolean;
  payments?: boolean;
  marketplace?: boolean;
};

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  featureKey?: keyof TenantFeatures;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '', icon: LayoutDashboard },
  { label: 'Inventory', href: '/inventory', icon: Boxes, featureKey: 'inventory' },
  { label: 'Orders', href: '/orders', icon: ShoppingCart, featureKey: 'orders' },
  { label: 'Payments', href: '/payments', icon: CreditCard, featureKey: 'payments' },
  { label: 'Catalog', href: '/catalog', icon: Package },
  { label: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  tenantSlug: string;
  features: TenantFeatures;
}

export function Sidebar({ tenantSlug, features }: SidebarProps) {
  const pathname = usePathname();
  const base = `/t/${tenantSlug}`;

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.featureKey) return true;
    return features[item.featureKey] !== false;
  });

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-background">
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
                'group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
