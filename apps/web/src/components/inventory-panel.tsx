'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Plus, ArrowUp, ArrowDown, ArrowLeftRight, Minus, ChevronUp, ChevronDown, ChevronsUpDown, Check, Pencil, Upload } from 'lucide-react';
import { isStaff } from '@/lib/user-role';
import { apiFetch } from '@/lib/api';
import { formatCents } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FilterBar, FilterValues } from '@/components/ui/filter-bar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/components/ui/toast';
import { ProductThumb } from '@/components/product-thumb';
import { ImageUpload } from '@/components/image-upload';
import {
  parseCsvPreview, validateCsvHeaders, allHeadersPresent,
  REQUIRED_CSV_HEADERS, CATALOG_CSV_COLUMNS,
  type CsvPreview,
} from '@/lib/csv';

type Category = { id: string; name: string; slug: string };

type Movement = {
  id: string;
  type: string;
  quantity: number;
  note?: string;
  reason?: string;
  approvalStatus: string;
  referenceType: string;
  createdAt: string;
  sku: { code: string; name: string; imageUrl?: string | null };
  actor?: { id: string; email: string } | null;
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
  const [movFilter, setMovFilter] = useState<FilterValues>({});
  const [pendingCount, setPendingCount] = useState(0);

  // Add movement dialog
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ skuId: '', type: 'IN', quantity: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [skuPickerOpen, setSkuPickerOpen] = useState(false);
  const [skuSearch, setSkuSearch] = useState('');

  // Quick adjust dialog
  const [adjustSku, setAdjustSku] = useState<{ id: string; name: string; direction: 'IN' | 'OUT' } | null>(null);
  const [adjustQty, setAdjustQty] = useState('1');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);
  const staffMode = isStaff(tenantSlug);

  // Edit product dialog
  const [editSku, setEditSku] = useState<Sku | null>(null);
  const [editForm, setEditForm] = useState({ name: '', costCents: '', priceCents: '', lowStockThreshold: '', imageUrl: '' });
  const [editSaving, setEditSaving] = useState(false);

  // CSV import dialog
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; updated: number; skipped: number; errors: { row: number; reason: string }[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Auto-parse CSV as soon as a file is selected — gives instant preview feedback
  useEffect(() => {
    if (!importFile) { setCsvPreview(null); return; }
    importFile.text().then((text) => setCsvPreview(parseCsvPreview(text)));
  }, [importFile]);

  // Movement sort
  const [movSortKey, setMovSortKey] = useState<'createdAt' | 'quantity' | 'type'>('createdAt');
  const [movSortDir, setMovSortDir] = useState<'asc' | 'desc'>('desc');

  function toggleMovSort(key: typeof movSortKey) {
    if (movSortKey === key) setMovSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setMovSortKey(key); setMovSortDir('desc'); }
  }

  const sortedMovements = useMemo(() => {
    return [...movements].sort((a, b) => {
      const dir = movSortDir === 'asc' ? 1 : -1;
      if (movSortKey === 'quantity') return dir * (a.quantity - b.quantity);
      if (movSortKey === 'type') return dir * a.type.localeCompare(b.type);
      return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });
  }, [movements, movSortKey, movSortDir]);

  // SKU sort
  const [skuSortKey, setSkuSortKey] = useState<'name' | 'stockOnHand' | 'priceCents' | 'costCents'>('name');
  const [skuSortDir, setSkuSortDir] = useState<'asc' | 'desc'>('asc');

  function toggleSkuSort(key: typeof skuSortKey) {
    if (skuSortKey === key) setSkuSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSkuSortKey(key); setSkuSortDir('asc'); }
  }

  const sortedSkus = useMemo(() => {
    return [...skus].sort((a, b) => {
      const dir = skuSortDir === 'asc' ? 1 : -1;
      if (skuSortKey === 'stockOnHand') return dir * (a.stockOnHand - b.stockOnHand);
      if (skuSortKey === 'priceCents') return dir * ((a.priceCents ?? 0) - (b.priceCents ?? 0));
      if (skuSortKey === 'costCents') return dir * ((a.costCents ?? 0) - (b.costCents ?? 0));
      return dir * a.name.localeCompare(b.name);
    });
  }, [skus, skuSortKey, skuSortDir]);

  // New product dialog
  const [productOpen, setProductOpen] = useState(false);
  const [productForm, setProductForm] = useState({
    categoryId: '',
    name: '',
    costCents: '',
    priceCents: '',
    initialQty: '',
    note: '',
    imageUrl: '',
  });
  const [autoSkuCode, setAutoSkuCode] = useState('');
  const [productSaving, setProductSaving] = useState(false);
  const skuCodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const params = new URLSearchParams({ page: String(movPage), limit: '20' });
    if (movFilter.approvalStatus) params.set('approvalStatus', movFilter.approvalStatus as string);
    if (movFilter.skuSearch) params.set('skuSearch', movFilter.skuSearch as string);
    const res = await apiFetch(`/inventory/movements?${params}`, { tenantSlug });
    if (res.ok) {
      const data = await res.json() as { data: Movement[]; meta: Meta };
      setMovements(data.data);
      setMovMeta(data.meta);
    }
    // Load pending count (always, regardless of filter)
    if (!staffMode) {
      const r2 = await apiFetch('/inventory/movements?approvalStatus=PENDING&limit=1', { tenantSlug });
      if (r2.ok) {
        const d2 = await r2.json() as { meta: Meta };
        setPendingCount(d2.meta.total);
      }
    }
  }, [tenantSlug, movPage, movFilter, staffMode]);

  useEffect(() => { loadSkus(); }, [loadSkus]);
  useEffect(() => { loadMovements(); }, [loadMovements]);

  // Reset page to 1 when filters change
  useEffect(() => { setSkuPage(1); }, [filters]);

  async function handleApprove(movementId: string) {
    const res = await apiFetch(`/inventory/movements/${movementId}/approve`, { method: 'PATCH', tenantSlug });
    if (res.ok) {
      pushToast({ variant: 'success', title: 'Approved', message: 'Stock has been updated.' });
      loadSkus();
      loadMovements();
    }
  }

  async function handleReject(movementId: string) {
    const res = await apiFetch(`/inventory/movements/${movementId}/reject`, { method: 'PATCH', tenantSlug });
    if (res.ok) {
      pushToast({ variant: 'info', title: 'Rejected', message: 'Movement has been rejected.' });
      loadMovements();
    }
  }

  async function handleQuickAdjust(e: React.FormEvent) {
    e.preventDefault();
    if (!adjustSku) return;
    setAdjustSaving(true);
    try {
      const res = await apiFetch('/inventory/movements', {
        method: 'POST',
        tenantSlug,
        body: JSON.stringify({
          skuId: adjustSku.id,
          type: adjustSku.direction,
          quantity: parseInt(adjustQty, 10),
          referenceType: 'MANUAL',
          reason: adjustReason || undefined,
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
          title: isPending ? 'Sent for approval' : 'Stock updated',
          message: isPending
            ? 'Your adjustment is pending admin approval.'
            : `${adjustSku.direction === 'IN' ? '+' : '-'}${adjustQty} units applied.`,
        });
        setAdjustSku(null);
        setAdjustQty('1');
        setAdjustReason('');
        loadSkus();
        loadMovements();
      }
    } finally {
      setAdjustSaving(false);
    }
  }

  function onProductCategoryChange(categoryId: string) {
    setProductForm((f) => ({ ...f, categoryId }));
    setAutoSkuCode('…');
    if (skuCodeDebounceRef.current) clearTimeout(skuCodeDebounceRef.current);
    skuCodeDebounceRef.current = setTimeout(async () => {
      const res = await apiFetch(`/skus/next-code?categoryId=${categoryId}`, { tenantSlug });
      if (res.ok) {
        const d = await res.json() as { code: string };
        setAutoSkuCode(d.code ?? '');
      }
    }, 300);
  }

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    setProductSaving(true);
    try {
      const body: Record<string, unknown> = {
        categoryId: productForm.categoryId,
        name: productForm.name,
      };
      if (productForm.costCents) body.costCents = Math.round(parseFloat(productForm.costCents) * 100);
      if (productForm.priceCents) body.priceCents = Math.round(parseFloat(productForm.priceCents) * 100);
      if (productForm.initialQty) body.initialQty = parseInt(productForm.initialQty, 10);
      if (productForm.note) body.note = productForm.note;
      if (productForm.imageUrl) body.imageUrl = productForm.imageUrl;

      const res = await apiFetch('/products/with-stock', {
        method: 'POST',
        tenantSlug,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        pushToast({ variant: 'error', title: 'Failed', message: err.message ?? 'Unknown error' });
      } else {
        pushToast({ variant: 'success', title: 'Product created', message: 'Product and initial stock logged.' });
        setProductOpen(false);
        setProductForm({ categoryId: '', name: '', costCents: '', priceCents: '', initialQty: '', note: '', imageUrl: '' });
        setAutoSkuCode('');
        loadSkus();
        loadMovements();
      }
    } finally {
      setProductSaving(false);
    }
  }

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
        setSkuSearch('');
        loadSkus();
        loadMovements();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSku(e: React.FormEvent) {
    e.preventDefault();
    if (!editSku || !editForm.name.trim()) return;
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = { name: editForm.name.trim() };
      if (editForm.priceCents !== '') body.priceCents = Math.round(parseFloat(editForm.priceCents) * 100);
      if (editForm.costCents !== '') body.costCents = Math.round(parseFloat(editForm.costCents) * 100);
      body.lowStockThreshold = parseInt(editForm.lowStockThreshold || '0', 10);
      if (editForm.imageUrl) body.imageUrl = editForm.imageUrl;
      const res = await apiFetch(`/skus/${editSku.id}`, { method: 'PATCH', tenantSlug, body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        pushToast({ variant: 'error', title: 'Failed', message: err.message ?? 'Unknown error' });
      } else {
        pushToast({ variant: 'success', title: 'Product updated', message: `${editForm.name} has been updated.` });
        setEditSku(null);
        loadSkus();
      }
    } finally {
      setEditSaving(false);
    }
  }

  async function handleCsvImport() {
    if (!importFile || !csvPreview || !allHeadersPresent(csvPreview.headers)) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await apiFetch('/catalog/import', { tenantSlug, method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        pushToast({ variant: 'error', title: 'Import failed', message: err.message ?? `Error ${res.status}` });
        return;
      }
      const result = await res.json() as typeof importResult;
      setImportResult(result);
      setImportFile(null);
      setCsvPreview(null);
      if (importFileRef.current) importFileRef.current.value = '';
      const summary = `${result!.imported} added, ${result!.updated} updated, ${result!.skipped} skipped`;
      pushToast({ variant: result!.errors.length > 0 ? 'error' : 'success', title: 'Import complete', message: summary });
      if (result!.imported > 0 || result!.updated > 0) loadSkus();
    } finally {
      setImportLoading(false);
    }
  }

  function handleExportMovements() {
    const rows: string[][] = [['Product', 'SKU', 'Type', 'Qty', 'Status', 'Note', 'Reason', 'Actor', 'Date']];
    movements.forEach((m) => {
      rows.push([
        m.sku.name,
        m.sku.code,
        m.type,
        String(m.quantity),
        m.approvalStatus,
        m.note ?? '',
        m.reason ?? '',
        m.actor?.email ?? '',
        new Date(m.createdAt).toLocaleDateString(),
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stock-history.csv';
    a.click();
    URL.revokeObjectURL(url);
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
          <span>history entries</span>
        </div>
        <div className="flex gap-2">
          {!staffMode && (
            <Button variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Adjust Stock
            </Button>
          )}
          {!staffMode && (
            <Button variant="outline" onClick={() => { setImportOpen(true); setImportResult(null); setImportFile(null); setCsvPreview(null); }}>
              <Upload className="mr-1.5 h-4 w-4" />
              Import CSV
            </Button>
          )}
          <Button onClick={() => setProductOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New Product
          </Button>
        </div>
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Stock Levels</TabsTrigger>
          <TabsTrigger value="history" className="relative">
            History
            {!staffMode && pendingCount > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Stock Levels tab ── */}
        <TabsContent value="stock" className="mt-4 space-y-3">
          <FilterBar
            filters={filterFields}
            values={{ ...filters, showSku: showSkuCol }}
            onChange={(v) => {
              setShowSkuCol(v.showSku === true);
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { showSku: _, ...rest } = v;
              setFilters(rest);
            }}
            onExport={handleExport}
            exportLabel="Export CSV"
          />

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <div className="min-w-[440px]">
              <div className="border-b border-border/60 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <div className={`grid items-center gap-3 ${showSkuCol ? 'grid-cols-[2fr_1fr_120px_80px_80px_80px_auto]' : 'grid-cols-[2fr_1fr_80px_80px_80px_auto]'}`}>
                  <button type="button" onClick={() => toggleSkuSort('name')} className="flex items-center gap-1 hover:text-foreground text-left">
                    Product {skuSortKey === 'name' ? (skuSortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
                  </button>
                  <span>Category</span>
                  {showSkuCol && <span>SKU Code</span>}
                  <button type="button" onClick={() => toggleSkuSort('stockOnHand')} className="flex items-center justify-end gap-1 hover:text-foreground">
                    {skuSortKey === 'stockOnHand' ? (skuSortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-40" />} In Stock
                  </button>
                  <button type="button" onClick={() => toggleSkuSort('costCents')} className="flex items-center justify-end gap-1 hover:text-foreground">
                    {skuSortKey === 'costCents' ? (skuSortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-40" />} Cost
                  </button>
                  <button type="button" onClick={() => toggleSkuSort('priceCents')} className="flex items-center justify-end gap-1 hover:text-foreground">
                    {skuSortKey === 'priceCents' ? (skuSortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-40" />} Price
                  </button>
                  <span />
                </div>
              </div>

              {skus.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No products found.
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {sortedSkus.map((sku) => (
                    <div
                      key={sku.id}
                      className={`grid items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 ${showSkuCol ? 'grid-cols-[2fr_1fr_120px_80px_80px_80px_auto]' : 'grid-cols-[2fr_1fr_80px_80px_80px_auto]'}`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <ProductThumb src={sku.imageUrl} label={`${sku.code} ${sku.name}`} size={36} className="rounded-lg shrink-0" />
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
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => { setAdjustSku({ id: sku.id, name: sku.name, direction: 'IN' }); setAdjustQty('1'); setAdjustReason(''); }}
                          className="flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Increase stock"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setAdjustSku({ id: sku.id, name: sku.name, direction: 'OUT' }); setAdjustQty('1'); setAdjustReason(''); }}
                          className="flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Decrease stock"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        {!staffMode && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditSku(sku);
                              setEditForm({
                                name: sku.name,
                                costCents: sku.costCents != null ? String(sku.costCents / 100) : '',
                                priceCents: sku.priceCents != null ? String(sku.priceCents / 100) : '',
                                lowStockThreshold: String(sku.lowStockThreshold),
                                imageUrl: sku.imageUrl ?? '',
                              });
                            }}
                            className="flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                            title="Edit product"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
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

        {/* ── History tab ── */}
        <TabsContent value="history" className="mt-4 space-y-3">
          <FilterBar
            filters={[
              { type: 'search', key: 'skuSearch', placeholder: 'Search product or SKU…' },
              {
                type: 'select', key: 'approvalStatus', label: 'All statuses',
                options: [
                  { value: 'PENDING', label: pendingCount > 0 ? `Pending (${pendingCount})` : 'Pending' },
                  { value: 'APPROVED', label: 'Approved' },
                  { value: 'REJECTED', label: 'Rejected' },
                ],
              },
            ]}
            values={movFilter}
            onChange={(v) => { setMovFilter(v); setMovPage(1); }}
            onExport={handleExportMovements}
          />

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <div className="min-w-[620px]">

            <div className={`grid gap-0 border-b border-border/60 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground ${!staffMode ? 'grid-cols-[1fr_90px_60px_1fr_130px_100px_100px]' : 'grid-cols-[1fr_90px_60px_1fr_130px_110px]'}`}>
              <span>Product</span>
              <button type="button" onClick={() => toggleMovSort('type')} className="flex items-center gap-1 hover:text-foreground">
                Type {movSortKey === 'type' ? (movSortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
              </button>
              <button type="button" onClick={() => toggleMovSort('quantity')} className="flex items-center justify-end gap-1 hover:text-foreground">
                {movSortKey === 'quantity' ? (movSortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-40" />} Qty
              </button>
              <span>Note / Reason</span>
              <span>Actioned By</span>
              <button type="button" onClick={() => toggleMovSort('createdAt')} className="flex items-center justify-end gap-1 hover:text-foreground">
                {movSortKey === 'createdAt' ? (movSortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-40" />} Date
              </button>
              {!staffMode && <span className="text-right">Actions</span>}
            </div>

            {movements.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="text-sm font-medium">No history yet</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Use the +/- buttons on each product to log your first stock adjustment.
                </div>
                {!staffMode && (
                  <div className="mt-4">
                    <Button onClick={() => setAddOpen(true)}>
                      <Plus className="mr-1.5 h-4 w-4" />
                      Adjust Stock
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {sortedMovements.map((m) => {
                  const Icon = MOVEMENT_ICON[m.type] ?? ArrowLeftRight;
                  const color = MOVEMENT_COLOR[m.type] ?? '';
                  const isPending = m.approvalStatus === 'PENDING';
                  return (
                    <div
                      key={m.id}
                      className={`grid items-center gap-0 px-4 py-3 text-sm transition-colors hover:bg-muted/30 ${!staffMode ? 'grid-cols-[1fr_90px_60px_1fr_130px_100px_100px]' : 'grid-cols-[1fr_90px_60px_1fr_130px_110px]'} ${isPending ? 'bg-amber-50/40 dark:bg-amber-900/10' : ''}`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <ProductThumb src={m.sku.imageUrl} label={`${m.sku.code} ${m.sku.name}`} size={32} className="rounded-lg shrink-0" />
                        <div className="min-w-0">
                          <span className="block truncate text-xs font-medium">{m.sku.name}</span>
                          {isPending && (
                            <span className="text-[10px] font-semibold text-amber-600">Pending approval</span>
                          )}
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
                      <div className="min-w-0">
                        <div className="truncate text-xs text-muted-foreground">{m.note ?? m.reason ?? '—'}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-xs text-muted-foreground">{m.actor?.email ?? '—'}</div>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </div>
                      {!staffMode && (
                        <div className="flex justify-end gap-1">
                          {isPending ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApprove(m.id)}
                                className="rounded px-2 py-0.5 text-[11px] font-medium text-green-700 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReject(m.id)}
                                className="rounded px-2 py-0.5 text-[11px] font-medium text-red-700 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <span className={`text-[10px] font-medium ${m.approvalStatus === 'APPROVED' ? 'text-green-600' : 'text-red-500'}`}>
                              {m.approvalStatus === 'APPROVED' ? 'Approved' : 'Rejected'}
                            </span>
                          )}
                        </div>
                      )}
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

      {/* Quick adjust dialog */}
      <Dialog open={!!adjustSku} onOpenChange={(open) => { if (!open) setAdjustSku(null); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>
              {adjustSku?.direction === 'IN' ? 'Add stock' : 'Remove stock'}
              {adjustSku && <span className="ml-1 text-muted-foreground font-normal text-sm">— {adjustSku.name}</span>}
            </DialogTitle>
          </DialogHeader>
          {adjustSku && (
            <form onSubmit={handleQuickAdjust} className="space-y-4">
              {staffMode && (
                <p className="text-xs text-muted-foreground rounded-md bg-muted/60 px-3 py-2">
                  As a staff member your adjustment will be sent for admin approval.
                </p>
              )}
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label>Reason (optional)</Label>
                <Input
                  placeholder={adjustSku.direction === 'IN' ? 'e.g. Restocked from supplier' : 'e.g. Sold offline'}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAdjustSku(null)}>Cancel</Button>
                <Button
                  type="submit"
                  disabled={adjustSaving || !adjustQty || parseInt(adjustQty, 10) < 1}
                  className={adjustSku.direction === 'OUT' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
                >
                  {adjustSaving ? 'Saving…' : staffMode ? 'Submit for approval' : (adjustSku.direction === 'IN' ? 'Add stock' : 'Remove stock')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Product dialog */}
      <Dialog open={!!editSku} onOpenChange={(open) => { if (!open) setEditSku(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          {editSku && (
            <form onSubmit={handleEditSku} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Product name"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Cost (₱)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.costCents}
                    onChange={(e) => setEditForm((f) => ({ ...f, costCents: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Price (₱)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.priceCents}
                    onChange={(e) => setEditForm((f) => ({ ...f, priceCents: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Low Stock Threshold</Label>
                <Input
                  type="number"
                  min="0"
                  value={editForm.lowStockThreshold}
                  onChange={(e) => setEditForm((f) => ({ ...f, lowStockThreshold: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Photo</Label>
                <ImageUpload
                  currentUrl={editForm.imageUrl || null}
                  tenantSlug={tenantSlug}
                  size={64}
                  onUploaded={(url) => setEditForm((f) => ({ ...f, imageUrl: url }))}
                  onRemoved={() => setEditForm((f) => ({ ...f, imageUrl: '' }))}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditSku(null)}>Cancel</Button>
                <Button type="submit" disabled={editSaving || !editForm.name.trim()}>
                  {editSaving ? 'Saving…' : 'Save changes'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* New Product dialog */}
      <Dialog open={productOpen} onOpenChange={setProductOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Product</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProduct} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={productForm.categoryId} onValueChange={onProductCategoryChange}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Product name</Label>
              <Input
                placeholder="e.g. Chicken Wings 1kg"
                value={productForm.name}
                onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>

            {productForm.categoryId && (
              <div className="space-y-1 rounded-md bg-muted/50 px-3 py-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Auto SKU Code</p>
                <p className="font-mono text-sm font-semibold">{autoSkuCode || '—'}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Cost (₱)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={productForm.costCents}
                  onChange={(e) => setProductForm((f) => ({ ...f, costCents: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Price (₱)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  value={productForm.priceCents}
                  onChange={(e) => setProductForm((f) => ({ ...f, priceCents: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Initial stock qty</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={productForm.initialQty}
                onChange={(e) => setProductForm((f) => ({ ...f, initialQty: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Photo</Label>
              <ImageUpload
                currentUrl={productForm.imageUrl || null}
                tenantSlug={tenantSlug}
                size={64}
                onUploaded={(url) => setProductForm((f) => ({ ...f, imageUrl: url }))}
                onRemoved={() => setProductForm((f) => ({ ...f, imageUrl: '' }))}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProductOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={productSaving || !productForm.categoryId || !productForm.name}>
                {productSaving ? 'Creating…' : 'Create product'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add movement dialog */}
      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setSkuSearch(''); setSkuPickerOpen(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1.5">
              <Label>SKU</Label>
              <Popover open={skuPickerOpen} onOpenChange={setSkuPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm shadow-sm hover:bg-accent hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <span className={form.skuId ? 'text-foreground' : 'text-muted-foreground'}>
                      {form.skuId
                        ? (() => { const s = skus.find((x) => x.id === form.skuId); return s ? `${s.code} — ${s.name}` : 'Select SKU'; })()
                        : 'Select SKU'}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <div className="p-2 border-b border-border">
                    <Input
                      autoFocus
                      placeholder="Search SKU…"
                      value={skuSearch}
                      onChange={(e) => setSkuSearch(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto py-1">
                    {skus
                      .filter((s) => {
                        const q = skuSearch.toLowerCase();
                        return !q || s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
                      })
                      .map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => { setForm((f) => ({ ...f, skuId: s.id })); setSkuPickerOpen(false); setSkuSearch(''); }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-foreground text-left"
                        >
                          <Check className={`h-3.5 w-3.5 shrink-0 ${form.skuId === s.id ? 'text-primary' : 'invisible'}`} />
                          <span className="flex-1 min-w-0">
                            <span className="font-medium">{s.code}</span>
                            <span className="text-muted-foreground"> — {s.name}</span>
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">stock: {s.stockOnHand}</span>
                        </button>
                      ))}
                    {skus.filter((s) => {
                      const q = skuSearch.toLowerCase();
                      return !q || s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
                    }).length === 0 && (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No SKUs found.</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
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
              <Label>
                Reason <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g. Received from supplier, stock count correction…"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                required
              />
              <p className="text-xs text-muted-foreground">Required — this adjustment will be logged for audit.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || !form.skuId || !form.note.trim()}>
                {saving ? 'Saving…' : 'Save adjustment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── CSV Import dialog ──────────────────────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) { setImportFile(null); setCsvPreview(null); setImportResult(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Products from CSV</DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Instructions + template download */}
            <div className="flex items-start justify-between gap-4 rounded-lg bg-muted/50 px-4 py-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">How it works</p>
                <p className="text-xs text-muted-foreground">
                  Upload a CSV with the required columns. Existing SKU codes are updated; new ones are created.
                  Download the template to see sample data for every column.
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline"
                onClick={() => {
                  const header = REQUIRED_CSV_HEADERS.join(',');
                  const sample = CATALOG_CSV_COLUMNS.map((c) => c.example).join(',');
                  const blob = new Blob([[header, sample].join('\n')], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = 'zentral-products-template.csv'; a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download template
              </button>
            </div>

            {/* Drop zone */}
            <div
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-border'}`}
              onClick={() => importFileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setImportFile(f); }}
            >
              <input ref={importFileRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} />
              {importFile ? (
                <div className="flex items-center gap-2 text-sm">
                  <Upload className="h-4 w-4 text-primary" />
                  <span className="font-medium">{importFile.name}</span>
                  <button type="button" className="text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); setImportFile(null); if (importFileRef.current) importFileRef.current.value = ''; }}>
                    ✕
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Drop your CSV here or <span className="text-primary">browse</span></p>
                  <p className="text-xs text-muted-foreground/60">Accepts .csv files only</p>
                </div>
              )}
            </div>

            {/* Column validation — appears once file is parsed */}
            {csvPreview && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Column check ({validateCsvHeaders(csvPreview.headers).filter((v) => v.present).length}/{REQUIRED_CSV_HEADERS.length} required)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {validateCsvHeaders(csvPreview.headers).map((v) => (
                      <span key={v.key} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${v.present ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                        {v.present ? '✓' : '✗'} {v.label}
                      </span>
                    ))}
                  </div>
                  {!allHeadersPresent(csvPreview.headers) && (
                    <p className="text-xs text-destructive">
                      Fix the missing columns above, then re-upload. Download the template to see the exact header names.
                    </p>
                  )}
                </div>

                {/* Preview table */}
                {allHeadersPresent(csvPreview.headers) && csvPreview.rows.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Preview — first {csvPreview.rows.length} of {csvPreview.totalRows} rows
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-border/60">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50">
                          <tr>
                            {csvPreview.headers.map((h) => (
                              <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {csvPreview.rows.map((row, i) => (
                            <tr key={i} className="hover:bg-muted/30">
                              {row.map((cell, j) => (
                                <td key={j} className="px-3 py-2 text-foreground/80 whitespace-nowrap max-w-[160px] truncate" title={cell}>{cell || <span className="text-muted-foreground/40">—</span>}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{csvPreview.totalRows}</span> total rows will be processed
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Post-import result summary */}
            {importResult && (
              <div className="space-y-2">
                <div className="flex gap-4 text-xs">
                  <span className="font-semibold text-green-600">{importResult.imported} added</span>
                  <span className="font-semibold text-blue-600">{importResult.updated} updated</span>
                  <span className="text-muted-foreground">{importResult.skipped} skipped</span>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="max-h-28 overflow-y-auto rounded-lg bg-destructive/10 p-2 space-y-1">
                    {importResult.errors.map((e) => (
                      <p key={e.row} className="text-xs text-destructive">Row {e.row}: {e.reason}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Close</Button>
            <Button
              disabled={!importFile || !csvPreview || !allHeadersPresent(csvPreview.headers) || importLoading}
              onClick={handleCsvImport}
            >
              <Upload className="mr-1.5 h-4 w-4" />
              {importLoading ? 'Importing…' : `Import ${csvPreview?.totalRows ?? ''} rows`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
