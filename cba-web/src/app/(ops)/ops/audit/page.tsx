import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Audit Log' };
export default function AuditPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Audit Log</h2>
      </div>
      {/* TODO: wire up with TanStack Query + backend endpoints */}
    </div>
  );
}
