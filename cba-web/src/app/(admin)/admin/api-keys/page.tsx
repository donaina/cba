import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Admin — API Keys' };
export default function apikeysPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">API Keys</h2>
      </div>
      {/* TODO: wire up with TanStack Query + backend endpoints */}
    </div>
  );
}
