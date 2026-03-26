"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { setToken } from "@/lib/auth";

export default function RegisterPage() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [status, setStatus] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Creating account...");

    const base = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!base) {
      setStatus("Missing NEXT_PUBLIC_API_BASE_URL");
      return;
    }

    const res = await fetch(`${base}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const text = await res.text();
      setStatus(`Registration failed: ${text}`);
      return;
    }

    const data = (await res.json()) as { token: string };
    setToken(data.token);
    setStatus("Registered. Redirecting...");

    const membershipsRes = await apiFetch("/memberships");
    if (!membershipsRes.ok) {
      setStatus("Registered, but no memberships found.");
      return;
    }

    const memberships = (await membershipsRes.json()) as Array<{
      tenant: { slug: string };
      status: "ACTIVE" | "INVITED" | "DISABLED";
    }>;

    const active = memberships.find((m) => m.status === "ACTIVE");
    if (!active) {
      setStatus("Registered, but no active tenant membership.");
      return;
    }

    window.location.href = `/t/${active.tenant.slug}`;
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto max-w-md px-4 py-14">
        <h1 className="text-2xl font-semibold tracking-tight">Register</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Phase 1 manual registration. Admin assignment happens later.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <input
              type="password"
              required
              minLength={8}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full">
            Register
          </Button>
        </form>

        {status ? (
          <div className="mt-4 rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
            {status}
          </div>
        ) : null}

        <div className="mt-6 text-sm text-muted-foreground">
          Already have an account? <Link className="text-primary" href="/login">Login</Link>
        </div>
      </main>
    </div>
  );
}
