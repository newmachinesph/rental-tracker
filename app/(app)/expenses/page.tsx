'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import '@/lib/ag-grid-setup';

import { useSetupStore, useExpenseStore } from '@/lib/store';
import type { ExpenseRecord } from '@/lib/types';
import { Modal, FieldGroup } from '@/components/ui/Modal';
import { useDebounce } from '@/lib/hooks/useDebounce';
import DataToolbar, {
  type ViewMode,
  type FilterConfig,
  type FilterValues,
  type FilterValue,
  type RangeValue,
} from '@/components/DataToolbar';
import CardGrid from '@/components/cards/CardGrid';
import ExpenseCard from '@/components/cards/ExpenseCard';

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none';

export default function ExpensesPage() {
  const { properties, units, expenseCategories, currency } = useSetupStore();
  const { records, addRecord, updateRecord, removeRecord } = useExpenseStore();

  const [filterPropertyId, setFilterPropertyId] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ExpenseRecord | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const gridRef = useRef<AgGridReact<ExpenseRecord>>(null);

  /* ─── New state for search, view toggle, and advanced filters ─── */
  const [searchValue, setSearchValue] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [advancedFilters, setAdvancedFilters] = useState<FilterValues>({});

  const debouncedSearch = useDebounce(searchValue);

  /* ─── Lookup maps ──────────────────────────────────────────────── */
  const propertyMap = useMemo(() => Object.fromEntries(properties.map((p) => [p.id, p])), [properties]);
  const unitMap = useMemo(() => Object.fromEntries(units.map((u) => [u.id, u])), [units]);

  /* ─── Enhanced filtered records ────────────────────────────────── */
  const filteredRecords = useMemo(() => {
    let result = records;

    // 1. Property filter
    if (filterPropertyId !== 'all') {
      result = result.filter((r) => r.propertyId === filterPropertyId);
    }

    // 2. Advanced filters
    // Date range
    const dateRange = advancedFilters.date as RangeValue | undefined;
    if (dateRange) {
      if (dateRange.min) {
        result = result.filter((r) => r.date >= dateRange.min);
      }
      if (dateRange.max) {
        result = result.filter((r) => r.date <= dateRange.max);
      }
    }

    // Category
    const categoryFilter = advancedFilters.category as string | undefined;
    if (categoryFilter && categoryFilter !== 'all') {
      result = result.filter((r) => r.category === categoryFilter);
    }

    // Amount range
    const amountRange = advancedFilters.amount as RangeValue | undefined;
    if (amountRange) {
      if (amountRange.min) {
        result = result.filter((r) => r.amount >= parseFloat(amountRange.min));
      }
      if (amountRange.max) {
        result = result.filter((r) => r.amount <= parseFloat(amountRange.max));
      }
    }

    // 3. Search (case-insensitive on property name, unit number, category, notes)
    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      result = result.filter((r) => {
        const propertyName = propertyMap[r.propertyId]?.name ?? '';
        const unitNumber = r.unitId ? (unitMap[r.unitId]?.unitNumber ?? '') : '';
        return (
          propertyName.toLowerCase().includes(term) ||
          unitNumber.toLowerCase().includes(term) ||
          r.category.toLowerCase().includes(term) ||
          r.notes.toLowerCase().includes(term)
        );
      });
    }

    return result;
  }, [records, filterPropertyId, advancedFilters, debouncedSearch, propertyMap, unitMap]);

  /* ─── KPI totals ───────────────────────────────────────────────── */
  const totalAmount = useMemo(() => filteredRecords.reduce((s, r) => s + r.amount, 0), [filteredRecords]);
  const totalFees = useMemo(() => filteredRecords.reduce((s, r) => s + r.additionalFees, 0), [filteredRecords]);
  const grandTotal = useMemo(() => filteredRecords.reduce((s, r) => s + r.total, 0), [filteredRecords]);

  const getUnitsForProperty = useCallback(
    (propertyId: string) => units.filter((u) => u.propertyId === propertyId),
    [units],
  );

  /* ─── DataToolbar filter configs ───────────────────────────────── */
  const primaryFilterConfigs = useMemo<FilterConfig[]>(() => [
    {
      key: 'property',
      label: 'Property',
      type: 'select',
      options: [
        { value: 'all', label: 'All Properties' },
        ...properties.map((p) => ({ value: p.id, label: p.name })),
      ],
    },
  ], [properties]);

  const primaryFilterValues = useMemo<FilterValues>(() => ({
    property: filterPropertyId,
  }), [filterPropertyId]);

  const handlePrimaryFilterChange = useCallback((key: string, value: string) => {
    if (key === 'property') setFilterPropertyId(value);
  }, []);

  const advancedFilterConfigs = useMemo<FilterConfig[]>(() => [
    {
      key: 'date',
      label: 'Date Range',
      type: 'dateRange',
    },
    {
      key: 'category',
      label: 'Category',
      type: 'select',
      options: [
        { value: 'all', label: 'All Categories' },
        ...expenseCategories.map((c) => ({ value: c, label: c })),
      ],
    },
    {
      key: 'amount',
      label: 'Amount Range',
      type: 'numberRange',
      prefix: currency,
    },
  ], [expenseCategories, currency]);

  const handleAdvancedFilterChange = useCallback((key: string, value: FilterValue) => {
    setAdvancedFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setFilterPropertyId('all');
    setAdvancedFilters({});
  }, []);

  /* ─── Card selection toggle ────────────────────────────────────── */
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  /* ─── Handlers (unchanged) ─────────────────────────────────────── */
  const handleFieldChange = useCallback(
    (record: ExpenseRecord, field: keyof ExpenseRecord, value: string | number | boolean) => {
      const patch: Partial<ExpenseRecord> = { [field]: value };

      if (field === 'propertyId') { patch.unitId = ''; }
      if (field === 'appliesToEntireBuilding' && value === true) { patch.unitId = ''; }

      if (field === 'amount' || field === 'additionalFees') {
        const amount = field === 'amount' ? (value as number) : record.amount;
        const fees = field === 'additionalFees' ? (value as number) : record.additionalFees;
        patch.total = amount + fees;
      }

      setEditingRecord((prev) => prev && prev.id === record.id ? { ...prev, ...patch } as ExpenseRecord : prev);
    },
    [],
  );

  const handleAddRow = () => {
    setEditingRecord({
      id: '',
      date: new Date().toISOString().split('T')[0],
      propertyId: filterPropertyId !== 'all' ? filterPropertyId : '',
      appliesToEntireBuilding: false,
      unitId: '',
      category: '',
      amount: 0,
      additionalFees: 0,
      total: 0,
      notes: '',
    });
    setIsNewRecord(true);
    setModalOpen(true);
  };

  const handleCellClicked = useCallback((event: { data: ExpenseRecord | undefined; column: { getColId: () => string } }) => {
    if (event.column.getColId() === 'actions' || event.column.getColId().startsWith('ag-Grid')) return;
    if (event.data) { setEditingRecord({ ...event.data }); setIsNewRecord(false); setModalOpen(true); }
  }, []);

  const handleCardClick = useCallback((record: ExpenseRecord) => {
    setEditingRecord({ ...record });
    setIsNewRecord(false);
    setModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => { setModalOpen(false); setEditingRecord(null); setIsNewRecord(false); }, []);
  const handleSaveModal = useCallback(async () => {
    if (editingRecord) {
      if (isNewRecord) {
        await addRecord(editingRecord);
      } else {
        await updateRecord(editingRecord.id, editingRecord);
      }
    }
    setModalOpen(false);
    setEditingRecord(null);
    setIsNewRecord(false);
  }, [editingRecord, isNewRecord, addRecord, updateRecord]);

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

  /* ─── Column definitions (unchanged) ───────────────────────────── */
  const columnDefs = useMemo<ColDef<ExpenseRecord>[]>(() => [
    { headerName: 'Date', field: 'date', width: 120 },
    { headerName: 'Property', field: 'propertyId', width: 170, cellRenderer: (p: { value: string }) => propertyMap[p.value]?.name ?? '--' },
    { headerName: 'Type', field: 'propertyId' as keyof ExpenseRecord, colId: 'propertyType', width: 110, cellRenderer: (p: { value: string }) => propertyMap[p.value]?.type ?? '--' },
    { headerName: 'Entire Bldg', field: 'appliesToEntireBuilding', width: 110, cellRenderer: (p: { value: boolean }) => (
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${p.value ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>{p.value ? 'Yes' : 'No'}</span>
    )},
    { headerName: 'Unit', field: 'unitId', width: 100, cellRenderer: (p: { value: string; data: ExpenseRecord }) => p.data.appliesToEntireBuilding ? 'All' : (unitMap[p.value]?.unitNumber ?? '--') },
    { headerName: 'Category', field: 'category', width: 140 },
    { headerName: `Amount (${currency})`, field: 'amount', width: 130, cellRenderer: (p: { value: number }) => <span className="font-medium">{currency}{fmt(p.value)}</span> },
    { headerName: `Addl. Fees (${currency})`, field: 'additionalFees', width: 130, cellRenderer: (p: { value: number }) => `${currency}${fmt(p.value)}` },
    { headerName: `Total (${currency})`, field: 'total', width: 130, cellRenderer: (p: { value: number }) => <span className="font-semibold text-red-600">{currency}{fmt(p.value)}</span> },
    { headerName: 'Notes', field: 'notes', flex: 1, minWidth: 160 },
    { headerName: '', colId: 'actions', width: 60, sortable: false, resizable: false, cellRenderer: (p: { data: ExpenseRecord }) => (
      <button onClick={() => setDeleteConfirmId(p.data.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-1.5 transition-colors cursor-pointer" title="Remove"><Trash2 size={14} /></button>
    )},
  ], [propertyMap, unitMap, currency, handleDelete]);

  const defaultColDef = useMemo<ColDef>(() => ({ sortable: true, resizable: true }), []);

  const modalUnits = useMemo(() => editingRecord?.propertyId ? getUnitsForProperty(editingRecord.propertyId) : [], [editingRecord?.propertyId, getUnitsForProperty]);

  const onFieldChange = useCallback((field: keyof ExpenseRecord, value: string | number | boolean) => {
    if (editingRecord) handleFieldChange(editingRecord, field, value);
  }, [editingRecord, handleFieldChange]);

  return (
    <div>
      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Expenses</h1>
            <p className="text-sm text-slate-500 mt-1">Track and manage property expense transactions.</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-blue-500">
          <div className="text-xs text-slate-500 font-medium">Records</div>
          <div className="text-xl font-bold text-slate-800 mt-1">{filteredRecords.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-slate-500">
          <div className="text-xs text-slate-500 font-medium">Amount</div>
          <div className="text-xl font-bold text-slate-800 mt-1">{currency}{fmt(totalAmount)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-amber-500">
          <div className="text-xs text-slate-500 font-medium">Addl. Fees</div>
          <div className="text-xl font-bold text-slate-800 mt-1">{currency}{fmt(totalFees)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-red-500">
          <div className="text-xs text-slate-500 font-medium">Total Expenses</div>
          <div className="text-xl font-bold text-red-600 mt-1">{currency}{fmt(grandTotal)}</div>
        </div>
      </div>

      {/* DataToolbar replaces old filter bar */}
      <DataToolbar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search by property, unit, category, notes..."
        primaryFilters={primaryFilterConfigs}
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
            <button onClick={handleAddRow} className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 text-sm font-medium flex items-center gap-2 shadow-sm transition-all cursor-pointer">
              <Plus size={16} /> Add Expense
            </button>
          </>
        }
      />

      {/* Conditional table / card rendering */}
      {viewMode === 'table' ? (
        <div className="ag-theme-quartz ag-theme-custom" style={{ height: 600 }}>
          <AgGridReact<ExpenseRecord>
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
      ) : (
        <CardGrid<ExpenseRecord>
          records={filteredRecords}
          pageSize={15}
          emptyMessage="No expense records found."
          renderCard={(record) => (
            <ExpenseCard
              key={record.id}
              record={record}
              propertyMap={propertyMap}
              unitMap={unitMap}
              currency={currency}
              isSelected={selectedIds.includes(record.id)}
              onToggleSelect={handleToggleSelect}
              onClick={handleCardClick}
              onDelete={(id) => setDeleteConfirmId(id)}
            />
          )}
        />
      )}

      {/* Edit / Add Modal */}
      <Modal open={modalOpen} onClose={handleCloseModal} title="Edit Expense"
        subtitle={editingRecord ? `${propertyMap[editingRecord.propertyId]?.name ?? 'New Record'}${editingRecord.date ? ` - ${editingRecord.date}` : ''}` : undefined}
        size="lg"
        footer={<>
          <button onClick={handleCloseModal} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button onClick={handleSaveModal} className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 text-sm font-medium cursor-pointer shadow-sm">Save</button>
        </>}
      >
        {editingRecord && (
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Date">
              <input type="date" value={editingRecord.date} onChange={(e) => onFieldChange('date', e.target.value)} className={inputClass} />
            </FieldGroup>
            <FieldGroup label="Property">
              <select value={editingRecord.propertyId} onChange={(e) => onFieldChange('propertyId', e.target.value)} className={inputClass}>
                <option value="">-- Select --</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Property Type" autoFilled>
              <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{propertyMap[editingRecord.propertyId]?.type ?? '--'}</div>
            </FieldGroup>
            <FieldGroup label="Applies to Entire Building">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editingRecord.appliesToEntireBuilding} onChange={(e) => onFieldChange('appliesToEntireBuilding', e.target.checked)} className="w-4 h-4 accent-blue-600 cursor-pointer" />
                <span className="text-sm text-slate-600">Yes, applies to entire building</span>
              </label>
            </FieldGroup>
            <FieldGroup label="Unit">
              <select value={editingRecord.unitId} onChange={(e) => onFieldChange('unitId', e.target.value)} className={inputClass} disabled={editingRecord.appliesToEntireBuilding || !editingRecord.propertyId}>
                <option value="">{editingRecord.appliesToEntireBuilding ? 'All units' : '-- Select --'}</option>
                {modalUnits.map((u) => <option key={u.id} value={u.id}>{u.unitNumber}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Category">
              <select value={editingRecord.category} onChange={(e) => onFieldChange('category', e.target.value)} className={inputClass}>
                <option value="">-- Select --</option>
                {expenseCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label={`Amount (${currency})`}>
              <input type="number" min="0" step="0.01" value={editingRecord.amount || ''} onChange={(e) => onFieldChange('amount', parseFloat(e.target.value) || 0)} className={inputClass} placeholder="0.00" />
            </FieldGroup>
            <FieldGroup label={`Additional Fees (${currency})`}>
              <input type="number" min="0" step="0.01" value={editingRecord.additionalFees || ''} onChange={(e) => onFieldChange('additionalFees', parseFloat(e.target.value) || 0)} className={inputClass} placeholder="0.00" />
            </FieldGroup>
            <FieldGroup label={`Total (${currency})`} autoFilled>
              <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-red-600">{currency}{fmt(editingRecord.total)}</div>
            </FieldGroup>
            <div className="col-span-2">
              <FieldGroup label="Notes">
                <input type="text" value={editingRecord.notes} onChange={(e) => onFieldChange('notes', e.target.value)} className={inputClass} placeholder="Description..." />
              </FieldGroup>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Delete Expense"
        subtitle="This action cannot be undone."
        size="sm"
        footer={<>
          <button onClick={() => setDeleteConfirmId(null)} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button onClick={() => { if (deleteConfirmId) { handleDelete(deleteConfirmId); setDeleteConfirmId(null); } }} className="rounded-lg bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-sm font-medium cursor-pointer shadow-sm">Delete</button>
        </>}
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete this expense record?</p>
      </Modal>

      {/* Bulk Delete Modal */}
      <Modal open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} title="Delete Selected Expenses"
        subtitle="This action cannot be undone."
        size="sm"
        footer={<>
          <button onClick={() => setBulkDeleteOpen(false)} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button onClick={handleBulkDelete} className="rounded-lg bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-sm font-medium cursor-pointer shadow-sm">Delete {selectedIds.length} Expenses</button>
        </>}
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete {selectedIds.length} selected expense records?</p>
      </Modal>
    </div>
  );
}
