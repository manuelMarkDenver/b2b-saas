'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getActiveBranchId } from '@/lib/branch';
import { formatCents } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';

type Supplier = { id: string; name: string };
type Branch = { id: string; name: string };
type Sku = { id: string; code: string; name: string; costCents?: number | null };
type POItem = { id: string; skuId: string; sku: { code: string; name: string }; orderedQty: number; receivedQty: number; purchaseCostCents: number };
type PurchaseOrder = {
  id: string;
  poNumber: number;
  status: string;
  note: string | null;
  poDate: string;
  expectedOn: string | null;
  createdAt: string;
  supplier: { id: string; name: string };
  branch: { id: string; name: string };
  totalCents: number;
  receivedProgress: { received: number; ordered: number };
  itemsCount: number;
};
type PODetail = PurchaseOrder & {
  items: POItem[];
  createdBy: { email: string };
  receivedBy: { email: string } | null;
  orderedAt: string | null;
  receivedAt: string | null;
  closedAt: string | null;
};
type Meta = { total: number; page: number; limit: number; totalPages: number };

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  ORDERED: 'Ordered',
  RECEIVED: 'Received',
  CLOSED: 'Closed',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  ORDERED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  RECEIVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CLOSED: 'bg-muted text-muted-foreground',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { dateStyle: 'medium' });
}

interface PurchaseOrdersPanelProps {
  tenantSlug: string;
  userRole: string | null;
}

