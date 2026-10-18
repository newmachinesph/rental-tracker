/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { apiFetch, mapEnum, unmapEnum, nullToEmpty, emptyToNull } from './api';
import { DEFAULT_SIDEBAR_MODULES } from './sidebar-modules';
import type {
  Property, Unit, Tenant, Lease, IncomeRecord, ExpenseRecord,
  MileageRate, MileageLog, MileageUnit, MaintenanceTask, OwnerInfo,
  PaymentStatus, MaintenancePriority, MaintenanceStatus, MaintenancePaymentStatus,
} from './types';

// ─── Debounce helpers ─────────────────────────────────────

let settingsTimer: ReturnType<typeof setTimeout> | null = null;
let ownerInfoTimer: ReturnType<typeof setTimeout> | null = null;
const propertyTimers = new Map<string, ReturnType<typeof setTimeout>>();

function debouncedSaveSettings(data: Record<string, unknown>) {
  if (settingsTimer) clearTimeout(settingsTimer);
  settingsTimer = setTimeout(() => {
    apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(data) }).catch(console.error);
  }, 500);
}

function debouncedSaveOwnerInfo(data: Partial<OwnerInfo>) {
  if (ownerInfoTimer) clearTimeout(ownerInfoTimer);
  ownerInfoTimer = setTimeout(() => {
    apiFetch('/api/settings/owner-info', { method: 'PUT', body: JSON.stringify(data) }).catch(console.error);
  }, 500);
}

// ─── Setup Store ─────────────────────────────────────────────

interface SetupState {
  currency: string;
  propertyTypes: string[];
  properties: Property[];
  units: Unit[];
  incomeCategories: string[];
  expenseCategories: string[];
  paymentMethods: string[];
  sidebarModules: Record<string, boolean>;
  ownerInfo: OwnerInfo;
  loading: boolean;
  error: string | null;
  fetchAll: () => Promise<void>;
  setCurrency: (c: string) => void;
  setOwnerInfo: (o: Partial<OwnerInfo>) => void;
  setPropertyTypes: (t: string[]) => void;
  addProperty: (p: Property) => Promise<void>;
  updateProperty: (id: string, p: Partial<Property>) => void;
  removeProperty: (id: string) => Promise<void>;
  addUnit: (u: Unit) => Promise<void>;
  updateUnit: (id: string, u: Partial<Unit>) => Promise<void>;
  removeUnit: (id: string) => Promise<void>;
  setIncomeCategories: (c: string[]) => void;
  setExpenseCategories: (c: string[]) => void;
  setPaymentMethods: (m: string[]) => void;
  toggleSidebarModule: (key: string, visible: boolean) => void;
}

