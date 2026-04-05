'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getActiveBranchId } from '@/lib/branch';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';

type Supplier = { id: string; name: string };
type Sku = { id: string; code: string; name: string };
type POItem = { id: string; skuId: string; sku: { code: string; name: string }; orderedQty: number; receivedQty: number };
type PurchaseOrder = {
  id: string;
  poNumber: number;
  status: string;
  note: string | null;
  createdAt: string;
  orderedAt: string | null;
  receivedAt: string | null;
  closedAt: string | null;
  supplier: { id: string; name: string };
  items: POItem[];
  itemsCount: number;
};
type Meta = { total: number; page: number; limit: number; totalPages: number };

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'DRAFT',
  ORDERED: 'ORDERED',
  RECEIVED: 'RECEIVED',
  CLOSED: 'CLOSED',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  ORDERED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  RECEIVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CLOSED: 'bg-muted text-muted-foreground',
};

interface PurchaseOrdersPanelProps {
  tenantSlug: string;
  userRole: string | null;
}

export function PurchaseOrdersPanel({ tenantSlug, userRole }: PurchaseOrdersPanelProps) {
  const { pushToast } = useToast();
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | 'receive'>('create');
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formItems, setFormItems] = useState<{ skuId: string; orderedQty: number }[]>([{ skuId: '', orderedQty: 1 }]);
  const [receiveItems, setReceiveItems] = useState<{ skuId: string; orderedQty: number; receivedQty: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canManage = userRole === 'OWNER' || userRole === 'ADMIN';

  useEffect(() => { setActiveBranchId(getActiveBranchId(tenantSlug)); }, [tenantSlug]);

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    const params = new URLSearchParams({ page: '1', limit: '20' });
    if (search.trim()) params.set('search', search.trim());
    const res = await apiFetch(`/purchase-orders?${params}`, { tenantSlug, branchId: activeBranchId });
    if (res.ok) {
      const d = await res.json() as { data: PurchaseOrder[]; meta: Meta };
      setOrders(d.data);
      setMeta(d.meta);
    }
    setLoading(false);
  }, [tenantSlug, activeBranchId, search]);

  useEffect(() => { load(); }, [load]);

  async function loadSuppliers() {
    const res = await apiFetch('/suppliers?isActive=true&limit=100', { tenantSlug, branchId: null });
    if (res.ok) {
      const d = await res.json() as { data: Supplier[] };
      setSuppliers(d.data);
    }
  }

  async function loadSkus() {
    const res = await apiFetch('/skus?limit=100', { tenantSlug });
    if (res.ok) {
      const d = await res.json() as { data: Sku[] };
      setSkus(d.data);
    }
  }

  function openCreate() {
    setDialogMode('create');
    setEditingPO(null);
    setFormSupplierId('');
    setFormNote('');
    setFormItems([{ skuId: '', orderedQty: 1 }]);
    setFormError(null);
    loadSuppliers();
    loadSkus();
    setDialogOpen(true);
  }

  function openEdit(po: PurchaseOrder) {
    setDialogMode('edit');
    setEditingPO(po);
    setFormSupplierId(po.supplier.id);
    setFormNote(po.note ?? '');
    setFormItems(po.items.map((i) => ({ skuId: i.skuId, orderedQty: i.orderedQty })));
    setFormError(null);
    loadSuppliers();
    loadSkus();
    setDialogOpen(true);
  }

  function openReceive(po: PurchaseOrder) {
    setDialogMode('receive');
    setEditingPO(po);
    setReceiveItems(po.items.map((i) => ({ skuId: i.skuId, orderedQty: i.orderedQty, receivedQty: i.orderedQty })));
    setFormError(null);
    setDialogOpen(true);
  }

  function setFormItem(idx: number, patch: Partial<{ skuId: string; orderedQty: number }>) {
    setFormItems((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  }

  function addFormItem() {
    setFormItems((prev) => [...prev, { skuId: '', orderedQty: 1 }]);
  }

  function removeFormItem(idx: number) {
    setFormItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSaveDraft() {
    await submitPO(false);
  }

  async function handleSaveAndOrder() {
    await submitPO(true);
  }

  async function submitPO(orderImmediately: boolean) {
    if (!formSupplierId) { setFormError('Supplier is required'); return; }
    const validItems = formItems.filter((i) => i.skuId && i.orderedQty > 0);
    if (validItems.length === 0) { setFormError('At least one item is required'); return; }

    setSaving(true);
    setFormError(null);
    try {
      const body = { supplierId: formSupplierId, note: formNote.trim() || undefined, items: validItems };
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

  async function handleReceive() {
    if (!editingPO) return;
    setSaving(true);
    setFormError(null);
    try {
      const body = { items: receiveItems.map((i) => ({ skuId: i.skuId, receivedQty: i.receivedQty })) };
      const res = await apiFetch(`/purchase-orders/${editingPO.id}/receive`, { tenantSlug, branchId: activeBranchId, method: 'POST', body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        setFormError(err.message ?? 'Failed to receive');
        return;
      }
      pushToast({ variant: 'success', title: 'Items received', message: 'Stock has been updated.' });
      setDialogOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleClose(po: PurchaseOrder) {
    const res = await apiFetch(`/purchase-orders/${po.id}/close`, { tenantSlug, branchId: activeBranchId, method: 'POST' });
    if (res.ok) {
      pushToast({ variant: 'success', title: 'PO closed', message: `PO${po.poNumber} has been closed.` });
      load();
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
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
      <div className="flex items-center justify-between gap-3">
        <input
          type="search"
          placeholder="Search by PO# or supplier…"
          className="h-8 rounded-md border border-input bg-background px-3 text-sm w-64"
          value={search}
          onChange={(e) => { setSearch(e.target.value); }}
          onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
        />
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New purchase order
          </Button>
        )}
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading purchase orders…</div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-border py-12 text-center text-sm text-muted-foreground">
          No purchase orders found.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((po) => (
            <div key={po.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-semibold">PO{po.poNumber}</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[po.status]}`}>
                    {STATUS_LABELS[po.status]}
                  </span>
                  <span className="text-sm text-muted-foreground">{po.supplier.name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{po.itemsCount} item{po.itemsCount !== 1 ? 's' : ''}</span>
                  <span>{formatDate(po.createdAt)}</span>
                </div>
              </div>
              {canManage && (
                <div className="mt-3 flex gap-2">
                  {po.status === 'DRAFT' && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => openEdit(po)}>Edit</Button>
                      <Button size="sm" onClick={() => submitPOForOrder(po)}>Mark ordered</Button>
                    </>
                  )}
                  {po.status === 'ORDERED' && (
                    <Button size="sm" onClick={() => openReceive(po)}>Receive</Button>
                  )}
                  {po.status === 'RECEIVED' && (
                    <Button variant="outline" size="sm" onClick={() => handleClose(po)}>Close</Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      {(dialogMode === 'create' || dialogMode === 'edit') && (
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false); }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{dialogMode === 'edit' ? 'Edit purchase order' : 'New purchase order'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveDraft(); }} className="space-y-4">
              {formError && <p className="text-sm text-destructive">{formError}</p>}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Supplier *</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formSupplierId}
                  onChange={(e) => setFormSupplierId(e.target.value)}
                >
                  <option value="">Select supplier…</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Note</label>
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-sm font-medium">Items *</label>
                  <button type="button" onClick={addFormItem} className="text-xs text-primary hover:underline">+ Add item</button>
                </div>
                <div className="space-y-2">
                  {formItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        value={item.skuId}
                        onChange={(e) => setFormItem(idx, { skuId: e.target.value })}
                      >
                        <option value="">Select item…</option>
                        {skus.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                      </select>
                      <input
                        type="number"
                        min={1}
                        className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                        value={item.orderedQty}
                        onChange={(e) => setFormItem(idx, { orderedQty: Math.max(1, parseInt(e.target.value) || 1) })}
                      />
                      {formItems.length > 1 && (
                        <button type="button" onClick={() => removeFormItem(idx)} className="text-xs text-destructive">✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={saving}>Save draft</Button>
                <Button type="submit" disabled={saving}>Save & mark ordered</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Receive dialog */}
      {dialogMode === 'receive' && editingPO && (
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false); }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Receive items — PO{editingPO.poNumber}</DialogTitle>
            </DialogHeader>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="space-y-3">
              {receiveItems.map((item, idx) => {
                const sku = editingPO.items.find((i) => i.skuId === item.skuId)?.sku;
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="flex-1 text-sm">{sku ? `${sku.code} — ${sku.name}` : item.skuId}</span>
                    <span className="text-xs text-muted-foreground">Ordered: {item.orderedQty}</span>
                    <input
                      type="number"
                      min={0}
                      max={item.orderedQty}
                      className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      value={item.receivedQty}
                      onChange={(e) => setReceiveItems((prev) => prev.map((r, i) => (i === idx ? { ...r, receivedQty: Math.max(0, Math.min(item.orderedQty, parseInt(e.target.value) || 0)) } : r)))}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleReceive} disabled={saving}>Receive items</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );

  async function submitPOForOrder(po: PurchaseOrder) {
    setSaving(true);
    try {
      const res = await apiFetch(`/purchase-orders/${po.id}/order`, { tenantSlug, branchId: activeBranchId, method: 'POST' });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        pushToast({ variant: 'error', title: 'Failed', message: err.message ?? 'Unknown error' });
      } else {
        pushToast({ variant: 'success', title: 'PO ordered', message: `PO${po.poNumber} has been marked as ordered.` });
        load();
      }
    } finally {
      setSaving(false);
    }
  }
}
