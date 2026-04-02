'use client';

import * as React from 'react';
import { apiFetch } from '@/lib/api';
import { formatCents } from '@/lib/format';
import { useToast } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Plus, Search, TrendingDown, Users, AlertCircle, CreditCard } from 'lucide-react';

type ContactType = 'CUSTOMER' | 'DISTRIBUTOR';

type Contact = {
  id: string;
  name: string;
  type: ContactType;
  phone: string | null;
  address: string | null;
  creditLimitCents: number;
  isActive: boolean;
  createdAt: string;
};

type ArRow = {
  id: string;
  name: string;
  type: ContactType;
  phone: string | null;
  creditLimitCents: number;
  totalBilledCents: number;
  totalPaidCents: number;
  balanceCents: number;
  overdueCents: number;
  orderCount: number;
};

type ArSummaryOrder = {
  id: string;
  totalCents: number;
  status: string;
  createdAt: string;
  paymentDueDate: string | null;
  payments: Array<{ amountCents: number }>;
};

type ArSummary = {
  contact: Contact;
  totalBilledCents: number;
  totalPaidCents: number;
  balanceCents: number;
  orders: ArSummaryOrder[];
};

const TYPE_LABELS: Record<ContactType, string> = {
  CUSTOMER: 'Customer',
  DISTRIBUTOR: 'Distributor',
};

const TYPE_COLORS: Record<ContactType, string> = {
  CUSTOMER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  DISTRIBUTOR: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
};

