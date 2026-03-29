import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary',
        secondary: 'bg-secondary text-secondary-foreground',
        success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        destructive: 'bg-destructive/10 text-destructive',
        outline: 'border border-border text-foreground',
        muted: 'bg-muted text-muted-foreground',
        // Domain status variants — driven by CSS vars in :root/.dark, overrideable per tenant
        pending:   'bg-[hsl(var(--status-pending))] text-[hsl(var(--status-pending-fg))]',
        confirmed: 'bg-[hsl(var(--status-confirmed))] text-[hsl(var(--status-confirmed-fg))]',
        completed: 'bg-[hsl(var(--status-completed))] text-[hsl(var(--status-completed-fg))]',
        cancelled: 'bg-[hsl(var(--status-cancelled))] text-[hsl(var(--status-cancelled-fg))]',
        verified:  'bg-[hsl(var(--status-completed))] text-[hsl(var(--status-completed-fg))]',
        rejected:  'bg-[hsl(var(--status-cancelled))] text-[hsl(var(--status-cancelled-fg))]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
