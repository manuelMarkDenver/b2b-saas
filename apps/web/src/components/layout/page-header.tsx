'use client';

import { getActiveBranchId } from '@/lib/branch';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Branch = { id: string; name: string };

// Stable color palette — assigned by branch index (consistent across sessions)
const BRANCH_COLORS = [
  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
];

const ALL_BRANCHES_COLOR =
  'bg-muted text-muted-foreground';

interface PageHeaderProps {
  tenantSlug: string;
  title: string;
  description?: string;
}

export function PageHeader({ tenantSlug, title, description }: PageHeaderProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const activeBranchId = getActiveBranchId(tenantSlug);

  useEffect(() => {
    apiFetch('/branches', { tenantSlug }).then(async (res) => {
      if (res.ok) setBranches(await res.json());
    });
  }, [tenantSlug]);

  const activeBranch = branches.find((b) => b.id === activeBranchId);
  const branchIndex = activeBranch
    ? branches.findIndex((b) => b.id === activeBranchId)
    : -1;
  const badgeColor =
    branchIndex >= 0
      ? BRANCH_COLORS[branchIndex % BRANCH_COLORS.length]
      : ALL_BRANCHES_COLOR;
  const badgeLabel = activeBranch ? activeBranch.name : 'All Branches';

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {branches.length > 0 && (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeColor}`}
          >
            {badgeLabel}
          </span>
        )}
      </div>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
