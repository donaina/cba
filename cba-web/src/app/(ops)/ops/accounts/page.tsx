import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Accounts' };
export default function AccountsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Accounts</h2>
      </div>
      {/* TODO: wire up with TanStack Query + backend endpoints */}
    </div>
  );
}
