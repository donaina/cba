'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const { user, signOut } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    try {
      await signOut();
      router.replace('/login');
    } catch {
      toast.error('Sign out failed. Please try again.');
    }
  }

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-card">
      <h1 className="text-sm font-semibold text-foreground">{title ?? 'Dashboard'}</h1>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-foreground leading-none">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
        </div>

        <button
          onClick={handleSignOut}
          className={cn(
            'flex items-center gap-1.5 text-xs text-muted-foreground',
            'hover:text-destructive transition-colors ml-2',
          )}
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
