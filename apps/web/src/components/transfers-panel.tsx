'use client';

import { useEffect, useState } from 'react';
import { Plus, ArrowRight, Package, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { DateRangePicker, presetToRange, type DateRange } from '@/components/dashboard/date-range-picker';

type Branch = { id: string; name: string; isDefault: boolean; status: string };
type Sku = { id: string; code: string; name: string; stockOnHand: number };
type TransferItem = { skuId: string; quantity: number; sku: { id: string; code: string; name: string } };
type Transfer = {
  id: string;
  status: string;
  createdAt: string;
  fromBranch: { id: string; name: string } | null;
  toBranch: { id: string; name: string };
  requestedBy: { id: string; email: string };
  note: string | null;
  items: TransferItem[];
};

type Meta = { total: number; page: number; limit: number; totalPages: number };

type LineItem = { skuId: string; quantity: number };

interface TransfersPanelProps {
  tenantSlug: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'PENDING',
  APPROVED: 'IN_TRANSIT',
  FULFILLED: 'RECEIVED',
  REJECTED: 'CANCELLED',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  APPROVED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  FULFILLED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export function TransfersPanel({ tenantSlug }: TransfersPanelProps) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [branches, setBranches] = useState<Branch[]>([]);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [branchIds, setBranchIds] = useState<string[]>([]);

  // Branch stock for SKU filtering
  const [branchStock, setBranchStock] = useState<Record<string, number>>({});

  // Filters
  const [dateRange, setDateRange] = useState<DateRange>(() => presetToRange('30d'));
  const [fromBranchFilter, setFromBranchFilter] = useState('');
  const [toBranchFilter, setToBranchFilter] = useState('');
  const [skuSearch, setSkuSearch] = useState('');
  const [page, setPage] = useState(1);

  // New transfer dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fromBranchId, setFromBranchId] = useState('');
  const [toBranchId, setToBranchId] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<LineItem[]>([{ skuId: '', quantity: 1 }]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canManage = userRole === 'OWNER' || userRole === 'ADMIN';

  async function load(p = page, dr = dateRange, fbf = fromBranchFilter, tbf = toBranchFilter, ss = skuSearch) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), from: dr.from, to: dr.to });
    if (fbf) params.set('fromBranchId', fbf);
    if (tbf) params.set('toBranchId', tbf);
    if (ss.trim()) params.set('skuSearch', ss.trim());

    const [trRes, brRes, skuRes, memRes] = await Promise.all([
      apiFetch(`/transfers?${params}`, { tenantSlug }),
      apiFetch('/branches', { tenantSlug }),
      apiFetch('/skus?limit=1000', { tenantSlug }),
      apiFetch('/memberships', { tenantSlug }),
    ]);
    if (trRes.ok) {
      const d = await trRes.json() as { data: Transfer[]; meta: Meta };
      setTransfers(d.data ?? []);
      if (d.meta) setMeta(d.meta);
    } else setError('Failed to load transfers');
    if (brRes.ok) {
      const d = await brRes.json() as { branches: Branch[] } | Branch[];
      const all = Array.isArray(d) ? d : d.branches;
      setBranches(all.filter((b) => b.status === 'ACTIVE'));
    }
    if (skuRes.ok) {
      const data = await skuRes.json();
      setSkus(Array.isArray(data) ? data : (data.data ?? []));
    }
    if (memRes.ok) {
      const memberships: Array<{ role: string; tenant: { slug: string }; status: string; userId: string; branchIds?: unknown }> = await memRes.json();
      const m = memberships.find((m) => m.tenant.slug === tenantSlug && m.status === 'ACTIVE');
      if (m) {
        setUserRole(m.role);
        setCurrentUserId(m.userId);
        const raw = m.branchIds as string[] | null | undefined;
        setBranchIds(Array.isArray(raw) ? raw : []);
      }
    }
    setLoading(false);
  }

  useEffect(() => { load(page, dateRange, fromBranchFilter, toBranchFilter, skuSearch); }, [tenantSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyFilters() {
    setPage(1);
    void load(1, dateRange, fromBranchFilter, toBranchFilter, skuSearch);
  }

  function handlePageChange(p: number) {
    setPage(p);
    void load(p, dateRange, fromBranchFilter, toBranchFilter, skuSearch);
  }

  function openDialog() {
    const defaultBranch = branches.find((b) => b.isDefault) ?? branches[0];
    setFromBranchId(defaultBranch?.id ?? '');
    setToBranchId('');
    setNote('');
    setLines([{ skuId: '', quantity: 1 }]);
    setFormError(null);
    setBranchStock({});
    setDialogOpen(true);
  }

  // Fetch branch stock when fromBranchId changes
  useEffect(() => {
    if (!fromBranchId || !dialogOpen) {
      setBranchStock({});
      return;
    }
    apiFetch(`/inventory/branch-stock?branchId=${fromBranchId}`, { tenantSlug })
      .then((r) => r.json())
      .then((d: Record<string, number>) => setBranchStock(d))
      .catch(() => setBranchStock({}));
  }, [fromBranchId, dialogOpen, tenantSlug]);

  // Reset lines when fromBranchId changes
  useEffect(() => {
    if (dialogOpen && fromBranchId) {
      setLines([{ skuId: '', quantity: 1 }]);
    }
  }, [fromBranchId, dialogOpen]);

  function setLine(idx: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, { skuId: '', quantity: 1 }]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (!fromBranchId) { setFormError('Source branch is required'); return; }
    if (!toBranchId) { setFormError('Destination branch is required'); return; }
    if (fromBranchId === toBranchId) { setFormError('Source and destination must differ'); return; }
    const validLines = lines.filter((l) => l.skuId && l.quantity > 0);
    if (validLines.length === 0) { setFormError('Add at least one item'); return; }

    setSaving(true);
    setFormError(null);

    const body = JSON.stringify({
      fromBranchId,
      toBranchId,
      note: note.trim() || undefined,
      items: validLines,
    });

    const res = await apiFetch('/transfers', { tenantSlug, method: 'POST', body });
    if (res.ok) {
      setDialogOpen(false);
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      setFormError(data.message ?? 'Something went wrong');
    }
    setSaving(false);
  }

  async function handleSend(id: string) {
    const res = await apiFetch(`/transfers/${id}/send`, { tenantSlug, method: 'POST' });
    if (res.ok) await load();
    else { const d = await res.json().catch(() => ({})); setError(d.message ?? 'Failed to send transfer'); }
  }

  async function handleReceive(id: string) {
    const res = await apiFetch(`/transfers/${id}/receive`, { tenantSlug, method: 'POST' });
    if (res.ok) await load();
    else { const d = await res.json().catch(() => ({})); setError(d.message ?? 'Failed to receive transfer'); }
  }

  async function handleCancel(id: string) {
    const res = await apiFetch(`/transfers/${id}/cancel`, { tenantSlug, method: 'POST' });
    if (res.ok) await load();
    else { const d = await res.json().catch(() => ({})); setError(d.message ?? 'Failed to cancel transfer'); }
  }

  function canSend(t: Transfer): boolean {
    if (t.status !== 'PENDING') return false;
    if (userRole === 'OWNER') return true;
    if (userRole === 'ADMIN' || userRole === 'STAFF') {
      if (branchIds.length === 0) return true;
      return !!t.fromBranch && branchIds.includes(t.fromBranch.id);
    }
    return false;
  }

  function canReceive(t: Transfer): boolean {
    if (t.status !== 'PENDING' && t.status !== 'APPROVED') return false;
    if (!t.fromBranch) return false;
    if (userRole === 'OWNER') return true;
    if (userRole === 'ADMIN' || userRole === 'STAFF') {
      if (branchIds.length === 0) return true;
      return branchIds.includes(t.toBranch.id);
    }
    return false;
  }

  function canCancel(t: Transfer): boolean {
    if (t.status !== 'PENDING' && t.status !== 'APPROVED') return false;
    if (userRole === 'OWNER') return true;
    if (t.status === 'PENDING' && t.requestedBy.id === currentUserId) return true;
    return false;
  }

  // Filtered SKUs based on branch stock
  const availableSkus = skus.filter((s) => (branchStock[s.id] ?? 0) > 0);

  if (error) return <p className="text-sm text-destructive">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Stock Transfers</h2>
          <p className="text-sm text-muted-foreground">Move inventory between branches.</p>
        </div>
        {canManage && (
          branches.length < 2 ? (
            <span className="text-xs text-muted-foreground">Add at least 2 branches to enable transfers</span>
          ) : (
            <button
              onClick={openDialog}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-3.5 w-3.5" />
              New transfer
            </button>
          )
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-2">
        <DateRangePicker value={dateRange} onChange={(r) => setDateRange(r)} />
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          value={fromBranchFilter}
          onChange={(e) => setFromBranchFilter(e.target.value)}
        >
          <option value="">From: any</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          value={toBranchFilter}
          onChange={(e) => setToBranchFilter(e.target.value)}
        >
          <option value="">To: any</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input
          type="search"
          placeholder="Search item (code or name)…"
          className="h-8 rounded-md border border-input bg-background px-3 text-sm w-52"
          value={skuSearch}
          onChange={(e) => setSkuSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
        />
        <button
          type="button"
          className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
          onClick={applyFilters}
        >
          Apply
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading transfers…</div>
      ) : transfers.length === 0 ? (
        <div className="rounded-lg border border-border py-12 text-center text-sm text-muted-foreground">
          No transfers match your filters.
        </div>
      ) : (
        <div className="space-y-3">
          {transfers.map((t) => (
            <div key={t.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium">
                  <span className="truncate">{t.fromBranch?.name ?? '(legacy)'}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{t.toBranch.name}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[t.status] ?? ''}`}>
                    {STATUS_LABELS[t.status] ?? t.status}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    {t.requestedBy.email.split('@')[0]}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatDate(t.createdAt)}</span>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {t.items.map((item) => (
                  <span
                    key={item.skuId}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    <Package className="h-3 w-3" />
                    {item.sku.code} · {item.quantity}
                  </span>
                ))}
              </div>
              {t.note && <p className="mt-2 text-xs text-muted-foreground">{t.note}</p>}

              {/* Action buttons */}
              {(canSend(t) || canReceive(t) || canCancel(t)) && (
                <div className="mt-3 flex gap-2">
                  {canSend(t) && (
                    <button
                      onClick={() => handleSend(t.id)}
                      className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Send
                    </button>
                  )}
                  {canReceive(t) && (
                    <button
                      onClick={() => handleReceive(t.id)}
                      className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                    >
                      Receive
                    </button>
                  )}
                  {canCancel(t) && (
                    <button
                      onClick={() => handleCancel(t.id)}
                      className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{meta.total} transfers</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-input hover:bg-accent disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2">{page} / {meta.totalPages}</span>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-input hover:bg-accent disabled:opacity-40"
              disabled={page >= meta.totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* New Transfer dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 py-10">
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl">
            <h3 className="mb-1 text-base font-semibold">New Stock Transfer</h3>
            <p className="mb-4 text-xs text-muted-foreground">
              Stock moves only when the destination marks a transfer as received.
            </p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">From branch *</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={fromBranchId}
                  onChange={(e) => setFromBranchId(e.target.value)}
                >
                  <option value="" disabled>Select source branch…</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}{b.isDefault ? ' (main)' : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">To branch *</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={toBranchId}
                  onChange={(e) => setToBranchId(e.target.value)}
                >
                  <option value="">Select destination…</option>
                  {branches
                    .filter((b) => b.id !== fromBranchId)
                    .map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm font-medium">Items *</label>
                  <button
                    type="button"
                    onClick={addLine}
                    className="text-xs text-primary hover:underline"
                  >
                    + Add item
                  </button>
                </div>
                <div className="space-y-2">
                  {lines.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        value={line.skuId}
                        onChange={(e) => setLine(idx, { skuId: e.target.value })}
                      >
                        <option value="">Select product…</option>
                        {availableSkus.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} — {s.name} (available: {branchStock[s.id] ?? 0})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        value={line.quantity}
                        onChange={(e) => setLine(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      />
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="text-xs text-destructive hover:underline"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Note</label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional"
                />
              </div>

              {formError && <p className="text-sm text-destructive">{formError}</p>}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setDialogOpen(false)}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Creating…' : 'Create transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
