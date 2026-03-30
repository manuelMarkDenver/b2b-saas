'use client';

import { useEffect, useState } from 'react';
import { Plus, Pencil, CheckCircle, XCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type Branch = {
  id: string;
  name: string;
  address: string | null;
  isDefault: boolean;
  status: 'ACTIVE' | 'INACTIVE';
};

interface BranchesProps {
  tenantSlug: string;
  userRole: string | null;
}

export function BranchesPanel({ tenantSlug, userRole }: BranchesProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: '', address: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canManage = userRole === 'OWNER' || userRole === 'ADMIN';

  async function load() {
    setLoading(true);
    const res = await apiFetch('/branches', { tenantSlug });
    if (res.ok) {
      setBranches(await res.json());
    } else {
      setError('Failed to load branches');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [tenantSlug]);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', address: '' });
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(branch: Branch) {
    setEditing(branch);
    setForm({ name: branch.name, address: branch.address ?? '' });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setFormError('Branch name is required');
      return;
    }
    setSaving(true);
    setFormError(null);

    const body = JSON.stringify({
      name: form.name.trim(),
      address: form.address.trim() || undefined,
    });

    const res = editing
      ? await apiFetch(`/branches/${editing.id}`, { tenantSlug, method: 'PATCH', body })
      : await apiFetch('/branches', { tenantSlug, method: 'POST', body });

    if (res.ok) {
      setDialogOpen(false);
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      setFormError(data.message ?? 'Something went wrong');
    }
    setSaving(false);
  }

  async function toggleStatus(branch: Branch) {
    if (branch.isDefault) return; // protected by API too
    const status = branch.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await apiFetch(`/branches/${branch.id}`, {
      tenantSlug,
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await load();
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading branches…</p>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Branches</h2>
          <p className="text-sm text-muted-foreground">Manage locations within your business.</p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Add branch
          </button>
        )}
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground hidden sm:table-cell">Address</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
              {canManage && <th className="px-4 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {branches.map((branch) => (
              <tr key={branch.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">
                  {branch.name}
                  {branch.isDefault && (
                    <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      Default
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                  {branch.address ?? <span className="italic text-muted-foreground/60">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                      branch.status === 'ACTIVE'
                        ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {branch.status === 'ACTIVE' ? (
                      <CheckCircle className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    {branch.status}
                  </span>
                </td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(branch)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {!branch.isDefault && (
                        <button
                          onClick={() => toggleStatus(branch)}
                          className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          {branch.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-xl">
            <h3 className="text-base font-semibold mb-4">
              {editing ? 'Edit branch' : 'Add branch'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Branch name *</label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Main Warehouse"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Address</label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setDialogOpen(false)}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Saving…' : editing ? 'Save changes' : 'Add branch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
