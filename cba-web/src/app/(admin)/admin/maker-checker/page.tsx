import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Admin — Maker-Checker' };
export default function makercheckerPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Maker-Checker</h2>
      </div>
      {/* TODO: wire up with TanStack Query + backend endpoints */}
    </div>
  );
}
