'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, ArrowUp, ArrowDown, ArrowLeftRight } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { formatCents } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FilterBar, FilterValues } from '@/components/ui/filter-bar';
import { useToast } from '@/components/ui/toast';
import { ProductThumb } from '@/components/product-thumb';

type Category = { id: string; name: string; slug: string };

type Movement = {
  id: string;
  type: string;
  quantity: number;
  note?: string;
  referenceType: string;
  createdAt: string;
  sku: { code: string; name: string };
};

type Sku = {
  id: string;
  code: string;
  name: string;
  stockOnHand: number;
  lowStockThreshold: number;
  priceCents?: number | null;
  costCents?: number | null;
  imageUrl?: string | null;
  product: { id: string; name: string; category: { id: string; name: string; slug: string } };
};

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

function stockColor(sku: Sku): string {
  if (sku.lowStockThreshold > 0 && sku.stockOnHand <= sku.lowStockThreshold)
    return 'text-red-500 dark:text-red-400';
  if (sku.stockOnHand <= 10) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-green-600 dark:text-green-400';
}

interface InventoryPanelProps {
  tenantSlug: string;
}

export function InventoryPanel({ tenantSlug }: InventoryPanelProps) {
  const { pushToast } = useToast();

  // Filter state
  const [filters, setFilters] = useState<FilterValues>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [showSkuCol, setShowSkuCol] = useState(false);

  // SKU list state
  const [skus, setSkus] = useState<Sku[]>([]);
  const [skuMeta, setSkuMeta] = useState<Meta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [skuPage, setSkuPage] = useState(1);

  // Movement list state
  const [movements, setMovements] = useState<Movement[]>([]);
  const [movMeta, setMovMeta] = useState<Meta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [movPage, setMovPage] = useState(1);

  // Add movement dialog
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ skuId: '', type: 'IN', quantity: '', note: '' });
  const [saving, setSaving] = useState(false);

  // Load categories once
  useEffect(() => {
    apiFetch('/categories', { tenantSlug }).then(async (r) => {
      if (r.ok) setCategories(await r.json() as Category[]);
    });
  }, [tenantSlug]);

  const loadSkus = useCallback(async () => {
    const params = new URLSearchParams({ page: String(skuPage), limit: '20' });
    if (filters.search) params.set('search', filters.search as string);
    if (filters.categoryId) params.set('categoryId', filters.categoryId as string);
    if (filters.lowStock === true) params.set('lowStock', 'true');
    const res = await apiFetch(`/skus?${params}`, { tenantSlug });
    if (res.ok) {
      const d = await res.json() as { data: Sku[]; meta: Meta };
      setSkus(d.data);
      setSkuMeta(d.meta);
    }
  }, [tenantSlug, skuPage, filters]);

  const loadMovements = useCallback(async () => {
    const res = await apiFetch(`/inventory/movements?page=${movPage}&limit=20`, { tenantSlug });
    if (res.ok) {
      const data = await res.json() as { data: Movement[]; meta: Meta };
      setMovements(data.data);
      setMovMeta(data.meta);
    }
  }, [tenantSlug, movPage]);

  useEffect(() => { loadSkus(); }, [loadSkus]);
  useEffect(() => { loadMovements(); }, [loadMovements]);

  // Reset page to 1 when filters change
  useEffect(() => { setSkuPage(1); }, [filters]);

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
          referenceType: 'MANUAL',
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
        loadSkus();
        loadMovements();
      }
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    const rows: string[][] = [['Product', 'Category', 'SKU Code', 'In Stock', 'Cost', 'Price']];
    skus.forEach((s) => {
      rows.push([
        s.name,
        s.product.category.name,
        s.code,
        String(s.stockOnHand),
        s.costCents != null ? formatCents(s.costCents) : '',
        s.priceCents != null ? formatCents(s.priceCents) : '',
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const filterFields = [
    { type: 'search' as const, key: 'search', placeholder: 'Search products…' },
    {
      type: 'select' as const,
      key: 'categoryId',
      label: 'All categories',
      options: categories.map((c) => ({ value: c.id, label: c.name })),
    },
    { type: 'toggle' as const, key: 'lowStock', label: 'Low stock' },
    { type: 'toggle' as const, key: 'showSku', label: 'Show SKU' },
  ];

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{skuMeta.total}</span>
          <span>products</span>
          <span>·</span>
          <span className="font-medium text-foreground">{movMeta.total}</span>
          <span>movements</span>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Log movement
        </Button>
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Stock Levels</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
        </TabsList>

        {/* ── Stock Levels tab ── */}
        <TabsContent value="stock" className="mt-4 space-y-3">
          <FilterBar
            filters={filterFields}
            values={{ ...filters, showSku: showSkuCol }}
            onChange={(v) => {
              setShowSkuCol(v.showSku === true);
              const { showSku: _, ...rest } = v;
              setFilters(rest);
            }}
            onExport={handleExport}
            exportLabel="Export CSV"
          />

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <div className="min-w-[440px]">
              <div className="border-b border-border/60 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <div className={`grid items-center gap-3 ${showSkuCol ? 'grid-cols-[2fr_1fr_120px_80px_80px_80px]' : 'grid-cols-[2fr_1fr_80px_80px_80px]'}`}>
                  <span>Product</span>
                  <span>Category</span>
                  {showSkuCol && <span>SKU Code</span>}
                  <span className="text-right">In Stock</span>
                  <span className="text-right">Cost</span>
                  <span className="text-right">Price</span>
                </div>
              </div>

              {skus.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No products found.
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {skus.map((sku) => (
                    <div
                      key={sku.id}
                      className={`grid items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 ${showSkuCol ? 'grid-cols-[2fr_1fr_120px_80px_80px_80px]' : 'grid-cols-[2fr_1fr_80px_80px_80px]'}`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <ProductThumb label={`${sku.code} ${sku.name}`} size={36} className="rounded-lg shrink-0" />
                        <span className="truncate text-sm font-medium">{sku.name}</span>
                      </div>
                      <span className="truncate text-xs text-muted-foreground">{sku.product.category.name}</span>
                      {showSkuCol && (
                        <span className="font-mono text-xs text-muted-foreground">{sku.code}</span>
                      )}
                      <div className={`text-right text-sm font-bold tabular-nums ${stockColor(sku)}`}>
                        {sku.stockOnHand}
                      </div>
                      <div className="text-right text-xs text-muted-foreground tabular-nums">
                        {sku.costCents != null ? formatCents(sku.costCents) : '—'}
                      </div>
                      <div className="text-right text-xs text-muted-foreground tabular-nums">
                        {sku.priceCents != null ? formatCents(sku.priceCents) : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {skuMeta.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    Page <span className="font-medium text-foreground">{skuMeta.page}</span> of{' '}
                    <span className="font-medium text-foreground">{skuMeta.totalPages}</span>
                  </span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" disabled={skuPage <= 1} onClick={() => setSkuPage((p) => p - 1)} aria-label="Previous page">‹</Button>
                    <Button variant="outline" size="icon" disabled={skuPage >= skuMeta.totalPages} onClick={() => setSkuPage((p) => p + 1)} aria-label="Next page">›</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Movements tab ── */}
        <TabsContent value="movements" className="mt-4">
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <div className="min-w-[550px]">
            <div className="border-b border-border/60 px-4 py-3">
              <div className="text-sm font-medium">Movement log</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                IN increases stock · OUT decreases stock · ADJUSTMENT corrects counts.
              </div>
            </div>

            <div className="grid grid-cols-[1fr_90px_92px_1fr_110px] gap-0 border-b border-border/60 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <span>SKU</span>
              <span>Type</span>
              <span className="text-right">Qty</span>
              <span>Note</span>
              <span className="text-right">Date</span>
            </div>

            {movements.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="text-sm font-medium">No movements yet</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Log your first stock movement to start tracking inventory.
                </div>
                <div className="mt-4">
                  <Button onClick={() => setAddOpen(true)}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Log movement
                  </Button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {movements.map((m) => {
                  const Icon = MOVEMENT_ICON[m.type] ?? ArrowLeftRight;
                  const color = MOVEMENT_COLOR[m.type] ?? '';
                  return (
                    <div
                      key={m.id}
                      className="grid grid-cols-[1fr_90px_92px_1fr_110px] items-center gap-0 px-4 py-3 text-sm transition-colors hover:bg-muted/30"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <ProductThumb label={`${m.sku.code} ${m.sku.name}`} size={36} className="rounded-lg shrink-0" />
                        <div className="min-w-0">
                          <span className="block truncate font-medium">{m.sku.code}</span>
                          <span className="block truncate text-xs text-muted-foreground">{m.sku.name}</span>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1.5 ${color}`}>
                        <Icon className="h-3.5 w-3.5" />
                        <span className="text-xs font-semibold">{m.type}</span>
                      </div>
                      <div className={`text-right font-mono text-sm font-bold ${color}`}>
                        {m.type === 'OUT' ? '-' : '+'}
                        {Math.abs(m.quantity)}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{m.note ?? '—'}</div>
                      <div className="text-right text-xs text-muted-foreground">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {movMeta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  Page <span className="font-medium text-foreground">{movMeta.page}</span> of{' '}
                  <span className="font-medium text-foreground">{movMeta.totalPages}</span>
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" disabled={movPage <= 1} onClick={() => setMovPage((p) => p - 1)} aria-label="Previous page">‹</Button>
                  <Button variant="outline" size="icon" disabled={movPage >= movMeta.totalPages} onClick={() => setMovPage((p) => p + 1)} aria-label="Next page">›</Button>
                </div>
              </div>
            )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

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
