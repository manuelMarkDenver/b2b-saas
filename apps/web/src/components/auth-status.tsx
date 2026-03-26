"use client";

import * as React from "react";

import { getToken } from "@/lib/auth";

type MeResponse = {
  user: {
    id: string;
    email: string;
    isPlatformAdmin: boolean;
    status: "ACTIVE" | "DISABLED";
  };
};

export function AuthStatus() {
  const [label, setLabel] = React.useState("Not logged in");

  React.useEffect(() => {
    const token = getToken();
    if (!token) return;

    const base = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!base) return;

    fetch(`${base}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: MeResponse | null) => {
        if (!data?.user?.email) return;
        setLabel(data.user.email);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="rounded-md border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
      {label}
    </div>
  );
}
