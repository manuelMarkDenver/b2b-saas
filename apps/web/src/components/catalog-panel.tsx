"use client";

import * as React from "react";

import { apiFetch } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { ProductThumb } from "@/components/product-thumb";
import { ImageUpload } from "@/components/image-upload";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CreateItemModal } from "@/components/create-item-modal";

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
  product: { id: string; name: string };
};

type ImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
};

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
  const [products, setProducts] = React.useState<Product[]>([]);
  const [skus, setSkus] = React.useState<Sku[]>([]);
  const [status, setStatus] = React.useState<{ kind: "info" | "error"; text: string } | null>(
    null,
  );

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
      if (result.imported > 0 || result.updated > 0) await loadAll();
    } finally {
      setImportLoading(false);
    }
  }

  async function loadAll() {
    setStatus({ kind: "info", text: "Loading catalog..." });
    try {
      const [catsRes, productsRes, skusRes] = await Promise.all([
        apiFetch("/categories"),
        apiFetch("/products", { tenantSlug }),
        apiFetch("/skus", { tenantSlug }),
      ]);

      if (!catsRes.ok) throw new Error(`Categories failed: ${catsRes.status}`);
      if (!productsRes.ok) throw new Error(`Products failed: ${productsRes.status}`);
      if (!skusRes.ok) throw new Error(`Skus failed: ${skusRes.status}`);

      const [cats, prods, skus] = await Promise.all([
        catsRes.json() as Promise<unknown>,
        productsRes.json() as Promise<unknown>,
        skusRes.json() as Promise<unknown>,
      ]);

      setCategories(unwrapList<Category>(cats));
      setProducts(unwrapList<Product>(prods));
      setSkus(unwrapList<Sku>(skus));
      setStatus(null);
    } catch (err) {
      setStatus({
        kind: "error",
        text: err instanceof Error ? err.message : "Unable to load catalog",
      });
    }
  }

  React.useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  async function archiveProduct(id: string, name: string) {
    const res = await apiFetch(`/products/${id}/archive`, { tenantSlug, method: 'PATCH' });
    if (!res.ok) {
      const msg = await readApiError(res);
      setStatus({ kind: 'error', text: `Archive failed: ${res.status}${msg ? ` (${msg})` : ''}` });
      return;
    }
    pushToast({ variant: 'success', title: 'Product archived', message: name });
    await loadAll();
  }

  async function updateSkuImage(skuId: string, imageUrl: string | null) {
    await apiFetch(`/skus/${skuId}`, {
      tenantSlug,
      method: 'PATCH',
      body: JSON.stringify({ imageUrl }),
    });
    await loadAll();
  }

  async function archiveSku(id: string, code: string) {
    const res = await apiFetch(`/skus/${id}/archive`, { tenantSlug, method: 'PATCH' });
    if (!res.ok) {
      const msg = await readApiError(res);
      setStatus({ kind: 'error', text: `Archive failed: ${res.status}${msg ? ` (${msg})` : ''}` });
      return;
    }
    pushToast({ variant: 'success', title: 'SKU archived', message: code });
    await loadAll();
  }

  function openEditProduct(product: Product) {
    setEditProduct(product);
    setEditSku(null);
    setEditOpen(true);
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
        pushToast({ variant: 'success', title: 'SKU updated', message: editSkuCode });
        setEditOpen(false);
        await loadAll();
      } else {
        const msg = await readApiError(res);
        pushToast({ variant: 'error', title: 'Update failed', message: msg });
      }
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Catalog</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Categories are platform-managed. Products/SKUs are tenant-scoped.
          </div>
        </div>
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
            onClick={loadAll}
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

      <div className="mt-5">
        <button
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          type="button"
          onClick={() => setCreateItemOpen(true)}
        >
          + Create Item
        </button>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-md border border-border/60 p-4">
          <div className="text-sm font-medium">Products</div>
          <div className="mt-3 space-y-2 text-sm">
            {products.length === 0 ? (
              <div className="text-muted-foreground">No products yet.</div>
            ) : null}
            {products.map((p) => (
              <div
                key={p.id}
                className={`flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background px-3 py-2 ${p.isArchived ? "opacity-50" : ""}`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <ProductThumb label={p.name} size={26} />
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.category.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.isArchived ? (
                    <span className="text-xs text-muted-foreground">Archived</span>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => openEditProduct(p)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs text-destructive hover:underline"
                        onClick={() => archiveProduct(p.id, p.name)}
                      >
                        Archive
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-border/60 p-4">
          <div className="text-sm font-medium">SKUs</div>
          <div className="mt-3 space-y-2 text-sm">
            {skus.length === 0 ? (
              <div className="text-muted-foreground">No SKUs yet.</div>
            ) : null}
            {skus.map((s) => (
              <div
                key={s.id}
                className={`flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background px-3 py-2 ${s.isArchived ? "opacity-50" : ""}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ImageUpload
                    currentUrl={s.imageUrl}
                    tenantSlug={tenantSlug}
                    size={48}
                    onUploaded={(url) => void updateSkuImage(s.id, url)}
                    onRemoved={() => void updateSkuImage(s.id, null)}
                  />
                  <div>
                    <div className="font-medium">{s.code} · {s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.product.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right text-xs text-muted-foreground">
                    <div>Stock: {s.stockOnHand}</div>
                    <div>Low: {s.lowStockThreshold}</div>
                  </div>
                  {s.isArchived ? (
                    <span className="text-xs text-muted-foreground">Archived</span>
                  ) : (
                    <div className="flex gap-2">
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
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CSV Import Modal */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Import from CSV</DialogTitle>
            <div className="mt-1 text-xs text-muted-foreground">
              Upserts products and SKUs.<br />Required headers:
              <code className="ml-1 break-all rounded bg-muted px-1 py-0.5 text-[11px]">
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
                      await loadAll();
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
                {/* Large optional image - 100% centered */}
                <div className="w-full">
                  <ImageUpload
                    currentUrl={editSkuImageUrl}
                    tenantSlug={tenantSlug}
                    size={200}
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
                  <div className="grid grid-cols-2 gap-3">
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
        onCreated={loadAll}
      />
    </div>
  );
}