export function PurchaseOrdersPanel({ tenantSlug, userRole }: PurchaseOrdersPanelProps) {
  const { pushToast } = useToast();
  const router = useRouter();
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [search, setSearch] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formPoDate, setFormPoDate] = useState('');
  const [formExpectedOn, setFormExpectedOn] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formItems, setFormItems] = useState<{ skuId: string; orderedQty: number; purchaseCostCents: number }[]>([{ skuId: '', orderedQty: 1, purchaseCostCents: 0 }]);
  const [incomingBySkuId, setIncomingBySkuId] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Inline supplier create
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', contactName: '', phone: '', email: '', address: '' });
  const [supplierSaving, setSupplierSaving] = useState(false);

  const canManage = userRole === 'OWNER' || userRole === 'ADMIN';

  useEffect(() => { setActiveBranchId(getActiveBranchId(tenantSlug)); }, [tenantSlug]);

  useEffect(() => {
    apiFetch('/branches', { tenantSlug }).then(async (r) => {
      if (r.ok) {
        const d = await r.json() as { branches: Branch[] } | Branch[];
        const all = Array.isArray(d) ? d : d.branches;
        setBranches(all);
      }
    });
  }, [tenantSlug]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: '1', limit: '20' });
    if (filterStatus) params.set('status', filterStatus);
    if (filterSupplier) params.set('supplierId', filterSupplier);
    if (filterBranch) params.set('branchId', filterBranch);
    else if (activeBranchId) params.set('branchId', activeBranchId);
    if (search.trim()) params.set('search', search.trim());
    const res = await apiFetch(`/purchase-orders?${params}`, { tenantSlug, branchId: filterBranch || activeBranchId || null });
    if (res.ok) {
      const d = await res.json() as { data: PurchaseOrder[]; meta: Meta };
      setOrders(d.data);
      setMeta(d.meta);
    }
    setLoading(false);
  }, [tenantSlug, activeBranchId, filterStatus, filterSupplier, filterBranch, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    apiFetch('/suppliers?isActive=true&limit=100', { tenantSlug, branchId: null }).then(async (r) => {
      if (r.ok) {
        const d = await r.json() as { data: Supplier[] };
        setSuppliers(d.data);
      }
    });
  }, [tenantSlug]);

  async function loadSkus() {
    const res = await apiFetch('/skus?limit=100', { tenantSlug });
    if (res.ok) {
      const d = await res.json() as { data: Sku[] };
      setSkus(d.data);
    }
  }

  async function loadIncoming(branchId: string) {
    const res = await apiFetch(`/purchase-orders?status=ORDERED&branchId=${branchId}&limit=100`, { tenantSlug, branchId });
    if (!res.ok) {
      setIncomingBySkuId({});
      return;
    }
    const d = await res.json() as { data: PurchaseOrder[] };
    const detailResponses = await Promise.all(
      d.data.map((po) => apiFetch(`/purchase-orders/${po.id}`, { tenantSlug, branchId })),
    );
    const incoming: Record<string, number> = {};
    for (const detailRes of detailResponses) {
      if (!detailRes.ok) continue;
      const detail = await detailRes.json() as PODetail;
      for (const item of detail.items) {
        incoming[item.skuId] = (incoming[item.skuId] ?? 0) + item.orderedQty;
      }
    }
    setIncomingBySkuId(incoming);
  }

  function openCreate() {
    setDialogMode('create');
    setEditingPO(null);
    setFormSupplierId('');
    setFormPoDate(new Date().toISOString().split('T')[0]);
    setFormExpectedOn('');
    setFormNote('');
    setFormItems([{ skuId: '', orderedQty: 1, purchaseCostCents: 0 }]);
    setIncomingBySkuId({});
    setFormError(null);
    loadSkus();
    if (activeBranchId) void loadIncoming(activeBranchId);
    setDialogOpen(true);
  }

  async function openEdit(po: PurchaseOrder) {
    setDialogMode('edit');
    setEditingPO(po);
    setFormSupplierId(po.supplier.id);
    setFormPoDate(po.poDate.split('T')[0]);
    setFormExpectedOn(po.expectedOn ? po.expectedOn.split('T')[0] : '');
    setFormNote(po.note ?? '');
    setIncomingBySkuId({});
    setFormError(null);
    await loadSkus();
    if (activeBranchId) await loadIncoming(activeBranchId);
    // Fetch full PO items with cost
    const detailRes = await apiFetch(`/purchase-orders/${po.id}`, { tenantSlug, branchId: activeBranchId });
    if (detailRes.ok) {
      const detail = await detailRes.json() as PODetail;
      setFormItems(detail.items.map((i) => ({ skuId: i.skuId, orderedQty: i.orderedQty, purchaseCostCents: i.purchaseCostCents })));
    }
    setDialogOpen(true);
  }

  function setFormItem(idx: number, patch: Partial<{ skuId: string; orderedQty: number; purchaseCostCents: number }>) {
    setFormItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  }

  function addFormItem() {
    setFormItems((prev) => [...prev, { skuId: '', orderedQty: 1, purchaseCostCents: 0 }]);
  }

  function removeFormItem(idx: number) {
    setFormItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const totalCents = formItems.reduce((sum, item) => {
    const sku = skus.find((s) => s.id === item.skuId);
    const cost = item.purchaseCostCents || (sku?.costCents ?? 0);
    return sum + item.orderedQty * cost;
  }, 0);
  const validItems = formItems.filter((i) => i.skuId && i.orderedQty > 0);

  async function submitPO(orderImmediately: boolean) {
    if (!formSupplierId) { setFormError('Supplier is required'); return; }
    if (!formPoDate) { setFormError('PO date is required'); return; }
    if (validItems.length === 0) { setFormError('At least one item is required'); return; }

    setSaving(true);
    setFormError(null);
    try {
      const itemsWithCost = validItems.map((item) => {
        const sku = skus.find((s) => s.id === item.skuId);
        return {
          skuId: item.skuId,
          orderedQty: item.orderedQty,
          purchaseCostCents: item.purchaseCostCents || (sku?.costCents ?? 0),
        };
      });
      const body = {
        supplierId: formSupplierId,
        poDate: formPoDate,
        expectedOn: formExpectedOn || undefined,
        note: formNote.trim() || undefined,
        items: itemsWithCost,
      };
      let res: Response;
      if (dialogMode === 'edit' && editingPO) {
        res = await apiFetch(`/purchase-orders/${editingPO.id}`, { tenantSlug, branchId: activeBranchId, method: 'PATCH', body: JSON.stringify(body) });
      } else {
        res = await apiFetch('/purchase-orders', { tenantSlug, branchId: activeBranchId, method: 'POST', body: JSON.stringify(body) });
      }
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        setFormError(err.message ?? 'Something went wrong');
        return;
      }
      const po = await res.json() as PurchaseOrder;
      if (orderImmediately) {
        const orderRes = await apiFetch(`/purchase-orders/${po.id}/order`, { tenantSlug, branchId: activeBranchId, method: 'POST' });
        if (!orderRes.ok) {
          const err = await orderRes.json() as { message?: string };
          setFormError(err.message ?? 'Failed to mark as ordered');
          return;
        }
      }
      setDialogOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleReceive(po: PurchaseOrder) {
    router.push(`/t/${tenantSlug}/inventory/purchase-orders/${po.id}`);
  }

  async function handleClose(po: PurchaseOrder) {
    const res = await apiFetch(`/purchase-orders/${po.id}/close`, { tenantSlug, branchId: activeBranchId, method: 'POST' });
    if (res.ok) {
      pushToast({ variant: 'success', title: 'PO closed', message: `PO${po.poNumber} has been closed.` });
      load();
    }
  }

  async function handleCreateSupplier() {
    if (!supplierForm.name.trim()) return;
    setSupplierSaving(true);
    try {
      const res = await apiFetch('/suppliers', {
        tenantSlug,
        branchId: null,
        method: 'POST',
        body: JSON.stringify({
          name: supplierForm.name.trim(),
          contactName: supplierForm.contactName.trim() || undefined,
          phone: supplierForm.phone.trim() || undefined,
          email: supplierForm.email.trim() || undefined,
          address: supplierForm.address.trim() || undefined,
        }),
      });
      if (res.ok) {
        const newSupplier = await res.json() as Supplier;
        setSupplierDialogOpen(false);
        setFormSupplierId(newSupplier.id);
        // Refresh suppliers list
        const supRes = await apiFetch('/suppliers?isActive=true&limit=100', { tenantSlug, branchId: null });
        if (supRes.ok) {
          const d = await supRes.json() as { data: Supplier[] };
          setSuppliers(d.data);
        }
      } else {
        const err = await res.json() as { message?: string };
        pushToast({ variant: 'error', title: 'Failed to create supplier', message: err.message ?? '' });
      }
    } finally {
      setSupplierSaving(false);
    }
  }

  if (!activeBranchId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-900/20">
        <p className="text-sm text-amber-700 dark:text-amber-400">Select a branch to view purchase orders.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2">
        <select className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); }}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ORDERED">Ordered</option>
          <option value="RECEIVED">Received</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={filterSupplier} onChange={(e) => { setFilterSupplier(e.target.value); }}>
          <option value="">All suppliers</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={filterBranch} onChange={(e) => { setFilterBranch(e.target.value); }}>
          <option value="">All stores</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search PO# or supplier…"
            className="h-8 rounded-md border border-input bg-background pl-8 pr-3 text-sm w-52"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
          />
        </div>
        <Button size="sm" onClick={load}>Apply</Button>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New purchase order
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading purchase orders…</div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-border py-12 text-center text-sm text-muted-foreground">No purchase orders found.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <div className="min-w-[800px]">
            <div className="grid gap-0 border-b bg-muted/40 px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground grid-cols-[80px_90px_1fr_1fr_80px_80px_90px_100px]">
              <span>PO#</span>
              <span>Date</span>
              <span>Supplier</span>
              <span>Store</span>
              <span>Status</span>
              <span className="text-right">Received</span>
              <span className="text-right">Expected</span>
              <span className="text-right">Total</span>
            </div>
            <div className="divide-y">
              {orders.map((po) => (
                <div
                  key={po.id}
                  className="grid items-center gap-0 px-4 py-3 text-sm transition-colors hover:bg-muted/30 cursor-pointer grid-cols-[80px_90px_1fr_1fr_80px_80px_90px_100px]"
                  onClick={() => router.push(`/t/${tenantSlug}/inventory/purchase-orders/${po.id}`)}
                >
                  <span className="font-mono text-xs font-semibold">PO{po.poNumber}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(po.poDate)}</span>
                  <span className="truncate text-xs">{po.supplier.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{po.branch.name}</span>
                  <span className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold w-fit ${STATUS_COLORS[po.status]}`}>
                    {STATUS_LABELS[po.status]}
                  </span>
                  <span className="text-right text-xs tabular-nums text-muted-foreground">
                    {po.receivedProgress.ordered > 0 ? `${po.receivedProgress.received}/${po.receivedProgress.ordered}` : '—'}
                  </span>
                  <span className="text-right text-xs text-muted-foreground">{formatDate(po.expectedOn)}</span>
                  <span className="text-right text-xs tabular-nums font-medium">{formatCents(po.totalCents)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'edit' ? 'Edit purchase order' : 'New purchase order'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); submitPO(false); }} className="space-y-4">
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Supplier *</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formSupplierId}
                  onChange={(e) => {
                    if (e.target.value === '__new__') {
                      setSupplierForm({ name: '', contactName: '', phone: '', email: '', address: '' });
                      setSupplierDialogOpen(true);
                    } else {
                      setFormSupplierId(e.target.value);
                    }
                  }}
                >
                  <option value="">Select supplier…</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  <option value="__new__">+ Add supplier</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">PO Date *</label>
                <input type="date" value={formPoDate} onChange={(e) => setFormPoDate(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Expected on</label>
                <input type="date" value={formExpectedOn} onChange={(e) => setFormExpectedOn(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Note</label>
                <input type="text" value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="Optional" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium">Items *</label>
                <button type="button" onClick={addFormItem} className="text-xs text-primary hover:underline">+ Add item</button>
              </div>
              <div className="grid grid-cols-[minmax(0,2fr)_80px_70px_120px_100px_24px] gap-2 px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <span>Item</span>
                <span className="text-right">Incoming</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Purchase cost</span>
                <span className="text-right">Amount</span>
                <span />
              </div>
              <div className="space-y-2">
                {formItems.map((item, idx) => {
                  const sku = skus.find((s) => s.id === item.skuId);
                  const cost = item.purchaseCostCents || (sku?.costCents ?? 0);
                  const amount = item.orderedQty * cost;
                  return (
                    <div key={idx} className="grid grid-cols-[minmax(0,2fr)_80px_70px_120px_100px_24px] items-center gap-2">
                      <select
                        className="min-w-0 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        value={item.skuId}
                        onChange={(e) => {
                          const selectedSku = skus.find((s) => s.id === e.target.value);
                          setFormItem(idx, { skuId: e.target.value, purchaseCostCents: selectedSku?.costCents ?? 0 });
                        }}
                      >
                        <option value="">Select item…</option>
                        {skus.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                      </select>
                      <span className="text-right text-xs tabular-nums text-muted-foreground">{item.skuId ? (incomingBySkuId[item.skuId] ?? 0) : '—'}</span>
                      <input
                        type="number"
                        min={1}
                        className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-center"
                        value={item.orderedQty}
                        onChange={(e) => setFormItem(idx, { orderedQty: Math.max(1, parseInt(e.target.value) || 1) })}
                        placeholder="Qty"
                      />
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₱</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          className="w-full rounded-md border border-input bg-background pl-7 pr-2 py-1.5 text-sm text-right"
                          value={String(cost / 100)}
                          onChange={(e) => {
                            const next = e.target.value === '' ? 0 : Math.max(0, Math.round(parseFloat(e.target.value || '0') * 100));
                            setFormItem(idx, { purchaseCostCents: next });
                          }}
                          placeholder="0.00"
                        />
                      </div>
                      <span className="text-xs tabular-nums w-20 text-right">{formatCents(amount)}</span>
                      {formItems.length > 1 && (
                        <button type="button" onClick={() => removeFormItem(idx)} className="text-xs text-destructive">✕</button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-right text-sm font-medium">Total: {formatCents(totalCents)}</div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="button" variant="outline" onClick={() => submitPO(false)} disabled={saving || !formSupplierId || !formPoDate || validItems.length === 0}>Save draft</Button>
              <Button type="submit" disabled={saving || !formSupplierId || !formPoDate || validItems.length === 0}>Save & mark ordered</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Inline supplier create dialog */}
      <Dialog open={supplierDialogOpen} onOpenChange={(open) => { if (!open) setSupplierDialogOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add supplier</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleCreateSupplier(); }} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name *</label>
              <input type="text" required value={supplierForm.name} onChange={(e) => setSupplierForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Contact name</label>
                <input type="text" value={supplierForm.contactName} onChange={(e) => setSupplierForm((f) => ({ ...f, contactName: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Phone</label>
                <input type="text" value={supplierForm.phone} onChange={(e) => setSupplierForm((f) => ({ ...f, phone: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Email</label>
                <input type="email" value={supplierForm.email} onChange={(e) => setSupplierForm((f) => ({ ...f, email: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Address</label>
                <input type="text" value={supplierForm.address} onChange={(e) => setSupplierForm((f) => ({ ...f, address: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSupplierDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={supplierSaving}>{supplierSaving ? 'Saving…' : 'Add supplier'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