export const useSetupStore = create<SetupState>((set, get) => ({
  currency: '₱',
  propertyTypes: [],
  properties: [],
  units: [],
  incomeCategories: [],
  expenseCategories: [],
  paymentMethods: [],
  sidebarModules: { ...DEFAULT_SIDEBAR_MODULES },
  ownerInfo: { name: '', company: '', address: '', phone: '', email: '' },
  loading: false,
  error: null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const [settings, ownerInfo, properties, units] = await Promise.all([
        apiFetch<any>('/api/settings').catch(() => null),
        apiFetch<any>('/api/settings/owner-info').catch(() => null),
        apiFetch<any[]>('/api/properties'),
        apiFetch<any[]>('/api/units'),
      ]);
      set({
        currency: settings?.currency ?? '₱',
        propertyTypes: settings?.propertyTypes ?? [],
        incomeCategories: settings?.incomeCategories ?? [],
        expenseCategories: settings?.expenseCategories ?? [],
        paymentMethods: settings?.paymentMethods ?? [],
        sidebarModules: settings?.sidebarModules
          ? { ...DEFAULT_SIDEBAR_MODULES, ...(settings.sidebarModules as Record<string, boolean>) }
          : { ...DEFAULT_SIDEBAR_MODULES },
        ownerInfo: {
          name: ownerInfo?.name ?? '',
          company: ownerInfo?.company ?? '',
          address: ownerInfo?.address ?? '',
          phone: ownerInfo?.phone ?? '',
          email: ownerInfo?.email ?? '',
        },
        properties: properties.map((p: any) => ({
          id: p.id, name: p.name, units: p.units, type: p.type, address: p.address ?? '',
        })),
        units: units.map((u: any) => ({
          id: u.id, propertyId: u.propertyId, unitNumber: u.unitNumber, address: u.address ?? '',
        })),
        loading: false,
      });
      // Also set mileage unit if available (direct set to avoid re-saving to API)
      if (settings?.mileageUnit) {
        useMileageStore.setState({ unit: settings.mileageUnit as MileageUnit });
      }
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  setCurrency: (c) => {
    set({ currency: c });
    debouncedSaveSettings({ currency: c });
  },

  setOwnerInfo: (o) => set((s) => {
    const updated = { ...s.ownerInfo, ...o };
    debouncedSaveOwnerInfo(updated);
    return { ownerInfo: updated };
  }),

  setPropertyTypes: (t) => {
    set({ propertyTypes: t });
    apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify({ propertyTypes: t }) }).catch(console.error);
  },

  setIncomeCategories: (c) => {
    set({ incomeCategories: c });
    apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify({ incomeCategories: c }) }).catch(console.error);
  },

  setExpenseCategories: (c) => {
    set({ expenseCategories: c });
    apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify({ expenseCategories: c }) }).catch(console.error);
  },

  setPaymentMethods: (m) => {
    set({ paymentMethods: m });
    apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify({ paymentMethods: m }) }).catch(console.error);
  },

  toggleSidebarModule: (key, visible) => {
    set((s) => {
      const updated = { ...s.sidebarModules, [key]: visible };
      debouncedSaveSettings({ sidebarModules: updated });
      return { sidebarModules: updated };
    });
  },

  addProperty: async (p) => {
    try {
      const created = await apiFetch<any>('/api/properties', {
        method: 'POST',
        body: JSON.stringify({ name: p.name, units: p.units, type: p.type, address: p.address ?? '' }),
      });
      const mapped: Property = { id: created.id, name: created.name, units: created.units, type: created.type, address: created.address ?? '' };
      const newUnits: Unit[] = (created.unitList ?? []).map((u: any) => ({
        id: u.id, propertyId: u.propertyId, unitNumber: u.unitNumber, address: u.address ?? '',
      }));
      set((s) => ({
        properties: [...s.properties, mapped],
        units: [...s.units, ...newUnits],
      }));
    } catch (e) {
      console.error('Failed to add property:', e);
    }
  },

  updateProperty: (id, p) => {
    set((s) => ({ properties: s.properties.map((x) => x.id === id ? { ...x, ...p } : x) }));
    if (propertyTimers.has(id)) clearTimeout(propertyTimers.get(id)!);
    propertyTimers.set(id, setTimeout(async () => {
      const current = get().properties.find((x) => x.id === id);
      if (!current) return;
      try {
        await apiFetch(`/api/properties/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ name: current.name, type: current.type, address: current.address }),
        });
      } catch (e) {
        console.error('Failed to update property:', e);
      }
    }, 500));
  },

  removeProperty: async (id) => {
    try {
      await apiFetch(`/api/properties/${id}`, { method: 'DELETE' });
      set((s) => ({
        properties: s.properties.filter((x) => x.id !== id),
        units: s.units.filter((u) => u.propertyId !== id),
      }));
    } catch (e) {
      console.error('Failed to remove property:', e);
    }
  },

  addUnit: async (u) => {
    try {
      const created = await apiFetch<any>('/api/units', {
        method: 'POST',
        body: JSON.stringify({ propertyId: u.propertyId, unitNumber: u.unitNumber, address: u.address ?? '' }),
      });
      const mapped: Unit = { id: created.id, propertyId: created.propertyId, unitNumber: created.unitNumber, address: created.address ?? '' };
      set((s) => ({ units: [...s.units, mapped] }));
    } catch (e) {
      console.error('Failed to add unit:', e);
    }
  },

  updateUnit: async (id, u) => {
    try {
      const updated = await apiFetch<any>(`/api/units/${id}`, {
        method: 'PUT',
        body: JSON.stringify(u),
      });
      set((s) => ({
        units: s.units.map((x) => x.id === id ? { id: updated.id, propertyId: updated.propertyId, unitNumber: updated.unitNumber, address: updated.address ?? '' } : x),
      }));
    } catch (e) {
      console.error('Failed to update unit:', e);
    }
  },

  removeUnit: async (id) => {
    try {
      await apiFetch(`/api/units/${id}`, { method: 'DELETE' });
      set((s) => ({ units: s.units.filter((x) => x.id !== id) }));
    } catch (e) {
      console.error('Failed to remove unit:', e);
    }
  },
}));

// ─── Tenants Store ───────────────────────────────────────────

interface TenantState {
  tenants: Tenant[];
  loading: boolean;
  error: string | null;
  fetchTenants: () => Promise<void>;
  addTenant: (t: Tenant) => Promise<void>;
  updateTenant: (id: string, t: Partial<Tenant>) => Promise<void>;
  removeTenant: (id: string) => Promise<void>;
}

export const useTenantStore = create<TenantState>((set) => ({
  tenants: [],
  loading: false,
  error: null,

  fetchTenants: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<any[]>('/api/tenants');
      set({
        tenants: data.map((t: any) => ({ id: t.id, name: t.name, phone: t.phone ?? '', email: t.email ?? '' })),
        loading: false,
      });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  addTenant: async (t) => {
    try {
      const created = await apiFetch<any>('/api/tenants', {
        method: 'POST',
        body: JSON.stringify({ name: t.name, phone: t.phone, email: t.email }),
      });
      set((s) => ({ tenants: [...s.tenants, { id: created.id, name: created.name, phone: created.phone ?? '', email: created.email ?? '' }] }));
    } catch (e) {
      console.error('Failed to add tenant:', e);
    }
  },

  updateTenant: async (id, t) => {
    try {
      const updated = await apiFetch<any>(`/api/tenants/${id}`, {
        method: 'PUT',
        body: JSON.stringify(t),
      });
      set((s) => ({ tenants: s.tenants.map((x) => x.id === id ? { id: updated.id, name: updated.name, phone: updated.phone ?? '', email: updated.email ?? '' } : x) }));
    } catch (e) {
      console.error('Failed to update tenant:', e);
    }
  },

  removeTenant: async (id) => {
    try {
      await apiFetch(`/api/tenants/${id}`, { method: 'DELETE' });
      set((s) => ({ tenants: s.tenants.filter((x) => x.id !== id) }));
    } catch (e) {
      console.error('Failed to remove tenant:', e);
    }
  },
}));

// ─── Lease Store ─────────────────────────────────────────────

interface LeaseState {
  leases: Lease[];
  loading: boolean;
  error: string | null;
  fetchLeases: () => Promise<void>;
  addLease: (l: Lease) => Promise<void>;
  updateLease: (id: string, l: Partial<Lease>) => Promise<void>;
  removeLease: (id: string) => Promise<void>;
}

function mapLease(raw: any): Lease {
  return {
    id: raw.id, propertyId: raw.propertyId, unitId: raw.unitId, tenantId: raw.tenantId,
    unitAddress: raw.unitAddress ?? '', leaseStart: raw.leaseStart, leaseEnd: raw.leaseEnd,
    monthlyRent: raw.monthlyRent, deposit: raw.deposit ?? 0,
    isCurrentTenant: raw.isCurrentTenant ?? true, isRecurringRent: raw.isRecurringRent ?? true,
    notes: raw.notes ?? '',
  };
}

export const useLeaseStore = create<LeaseState>((set) => ({
  leases: [],
  loading: false,
  error: null,

  fetchLeases: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<any[]>('/api/leases');
      set({ leases: data.map(mapLease), loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  addLease: async (l) => {
    try {
      const created = await apiFetch<any>('/api/leases', {
        method: 'POST',
        body: JSON.stringify({
          propertyId: l.propertyId, unitId: l.unitId, tenantId: l.tenantId,
          unitAddress: l.unitAddress, leaseStart: l.leaseStart, leaseEnd: l.leaseEnd,
          monthlyRent: l.monthlyRent, deposit: l.deposit,
          isCurrentTenant: l.isCurrentTenant, isRecurringRent: l.isRecurringRent, notes: l.notes,
        }),
      });
      set((s) => ({ leases: [...s.leases, mapLease(created)] }));
    } catch (e) {
      console.error('Failed to add lease:', e);
    }
  },

  updateLease: async (id, l) => {
    try {
      const updated = await apiFetch<any>(`/api/leases/${id}`, {
        method: 'PUT', body: JSON.stringify(l),
      });
      set((s) => ({ leases: s.leases.map((x) => x.id === id ? mapLease(updated) : x) }));
    } catch (e) {
      console.error('Failed to update lease:', e);
    }
  },

  removeLease: async (id) => {
    try {
      await apiFetch(`/api/leases/${id}`, { method: 'DELETE' });
      set((s) => ({ leases: s.leases.filter((x) => x.id !== id) }));
    } catch (e) {
      console.error('Failed to remove lease:', e);
    }
  },
}));

// ─── Income Store ────────────────────────────────────────────

interface IncomeState {
  records: IncomeRecord[];
  loading: boolean;
  error: string | null;
  fetchRecords: () => Promise<void>;
  addRecord: (r: IncomeRecord) => Promise<IncomeRecord | null>;
  updateRecord: (id: string, r: Partial<IncomeRecord>) => Promise<void>;
  removeRecord: (id: string) => Promise<void>;
}

function mapIncome(raw: any): IncomeRecord {
  return {
    id: raw.id, propertyId: raw.propertyId, unitId: raw.unitId, tenantId: raw.tenantId,
    category: raw.category ?? '', rentDueDate: raw.rentDueDate ?? '',
    rentAmount: raw.rentAmount ?? 0, additionalIncome: raw.additionalIncome ?? 0,
    totalDue: raw.totalDue ?? 0, paymentDate: raw.paymentDate ?? '',
    amountPaid: raw.amountPaid ?? 0, outstandingBalance: raw.outstandingBalance ?? 0,
    paymentStatus: mapEnum(raw.paymentStatus ?? 'Pending') as PaymentStatus,
    delayDays: raw.delayDays ?? 0, paymentMethod: raw.paymentMethod ?? '', notes: raw.notes ?? '',
    receiptUrl: raw.receiptUrl ?? '',
  };
}

export const useIncomeStore = create<IncomeState>((set) => ({
  records: [],
  loading: false,
  error: null,

  fetchRecords: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<any[]>('/api/income');
      set({ records: data.map(mapIncome), loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  addRecord: async (r) => {
    try {
      const created = await apiFetch<any>('/api/income', {
        method: 'POST',
        body: JSON.stringify({
          propertyId: r.propertyId, unitId: r.unitId, tenantId: r.tenantId,
          category: r.category, rentDueDate: r.rentDueDate, rentAmount: r.rentAmount,
          additionalIncome: r.additionalIncome, paymentDate: r.paymentDate,
          amountPaid: r.amountPaid, paymentMethod: r.paymentMethod, notes: r.notes,
          receiptUrl: r.receiptUrl,
        }),
      });
      const mapped = mapIncome(created);
      set((s) => ({ records: [...s.records, mapped] }));
      return mapped;
    } catch (e) {
      console.error('Failed to add income record:', e);
      return null;
    }
  },

  updateRecord: async (id, r) => {
    try {
      const payload: any = { ...r };
      if (payload.paymentStatus) payload.paymentStatus = unmapEnum(payload.paymentStatus);
      delete payload.id;
      delete payload.totalDue;
      delete payload.outstandingBalance;
      delete payload.delayDays;
      const updated = await apiFetch<any>(`/api/income/${id}`, {
        method: 'PUT', body: JSON.stringify(payload),
      });
      set((s) => ({ records: s.records.map((x) => x.id === id ? mapIncome(updated) : x) }));
    } catch (e) {
      console.error('Failed to update income record:', e);
    }
  },

  removeRecord: async (id) => {
    try {
      await apiFetch(`/api/income/${id}`, { method: 'DELETE' });
      set((s) => ({ records: s.records.filter((x) => x.id !== id) }));
    } catch (e) {
      console.error('Failed to remove income record:', e);
    }
  },
}));

// ─── Expense Store ───────────────────────────────────────────

interface ExpenseState {
  records: ExpenseRecord[];
  loading: boolean;
  error: string | null;
  fetchRecords: () => Promise<void>;
  addRecord: (r: ExpenseRecord) => Promise<ExpenseRecord | null>;
  updateRecord: (id: string, r: Partial<ExpenseRecord>) => Promise<void>;
  removeRecord: (id: string) => Promise<void>;
}

function mapExpense(raw: any): ExpenseRecord {
  return {
    id: raw.id, date: raw.date, propertyId: raw.propertyId,
    appliesToEntireBuilding: raw.appliesToEntireBuilding ?? false,
    unitId: nullToEmpty(raw.unitId), category: raw.category ?? '',
    amount: raw.amount ?? 0, additionalFees: raw.additionalFees ?? 0,
    total: raw.total ?? 0, notes: raw.notes ?? '',
  };
}

export const useExpenseStore = create<ExpenseState>((set) => ({
  records: [],
  loading: false,
  error: null,

  fetchRecords: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<any[]>('/api/expenses');
      set({ records: data.map(mapExpense), loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  addRecord: async (r) => {
    try {
      const created = await apiFetch<any>('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          date: r.date, propertyId: r.propertyId,
          appliesToEntireBuilding: r.appliesToEntireBuilding,
          unitId: r.appliesToEntireBuilding ? null : emptyToNull(r.unitId),
          category: r.category, amount: r.amount, additionalFees: r.additionalFees,
          notes: r.notes,
        }),
      });
      const mapped = mapExpense(created);
      set((s) => ({ records: [...s.records, mapped] }));
      return mapped;
    } catch (e) {
      console.error('Failed to add expense record:', e);
      return null;
    }
  },

  updateRecord: async (id, r) => {
    try {
      const payload: any = { ...r };
      if (payload.unitId !== undefined) payload.unitId = payload.appliesToEntireBuilding ? null : emptyToNull(payload.unitId);
      delete payload.id;
      delete payload.total;
      const updated = await apiFetch<any>(`/api/expenses/${id}`, {
        method: 'PUT', body: JSON.stringify(payload),
      });
      set((s) => ({ records: s.records.map((x) => x.id === id ? mapExpense(updated) : x) }));
    } catch (e) {
      console.error('Failed to update expense record:', e);
    }
  },

  removeRecord: async (id) => {
    try {
      await apiFetch(`/api/expenses/${id}`, { method: 'DELETE' });
      set((s) => ({ records: s.records.filter((x) => x.id !== id) }));
    } catch (e) {
      console.error('Failed to remove expense record:', e);
    }
  },
}));

// ─── Mileage Store ───────────────────────────────────────────

interface MileageState {
  unit: MileageUnit;
  rates: MileageRate[];
  logs: MileageLog[];
  loading: boolean;
  error: string | null;
  fetchAll: () => Promise<void>;
  setUnit: (u: MileageUnit) => void;
  addRate: (r: MileageRate) => Promise<void>;
  updateRate: (id: string, r: Partial<MileageRate>) => void;
  removeRate: (id: string) => Promise<void>;
  addLog: (l: MileageLog) => Promise<void>;
  updateLog: (id: string, l: Partial<MileageLog>) => Promise<void>;
  removeLog: (id: string) => Promise<void>;
}

const rateTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const useMileageStore = create<MileageState>((set, get) => ({
  unit: 'miles',
  rates: [],
  logs: [],
  loading: false,
  error: null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const [rates, logs] = await Promise.all([
        apiFetch<any[]>('/api/mileage/rates'),
        apiFetch<any[]>('/api/mileage/logs'),
      ]);
      set({
        rates: rates.map((r: any) => ({ id: r.id, rate: r.rate, startDate: r.startDate, endDate: r.endDate })),
        logs: logs.map((l: any) => ({ id: l.id, date: l.date, distance: l.distance, amount: l.amount ?? 0, propertyId: l.propertyId, description: l.description ?? '' })),
        loading: false,
      });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  setUnit: (u) => {
    set({ unit: u });
    apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify({ mileageUnit: u }) }).catch(console.error);
  },

  addRate: async (r) => {
    try {
      const created = await apiFetch<any>('/api/mileage/rates', {
        method: 'POST',
        body: JSON.stringify({ rate: r.rate, startDate: r.startDate, endDate: r.endDate }),
      });
      set((s) => ({ rates: [...s.rates, { id: created.id, rate: created.rate, startDate: created.startDate, endDate: created.endDate }] }));
    } catch (e) {
      console.error('Failed to add mileage rate:', e);
    }
  },

  updateRate: (id, r) => {
    set((s) => ({ rates: s.rates.map((x) => x.id === id ? { ...x, ...r } : x) }));
    if (rateTimers.has(id)) clearTimeout(rateTimers.get(id)!);
    rateTimers.set(id, setTimeout(async () => {
      const current = get().rates.find((x) => x.id === id);
      if (!current) return;
      try {
        await apiFetch(`/api/mileage/rates/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ rate: current.rate, startDate: current.startDate, endDate: current.endDate }),
        });
      } catch (e) {
        console.error('Failed to update mileage rate:', e);
      }
    }, 500));
  },

  removeRate: async (id) => {
    try {
      await apiFetch(`/api/mileage/rates/${id}`, { method: 'DELETE' });
      set((s) => ({ rates: s.rates.filter((x) => x.id !== id) }));
    } catch (e) {
      console.error('Failed to remove mileage rate:', e);
    }
  },

  addLog: async (l) => {
    try {
      const created = await apiFetch<any>('/api/mileage/logs', {
        method: 'POST',
        body: JSON.stringify({ propertyId: l.propertyId, date: l.date, distance: l.distance, amount: l.amount, description: l.description }),
      });
      set((s) => ({ logs: [...s.logs, { id: created.id, date: created.date, distance: created.distance, amount: created.amount ?? 0, propertyId: created.propertyId, description: created.description ?? '' }] }));
    } catch (e) {
      console.error('Failed to add mileage log:', e);
    }
  },

  updateLog: async (id, l) => {
    try {
      const updated = await apiFetch<any>(`/api/mileage/logs/${id}`, {
        method: 'PUT', body: JSON.stringify(l),
      });
      set((s) => ({ logs: s.logs.map((x) => x.id === id ? { id: updated.id, date: updated.date, distance: updated.distance, amount: updated.amount ?? 0, propertyId: updated.propertyId, description: updated.description ?? '' } : x) }));
    } catch (e) {
      console.error('Failed to update mileage log:', e);
    }
  },

  removeLog: async (id) => {
    try {
      await apiFetch(`/api/mileage/logs/${id}`, { method: 'DELETE' });
      set((s) => ({ logs: s.logs.filter((x) => x.id !== id) }));
    } catch (e) {
      console.error('Failed to remove mileage log:', e);
    }
  },
}));

