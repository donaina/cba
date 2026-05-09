import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Admin — Webhooks' };
export default function webhooksPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Webhooks</h2>
      </div>
      {/* TODO: wire up with TanStack Query + backend endpoints */}
    </div>
  );
}
