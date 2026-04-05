'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getActiveBranchId } from '@/lib/branch';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';

type Sku = { id: string; code: string; name: string };
type Branch = { id: string; name: string };
type Meta = { total: number; page: number; limit: number; totalPages: number };

interface InventoryCountsPanelProps {
  tenantSlug: string;
}

export function InventoryCountsPanel({ tenantSlug }: InventoryCountsPanelProps) {
  const { pushToast } = useToast();
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [skuMeta, setSkuMeta] = useState<Meta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [skuPage, setSkuPage] = useState(1);
  const [skuSearch, setSkuSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  // Stock data
  const [expectedStock, setExpectedStock] = useState<Record<string, number>>({});
  const [actualCounts, setActualCounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; failed: number; errors: Array<{ name: string; message: string }> } | null>(null);

  useEffect(() => { setActiveBranchId(getActiveBranchId(tenantSlug)); }, [tenantSlug]);

  useEffect(() => {
    apiFetch('/categories', { tenantSlug }).then(async (r) => {
      if (r.ok) {
        const d = await r.json() as Array<{ id: string; name: string }>;
        setCategories(d);
      }
    });
    apiFetch('/branches', { tenantSlug }).then(async (r) => {
      if (r.ok) {
        const d = await r.json() as { branches: Branch[] } | Branch[];
        setBranches(Array.isArray(d) ? d : d.branches);
      }
    });
  }, [tenantSlug]);

  const loadSkus = useCallback(async () => {
    const params = new URLSearchParams({ page: String(skuPage), limit: '20' });
    if (skuSearch.trim()) params.set('search', skuSearch.trim());
    if (categoryId) params.set('categoryId', categoryId);
    const res = await apiFetch(`/skus?${params}`, { tenantSlug });
    if (res.ok) {
      const d = await res.json() as { data: Sku[]; meta: Meta };
      setSkus(d.data);
      setSkuMeta(d.meta);
    }
  }, [tenantSlug, skuPage, skuSearch, categoryId]);

  const loadExpectedStock = useCallback(async () => {
    if (!activeBranchId) return;
    const res = await apiFetch(`/inventory/branch-stock?branchId=${activeBranchId}`, { tenantSlug });
    if (res.ok) {
      const d = await res.json() as Record<string, number>;
      setExpectedStock(d);
    }
  }, [tenantSlug, activeBranchId]);

  useEffect(() => { loadSkus(); }, [loadSkus]);
  useEffect(() => { loadExpectedStock(); }, [loadExpectedStock]);

  function setActual(skuId: string, value: string) {
    setActualCounts((prev) => {
      const next = { ...prev };
      if (value === '') delete next[skuId];
      else next[skuId] = value;
      return next;
    });
  }

  function getDiff(skuId: string): number | null {
    const actual = actualCounts[skuId];
    if (actual === undefined || actual === '') return null;
    const actualNum = parseInt(actual, 10);
    if (isNaN(actualNum)) return null;
    const expected = expectedStock[skuId] ?? 0;
    return actualNum - expected;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeBranchId) return;

    const noteTrim = note.trim();
    if (!noteTrim) {
      pushToast({ variant: 'error', title: 'Notes required', message: 'Please enter count notes.' });
      return;
    }

    const enteredItems = Object.entries(actualCounts).filter(([, v]) => v !== '' && v !== undefined);
    if (enteredItems.length === 0) {
      pushToast({ variant: 'error', title: 'No items counted', message: 'Enter at least one actual count.' });
      return;
    }

    setSubmitting(true);
    setResult(null);

    // Re-fetch latest expected stock at submit time
    const res = await apiFetch(`/inventory/branch-stock?branchId=${activeBranchId}`, { tenantSlug });
    if (!res.ok) {
      pushToast({ variant: 'error', title: 'Failed to load expected stock', message: '' });
      setSubmitting(false);
      return;
    }
    const stockMap = await res.json() as Record<string, number>;

    let created = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ name: string; message: string }> = [];

    for (const [skuId, actualStr] of enteredItems) {
      const actualNum = parseInt(actualStr, 10);
      if (isNaN(actualNum)) continue;
      const expectedNow = stockMap[skuId] ?? 0;
      const diff = actualNum - expectedNow;
      if (diff === 0) { skipped++; continue; }

      const sku = skus.find((s) => s.id === skuId);
      const skuName = sku ? `${sku.code} ${sku.name}` : skuId;

      try {
        const movRes = await apiFetch('/inventory/movements', {
          method: 'POST',
          tenantSlug,
          branchId: activeBranchId,
          body: JSON.stringify({
            skuId,
            type: 'ADJUSTMENT',
            quantity: diff,
            referenceType: 'MANUAL',
            reason: 'Stock count correction',
            note: noteTrim,
          }),
        });
        if (movRes.ok) {
          created++;
        } else {
          const err = await movRes.json() as { message?: string };
          failed++;
          errors.push({ name: skuName, message: err.message ?? 'Unknown error' });
        }
      } catch {
        failed++;
        errors.push({ name: skuName, message: 'Network error' });
      }
    }

    setResult({ created, skipped, failed, errors });
    if (failed === 0) {
      pushToast({ variant: 'success', title: 'Count applied', message: `${created} adjustment${created !== 1 ? 's' : ''} created.` });
    } else if (created > 0) {
      pushToast({ variant: 'error', title: 'Count partially applied', message: `${created} created, ${failed} failed.` });
    } else {
      pushToast({ variant: 'error', title: 'Count failed', message: `${failed} adjustment${failed !== 1 ? 's' : ''} failed.` });
    }

    // Reset actual counts and refresh
    setActualCounts({});
    loadExpectedStock();
    loadSkus();
    setSubmitting(false);
  }

  const activeBranch = branches.find((b) => b.id === activeBranchId);

  return (
    <div className="space-y-6">
      {!activeBranchId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-900/20">
          <p className="text-sm text-amber-700 dark:text-amber-400">Select a branch to start a count.</p>
        </div>
      )}
      {activeBranchId && (
        <p className="text-xs text-muted-foreground">
          Counting stock for: <span className="font-medium text-foreground">{activeBranch?.name}</span>
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-2">
          <input
            type="search"
            placeholder="Search item…"
            className="h-8 rounded-md border border-input bg-background px-3 text-sm w-52"
            value={skuSearch}
            onChange={(e) => { setSkuSearch(e.target.value); setSkuPage(1); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { setSkuPage(1); loadSkus(); } }}
          />
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setSkuPage(1); }}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <Button type="button" size="sm" onClick={() => { setSkuPage(1); loadSkus(); }}>Apply</Button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border">
          <div className="min-w-[400px]">
            <div className="grid gap-3 border-b bg-muted/40 px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground grid-cols-[2fr_80px_100px_80px]">
              <span>Item</span>
              <span className="text-right">Expected</span>
              <span className="text-right">Actual</span>
              <span className="text-right">Diff</span>
            </div>

            {skus.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">No items found.</div>
            ) : (
              <div className="divide-y">
                {skus.map((s) => {
                  const expected = expectedStock[s.id] ?? 0;
                  const diff = getDiff(s.id);
                  const actual = actualCounts[s.id] ?? '';
                  return (
                    <div key={s.id} className="grid items-center gap-3 px-4 py-2.5 grid-cols-[2fr_80px_100px_80px]">
                      <div className="min-w-0">
                        <span className="block truncate text-xs font-medium">{s.name}</span>
                        <span className="text-[10px] text-muted-foreground">{s.code}</span>
                      </div>
                      <div className="text-right text-xs tabular-nums text-muted-foreground">{expected}</div>
                      <div>
                        <input
                          type="number"
                          min={0}
                          disabled={!activeBranchId}
                          value={actual}
                          onChange={(e) => setActual(s.id, e.target.value)}
                          placeholder="—"
                          className="w-full rounded-md border border-input bg-background px-2 py-1 text-right text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                        />
                      </div>
                      <div className={`text-right text-xs tabular-nums font-medium ${diff !== null ? (diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-muted-foreground') : ''}`}>
                        {diff !== null ? (diff > 0 ? `+${diff}` : diff) : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {skuMeta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <span className="text-xs text-muted-foreground">{skuMeta.total} items</span>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" disabled={skuPage <= 1} onClick={() => setSkuPage((p) => p - 1)}>‹</Button>
                  <Button variant="outline" size="icon" disabled={skuPage >= skuMeta.totalPages} onClick={() => setSkuPage((p) => p + 1)}>›</Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Count notes *</label>
          <input
            type="text"
            required
            disabled={!activeBranchId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Explain the purpose of this count"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        </div>

        {/* Submit */}
        <Button type="submit" disabled={!activeBranchId || submitting || !note.trim()}>
          {submitting ? 'Applying…' : 'Apply Count'}
        </Button>

        {/* Results */}
        {result && (
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex gap-4 text-sm">
              <span className="text-green-600">Created: {result.created}</span>
              <span className="text-muted-foreground">Skipped: {result.skipped}</span>
              {result.failed > 0 && <span className="text-red-500">Failed: {result.failed}</span>}
            </div>
            {result.errors.length > 0 && (
              <div className="space-y-1">
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-500">{err.name}: {err.message}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
