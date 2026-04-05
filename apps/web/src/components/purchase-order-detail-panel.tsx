'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, MoreHorizontal } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getActiveBranchId } from '@/lib/branch';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

type POItem = { id: string; skuId: string; sku: { code: string; name: string }; orderedQty: number; receivedQty: number; purchaseCostCents: number };
type PODetail = {
  id: string;
  poNumber: number;
  status: string;
  note: string | null;
  poDate: string;
  expectedOn: string | null;
  createdAt: string;
  orderedAt: string | null;
  receivedAt: string | null;
  closedAt: string | null;
  supplier: { id: string; name: string };
  branch: { id: string; name: string };
  createdBy: { email: string };
  receivedBy: { email: string } | null;
  items: POItem[];
  totalCents: number;
  receivedProgress: { received: number; ordered: number };
};

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

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

interface PurchaseOrderDetailClientProps {
  tenantSlug: string;
  poId: string;
}

export function PurchaseOrderDetailClient({ tenantSlug, poId }: PurchaseOrderDetailClientProps) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [po, setPo] = useState<PODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [receiveItems, setReceiveItems] = useState<{ skuId: string; orderedQty: number; receivedQty: number }[]>([]);
  const [showReceiveDialog, setShowReceiveDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setActiveBranchId(getActiveBranchId(tenantSlug)); }, [tenantSlug]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch(`/purchase-orders/${poId}`, { tenantSlug, branchId: activeBranchId });
    if (res.ok) {
      const data = await res.json() as PODetail;
      setPo(data);
      setReceiveItems(data.items.map((i) => ({ skuId: i.skuId, orderedQty: i.orderedQty, receivedQty: i.orderedQty })));
    }
    setLoading(false);
  }, [tenantSlug, poId, activeBranchId]);

  useEffect(() => { load(); }, [load]);

  async function handleReceive() {
    if (!po) return;
    setSaving(true);
    try {
      const body = { items: receiveItems.map((i) => ({ skuId: i.skuId, receivedQty: i.receivedQty })) };
      const res = await apiFetch(`/purchase-orders/${po.id}/receive`, { tenantSlug, branchId: activeBranchId, method: 'POST', body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        pushToast({ variant: 'error', title: 'Failed to receive', message: err.message ?? '' });
        return;
      }
      pushToast({ variant: 'success', title: 'Items received', message: 'Stock has been updated.' });
      setShowReceiveDialog(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleOrder() {
    if (!po) return;
    const res = await apiFetch(`/purchase-orders/${po.id}/order`, { tenantSlug, branchId: activeBranchId, method: 'POST' });
    if (res.ok) {
      pushToast({ variant: 'success', title: 'PO ordered', message: `PO${po.poNumber} has been marked as ordered.` });
      load();
    }
  }

  async function handleClose() {
    if (!po) return;
    const res = await apiFetch(`/purchase-orders/${po.id}/close`, { tenantSlug, branchId: activeBranchId, method: 'POST' });
    if (res.ok) {
      pushToast({ variant: 'success', title: 'PO closed', message: `PO${po.poNumber} has been closed.` });
      load();
    }
  }

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">Loading purchase order…</div>;
  if (!po) return <div className="py-10 text-center text-sm text-muted-foreground">Purchase order not found.</div>;

  return (
    <div className="space-y-6">
      {/* Top actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to list
        </Button>
        <div className="flex items-center gap-2">
          {po.status === 'DRAFT' && (
            <Button size="sm" onClick={handleOrder}>Mark ordered</Button>
          )}
          {po.status === 'ORDERED' && (
            <Button size="sm" onClick={() => setShowReceiveDialog(true)}>Receive</Button>
          )}
          {po.status === 'RECEIVED' && (
            <Button variant="outline" size="sm" onClick={handleClose}>Close</Button>
          )}
          {/* More menu — disabled items */}
          <div className="relative group">
            <Button variant="outline" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover:block w-48 rounded-md border bg-popover shadow-lg z-50">
              <div className="p-2 space-y-1">
                <span className="block px-2 py-1.5 text-xs text-muted-foreground cursor-not-allowed" title="Not yet implemented">Save as PDF</span>
                <span className="block px-2 py-1.5 text-xs text-muted-foreground cursor-not-allowed" title="Not yet implemented">Save as CSV</span>
                <span className="block px-2 py-1.5 text-xs text-muted-foreground cursor-not-allowed" title="Not yet implemented">Duplicate</span>
                <span className="block px-2 py-1.5 text-xs text-muted-foreground cursor-not-allowed" title="Not yet implemented">Print labels</span>
                <span className="block px-2 py-1.5 text-xs text-muted-foreground cursor-not-allowed" title="Not yet implemented">Cancel remaining items</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg font-semibold">PO{po.poNumber}</span>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[po.status]}`}>
            {STATUS_LABELS[po.status]}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-xs text-muted-foreground">Supplier</span>
            <p className="font-medium">{po.supplier.name}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Store</span>
            <p className="font-medium">{po.branch.name}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">PO Date</span>
            <p className="font-medium">{formatDate(po.poDate)}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Expected On</span>
            <p className="font-medium">{formatDate(po.expectedOn)}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Created By</span>
            <p className="font-medium">{po.createdBy.email}</p>
          </div>
          {po.receivedBy && (
            <div>
              <span className="text-xs text-muted-foreground">Received By</span>
              <p className="font-medium">{po.receivedBy.email}</p>
            </div>
          )}
          {po.note && (
            <div className="col-span-2">
              <span className="text-xs text-muted-foreground">Note</span>
              <p className="font-medium">{po.note}</p>
            </div>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="grid gap-0 border-b bg-muted/40 px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground grid-cols-[2fr_80px_100px_100px_100px]">
          <span>Item</span>
          <span className="text-right">Ordered</span>
          <span className="text-right">Received</span>
          <span className="text-right">Cost</span>
          <span className="text-right">Amount</span>
        </div>
        <div className="divide-y">
          {po.items.map((item) => (
            <div key={item.id} className="grid items-center gap-0 px-4 py-3 text-sm grid-cols-[2fr_80px_100px_100px_100px]">
              <div className="min-w-0">
                <span className="block truncate text-xs font-medium">{item.sku.name}</span>
                <span className="text-[10px] text-muted-foreground">{item.sku.code}</span>
              </div>
              <span className="text-right text-xs tabular-nums">{item.orderedQty}</span>
              <span className="text-right text-xs tabular-nums">{item.receivedQty}</span>
              <span className="text-right text-xs tabular-nums">{formatCents(item.purchaseCostCents)}</span>
              <span className="text-right text-xs tabular-nums font-medium">{formatCents(item.orderedQty * item.purchaseCostCents)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-end px-4 py-3 border-t bg-muted/20">
          <span className="text-sm font-semibold">Total: {formatCents(po.totalCents)}</span>
        </div>
      </div>

      {/* Receive dialog */}
      {showReceiveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl">
            <h3 className="mb-4 text-base font-semibold">Receive items — PO{po.poNumber}</h3>
            <div className="space-y-3 mb-4">
              {receiveItems.map((item, idx) => {
                const sku = po.items.find((i) => i.skuId === item.skuId)?.sku;
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
              <Button variant="outline" onClick={() => setShowReceiveDialog(false)}>Cancel</Button>
              <Button onClick={handleReceive} disabled={saving}>Receive items</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
