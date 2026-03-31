'use client';

import { useState, useEffect, useCallback } from 'react';
import { DateRangePicker, presetToRange, type DateRange } from '@/components/dashboard/date-range-picker';
import { apiFetch } from '@/lib/api';
import { formatCents } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderRow = {
  id: string;
  createdAt: string;
  customerRef: string | null;
  totalCents: number;
  status: string;
  itemCount: number;
  branchName: string | null;
};

type PaymentRow = {
  id: string;
  orderId: string;
  amountCents: number;
  status: string;
  proofUrl: string | null;
  createdAt: string;
  orderStatus: string;
  orderTotalCents: number;
  customerRef: string | null;
};

type InventoryRow = {
  id: string;
  skuCode: string;
  skuName: string;
  category: string;
  type: string;
  quantity: number;
  approvalStatus: string;
  note: string | null;
  reason: string | null;
  createdAt: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  CONFIRMED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  VERIFIED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  IN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  OUT: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  ADJUSTMENT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[status] ?? 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function OrdersReport({ tenantSlug }: { tenantSlug: string }) {
  const [dateRange, setDateRange] = useState<DateRange>(() => presetToRange('30d'));

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('orders');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = `from=${dateRange.from}&to=${dateRange.to}`;
      const [oRes, pRes, iRes] = await Promise.all([
        apiFetch(`/reports/orders?${params}`, { tenantSlug, branchId: null }),
        apiFetch(`/reports/payments?${params}`, { tenantSlug, branchId: null }),
        apiFetch(`/reports/inventory?${params}`, { tenantSlug, branchId: null }),
      ]);
      if (!oRes.ok || !pRes.ok || !iRes.ok) throw new Error('Failed to fetch report data');
      const [oData, pData, iData] = await Promise.all([oRes.json(), pRes.json(), iRes.json()]);
      setOrders(oData.data);
      setPayments(pData.data);
      setInventory(iData.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [dateRange, tenantSlug]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function exportOrders() {
    downloadCsv(
      [
        ['Order ID', 'Date', 'Customer Ref', 'Total', 'Status', 'Items', 'Branch'],
        ...orders.map((o) => [o.id, o.createdAt.slice(0, 10), o.customerRef ?? '', formatCents(o.totalCents), o.status, String(o.itemCount), o.branchName ?? '']),
      ],
      `orders-${dateRange.from}-${dateRange.to}.csv`,
    );
  }

  function exportPayments() {
    downloadCsv(
      [
        ['Payment ID', 'Order ID', 'Amount', 'Status', 'Customer Ref', 'Date'],
        ...payments.map((p) => [p.id, p.orderId, formatCents(p.amountCents), p.status, p.customerRef ?? '', p.createdAt.slice(0, 10)]),
      ],
      `payments-${dateRange.from}-${dateRange.to}.csv`,
    );
  }

  function exportInventory() {
    downloadCsv(
      [
        ['SKU Code', 'Product', 'Category', 'Type', 'Qty', 'Status', 'Note', 'Reason', 'Date'],
        ...inventory.map((r) => [r.skuCode, r.skuName, r.category, r.type, String(r.quantity), r.approvalStatus, r.note ?? '', r.reason ?? '', r.createdAt.slice(0, 10)]),
      ],
      `inventory-movements-${dateRange.from}-${dateRange.to}.csv`,
    );
  }

  return (
    <div className="space-y-4">
      {/* Date range + counts summary */}
      <div className="flex flex-wrap items-center gap-3">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        {!loading && (
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span><span className="font-semibold text-foreground">{orders.length}</span> orders</span>
            <span><span className="font-semibold text-foreground">{payments.length}</span> payments</span>
            <span><span className="font-semibold text-foreground">{inventory.length}</span> movements</span>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        {/* ── Orders tab ── */}
        <TabsContent value="orders" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={exportOrders} disabled={orders.length === 0 || loading}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : orders.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No orders in selected period.</div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[640px]">
                <thead className="border-b bg-muted/50">
                  <tr>
                    {['Date', 'Order ID', 'Customer Ref', 'Total', 'Status', 'Items', 'Branch'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-muted/40">
                      <td className="px-4 py-2.5 text-sm">{new Date(o.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{o.id.slice(0, 8)}</td>
                      <td className="px-4 py-2.5 text-sm">{o.customerRef ?? '—'}</td>
                      <td className="px-4 py-2.5 text-sm tabular-nums">{formatCents(o.totalCents)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={o.status} /></td>
                      <td className="px-4 py-2.5 text-sm text-right tabular-nums">{o.itemCount}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{o.branchName ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Payments tab ── */}
        <TabsContent value="payments" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={exportPayments} disabled={payments.length === 0 || loading}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : payments.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No payments in selected period.</div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[560px]">
                <thead className="border-b bg-muted/50">
                  <tr>
                    {['Date', 'Payment ID', 'Order ID', 'Amount', 'Status', 'Customer Ref'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/40">
                      <td className="px-4 py-2.5 text-sm">{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{p.id.slice(0, 8)}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{p.orderId.slice(0, 8)}</td>
                      <td className="px-4 py-2.5 text-sm tabular-nums">{formatCents(p.amountCents)}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{p.customerRef ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Inventory tab ── */}
        <TabsContent value="inventory" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={exportInventory} disabled={inventory.length === 0 || loading}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : inventory.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No inventory movements in selected period.</div>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[640px]">
                <thead className="border-b bg-muted/50">
                  <tr>
                    {['Date', 'Product', 'Category', 'Type', 'Qty', 'Status', 'Note'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {inventory.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/40">
                      <td className="px-4 py-2.5 text-sm">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5">
                        <div className="text-sm font-medium">{r.skuName}</div>
                        <div className="font-mono text-xs text-muted-foreground">{r.skuCode}</div>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{r.category}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={r.type} /></td>
                      <td className="px-4 py-2.5 text-sm tabular-nums font-medium">{r.quantity}</td>
                      <td className="px-4 py-2.5"><StatusBadge status={r.approvalStatus} /></td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">{r.note ?? r.reason ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
