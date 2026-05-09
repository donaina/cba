'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getTenantId } from '@/lib/auth';

interface TenantStore {
  activeBranchId: string | null;
  setActiveBranchId: (id: string | null) => void;
}

export const useTenantStore = create<TenantStore>()(
  persist(
    (set) => ({
      activeBranchId: null,
      setActiveBranchId: (id) => set({ activeBranchId: id }),
    }),
    { name: 'cba-tenant-branch' },
  ),
);

interface TenantContextValue {
  tenantId: string | null;
  activeBranchId: string | null;
  setActiveBranchId: (id: string | null) => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const tenantId = getTenantId() ?? null;
  const { activeBranchId, setActiveBranchId } = useTenantStore();

  return (
    <TenantContext.Provider value={{ tenantId, activeBranchId, setActiveBranchId }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used inside <TenantProvider>');
  return ctx;
}
