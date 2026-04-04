'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Settings, Users, Palette, Plus, Mail, UserX, UserCheck, Pencil } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

const ROLE_BADGE: Record<string, 'default' | 'secondary' | 'muted' | 'outline'> = {
  OWNER: 'default',
  ADMIN: 'secondary',
  STAFF: 'muted',
  VIEWER: 'outline',
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  OWNER: 'Full access — manage everything including billing and team.',
  ADMIN: 'Manage inventory, orders, payments, and catalog. Can invite staff.',
  STAFF: 'Operational access — view and create orders, log movements.',
  VIEWER: 'Read-only access across all modules.',
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'text-green-600 bg-green-500/10',
  INVITED: 'text-yellow-600 bg-yellow-500/10',
  DISABLED: 'text-muted-foreground bg-muted',
};

type Member = {
  id: string;
  role: string;
  status: string;
  jobTitle: string | null;
  username: string | null; // set for direct-add staff (no email)
  isOwner: boolean;
  createdAt: string;
  user: { email: string; avatarUrl?: string | null };
};

function memberDisplayName(m: Member): string {
  // Direct-add staff have a placeholder email — show username instead
  if (m.username) return m.username;
  return m.user.email;
}

const SETTINGS_NAV = [
  { label: 'Profile', href: 'profile', icon: Settings },
  { label: 'Team & Permissions', href: 'team', icon: Users },
  { label: 'Appearance', href: 'appearance', icon: Palette },
];

type StatusFilter = 'all' | 'active' | 'pending' | 'deactivated';

interface TeamSettingsProps {
  tenantSlug: string;
}

