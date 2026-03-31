'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { ShoppingCart, CreditCard, AlertTriangle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { formatCents } from '@/lib/format';
import { getActiveBranchId, setActiveBranchId } from '@/lib/branch';
import { isStaff } from '@/lib/user-role';
import { DateRangePicker, presetToRange, type DateRange } from './date-range-picker';
import { BranchBreakdown } from './branch-breakdown';

// ── types ──────────────────────────────────────────────────────────────────

type Summary = {
  ordersToday: number;
  pendingPayments: number;
  lowStockSkus: number;
  revenueRangeCents: number;
};

type LowStockSku = {
  id: string;
  code: string;
  name: string;
  stockOnHand: number;
  lowStockThreshold: number;
};

type DashboardData = {
  summary: Summary;
  charts: {
    ordersByStatus: Record<string, number>;
    ordersPerDay: Array<{ date: string; count: number }>;
    revenuePerDay: Array<{ date: string; amountCents: number }>;
    topLowStock: LowStockSku[];
  };
};

// ── constants ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  CONFIRMED: '#3b82f6',
  COMPLETED: '#10b981',
  CANCELLED: '#ef4444',
};

const CHART_COLORS = {
  revenue: '#6366f1',
  orders: '#3b82f6',
  lowStock: '#ef4444',
  threshold: '#d1d5db',
};

const TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 8,
  border: '1px solid var(--color-border)',
  background: 'var(--color-background)',
  color: 'var(--color-foreground)',
};

// ── helpers ────────────────────────────────────────────────────────────────


