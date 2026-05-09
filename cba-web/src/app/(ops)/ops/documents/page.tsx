import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Documents' };
export default function DocumentsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Documents</h2>
      </div>
      {/* TODO: wire up with TanStack Query + backend endpoints */}
    </div>
  );
}
