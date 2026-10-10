import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-semibold',
  {
    variants: {
      variant: {
        neutral: 'border-gray-300 bg-gray-100 text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100',
        high: 'border-severity-high-border bg-severity-high-bg text-severity-high-text',
        medium: 'border-severity-medium-border bg-severity-medium-bg text-severity-medium-text',
        low: 'border-severity-low-border bg-severity-low-bg text-severity-low-text',
        ok: 'border-severity-ok-border bg-severity-ok-bg text-severity-ok-text',
        primary: 'border-primary/30 bg-teal-50 text-primary dark:bg-teal-950 dark:text-primary-light',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
