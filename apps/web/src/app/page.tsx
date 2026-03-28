import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto max-w-3xl px-4 py-14">
        <h1 className="text-balance text-3xl font-semibold tracking-tight">
          B2B Platform
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Multi-tenant business platform. Select a tenant to continue.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            href="/t/peak-hardware"
          >
            Peak Hardware Supply
          </Link>
          <Link
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium"
            href="/t/metro-pizza-supply"
          >
            Metro Pizza Supply
          </Link>
          <Link
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium"
            href="/t/corner-general"
          >
            Corner General Store
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link className="text-primary" href="/login">
            Login
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link className="text-primary" href="/register">
            Register
          </Link>
          <span className="text-muted-foreground">/</span>
          <Link className="text-primary" href="/admin">
            Super Admin
          </Link>
        </div>
      </main>
    </div>
  );
}
