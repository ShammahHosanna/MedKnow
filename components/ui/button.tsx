import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

const buttonVariants = cva(
  'inline-flex min-h-[56px] items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold transition-all active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white shadow-card hover:bg-primary-dark hover:shadow-glow',
        secondary:
          'border-2 border-primary bg-white text-primary hover:bg-surface dark:bg-transparent dark:text-primary-light',
        ghost: 'text-gray-700 hover:bg-surface dark:text-gray-200 dark:hover:bg-gray-800',
        destructive: 'bg-red-700 text-white shadow-card hover:bg-red-800 hover:shadow-glow',
      },
      size: {
        default: '',
        sm: 'min-h-[44px] px-3 text-sm',
        icon: 'min-h-[44px] min-w-[44px] px-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';

export { buttonVariants };
