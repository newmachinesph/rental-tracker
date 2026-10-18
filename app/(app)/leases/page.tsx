'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { Plus, Trash2, UserPlus } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import '@/lib/ag-grid-setup';

import { useSetupStore, useLeaseStore, useTenantStore } from '@/lib/store';
import type { Lease } from '@/lib/types';
import { Modal, FieldGroup } from '@/components/ui/Modal';
import { useDebounce } from '@/lib/hooks/useDebounce';
import DataToolbar from '@/components/DataToolbar';
import type { ViewMode, FilterValues, FilterValue } from '@/components/DataToolbar';
import CardGrid from '@/components/cards/CardGrid';
import LeaseCard from '@/components/cards/LeaseCard';

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcLeaseMonths(start: string, end: string): number | null {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
  return Math.max(0, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()));
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none';

/* ─── Default advanced filter state ─────────────────────────── */

const defaultAdvancedFilters: FilterValues = {
  leaseDate: { min: '', max: '' },
  rent: { min: '', max: '' },
  recurring: 'all',
};

export default function LeasesPage() {
  const { properties, units, currency } = useSetupStore();
  const { tenants, addTenant } = useTenantStore();
  const { leases, addLease, updateLease, removeLease } = useLeaseStore();

  const [filterProperty, setFilterProperty] = useState<string>('all');
  const [filterCurrentTenant, setFilterCurrentTenant] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLease, setEditingLease] = useState<Lease | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const gridRef = useRef<AgGridReact<Lease>>(null);

  // Tenant management state (add-only; full management on Tenants page)
  const [tenantModalOpen, setTenantModalOpen] = useState(false);
  const [tenantForm, setTenantForm] = useState({ name: '', phone: '', email: '' });

  /* ─── New state for search, view mode, advanced filters ───── */

  const [searchValue, setSearchValue] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [advancedFilters, setAdvancedFilters] = useState<FilterValues>(defaultAdvancedFilters);

  const debouncedSearch = useDebounce(searchValue);

  /* ─── Lookup maps ─────────────────────────────────────────── */

  const propertyMap = useMemo(() => Object.fromEntries(properties.map((p) => [p.id, p])), [properties]);
  const unitMap = useMemo(() => Object.fromEntries(units.map((u) => [u.id, u])), [units]);
  const tenantMap = useMemo(() => Object.fromEntries(tenants.map((t) => [t.id, t])), [tenants]);

  /* ─── Filtered leases (primary -> advanced -> search) ─────── */

  const filteredLeases = useMemo(() => {
    let result = leases;

    // 1. Primary filters
    if (filterProperty !== 'all') {
      result = result.filter((l) => l.propertyId === filterProperty);
    }
    if (filterCurrentTenant === 'yes') {
      result = result.filter((l) => l.isCurrentTenant);
    } else if (filterCurrentTenant === 'no') {
      result = result.filter((l) => !l.isCurrentTenant);
    }

    // 2. Advanced filters
    const leaseDateRange = advancedFilters.leaseDate;
    if (typeof leaseDateRange === 'object' && 'min' in leaseDateRange) {
      if (leaseDateRange.min) {
        result = result.filter((l) => l.leaseStart >= leaseDateRange.min);
      }
      if (leaseDateRange.max) {
        result = result.filter((l) => l.leaseStart <= leaseDateRange.max);
      }
    }

    const rentRange = advancedFilters.rent;
    if (typeof rentRange === 'object' && 'min' in rentRange) {
      if (rentRange.min) {
        result = result.filter((l) => l.monthlyRent >= parseFloat(rentRange.min));
      }
      if (rentRange.max) {
        result = result.filter((l) => l.monthlyRent <= parseFloat(rentRange.max));
      }
    }

    const recurringFilter = advancedFilters.recurring;
    if (typeof recurringFilter === 'string' && recurringFilter !== 'all') {
      result = result.filter((l) => (recurringFilter === 'yes') === l.isRecurringRent);
    }

    // 3. Text search
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      result = result.filter((l) => {
        const propName = propertyMap[l.propertyId]?.name ?? '';
        const tenantName = tenantMap[l.tenantId]?.name ?? '';
        const unitNumber = unitMap[l.unitId]?.unitNumber ?? '';
        const unitAddr = l.unitAddress ?? '';
        const notes = l.notes ?? '';
        return (
          propName.toLowerCase().includes(q) ||
          tenantName.toLowerCase().includes(q) ||
          unitNumber.toLowerCase().includes(q) ||
          unitAddr.toLowerCase().includes(q) ||
          notes.toLowerCase().includes(q)
        );
      });
    }

    return result;
  }, [leases, filterProperty, filterCurrentTenant, advancedFilters, debouncedSearch, propertyMap, tenantMap, unitMap]);

  /* ─── KPI computations ────────────────────────────────────── */

  const activeLeases = useMemo(() => filteredLeases.filter((l) => l.isCurrentTenant).length, [filteredLeases]);
  const avgRent = useMemo(() => {
    const active = filteredLeases.filter((l) => l.isCurrentTenant && l.monthlyRent > 0);
    return active.length > 0 ? active.reduce((s, l) => s + l.monthlyRent, 0) / active.length : 0;
  }, [filteredLeases]);
  const totalMonthlyRevenue = useMemo(() => filteredLeases.filter((l) => l.isCurrentTenant).reduce((s, l) => s + l.monthlyRent, 0), [filteredLeases]);

  const getUnitsForProperty = useCallback(
    (propertyId: string) => units.filter((u) => u.propertyId === propertyId),
    [units],
  );

  /* ─── Handlers ────────────────────────────────────────────── */

  const handleFieldChange = useCallback(
    (lease: Lease, field: keyof Lease, value: string | number | boolean) => {
      const patch: Partial<Lease> = { [field]: value };

      if (field === 'propertyId') {
        patch.unitId = '';
        patch.unitAddress = '';
      }
      if (field === 'unitId') {
        const unit = units.find((u) => u.id === value);
        patch.unitAddress = unit?.address ?? '';
      }

      setEditingLease((prev) => prev && prev.id === lease.id ? { ...prev, ...patch } as Lease : prev);
    },
    [units],
  );

  const handleAddLease = () => {
    setEditingLease({
      id: '',
      propertyId: '',
      unitId: '',
      tenantId: '',
      unitAddress: '',
      leaseStart: '',
      leaseEnd: '',
      monthlyRent: 0,
      deposit: 0,
      isCurrentTenant: true,
      isRecurringRent: false,
      notes: '',
    });
    setIsNewRecord(true);
    setModalOpen(true);
  };

  const handleCellClicked = useCallback((event: { data: Lease | undefined; column: { getColId: () => string } }) => {
    if (event.column.getColId() === 'actions' || event.column.getColId().startsWith('ag-Grid')) return;
    if (event.data) { setEditingLease({ ...event.data }); setIsNewRecord(false); setModalOpen(true); }
  }, []);

  const handleCardClick = useCallback((record: Lease) => {
    setEditingLease({ ...record });
    setIsNewRecord(false);
    setModalOpen(true);
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingLease(null);
    setIsNewRecord(false);
  }, []);

  const handleSaveModal = useCallback(async () => {
    if (editingLease) {
      if (isNewRecord) {
        await addLease(editingLease);
      } else {
        await updateLease(editingLease.id, editingLease);
      }
    }
    setModalOpen(false);
    setEditingLease(null);
    setIsNewRecord(false);
  }, [editingLease, isNewRecord, addLease, updateLease]);

  const handleDelete = useCallback((id: string) => {
    removeLease(id);
    if (editingLease?.id === id) { setModalOpen(false); setEditingLease(null); }
  }, [removeLease, editingLease]);

  const handleBulkDelete = useCallback(() => {
    for (const id of selectedIds) { removeLease(id); }
    setSelectedIds([]);
    setBulkDeleteOpen(false);
    gridRef.current?.api.deselectAll();
  }, [selectedIds, removeLease]);

  const handleSelectionChanged = useCallback(() => {
    const rows = gridRef.current?.api.getSelectedRows() ?? [];
    setSelectedIds(rows.map(r => r.id));
  }, []);

  // Tenant management handlers
  const handleOpenAddTenant = useCallback(() => {
    setTenantForm({ name: '', phone: '', email: '' });
    setTenantModalOpen(true);
  }, []);

  const handleCloseTenantModal = useCallback(() => {
    setTenantModalOpen(false);
    setTenantForm({ name: '', phone: '', email: '' });
  }, []);

  const handleSaveTenant = useCallback(() => {
    if (!tenantForm.name.trim()) return;
    addTenant({ id: '', ...tenantForm });
    handleCloseTenantModal();
  }, [tenantForm, addTenant, handleCloseTenantModal]);

  /* ─── Primary filter change handler ───────────────────────── */

  const handlePrimaryFilterChange = useCallback((key: string, value: string) => {
    if (key === 'property') setFilterProperty(value);
    if (key === 'currentTenant') setFilterCurrentTenant(value);
  }, []);

  /* ─── Advanced filter change handler ──────────────────────── */

  const handleAdvancedFilterChange = useCallback((key: string, value: FilterValue) => {
    setAdvancedFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  /* ─── Clear all filters ───────────────────────────────────── */

  const handleClearAllFilters = useCallback(() => {
    setFilterProperty('all');
    setFilterCurrentTenant('all');
    setAdvancedFilters(defaultAdvancedFilters);
    setSearchValue('');
  }, []);

  /* ─── AG Grid column definitions ──────────────────────────── */

  const columnDefs = useMemo<ColDef<Lease>[]>(() => [
    { headerName: 'Property', field: 'propertyId', width: 160, cellRenderer: (p: { value: string }) => propertyMap[p.value]?.name ?? '--' },
    { headerName: 'Type', field: 'propertyId' as keyof Lease, colId: 'propertyType', width: 110, cellRenderer: (p: { value: string }) => propertyMap[p.value]?.type ?? '--' },
    { headerName: 'Unit', field: 'unitId', width: 80, cellRenderer: (p: { value: string }) => unitMap[p.value]?.unitNumber ?? '--' },
    { headerName: 'Address', field: 'unitAddress', width: 200 },
    { headerName: 'Tenant', field: 'tenantId', width: 150, cellRenderer: (p: { value: string }) => tenantMap[p.value]?.name ?? '--' },
    { headerName: 'Phone', field: 'tenantId' as keyof Lease, colId: 'phone', width: 120, cellRenderer: (p: { value: string }) => tenantMap[p.value]?.phone ?? '--' },
    { headerName: 'Email', field: 'tenantId' as keyof Lease, colId: 'email', width: 180, cellRenderer: (p: { value: string }) => tenantMap[p.value]?.email ?? '--' },
    { headerName: 'Current', field: 'isCurrentTenant', width: 100, cellRenderer: (p: { value: boolean }) => (
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${p.value ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>{p.value ? 'Yes' : 'No'}</span>
    )},
    { headerName: 'Start', field: 'leaseStart', width: 120 },
    { headerName: 'End', field: 'leaseEnd', width: 120 },
    { headerName: 'Length', colId: 'leaseLength', width: 90, valueGetter: (p: { data: Lease | undefined }) => {
      if (!p.data) return null;
      return calcLeaseMonths(p.data.leaseStart, p.data.leaseEnd);
    }, cellRenderer: (p: { value: number | null }) => p.value !== null ? `${p.value} mo` : '--' },
    { headerName: `Rent (${currency})`, field: 'monthlyRent', width: 130, cellRenderer: (p: { value: number }) => <span className="font-medium">{currency}{fmt(p.value)}</span> },
    { headerName: `Deposit (${currency})`, field: 'deposit', width: 130, cellRenderer: (p: { value: number }) => `${currency}${fmt(p.value)}` },
    { headerName: 'Recurring', field: 'isRecurringRent', width: 100, cellRenderer: (p: { value: boolean }) => (
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${p.value ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>{p.value ? 'Yes' : 'No'}</span>
    )},
    { headerName: 'Notes', field: 'notes', flex: 1, minWidth: 140 },
    { headerName: '', colId: 'actions', width: 60, sortable: false, resizable: false, cellRenderer: (p: { data: Lease }) => (
      <button onClick={() => setDeleteConfirmId(p.data.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-1.5 transition-colors cursor-pointer" title="Remove"><Trash2 size={14} /></button>
    )},
  ], [propertyMap, unitMap, tenantMap, currency]);

  const defaultColDef = useMemo<ColDef>(() => ({ sortable: true, resizable: true }), []);

  const modalUnits = useMemo(() => editingLease?.propertyId ? getUnitsForProperty(editingLease.propertyId) : [], [editingLease?.propertyId, getUnitsForProperty]);

  const onFieldChange = useCallback((field: keyof Lease, value: string | number | boolean) => {
    if (editingLease) handleFieldChange(editingLease, field, value);
  }, [editingLease, handleFieldChange]);

  /* ─── Toolbar config ──────────────────────────────────────── */

  const primaryFilters = useMemo(() => [
    {
      key: 'property',
      label: 'Property',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'All Properties' },
        ...properties.map((p) => ({ value: p.id, label: p.name })),
      ],
    },
    {
      key: 'currentTenant',
      label: 'Current Tenant',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'All' },
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ],
    },
  ], [properties]);

  const primaryFilterValues = useMemo<FilterValues>(() => ({
    property: filterProperty,
    currentTenant: filterCurrentTenant,
  }), [filterProperty, filterCurrentTenant]);

  const advancedFilterConfigs = useMemo(() => [
    {
      key: 'leaseDate',
      label: 'Lease Start Date',
      type: 'dateRange' as const,
    },
    {
      key: 'rent',
      label: 'Monthly Rent',
      type: 'numberRange' as const,
      prefix: currency,
    },
    {
      key: 'recurring',
      label: 'Recurring Rent',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'All' },
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ],
    },
  ], [currency]);

  /* ─── Selected set for card view ──────────────────────────── */

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  return (
    <div>
      <div className="animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Lease Tracker</h1>
            <p className="text-sm text-slate-500 mt-1">Manage all lease agreements and tenant information across your properties.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-blue-500">
          <div className="text-xs text-slate-500 font-medium">Total Leases</div>
          <div className="text-xl font-bold text-slate-800 mt-1">{filteredLeases.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-emerald-500">
          <div className="text-xs text-slate-500 font-medium">Active Tenants</div>
          <div className="text-xl font-bold text-emerald-700 mt-1">{activeLeases}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-indigo-500">
          <div className="text-xs text-slate-500 font-medium">Avg. Monthly Rent</div>
          <div className="text-xl font-bold text-slate-800 mt-1">{currency}{fmt(avgRent)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-amber-500">
          <div className="text-xs text-slate-500 font-medium">Total Monthly Revenue</div>
          <div className="text-xl font-bold text-slate-800 mt-1">{currency}{fmt(totalMonthlyRevenue)}</div>
        </div>
      </div>

      <DataToolbar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search leases..."
        primaryFilters={primaryFilters}
        primaryFilterValues={primaryFilterValues}
        onPrimaryFilterChange={handlePrimaryFilterChange}
        advancedFilters={advancedFilterConfigs}
        advancedFilterValues={advancedFilters}
        onAdvancedFilterChange={handleAdvancedFilterChange}
        onClearAllFilters={handleClearAllFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        actions={
          <>
            {selectedIds.length > 0 && (
              <button onClick={() => setBulkDeleteOpen(true)} className="rounded-lg bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-sm font-medium flex items-center gap-2 shadow-sm transition-all cursor-pointer">
                <Trash2 size={16} /> Delete Selected ({selectedIds.length})
              </button>
            )}
            <button onClick={handleAddLease} className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 text-sm font-medium flex items-center gap-2 shadow-sm transition-all cursor-pointer">
              <Plus size={16} /> Add Lease
            </button>
          </>
        }
      />

      {viewMode === 'table' ? (
        <div className="ag-theme-quartz ag-theme-custom" style={{ height: 600 }}>
          <AgGridReact<Lease>
            ref={gridRef}
            theme="legacy"
            rowData={filteredLeases}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowSelection={{ mode: 'multiRow', checkboxes: true, headerCheckbox: true, enableClickSelection: false }}
            pagination={true}
            paginationPageSize={15}
            paginationPageSizeSelector={[10, 15, 25, 50]}
            onCellClicked={handleCellClicked}
            onSelectionChanged={handleSelectionChanged}
            getRowId={(params) => params.data.id}
          />
        </div>
      ) : (
        <CardGrid
          records={filteredLeases}
          pageSize={15}
          emptyMessage="No leases found."
          renderCard={(record) => (
            <LeaseCard
              key={record.id}
              record={record}
              propertyMap={propertyMap}
              unitMap={unitMap}
              tenantMap={tenantMap}
              currency={currency}
              isSelected={selectedSet.has(record.id)}
              onToggleSelect={handleToggleSelect}
              onClick={handleCardClick}
              onDelete={(id) => setDeleteConfirmId(id)}
            />
          )}
        />
      )}

      <Modal open={modalOpen} onClose={handleCloseModal} title="Edit Lease"
        subtitle={editingLease ? `${propertyMap[editingLease.propertyId]?.name ?? 'New Lease'}${tenantMap[editingLease.tenantId]?.name ? ` - ${tenantMap[editingLease.tenantId].name}` : ''}` : undefined}
        size="xl"
        footer={<>
          <button onClick={handleCloseModal} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button onClick={handleSaveModal} className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 text-sm font-medium cursor-pointer shadow-sm">Save</button>
        </>}
      >
        {editingLease && (
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Property">
              <select value={editingLease.propertyId} onChange={(e) => onFieldChange('propertyId', e.target.value)} className={inputClass}>
                <option value="">-- Select --</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Property Type" autoFilled>
              <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{propertyMap[editingLease.propertyId]?.type ?? '--'}</div>
            </FieldGroup>
            <FieldGroup label="Unit">
              <select value={editingLease.unitId} onChange={(e) => onFieldChange('unitId', e.target.value)} className={inputClass} disabled={!editingLease.propertyId}>
                <option value="">-- Select --</option>
                {modalUnits.map((u) => <option key={u.id} value={u.id}>{u.unitNumber}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Unit Address" autoFilled>
              <input type="text" value={editingLease.unitAddress} onChange={(e) => onFieldChange('unitAddress', e.target.value)} className={inputClass} placeholder="Unit address" />
            </FieldGroup>
            <FieldGroup label="Tenant">
              <div className="flex gap-2">
                <select value={editingLease.tenantId} onChange={(e) => onFieldChange('tenantId', e.target.value)} className={`${inputClass} flex-1`}>
                  <option value="">-- Select --</option>
                  {tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button type="button" onClick={handleOpenAddTenant} className="rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-2 text-sm font-medium transition-colors cursor-pointer" title="Add new tenant">
                  <UserPlus size={16} />
                </button>
              </div>
            </FieldGroup>
            <FieldGroup label="Phone" autoFilled>
              <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{tenantMap[editingLease.tenantId]?.phone ?? '--'}</div>
            </FieldGroup>
            <FieldGroup label="Email" autoFilled>
              <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{tenantMap[editingLease.tenantId]?.email ?? '--'}</div>
            </FieldGroup>
            <FieldGroup label="Current Tenant">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editingLease.isCurrentTenant} onChange={(e) => onFieldChange('isCurrentTenant', e.target.checked)} className="w-4 h-4 accent-blue-600 cursor-pointer" />
                <span className="text-sm text-slate-600">Yes</span>
              </label>
            </FieldGroup>
            <FieldGroup label="Lease Start">
              <input type="date" value={editingLease.leaseStart} onChange={(e) => onFieldChange('leaseStart', e.target.value)} className={inputClass} />
            </FieldGroup>
            <FieldGroup label="Lease End">
              <input type="date" value={editingLease.leaseEnd} onChange={(e) => onFieldChange('leaseEnd', e.target.value)} className={inputClass} />
            </FieldGroup>
            <FieldGroup label="Lease Length" autoFilled>
              <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                {(() => { const m = calcLeaseMonths(editingLease.leaseStart, editingLease.leaseEnd); return m !== null ? `${m} months` : '--'; })()}
              </div>
            </FieldGroup>
            <FieldGroup label={`Monthly Rent (${currency})`}>
              <input type="number" min="0" step="0.01" value={editingLease.monthlyRent || ''} onChange={(e) => onFieldChange('monthlyRent', parseFloat(e.target.value) || 0)} className={inputClass} placeholder="0.00" />
            </FieldGroup>
            <FieldGroup label={`Deposit (${currency})`}>
              <input type="number" min="0" step="0.01" value={editingLease.deposit || ''} onChange={(e) => onFieldChange('deposit', parseFloat(e.target.value) || 0)} className={inputClass} placeholder="0.00" />
            </FieldGroup>
            <FieldGroup label="Recurring Rent">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editingLease.isRecurringRent} onChange={(e) => onFieldChange('isRecurringRent', e.target.checked)} className="w-4 h-4 accent-blue-600 cursor-pointer" />
                <span className="text-sm text-slate-600">Yes</span>
              </label>
            </FieldGroup>
            <div className="col-span-2">
              <FieldGroup label="Notes">
                <input type="text" value={editingLease.notes} onChange={(e) => onFieldChange('notes', e.target.value)} className={inputClass} placeholder="Add notes..." />
              </FieldGroup>
            </div>
          </div>
        )}
      </Modal>

      {/* Tenant Management Modal */}
      <Modal open={tenantModalOpen} onClose={handleCloseTenantModal} title="Add New Tenant"
        subtitle="Enter tenant contact information"
        size="md"
        footer={<>
          <button onClick={handleCloseTenantModal} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button onClick={handleSaveTenant} disabled={!tenantForm.name.trim()} className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium cursor-pointer shadow-sm">Add Tenant</button>
        </>}
      >
        <div className="space-y-4">
          <FieldGroup label="Full Name *">
            <input type="text" value={tenantForm.name} onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })} className={inputClass} placeholder="Enter tenant's full name" autoFocus />
          </FieldGroup>
          <FieldGroup label="Phone Number">
            <input type="tel" value={tenantForm.phone} onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })} className={inputClass} placeholder="e.g. 555-0123" />
          </FieldGroup>
          <FieldGroup label="Email Address">
            <input type="email" value={tenantForm.email} onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })} className={inputClass} placeholder="e.g. tenant@email.com" />
          </FieldGroup>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Delete Lease"
        subtitle="This action cannot be undone."
        size="sm"
        footer={<>
          <button onClick={() => setDeleteConfirmId(null)} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button onClick={() => { if (deleteConfirmId) { handleDelete(deleteConfirmId); setDeleteConfirmId(null); } }} className="rounded-lg bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-sm font-medium cursor-pointer shadow-sm">Delete</button>
        </>}
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete this lease? This will permanently remove the lease record.</p>
      </Modal>

      <Modal open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} title="Delete Selected Leases"
        subtitle="This action cannot be undone."
        size="sm"
        footer={<>
          <button onClick={() => setBulkDeleteOpen(false)} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button onClick={handleBulkDelete} className="rounded-lg bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-sm font-medium cursor-pointer shadow-sm">Delete {selectedIds.length} Leases</button>
        </>}
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete {selectedIds.length} selected leases?</p>
      </Modal>

    </div>
  );
}
