export type DashboardWidgets = {
  ordersToday: boolean;
  pendingPayments: boolean;
  lowStock: boolean;
  revenue: boolean;
  revenueChart: boolean;
  ordersChart: boolean;
  ordersStatusChart: boolean;
  lowStockChart: boolean;
  branchBreakdown: boolean;
};

const DEFAULTS: DashboardWidgets = {
  ordersToday: true,
  pendingPayments: true,
  lowStock: true,
  revenue: true,
  revenueChart: true,
  ordersChart: true,
  ordersStatusChart: true,
  lowStockChart: true,
  branchBreakdown: true,
};

function key(tenantSlug: string) {
  return `dashboard:widgets:${tenantSlug}`;
}

export function getDashboardWidgets(tenantSlug: string): DashboardWidgets {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(key(tenantSlug));
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setDashboardWidgets(tenantSlug: string, prefs: DashboardWidgets) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key(tenantSlug), JSON.stringify(prefs));
}

export const WIDGET_LABELS: Record<keyof DashboardWidgets, string> = {
  ordersToday: 'Orders Today',
  pendingPayments: 'Pending Payments',
  lowStock: 'Low Stock Items',
  revenue: 'Revenue (range)',
  revenueChart: 'Revenue chart',
  ordersChart: 'Orders per day chart',
  ordersStatusChart: 'Orders by status chart',
  lowStockChart: 'Low stock chart',
  branchBreakdown: 'Branch breakdown',
};
