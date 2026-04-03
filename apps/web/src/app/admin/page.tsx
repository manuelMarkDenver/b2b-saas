"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { getToken, clearToken } from "@/lib/auth";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";

type TenantFeatures = {
  inventory: boolean;
  orders: boolean;
  payments: boolean;
  marketplace: boolean;
  reports: boolean;
  stockTransfers: boolean;
  paymentTerms: boolean;
  multipleBranches: boolean;
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
  businessType: string;
  features: TenantFeatures;
  maxBranches: number;
  createdAt: string;
  _count: { memberships: number; branches: number };
};

const FLAG_KEYS: (keyof TenantFeatures)[] = ["inventory", "orders", "payments", "reports", "marketplace", "stockTransfers", "paymentTerms", "multipleBranches"];

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
  } catch { /* ignore */ }
  try {
    const text = await res.text();
    if (text) return text;
  } catch { /* ignore */ }
  return "";
}

export default function AdminPage() {
  const router = useRouter();
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [status, setStatus] = React.useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [updating, setUpdating] = React.useState<string | null>(null);
  const [authChecked, setAuthChecked] = React.useState(false);
  const [maxBranchesEdit, setMaxBranchesEdit] = React.useState<Record<string, string>>({});
  const { pushToast } = useToast();

  function handleLogout() {
    clearToken();
    router.push('/login');
  }

  React.useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    apiFetch("/auth/me").then(async (res) => {
      if (!res.ok) { router.replace("/login"); return; }
      const { user } = await res.json() as { user: { isPlatformAdmin: boolean } };
      if (!user.isPlatformAdmin) { router.replace("/login"); return; }
      setAuthChecked(true);
    }).catch(() => router.replace("/login"));
  }, [router]);

  async function loadTenants() {
    setStatus({ kind: "info", text: "Loading tenants..." });
    const res = await apiFetch("/admin/tenants");
    if (!res.ok) {
      const msg = await readApiError(res);
      setStatus({ kind: "error", text: `Failed to load tenants: ${res.status}${msg ? ` (${msg})` : ""}` });
      return;
    }
    setTenants(await res.json() as Tenant[]);
    setStatus(null);
  }

  React.useEffect(() => { if (authChecked) loadTenants(); }, [authChecked]);

  async function saveMaxBranches(tenantId: string) {
    const val = parseInt(maxBranchesEdit[tenantId] ?? "1", 10);
    if (isNaN(val) || val < 1) return;
    setUpdating(`${tenantId}-maxBranches`);
    const res = await apiFetch(`/admin/tenants/${tenantId}/limits`, {
      method: "PATCH",
      body: JSON.stringify({ maxBranches: val }),
    });
    if (!res.ok) {
      const msg = await readApiError(res);
      setStatus({ kind: "error", text: `Update failed: ${res.status}${msg ? ` (${msg})` : ""}` });
    } else {
      pushToast({ variant: "success", title: "Branch limit updated", message: `Max branches → ${val}` });
      await loadTenants();
    }
    setUpdating(null);
  }

  async function toggleFlag(tenantId: string, flag: keyof TenantFeatures, current: boolean) {
    setUpdating(`${tenantId}-${flag}`);
    const res = await apiFetch(`/admin/tenants/${tenantId}/features`, {
      method: "PATCH",
      body: JSON.stringify({ [flag]: !current }),
    });

    if (!res.ok) {
      const msg = await readApiError(res);
      setStatus({ kind: "error", text: `Update failed: ${res.status}${msg ? ` (${msg})` : ""}` });
    } else {
      pushToast({ variant: "success", title: "Feature flag updated", message: `${flag} → ${!current}` });
      await loadTenants();
    }
    setUpdating(null);
  }

  if (!authChecked) return null;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold">Super Admin</span>
          <button
            onClick={handleLogout}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Super Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage tenants and feature flags.</p>
        </div>

        {status ? (
          <div className="mb-4">
            <Alert variant={status.kind === "error" ? "error" : "info"}>{status.text}</Alert>
          </div>
        ) : null}

        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <div className="text-sm font-medium">Tenants ({tenants.length})</div>
          </div>
          <div className="divide-y divide-border">
            {tenants.map((tenant) => (
              <div key={tenant.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">{tenant.name}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      /{tenant.slug} · {tenant.businessType.replace("_", " ")} · {tenant._count.memberships} member{tenant._count.memberships !== 1 ? "s" : ""} · {tenant._count.branches} branch{tenant._count.branches !== 1 ? "es" : ""}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground">Max branches:</span>
                      <input
                        type="number"
                        min={1}
                        value={maxBranchesEdit[tenant.id] ?? String(tenant.maxBranches)}
                        onChange={(e) => setMaxBranchesEdit((m) => ({ ...m, [tenant.id]: e.target.value }))}
                        className="w-14 rounded border border-input bg-background px-2 py-0.5 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <button
                        type="button"
                        disabled={updating === `${tenant.id}-maxBranches`}
                        onClick={() => saveMaxBranches(tenant.id)}
                        className="rounded bg-muted px-2 py-0.5 text-xs hover:bg-muted/80 disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                    {tenant.features.multipleBranches && tenant.maxBranches <= 1 && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">
                        Multi-branch is ON but max is 1 — set max ≥ 2 to allow adding branches.
                      </p>
                    )}
                    {!tenant.features.multipleBranches && tenant.maxBranches > 1 && (
                      <p className="text-[10px] text-muted-foreground">
                        Enable the multipleBranches flag to unlock branch creation.
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {FLAG_KEYS.map((flag) => {
                    const enabled = tenant.features[flag];
                    const key = `${tenant.id}-${flag}`;
                    return (
                      <button
                        key={flag}
                        type="button"
                        disabled={updating === key}
                        onClick={() => toggleFlag(tenant.id, flag, enabled)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                          enabled
                            ? "bg-green-500/15 text-green-600 dark:text-green-400 hover:bg-green-500/25"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {flag} {enabled ? "ON" : "OFF"}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
