'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/auth-layout';
import { apiFetch } from '@/lib/api';
import { setToken } from '@/lib/auth';

export default function RegisterPage() {
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
      const res = await fetch(`${base}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        setError(data.message ?? 'Registration failed. Please try again.');
        return;
      }

      const data = await res.json() as { token: string };
      setToken(data.token);

      const membershipsRes = await apiFetch('/memberships');
      if (!membershipsRes.ok) {
        setError('Registered, but could not load memberships.');
        return;
      }

      const memberships = await membershipsRes.json() as Array<{
        tenant: { slug: string };
        status: string;
      }>;

      const active = memberships.find((m) => m.status === 'ACTIVE');
      if (!active) {
        setError('Registered, but no active tenant found.');
        return;
      }

      window.location.href = `/t/${active.tenant.slug}`;
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout quoteIndex={0}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create account</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Get started — it only takes a minute.
        </p>
      </div>

      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Min. 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
