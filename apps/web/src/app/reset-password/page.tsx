'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthLayout } from '@/components/auth-layout';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!token) {
      setError('Invalid or missing reset token. Request a new link.');
      return;
    }

    setLoading(true);
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL;
      const res = await fetch(`${base}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        setError(data.message ?? 'Reset failed. The link may have expired.');
        return;
      }

      setDone(true);
      setTimeout(() => router.push('/login'), 3000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {done ? (
        <div className="mt-6 space-y-4">
          <p className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
            Password updated. Redirecting to sign in…
          </p>
          <Link href="/login">
            <Button variant="outline" className="w-full">Sign in now</Button>
          </Link>
        </div>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              required
              placeholder="Repeat password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          {!token && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              No reset token found. Please use the link from your email.
            </p>
          )}

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading || !token}>
            {loading ? 'Updating…' : 'Update password'}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline">
              Back to sign in
            </Link>
          </div>
        </form>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout quoteIndex={2}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Set new password</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Choose a new password for your account.
        </p>
      </div>

      <React.Suspense fallback={null}>
        <ResetPasswordForm />
      </React.Suspense>
    </AuthLayout>
  );
}
