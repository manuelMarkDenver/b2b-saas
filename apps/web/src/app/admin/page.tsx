"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Users, Search, LogOut, ChevronDown, Plus, Copy, Check } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getToken, clearToken } from "@/lib/auth";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

type TenantFeatures = {
  inventory: boolean;
  orders: boolean;
  payments: boolean;
  accounting: boolean;
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

type UserMembership = {
  role: string;
  isOwner: boolean;
  status: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
    maxBranches: number;
    _count: { branches: number; memberships: number };
  };
};

type AdminUser = {
  id: string;
  email: string;
  status: string;
  isPlatformAdmin: boolean;
  createdAt: string;
  memberships: UserMembership[];
};

const FLAG_KEYS: (keyof TenantFeatures)[] = [
  "inventory", "orders", "payments", "accounting", "reports",
  "marketplace", "stockTransfers", "paymentTerms", "multipleBranches",
];

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  STAFF: "Staff",
  VIEWER: "Viewer",
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

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function BranchCount({ current, max }: { current: number; max: number }) {
  const over = current > max;
  const atLimit = current === max;
  return (
    <span className={over ? "text-red-500 dark:text-red-400" : atLimit ? "text-amber-500 dark:text-amber-400" : ""}>
      {current}/{max} branches{over ? " ⚠ over limit" : atLimit ? " · at limit" : ""}
    </span>
  );
}

