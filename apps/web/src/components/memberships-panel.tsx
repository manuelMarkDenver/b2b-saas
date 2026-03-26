"use client";

import * as React from "react";

import { apiFetch } from "@/lib/api";

type Membership = {
  tenant: { id: string; name: string; slug: string };
  status: "ACTIVE" | "INVITED" | "DISABLED";
  isOwner: boolean;
};

export function MembershipsPanel() {
  const [memberships, setMemberships] = React.useState<Membership[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    apiFetch("/memberships")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: Membership[]) => setMemberships(data))
      .catch(() => setError("Unable to load memberships"));
  }, []);

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-sm font-medium">Memberships</div>

      {error ? (
        <div className="mt-3 text-sm text-destructive">{error}</div>
      ) : null}

      <div className="mt-4 space-y-2 text-sm">
        {memberships.length === 0 && !error ? (
          <div className="text-muted-foreground">No memberships yet.</div>
        ) : null}

        {memberships.map((m) => (
          <div
            key={m.tenant.id}
            className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2"
          >
            <div>
              <div className="font-medium">{m.tenant.name}</div>
              <div className="text-xs text-muted-foreground">/t/{m.tenant.slug}</div>
            </div>
            <div className="text-xs text-muted-foreground">
              {m.status}
              {m.isOwner ? " · Owner" : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
