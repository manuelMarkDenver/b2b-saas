"use client";

import * as React from "react";

import { apiFetch } from "@/lib/api";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { ProductThumb } from "@/components/product-thumb";

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
  isActive: boolean;
  isArchived: boolean;
  stockOnHand: number;
  lowStockThreshold: number;
  product: { id: string; name: string };
};

export function CatalogPanel({ tenantSlug }: { tenantSlug: string }) {
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [skus, setSkus] = React.useState<Sku[]>([]);
  const [status, setStatus] = React.useState<{ kind: "info" | "error"; text: string } | null>(
    null,
  );

  const [newProductName, setNewProductName] = React.useState("");
  const [newProductCategoryId, setNewProductCategoryId] = React.useState<string>("");

  const [newSkuProductId, setNewSkuProductId] = React.useState<string>("");
  const [newSkuCode, setNewSkuCode] = React.useState("");
  const [newSkuName, setNewSkuName] = React.useState("");
  const [newSkuLowStock, setNewSkuLowStock] = React.useState<number>(0);

  const { pushToast } = useToast();

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

  async function createProduct() {
    setStatus({ kind: "info", text: "Creating product..." });
    const res = await apiFetch("/products", {
      tenantSlug,
      method: "POST",
      body: JSON.stringify({
        name: newProductName,
        categoryId: newProductCategoryId,
      }),
    });

    if (!res.ok) {
      const msg = await readApiError(res);
      setStatus({
        kind: "error",
        text: `Create product failed: ${res.status}${msg ? ` (${msg})` : ""}`,
      });
      return;
    }

    setNewProductName("");
    pushToast({ variant: "success", title: "Product created", message: newProductName });
    await loadAll();
  }

  async function createSku() {
    setStatus({ kind: "info", text: "Creating SKU..." });
    const res = await apiFetch("/skus", {
      tenantSlug,
      method: "POST",
      body: JSON.stringify({
        productId: newSkuProductId,
        code: newSkuCode,
        name: newSkuName,
        lowStockThreshold: newSkuLowStock,
      }),
    });

    if (!res.ok) {
      const msg = await readApiError(res);
      setStatus({
        kind: "error",
        text: `Create SKU failed: ${res.status}${msg ? ` (${msg})` : ""}`,
      });
      return;
    }

    setNewSkuCode("");
    setNewSkuName("");
    pushToast({ variant: "success", title: "SKU created", message: newSkuCode });
    await loadAll();
  }

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

  React.useEffect(() => {
    if (!newProductCategoryId && categories.length > 0) {
      setNewProductCategoryId(categories[0].id);
    }
  }, [categories, newProductCategoryId]);

  React.useEffect(() => {
    if (!newSkuProductId && products.length > 0) {
      setNewSkuProductId(products[0].id);
    }
  }, [products, newSkuProductId]);

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Catalog (Milestone 4)</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Categories are platform-managed. Products/SKUs are tenant-scoped.
          </div>
        </div>
        <button
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          onClick={loadAll}
          type="button"
        >
          Refresh
        </button>
      </div>

      {status ? (
        <div className="mt-3">
          <Alert variant={status.kind === "error" ? "error" : "info"}>
            {status.text}
          </Alert>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-border/60 p-4">
          <div className="text-sm font-medium">Create Product</div>
          <div className="mt-3 space-y-2">
            <input
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              placeholder="Product name"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
            />
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={newProductCategoryId}
              onChange={(e) => setNewProductCategoryId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              className="h-9 w-full rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"
              type="button"
              onClick={createProduct}
              disabled={!newProductName.trim() || !newProductCategoryId}
            >
              Create Product
            </button>
          </div>
        </div>

        <div className="rounded-md border border-border/60 p-4">
          <div className="text-sm font-medium">Create SKU</div>
          <div className="mt-3 space-y-2">
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={newSkuProductId}
              onChange={(e) => setNewSkuProductId(e.target.value)}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              placeholder="SKU code (unique per tenant)"
              value={newSkuCode}
              onChange={(e) => setNewSkuCode(e.target.value)}
            />
            <input
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              placeholder="SKU name"
              value={newSkuName}
              onChange={(e) => setNewSkuName(e.target.value)}
            />
            <input
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              type="number"
              min={0}
              placeholder="Low stock threshold"
              value={newSkuLowStock}
              onChange={(e) => setNewSkuLowStock(Number(e.target.value))}
            />
            <button
              className="h-9 w-full rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"
              type="button"
              onClick={createSku}
              disabled={!newSkuProductId || !newSkuCode.trim() || !newSkuName.trim()}
            >
              Create SKU
            </button>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Stock starts at 0. Use inventory movements to add stock.
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
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
                    <button
                      type="button"
                      className="text-xs text-destructive hover:underline"
                      onClick={() => archiveProduct(p.id, p.name)}
                    >
                      Archive
                    </button>
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
                <div className="flex min-w-0 items-center gap-2">
                  <ProductThumb label={s.code} size={26} />
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
                    <button
                      type="button"
                      className="text-xs text-destructive hover:underline"
                      onClick={() => archiveSku(s.id, s.code)}
                    >
                      Archive
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
