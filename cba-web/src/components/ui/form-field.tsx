import { Label } from './label';
import { Tooltip } from './tooltip';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  tooltip?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, error, required, tooltip, children, className }: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="flex items-center gap-1">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
        {tooltip && <Tooltip content={tooltip} />}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