// Collapsible sub-section within an expanded card
function Section({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border-t border-border/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-2.5 text-left hover:bg-muted/20 transition-colors"
      >
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-5 pb-3">{children}</div>}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [section, setSection] = React.useState<"tenants" | "users">("tenants");
  const [authChecked, setAuthChecked] = React.useState(false);
  const { pushToast } = useToast();
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

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
  const [userSearch, setUserSearch] = React.useState("");
  const [expandedTenantGroups, setExpandedTenantGroups] = React.useState<Set<string>>(new Set());

  // Create tenant dialog state
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({ name: "", slug: "", ownerEmail: "", ownerPassword: "" });
  const [createSlugLocked, setCreateSlugLocked] = React.useState(false);
  const [createSubmitting, setCreateSubmitting] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [createResult, setCreateResult] = React.useState<{ slug: string; email: string; password: string; isNewUser: boolean } | null>(null);
  const [copied, setCopied] = React.useState(false);

  function handleLogout() { clearToken(); router.push("/login"); }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleTenantGroup(tenantId: string) {
    setExpandedTenantGroups((prev) => {
      const next = new Set(prev);
      if (next.has(tenantId)) next.delete(tenantId); else next.add(tenantId);
      return next;
    });
  }

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function toggleUserStatus(user: AdminUser) {
    const next = user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setUpdating(`user-${user.id}-status`);
    const res = await apiFetch(`/admin/users/${user.id}/status`, {
      method: "PATCH", body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      const msg = await readApiError(res);
      setError(`Update failed: ${res.status}${msg ? ` — ${msg}` : ""}`);
    } else {
      pushToast({ variant: next === "SUSPENDED" ? "error" : "success", title: `User ${next.toLowerCase()}`, message: user.email });
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, status: next } : u));
    }
    setUpdating(null);
  }

  function openCreateTenant() {
    setCreateForm({ name: "", slug: "", ownerEmail: "", ownerPassword: "" });
    setCreateSlugLocked(false);
    setCreateSubmitting(false);
    setCreateError(null);
    setCreateResult(null);
    setCopied(false);
    setCreateOpen(true);
  }

  function handleCreateNameChange(name: string) {
    setCreateForm((prev) => ({ ...prev, name }));
    if (!createSlugLocked) {
      setCreateForm((prev) => ({ ...prev, slug: slugify(name) }));
    }
  }

  function handleCreateSlugChange(slug: string) {
    setCreateForm((prev) => ({ ...prev, slug }));
    setCreateSlugLocked(true);
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreateSubmitting(true);
    try {
      const res = await apiFetch("/admin/tenants", {
        method: "POST",
        body: JSON.stringify(createForm),
      });
      if (!res.ok) {
        const msg = await readApiError(res);
        setCreateError(msg || `Failed to create tenant (${res.status})`);
        return;
      }
      const data = await res.json() as { tenant: { slug: string }; owner: { email: string }; isNewUser: boolean };
      setCreateResult({
        slug: data.tenant.slug,
        email: data.owner.email,
        password: createForm.ownerPassword,
        isNewUser: data.isNewUser,
      });
    } catch {
      setCreateError("Network error. Please try again.");
    } finally {
      setCreateSubmitting(false);
    }
  }

  async function handleCopyPassword() {
    if (!createResult) return;
    try {
      await navigator.clipboard.writeText(createResult.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard not available */ }
  }

  function handleCreateDone() {
    setCreateOpen(false);
    setCreateResult(null);
    loadTenants();
  }

  const filteredTenants = tenants.filter((t) => {
    const q = tenantSearch.toLowerCase();
    const matchSearch = !q || t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || t.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Group users by tenant for display
  const tenantGroups = React.useMemo(() => {
    const groups = new Map<string, { tenant: UserMembership["tenant"]; members: Array<AdminUser & { role: string; isOwner: boolean }> }>();
    const platformAdmins: AdminUser[] = [];

    const unassigned: AdminUser[] = [];

    for (const user of users) {
      const memberships = user.memberships ?? [];
      if (user.isPlatformAdmin && memberships.length === 0) {
        platformAdmins.push(user);
        continue;
      }
      if (memberships.length === 0) {
        unassigned.push(user);
        continue;
      }
      for (const m of memberships) {
        const tid = m.tenant.id;
        if (!groups.has(tid)) groups.set(tid, { tenant: m.tenant, members: [] });
        groups.get(tid)!.members.push({ ...user, role: m.role, isOwner: m.isOwner });
      }
    }

    // Sort members: owners first, then by email
    for (const g of groups.values()) {
      g.members.sort((a, b) => {
        if (a.isOwner && !b.isOwner) return -1;
        if (!a.isOwner && b.isOwner) return 1;
        return a.email.localeCompare(b.email);
      });
    }

    return { platformAdmins, unassigned, groups: Array.from(groups.values()).sort((a, b) => a.tenant.name.localeCompare(b.tenant.name)) };
  }, [users]);

  const filteredUserGroups = React.useMemo(() => {
    const q = userSearch.toLowerCase();
    if (!q) return tenantGroups;

    const platformAdmins = tenantGroups.platformAdmins.filter(
      (u) => u.email.toLowerCase().includes(q)
    );
    const unassigned = tenantGroups.unassigned.filter(
      (u) => u.email.toLowerCase().includes(q)
    );
    const groups = tenantGroups.groups
      .map((g) => ({
        ...g,
        members: g.members.filter((m) => m.email.toLowerCase().includes(q) || g.tenant.name.toLowerCase().includes(q)),
      }))
      .filter((g) => g.members.length > 0 || g.tenant.name.toLowerCase().includes(q));

    return { platformAdmins, unassigned, groups };
  }, [tenantGroups, userSearch]);

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
                <Button size="sm" onClick={openCreateTenant}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New Tenant
                </Button>
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
                  const activeFlags = FLAG_KEYS.filter((f) => tenant.features[f]);
                  return (
                    <div key={tenant.id} className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                      {/* Always-visible header row */}
                      <button
                        type="button"
                        onClick={() => toggleExpanded(tenant.id)}
                        className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/30 transition-colors"
                      >
                        <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${tenant.status === "ACTIVE" ? "bg-emerald-500" : "bg-red-400"}`} />
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-semibold">{tenant.name}</span>
                          <span className="ml-2 font-mono text-xs text-muted-foreground">/{tenant.slug}</span>
                          <span className="ml-3 text-xs text-muted-foreground">
                            {tenant._count.memberships} members · <BranchCount current={tenant._count.branches} max={tenant.maxBranches} />
                          </span>
                        </div>
                        <div className="hidden shrink-0 items-center gap-1 sm:flex">
                          {activeFlags.slice(0, 4).map((f) => (
                            <span key={f} className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">{f}</span>
                          ))}
                          {activeFlags.length > 4 && (
                            <span className="text-[10px] text-muted-foreground">+{activeFlags.length - 4}</span>
                          )}
                        </div>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>

                      {/* Expandable body */}
                      {isExpanded && (
                        <>
                          {/* Sub-section: Feature Flags */}
                          <Section label="Feature Flags">
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
                          </Section>

                          {/* Sub-section: Branch Limit */}
                          <Section label="Branch Limit">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                value={maxBranchesEdit[tenant.id] ?? String(tenant.maxBranches)}
                                onChange={(e) => setMaxBranchesEdit((m) => ({ ...m, [tenant.id]: e.target.value }))}
                                className="w-16 rounded-md border border-input bg-background px-2 py-1 text-xs tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                              />
                              <button
                                type="button"
                                disabled={updating === `${tenant.id}-maxBranches`}
                                onClick={() => void saveMaxBranches(tenant.id)}
                                className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                              >
                                Save
                              </button>
                              {tenant.features.multipleBranches && tenant.maxBranches <= 1 && (
                                <span className="text-[10px] text-amber-500 dark:text-amber-400">
                                  Set limit ≥ 2 to allow adding branches.
                                </span>
                              )}
                            </div>
                          </Section>

                          {/* Footer: status action — right-aligned */}
                          <div className="flex justify-end border-t border-border/60 bg-muted/20 px-5 py-2.5">
                            <button
                              type="button"
                              disabled={updating === `${tenant.id}-status`}
                              onClick={() => void toggleTenantStatus(tenant)}
                              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
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

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by email or tenant…"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="h-8 w-64 rounded-md border border-input bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {!usersLoaded ? (
                <div className="rounded-xl border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">Loading…</div>
              ) : (
                <div className="space-y-2">
                  {/* Platform Admins group */}
                  {filteredUserGroups.platformAdmins.length > 0 && (
                    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                      <button
                        type="button"
                        onClick={() => toggleTenantGroup("__platform__")}
                        className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-muted/30 transition-colors"
                      >
                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary/60" />
                        <span className="flex-1 text-sm font-semibold">Platform Admins</span>
                        <span className="text-xs text-muted-foreground">{filteredUserGroups.platformAdmins.length}</span>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedTenantGroups.has("__platform__") ? "rotate-180" : ""}`} />
                      </button>
                      {expandedTenantGroups.has("__platform__") && (
                        <div className="divide-y divide-border/60 border-t border-border/60">
                          {filteredUserGroups.platformAdmins.map((u) => (
                            <UserRow key={u.id} user={u} role="Super Admin" updating={updating} onToggleStatus={toggleUserStatus} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Per-tenant groups */}
                  {filteredUserGroups.groups.map(({ tenant, members }) => (
                    <div key={tenant.id} className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                      <button
                        type="button"
                        onClick={() => toggleTenantGroup(tenant.id)}
                        className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-muted/30 transition-colors"
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${tenant.status === "ACTIVE" ? "bg-emerald-500" : "bg-red-400"}`} />
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-semibold">{tenant.name}</span>
                          <span className="ml-2 font-mono text-xs text-muted-foreground">/{tenant.slug}</span>
                          <span className="ml-3 text-xs text-muted-foreground">
                            {tenant._count.memberships} members · <BranchCount current={tenant._count.branches} max={tenant.maxBranches} />
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">{members.length} user{members.length !== 1 ? "s" : ""}</span>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedTenantGroups.has(tenant.id) ? "rotate-180" : ""}`} />
                      </button>
                      {expandedTenantGroups.has(tenant.id) && (
                        <div className="divide-y divide-border/60 border-t border-border/60">
                          {members.map((u) => (
                            <UserRow key={u.id} user={u} role={ROLE_LABELS[u.role] ?? u.role} updating={updating} onToggleStatus={toggleUserStatus} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Unassigned users (no memberships returned — API may not have restarted) */}
                  {filteredUserGroups.unassigned.length > 0 && (
                    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                      <button
                        type="button"
                        onClick={() => toggleTenantGroup("__unassigned__")}
                        className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-muted/30 transition-colors"
                      >
                        <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40" />
                        <span className="flex-1 text-sm font-semibold text-muted-foreground">Unassigned</span>
                        <span className="text-xs text-muted-foreground">{filteredUserGroups.unassigned.length}</span>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedTenantGroups.has("__unassigned__") ? "rotate-180" : ""}`} />
                      </button>
                      {expandedTenantGroups.has("__unassigned__") && (
                        <div className="divide-y divide-border/60 border-t border-border/60">
                          {filteredUserGroups.unassigned.map((u) => (
                            <UserRow key={u.id} user={u} role="—" updating={updating} onToggleStatus={toggleUserStatus} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {filteredUserGroups.groups.length === 0 && filteredUserGroups.platformAdmins.length === 0 && filteredUserGroups.unassigned.length === 0 && (
                    <div className="rounded-xl border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
                      No users found.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>

        {/* ── Create Tenant Dialog ── */}
        <Dialog open={createOpen} onOpenChange={(open) => { if (!open && !createResult) { setCreateOpen(false); } else if (!open) { handleCreateDone(); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{createResult ? "Tenant created" : "New Tenant"}</DialogTitle>
            </DialogHeader>

            {createResult ? (
              <div className="space-y-4">
                {!createResult.isNewUser && (
                  <Alert variant="warning">
                    This user already exists. Their password was not changed.
                  </Alert>
                )}

                <div className="space-y-3 rounded-lg border bg-muted/30 p-4 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">Tenant slug</span>
                    <div className="font-mono text-sm">{createResult.slug}</div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Owner email</span>
                    <div className="font-mono text-sm">{createResult.email}</div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Temporary password</span>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        readOnly
                        value={createResult.password}
                        className="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm font-mono"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyPassword}
                        className="shrink-0"
                      >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <Button className="w-full" onClick={handleCreateDone}>Done</Button>
              </div>
            ) : (
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                {createError && <Alert variant="error">{createError}</Alert>}

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Business name</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    placeholder="e.g. Metro Pizza"
                    value={createForm.name}
                    onChange={(e) => handleCreateNameChange(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    Slug
                    {!createSlugLocked && <span className="ml-1 text-xs text-muted-foreground">(auto-generated)</span>}
                  </label>
                  <input
                    type="text"
                    required
                    pattern="[a-z0-9-]+"
                    placeholder="metro-pizza"
                    value={createForm.slug}
                    onChange={(e) => handleCreateSlugChange(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Owner email</label>
                  <input
                    type="email"
                    required
                    placeholder="owner@business.com"
                    value={createForm.ownerEmail}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, ownerEmail: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Temporary password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    value={createForm.ownerPassword}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, ownerPassword: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => { setCreateOpen(false); setCreateResult(null); }}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={createSubmitting}>
                    {createSubmitting ? "Creating…" : "Create Tenant"}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function UserRow({
  user,
  role,
  updating,
  onToggleStatus,
}: {
  user: AdminUser & { role?: string; isOwner?: boolean };
  role: string;
  updating: string | null;
  onToggleStatus: (user: AdminUser) => Promise<void>;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-muted/20 transition-colors">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
        {user.email[0].toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{user.email}</span>
          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
            role === "Super Admin" || role === "Owner"
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
          }`}>{role}</span>
          {user.isPlatformAdmin && role !== "Super Admin" && (
            <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Super Admin</span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          joined {new Date(user.createdAt).toLocaleDateString()}
        </div>
      </div>
      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        user.status === "ACTIVE"
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "bg-muted text-muted-foreground"
      }`}>
        <span className={`h-1.5 w-1.5 rounded-full ${user.status === "ACTIVE" ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
        {user.status}
      </span>
      <button
        type="button"
        disabled={updating === `user-${user.id}-status`}
        onClick={() => void onToggleStatus(user)}
        className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
          user.status === "ACTIVE"
            ? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            : "border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950"
        }`}
      >
        {user.status === "ACTIVE" ? "Suspend" : "Activate"}
      </button>
    </div>
  );
}
