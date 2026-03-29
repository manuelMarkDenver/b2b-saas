'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

type Notification = {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  entityType?: string;
  entityId?: string;
};

interface NotificationBellProps {
  tenantSlug: string;
}

export function NotificationBell({ tenantSlug }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiFetch('/notifications', { tenantSlug });
      if (res.ok) {
        const data = await res.json() as Notification[];
        setNotifications(data);
      }
      // 404 = endpoint not yet live, silently ignore
    } catch {
      // Network error — silently ignore
    }
  }, [tenantSlug]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 8_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  async function markRead(id: string) {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: 'PATCH', tenantSlug });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch {/* ignore */}
  }

  async function dismiss(id: string) {
    try {
      await apiFetch(`/notifications/${id}`, { method: 'DELETE', tenantSlug });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {/* ignore */}
  }

  async function markAllRead() {
    try {
      await apiFetch('/notifications/read-all', { method: 'PATCH', tenantSlug });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {/* ignore */}
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-primary hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
              <Bell className="mb-2 h-6 w-6 opacity-40" />
              <p>No notifications</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  'flex items-start gap-3 border-b border-border/50 px-4 py-3 last:border-0',
                  !n.isRead && 'bg-primary/5',
                )}
              >
                {!n.isRead && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                )}
                <div className={cn('flex-1 min-w-0', n.isRead && 'pl-5')}>
                  <p
                    className={cn('text-sm', !n.isRead && 'font-medium')}
                    onClick={() => !n.isRead && markRead(n.id)}
                  >
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(n.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => dismiss(n.id)}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
