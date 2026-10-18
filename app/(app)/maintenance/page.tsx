'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import '@/lib/ag-grid-setup';

import { useSetupStore, useMaintenanceStore } from '@/lib/store';
import type { MaintenanceTask, MaintenancePriority, MaintenanceStatus, MaintenancePaymentStatus } from '@/lib/types';
import { Modal, FieldGroup } from '@/components/ui/Modal';
import { useDebounce } from '@/lib/hooks/useDebounce';
import DataToolbar, { type ViewMode, type FilterConfig, type FilterValues, type FilterValue, type RangeValue } from '@/components/DataToolbar';
import CardGrid from '@/components/cards/CardGrid';
import MaintenanceCard from '@/components/cards/MaintenanceCard';

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const priorityBadge: Record<MaintenancePriority, string> = {
  Low: 'bg-slate-50 text-slate-600 border border-slate-200',
  Medium: 'bg-blue-50 text-blue-700 border border-blue-200',
  High: 'bg-amber-50 text-amber-700 border border-amber-200',
  Urgent: 'bg-red-50 text-red-700 border border-red-200',
};

const statusBadge: Record<MaintenanceStatus, string> = {
  Open: 'bg-blue-50 text-blue-700 border border-blue-200',
  'In Progress': 'bg-amber-50 text-amber-700 border border-amber-200',
  Completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'On Hold': 'bg-slate-50 text-slate-600 border border-slate-200',
};

const paymentBadge: Record<MaintenancePaymentStatus, string> = {
  Paid: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'Partially Paid': 'bg-amber-50 text-amber-700 border border-amber-200',
  Unpaid: 'bg-red-50 text-red-700 border border-red-200',
};

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none';

const priorities: MaintenancePriority[] = ['Low', 'Medium', 'High', 'Urgent'];
const statuses: MaintenanceStatus[] = ['Open', 'In Progress', 'Completed', 'On Hold'];
const paymentStatuses: MaintenancePaymentStatus[] = ['Unpaid', 'Partially Paid', 'Paid'];

