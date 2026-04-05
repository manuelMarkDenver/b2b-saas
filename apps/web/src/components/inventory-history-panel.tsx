'use client';

import { useEffect, useState, useCallback } from 'react';
import { ArrowDown, ArrowUp, ArrowLeftRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { getActiveBranchId } from '@/lib/branch';
import { apiFetch } from '@/lib/api';
import { ProductThumb } from '@/components/product-thumb';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

type Movement = {
  id: string;
  type: string;
  quantity: number;
  note?: string | null;
  reason?: string | null;
  approvalStatus: string;
  createdAt: string;
  branch?: { id: string; name: string } | null;
  sku: { code: string; name: string; imageUrl?: string | null };
  actor?: { id: string; email: string } | null;
};
type Meta = { total: number; page: number; limit: number; totalPages: number };

const MOVEMENT_ICON: Record<string, React.ElementType> = {
  IN: ArrowDown,
  OUT: ArrowUp,
  ADJUSTMENT: ArrowLeftRight,
  TRANSFER_IN: ArrowLeftRight,
  TRANSFER_OUT: ArrowLeftRight,
};

const MOVEMENT_COLOR: Record<string, string> = {
  IN: 'text-green-600',
  OUT: 'text-red-500',
  ADJUSTMENT: 'text-yellow-600',
  TRANSFER_IN: 'text-blue-600',
  TRANSFER_OUT: 'text-blue-600',
};

function getDisplayType(m: Movement): { displayType: string; icon: React.ElementType; color: string } {
  if (m.type === 'ADJUSTMENT' && m.quantity < 0) return { displayType: 'OUT', icon: ArrowUp, color: 'text-red-500' };
  if (m.type === 'ADJUSTMENT' && m.quantity > 0) return { displayType: 'IN', icon: ArrowDown, color: 'text-green-600' };
  return { displayType: m.type, icon: MOVEMENT_ICON[m.type] ?? ArrowLeftRight, color: MOVEMENT_COLOR[m.type] ?? '' };
}

interface InventoryHistoryPanelProps {
  tenantSlug: string;
}

export function InventoryHistoryPanel({ tenantSlug }: InventoryHistoryPanelProps) {
  const { pushToast } = useToast();
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [movMeta, setMovMeta] = useState<Meta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [skuSearch, setSkuSearch] = useState('');
  const [approvalStatus, setApprovalStatus] = useState('');

  useEffect(() => { setActiveBranchId(getActiveBranchId(tenantSlug)); }, [tenantSlug]);

  const loadMovements = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (approvalStatus) params.set('approvalStatus', approvalStatus);
    if (skuSearch.trim()) params.set('skuSearch', skuSearch.trim());
    const res = await apiFetch(`/inventory/movements?${params}`, { tenantSlug, branchId: activeBranchId ?? undefined });
    if (res.ok) {
      const data = await res.json() as { data: Movement[]; meta: Meta };
      setMovements(data.data);
      setMovMeta(data.meta);
    } else {
      pushToast({ variant: 'error', title: 'Failed to load movements', message: '' });
    }
  }, [tenantSlug, page, approvalStatus, skuSearch, activeBranchId, pushToast]);

  useEffect(() => { loadMovements(); }, [loadMovements]);

  async function handleApprove(id: string) {
    const res = await apiFetch(`/inventory/movements/${id}/approve`, { method: 'PATCH', tenantSlug, branchId: activeBranchId });
    if (res.ok) {
      pushToast({ variant: 'success', title: 'Approved', message: '' });
      loadMovements();
    }
  }

  async function handleReject(id: string) {
    const res = await apiFetch(`/inventory/movements/${id}/reject`, { method: 'PATCH', tenantSlug, branchId: activeBranchId });
    if (res.ok) {
      pushToast({ variant: 'info', title: 'Rejected', message: '' });
      loadMovements();
    }
  }

  if (!activeBranchId) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Select a branch to view inventory history.</p>
        </div>
        {/* Show all-branches view below the prompt */}
        <AllBranchesHistory tenantSlug={tenantSlug} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <MovementsTable tenantSlug={tenantSlug} activeBranchId={activeBranchId} />
    </div>
  );
}

