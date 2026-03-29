'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, ArrowUp, ArrowDown, ArrowLeftRight } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';

type Movement = {
  id: string;
  type: string;
  quantity: number;
  note?: string;
  referenceType: string;
  createdAt: string;
  sku: { code: string; name: string };
};

type Sku = { id: string; code: string; name: string; stockOnHand: number };

type Meta = { total: number; page: number; limit: number; totalPages: number };

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

interface InventoryPanelProps {
  tenantSlug: string;
}

export function InventoryPanel({ tenantSlug }: InventoryPanelProps) {
  const { pushToast } = useToast();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ skuId: '', type: 'IN', quantity: '', note: '' });
  const [saving, setSaving] = useState(false);

  const loadMovements = useCallback(async () => {
    const res = await apiFetch(`/inventory/movements?page=${page}&limit=20`, { tenantSlug });
    if (res.ok) {
      const data = await res.json() as { data: Movement[]; meta: Meta };
      setMovements(data.data);
      setMeta(data.meta);
    }
  }, [tenantSlug, page]);

  useEffect(() => {
    loadMovements();
    apiFetch('/skus?limit=100', { tenantSlug }).then(async (r) => {
      if (r.ok) {
        const d = await r.json() as { data: Sku[] };
        setSkus(d.data);
      }
    });
  }, [tenantSlug, loadMovements]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch('/inventory/movements', {
        method: 'POST',
        tenantSlug,
        body: JSON.stringify({
          skuId: form.skuId,
          type: form.type,
          quantity: parseInt(form.quantity, 10),
          note: form.note || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        pushToast({ variant: 'error', title: 'Failed', message: err.message ?? 'Unknown error' });
      } else {
        pushToast({ variant: 'success', title: 'Movement logged', message: 'Inventory updated.' });
        setAddOpen(false);
        setForm({ skuId: '', type: 'IN', quantity: '', note: '' });
        loadMovements();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{meta.total} total movements</span>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Log movement
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="grid grid-cols-[1fr_80px_80px_1fr_120px] gap-0 border-b border-border px-4 py-2 text-xs font-medium text-muted-foreground">
          <span>SKU</span>
          <span>Type</span>
          <span className="text-right">Qty</span>
          <span>Note</span>
          <span className="text-right">Date</span>
        </div>

        {movements.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">No movements recorded.</div>
        ) : (
          <div className="divide-y divide-border">
            {movements.map((m) => {
              const Icon = MOVEMENT_ICON[m.type] ?? ArrowLeftRight;
              const color = MOVEMENT_COLOR[m.type] ?? '';
              return (
                <div key={m.id} className="grid grid-cols-[1fr_80px_80px_1fr_120px] items-center gap-0 px-4 py-2.5 text-sm hover:bg-muted/30">
                  <div>
                    <span className="font-medium">{m.sku.code}</span>
                    <span className="ml-1.5 text-xs text-muted-foreground">{m.sku.name}</span>
                  </div>
                  <div className={`flex items-center gap-1 ${color}`}>
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{m.type}</span>
                  </div>
                  <div className={`text-right font-mono font-medium ${color}`}>
                    {m.type === 'OUT' ? '-' : m.type === 'ADJUSTMENT' && m.quantity < 0 ? '' : '+'}{Math.abs(m.quantity)}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{m.note ?? '—'}</div>
                  <div className="text-right text-xs text-muted-foreground">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2">
            <span className="text-xs text-muted-foreground">
              Page {meta.page} of {meta.totalPages}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                ‹
              </Button>
              <Button variant="outline" size="icon" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                ›
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add movement dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log inventory movement</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1.5">
              <Label>SKU</Label>
              <Select value={form.skuId} onValueChange={(v) => setForm((f) => ({ ...f, skuId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select SKU" /></SelectTrigger>
                <SelectContent>
                  {skus.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.code} — {s.name} (stock: {s.stockOnHand})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">IN — Stock received</SelectItem>
                  <SelectItem value="OUT">OUT — Stock dispatched</SelectItem>
                  <SelectItem value="ADJUSTMENT">ADJUSTMENT — Manual correction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 50"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Note (optional)</Label>
              <Input
                placeholder="e.g. Received from supplier"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !form.skuId}>
                {saving ? 'Saving…' : 'Log movement'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
