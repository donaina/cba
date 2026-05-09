'use client';
import { useQuery } from '@tanstack/react-query';
import { Building2, CreditCard, Landmark, ArrowLeftRight, Key, Webhook, FileText, Shield } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import Link from 'next/link';

interface StatCardProps { label: string; value: string | number; icon: React.ElementType; href: string; }

function StatCard({ label, value, icon: Icon, href }: StatCardProps) {
  return (
    <Link href={href} className="bg-card border border-border rounded-xl p-5 flex items-center gap-4 hover:border-primary/40 hover:shadow-sm transition-all group">
      <div className="p-2.5 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </Link>
  );
}

export default function AdminDashboardPage() {
  const { data: branches } = useQuery({ queryKey: ['admin', 'branches'], queryFn: () => apiClient.get('/admin/branches').then(r => r.data) });
  const { data: products } = useQuery({ queryKey: ['admin', 'products'], queryFn: () => apiClient.get('/admin/products').then(r => r.data) });
  const { data: glAccounts } = useQuery({ queryKey: ['admin', 'gl'], queryFn: () => apiClient.get('/gl/accounts').then(r => r.data) });
  const { data: txnTypes } = useQuery({ queryKey: ['admin', 'txn-types'], queryFn: () => apiClient.get('/admin/transaction-types').then(r => r.data) });
  const { data: apiKeys } = useQuery({ queryKey: ['admin', 'api-keys'], queryFn: () => apiClient.get('/baas/api-keys').then(r => r.data) });
  const { data: webhooks } = useQuery({ queryKey: ['admin', 'webhooks'], queryFn: () => apiClient.get('/baas/webhooks').then(r => r.data) });

  const stats = [
    { label: 'Branches', value: branches?.length ?? '—', icon: Building2, href: '/admin/branches' },
    { label: 'Products', value: products?.length ?? '—', icon: CreditCard, href: '/admin/products' },
    { label: 'GL Accounts', value: glAccounts?.length ?? '—', icon: Landmark, href: '/admin/gl' },
    { label: 'Transaction Types', value: txnTypes?.length ?? '—', icon: ArrowLeftRight, href: '/admin/txn-types' },
    { label: 'API Keys', value: apiKeys?.length ?? '—', icon: Key, href: '/admin/api-keys' },
    { label: 'Webhooks', value: webhooks?.length ?? '—', icon: Webhook, href: '/admin/webhooks' },
  ];

  const quickLinks = [
    { label: 'Set Tax Rates', desc: 'Configure VAT and WHT rates', icon: FileText, href: '/admin/tax-rates' },
    { label: 'Maker-Checker Rules', desc: 'Set approval workflows', icon: Shield, href: '/admin/maker-checker' },
    { label: 'Branding', desc: 'Upload bank logo for PDFs', icon: FileText, href: '/admin/branding' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold">Platform Overview</h2>
        <p className="text-sm text-muted-foreground">Configuration summary for this tenant</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {quickLinks.map(q => (
            <Link key={q.href} href={q.href} className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all">
              <p className="font-medium text-foreground text-sm">{q.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{q.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
