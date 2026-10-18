'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { Plus, Trash2, Upload, Eye } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import '@/lib/ag-grid-setup';

import {
  useSetupStore,
  useIncomeStore,
  useLeaseStore,
  useTenantStore,
} from '@/lib/store';
import { computeIncomeFields } from '@/lib/clientUtils';
import type { IncomeRecord } from '@/lib/types';
import { Modal, FieldGroup } from '@/components/ui/Modal';
import { generateReactHelpers } from '@uploadthing/react';
import type { OurFileRouter } from '@/lib/uploadthing';
import { useDebounce } from '@/lib/hooks/useDebounce';
import DataToolbar from '@/components/DataToolbar';
import type { ViewMode, FilterValues, FilterValue } from '@/components/DataToolbar';
import CardGrid from '@/components/cards/CardGrid';
import IncomeCard from '@/components/cards/IncomeCard';
import { incomeStatusBadge } from '@/lib/badgeStyles';

const { useUploadThing } = generateReactHelpers<OurFileRouter>();

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const statusBadge: Record<string, string> = {
  Paid: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'Partially Paid': 'bg-amber-50 text-amber-700 border border-amber-200',
  Overpaid: 'bg-blue-50 text-blue-700 border border-blue-200',
  Unpaid: 'bg-red-50 text-red-700 border border-red-200',
  Pending: 'bg-slate-50 text-slate-500 border border-slate-200',
};

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none';

/* ─── Default advanced filter state ─────────────────────────── */

const defaultAdvancedFilters: FilterValues = {
  dueDate: { min: '', max: '' },
  paymentStatus: 'all',
  category: 'all',
  paymentMethod: 'all',
};

