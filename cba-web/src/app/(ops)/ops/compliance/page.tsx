import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Compliance' };
export default function CompliancePage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Compliance</h2>
      </div>
      {/* TODO: wire up with TanStack Query + backend endpoints */}
    </div>
  );
}
