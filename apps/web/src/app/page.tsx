import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto max-w-3xl px-4 py-14">
        <h1 className="text-balance text-3xl font-semibold tracking-tight">
          B2B Multi-tenant Marketplace (Phase 1)
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Tenant context is path-based. Try the stub tenant routes:
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            href="/t/acme"
          >
            /t/acme
          </Link>
          <Link
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium"
            href="/t/beacon"
          >
            /t/beacon
          </Link>
        </div>
      </main>
    </div>
  );
}
