'use client';

import { useEffect, useState } from 'react';
import {
  useSetupStore,
  useTenantStore,
  useLeaseStore,
  useIncomeStore,
  useExpenseStore,
  useMileageStore,
  useMaintenanceStore,
} from '@/lib/store';

export default function DataLoader({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Phase 1: setup (settings, properties, units) — needed by other stores
        await useSetupStore.getState().fetchAll();

        // Phase 2: everything else in parallel
        await Promise.all([
          useTenantStore.getState().fetchTenants(),
          useLeaseStore.getState().fetchLeases(),
          useIncomeStore.getState().fetchRecords(),
          useExpenseStore.getState().fetchRecords(),
          useMileageStore.getState().fetchAll(),
          useMaintenanceStore.getState().fetchTasks(),
        ]);

        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-600 font-medium mb-2">Failed to load data</p>
          <p className="text-sm text-slate-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading your data...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
