'use client';

import { useEffect, useState, useCallback } from 'react';
import { ArrowLeftRight, ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { isStaff } from '@/lib/user-role';
import { getActiveBranchId } from '@/lib/branch';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';

type Sku = { id: string; code: string; name: string };
type Branch = { id: string; name: string };
type Movement = {
  id: string;
  type: string;
  quantity: number;
  note?: string | null;
  reason?: string | null;
  approvalStatus: string;
  createdAt: string;
  branch?: { id: string; name: string } | null;
  sku: { code: string; name: string };
  actor?: { id: string; email: string } | null;
};
type Meta = { total: number; page: number; limit: number; totalPages: number };

const REASON_OPTIONS = [
  { value: 'Receive from supplier', label: 'Receive from supplier' },
  { value: 'Customer return', label: 'Customer return' },
  { value: 'Damaged / Expired', label: 'Damaged / Expired' },
  { value: 'Theft / Loss', label: 'Theft / Loss' },
  { value: 'Shrinkage', label: 'Shrinkage' },
  { value: 'Stock count correction', label: 'Stock count correction' },
  { value: 'Other', label: 'Other' },
] as const;

const REASON_DIRECTION: Record<string, 'IN' | 'DECREASE' | 'CHOOSE'> = {
  'Receive from supplier': 'IN',
  'Customer return': 'IN',
  'Damaged / Expired': 'DECREASE',
  'Theft / Loss': 'DECREASE',
  'Shrinkage': 'DECREASE',
  'Stock count correction': 'CHOOSE',
  'Other': 'CHOOSE',
};

const MOVEMENT_ICON: Record<string, React.ElementType> = {
  IN: ArrowDown,
  OUT: ArrowUp,
  ADJUSTMENT: ArrowLeftRight,
};

const MOVEMENT_COLOR: Record<string, string> = {
  IN: 'text-green-600',
  OUT: 'text-red-500',
  ADJUSTMENT: 'text-yellow-600',
};

function getDisplayType(m: { type: string; quantity: number }): { displayType: string; icon: React.ElementType; color: string } {
  if (m.type === 'ADJUSTMENT' && m.quantity < 0) return { displayType: 'OUT', icon: ArrowUp, color: 'text-red-500' };
  if (m.type === 'ADJUSTMENT' && m.quantity > 0) return { displayType: 'IN', icon: ArrowDown, color: 'text-green-600' };
  return { displayType: m.type, icon: MOVEMENT_ICON[m.type] ?? ArrowLeftRight, color: MOVEMENT_COLOR[m.type] ?? '' };
}

interface InventoryAdjustmentsPanelProps {
  tenantSlug: string;
}

export function InventoryAdjustmentsPanel({ tenantSlug }: InventoryAdjustmentsPanelProps) {
  const { pushToast } = useToast();
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [movMeta, setMovMeta] = useState<Meta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [skuSearch, setSkuSearch] = useState('');
  const [approvalStatus, setApprovalStatus] = useState('');
  const [staffMode, setStaffMode] = useState(false);

  // Form state
  const [formSkuId, setFormSkuId] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formOperation, setFormOperation] = useState('INCREASE');
  const [formSupplier, setFormSupplier] = useState('');
  const [formCustomReason, setFormCustomReason] = useState('');
  const [formQty, setFormQty] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  useEffect(() => { setActiveBranchId(getActiveBranchId(tenantSlug)); }, [tenantSlug]);
  useEffect(() => { setStaffMode(isStaff(tenantSlug)); }, [tenantSlug]);

  useEffect(() => {
    apiFetch('/branches', { tenantSlug }).then(async (r) => {
      if (r.ok) {
        const d = await r.json() as { branches: Branch[] } | Branch[];
        setBranches(Array.isArray(d) ? d : d.branches);
      }
    });
    apiFetch('/skus?limit=100', { tenantSlug }).then(async (r) => {
      if (r.ok) {
        const d = await r.json() as { data: Sku[] } | Sku[];
        setSkus(Array.isArray(d) ? d : d.data);
      } else {
        pushToast({ variant: 'error', title: 'Failed to load items', message: 'Could not fetch SKU list.' });
      }
    });
  }, [tenantSlug, pushToast]);

  const loadMovements = useCallback(async () => {
    if (!activeBranchId) return;
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (approvalStatus) params.set('approvalStatus', approvalStatus);
    if (skuSearch.trim()) params.set('skuSearch', skuSearch.trim());
    const res = await apiFetch(`/inventory/movements?${params}`, { tenantSlug, branchId: activeBranchId });
    if (res.ok) {
      const data = await res.json() as { data: Movement[]; meta: Meta };
      // Show only ADJUSTMENT and IN (receipts/returns) — not OUT/TRANSFER
      setMovements(data.data.filter((m) => m.type === 'ADJUSTMENT' || m.type === 'IN'));
      setMovMeta(data.meta);
    }
  }, [tenantSlug, page, approvalStatus, skuSearch, activeBranchId]);

  useEffect(() => { loadMovements(); }, [loadMovements]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeBranchId) return;
    if (!formSkuId || !formReason || !formQty) return;
    if (!formNote.trim()) {
      pushToast({ variant: 'error', title: 'Notes required', message: "Please explain why you're adjusting stock." });
      return;
    }
    if (formReason === 'Other' && !formCustomReason.trim()) {
      pushToast({ variant: 'error', title: 'Reason required', message: 'Please describe the reason.' });
      return;
    }
    if (formReason === 'Receive from supplier' && !formSupplier.trim()) {
      pushToast({ variant: 'error', title: 'Supplier required', message: 'Please enter the supplier name.' });
      return;
    }
    const direction = REASON_DIRECTION[formReason] ?? 'CHOOSE';
    if (direction === 'CHOOSE' && !formOperation) {
      pushToast({ variant: 'error', title: 'Operation required', message: 'Please select increase or decrease.' });
      return;
    }

    setFormSaving(true);
    try {
      const qty = Math.abs(parseInt(formQty, 10));
      // Derive type and signed quantity from reason
      let apiType: string;
      let apiQty: number;
      let apiReason: string;

      if (formReason === 'Receive from supplier') {
        apiType = 'IN';
        apiQty = qty;
        apiReason = `Receive from supplier: ${formSupplier.trim()}`;
      } else if (formReason === 'Customer return') {
        apiType = 'IN';
        apiQty = qty;
        apiReason = 'Customer return';
      } else if (formReason === 'Damaged / Expired') {
        apiType = 'ADJUSTMENT';
        apiQty = -qty;
        apiReason = 'Damaged / Expired';
      } else if (formReason === 'Theft / Loss') {
        apiType = 'ADJUSTMENT';
        apiQty = -qty;
        apiReason = 'Theft / Loss';
      } else if (formReason === 'Shrinkage') {
        apiType = 'ADJUSTMENT';
        apiQty = -qty;
        apiReason = 'Shrinkage';
      } else if (formReason === 'Stock count correction') {
        apiType = 'ADJUSTMENT';
        apiQty = formOperation === 'DECREASE' ? -qty : qty;
        apiReason = 'Stock count correction';
      } else {
        // Other
        apiType = 'ADJUSTMENT';
        apiQty = formOperation === 'DECREASE' ? -qty : qty;
        apiReason = `Other: ${formCustomReason.trim()}`;
      }

      const res = await apiFetch('/inventory/movements', {
        method: 'POST',
        tenantSlug,
        branchId: activeBranchId,
        body: JSON.stringify({
          skuId: formSkuId,
          type: apiType,
          quantity: apiQty,
          referenceType: 'MANUAL',
          reason: apiReason,
          note: formNote.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        pushToast({ variant: 'error', title: 'Failed', message: err.message ?? 'Unknown error' });
      } else {
        const d = await res.json() as { approvalStatus: string };
        const isPending = d.approvalStatus === 'PENDING';
        pushToast({
          variant: isPending ? 'info' : 'success',
          title: isPending ? 'Sent for approval' : 'Adjustment applied',
          message: isPending ? 'Your adjustment is pending admin approval.' : 'Adjustment logged successfully.',
        });
        setFormSkuId('');
        setFormReason('');
        setFormOperation('INCREASE');
        setFormSupplier('');
        setFormCustomReason('');
        setFormQty('');
        setFormNote('');
        loadMovements();
      }
    } finally {
      setFormSaving(false);
    }
  }

  async function handleApprove(id: string) {
    const res = await apiFetch(`/inventory/movements/${id}/approve`, { method: 'PATCH', tenantSlug, branchId: activeBranchId });
    if (res.ok) {
      pushToast({ variant: 'success', title: 'Approved', message: 'Adjustment has been approved.' });
      loadMovements();
    }
  }

  async function handleReject(id: string) {
    const res = await apiFetch(`/inventory/movements/${id}/reject`, { method: 'PATCH', tenantSlug, branchId: activeBranchId });
    if (res.ok) {
      pushToast({ variant: 'info', title: 'Rejected', message: 'Adjustment has been rejected.' });
      loadMovements();
    }
  }

  const activeBranch = branches.find((b) => b.id === activeBranchId);
  const direction = formReason ? (REASON_DIRECTION[formReason] ?? null) : null;
  const showOperation = direction === 'CHOOSE';
  const showSupplier = formReason === 'Receive from supplier';
  const showCustomReason = formReason === 'Other';

  // Quantity indicator
  let qtyIndicator: string | null = null;
  if (direction === 'IN') qtyIndicator = '+ Adds stock';
  else if (direction === 'DECREASE') qtyIndicator = '- Subtracts stock';
  else if (direction === 'CHOOSE') qtyIndicator = formOperation === 'DECREASE' ? '- Subtracts stock' : '+ Adds stock';

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="rounded-lg border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Log Adjustment</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!activeBranchId && (
            <p className="text-sm text-amber-600">Select a branch to adjust stock.</p>
          )}
          {activeBranchId && (
            <p className="text-xs text-muted-foreground">
              Adjusting stock for: <span className="font-medium text-foreground">{activeBranch?.name}</span>
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Item *</label>
              <Select value={formSkuId} onValueChange={setFormSkuId} disabled={!activeBranchId}>
                <SelectTrigger><SelectValue placeholder="Select an item…" /></SelectTrigger>
                <SelectContent>
                  {skus.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reason *</label>
              <Select value={formReason} onValueChange={setFormReason} disabled={!activeBranchId}>
                <SelectTrigger><SelectValue placeholder="Select a reason…" /></SelectTrigger>
                <SelectContent>
                  {REASON_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {showSupplier && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Supplier *</label>
              <input
                type="text"
                required
                disabled={!activeBranchId}
                value={formSupplier}
                onChange={(e) => setFormSupplier(e.target.value)}
                placeholder="Enter supplier name"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          {showOperation && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Operation *</label>
              <Select value={formOperation} onValueChange={setFormOperation} disabled={!activeBranchId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCREASE">Increase stock</SelectItem>
                  <SelectItem value="DECREASE">Decrease stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {showCustomReason && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Actual reason *</label>
              <input
                type="text"
                required
                disabled={!activeBranchId}
                value={formCustomReason}
                onChange={(e) => setFormCustomReason(e.target.value)}
                placeholder="e.g. Promotional giveaway"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Quantity *
                {qtyIndicator && (
                  <span className={`ml-2 text-xs font-normal ${qtyIndicator.startsWith('+') ? 'text-green-600' : 'text-red-500'}`}>
                    {qtyIndicator}
                  </span>
                )}
              </label>
              <input
                type="number"
                min={1}
                required
                disabled={!activeBranchId}
                value={formQty}
                onChange={(e) => setFormQty(e.target.value)}
                placeholder="Enter quantity"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Notes *</label>
              <input
                type="text"
                required
                disabled={!activeBranchId}
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder="Explain why you're adjusting stock"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <Button type="submit" disabled={!activeBranchId || !formSkuId || !formReason || !formQty || !formNote.trim() || formSaving}>
            {formSaving ? 'Saving…' : 'Submit Adjustment'}
          </Button>
        </form>
      </div>

      {/* History */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <input
            type="search"
            placeholder="Search item…"
            className="h-8 rounded-md border border-input bg-background px-3 text-sm w-52"
            value={skuSearch}
            onChange={(e) => { setSkuSearch(e.target.value); setPage(1); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); loadMovements(); } }}
          />
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            value={approvalStatus}
            onChange={(e) => { setApprovalStatus(e.target.value); setPage(1); }}
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <Button size="sm" onClick={() => { setPage(1); loadMovements(); }}>Apply</Button>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <div className="min-w-[620px]">
            <div className="grid gap-3 border-b bg-muted/40 px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground grid-cols-[1fr_60px_1fr_1fr_130px_100px]">
              <span>Item</span>
              <span className="text-right">Qty</span>
              <span>Reason</span>
              <span>Note</span>
              <span>Actioned By</span>
              <span className="text-right">Date</span>
            </div>

            {movements.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                Showing latest adjustments
              </div>
            ) : (
              <div className="divide-y">
                {movements.map((m) => {
                  const { displayType, icon: Icon, color } = getDisplayType(m);
                  const isPending = m.approvalStatus === 'PENDING';
                  return (
                    <div
                      key={m.id}
                      className={`grid items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/30 grid-cols-[1fr_60px_1fr_1fr_130px_100px] ${isPending ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
                          <Icon className={`h-3.5 w-3.5 ${color}`} />
                        </div>
                        <div className="min-w-0">
                          <span className="block truncate text-xs font-medium">{m.sku.name}</span>
                          {isPending && <span className="text-[10px] font-semibold text-amber-600">Pending</span>}
                        </div>
                      </div>
                      <div className={`text-right font-mono text-sm font-bold ${m.quantity > 0 ? 'text-green-600' : m.quantity < 0 ? 'text-red-500' : ''}`}>
                        {m.quantity > 0 ? '+ ' : m.quantity < 0 ? '- ' : ''}{Math.abs(m.quantity)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs text-muted-foreground">{m.reason ?? '—'}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs text-muted-foreground">{m.note ?? '—'}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs text-muted-foreground">{m.actor?.email ?? '—'}</div>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-right text-xs text-muted-foreground">
                          {new Date(m.createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                        {!staffMode && isPending && (
                          <>
                            <button type="button" onClick={() => handleApprove(m.id)} className="rounded px-1.5 py-0.5 text-[10px] font-medium text-green-700 bg-green-100 hover:bg-green-200">Approve</button>
                            <button type="button" onClick={() => handleReject(m.id)} className="rounded px-1.5 py-0.5 text-[10px] font-medium text-red-700 bg-red-100 hover:bg-red-200">Reject</button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {movMeta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <span className="text-xs text-muted-foreground">Page {movMeta.page} of {movMeta.totalPages}</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</Button>
                  <Button variant="outline" size="icon" disabled={page >= movMeta.totalPages} onClick={() => setPage((p) => p + 1)}>›</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
