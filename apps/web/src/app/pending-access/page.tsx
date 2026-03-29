import Link from 'next/link';
import { AuthLayout } from '@/components/auth-layout';

export default function PendingAccessPage() {
  return (
    <AuthLayout quoteIndex={2}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Account created</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Your account is ready, but you don&apos;t have access to a workspace yet.
        </p>
      </div>

      <div className="mt-8 rounded-md border border-border bg-muted/40 px-4 py-5 text-sm text-muted-foreground space-y-2">
        <p className="font-medium text-foreground">What happens next?</p>
        <p>
          Ask your organization&apos;s admin to send you a workspace invitation to{' '}
          <span className="font-medium text-foreground">this email address</span>.
          You&apos;ll receive a link to accept and join their workspace.
        </p>
        <p>
          If you believe this is a mistake, contact your platform administrator.
        </p>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an invite?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
