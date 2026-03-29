'use client';

import { useEffect, useState } from 'react';
import { ShoppingCart, CreditCard, Boxes, Package } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type Stat = { label: string; value: string | number; icon: React.ElementType; description: string };

interface DashboardStatsProps {
  tenantSlug: string;
}

export function DashboardStats({ tenantSlug }: DashboardStatsProps) {
  const [stats, setStats] = useState({
    skus: 0,
    orders: 0,
    payments: 0,
    lowStock: 0,
  });

  useEffect(() => {
    async function load() {
      const [skusRes, ordersRes, paymentsRes] = await Promise.all([
        apiFetch('/skus?limit=1', { tenantSlug }),
        apiFetch('/orders?limit=1', { tenantSlug }),
        apiFetch('/payments?limit=1', { tenantSlug }),
      ]);

      const skusData = skusRes.ok ? await skusRes.json() : null;
      const ordersData = ordersRes.ok ? await ordersRes.json() : null;
      const paymentsData = paymentsRes.ok ? await paymentsRes.json() : null;

      setStats({
        skus: skusData?.meta?.total ?? 0,
        orders: ordersData?.meta?.total ?? 0,
        payments: paymentsData?.meta?.total ?? 0,
        lowStock: 0,
      });
    }
    load();
  }, [tenantSlug]);

  const statCards: Stat[] = [
    { label: 'Total SKUs', value: stats.skus, icon: Package, description: 'Active products in catalog' },
    { label: 'Total Orders', value: stats.orders, icon: ShoppingCart, description: 'All-time orders' },
    { label: 'Total Payments', value: stats.payments, icon: CreditCard, description: 'All-time payments' },
    { label: 'Low Stock', value: stats.lowStock, icon: Boxes, description: 'Items below threshold' },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-2 text-2xl font-bold">{stat.value}</div>
            <p className="mt-1 text-xs text-muted-foreground">{stat.description}</p>
          </div>
        );
      })}
    </div>
  );
}