export default function IncomePage() {
  const { properties, units, incomeCategories, paymentMethods, currency } = useSetupStore();
  const { records, addRecord, updateRecord, removeRecord } = useIncomeStore();
  const { leases } = useLeaseStore();
  const { tenants } = useTenantStore();

  const [filterPropertyId, setFilterPropertyId] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<IncomeRecord | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const gridRef = useRef<AgGridReact<IncomeRecord>>(null);
  const { startUpload: startReceiptUpload } = useUploadThing('paymentReceipt');

  /* ─── New state for search, view mode, advanced filters ───── */

  const [searchValue, setSearchValue] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [advancedFilters, setAdvancedFilters] = useState<FilterValues>(defaultAdvancedFilters);

  const debouncedSearch = useDebounce(searchValue);

  /* ─── Lookup maps ─────────────────────────────────────────── */

  const propertyMap = useMemo(() => Object.fromEntries(properties.map((p) => [p.id, p])), [properties]);
  const unitMap = useMemo(() => Object.fromEntries(units.map((u) => [u.id, u])), [units]);
  const tenantMap = useMemo(() => Object.fromEntries(tenants.map((t) => [t.id, t])), [tenants]);

  /* ─── Filtered records (property -> advanced -> search) ──── */

  const filteredRecords = useMemo(() => {
    let result = records;

    // 1. Primary filter: property
    if (filterPropertyId !== 'all') {
      result = result.filter((r) => r.propertyId === filterPropertyId);
    }

    // 2. Advanced filters
    const dueDateRange = advancedFilters.dueDate;
    if (typeof dueDateRange === 'object' && 'min' in dueDateRange) {
      if (dueDateRange.min) {
        result = result.filter((r) => r.rentDueDate >= dueDateRange.min);
      }
      if (dueDateRange.max) {
        result = result.filter((r) => r.rentDueDate <= dueDateRange.max);
      }
    }

    const statusFilter = advancedFilters.paymentStatus;
    if (typeof statusFilter === 'string' && statusFilter !== 'all') {
      result = result.filter((r) => r.paymentStatus === statusFilter);
    }

    const categoryFilter = advancedFilters.category;
    if (typeof categoryFilter === 'string' && categoryFilter !== 'all') {
      result = result.filter((r) => r.category === categoryFilter);
    }

    const methodFilter = advancedFilters.paymentMethod;
    if (typeof methodFilter === 'string' && methodFilter !== 'all') {
      result = result.filter((r) => r.paymentMethod === methodFilter);
    }

    // 3. Search (debounced)
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      result = result.filter((r) => {
        const propName = propertyMap[r.propertyId]?.name ?? '';
        const unitNum = unitMap[r.unitId]?.unitNumber ?? '';
        const tenantName = tenantMap[r.tenantId]?.name ?? '';
        return (
          propName.toLowerCase().includes(q) ||
          unitNum.toLowerCase().includes(q) ||
          tenantName.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q) ||
          r.paymentMethod.toLowerCase().includes(q) ||
          r.notes.toLowerCase().includes(q)
        );
      });
    }

    return result;
  }, [records, filterPropertyId, advancedFilters, debouncedSearch, propertyMap, unitMap, tenantMap]);

  /* ─── KPI totals ──────────────────────────────────────────── */

  const totalDue = useMemo(() => filteredRecords.reduce((s, r) => s + r.totalDue, 0), [filteredRecords]);
  const totalPaid = useMemo(() => filteredRecords.reduce((s, r) => s + r.amountPaid, 0), [filteredRecords]);
  const totalOutstanding = useMemo(() => filteredRecords.reduce((s, r) => s + r.outstandingBalance, 0), [filteredRecords]);

  /* ─── Helpers ─────────────────────────────────────────────── */

  const getUnitsForProperty = useCallback(
    (propertyId: string) => units.filter((u) => u.propertyId === propertyId),
    [units],
  );

  const getTenantsForUnit = useCallback(
    (unitId: string) => {
      const tenantIds = leases.filter((l) => l.unitId === unitId && l.isCurrentTenant).map((l) => l.tenantId);
      return tenants.filter((t) => tenantIds.includes(t.id));
    },
    [leases, tenants],
  );

  const handleFieldChange = useCallback(
    (record: IncomeRecord, field: keyof IncomeRecord, value: string | number) => {
      const updated: Partial<IncomeRecord> = { [field]: value };
      if (field === 'propertyId') { updated.unitId = ''; updated.tenantId = ''; updated.rentAmount = 0; }
      if (field === 'unitId') { updated.tenantId = ''; updated.rentAmount = 0; }
      if (field === 'tenantId') {
        const lease = leases.find((l) => l.tenantId === value && l.unitId === record.unitId && l.isCurrentTenant);
        if (lease?.isRecurringRent) updated.rentAmount = lease.monthlyRent;
      }
      const merged = { ...record, ...updated };
      const rentAmount = field === 'rentAmount' ? Number(value) : (updated.rentAmount ?? merged.rentAmount);
      const additionalIncome = field === 'additionalIncome' ? Number(value) : merged.additionalIncome;
      const amountPaid = field === 'amountPaid' ? Number(value) : merged.amountPaid;
      const rentDueDate = field === 'rentDueDate' ? String(value) : merged.rentDueDate;
      const paymentDate = field === 'paymentDate' ? String(value) : merged.paymentDate;
      const computed = computeIncomeFields(rentAmount, additionalIncome, amountPaid, rentDueDate, paymentDate);
      setEditingRecord((prev) => prev && prev.id === record.id ? ({ ...prev, ...updated, ...computed } as IncomeRecord) : prev);
    },
    [leases],
  );

  const handleAddRow = () => {
    const defaultPropertyId = filterPropertyId !== 'all' ? filterPropertyId : '';
    const computed = computeIncomeFields(0, 0, 0, '', '');
    setEditingRecord({
      id: '', propertyId: defaultPropertyId, unitId: '', tenantId: '', category: '',
      rentDueDate: '', rentAmount: 0, additionalIncome: 0, ...computed,
      paymentDate: '', amountPaid: 0, paymentMethod: '', notes: '', receiptUrl: '',
    });
    setIsNewRecord(true);
    setModalOpen(true);
  };

  const handleCellClicked = useCallback((event: { data: IncomeRecord | undefined; column: { getColId: () => string } }) => {
    if (event.column.getColId() === 'actions' || event.column.getColId().startsWith('ag-Grid')) return;
    if (event.data) { setEditingRecord({ ...event.data }); setIsNewRecord(false); setModalOpen(true); }
  }, []);

  const handleCardClick = useCallback((record: IncomeRecord) => {
    setEditingRecord({ ...record });
    setIsNewRecord(false);
    setModalOpen(true);
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const handleCloseModal = useCallback(() => { setModalOpen(false); setEditingRecord(null); setIsNewRecord(false); setReceiptFile(null); }, []);
  const handleSaveModal = useCallback(async () => {
    if (editingRecord) {
      let receiptUrl = editingRecord.receiptUrl;
      if (receiptFile) {
        setUploadingReceipt(true);
        try {
          const result = await startReceiptUpload([receiptFile]);
          if (result && result[0]) {
            receiptUrl = result[0].url;
          }
        } catch (err) {
          console.error('Receipt upload failed:', err);
        }
        setUploadingReceipt(false);
      }
      const recordWithReceipt = { ...editingRecord, receiptUrl };
      if (isNewRecord) {
        await addRecord(recordWithReceipt);
      } else {
        await updateRecord(editingRecord.id, recordWithReceipt);
      }
    }
    setModalOpen(false);
    setEditingRecord(null);
    setIsNewRecord(false);
    setReceiptFile(null);
  }, [editingRecord, isNewRecord, receiptFile, addRecord, updateRecord, startReceiptUpload]);

  const handleDelete = useCallback((id: string) => {
    removeRecord(id);
    if (editingRecord?.id === id) { setModalOpen(false); setEditingRecord(null); }
  }, [removeRecord, editingRecord]);

  const handleBulkDelete = useCallback(() => {
    for (const id of selectedIds) { removeRecord(id); }
    setSelectedIds([]);
    setBulkDeleteOpen(false);
    gridRef.current?.api.deselectAll();
  }, [selectedIds, removeRecord]);

  const handleSelectionChanged = useCallback(() => {
    const rows = gridRef.current?.api.getSelectedRows() ?? [];
    setSelectedIds(rows.map(r => r.id));
  }, []);

  /* ─── Advanced filter change handler ──────────────────────── */

  const handleAdvancedFilterChange = useCallback((key: string, value: FilterValue) => {
    setAdvancedFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setFilterPropertyId('all');
    setAdvancedFilters(defaultAdvancedFilters);
    setSearchValue('');
  }, []);

  /* ─── Toolbar filter configs ──────────────────────────────── */

  const primaryFilterConfigs = useMemo(() => [
    {
      key: 'property',
      label: 'Property',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'All Properties' },
        ...properties.map((p) => ({ value: p.id, label: p.name })),
      ],
    },
  ], [properties]);

  const advancedFilterConfigs = useMemo(() => [
    {
      key: 'dueDate',
      label: 'Due Date Range',
      type: 'dateRange' as const,
    },
    {
      key: 'paymentStatus',
      label: 'Payment Status',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'All Statuses' },
        { value: 'Paid', label: 'Paid' },
        { value: 'Partially Paid', label: 'Partially Paid' },
        { value: 'Overpaid', label: 'Overpaid' },
        { value: 'Unpaid', label: 'Unpaid' },
        { value: 'Pending', label: 'Pending' },
      ],
    },
    {
      key: 'category',
      label: 'Category',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'All Categories' },
        ...incomeCategories.map((c) => ({ value: c, label: c })),
      ],
    },
    {
      key: 'paymentMethod',
      label: 'Payment Method',
      type: 'select' as const,
      options: [
        { value: 'all', label: 'All Methods' },
        ...paymentMethods.map((m) => ({ value: m, label: m })),
      ],
    },
  ], [incomeCategories, paymentMethods]);

  /* ─── Column defs ─────────────────────────────────────────── */

  const columnDefs = useMemo<ColDef<IncomeRecord>[]>(() => [
    { headerName: 'Property', field: 'propertyId', width: 170, cellRenderer: (p: { value: string }) => propertyMap[p.value]?.name ?? '--' },
    { headerName: 'Type', field: 'propertyId' as keyof IncomeRecord, colId: 'propertyType', width: 110, cellRenderer: (p: { value: string }) => propertyMap[p.value]?.type ?? '--' },
    { headerName: 'Unit', field: 'unitId', width: 100, cellRenderer: (p: { value: string }) => unitMap[p.value]?.unitNumber ?? '--' },
    { headerName: 'Tenant', field: 'tenantId', width: 150, cellRenderer: (p: { value: string }) => tenantMap[p.value]?.name ?? '--' },
    { headerName: 'Category', field: 'category', width: 120 },
    { headerName: 'Due Date', field: 'rentDueDate', width: 120 },
    { headerName: `Rent (${currency})`, field: 'rentAmount', width: 120, cellRenderer: (p: { value: number }) => <span className="font-medium">{currency}{fmt(p.value)}</span> },
    { headerName: `Addl. (${currency})`, field: 'additionalIncome', width: 120, cellRenderer: (p: { value: number }) => `${currency}${fmt(p.value)}` },
    { headerName: `Total Due`, field: 'totalDue', width: 120, cellRenderer: (p: { value: number }) => <span className="font-semibold">{currency}{fmt(p.value)}</span> },
    { headerName: 'Paid Date', field: 'paymentDate', width: 120 },
    { headerName: `Paid (${currency})`, field: 'amountPaid', width: 120, cellRenderer: (p: { value: number }) => <span className="text-emerald-700 font-medium">{currency}{fmt(p.value)}</span> },
    { headerName: 'Outstanding', field: 'outstandingBalance', width: 130, cellRenderer: (p: { value: number }) => <span className={`font-medium ${p.value > 0 ? 'text-red-600' : ''}`}>{currency}{fmt(p.value)}</span> },
    { headerName: 'Status', field: 'paymentStatus', width: 140, cellRenderer: (p: { value: string }) => <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[p.value] ?? statusBadge.Pending}`}>{p.value}</span> },
    { headerName: 'Delay', field: 'delayDays', width: 90, cellRenderer: (p: { value: number; data: IncomeRecord }) => !p.data.paymentDate ? '--' : <span className={p.value > 0 ? 'text-red-600 font-semibold' : ''}>{p.value}</span> },
    { headerName: 'Method', field: 'paymentMethod', width: 130 },
    { headerName: 'Notes', field: 'notes', flex: 1, minWidth: 140 },
    { headerName: '', colId: 'actions', width: 60, sortable: false, resizable: false, cellRenderer: (p: { data: IncomeRecord }) => (
      <button onClick={() => setDeleteConfirmId(p.data.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-1.5 transition-colors cursor-pointer" title="Remove"><Trash2 size={14} /></button>
    )},
  ], [propertyMap, unitMap, tenantMap, currency, handleDelete]);

  const defaultColDef = useMemo<ColDef>(() => ({ sortable: true, resizable: true }), []);

  /* ─── Modal helpers ───────────────────────────────────────── */

  const modalUnits = useMemo(() => editingRecord?.propertyId ? getUnitsForProperty(editingRecord.propertyId) : [], [editingRecord?.propertyId, getUnitsForProperty]);
  const modalTenants = useMemo(() => editingRecord?.unitId ? getTenantsForUnit(editingRecord.unitId) : [], [editingRecord?.unitId, getTenantsForUnit]);

  const onFieldChange = useCallback((field: keyof IncomeRecord, value: string | number) => {
    if (editingRecord) handleFieldChange(editingRecord, field, value);
  }, [editingRecord, handleFieldChange]);

  /* ─── Render ──────────────────────────────────────────────── */

  return (
    <div>
      <div className="animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Income</h1>
            <p className="text-sm text-slate-500 mt-1">Track rental income, payments, and outstanding balances across all properties.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-blue-500">
          <div className="text-xs text-slate-500 font-medium">Records</div>
          <div className="text-xl font-bold text-slate-800 mt-1">{filteredRecords.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-indigo-500">
          <div className="text-xs text-slate-500 font-medium">Total Due</div>
          <div className="text-xl font-bold text-slate-800 mt-1">{currency}{fmt(totalDue)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-emerald-500">
          <div className="text-xs text-slate-500 font-medium">Total Paid</div>
          <div className="text-xl font-bold text-emerald-700 mt-1">{currency}{fmt(totalPaid)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-red-500">
          <div className="text-xs text-slate-500 font-medium">Outstanding</div>
          <div className={`text-xl font-bold mt-1 ${totalOutstanding > 0 ? 'text-red-600' : 'text-slate-800'}`}>{currency}{fmt(totalOutstanding)}</div>
        </div>
      </div>

      {/* DataToolbar replaces old filter bar */}
      <DataToolbar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search income records..."
        primaryFilters={primaryFilterConfigs}
        primaryFilterValues={{ property: filterPropertyId }}
        onPrimaryFilterChange={(_key, value) => setFilterPropertyId(value)}
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
            <button onClick={handleAddRow} className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 text-sm font-medium flex items-center gap-2 shadow-sm transition-all cursor-pointer">
              <Plus size={16} /> Add Income
            </button>
          </>
        }
      />

      {/* Table view */}
      {viewMode === 'table' && (
        <div className="ag-theme-quartz ag-theme-custom" style={{ height: 600 }}>
          <AgGridReact<IncomeRecord>
            ref={gridRef}
            theme="legacy"
            rowData={filteredRecords}
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
      )}

      {/* Card view */}
      {viewMode === 'card' && (
        <CardGrid
          records={filteredRecords}
          pageSize={15}
          emptyMessage="No income records found."
          renderCard={(record) => (
            <IncomeCard
              key={record.id}
              record={record}
              propertyMap={propertyMap}
              unitMap={unitMap}
              tenantMap={tenantMap}
              currency={currency}
              isSelected={selectedIds.includes(record.id)}
              onToggleSelect={handleToggleSelect}
              onClick={handleCardClick}
              onDelete={(id) => setDeleteConfirmId(id)}
            />
          )}
        />
      )}

      <Modal open={modalOpen} onClose={handleCloseModal} title="Edit Income Record"
        subtitle={editingRecord ? `${propertyMap[editingRecord.propertyId]?.name ?? 'New Record'}${editingRecord.rentDueDate ? ` - Due ${editingRecord.rentDueDate}` : ''}` : undefined}
        size="xl"
        footer={<>
          <button onClick={handleCloseModal} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button onClick={handleSaveModal} disabled={uploadingReceipt} className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 px-4 py-2 text-sm font-medium cursor-pointer shadow-sm">{uploadingReceipt ? 'Uploading...' : 'Save'}</button>
        </>}
      >
        {editingRecord && (
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Property">
              <select value={editingRecord.propertyId} onChange={(e) => onFieldChange('propertyId', e.target.value)} className={inputClass}>
                <option value="">-- Select --</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Property Type" autoFilled>
              <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{propertyMap[editingRecord.propertyId]?.type ?? '--'}</div>
            </FieldGroup>
            <FieldGroup label="Unit">
              <select value={editingRecord.unitId} onChange={(e) => onFieldChange('unitId', e.target.value)} className={inputClass} disabled={!editingRecord.propertyId}>
                <option value="">-- Select --</option>
                {modalUnits.map((u) => <option key={u.id} value={u.id}>{u.unitNumber}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Tenant">
              <select value={editingRecord.tenantId} onChange={(e) => onFieldChange('tenantId', e.target.value)} className={inputClass} disabled={!editingRecord.unitId}>
                <option value="">-- Select --</option>
                {modalTenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Category">
              <select value={editingRecord.category} onChange={(e) => onFieldChange('category', e.target.value)} className={inputClass}>
                <option value="">-- Select --</option>
                {incomeCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Rent Due Date">
              <input type="date" value={editingRecord.rentDueDate} onChange={(e) => onFieldChange('rentDueDate', e.target.value)} className={inputClass} />
            </FieldGroup>
            <FieldGroup label={`Rent Amount (${currency})`}>
              <input type="number" min="0" step="0.01" value={editingRecord.rentAmount || ''} onChange={(e) => onFieldChange('rentAmount', parseFloat(e.target.value) || 0)} className={inputClass} placeholder="0.00" />
            </FieldGroup>
            <FieldGroup label={`Additional Income (${currency})`}>
              <input type="number" min="0" step="0.01" value={editingRecord.additionalIncome || ''} onChange={(e) => onFieldChange('additionalIncome', parseFloat(e.target.value) || 0)} className={inputClass} placeholder="0.00" />
            </FieldGroup>
            <FieldGroup label={`Total Due (${currency})`} autoFilled>
              <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 font-medium">{currency}{fmt(editingRecord.totalDue)}</div>
            </FieldGroup>
            <FieldGroup label="Payment Date">
              <input type="date" value={editingRecord.paymentDate} onChange={(e) => onFieldChange('paymentDate', e.target.value)} className={inputClass} />
            </FieldGroup>
            <FieldGroup label={`Amount Paid (${currency})`}>
              <input type="number" min="0" step="0.01" value={editingRecord.amountPaid || ''} onChange={(e) => onFieldChange('amountPaid', parseFloat(e.target.value) || 0)} className={inputClass} placeholder="0.00" />
            </FieldGroup>
            <FieldGroup label="Outstanding Balance" autoFilled>
              <div className={`w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium ${editingRecord.outstandingBalance > 0 ? 'text-red-600' : 'text-slate-600'}`}>{currency}{fmt(editingRecord.outstandingBalance)}</div>
            </FieldGroup>
            <FieldGroup label="Payment Status" autoFilled>
              <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[editingRecord.paymentStatus] ?? statusBadge.Pending}`}>{editingRecord.paymentStatus}</span>
              </div>
            </FieldGroup>
            <FieldGroup label="Delay (days)" autoFilled>
              <div className={`w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm ${editingRecord.delayDays > 0 ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>{editingRecord.paymentDate ? editingRecord.delayDays : '--'}</div>
            </FieldGroup>
            <FieldGroup label="Payment Method">
              <select value={editingRecord.paymentMethod} onChange={(e) => onFieldChange('paymentMethod', e.target.value)} className={inputClass}>
                <option value="">-- Select --</option>
                {paymentMethods.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </FieldGroup>
            <div className="col-span-2">
              <FieldGroup label="Notes">
                <input type="text" value={editingRecord.notes} onChange={(e) => onFieldChange('notes', e.target.value)} className={inputClass} placeholder="Notes..." />
              </FieldGroup>
            </div>
            <div className="col-span-2">
              <FieldGroup label="Receipt (optional)">
                {editingRecord.receiptUrl && !receiptFile ? (
                  <div className="flex items-center gap-3">
                    <a href={editingRecord.receiptUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800">
                      <Eye size={16} /> View current receipt
                    </a>
                    <label className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 cursor-pointer">
                      <Upload size={14} /> Replace
                      <input type="file" onChange={e => setReceiptFile(e.target.files?.[0] ?? null)} className="hidden" accept="image/*,.pdf" />
                    </label>
                  </div>
                ) : (
                  <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer">
                    <Upload size={18} className="text-slate-400" />
                    <span className="text-sm text-slate-500">
                      {receiptFile ? receiptFile.name : 'Click to attach receipt image or PDF'}
                    </span>
                    <input type="file" onChange={e => setReceiptFile(e.target.files?.[0] ?? null)} className="hidden" accept="image/*,.pdf" />
                  </label>
                )}
              </FieldGroup>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Delete Income Record"
        subtitle="This action cannot be undone."
        size="sm"
        footer={<>
          <button onClick={() => setDeleteConfirmId(null)} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button onClick={() => { if (deleteConfirmId) { handleDelete(deleteConfirmId); setDeleteConfirmId(null); } }} className="rounded-lg bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-sm font-medium cursor-pointer shadow-sm">Delete</button>
        </>}
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete this income record?</p>
      </Modal>

      <Modal open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} title="Delete Selected Records"
        subtitle="This action cannot be undone."
        size="sm"
        footer={<>
          <button onClick={() => setBulkDeleteOpen(false)} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button onClick={handleBulkDelete} className="rounded-lg bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-sm font-medium cursor-pointer shadow-sm">Delete {selectedIds.length} Records</button>
        </>}
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete {selectedIds.length} selected income records?</p>
      </Modal>
    </div>
  );
}
