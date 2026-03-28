import { MembershipsPanel } from "@/components/memberships-panel";
import { CatalogPanel } from "@/components/catalog-panel";
import { getTenantTheme } from "@/lib/tenant-theme";

type Props = {
  params: Promise<{ tenantSlug: string }>;
};

async function getHealth() {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) return { ok: false, error: "NEXT_PUBLIC_API_BASE_URL not set" };

  try {
    const res = await fetch(`${base}/health`, { cache: "no-store" });
    if (!res.ok) {
      return { ok: false, error: `API returned ${res.status}` };
    }
    return (await res.json()) as { ok: boolean };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "fetch failed" };
  }
}

export default async function TenantHome({ params }: Props) {
  const { tenantSlug } = await params;
  const tenant = getTenantTheme(tenantSlug);
  const health = await getHealth();

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-balance text-2xl font-semibold tracking-tight">
              {tenant.brandName} Dashboard
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Tenant dashboard — inventory, orders, and payments managed here.
            </p>
          </div>
          <div className="rounded-md bg-accent px-3 py-2 text-xs text-accent-foreground">
            API health: {health.ok ? "OK" : "DOWN"}
          </div>
        </div>

        {!health.ok && "error" in health ? (
          <p className="mt-3 text-sm text-destructive">{health.error}</p>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-sm font-medium">Tenant Theme Tokens (Stub)</div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="text-muted-foreground">primary</div>
            <div className="font-mono">{tenant.primary}</div>
            <div className="text-muted-foreground">accent</div>
            <div className="font-mono">{tenant.accent}</div>
            <div className="text-muted-foreground">radius</div>
            <div className="font-mono">{tenant.radius}</div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-sm font-medium">Platform Modules</div>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            <div>MS4 — Inventory movement logging</div>
            <div>MS5 — Orders management</div>
            <div>MS6 — Manual payment verification</div>
          </div>
        </div>
        <MembershipsPanel />
      </section>

      <CatalogPanel tenantSlug={tenantSlug} />
    </div>
  );
}
