"use client";

import * as React from "react";

import { apiFetch } from "@/lib/api";
import { setToken } from "@/lib/auth";

type Membership = {
  tenant: { id: string; name: string; slug: string };
  status: "ACTIVE" | "INVITED" | "DISABLED";
  isOwner: boolean;
};

export function TenantSwitcher({ currentSlug }: { currentSlug: string }) {
  const [memberships, setMemberships] = React.useState<Membership[]>([]);
  const [status, setStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiFetch("/memberships")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Membership[]) => setMemberships(data))
      .catch(() => setStatus("Unable to load memberships"));
  }, []);

  async function switchTenant(slug: string) {
    setStatus("Switching tenant...");
    const res = await apiFetch("/memberships/switch", {
      method: "POST",
      body: JSON.stringify({ tenantSlug: slug }),
    });

    if (!res.ok) {
      setStatus(`Switch failed: ${res.status}`);
      return;
    }

    const data = (await res.json()) as { token: string };
    setToken(data.token);
    setStatus("Switched. Reloading...");
    window.location.href = `/t/${slug}`;
  }

  if (memberships.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        value={currentSlug}
        onChange={(e) => switchTenant(e.target.value)}
      >
        {memberships
          .filter((m) => m.status === "ACTIVE")
          .map((m) => (
            <option key={m.tenant.id} value={m.tenant.slug}>
              {m.tenant.name}
            </option>
          ))}
      </select>

      {status ? (
        <div className="text-xs text-muted-foreground">{status}</div>
      ) : null}
    </div>
  );
}