// ─── Maintenance Store ───────────────────────────────────────

interface MaintenanceState {
  tasks: MaintenanceTask[];
  loading: boolean;
  error: string | null;
  fetchTasks: () => Promise<void>;
  addTask: (t: MaintenanceTask) => Promise<MaintenanceTask | null>;
  updateTask: (id: string, t: Partial<MaintenanceTask>) => Promise<void>;
  removeTask: (id: string) => Promise<void>;
}

function mapMaintenance(raw: any): MaintenanceTask {
  return {
    id: raw.id, propertyId: raw.propertyId,
    appliesToEntireBuilding: raw.appliesToEntireBuilding ?? false,
    unitId: nullToEmpty(raw.unitId), dateReported: raw.dateReported,
    description: raw.description ?? '',
    priority: mapEnum(raw.priority ?? 'Medium') as MaintenanceTask['priority'],
    category: raw.category ?? '', contractor: raw.contractor ?? '',
    estimatedCost: raw.estimatedCost ?? 0, actualCost: raw.actualCost ?? 0,
    paymentStatus: mapEnum(raw.paymentStatus ?? 'Unpaid') as MaintenanceTask['paymentStatus'],
    completionDate: raw.completionDate ?? '',
    status: mapEnum(raw.status ?? 'Open') as MaintenanceTask['status'],
    notes: raw.notes ?? '',
  };
}

