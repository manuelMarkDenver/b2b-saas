"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Users, Search, LogOut, ChevronDown } from "lucide-react";
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
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

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
              <div className="space-y-2">
                {filteredTenants.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
                    No tenants found.
                  </div>
                ) : filteredTenants.map((tenant) => {
                  const isExpanded = expandedIds.has(tenant.id);
                  return (
                    <div key={tenant.id} className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                      {/* Always-visible header row — click to expand */}
                      <button
                        type="button"
                        onClick={() => toggleExpanded(tenant.id)}
                        className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/30 transition-colors"
                      >
                        {/* Status dot */}
                        <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${tenant.status === "ACTIVE" ? "bg-emerald-500" : "bg-red-400"}`} />

                        {/* Name + meta */}
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-semibold">{tenant.name}</span>
                          <span className="ml-2 font-mono text-xs text-muted-foreground">/{tenant.slug}</span>
                          <span className="ml-3 text-xs text-muted-foreground">
                            {tenant._count.memberships}m · {tenant._count.branches}/{tenant.maxBranches}br
                          </span>
                        </div>

                        {/* Flag pills (summary — always visible) */}
                        <div className="hidden shrink-0 items-center gap-1 sm:flex">
                          {FLAG_KEYS.filter((f) => tenant.features[f]).slice(0, 4).map((f) => (
                            <span key={f} className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">{f}</span>
                          ))}
                          {FLAG_KEYS.filter((f) => tenant.features[f]).length > 4 && (
                            <span className="text-[10px] text-muted-foreground">+{FLAG_KEYS.filter((f) => tenant.features[f]).length - 4}</span>
                          )}
                        </div>

                        {/* Chevron */}
                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>

                      {/* Expandable body */}
                      {isExpanded && (
                        <>
                          {/* Feature flags */}
                          <div className="border-t border-border/60 px-5 py-3">
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
                                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all disabled:opacity-40 ${
                                      enabled
                                        ? "bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/25 hover:bg-emerald-500/20 dark:text-emerald-400"
                                        : "bg-muted/60 text-muted-foreground ring-1 ring-border hover:bg-muted"
                                    }`}
                                  >
                                    <span className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                                    {flag}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Footer: controls */}
                          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-5 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Branch limit</span>
                              <input
                                type="number"
                                min={1}
                                value={maxBranchesEdit[tenant.id] ?? String(tenant.maxBranches)}
                                onChange={(e) => setMaxBranchesEdit((m) => ({ ...m, [tenant.id]: e.target.value }))}
                                onClick={(e) => e.stopPropagation()}
                                className="w-14 rounded-md border border-input bg-background px-2 py-1 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                              />
                              <button
                                type="button"
                                disabled={updating === `${tenant.id}-maxBranches`}
                                onClick={(e) => { e.stopPropagation(); void saveMaxBranches(tenant.id); }}
                                className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                              >
                                Save
                              </button>
                              {tenant.features.multipleBranches && tenant.maxBranches <= 1 && (
                                <p className="text-[10px] text-amber-500 dark:text-amber-400">
                                  Set limit ≥ 2 to allow adding branches.
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={updating === `${tenant.id}-status`}
                              onClick={(e) => { e.stopPropagation(); void toggleTenantStatus(tenant); }}
                              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                                tenant.status === "ACTIVE"
                                  ? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                                  : "border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950"
                              }`}
                            >
                              {tenant.status === "ACTIVE" ? "Suspend" : "Activate"}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Users ── */}
          {section === "users" && (
            <div className="space-y-4">
              <h1 className="text-lg font-semibold">Platform Users</h1>
              <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm divide-y divide-border/60">
                {users.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-muted-foreground">Loading…</div>
                ) : users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {u.email[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {u.email}
                          {u.isPlatformAdmin && (
                            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              Super Admin
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {u._count.memberships} tenant{u._count.memberships !== 1 ? "s" : ""} · joined {new Date(u.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                      u.status === "ACTIVE"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${u.status === "ACTIVE" ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
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
