'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const SEGMENT_LABELS: Record<string, string> = {
  inventory: 'Inventory',
  orders: 'Orders',
  payments: 'Payments',
  catalog: 'Catalog',
  settings: 'Settings',
  team: 'Team & Permissions',
  profile: 'Profile',
};

interface BreadcrumbsProps {
  tenantSlug: string;
  tenantName: string;
}

export function Breadcrumbs({ tenantSlug, tenantName }: BreadcrumbsProps) {
  const pathname = usePathname();
  const base = `/t/${tenantSlug}`;

  // Build crumbs from path segments after /t/[tenantSlug]
  const rest = pathname.slice(base.length).split('/').filter(Boolean);

  const crumbs: { label: string; href: string }[] = [
    { label: tenantName, href: base },
  ];

  rest.forEach((segment, i) => {
    crumbs.push({
      label: SEGMENT_LABELS[segment] ?? segment,
      href: `${base}/${rest.slice(0, i + 1).join('/')}`,
    });
  });

  if (crumbs.length <= 1) return null;

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.href} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
            {isLast ? (
              <span className={cn('font-medium text-foreground')}>{crumb.label}</span>
            ) : (
              <Link href={crumb.href} className="hover:text-foreground transition-colors">
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