export const useMaintenanceStore = create<MaintenanceState>((set) => ({
  tasks: [],
  loading: false,
  error: null,

  fetchTasks: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiFetch<any[]>('/api/maintenance');
      set({ tasks: data.map(mapMaintenance), loading: false });
    } catch (e) {
      set({ error: (e as Error).message, loading: false });
    }
  },

  addTask: async (t) => {
    try {
      const created = await apiFetch<any>('/api/maintenance', {
        method: 'POST',
        body: JSON.stringify({
          propertyId: t.propertyId, appliesToEntireBuilding: t.appliesToEntireBuilding,
          unitId: t.appliesToEntireBuilding ? null : emptyToNull(t.unitId),
          dateReported: t.dateReported, description: t.description,
          priority: unmapEnum(t.priority), category: t.category,
          contractor: t.contractor, estimatedCost: t.estimatedCost,
          actualCost: t.actualCost, paymentStatus: unmapEnum(t.paymentStatus),
          completionDate: t.completionDate, status: unmapEnum(t.status), notes: t.notes,
        }),
      });
      const mapped = mapMaintenance(created);
      set((s) => ({ tasks: [...s.tasks, mapped] }));
      return mapped;
    } catch (e) {
      console.error('Failed to add maintenance task:', e);
      return null;
    }
  },

  updateTask: async (id, t) => {
    try {
      const payload: any = { ...t };
      if (payload.priority) payload.priority = unmapEnum(payload.priority);
      if (payload.paymentStatus) payload.paymentStatus = unmapEnum(payload.paymentStatus);
      if (payload.status) payload.status = unmapEnum(payload.status);
      if (payload.unitId !== undefined) payload.unitId = payload.appliesToEntireBuilding ? null : emptyToNull(payload.unitId);
      delete payload.id;
      const updated = await apiFetch<any>(`/api/maintenance/${id}`, {
        method: 'PUT', body: JSON.stringify(payload),
      });
      set((s) => ({ tasks: s.tasks.map((x) => x.id === id ? mapMaintenance(updated) : x) }));
    } catch (e) {
      console.error('Failed to update maintenance task:', e);
    }
  },

  removeTask: async (id) => {
    try {
      await apiFetch(`/api/maintenance/${id}`, { method: 'DELETE' });
      set((s) => ({ tasks: s.tasks.filter((x) => x.id !== id) }));
    } catch (e) {
      console.error('Failed to remove maintenance task:', e);
    }
  },
}));
