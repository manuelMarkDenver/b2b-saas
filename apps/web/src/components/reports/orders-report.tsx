'use client';

import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { DateRangePicker, presetToRange, type DateRange } from '@/components/dashboard/date-range-picker';
import { apiFetch } from '@/lib/api';

type Order = {
  id: string;
  createdAt: string;
  customerRef: string | null;
  totalCents: number;
  status: string;
  itemCount: number;
  branchName: string | null;
};

type Props = {
  tenantSlug: string;
};

export function OrdersReport({ tenantSlug }: Props) {
  const [dateRange, setDateRange] = useState<DateRange>(() => presetToRange('month'));
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchOrders() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(
        `/reports/orders?from=${dateRange.from}&to=${dateRange.to}`,
        { tenantSlug },
      );
      if (!res.ok) throw new Error('Failed to fetch orders');
      const data = await res.json();
      setOrders(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchOrders();
  }, [dateRange, tenantSlug]);

  function handleExportCsv() {
    const headers = ['Order ID', 'Date', 'Customer Ref', 'Total (₱)', 'Status', 'Item Count', 'Branch'];
    const rows = orders.map((o) => [
      o.id,
      new Date(o.createdAt).toISOString().split('T')[0],
      o.customerRef ?? '',
      (o.totalCents / 100).toFixed(2),
      o.status,
      o.itemCount.toString(),
      o.branchName ?? '',
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-report-${dateRange.from}-${dateRange.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <button
          onClick={handleExportCsv}
          disabled={orders.length === 0 || loading}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {loading ? (
        <div className="py-8 text-center text-muted-foreground">Loading...</div>
      ) : orders.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">No orders found for the selected period.</div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[640px]">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Order ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Customer Ref</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-muted-foreground">Items</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">Branch</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm">{new Date(order.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm font-mono text-xs">{order.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-sm">{order.customerRef ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-right">₱{(order.totalCents / 100).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        order.status === 'CONFIRMED'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : order.status === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : order.status === 'CANCELLED'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right">{order.itemCount}</td>
                  <td className="px-4 py-3 text-sm">{order.branchName ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
