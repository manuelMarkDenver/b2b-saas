'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PurchaseOrdersPanel } from '@/components/purchase-orders-panel';

export function PurchaseOrdersPageClient({ tenantSlug }: { tenantSlug: string }) {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/memberships', { tenantSlug })
      .then((r) => r.json())
      .then((memberships: Array<{ role: string; tenant: { slug: string }; status: string }>) => {
        const m = memberships.find((m) => m.tenant.slug === tenantSlug && m.status === 'ACTIVE');
        if (m) setRole(m.role);
      })
      .catch(() => {});
  }, [tenantSlug]);

  return <PurchaseOrdersPanel tenantSlug={tenantSlug} userRole={role} />;
}