export default function MaintenancePage() {
  const { properties, units, currency } = useSetupStore();
  const { tasks, addTask, updateTask, removeTask } = useMaintenanceStore();

  /* ─── Primary filter state ─────────────────────────────── */
  const [primaryFilterValues, setPrimaryFilterValues] = useState<FilterValues>({
    property: 'all',
    status: 'all',
    priority: 'all',
  });

  /* ─── Advanced filter state ────────────────────────────── */
  const [advancedFilterValues, setAdvancedFilterValues] = useState<FilterValues>({
    dateReported: { min: '', max: '' },
    paymentStatus: 'all',
  });

  /* ─── Search ───────────────────────────────────────────── */
  const [searchValue, setSearchValue] = useState('');
  const debouncedSearch = useDebounce(searchValue);

  /* ─── View mode ────────────────────────────────────────── */
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  /* ─── Modal & selection state ──────────────────────────── */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const gridRef = useRef<AgGridReact<MaintenanceTask>>(null);

  /* ─── Lookup maps ──────────────────────────────────────── */
  const propertyMap = useMemo(() => Object.fromEntries(properties.map((p) => [p.id, p])), [properties]);
  const unitMap = useMemo(() => Object.fromEntries(units.map((u) => [u.id, u])), [units]);

  /* ─── Primary filter configs ───────────────────────────── */
  const primaryFilters = useMemo<FilterConfig[]>(() => [
    {
      key: 'property',
      label: 'Property',
      type: 'select',
      options: [
        { value: 'all', label: 'All Properties' },
        ...properties.map((p) => ({ value: p.id, label: p.name })),
      ],
    },
    {
      key: 'status',
      label: 'Status',
      type: 'select',
      options: [
        { value: 'all', label: 'All Statuses' },
        ...statuses.map((s) => ({ value: s, label: s })),
      ],
    },
    {
      key: 'priority',
      label: 'Priority',
      type: 'select',
      options: [
        { value: 'all', label: 'All Priorities' },
        ...priorities.map((p) => ({ value: p, label: p })),
      ],
    },
  ], [properties]);

  /* ─── Advanced filter configs ──────────────────────────── */
  const advancedFilters = useMemo<FilterConfig[]>(() => [
    { key: 'dateReported', label: 'Date Reported', type: 'dateRange' },
    {
      key: 'paymentStatus',
      label: 'Payment Status',
      type: 'select',
      options: [
        { value: 'all', label: 'All Payment Statuses' },
        ...paymentStatuses.map((s) => ({ value: s, label: s })),
      ],
    },
  ], []);

  /* ─── Filter handlers ──────────────────────────────────── */
  const handlePrimaryFilterChange = useCallback((key: string, value: string) => {
    setPrimaryFilterValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleAdvancedFilterChange = useCallback((key: string, value: FilterValue) => {
    setAdvancedFilterValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setPrimaryFilterValues({ property: 'all', status: 'all', priority: 'all' });
    setAdvancedFilterValues({ dateReported: { min: '', max: '' }, paymentStatus: 'all' });
    setSearchValue('');
  }, []);

  /* ─── Filtered tasks (primary -> advanced -> search) ──── */
  const filteredTasks = useMemo(() => {
    const filterProperty = primaryFilterValues.property as string;
    const filterStatus = primaryFilterValues.status as string;
    const filterPriority = primaryFilterValues.priority as string;
    const dateRange = advancedFilterValues.dateReported as RangeValue;
    const filterPayment = advancedFilterValues.paymentStatus as string;
    const search = debouncedSearch.toLowerCase().trim();

    return tasks.filter((t) => {
      // Primary filters
      if (filterProperty !== 'all' && t.propertyId !== filterProperty) return false;
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;

      // Advanced filters
      if (dateRange.min && t.dateReported < dateRange.min) return false;
      if (dateRange.max && t.dateReported > dateRange.max) return false;
      if (filterPayment !== 'all' && t.paymentStatus !== filterPayment) return false;

      // Search
      if (search) {
        const propName = (propertyMap[t.propertyId]?.name ?? '').toLowerCase();
        const unitNumber = (unitMap[t.unitId]?.unitNumber ?? '').toLowerCase();
        const desc = t.description.toLowerCase();
        const cat = t.category.toLowerCase();
        const contractor = t.contractor.toLowerCase();
        const notes = t.notes.toLowerCase();
        if (
          !propName.includes(search) &&
          !unitNumber.includes(search) &&
          !desc.includes(search) &&
          !cat.includes(search) &&
          !contractor.includes(search) &&
          !notes.includes(search)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, primaryFilterValues, advancedFilterValues, debouncedSearch, propertyMap, unitMap]);

  /* ─── KPI computations ─────────────────────────────────── */
  const totalTasks = filteredTasks.length;
  const openTasks = useMemo(() => filteredTasks.filter((t) => t.status === 'Open').length, [filteredTasks]);
  const inProgressTasks = useMemo(() => filteredTasks.filter((t) => t.status === 'In Progress').length, [filteredTasks]);
  const completedTasks = useMemo(() => filteredTasks.filter((t) => t.status === 'Completed').length, [filteredTasks]);
  const totalEstimatedCost = useMemo(() => filteredTasks.reduce((s, t) => s + t.estimatedCost, 0), [filteredTasks]);
  const totalActualCost = useMemo(() => filteredTasks.reduce((s, t) => s + t.actualCost, 0), [filteredTasks]);

  /* ─── Helpers ──────────────────────────────────────────── */
  const getUnitsForProperty = useCallback(
    (propertyId: string) => units.filter((u) => u.propertyId === propertyId),
    [units],
  );

  const handleFieldChange = useCallback(
    (task: MaintenanceTask, field: keyof MaintenanceTask, value: string | number | boolean) => {
      const patch: Partial<MaintenanceTask> = { [field]: value };
      if (field === 'propertyId') { patch.unitId = ''; }
      if (field === 'appliesToEntireBuilding' && value === true) { patch.unitId = ''; }
      setEditingTask((prev) => prev && prev.id === task.id ? { ...prev, ...patch } as MaintenanceTask : prev);
    },
    [],
  );

  const handleAddTask = () => {
    const filterProperty = primaryFilterValues.property as string;
    setEditingTask({
      id: '', propertyId: filterProperty !== 'all' ? filterProperty : '',
      appliesToEntireBuilding: false, unitId: '',
      dateReported: new Date().toISOString().split('T')[0],
      description: '', priority: 'Medium', category: '', contractor: '',
      estimatedCost: 0, actualCost: 0, paymentStatus: 'Unpaid',
      completionDate: '', status: 'Open', notes: '',
    });
    setIsNewRecord(true);
    setModalOpen(true);
  };

  const handleCellClicked = useCallback((event: { data: MaintenanceTask | undefined; column: { getColId: () => string } }) => {
    if (event.column.getColId() === 'actions' || event.column.getColId().startsWith('ag-Grid')) return;
    if (event.data) { setEditingTask({ ...event.data }); setModalOpen(true); }
  }, []);

  const handleCloseModal = useCallback(() => { setModalOpen(false); setEditingTask(null); setIsNewRecord(false); }, []);
  const handleSaveModal = useCallback(async () => {
    if (editingTask) {
      if (isNewRecord) { await addTask(editingTask); } else { await updateTask(editingTask.id, editingTask); }
    }
    setModalOpen(false); setEditingTask(null); setIsNewRecord(false);
  }, [editingTask, isNewRecord, addTask, updateTask]);

  const handleDelete = useCallback((id: string) => {
    removeTask(id);
    if (editingTask?.id === id) { setModalOpen(false); setEditingTask(null); }
  }, [removeTask, editingTask]);

  const handleBulkDelete = useCallback(() => {
    for (const id of selectedIds) { removeTask(id); }
    setSelectedIds([]); setBulkDeleteOpen(false);
    gridRef.current?.api.deselectAll();
  }, [selectedIds, removeTask]);

  const handleSelectionChanged = useCallback(() => {
    const rows = gridRef.current?.api.getSelectedRows() ?? [];
    setSelectedIds(rows.map(r => r.id));
  }, []);

  /* ─── Card view handlers ───────────────────────────────── */
  const handleCardClick = useCallback((record: MaintenanceTask) => {
    setEditingTask({ ...record });
    setIsNewRecord(false);
    setModalOpen(true);
  }, []);

  const handleCardToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const handleCardDelete = useCallback((id: string) => {
    setDeleteConfirmId(id);
  }, []);

  /* ─── Column definitions ───────────────────────────────── */
  const columnDefs = useMemo<ColDef<MaintenanceTask>[]>(() => [
    { headerName: 'Property', field: 'propertyId', width: 160, cellRenderer: (p: { value: string }) => propertyMap[p.value]?.name ?? '--' },
    { headerName: 'Scope', field: 'appliesToEntireBuilding', width: 100, cellRenderer: (p: { value: boolean }) => (
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${p.value ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>{p.value ? 'Building' : 'Unit'}</span>
    )},
    { headerName: 'Unit', field: 'unitId', width: 80, cellRenderer: (p: { value: string; data: MaintenanceTask }) => p.data.appliesToEntireBuilding ? 'All' : (unitMap[p.value]?.unitNumber ?? '--') },
    { headerName: 'Reported', field: 'dateReported', width: 120 },
    { headerName: 'Description', field: 'description', width: 220 },
    { headerName: 'Priority', field: 'priority', width: 110, cellRenderer: (p: { value: MaintenancePriority }) => (
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityBadge[p.value]}`}>{p.value}</span>
    )},
    { headerName: 'Category', field: 'category', width: 110 },
    { headerName: 'Contractor', field: 'contractor', width: 150 },
    { headerName: `Est. (${currency})`, field: 'estimatedCost', width: 120, cellRenderer: (p: { value: number }) => <span className="font-medium">{currency}{fmt(p.value)}</span> },
    { headerName: `Actual (${currency})`, field: 'actualCost', width: 120, cellRenderer: (p: { value: number }) => <span className="font-medium">{currency}{fmt(p.value)}</span> },
    { headerName: 'Payment', field: 'paymentStatus', width: 130, cellRenderer: (p: { value: MaintenancePaymentStatus }) => (
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentBadge[p.value]}`}>{p.value}</span>
    )},
    { headerName: 'Status', field: 'status', width: 130, cellRenderer: (p: { value: MaintenanceStatus }) => (
      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[p.value]}`}>{p.value}</span>
    )},
    { headerName: 'Completed', field: 'completionDate', width: 120 },
    { headerName: 'Notes', field: 'notes', flex: 1, minWidth: 140 },
    { headerName: '', colId: 'actions', width: 60, sortable: false, resizable: false, cellRenderer: (p: { data: MaintenanceTask }) => (
      <button onClick={() => setDeleteConfirmId(p.data.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-1.5 transition-colors cursor-pointer" title="Remove"><Trash2 size={14} /></button>
    )},
  ], [propertyMap, unitMap, currency, handleDelete]);

  const defaultColDef = useMemo<ColDef>(() => ({ sortable: true, resizable: true }), []);
  const modalUnits = useMemo(() => editingTask?.propertyId ? getUnitsForProperty(editingTask.propertyId) : [], [editingTask?.propertyId, getUnitsForProperty]);
  const onFieldChange = useCallback((field: keyof MaintenanceTask, value: string | number | boolean) => {
    if (editingTask) handleFieldChange(editingTask, field, value);
  }, [editingTask, handleFieldChange]);

  /* ─── Action buttons (passed to DataToolbar) ───────────── */
  const toolbarActions = (
    <>
      {selectedIds.length > 0 && (
        <button onClick={() => setBulkDeleteOpen(true)} className="rounded-lg bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-sm font-medium flex items-center gap-2 shadow-sm transition-all cursor-pointer">
          <Trash2 size={16} /> Delete Selected ({selectedIds.length})
        </button>
      )}
      <button onClick={handleAddTask} className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 text-sm font-medium flex items-center gap-2 shadow-sm transition-all cursor-pointer">
        <Plus size={16} /> Add Task
      </button>
    </>
  );

  return (
    <div>
      <div className="animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Maintenance</h1>
            <p className="text-sm text-slate-500 mt-1">Track and manage all maintenance and repair tasks across your properties.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-slate-500">
          <div className="text-xs text-slate-500 font-medium">Total Tasks</div>
          <div className="text-xl font-bold text-slate-800 mt-1">{totalTasks}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-blue-500">
          <div className="text-xs text-slate-500 font-medium">Open</div>
          <div className="text-xl font-bold text-blue-600 mt-1">{openTasks}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-amber-500">
          <div className="text-xs text-slate-500 font-medium">In Progress</div>
          <div className="text-xl font-bold text-amber-600 mt-1">{inProgressTasks}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-emerald-500">
          <div className="text-xs text-slate-500 font-medium">Completed</div>
          <div className="text-xl font-bold text-emerald-600 mt-1">{completedTasks}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-indigo-500">
          <div className="text-xs text-slate-500 font-medium">Est. Cost</div>
          <div className="text-xl font-bold text-slate-800 mt-1">{currency}{fmt(totalEstimatedCost)}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-red-500">
          <div className="text-xs text-slate-500 font-medium">Actual Cost</div>
          <div className="text-xl font-bold text-slate-800 mt-1">{currency}{fmt(totalActualCost)}</div>
        </div>
      </div>

      <DataToolbar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search by property, description, category, contractor, unit, notes..."
        primaryFilters={primaryFilters}
        primaryFilterValues={primaryFilterValues}
        onPrimaryFilterChange={handlePrimaryFilterChange}
        advancedFilters={advancedFilters}
        advancedFilterValues={advancedFilterValues}
        onAdvancedFilterChange={handleAdvancedFilterChange}
        onClearAllFilters={handleClearAllFilters}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        actions={toolbarActions}
      />

      {viewMode === 'table' ? (
        <div className="ag-theme-quartz ag-theme-custom" style={{ height: 600 }}>
          <AgGridReact<MaintenanceTask>
            ref={gridRef}
            theme="legacy"
            rowData={filteredTasks}
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
          records={filteredTasks}
          pageSize={15}
          emptyMessage="No maintenance tasks found."
          renderCard={(record) => (
            <MaintenanceCard
              key={record.id}
              record={record}
              propertyMap={propertyMap}
              unitMap={unitMap}
              currency={currency}
              isSelected={selectedIds.includes(record.id)}
              onToggleSelect={handleCardToggleSelect}
              onClick={handleCardClick}
              onDelete={handleCardDelete}
            />
          )}
        />
      )}

      <Modal open={modalOpen} onClose={handleCloseModal} title="Edit Maintenance Task"
        subtitle={editingTask ? `${propertyMap[editingTask.propertyId]?.name ?? 'New Task'}${editingTask.description ? ` - ${editingTask.description.slice(0, 40)}` : ''}` : undefined}
        size="xl"
        footer={<>
          <button onClick={handleCloseModal} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button onClick={handleSaveModal} className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 text-sm font-medium cursor-pointer shadow-sm">Save</button>
        </>}
      >
        {editingTask && (
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Property">
              <select value={editingTask.propertyId} onChange={(e) => onFieldChange('propertyId', e.target.value)} className={inputClass}>
                <option value="">-- Select --</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Applies to Entire Building">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editingTask.appliesToEntireBuilding} onChange={(e) => onFieldChange('appliesToEntireBuilding', e.target.checked)} className="w-4 h-4 accent-blue-600 cursor-pointer" />
                <span className="text-sm text-slate-600">Yes, applies to entire building</span>
              </label>
            </FieldGroup>
            <FieldGroup label="Unit">
              <select value={editingTask.unitId} onChange={(e) => onFieldChange('unitId', e.target.value)} className={inputClass} disabled={editingTask.appliesToEntireBuilding || !editingTask.propertyId}>
                <option value="">{editingTask.appliesToEntireBuilding ? 'All units' : '-- Select --'}</option>
                {modalUnits.map((u) => <option key={u.id} value={u.id}>{u.unitNumber}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Date Reported">
              <input type="date" value={editingTask.dateReported} onChange={(e) => onFieldChange('dateReported', e.target.value)} className={inputClass} />
            </FieldGroup>
            <div className="col-span-2">
              <FieldGroup label="Description">
                <input type="text" value={editingTask.description} onChange={(e) => onFieldChange('description', e.target.value)} className={inputClass} placeholder="Describe the issue..." />
              </FieldGroup>
            </div>
            <FieldGroup label="Priority">
              <select value={editingTask.priority} onChange={(e) => onFieldChange('priority', e.target.value)} className={inputClass}>
                {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Category">
              <input type="text" value={editingTask.category} onChange={(e) => onFieldChange('category', e.target.value)} className={inputClass} placeholder="e.g., Plumbing" />
            </FieldGroup>
            <FieldGroup label="Contractor">
              <input type="text" value={editingTask.contractor} onChange={(e) => onFieldChange('contractor', e.target.value)} className={inputClass} placeholder="Contractor name" />
            </FieldGroup>
            <FieldGroup label={`Estimated Cost (${currency})`}>
              <input type="number" min="0" step="0.01" value={editingTask.estimatedCost || ''} onChange={(e) => onFieldChange('estimatedCost', parseFloat(e.target.value) || 0)} className={inputClass} placeholder="0.00" />
            </FieldGroup>
            <FieldGroup label={`Actual Cost (${currency})`}>
              <input type="number" min="0" step="0.01" value={editingTask.actualCost || ''} onChange={(e) => onFieldChange('actualCost', parseFloat(e.target.value) || 0)} className={inputClass} placeholder="0.00" />
            </FieldGroup>
            <FieldGroup label="Payment Status">
              <select value={editingTask.paymentStatus} onChange={(e) => onFieldChange('paymentStatus', e.target.value)} className={inputClass}>
                {paymentStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Status">
              <select value={editingTask.status} onChange={(e) => onFieldChange('status', e.target.value)} className={inputClass}>
                {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </FieldGroup>
            <FieldGroup label="Completion Date">
              <input type="date" value={editingTask.completionDate} onChange={(e) => onFieldChange('completionDate', e.target.value)} className={inputClass} />
            </FieldGroup>
            <div className="col-span-2">
              <FieldGroup label="Notes">
                <input type="text" value={editingTask.notes} onChange={(e) => onFieldChange('notes', e.target.value)} className={inputClass} placeholder="Additional notes..." />
              </FieldGroup>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Delete Maintenance Task"
        subtitle="This action cannot be undone."
        size="sm"
        footer={<>
          <button onClick={() => setDeleteConfirmId(null)} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button onClick={() => { if (deleteConfirmId) { handleDelete(deleteConfirmId); setDeleteConfirmId(null); } }} className="rounded-lg bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-sm font-medium cursor-pointer shadow-sm">Delete</button>
        </>}
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete this maintenance task?</p>
      </Modal>

      <Modal open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} title="Delete Selected Tasks"
        subtitle="This action cannot be undone."
        size="sm"
        footer={<>
          <button onClick={() => setBulkDeleteOpen(false)} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button onClick={handleBulkDelete} className="rounded-lg bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-sm font-medium cursor-pointer shadow-sm">Delete {selectedIds.length} Tasks</button>
        </>}
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete {selectedIds.length} selected maintenance tasks?</p>
      </Modal>
    </div>
  );
}
