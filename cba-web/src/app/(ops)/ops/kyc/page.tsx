import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'KYC' };
export default function KycPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">KYC</h2>
      </div>
      {/* TODO: wire up with TanStack Query + backend endpoints */}
    </div>
  );
}
