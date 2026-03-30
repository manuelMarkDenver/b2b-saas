'use client';

import { useEffect, useState } from 'react';
import { GitBranch, ChevronDown, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { apiFetch } from '@/lib/api';
import { getActiveBranchId, setActiveBranchId } from '@/lib/branch';

type Branch = {
  id: string;
  name: string;
  isDefault: boolean;
  status: string;
};

interface BranchSwitcherProps {
  tenantSlug: string;
}

/**
 * Branch switcher for the header.
 * Renders nothing when the tenant has only 1 branch — invisible at single-branch.
 * Shows a dropdown when >1 branch exists.
 */
export function BranchSwitcher({ tenantSlug }: BranchSwitcherProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActive] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/branches', { tenantSlug })
      .then((r) => r.json())
      .then((data: Branch[]) => {
        const active = branches ?? data;
        setBranches(data);
        const stored = getActiveBranchId(tenantSlug);
        const valid = data.find((b) => b.id === stored && b.status === 'ACTIVE');
        if (valid) {
          setActive(valid.id);
        } else {
          const def = data.find((b) => b.isDefault) ?? data[0];
          if (def) {
            setActive(def.id);
            setActiveBranchId(tenantSlug, def.id);
          }
        }
      })
      .catch(() => {});
  }, [tenantSlug]);

  // Hidden when only 1 branch — invisible at single-branch
  if (branches.length <= 1) return null;

  const activeBranch = branches.find((b) => b.id === activeBranchId);

  function switchBranch(branchId: string) {
    setActive(branchId);
    setActiveBranchId(tenantSlug, branchId);
    // Refresh the page so all panels reload with the new branch context
    window.location.reload();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus:outline-none">
        <GitBranch className="h-3.5 w-3.5 shrink-0" />
        <span className="max-w-[120px] truncate hidden sm:block">
          {activeBranch?.name ?? 'All branches'}
        </span>
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Switch branch</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {branches.filter((b) => b.status === 'ACTIVE').map((branch) => (
          <DropdownMenuItem
            key={branch.id}
            onClick={() => switchBranch(branch.id)}
            className="flex items-center justify-between"
          >
            <span className="truncate">{branch.name}</span>
            {branch.id === activeBranchId && (
              <Check className="h-3.5 w-3.5 shrink-0 text-primary ml-2" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
