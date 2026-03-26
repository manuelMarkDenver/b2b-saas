"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { getToken } from "@/lib/auth";

export function TenantAuthGate() {
  const router = useRouter();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        Checking session...
      </div>
    );
  }

  return null;
}
