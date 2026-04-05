"use client";

import * as React from "react";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { getActiveBranchId } from "@/lib/branch";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ProductThumb } from "@/components/product-thumb";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreateItemModal } from "@/components/create-item-modal";
import { FilterBar, FilterField, FilterValues } from "@/components/ui/filter-bar";
import { ImageUpload } from "@/components/image-upload";
import { useTenantFeatures } from "@/lib/tenant-features-context";
import { isFeatureActive } from "@repo/shared";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";

async function readApiError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as unknown;
    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof (data as { message?: unknown }).message === "string"
    ) {
      return (data as { message: string }).message;
    }
  } catch {
    // ignore
  }

  try {
    const text = await res.text();
    if (text) return text;
  } catch {
    // ignore
  }

  return "";
}

function unwrapList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (
    typeof payload === "object" &&
    payload !== null &&
    "data" in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

type Category = {
  id: string;
  name: string;
  slug: string;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isArchived: boolean;
  category: { id: string; name: string; slug: string };
};

type Sku = {
  id: string;
  code: string;
  name: string;
  imageUrl?: string | null;
  isActive: boolean;
  isArchived: boolean;
  stockOnHand: number;
  lowStockThreshold: number;
  priceCents?: number | null;
  costCents?: number | null;
  product: { id: string; name: string; category: { id: string; name: string; slug: string } };
};

type ImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
};

type Meta = { total: number; page: number; limit: number; totalPages: number };

const CSV_TEMPLATE_HEADERS = 'productName,categorySlug,skuCode,skuName,pricePhp,costPhp,lowStockThreshold';

