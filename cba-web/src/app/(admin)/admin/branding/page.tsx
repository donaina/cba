import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Admin — Branding' };
export default function brandingPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Branding</h2>
      </div>
      {/* TODO: wire up with TanStack Query + backend endpoints */}
    </div>
  );
}
