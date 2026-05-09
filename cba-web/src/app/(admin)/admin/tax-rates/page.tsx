import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Admin — Tax Rates' };
export default function taxratesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Tax Rates</h2>
      </div>
      {/* TODO: wire up with TanStack Query + backend endpoints */}
    </div>
  );
}
