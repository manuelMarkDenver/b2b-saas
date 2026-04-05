'use client';

import { useEffect, useRef, useState } from 'react';
import { GitBranch, ChevronDown, Check, Search } from 'lucide-react';
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
import { cn } from '@/lib/utils';

type Branch = {
  id: string;
  name: string;
  isDefault: boolean;
  status: string;
  type: string;
};

const TYPE_LABELS: Record<string, string> = {
  STANDARD: 'Standard',
  PRODUCTION: 'Production',
  DISTRIBUTION: 'Distribution',
  RETAIL: 'Retail',
  WAREHOUSE: 'Warehouse',
};

interface BranchSwitcherProps {
  tenantSlug: string;
  /** When true, renders with dark sidebar–friendly styling */
  compact?: boolean;
}

// Thresholds for progressive disclosure
const ACCORDION_THRESHOLD = 5; // collapse list when >5 branches
const SEARCH_THRESHOLD = 7;    // show search when >7 branches

/**
 * Branch switcher for the header.
 * - Hidden entirely for single-branch tenants
 * - "All branches" option resets to tenant-wide scope (no x-branch-id sent)
 * - Does NOT auto-select the default branch on first load — starts at "All branches"
 * - Accordion collapses branch list when >5 branches
 * - Search bar appears when >7 branches
 */
export function BranchSwitcher({ tenantSlug, compact }: BranchSwitcherProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActive] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  function loadBranches() {
    apiFetch('/branches', { tenantSlug, branchId: null })
      .then((r) => r.json())
      .then((data: { branches: Branch[] } | Branch[]) => {
        const raw = Array.isArray(data) ? data : data.branches;
        const active = raw.filter((b) => b.status === 'ACTIVE');
        setBranches(active);

        // Restore from localStorage — but if nothing stored, stay on "All branches"
        const stored = getActiveBranchId(tenantSlug);
        const valid = active.find((b) => b.id === stored);
        if (valid) {
          setActive(valid.id);
        }
        // No fallback to default — "All branches" is the correct initial state

        // Collapse by default when many branches
        if (active.length > ACCORDION_THRESHOLD) {
          setExpanded(false);
        }
      })
      .catch(() => {});
  }

  useEffect(() => { loadBranches(); }, [tenantSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeBranch = branches.find((b) => b.id === activeBranchId);
  const showSearch = branches.length > SEARCH_THRESHOLD;
  const showAccordion = branches.length > ACCORDION_THRESHOLD;

  const filteredBranches = search.trim()
    ? branches.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()))
    : branches;

  function switchBranch(branchId: string | null) {
    setActive(branchId);
    setActiveBranchId(tenantSlug, branchId);
    window.location.reload();
  }

  if (branches.length <= 1) return null;

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) loadBranches(); else setSearch(''); }}>
      <DropdownMenuTrigger
        className={cn(
          'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm focus:outline-none',
          compact
            ? 'w-full text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <GitBranch className="h-3.5 w-3.5 shrink-0" />
        <span className={cn('truncate', compact ? 'flex-1 text-left' : 'max-w-[120px] hidden sm:block')}>
          {activeBranch?.name ?? 'All branches'}
        </span>
        {activeBranch && (
          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground dark:bg-muted/80">
            {TYPE_LABELS[activeBranch.type] ?? activeBranch.type}
          </span>
        )}
        <ChevronDown className="h-3 w-3 shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Branch context</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* All branches option */}
        <DropdownMenuItem
          onClick={() => switchBranch(null)}
          className="flex items-center justify-between"
        >
          <span className="font-medium">All branches</span>
          {activeBranchId === null && (
            <Check className="h-3.5 w-3.5 shrink-0 text-primary ml-2" />
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Accordion toggle for large branch lists */}
        {showAccordion && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setExpanded((v) => !v);
              if (!expanded) setTimeout(() => searchRef.current?.focus(), 50);
            }}
            className="flex w-full items-center justify-between px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <span>{expanded ? 'Collapse' : `Show ${branches.length} branches`}</span>
            <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
          </button>
        )}

        {/* Search — only when >7 branches */}
        {expanded && showSearch && (
          <div className="px-2 pb-1">
            <div className="flex items-center gap-1.5 rounded-md border border-input bg-muted px-2 py-1">
              <Search className="h-3 w-3 text-muted-foreground shrink-0" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search branches…"
                className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}

        {/* Branch list */}
        {expanded && (
          filteredBranches.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">No branches found</div>
          ) : (
            filteredBranches.map((branch) => (
              <DropdownMenuItem
                key={branch.id}
                onClick={() => switchBranch(branch.id)}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                  <span className="truncate">{branch.name}</span>
                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground dark:bg-muted/80">
                    {TYPE_LABELS[branch.type] ?? branch.type}
                  </span>
                  {branch.isDefault && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">(default)</span>
                  )}
                </span>
                {branch.id === activeBranchId && (
                  <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                )}
              </DropdownMenuItem>
            ))
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
