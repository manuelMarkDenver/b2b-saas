'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';

type Supplier = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
};

type Meta = { total: number; page: number; limit: number; totalPages: number };

interface SuppliersPanelProps {
  tenantSlug: string;
  userRole: string | null;
}

export function SuppliersPanel({ tenantSlug, userRole }: SuppliersPanelProps) {
  const { pushToast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 50, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: '', contactName: '', phone: '', email: '', address: '', isActive: true });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canManage = userRole === 'OWNER' || userRole === 'ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: '1', limit: '50' });
    if (search.trim()) params.set('search', search.trim());
    const res = await apiFetch(`/suppliers?${params}`, { tenantSlug, branchId: null });
    if (res.ok) {
      const d = await res.json() as { data: Supplier[]; meta: Meta };
      setSuppliers(d.data);
      setMeta(d.meta);
    }
    setLoading(false);
  }, [tenantSlug, search]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', contactName: '', phone: '', email: '', address: '', isActive: true });
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({
      name: s.name,
      contactName: s.contactName ?? '',
      phone: s.phone ?? '',
      email: s.email ?? '',
      address: s.address ?? '',
      isActive: s.isActive,
    });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('Name is required');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const body = {
        name: form.name.trim(),
        contactName: form.contactName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        isActive: form.isActive,
      };
      const res = editing
        ? await apiFetch(`/suppliers/${editing.id}`, { tenantSlug, branchId: null, method: 'PATCH', body: JSON.stringify(body) })
        : await apiFetch('/suppliers', { tenantSlug, branchId: null, method: 'POST', body: JSON.stringify(body) });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        setFormError(err.message ?? 'Something went wrong');
      } else {
        setDialogOpen(false);
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Supplier) {
    const res = await apiFetch(`/suppliers/${s.id}`, {
      tenantSlug,
      branchId: null,
      method: 'PATCH',
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    if (res.ok) {
      pushToast({
        variant: 'success',
        title: s.isActive ? 'Supplier deactivated' : 'Supplier activated',
        message: s.name,
      });
      load();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search suppliers…"
            className="w-full h-9 rounded-md border border-input bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={search}
            onChange={(e) => { setSearch(e.target.value); }}
            onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
          />
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add supplier
          </Button>
        )}
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading suppliers…</div>
      ) : suppliers.length === 0 ? (
        <div className="rounded-lg border border-border py-12 text-center text-sm text-muted-foreground">
          No suppliers found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <div className="min-w-[500px]">
            <div className="grid gap-0 border-b bg-muted/40 px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground grid-cols-[2fr_1fr_1fr_100px]">
              <span>Name</span>
              <span>Contact</span>
              <span>Email</span>
              <span className="text-right">Status</span>
            </div>
            <div className="divide-y">
              {suppliers.map((s) => (
                <div
                  key={s.id}
                  className={`grid items-center gap-0 px-4 py-3 text-sm transition-colors hover:bg-muted/30 grid-cols-[2fr_1fr_1fr_100px] ${!s.isActive ? 'opacity-50' : ''}`}
                >
                  <div className="min-w-0">
                    <span className="block truncate text-xs font-medium">{s.name}</span>
                    {s.address && <span className="block truncate text-[10px] text-muted-foreground">{s.address}</span>}
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate text-xs text-muted-foreground">{s.contactName ?? '—'}</span>
                    {s.phone && <span className="block truncate text-[10px] text-muted-foreground">{s.phone}</span>}
                  </div>
                  <div className="min-w-0">
                    <span className="block truncate text-xs text-muted-foreground">{s.email ?? '—'}</span>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <span className={`text-[10px] font-medium ${s.isActive ? 'text-green-600' : 'text-red-500'}`}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => toggleActive(s)}
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                        title={s.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {s.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setEditing(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit supplier' : 'Add supplier'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Contact name</label>
                <input
                  type="text"
                  value={form.contactName}
                  onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="supplier-active"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="rounded border-input"
              />
              <label htmlFor="supplier-active" className="text-sm">Active</label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving…' : (editing ? 'Save changes' : 'Add supplier')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
