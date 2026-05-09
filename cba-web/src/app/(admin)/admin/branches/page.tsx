import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Admin — Branches' };
export default function branchesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Branches</h2>
      </div>
      {/* TODO: wire up with TanStack Query + backend endpoints */}
    </div>
  );
}
