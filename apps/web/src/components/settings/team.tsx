'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Settings, Users, Plus, Mail } from 'lucide-react';
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

type Member = {
  id: string;
  role: string;
  status: string;
  isOwner: boolean;
  user: { email: string };
};

const SETTINGS_NAV = [
  { label: 'Profile', href: 'profile', icon: Settings },
  { label: 'Team & Permissions', href: 'team', icon: Users },
];

interface TeamSettingsProps {
  tenantSlug: string;
}

export function TeamSettings({ tenantSlug }: TeamSettingsProps) {
  const { pushToast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('STAFF');
  const [inviting, setInviting] = useState(false);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch('/memberships/team', { tenantSlug });
    if (res.ok) {
      const data = await res.json() as Member[];
      setMembers(data);
    }
    setLoading(false);
  }, [tenantSlug]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    try {
      const res = await apiFetch('/memberships/invite', {
        method: 'POST',
        tenantSlug,
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string };
        pushToast({ variant: 'error', title: 'Invite failed', message: err.message ?? 'Unknown error' });
      } else {
        pushToast({ variant: 'success', title: 'Invitation sent', message: `Invite sent to ${inviteEmail}` });
        setInviteOpen(false);
        setInviteEmail('');
        setInviteRole('STAFF');
      }
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="flex gap-6">
      {/* Settings nav */}
      <aside className="w-44 shrink-0">
        <nav className="flex flex-col gap-0.5">
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
            {Object.entries(ROLE_DESCRIPTIONS).map(([role, message]) => (
              <div key={role} className="flex items-start gap-3">
                <Badge variant={ROLE_BADGE[role] ?? 'outline'} className="mt-0.5 shrink-0">
                  {role}
                </Badge>
                <span className="text-sm text-muted-foreground">{message}</span>
              </div>
            ))}
          </dl>
        </div>

        {/* Members */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-4">
            <div>
              <h2 className="text-base font-semibold">Members</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{members.length} member{members.length !== 1 ? 's' : ''}</p>
            </div>
            <Button size="default" onClick={() => setInviteOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Invite
            </Button>
          </div>

          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : members.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No members found.</div>
          ) : (
            <div className="divide-y divide-border">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium uppercase">
                      {member.user.email[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{member.user.email}</p>
                      <p className="text-xs text-muted-foreground capitalize">{member.status.toLowerCase()}</p>
                    </div>
                  </div>
                  <Badge variant={ROLE_BADGE[member.role] ?? 'outline'}>{member.role}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite team member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="STAFF">Staff</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviting}>
                <Mail className="mr-1.5 h-4 w-4" />
                {inviting ? 'Sending…' : 'Send invite'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
