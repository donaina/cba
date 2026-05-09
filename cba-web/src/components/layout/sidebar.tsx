'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Landmark,
  CreditCard,
  ArrowLeftRight,
  FileText,
  Shield,
  Bell,
  Settings,
  Building2,
  Key,
  Webhook,
  FolderOpen,
  ScrollText,
  ScanLine,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  permission?: string;
}

// Routes verified against GET /api/docs-json path list
const OPS_NAV: NavItem[] = [
  { label: 'Dashboard',     href: '/ops/dashboard',    icon: LayoutDashboard },
  { label: 'Customers',     href: '/ops/customers',    icon: Users },
  { label: 'Accounts',      href: '/ops/accounts',     icon: Landmark },
  { label: 'Loans',         href: '/ops/loans',        icon: CreditCard },
  { label: 'Transactions',  href: '/ops/transactions', icon: ArrowLeftRight },
  { label: 'Reports',       href: '/ops/reports',      icon: FileText },
  { label: 'KYC',           href: '/ops/kyc',          icon: ScanLine },
  { label: 'Compliance',    href: '/ops/compliance',   icon: Shield,      permission: 'compliance:read' },
  { label: 'Documents',     href: '/ops/documents',    icon: FolderOpen },
  { label: 'Notifications', href: '/ops/notifications',icon: Bell },
  { label: 'Audit Log',     href: '/ops/audit',        icon: ScrollText,  permission: 'audit:read' },
];

const ADMIN_NAV: NavItem[] = [
  { label: 'Overview',      href: '/admin/dashboard',     icon: LayoutDashboard },
  { label: 'Branches',      href: '/admin/branches',      icon: Building2 },
  { label: 'GL Accounts',   href: '/admin/gl',            icon: Landmark },
  { label: 'Products',      href: '/admin/products',      icon: CreditCard },
  { label: 'Tax Rates',     href: '/admin/tax-rates',     icon: FileText },
  { label: 'Txn Types',     href: '/admin/txn-types',     icon: ArrowLeftRight },
  { label: 'Maker-Checker', href: '/admin/maker-checker', icon: Shield },
  { label: 'API Keys',      href: '/admin/api-keys',      icon: Key },
  { label: 'Webhooks',      href: '/admin/webhooks',      icon: Webhook },
  { label: 'Branding',      href: '/admin/branding',      icon: Settings },
];

interface SidebarProps {
  variant?: 'ops' | 'admin';
}

export function Sidebar({ variant = 'ops' }: SidebarProps) {
  const pathname = usePathname();
  const { hasPermission } = useAuth();
  const nav = variant === 'ops' ? OPS_NAV : ADMIN_NAV;

  return (
    <aside className="w-60 min-h-screen border-r border-border bg-card flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-border">
        <span className="text-lg font-bold text-primary">NexCore</span>
        {variant === 'admin' && (
          <span className="ml-2 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
            Admin
          </span>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map((item) => {
          if (item.permission && !hasPermission(item.permission)) return null;

          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-6 py-4 border-t border-border">
        <p className="text-xs text-muted-foreground">v0.1.0</p>
      </div>
    </aside>
  );
}
