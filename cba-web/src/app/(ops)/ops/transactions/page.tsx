import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Transactions' };
export default function TransactionsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Transactions</h2>
      </div>
      {/* TODO: wire up with TanStack Query + backend endpoints */}
    </div>
  );
}
