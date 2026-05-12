import { cn } from '@/lib/utils';

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-border">
      <table className={cn('w-full text-sm', className)}>{children}</table>
    </div>
  );
}

export function Thead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-muted/50 border-b border-border">{children}</thead>;
}

export function Tbody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function Tr({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return <tr className={cn('hover:bg-muted/30 transition-colors', className)} onClick={onClick}>{children}</tr>;
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn('px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide', className)}>
      {children}
    </th>
  );
}

export function Td({ children, className, colSpan }: { children?: React.ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn('px-4 py-3 text-foreground', className)}>{children}</td>;
}
