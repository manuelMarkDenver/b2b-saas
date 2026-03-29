'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const base = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!base) {
      setError('NEXT_PUBLIC_API_BASE_URL is not configured.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${base}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        setError(data.message ?? 'Something went wrong. Please try again.');
        return;
      }

      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto max-w-sm px-4 py-20">
        <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email and we&apos;ll send a reset link if an account exists.
          </p>

          {sent ? (
            <div className="mt-6 space-y-4">
              <p className="rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
                If that email is registered, a reset link has been sent.
              </p>
              <Link href="/login">
                <Button variant="outline" className="w-full">Back to sign in</Button>
              </Link>
            </div>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={onSubmit}>
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

              {error && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending…' : 'Send reset link'}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                <Link href="/login" className="text-primary hover:underline">
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
