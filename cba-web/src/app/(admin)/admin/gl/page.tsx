import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Admin — GL Accounts' };
export default function glPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">GL Accounts</h2>
      </div>
      {/* TODO: wire up with TanStack Query + backend endpoints */}
    </div>
  );
}
