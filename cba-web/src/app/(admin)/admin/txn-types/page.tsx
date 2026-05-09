import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Admin — Transaction Types' };
export default function txntypesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Transaction Types</h2>
      </div>
      {/* TODO: wire up with TanStack Query + backend endpoints */}
    </div>
  );
}
