'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/auth-layout';
import { apiFetch } from '@/lib/api';
import { setToken } from '@/lib/auth';

export default function LoginPage() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const base = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!base) {
      setError('NEXT_PUBLIC_API_BASE_URL is not configured.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        setError(data.message ?? 'Invalid email or password.');
        return;
      }

      const data = await res.json() as { token: string };
      setToken(data.token);

      // Check if platform admin — redirect to /admin dashboard
      const meRes = await apiFetch('/auth/me');
      if (meRes.ok) {
        const meData = await meRes.json() as { user: { isPlatformAdmin: boolean } };
        if (meData.user.isPlatformAdmin) {
          window.location.href = '/admin';
          return;
        }
      }

      const membershipsRes = await apiFetch('/memberships');
      if (!membershipsRes.ok) {
        setError('Logged in but could not load memberships.');
        return;
      }

      const memberships = await membershipsRes.json() as Array<{
        tenant: { slug: string };
        status: string;
      }>;

      const active = memberships.find((m) => m.status === 'ACTIVE');
      if (!active) {
        setError('No active tenant membership found.');
        return;
      }

      window.location.href = `/t/${active.tenant.slug}`;
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout quoteIndex={1}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Sign in to your account to continue.
        </p>
      </div>

      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email or username</Label>
          <Input
            id="email"
            type="text"
            required
            autoComplete="username"
            placeholder="you@company.com or your username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full h-10" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        No account?{' '}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}