export function TeamSettings({ tenantSlug }: TeamSettingsProps) {
  const { pushToast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<'invite' | 'direct'>('invite');

  // Invite fields
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('STAFF');
  const [inviteJobTitle, setInviteJobTitle] = useState('');

  // Direct-add fields
  const [directIdentifier, setDirectIdentifier] = useState('');
  const [directPassword, setDirectPassword] = useState('');
  const [directRole, setDirectRole] = useState<string>('STAFF');
  const [directJobTitle, setDirectJobTitle] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

  // Edit member dialog
  const [editTarget, setEditTarget] = useState<Member | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    const [teamRes, membershipsRes] = await Promise.all([
      apiFetch('/memberships/team', { tenantSlug }),
      apiFetch('/memberships'),
    ]);
    if (teamRes.ok) {
      setMembers(await teamRes.json() as Member[]);
    }
    if (membershipsRes.ok) {
      const all = await membershipsRes.json() as Array<{ tenant: { slug: string }; status: string; role: string }>;
      const current = all.find((m) => m.tenant.slug === tenantSlug && m.status === 'ACTIVE');
      if (current) setUserRole(current.role);
    }
    setLoading(false);
  }, [tenantSlug]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const canManage = userRole === 'OWNER' || userRole === 'ADMIN';

  const filteredMembers = members.filter((m) => {
    if (filter === 'active') return m.status === 'ACTIVE';
    if (filter === 'pending') return m.status === 'INVITED';
    if (filter === 'deactivated') return m.status === 'DISABLED';
    return true;
  });

  const counts = {
    all: members.length,
    active: members.filter((m) => m.status === 'ACTIVE').length,
    pending: members.filter((m) => m.status === 'INVITED').length,
    deactivated: members.filter((m) => m.status === 'DISABLED').length,
  };

  function openDialog() {
    setMode('invite');
    setInviteEmail(''); setInviteRole('STAFF'); setInviteJobTitle('');
    setDirectIdentifier(''); setDirectPassword(''); setDirectRole('STAFF'); setDirectJobTitle('');
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      let res: Response;
      if (mode === 'invite') {
        res = await apiFetch('/memberships/invite', {
          method: 'POST',
          tenantSlug,
          body: JSON.stringify({ email: inviteEmail, role: inviteRole, jobTitle: inviteJobTitle || undefined }),
        });
      } else {
        res = await apiFetch('/memberships/add-direct', {
          method: 'POST',
          tenantSlug,
          body: JSON.stringify({ identifier: directIdentifier, password: directPassword, role: directRole, jobTitle: directJobTitle || undefined }),
        });
      }

      if (!res.ok) {
        const err = await res.json() as { message?: string };
        pushToast({ variant: 'error', title: mode === 'invite' ? 'Invite failed' : 'Add failed', message: err.message ?? 'Unknown error' });
      } else {
        pushToast({
          variant: 'success',
          title: mode === 'invite' ? 'Invitation sent' : 'Staff member added',
          message: mode === 'invite' ? `Invite sent to ${inviteEmail}` : `${directIdentifier} can now sign in`,
        });
        setDialogOpen(false);
        void loadMembers();
        if (mode === 'invite') setFilter('pending');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(member: Member) {
    if (!confirm(`Deactivate ${memberDisplayName(member)}? They will lose access immediately.`)) return;
    setActioning(member.id);
    try {
      const res = await apiFetch(`/memberships/${member.id}`, {
        method: 'PATCH',
        tenantSlug,
        body: JSON.stringify({ deactivate: true }),
      });
      if (!res.ok) {
        pushToast({ variant: 'error', title: 'Failed to deactivate', message: 'Please try again.' });
      } else {
        pushToast({ variant: 'success', title: 'Member deactivated', message: `${memberDisplayName(member)} removed.` });
        void loadMembers();
      }
    } finally {
      setActioning(null);
    }
  }

  async function handleReactivate(member: Member) {
    setActioning(member.id);
    try {
      const res = await apiFetch(`/memberships/${member.id}`, {
        method: 'PATCH',
        tenantSlug,
        body: JSON.stringify({ deactivate: false }),
      });
      if (!res.ok) {
        pushToast({ variant: 'error', title: 'Failed to reactivate', message: 'Please try again.' });
      } else {
        pushToast({ variant: 'success', title: 'Member reactivated', message: `${memberDisplayName(member)} now has access.` });
        void loadMembers();
      }
    } finally {
      setActioning(null);
    }
  }

  function openEdit(member: Member) {
    setEditTarget(member);
    setEditRole(member.role);
    setEditJobTitle(member.jobTitle ?? '');
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const res = await apiFetch(`/memberships/${editTarget.id}`, {
        method: 'PATCH',
        tenantSlug,
        body: JSON.stringify({ role: editRole, jobTitle: editJobTitle || undefined }),
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        pushToast({ variant: 'error', title: 'Update failed', message: err.message ?? 'Unknown error' });
      } else {
        pushToast({ variant: 'success', title: 'Member updated', message: 'Changes saved.' });
        setEditTarget(null);
        void loadMembers();
      }
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-6">
      {/* Settings nav */}
      <aside className="shrink-0 md:w-44">
        <nav className="flex flex-row flex-wrap gap-1 md:flex-col md:gap-0.5">
          {SETTINGS_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === 'team';
            return (
              <Link
                key={item.href}
                href={`/t/${tenantSlug}/settings/${item.href}`}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 space-y-4">
        {/* Roles reference */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-base font-semibold">Roles</h2>
          <p className="mt-1 text-sm text-muted-foreground">Permission reference for each role.</p>
          <dl className="mt-4 space-y-3">
            {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => (
              <div key={role} className="flex items-start gap-3">
                <Badge variant={ROLE_BADGE[role] ?? 'outline'} className="mt-0.5 shrink-0">{role}</Badge>
                <span className="text-sm text-muted-foreground">{desc}</span>
              </div>
            ))}
          </dl>
        </div>

        {/* Members */}
        <div className="rounded-lg border border-border">
          <div className="flex items-center justify-between border-b border-border p-4 gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold">Members</h2>
              {/* Filter */}
              <Select value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
                <SelectTrigger className="h-7 w-auto gap-1.5 border-border/60 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ({counts.all})</SelectItem>
                  <SelectItem value="active">Active ({counts.active})</SelectItem>
                  <SelectItem value="pending">Pending ({counts.pending})</SelectItem>
                  <SelectItem value="deactivated">Deactivated ({counts.deactivated})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {canManage && (
              <Button size="default" onClick={openDialog}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add member
              </Button>
            )}
          </div>

          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {filter === 'all' ? 'No members yet.' : `No ${filter} members.`}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
                      {memberDisplayName(member)[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{memberDisplayName(member)}</p>
                      <p className="text-xs text-muted-foreground">
                        {member.jobTitle ?? (member.status === 'INVITED' ? 'Invite pending' : member.status === 'DISABLED' ? 'Deactivated' : 'No title set')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={ROLE_BADGE[member.role] ?? 'outline'}>{member.role}</Badge>
                    {member.status !== 'ACTIVE' && (
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_BADGE[member.status])}>
                        {member.status === 'INVITED' ? 'Pending' : 'Disabled'}
                      </span>
                    )}
                    {canManage && !member.isOwner && (
                      <div className="flex items-center gap-1 ml-1">
                        {member.status !== 'DISABLED' && (
                          <button
                            type="button"
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                            onClick={() => openEdit(member)}
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                        )}
                        {member.status !== 'DISABLED' ? (
                          <button
                            type="button"
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-40"
                            onClick={() => handleDeactivate(member)}
                            disabled={actioning === member.id}
                          >
                            <UserX className="h-3 w-3" />
                            {member.status === 'INVITED' ? 'Cancel' : 'Deactivate'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-green-600 hover:bg-green-500/10 disabled:opacity-40"
                            onClick={() => handleReactivate(member)}
                            disabled={actioning === member.id}
                          >
                            <UserCheck className="h-3 w-3" />
                            Reactivate
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add member dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add team member</DialogTitle>
          </DialogHeader>

          {/* Mode toggle */}
          <div className="flex rounded-lg border border-border p-1 gap-1">
            <button
              type="button"
              onClick={() => setMode('invite')}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                mode === 'invite' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Invite by email
            </button>
            <button
              type="button"
              onClick={() => setMode('direct')}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                mode === 'direct' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Add directly
            </button>
          </div>

          {mode === 'direct' && (
            <p className="text-xs text-muted-foreground -mt-1">
              For staff without email — use a nickname, phone number, or any unique identifier. No email is sent; account is active immediately.
            </p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'invite' ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email">Email address</Label>
                  <Input id="invite-email" type="email" placeholder="colleague@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="STAFF">Staff</SelectItem>
                      {/* VIEWER role reserved for future marketplace customers */}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-job-title">Job title <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="invite-job-title" type="text" placeholder="e.g. Manager, Cashier, Delivery" value={inviteJobTitle} onChange={(e) => setInviteJobTitle(e.target.value)} maxLength={100} />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="direct-identifier">Username / phone / nickname</Label>
                  <Input id="direct-identifier" type="text" placeholder="e.g. juandelacruz or 09171234567" value={directIdentifier} onChange={(e) => setDirectIdentifier(e.target.value)} required minLength={2} />
                  <p className="text-xs text-muted-foreground">This is what they type in the login screen.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="direct-password">Initial password</Label>
                  <Input id="direct-password" type="password" placeholder="Min. 8 characters" value={directPassword} onChange={(e) => setDirectPassword(e.target.value)} required minLength={8} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="direct-role">Role</Label>
                  <Select value={directRole} onValueChange={setDirectRole}>
                    <SelectTrigger id="direct-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                      <SelectItem value="STAFF">Staff</SelectItem>
                      {/* VIEWER role reserved for future marketplace customers */}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="direct-job-title">Job title <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="direct-job-title" type="text" placeholder="e.g. Cashier, Cook, Driver" value={directJobTitle} onChange={(e) => setDirectJobTitle(e.target.value)} maxLength={100} />
                </div>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {mode === 'invite'
                  ? <><Mail className="mr-1.5 h-4 w-4" />{submitting ? 'Sending…' : 'Send invite'}</>
                  : submitting ? 'Adding…' : 'Add member'
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit member dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit member</DialogTitle>
          </DialogHeader>
          {editTarget && (
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                {memberDisplayName(editTarget)}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-role">Role</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger id="edit-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="STAFF">Staff</SelectItem>
                    <SelectItem value="VIEWER">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-job-title">Job title <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="edit-job-title"
                  type="text"
                  placeholder="e.g. Manager, Cashier, Delivery"
                  value={editJobTitle}
                  onChange={(e) => setEditJobTitle(e.target.value)}
                  maxLength={100}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
                <Button type="submit" disabled={editSaving}>{editSaving ? 'Saving…' : 'Save changes'}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