function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// ── sub-components ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  description,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border bg-card p-5 ${highlight ? 'border-destructive/40' : 'border-border'}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${highlight ? 'text-destructive' : 'text-muted-foreground'}`} />
      </div>
      <div className={`mt-2 text-2xl font-bold ${highlight ? 'text-destructive' : ''}`}>{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────

export function DashboardStats({ tenantSlug }: { tenantSlug: string }) {
  const [range, setRange] = useState<DateRange>(presetToRange('7d'));
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  // Read active branch from global sidebar state (localStorage)
  const activeBranchId = getActiveBranchId(tenantSlug);
  const staffOnly = isStaff(tenantSlug);

  const load = useCallback(async (r: DateRange) => {
    setLoading(true);
    const url = `/dashboard?from=${r.from}&to=${r.to}`;
    // apiFetch auto-picks activeBranchId from localStorage when branchId not passed
    const res = await apiFetch(url, { tenantSlug });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [tenantSlug]);

  useEffect(() => { load(range); }, [range, load]);

  function handleRangeChange(r: DateRange) {
    setRange(r);
  }

  // Clicking a branch row switches the global branch (same as sidebar switcher)
  function handleBranchSelect(branchId: string | null) {
    setActiveBranchId(tenantSlug, branchId);
    window.location.reload();
  }

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-[104px] animate-pulse rounded-lg border border-border bg-muted/40" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-[260px] animate-pulse rounded-lg border border-border bg-muted/40" />
          ))}
        </div>
      </div>
    );
  }

  const s = data?.summary;
  const c = data?.charts;

  const statusData = c
    ? Object.entries(c.ordersByStatus).map(([status, count]) => ({ name: status, value: count }))
    : [];

  const revenueData = (c?.revenuePerDay ?? []).map((d) => ({
    date: formatDate(d.date),
    revenue: d.amountCents / 100,
  }));

  const ordersData = (c?.ordersPerDay ?? []).map((d) => ({
    date: formatDate(d.date),
    orders: d.count,
  }));

  const lowStockData = (c?.topLowStock ?? [])
    .filter((s) => s.stockOnHand <= s.lowStockThreshold)
    .slice(0, 8)
    .map((s) => ({
      name: s.name.length > 20 ? s.name.slice(0, 20) + '…' : s.name,
      stock: s.stockOnHand,
      threshold: s.lowStockThreshold,
    }));

  return (
    <div className="space-y-6">
      {/* Date range control */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing data from <span className="font-medium text-foreground">{range.from}</span> to{' '}
          <span className="font-medium text-foreground">{range.to}</span>
        </p>
        <DateRangePicker value={range} onChange={handleRangeChange} />
      </div>

      {/* Branch breakdown — only shown when "All branches" is selected in the sidebar */}
      {activeBranchId === null && (
        <BranchBreakdown
          tenantSlug={tenantSlug}
          range={range}
          activeBranchId={null}
          onSelectBranch={handleBranchSelect}
        />
      )}

      {/* Summary cards */}
      <div className={`grid gap-4 sm:grid-cols-2 ${staffOnly ? 'lg:grid-cols-2' : 'lg:grid-cols-4'}`}>
        <StatCard
          label="Orders Today"
          value={s?.ordersToday ?? 0}
          description="Orders created today"
          icon={ShoppingCart}
        />
        <StatCard
          label="Pending Payments"
          value={s?.pendingPayments ?? 0}
          description="Confirmed orders awaiting payment"
          icon={CreditCard}
          highlight={(s?.pendingPayments ?? 0) > 0}
        />
        {!staffOnly && (
          <>
            <StatCard
              label="Low Stock Items"
              value={s?.lowStockSkus ?? 0}
              description="Products at or below threshold"
              icon={AlertTriangle}
              highlight={(s?.lowStockSkus ?? 0) > 0}
            />
            <StatCard
              label="Revenue (range)"
              value={formatCents(s?.revenueRangeCents ?? 0)}
              description="Verified payments in selected range"
              icon={CreditCard}
            />
          </>
        )}
      </div>

      {/* Low stock alert badge for staff */}
      {staffOnly && (s?.lowStockSkus ?? 0) > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2.5 text-sm text-yellow-800 dark:border-yellow-800/40 dark:bg-yellow-900/20 dark:text-yellow-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span><span className="font-semibold">{s?.lowStockSkus}</span> product{(s?.lowStockSkus ?? 0) !== 1 ? 's' : ''} low on stock — check inventory.</span>
        </div>
      )}

      {/* Charts — row 1 (revenue hidden from staff) */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Revenue area chart — owner/admin only */}
        {!staffOnly && <ChartCard title="Revenue over time">
          {revenueData.length === 0 ? (
            <EmptyChart message="No verified payments in this range" />
          ) : (
            <ResponsiveContainer width="100%" height={200} style={{ background: 'transparent' }}>
              <AreaChart data={revenueData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.revenue} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={CHART_COLORS.revenue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₱${(v as number).toLocaleString()}`} width={70} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v) => [`₱${(v as number).toLocaleString()}`, 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke={CHART_COLORS.revenue} strokeWidth={2} fill="url(#revenueGrad)" dot={false} activeDot={{ r: 4 }} isAnimationActive />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>}

        {/* Orders per day bar chart */}
        <ChartCard title="Orders per day">
          {ordersData.length === 0 ? (
            <EmptyChart message="No orders in this range" />
          ) : (
            <ResponsiveContainer width="100%" height={200} style={{ background: 'transparent' }}>
              <BarChart data={ordersData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} allowDecimals={false} width={30} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v) => [v, 'Orders']}
                />
                <Bar dataKey="orders" fill={CHART_COLORS.orders} radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Charts — row 2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Order status donut */}
        <ChartCard title="Orders by status">
          {statusData.length === 0 ? (
            <EmptyChart message="No orders in this range" />
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    isAnimationActive
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {statusData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: STATUS_COLORS[entry.name] ?? '#94a3b8' }} />
                    <span className="text-muted-foreground capitalize">{entry.name.toLowerCase()}</span>
                    <span className="ml-auto font-semibold">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        {/* Low stock horizontal bar — owner/admin only */}
        {!staffOnly && <ChartCard title="Low stock products">
          {lowStockData.length === 0 ? (
            <EmptyChart message="All items are above threshold" />
          ) : (
            <ResponsiveContainer width="100%" height={200} style={{ background: 'transparent' }}>
              <BarChart
                layout="vertical"
                data={lowStockData}
                margin={{ top: 4, right: 20, left: 0, bottom: 0 }}
                barCategoryGap="30%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={110} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="threshold" fill={CHART_COLORS.threshold} radius={[0, 4, 4, 0]} maxBarSize={14} name="Threshold" isAnimationActive />
                <Bar dataKey="stock" fill={CHART_COLORS.lowStock} radius={[0, 4, 4, 0]} maxBarSize={14} name="In stock" isAnimationActive />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>}
      </div>
    </div>
  );
}
