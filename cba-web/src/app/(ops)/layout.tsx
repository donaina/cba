import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar variant="ops" />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 bg-muted/20">{children}</main>
      </div>
    </div>
  );
}