export function CustomersPanel({ tenantSlug }: { tenantSlug: string }) {
  const { pushToast } = useToast();
  const toast = (opts: { title: string; variant?: 'info' | 'success' | 'warning' | 'error' }) =>
    pushToast({ title: opts.title, message: '', variant: opts.variant ?? 'info' });

  // AR overview list
  const [rows, setRows] = React.useState<ArRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<ContactType | ''>('');

  // Create contact dialog
  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [form, setForm] = React.useState({
    name: '',
    type: 'CUSTOMER' as ContactType,
    phone: '',
    address: '',
    creditLimitCents: 0,
  });

  // AR detail sheet
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<ArSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = React.useState(false);

  async function loadOverview() {
    setLoading(true);
    try {
      const res = await apiFetch('/contacts/ar-overview', { tenantSlug });
      const data = await res.json() as ArRow[];
      setRows(data);
    } catch {
      toast({ title: 'Failed to load customers', variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { loadOverview(); }, [tenantSlug]);

  async function loadSummary(id: string) {
    setSummaryLoading(true);
    setSummary(null);
    try {
      const res = await apiFetch(`/contacts/${id}/ar`, { tenantSlug });
      const data = await res.json() as ArSummary;
      setSummary(data);
    } catch {
      toast({ title: 'Failed to load customer detail', variant: 'error' });
    } finally {
      setSummaryLoading(false);
    }
  }

  React.useEffect(() => {
    if (detailId) loadSummary(detailId);
  }, [detailId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await apiFetch('/contacts', {
        tenantSlug,
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          phone: form.phone.trim() || undefined,
          address: form.address.trim() || undefined,
          creditLimitCents: form.creditLimitCents,
        }),
      });
      toast({ title: 'Contact created', variant: 'success' });
      setCreateOpen(false);
      setForm({ name: '', type: 'CUSTOMER', phone: '', address: '', creditLimitCents: 0 });
      loadOverview();
    } catch {
      toast({ title: 'Failed to create contact', variant: 'error' });
    } finally {
      setCreating(false);
    }
  }

  const filtered = rows.filter((r) => {
    if (typeFilter && r.type !== typeFilter) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase()) &&
        !r.phone?.includes(search)) return false;
    return true;
  });

  // Summary stats
  const totalOutstanding = rows.reduce((s, r) => s + Math.max(0, r.balanceCents), 0);
  const totalOverdue = rows.reduce((s, r) => s + r.overdueCents, 0);
  const distributorCount = rows.filter((r) => r.type === 'DISTRIBUTOR').length;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4 flex items-start gap-3">
          <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30">
            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Contacts</p>
            <p className="text-2xl font-bold">{rows.length}</p>
            <p className="text-xs text-muted-foreground">{distributorCount} distributors</p>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 flex items-start gap-3">
          <div className="p-2 rounded-md bg-amber-100 dark:bg-amber-900/30">
            <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Outstanding</p>
            <p className="text-2xl font-bold">{formatCents(totalOutstanding)}</p>
            <p className="text-xs text-muted-foreground">across all contacts</p>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4 flex items-start gap-3">
          <div className="p-2 rounded-md bg-red-100 dark:bg-red-900/30">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Overdue Balance</p>
            <p className="text-2xl font-bold">{formatCents(totalOverdue)}</p>
            <p className="text-xs text-muted-foreground">past payment due date</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Search by name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="text-sm rounded-md border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ContactType | '')}
        >
          <option value="">All types</option>
          <option value="CUSTOMER">Customers</option>
          <option value="DISTRIBUTOR">Distributors</option>
        </select>
        <Button size="sm" className="ml-auto" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Contact
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground text-sm">
          {rows.length === 0 ? 'No contacts yet. Add your first customer or distributor.' : 'No contacts match your search.'}
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Phone</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Billed</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Paid</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Balance</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Credit Limit</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[row.type]}`}>
                      {TYPE_LABELS[row.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{row.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCents(row.totalBilledCents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCents(row.totalPaidCents)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={row.balanceCents > 0 ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-green-600 dark:text-green-400'}>
                      {formatCents(Math.max(0, row.balanceCents))}
                    </span>
                    {row.overdueCents > 0 && (
                      <span className="ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        overdue
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground hidden md:table-cell">
                    {row.creditLimitCents > 0 ? formatCents(row.creditLimitCents) : <span className="text-xs">COD</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setDetailId(row.id)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create contact dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Contact</DialogTitle>
            <DialogDescription>
              Add a customer or distributor. Name and type are required.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name <span className="text-destructive">*</span></label>
              <input
                required
                className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. Pedro Cruz Distributors"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Type <span className="text-destructive">*</span></label>
              <select
                className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ContactType }))}
              >
                <option value="CUSTOMER">Customer</option>
                <option value="DISTRIBUTOR">Distributor</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Phone
                {form.type === 'DISTRIBUTOR' && <span className="ml-1 text-xs text-muted-foreground">(recommended for credit accounts)</span>}
              </label>
              <input
                className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. 09171234567"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Address</label>
              <input
                className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Optional"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Credit Limit</label>
              <p className="text-xs text-muted-foreground">Set to ₱0 for COD (no credit). Enter the maximum outstanding amount allowed.</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₱</span>
                <input
                  type="number"
                  min={0}
                  step={100}
                  className="w-full pl-7 pr-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="0.00"
                  value={form.creditLimitCents / 100 || ''}
                  onChange={(e) => setForm((f) => ({ ...f, creditLimitCents: Math.round(parseFloat(e.target.value || '0') * 100) }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creating}>{creating ? 'Saving…' : 'Create Contact'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* AR detail sheet */}
      <Sheet open={!!detailId} onOpenChange={(open) => { if (!open) { setDetailId(null); setSummary(null); } }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>{summaryLoading ? 'Loading…' : summary?.contact?.name ?? 'Contact'}</SheetTitle>
          </SheetHeader>
          {summaryLoading || !summary ? (
            <div className="py-16 text-center text-muted-foreground text-sm">{summaryLoading ? '' : ''}</div>
          ) : (
            <>
              <SheetDescription>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[summary.contact.type]}`}>
                    {TYPE_LABELS[summary.contact.type]}
                  </span>
                  {summary.contact.phone && (
                    <span className="ml-2 text-muted-foreground">{summary.contact.phone}</span>
                  )}
                </SheetDescription>
              {/* AR totals */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total Billed</p>
                  <p className="font-semibold tabular-nums">{formatCents(summary.totalBilledCents)}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total Paid</p>
                  <p className="font-semibold text-green-600 dark:text-green-400 tabular-nums">{formatCents(summary.totalPaidCents)}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Balance Due</p>
                  <p className={`font-semibold tabular-nums ${summary.balanceCents > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
                    {formatCents(Math.max(0, summary.balanceCents))}
                  </p>
                </div>
              </div>

              {summary.contact.creditLimitCents > 0 && (
                <div className="flex items-center gap-2 rounded-md border px-3 py-2 mb-6 text-sm">
                  <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Credit limit:</span>
                  <span className="font-medium">{formatCents(summary.contact.creditLimitCents)}</span>
                  {summary.balanceCents >= summary.contact.creditLimitCents && (
                    <Badge variant="destructive" className="ml-auto text-xs">Limit reached</Badge>
                  )}
                </div>
              )}

              {/* Order history */}
              <h3 className="text-sm font-semibold mb-3">Order History ({summary.orders.length})</h3>
              {summary.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders yet.</p>
              ) : (
                <div className="space-y-2">
                  {summary.orders.map((o) => {
                    const paid = o.payments.reduce((s, p) => s + p.amountCents, 0);
                    const balance = o.totalCents - paid;
                    const isOverdue = o.paymentDueDate && new Date(o.paymentDueDate) < new Date();
                    return (
                      <div key={o.id} className="rounded-md border px-3 py-2.5 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs text-muted-foreground">{o.id.slice(0, 8)}</span>
                          <Badge variant={o.status === 'COMPLETED' ? 'default' : o.status === 'CANCELLED' ? 'secondary' : 'outline'} className="text-[10px]">
                            {o.status}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-muted-foreground">
                            {new Date(o.createdAt).toLocaleDateString('en-PH')}
                            {o.paymentDueDate && (
                              <span className={`ml-2 text-xs ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>
                                due {new Date(o.paymentDueDate).toLocaleDateString('en-PH')}
                                {isOverdue && ' ⚠'}
                              </span>
                            )}
                          </span>
                          <div className="text-right">
                            <span className="font-medium tabular-nums">{formatCents(o.totalCents)}</span>
                            {balance > 0 && (
                              <span className="ml-2 text-xs text-amber-600 dark:text-amber-400 tabular-nums">
                                -{formatCents(balance)} owed
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