function downloadCsvTemplate() {
  const content = [
    CSV_TEMPLATE_HEADERS,
    'Example Product,fasteners,SKU-001,Standard Size,99.00,45.00,5',
  ].join('\n');
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'catalog-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function CatalogPanel({ tenantSlug }: { tenantSlug: string }) {
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [skus, setSkus] = React.useState<Sku[]>([]);
  const [skuMeta, setSkuMeta] = React.useState<Meta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [skuPage, setSkuPage] = React.useState(1);
  const [filters, setFilters] = React.useState<FilterValues>({});
  const [status, setStatus] = React.useState<{ kind: "info" | "error"; text: string } | null>(
    null,
  );

  // Sort state
  const [skuSortKey, setSkuSortKey] = React.useState<'name' | 'priceCents' | 'costCents' | 'lowStockThreshold'>('name');
  const [skuSortDir, setSkuSortDir] = React.useState<'asc' | 'desc'>('asc');

  // Create Item modal
  const [createItemOpen, setCreateItemOpen] = React.useState(false);

  // CSV Import state
  const [importFile, setImportFile] = React.useState<File | null>(null);
  const [importLoading, setImportLoading] = React.useState(false);
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = React.useState(false);

  // Edit sheet
  const [editOpen, setEditOpen] = React.useState(false);
  const [editProduct, setEditProduct] = React.useState<Product | null>(null);
  const [editSku, setEditSku] = React.useState<Sku | null>(null);
  const [editSkuCode, setEditSkuCode] = React.useState("");
  const [editSkuName, setEditSkuName] = React.useState("");
  const [editSkuPrice, setEditSkuPrice] = React.useState("");
  const [editSkuCost, setEditSkuCost] = React.useState("");
  const [editSkuLowStock, setEditSkuLowStock] = React.useState(0);
  const [editSkuImageUrl, setEditSkuImageUrl] = React.useState<string | null>(null);
  const [editSaving, setEditSaving] = React.useState(false);

  const { pushToast } = useToast();
  const [activeBranchId, setActiveBranchId] = React.useState<string | null>(null);
  const [branchStock, setBranchStock] = React.useState<Record<string, number>>({});

  React.useEffect(() => { setActiveBranchId(getActiveBranchId(tenantSlug)); }, [tenantSlug]);

  React.useEffect(() => {
    if (!activeBranchId) return;
    apiFetch(`/inventory/branch-stock?branchId=${activeBranchId}`, { tenantSlug })
      .then((r) => r.ok ? r.json() : {})
      .then((d: Record<string, number>) => setBranchStock(d))
      .catch(() => setBranchStock({}));
  }, [activeBranchId, tenantSlug]);

  const features = useTenantFeatures();
  const showAccounting = isFeatureActive('accounting', features);
  useUnsavedChanges(editOpen);

  async function handleImport() {
    if (!importFile) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const res = await apiFetch('/catalog/import', {
        tenantSlug,
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const msg = await readApiError(res);
        setStatus({ kind: 'error', text: `Import failed: ${res.status}${msg ? ` — ${msg}` : ''}` });
        return;
      }
      const result = await res.json() as ImportResult;
      setImportResult(result);
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      const summary = `${result.imported} added, ${result.updated} updated, ${result.skipped} skipped`;
      pushToast({ variant: result.errors.length > 0 ? 'error' : 'success', title: 'Import complete', message: summary });
      if (result.imported > 0 || result.updated > 0) await loadSkus();
    } finally {
      setImportLoading(false);
    }
  }

  const loadSkus = React.useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(skuPage), limit: '20' });
      if (filters.search) params.set('search', filters.search as string);
      if (filters.categoryId) params.set('categoryId', filters.categoryId as string);

      const [catsRes, skusRes] = await Promise.all([
        apiFetch("/categories"),
        apiFetch(`/skus?${params}`, { tenantSlug }),
      ]);

      if (!catsRes.ok) throw new Error(`Categories failed: ${catsRes.status}`);
      if (!skusRes.ok) throw new Error(`Items failed: ${skusRes.status}`);

      const cats = await catsRes.json() as unknown;
      const skuData = await skusRes.json() as { data: Sku[]; meta: Meta };

      setCategories(unwrapList<Category>(cats));
      setSkus(skuData.data);
      setSkuMeta(skuData.meta);
      setStatus(null);
    } catch (err) {
      setStatus({
        kind: "error",
        text: err instanceof Error ? err.message : "Unable to load items",
      });
    }
  }, [tenantSlug, skuPage, filters]);

  React.useEffect(() => {
    loadSkus();
  }, [loadSkus]);

  // Reset page when filters change
  React.useEffect(() => {
    setSkuPage(1);
  }, [filters]);

  async function archiveSku(id: string, code: string) {
    const res = await apiFetch(`/skus/${id}/archive`, { tenantSlug, method: 'PATCH' });
    if (!res.ok) {
      const msg = await readApiError(res);
      setStatus({ kind: 'error', text: `Archive failed: ${res.status}${msg ? ` (${msg})` : ''}` });
      return;
    }
    pushToast({ variant: 'success', title: 'Item archived', message: code });
    await loadSkus();
  }

  // Sort toggle
  function toggleSkuSort(key: typeof skuSortKey) {
    if (skuSortKey === key) setSkuSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSkuSortKey(key); setSkuSortDir('asc'); }
  }

  // Sorted SKUs (client-side sort)
  const sortedSkus = React.useMemo(() => {
    return [...skus].sort((a, b) => {
      const dir = skuSortDir === 'asc' ? 1 : -1;
      if (skuSortKey === 'priceCents') return dir * ((a.priceCents ?? 0) - (b.priceCents ?? 0));
      if (skuSortKey === 'costCents') return dir * ((a.costCents ?? 0) - (b.costCents ?? 0));
      if (skuSortKey === 'lowStockThreshold') return dir * (a.lowStockThreshold - b.lowStockThreshold);
      return dir * a.name.localeCompare(b.name);
    });
  }, [skus, skuSortKey, skuSortDir]);

  // Filter fields for FilterBar
  const filterFields: FilterField[] = React.useMemo(() => [
    { type: 'search', key: 'search', placeholder: 'Search items...' },
    { type: 'select', key: 'categoryId', label: 'All categories', options: categories.map(c => ({ value: c.id, label: c.name })) },
  ], [categories]);

  // Export CSV
  function handleExport() {
    const headers = showAccounting
      ? ['Name', 'SKU Code', 'Category', 'Cost', 'Price', 'Low Stock']
      : ['Name', 'SKU Code', 'Category', 'Price', 'Low Stock'];
    const rows: string[][] = [headers];
    sortedSkus.forEach((s) => {
      const row = [
        s.name,
        s.code,
        s.product.category.name,
        ...(showAccounting ? [s.costCents != null ? formatCents(s.costCents) : ''] : []),
        s.priceCents != null ? formatCents(s.priceCents) : '',
        String(s.lowStockThreshold),
      ];
      rows.push(row);
    });
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'items.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function openEditSku(sku: Sku) {
    setEditSku(sku);
    setEditProduct(null);
    setEditSkuCode(sku.code);
    setEditSkuName(sku.name);
    setEditSkuPrice(((sku.priceCents ?? 0) / 100).toString());
    setEditSkuCost(((sku.costCents ?? 0) / 100).toString());
    setEditSkuLowStock(sku.lowStockThreshold);
    setEditSkuImageUrl(sku.imageUrl ?? null);
    setEditOpen(true);
  }

  async function saveEditSku() {
    if (!editSku) return;
    setEditSaving(true);
    try {
      const res = await apiFetch(`/skus/${editSku.id}`, {
        tenantSlug,
        method: 'PATCH',
        body: JSON.stringify({
          code: editSkuCode,
          name: editSkuName,
          priceCents: Math.round(parseFloat(editSkuPrice) * 100),
          costCents: Math.round(parseFloat(editSkuCost) * 100),
          lowStockThreshold: editSkuLowStock,
          imageUrl: editSkuImageUrl,
        }),
      });
      if (res.ok) {
        pushToast({ variant: 'success', title: 'Item updated', message: editSkuCode });
        setEditOpen(false);
        await loadSkus();
      } else {
        const msg = await readApiError(res);
        pushToast({ variant: 'error', title: 'Update failed', message: msg });
      }
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <button
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          type="button"
          onClick={() => setCreateItemOpen(true)}
        >
          + Create Item
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm text-primary font-medium hover:bg-primary/10"
            onClick={() => setImportOpen(true)}
          >
            Import CSV
          </button>
          <button
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            onClick={loadSkus}
            type="button"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          if (file) { setImportFile(file); setImportResult(null); }
        }}
      />

      {status ? (
        <div className="mt-3">
          <Alert variant={status.kind === "error" ? "error" : "info"}>
            {status.text}
          </Alert>
        </div>
      ) : null}

      <FilterBar
          filters={filterFields}
          values={filters}
          onChange={setFilters}
          onExport={handleExport}
          exportLabel="Export CSV"
        />

        <div className="overflow-x-auto rounded-lg border">
          <div className="min-w-[440px]">
            <div className="border-b bg-muted/40 px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <div className={`grid items-center gap-3 ${showAccounting ? 'grid-cols-[2fr_1fr_90px_90px_100px_80px_120px]' : 'grid-cols-[2fr_1fr_90px_100px_80px_120px]'}`}>
              <button type="button" onClick={() => toggleSkuSort('name')} className="flex items-center gap-1 text-left hover:text-foreground">
                Item {skuSortKey === 'name' ? (skuSortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
              </button>
              <span>Category</span>
              {showAccounting && (
                <button type="button" onClick={() => toggleSkuSort('costCents')} className="flex items-center justify-end gap-1 hover:text-foreground">
                  {skuSortKey === 'costCents' ? (skuSortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-40" />} Cost
                </button>
              )}
              <button type="button" onClick={() => toggleSkuSort('priceCents')} className="flex items-center justify-end gap-1 hover:text-foreground">
                {skuSortKey === 'priceCents' ? (skuSortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-40" />} Price
              </button>
              <span className="text-right">In stock</span>
              <button type="button" onClick={() => toggleSkuSort('lowStockThreshold')} className="flex items-center justify-end gap-1 hover:text-foreground">
                {skuSortKey === 'lowStockThreshold' ? (skuSortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 opacity-40" />} Low Stock
              </button>
              <span className="text-right">Actions</span>
            </div>
            </div>

            {sortedSkus.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                No items found.
              </div>
            ) : (
              <div className="divide-y">
                {sortedSkus.map((s) => (
                  <div
                    key={s.id}
                    className={`grid items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 ${showAccounting ? 'grid-cols-[2fr_1fr_90px_90px_100px_80px_120px]' : 'grid-cols-[2fr_1fr_90px_100px_80px_120px]'} ${s.isArchived ? "opacity-50" : ""}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <ProductThumb src={s.imageUrl} label={`${s.code} ${s.name}`} size={40} className="rounded-md shrink-0" />
                      <span className="truncate text-sm font-medium">{s.name}</span>
                    </div>
                    <span className="truncate text-xs text-muted-foreground">{s.product.category.name}</span>
                    {showAccounting && (
                      <div className="text-right text-xs tabular-nums text-muted-foreground">
                        {s.costCents != null ? formatCents(s.costCents) : '—'}
                      </div>
                    )}
                    <div className="text-right text-xs tabular-nums text-muted-foreground">
                      {s.priceCents != null ? formatCents(s.priceCents) : '—'}
                    </div>
                    <div className="text-right text-xs tabular-nums font-medium">
                      {activeBranchId ? (branchStock[s.id] ?? 0) : s.stockOnHand}
                    </div>
                    <div className="text-right text-xs tabular-nums text-muted-foreground">
                      {s.lowStockThreshold}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      {s.isArchived ? (
                        <span className="text-xs text-muted-foreground">Archived</span>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => openEditSku(s)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-xs text-destructive hover:underline"
                            onClick={() => archiveSku(s.id, s.code)}
                          >
                            Archive
                          </button>
                        </>
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

      {/* CSV Import Modal */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Import from CSV</DialogTitle>
            <div className="mt-1 text-xs text-muted-foreground">
              Upserts products and SKUs.
            </div>
            <div className="mt-2 rounded-md bg-muted/50 p-3">
              <div className="mb-1 text-[11px] font-medium text-muted-foreground">Required headers:</div>
              <code className="block text-[11px] leading-relaxed text-foreground">
                {CSV_TEMPLATE_HEADERS}
              </code>
            </div>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <button
              type="button"
              className="text-sm text-primary underline-offset-2 hover:underline"
              onClick={downloadCsvTemplate}
            >
              Download template
            </button>

            <div
              className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-8 text-center transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-border'}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) { setImportFile(file); setImportResult(null); }
              }}
            >
              {importFile ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{importFile.name}</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); setImportFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Drop a CSV file here or <span className="text-primary">browse</span>
                </p>
              )}
            </div>

            <button
              type="button"
              className="h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
              disabled={!importFile || importLoading}
              onClick={handleImport}
            >
              {importLoading ? 'Importing…' : 'Import'}
            </button>

            {importResult && (
              <div className="space-y-2 text-sm">
                <div className="flex gap-4 text-xs">
                  <span className="font-medium text-green-600">{importResult.imported} added</span>
                  <span className="font-medium text-blue-600">{importResult.updated} updated</span>
                  <span className="font-medium text-muted-foreground">{importResult.skipped} skipped</span>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <div className="mb-1.5 text-xs font-semibold text-destructive">
                      {importResult.errors.length} row error{importResult.errors.length !== 1 ? 's' : ''}
                    </div>
                    <div className="space-y-1">
                      {importResult.errors.map((e, i) => (
                        <div key={i} className="flex gap-2 text-xs text-muted-foreground">
                          <span className="shrink-0 font-medium">Row {e.row}:</span>
                          <span>{e.reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Product/SKU Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editSku ? 'Edit SKU' : editProduct ? 'Edit Product' : 'Edit'}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            {editProduct && (
              <>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Product Name</label>
                    <input
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={editProduct.name}
                      onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Category</label>
                    <select
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={editProduct.category?.id ?? ''}
                      onChange={(e) => {
                        const cat = categories.find((c) => c.id === e.target.value);
                        if (cat && editProduct) {
                          setEditProduct({ ...editProduct, category: cat });
                        }
                      }}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-4 h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  disabled={!editProduct.name.trim()}
                  onClick={async () => {
                    if (!editProduct) return;
                    setEditSaving(true);
                    const res = await apiFetch(`/products/${editProduct.id}`, {
                      tenantSlug,
                      method: 'PATCH',
                      body: JSON.stringify({ name: editProduct.name.trim() }),
                    });
                    if (res.ok) {
                      pushToast({ variant: 'success', title: 'Product updated', message: '' });
                      setEditOpen(false);
                      await loadSkus();
                    } else {
                      const msg = await readApiError(res);
                      pushToast({ variant: 'error', title: 'Update failed', message: msg });
                    }
                    setEditSaving(false);
                  }}
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            )}
            {editSku && (
              <>
                {/* Hero image - large centered square */}
                <div className="mx-auto flex justify-center">
                  <ImageUpload
                    currentUrl={editSkuImageUrl}
                    tenantSlug={tenantSlug}
                    size={200}
                    resourceType="sku-image"
                    onUploaded={(url) => setEditSkuImageUrl(url)}
                    onRemoved={() => setEditSkuImageUrl(null)}
                  />
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">SKU Code</label>
                    <input
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={editSkuCode}
                      onChange={(e) => setEditSkuCode(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">SKU Name</label>
                    <input
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={editSkuName}
                      onChange={(e) => setEditSkuName(e.target.value)}
                    />
                  </div>
                  <div className={`grid gap-3 ${showAccounting ? 'grid-cols-2' : ''}`}>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Price (₱)</label>
                      <input
                        className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        type="number"
                        step="0.01"
                        value={editSkuPrice}
                        onChange={(e) => setEditSkuPrice(e.target.value)}
                      />
                    </div>
                    {showAccounting && (
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Cost (₱)</label>
                        <input
                          className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          type="number"
                          step="0.01"
                          value={editSkuCost}
                          onChange={(e) => setEditSkuCost(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Low Stock Threshold</label>
                    <input
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      type="number"
                      value={editSkuLowStock}
                      onChange={(e) => setEditSkuLowStock(Number(e.target.value))}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className="mt-4 h-10 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  disabled={editSaving || !editSkuCode.trim() || !editSkuName.trim()}
                  onClick={saveEditSku}
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Item Modal */}
      <CreateItemModal
        open={createItemOpen}
        onOpenChange={setCreateItemOpen}
        tenantSlug={tenantSlug}
        categories={categories}
        onCreated={loadSkus}
      />
    </div>
  );
}
