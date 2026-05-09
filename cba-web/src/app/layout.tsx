import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/providers/auth-provider';
import { TenantProvider } from '@/providers/tenant-provider';
import { QueryProvider } from '@/providers/query-provider';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: { template: '%s | NexCore', default: 'NexCore — Core Banking Platform' },
  description: 'Multi-tenant core banking application',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <QueryProvider>
          <AuthProvider>
            <TenantProvider>
              {children}
              <Toaster richColors position="top-right" />
            </TenantProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
