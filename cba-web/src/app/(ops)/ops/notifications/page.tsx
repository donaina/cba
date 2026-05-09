import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Notifications' };
export default function NotificationsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Notifications</h2>
      </div>
      {/* TODO: wire up with TanStack Query + /notifications/logs endpoint */}
    </div>
  );
}
