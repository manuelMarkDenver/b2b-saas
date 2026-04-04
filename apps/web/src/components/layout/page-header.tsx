'use client';

import { getActiveBranchId } from '@/lib/branch';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Branch = { id: string; name: string; type: string };

const TYPE_LABELS: Record<string, string> = {
  STANDARD: 'Standard',
  PRODUCTION: 'Production',
  DISTRIBUTION: 'Distribution',
  RETAIL: 'Retail',
  WAREHOUSE: 'Warehouse',
};

// Stable color palette — assigned by branch index (consistent across sessions)
const BRANCH_COLORS = [
  'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/40',
  'bg-violet-100 text-violet-800 border border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700/40',
  'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40',
  'bg-orange-100 text-orange-800 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700/40',
  'bg-pink-100 text-pink-800 border border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-700/40',
];

const ALL_BRANCHES_COLOR =
  'bg-secondary text-secondary-foreground border border-border';

interface PageHeaderProps {
  tenantSlug: string;
  title: string;
  description?: string;
}

export function PageHeader({ tenantSlug, title, description }: PageHeaderProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  // localStorage is unavailable during SSR — read after mount to avoid hydration mismatch
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  useEffect(() => { setActiveBranchId(getActiveBranchId(tenantSlug)); }, [tenantSlug]);

  useEffect(() => {
    apiFetch('/branches', { tenantSlug }).then(async (res) => {
      if (res.ok) {
        const d = await res.json() as { branches: Branch[] } | Branch[];
        setBranches(Array.isArray(d) ? d : d.branches);
      }
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
  const showBranchType = activeBranch;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2.5">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {branches.length > 0 && (
          <>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeColor}`}
            >
              {badgeLabel}
            </span>
            {showBranchType && (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700/40">
                {TYPE_LABELS[activeBranch.type] ?? activeBranch.type}
              </span>
            )}
          </>
        )}
      </div>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
