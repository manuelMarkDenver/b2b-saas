'use client';

import { useEffect, useState } from 'react';
import { GitBranch, TrendingUp, ShoppingCart, CreditCard, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { DateRange } from './date-range-picker';

type BranchRow = {
  id: string;
  name: string;
  isDefault: boolean;
  ordersInRange: number;
  ordersToday: number;
  pendingPayments: number;
  revenueRangeCents: number;
};

function formatCents(cents: number) {
  return `₱${(cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface Props {
  tenantSlug: string;
  range: DateRange;
  onSelectBranch: (branchId: string | null) => void;
  activeBranchId: string | null;
}

export function BranchBreakdown({ tenantSlug, range, onSelectBranch, activeBranchId }: Props) {
  const [rows, setRows] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/dashboard/branches?from=${range.from}&to=${range.to}`, { tenantSlug, branchId: null })
      .then((r) => r.json())
      .then((data: BranchRow[]) => setRows(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenantSlug, range]);

  // Only show when there are multiple branches
  if (!loading && rows.length <= 1) return null;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <GitBranch className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Branch breakdown</h3>
        <span className="ml-auto text-xs text-muted-foreground">Click a row to drill into that branch</span>
      </div>

      {loading ? (
        <div className="divide-y divide-border">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-12 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Branch</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> Orders today</span>
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground hidden sm:table-cell">
                  <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Orders (range)</span>
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground hidden md:table-cell">
                  <span className="inline-flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Pending pay.</span>
                </th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><CreditCard className="h-3 w-3" /> Revenue (range)</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* "All branches" row */}
              <tr
                onClick={() => onSelectBranch(null)}
                className={`border-b border-border cursor-pointer transition-colors hover:bg-muted/40 ${
                  activeBranchId === null ? 'bg-primary/5' : ''
                }`}
              >
                <td className="px-4 py-3 font-medium">
                  <span className="flex items-center gap-2">
                    {activeBranchId === null && (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    )}
                    All branches
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {rows.reduce((s, r) => s + r.ordersToday, 0)}
                </td>
                <td className="px-4 py-3 text-right hidden sm:table-cell">
                  {rows.reduce((s, r) => s + r.ordersInRange, 0)}
                </td>
                <td className="px-4 py-3 text-right hidden md:table-cell">
                  {rows.reduce((s, r) => s + r.pendingPayments, 0)}
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {formatCents(rows.reduce((s, r) => s + r.revenueRangeCents, 0))}
                </td>
              </tr>

              {/* Per-branch rows */}
              {rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onSelectBranch(row.id)}
                  className={`border-b border-border last:border-0 cursor-pointer transition-colors hover:bg-muted/40 ${
                    activeBranchId === row.id ? 'bg-primary/5' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 pl-4">
                      {activeBranchId === row.id && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      )}
                      {row.name}
                      {row.isDefault && (
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          Default
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{row.ordersToday}</td>
                  <td className="px-4 py-3 text-right hidden sm:table-cell">{row.ordersInRange}</td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    {row.pendingPayments > 0 ? (
                      <span className="text-destructive font-medium">{row.pendingPayments}</span>
                    ) : (
                      row.pendingPayments
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{formatCents(row.revenueRangeCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
