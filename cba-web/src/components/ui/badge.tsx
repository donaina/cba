import { cn } from '@/lib/utils';

interface BadgeProps {
  variant?: 'default' | 'secondary' | 'success' | 'destructive' | 'outline' | 'warning';
  className?: string;
  children: React.ReactNode;
}

export function Badge({ variant = 'default', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        {
          'bg-primary/10 text-primary': variant === 'default',
          'bg-secondary text-secondary-foreground': variant === 'secondary',
          'bg-green-100 text-green-800': variant === 'success',
          'bg-destructive/10 text-destructive': variant === 'destructive',
          'border border-border text-muted-foreground': variant === 'outline',
          'bg-yellow-100 text-yellow-800': variant === 'warning',
        },
        className,
      )}
    >
      {children}
    </span>
  );
}
