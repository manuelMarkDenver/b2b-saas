"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Users, Search, LogOut } from "lucide-react";
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
  status: string;
  businessType: string;
  features: TenantFeatures;
  maxBranches: number;
  createdAt: string;
  _count: { memberships: number; branches: number };
};

type AdminUser = {
  id: string;
  email: string;
  status: string;
  isPlatformAdmin: boolean;
  createdAt: string;
  _count: { memberships: number };
};

const FLAG_KEYS: (keyof TenantFeatures)[] = [
  "inventory", "orders", "payments", "reports",
  "marketplace", "stockTransfers", "paymentTerms", "multipleBranches",
];

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  general_retail: "General Retail",
  hardware: "Hardware",
  food_beverage: "Food & Beverage",
  pharmacy: "Pharmacy",
  electronics: "Electronics",
  clothing: "Clothing",
  other: "Other",
};

async function readApiError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as unknown;
    if (typeof data === "object" && data !== null && "message" in data &&
      typeof (data as { message?: unknown }).message === "string") {
      return (data as { message: string }).message;
    }
  } catch { /* ignore */ }
  try { const text = await res.text(); if (text) return text; } catch { /* ignore */ }
  return "";
}

export default function AdminPage() {
  const router = useRouter();
  const [section, setSection] = React.useState<"tenants" | "users">("tenants");
  const [authChecked, setAuthChecked] = React.useState(false);
  const { pushToast } = useToast();

  // Tenants state
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [tenantSearch, setTenantSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "ACTIVE" | "SUSPENDED">("all");
  const [error, setError] = React.useState<string | null>(null);
  const [updating, setUpdating] = React.useState<string | null>(null);
  const [maxBranchesEdit, setMaxBranchesEdit] = React.useState<Record<string, string>>({});

  // Users state
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [usersLoaded, setUsersLoaded] = React.useState(false);

  function handleLogout() { clearToken(); router.push("/login"); }

  React.useEffect(() => {
    if (!getToken()) { router.replace("/login"); return; }
    apiFetch("/auth/me").then(async (res) => {
      if (!res.ok) { router.replace("/login"); return; }
      const { user } = await res.json() as { user: { isPlatformAdmin: boolean } };
      if (!user.isPlatformAdmin) { router.replace("/login"); return; }
      setAuthChecked(true);
    }).catch(() => router.replace("/login"));
  }, [router]);

  async function loadTenants() {
    const res = await apiFetch("/admin/tenants");
    if (!res.ok) {
      const msg = await readApiError(res);
      setError(`Failed to load tenants: ${res.status}${msg ? ` — ${msg}` : ""}`);
      return;
    }
    setTenants(await res.json() as Tenant[]);
    setError(null);
  }

  async function loadUsers() {
    if (usersLoaded) return;
    const res = await apiFetch("/admin/users");
    if (res.ok) { setUsers(await res.json() as AdminUser[]); setUsersLoaded(true); }
  }

  React.useEffect(() => { if (authChecked) loadTenants(); }, [authChecked]);

  React.useEffect(() => { if (authChecked && section === "users") loadUsers(); }, [authChecked, section]);

  async function saveMaxBranches(tenantId: string) {
    const val = parseInt(maxBranchesEdit[tenantId] ?? "1", 10);
    if (isNaN(val) || val < 1) return;
    setUpdating(`${tenantId}-maxBranches`);
    const res = await apiFetch(`/admin/tenants/${tenantId}/limits`, {
      method: "PATCH", body: JSON.stringify({ maxBranches: val }),
    });
    if (!res.ok) {
      const msg = await readApiError(res);
      setError(`Update failed: ${res.status}${msg ? ` — ${msg}` : ""}`);
    } else {
      pushToast({ variant: "success", title: "Branch limit updated", message: `Max branches → ${val}` });
      await loadTenants();
    }
    setUpdating(null);
  }

  async function toggleFlag(tenantId: string, flag: keyof TenantFeatures, current: boolean) {
    setUpdating(`${tenantId}-${flag}`);
    const res = await apiFetch(`/admin/tenants/${tenantId}/features`, {
      method: "PATCH", body: JSON.stringify({ [flag]: !current }),
    });
    if (!res.ok) {
      const msg = await readApiError(res);
      setError(`Update failed: ${res.status}${msg ? ` — ${msg}` : ""}`);
    } else {
      pushToast({ variant: "success", title: "Flag updated", message: `${flag} → ${!current}` });
      await loadTenants();
    }
    setUpdating(null);
  }

  async function toggleTenantStatus(tenant: Tenant) {
    const next = tenant.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setUpdating(`${tenant.id}-status`);
    const res = await apiFetch(`/admin/tenants/${tenant.id}/status`, {
      method: "PATCH", body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      const msg = await readApiError(res);
      setError(`Update failed: ${res.status}${msg ? ` — ${msg}` : ""}`);
    } else {
      pushToast({ variant: next === "SUSPENDED" ? "error" : "success", title: `Tenant ${next.toLowerCase()}`, message: tenant.name });
      await loadTenants();
    }
    setUpdating(null);
  }

  const filteredTenants = tenants.filter((t) => {
    const q = tenantSearch.toLowerCase();
    const matchSearch = !q || t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (!authChecked) return null;

  const NAV = [
    { id: "tenants" as const, label: "Tenants", icon: Building2, count: tenants.length },
    { id: "users" as const, label: "Users", icon: Users, count: users.length || undefined },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* Top header */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-5">
        <span className="text-sm font-semibold tracking-tight">Zentral — Super Admin</span>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="flex w-48 shrink-0 flex-col border-r border-border bg-muted/20 px-3 py-4">
          <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Platform
          </p>
          <nav className="space-y-0.5">
            {NAV.map(({ id, label, icon: Icon, count }) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm transition-colors ${
                  section === id
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </span>
                {count !== undefined && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums">
                    {count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {error && (
            <div className="mb-4">
              <Alert variant="error">{error}</Alert>
            </div>
          )}

          {/* ── Tenants ── */}
          {section === "tenants" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-semibold">Tenants</h1>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search name or slug…"
                    value={tenantSearch}
                    onChange={(e) => setTenantSearch(e.target.value)}
                    className="h-8 w-56 rounded-md border border-input bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="h-8 rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
                <span className="text-xs text-muted-foreground">
                  {filteredTenants.length} of {tenants.length}
                </span>
              </div>

              {/* Tenant cards */}
              <div className="rounded-lg border border-border bg-card divide-y divide-border">
                {filteredTenants.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">No tenants found.</div>
                ) : filteredTenants.map((tenant) => (
                  <div key={tenant.id} className="px-5 py-4 space-y-3">
                    {/* Row 1: name + controls */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{tenant.name}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                            tenant.status === "ACTIVE"
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : "bg-destructive/10 text-destructive"
                          }`}>
                            {tenant.status}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          /{tenant.slug} · {BUSINESS_TYPE_LABELS[tenant.businessType] ?? tenant.businessType} · {tenant._count.memberships} member{tenant._count.memberships !== 1 ? "s" : ""} · {tenant._count.branches} branch{tenant._count.branches !== 1 ? "es" : ""}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {/* Max branches */}
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
                        {/* Warning notes */}
                        {tenant.features.multipleBranches && tenant.maxBranches <= 1 && (
                          <p className="text-[10px] text-amber-600 dark:text-amber-400">
                            Multi-branch ON but max is 1 — set max ≥ 2 to allow adding branches.
                          </p>
                        )}
                        {!tenant.features.multipleBranches && tenant.maxBranches > 1 && (
                          <p className="text-[10px] text-muted-foreground">
                            Enable multipleBranches flag to unlock branch creation.
                          </p>
                        )}
                        {/* Suspend / Activate */}
                        <button
                          type="button"
                          disabled={updating === `${tenant.id}-status`}
                          onClick={() => toggleTenantStatus(tenant)}
                          className={`rounded px-2 py-0.5 text-[11px] font-medium disabled:opacity-50 ${
                            tenant.status === "ACTIVE"
                              ? "text-destructive hover:bg-destructive/10"
                              : "text-green-600 hover:bg-green-500/10 dark:text-green-400"
                          }`}
                        >
                          {tenant.status === "ACTIVE" ? "Suspend" : "Activate"}
                        </button>
                      </div>
                    </div>

                    {/* Row 2: feature flags */}
                    <div className="flex flex-wrap gap-1.5">
                      {FLAG_KEYS.map((flag) => {
                        const enabled = tenant.features[flag];
                        const key = `${tenant.id}-${flag}`;
                        return (
                          <button
                            key={flag}
                            type="button"
                            disabled={updating === key}
                            onClick={() => toggleFlag(tenant.id, flag, enabled)}
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${
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
          )}

          {/* ── Users ── */}
          {section === "users" && (
            <div className="space-y-4">
              <h1 className="text-lg font-semibold">Platform Users</h1>
              <div className="rounded-lg border border-border bg-card divide-y divide-border">
                {users.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-muted-foreground">Loading…</div>
                ) : users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {u.email}
                        {u.isPlatformAdmin && (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            Super Admin
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {u._count.memberships} tenant membership{u._count.memberships !== 1 ? "s" : ""} · joined {new Date(u.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      u.status === "ACTIVE"
                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {u.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
