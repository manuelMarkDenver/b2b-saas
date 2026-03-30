'use client';

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <div className="text-4xl">📵</div>
      <h1 className="text-xl font-semibold text-foreground">You&apos;re offline</h1>
      <p className="text-sm text-muted-foreground">
        Check your internet connection and try again.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Retry
      </button>
    </div>
  );
}