function AllBranchesHistory({ tenantSlug }: { tenantSlug: string }) {
  const { pushToast } = useToast();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [movMeta, setMovMeta] = useState<Meta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [skuSearch, setSkuSearch] = useState('');
  const [approvalStatus, setApprovalStatus] = useState('');

  const loadMovements = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (approvalStatus) params.set('approvalStatus', approvalStatus);
    if (skuSearch.trim()) params.set('skuSearch', skuSearch.trim());
    const res = await apiFetch(`/inventory/movements?${params}`, { tenantSlug, branchId: null });
    if (res.ok) {
      const data = await res.json() as { data: Movement[]; meta: Meta };
      setMovements(data.data);
      setMovMeta(data.meta);
    } else {
      pushToast({ variant: 'error', title: 'Failed to load movements', message: '' });
    }
  }, [tenantSlug, page, approvalStatus, skuSearch, pushToast]);

  useEffect(() => { loadMovements(); }, [loadMovements]);

  async function handleApprove(id: string) {
    const res = await apiFetch(`/inventory/movements/${id}/approve`, { method: 'PATCH', tenantSlug });
    if (res.ok) {
      pushToast({ variant: 'success', title: 'Approved', message: '' });
      loadMovements();
    }
  }

  async function handleReject(id: string) {
    const res = await apiFetch(`/inventory/movements/${id}/reject`, { method: 'PATCH', tenantSlug });
    if (res.ok) {
      pushToast({ variant: 'info', title: 'Rejected', message: '' });
      loadMovements();
    }
  }

  return (
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
          <div className="grid gap-3 border-b bg-muted/40 px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground grid-cols-[1fr_90px_60px_1fr_1fr_130px_100px_100px]">
            <span>Item</span>
            <span>Type</span>
            <span className="text-right">Qty</span>
            <span>Note / Reason</span>
            <span>Branch</span>
            <span>Actioned By</span>
            <span className="text-right">Date</span>
            <span className="text-right">Actions</span>
          </div>

          {movements.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">No movements yet.</div>
          ) : (
            <div className="divide-y">
              {movements.map((m) => {
                const { displayType, icon: Icon, color } = getDisplayType(m);
                const isPending = m.approvalStatus === 'PENDING';
                return (
                  <div
                    key={m.id}
                    className={`grid items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/30 grid-cols-[1fr_90px_60px_1fr_1fr_130px_100px_100px] ${isPending ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <ProductThumb src={m.sku.imageUrl} label={`${m.sku.code} ${m.sku.name}`} size={32} className="rounded-lg shrink-0" />
                      <div className="min-w-0">
                        <span className="block truncate text-xs font-medium">{m.sku.name}</span>
                        {isPending && <span className="text-[10px] font-semibold text-amber-600">Pending</span>}
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 ${color}`}>
                      <Icon className="h-3.5 w-3.5" />
                      <span className="text-xs font-semibold">{displayType}</span>
                    </div>
                    <div className={`text-right font-mono text-sm font-bold ${m.quantity > 0 ? 'text-green-600' : m.quantity < 0 ? 'text-red-500' : ''}`}>
                      {m.quantity > 0 ? '+ ' : m.quantity < 0 ? '- ' : ''}{Math.abs(m.quantity)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs text-muted-foreground">{m.note ?? m.reason ?? '—'}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs text-muted-foreground">{m.branch?.name ?? '—'}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs text-muted-foreground">{m.actor?.email ?? '—'}</div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {new Date(m.createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                    <div className="flex justify-end gap-1">
                      {isPending ? (
                        <>
                          <button type="button" onClick={() => handleApprove(m.id)} className="rounded px-2 py-0.5 text-[11px] font-medium text-green-700 bg-green-100 hover:bg-green-200">Approve</button>
                          <button type="button" onClick={() => handleReject(m.id)} className="rounded px-2 py-0.5 text-[11px] font-medium text-red-700 bg-red-100 hover:bg-red-200">Reject</button>
                        </>
                      ) : (
                        <span className={`text-[10px] font-medium ${m.approvalStatus === 'APPROVED' ? 'text-green-600' : 'text-red-500'}`}>
                          {m.approvalStatus === 'APPROVED' ? 'Approved' : 'Rejected'}
                        </span>
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
  );
}

function MovementsTable({ tenantSlug, activeBranchId }: { tenantSlug: string; activeBranchId: string }) {
  const { pushToast } = useToast();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [movMeta, setMovMeta] = useState<Meta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [skuSearch, setSkuSearch] = useState('');
  const [approvalStatus, setApprovalStatus] = useState('');

  const loadMovements = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (approvalStatus) params.set('approvalStatus', approvalStatus);
    if (skuSearch.trim()) params.set('skuSearch', skuSearch.trim());
    const res = await apiFetch(`/inventory/movements?${params}`, { tenantSlug, branchId: activeBranchId });
    if (res.ok) {
      const data = await res.json() as { data: Movement[]; meta: Meta };
      setMovements(data.data);
      setMovMeta(data.meta);
    } else {
      pushToast({ variant: 'error', title: 'Failed to load movements', message: '' });
    }
  }, [tenantSlug, page, approvalStatus, skuSearch, activeBranchId, pushToast]);

  useEffect(() => { loadMovements(); }, [loadMovements]);

  async function handleApprove(id: string) {
    const res = await apiFetch(`/inventory/movements/${id}/approve`, { method: 'PATCH', tenantSlug, branchId: activeBranchId });
    if (res.ok) {
      pushToast({ variant: 'success', title: 'Approved', message: '' });
      loadMovements();
    }
  }

  async function handleReject(id: string) {
    const res = await apiFetch(`/inventory/movements/${id}/reject`, { method: 'PATCH', tenantSlug, branchId: activeBranchId });
    if (res.ok) {
      pushToast({ variant: 'info', title: 'Rejected', message: '' });
      loadMovements();
    }
  }

  return (
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
          <div className="grid gap-3 border-b bg-muted/40 px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground grid-cols-[1fr_90px_60px_1fr_130px_100px_100px]">
            <span>Item</span>
            <span>Type</span>
            <span className="text-right">Qty</span>
            <span>Note / Reason</span>
            <span>Actioned By</span>
            <span className="text-right">Date</span>
            <span className="text-right">Actions</span>
          </div>

          {movements.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">No movements yet.</div>
          ) : (
            <div className="divide-y">
              {movements.map((m) => {
                const { displayType, icon: Icon, color } = getDisplayType(m);
                const isPending = m.approvalStatus === 'PENDING';
                return (
                  <div
                    key={m.id}
                    className={`grid items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted/30 grid-cols-[1fr_90px_60px_1fr_130px_100px_100px] ${isPending ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <ProductThumb src={m.sku.imageUrl} label={`${m.sku.code} ${m.sku.name}`} size={32} className="rounded-lg shrink-0" />
                      <div className="min-w-0">
                        <span className="block truncate text-xs font-medium">{m.sku.name}</span>
                        {isPending && <span className="text-[10px] font-semibold text-amber-600">Pending</span>}
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 ${color}`}>
                      <Icon className="h-3.5 w-3.5" />
                      <span className="text-xs font-semibold">{displayType}</span>
                    </div>
                    <div className={`text-right font-mono text-sm font-bold ${m.quantity > 0 ? 'text-green-600' : m.quantity < 0 ? 'text-red-500' : ''}`}>
                      {m.quantity > 0 ? '+ ' : m.quantity < 0 ? '- ' : ''}{Math.abs(m.quantity)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs text-muted-foreground">{m.note ?? m.reason ?? '—'}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs text-muted-foreground">{m.actor?.email ?? '—'}</div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      {new Date(m.createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                    <div className="flex justify-end gap-1">
                      {isPending ? (
                        <>
                          <button type="button" onClick={() => handleApprove(m.id)} className="rounded px-2 py-0.5 text-[11px] font-medium text-green-700 bg-green-100 hover:bg-green-200">Approve</button>
                          <button type="button" onClick={() => handleReject(m.id)} className="rounded px-2 py-0.5 text-[11px] font-medium text-red-700 bg-red-100 hover:bg-red-200">Reject</button>
                        </>
                      ) : (
                        <span className={`text-[10px] font-medium ${m.approvalStatus === 'APPROVED' ? 'text-green-600' : 'text-red-500'}`}>
                          {m.approvalStatus === 'APPROVED' ? 'Approved' : 'Rejected'}
                        </span>
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
  );
}
