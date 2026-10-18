'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import '@/lib/ag-grid-setup';

import { useSetupStore, useLeaseStore } from '@/lib/store';
import type { Unit } from '@/lib/types';
import { Modal, FieldGroup } from '@/components/ui/Modal';
import { useDebounce } from '@/lib/hooks/useDebounce';
import DataToolbar, {
  type ViewMode,
  type FilterConfig,
  type FilterValues,
  type FilterValue,
} from '@/components/DataToolbar';
import CardGrid from '@/components/cards/CardGrid';
import UnitCard from '@/components/cards/UnitCard';

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none';

export default function UnitsPage() {
  const { properties, units, addUnit, updateUnit, removeUnit } = useSetupStore();
  const { leases } = useLeaseStore();

  const [filterPropertyId, setFilterPropertyId] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [unitForm, setUnitForm] = useState({ propertyId: '', unitNumber: '', address: '' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const gridRef = useRef<AgGridReact<Unit>>(null);

  /* --- New state for search, view toggle, and advanced filters --- */
  const [searchValue, setSearchValue] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [advancedFilters, setAdvancedFilters] = useState<FilterValues>({});

  const debouncedSearch = useDebounce(searchValue);

  /* --- Lookup maps --- */
  const propertyMap = useMemo(() => Object.fromEntries(properties.map((p) => [p.id, p])), [properties]);

  const unitLeaseMap = useMemo(() => {
    const map = new Map<string, typeof leases>();
    for (const lease of leases) {
      const arr = map.get(lease.unitId) || [];
      arr.push(lease);
      map.set(lease.unitId, arr);
    }
    return map;
  }, [leases]);

  /* --- Enhanced filtered units --- */
  const filteredUnits = useMemo(() => {
    let result = filterPropertyId === 'all' ? units : units.filter((u) => u.propertyId === filterPropertyId);

    // Advanced filter: occupied status
    const occupiedFilter = advancedFilters.occupied as string | undefined;
    if (occupiedFilter && occupiedFilter !== 'all') {
      result = result.filter((u) => {
        const uLeases = unitLeaseMap.get(u.id) || [];
        const isOccupied = uLeases.some((l) => l.isCurrentTenant);
        return occupiedFilter === 'yes' ? isOccupied : !isOccupied;
      });
    }

    // Search
    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      result = result.filter((u) => {
        const propertyName = propertyMap[u.propertyId]?.name ?? '';
        const propertyType = propertyMap[u.propertyId]?.type ?? '';
        return (
          u.unitNumber.toLowerCase().includes(term) ||
          propertyName.toLowerCase().includes(term) ||
          propertyType.toLowerCase().includes(term) ||
          u.address.toLowerCase().includes(term)
        );
      });
    }

    return result;
  }, [units, filterPropertyId, advancedFilters, debouncedSearch, unitLeaseMap, propertyMap]);

  /* --- KPI totals --- */
  const totalUnits = filteredUnits.length;

  const occupiedUnits = useMemo(
    () => filteredUnits.filter((u) => {
      const uLeases = unitLeaseMap.get(u.id) || [];
      return uLeases.some((l) => l.isCurrentTenant);
    }).length,
    [filteredUnits, unitLeaseMap],
  );

  const vacantUnits = totalUnits - occupiedUnits;

  /* --- DataToolbar filter configs --- */
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
      key: 'occupied',
      label: 'Occupancy Status',
      type: 'select',
      options: [
        { value: 'all', label: 'All' },
        { value: 'yes', label: 'Occupied' },
        { value: 'no', label: 'Vacant' },
      ],
    },
  ], []);

  const handleAdvancedFilterChange = useCallback((key: string, value: FilterValue) => {
    setAdvancedFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setFilterPropertyId('all');
    setAdvancedFilters({});
  }, []);

  /* --- Card selection toggle --- */
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const handleCardClick = useCallback((record: Unit) => {
    setEditingUnit({ ...record });
    setUnitForm({ propertyId: record.propertyId, unitNumber: record.unitNumber, address: record.address });
    setIsNewRecord(false);
    setModalOpen(true);
  }, []);

  /* --- Handlers (unchanged) --- */
  const handleDelete = useCallback((id: string) => {
    const uLeases = unitLeaseMap.get(id) || [];
    if (uLeases.some((l) => l.isCurrentTenant)) {
      alert('Cannot delete unit with active leases. Remove the leases first.');
      return;
    }
    removeUnit(id);
    if (editingUnit?.id === id) {
      setModalOpen(false);
      setEditingUnit(null);
    }
  }, [unitLeaseMap, removeUnit, editingUnit]);

  const handleBulkDelete = useCallback(() => {
    let skipped = 0;
    for (const id of selectedIds) {
      const uLeases = unitLeaseMap.get(id) || [];
      if (uLeases.some((l) => l.isCurrentTenant)) { skipped++; continue; }
      removeUnit(id);
    }
    setSelectedIds([]);
    setBulkDeleteOpen(false);
    gridRef.current?.api.deselectAll();
    if (skipped > 0) alert(`${skipped} unit(s) with active leases were skipped.`);
  }, [selectedIds, unitLeaseMap, removeUnit]);

  const handleSelectionChanged = useCallback(() => {
    const rows = gridRef.current?.api.getSelectedRows() ?? [];
    setSelectedIds(rows.map(r => r.id));
  }, []);

  const handleAddUnit = () => {
    setEditingUnit(null);
    setUnitForm({ propertyId: filterPropertyId !== 'all' ? filterPropertyId : '', unitNumber: '', address: '' });
    setIsNewRecord(true);
    setModalOpen(true);
  };

  const handleCellClicked = useCallback((event: {
    data: Unit | undefined;
    column: { getColId: () => string };
  }) => {
    if (event.column.getColId() === 'actions' || event.column.getColId().startsWith('ag-Grid')) return;
    if (event.data) {
      setEditingUnit({ ...event.data });
      setUnitForm({ propertyId: event.data.propertyId, unitNumber: event.data.unitNumber, address: event.data.address });
      setIsNewRecord(false);
      setModalOpen(true);
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingUnit(null);
    setIsNewRecord(false);
  }, []);

  const handleSaveModal = useCallback(async () => {
    if (!unitForm.propertyId || !unitForm.unitNumber.trim()) return;
    if (isNewRecord) {
      const property = properties.find((p) => p.id === unitForm.propertyId);
      const propUnits = units.filter((u) => u.propertyId === unitForm.propertyId);
      if (property && propUnits.length >= property.units) {
        alert(`This property allows a maximum of ${property.units} units.`);
        return;
      }
      await addUnit({ id: '', propertyId: unitForm.propertyId, unitNumber: unitForm.unitNumber.trim(), address: unitForm.address.trim() });
    } else if (editingUnit) {
      await updateUnit(editingUnit.id, { propertyId: unitForm.propertyId, unitNumber: unitForm.unitNumber.trim(), address: unitForm.address.trim() });
    }
    setModalOpen(false);
    setEditingUnit(null);
    setIsNewRecord(false);
  }, [unitForm, isNewRecord, editingUnit, properties, units, addUnit, updateUnit]);

  /* --- Column definitions (unchanged) --- */
  const columnDefs = useMemo<ColDef<Unit>[]>(() => [
    {
      headerName: 'Unit Number',
      field: 'unitNumber',
      width: 150,
      cellRenderer: (p: { value: string }) => <span className="font-medium">{p.value}</span>,
    },
    {
      headerName: 'Property',
      field: 'propertyId',
      width: 170,
      cellRenderer: (p: { value: string }) => propertyMap[p.value]?.name ?? '--',
    },
    {
      headerName: 'Type',
      field: 'propertyId' as keyof Unit,
      colId: 'propertyType',
      width: 110,
      cellRenderer: (p: { value: string }) => propertyMap[p.value]?.type ?? '--',
    },
    {
      headerName: 'Address',
      field: 'address',
      flex: 1,
      minWidth: 200,
      cellRenderer: (p: { value: string }) => p.value || '--',
    },
    {
      headerName: 'Occupied',
      colId: 'occupied',
      width: 110,
      valueGetter: (p: { data: Unit | undefined }) => {
        if (!p.data) return false;
        const uLeases = unitLeaseMap.get(p.data.id) || [];
        return uLeases.some((l) => l.isCurrentTenant);
      },
      cellRenderer: (p: { value: boolean }) => (
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
          p.value
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-slate-50 text-slate-500 border border-slate-200'
        }`}>
          {p.value ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      headerName: '',
      colId: 'actions',
      width: 60,
      sortable: false,
      resizable: false,
      cellRenderer: (p: { data: Unit }) => (
        <button
          onClick={() => setDeleteConfirmId(p.data.id)}
          className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-1.5 transition-colors cursor-pointer"
          title="Remove"
        >
          <Trash2 size={14} />
        </button>
      ),
    },
  ], [propertyMap, unitLeaseMap]);

  const defaultColDef = useMemo<ColDef>(() => ({ sortable: true, resizable: true }), []);

  return (
    <div>
      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Units</h1>
            <p className="text-sm text-slate-500 mt-1">Manage all property units and their information.</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-blue-500">
          <div className="text-xs text-slate-500 font-medium">Total Units</div>
          <div className="text-xl font-bold text-slate-800 mt-1">{totalUnits}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-emerald-500">
          <div className="text-xs text-slate-500 font-medium">Occupied</div>
          <div className="text-xl font-bold text-emerald-600 mt-1">{occupiedUnits}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-amber-500">
          <div className="text-xs text-slate-500 font-medium">Vacant</div>
          <div className="text-xl font-bold text-amber-600 mt-1">{vacantUnits}</div>
        </div>
      </div>

      {/* DataToolbar replaces old filter bar */}
      <DataToolbar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search by unit, property, address..."
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
            <button onClick={handleAddUnit} className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 text-sm font-medium flex items-center gap-2 shadow-sm transition-all cursor-pointer">
              <Plus size={16} /> Add Unit
            </button>
          </>
        }
      />

      {/* Conditional table / card rendering */}
      {viewMode === 'table' ? (
        <div className="ag-theme-quartz ag-theme-custom" style={{ height: 600 }}>
          <AgGridReact<Unit>
            ref={gridRef}
            theme="legacy"
            rowData={filteredUnits}
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
        <CardGrid<Unit>
          records={filteredUnits}
          pageSize={15}
          emptyMessage="No units found."
          renderCard={(record) => (
            <UnitCard
              key={record.id}
              record={record}
              propertyMap={propertyMap}
              unitLeaseMap={unitLeaseMap}
              isSelected={selectedIds.includes(record.id)}
              onToggleSelect={handleToggleSelect}
              onClick={handleCardClick}
              onDelete={(id) => setDeleteConfirmId(id)}
            />
          )}
        />
      )}

      {/* Edit / Add Modal */}
      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        title={isNewRecord ? 'Add New Unit' : 'Edit Unit'}
        subtitle="Enter unit information"
        size="md"
        footer={<>
          <button onClick={handleCloseModal} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button
            onClick={handleSaveModal}
            disabled={!unitForm.propertyId || !unitForm.unitNumber.trim()}
            className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium cursor-pointer shadow-sm"
          >
            {isNewRecord ? 'Add' : 'Update'} Unit
          </button>
        </>}
      >
        <div className="flex flex-col gap-4">
          <FieldGroup label="Property">
            <select
              value={unitForm.propertyId}
              onChange={(e) => setUnitForm((f) => ({ ...f, propertyId: e.target.value }))}
              className={inputClass}
            >
              <option value="">-- Select --</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="Property Type" autoFilled>
            <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {propertyMap[unitForm.propertyId]?.type ?? '--'}
            </div>
          </FieldGroup>
          <FieldGroup label="Unit Number">
            <input
              type="text"
              value={unitForm.unitNumber}
              onChange={(e) => setUnitForm((f) => ({ ...f, unitNumber: e.target.value }))}
              className={inputClass}
              placeholder="e.g., 101, Suite A"
              autoFocus
            />
          </FieldGroup>
          <FieldGroup label="Address">
            <input
              type="text"
              value={unitForm.address}
              onChange={(e) => setUnitForm((f) => ({ ...f, address: e.target.value }))}
              className={inputClass}
              placeholder="Unit-specific address (optional)"
            />
          </FieldGroup>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Delete Unit"
        subtitle="This action cannot be undone."
        size="sm"
        footer={<>
          <button onClick={() => setDeleteConfirmId(null)} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button onClick={() => { if (deleteConfirmId) { handleDelete(deleteConfirmId); setDeleteConfirmId(null); } }} className="rounded-lg bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-sm font-medium cursor-pointer shadow-sm">Delete</button>
        </>}
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete this unit?</p>
      </Modal>

      {/* Bulk Delete Modal */}
      <Modal open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} title="Delete Selected Units"
        subtitle="This action cannot be undone."
        size="sm"
        footer={<>
          <button onClick={() => setBulkDeleteOpen(false)} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button onClick={handleBulkDelete} className="rounded-lg bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-sm font-medium cursor-pointer shadow-sm">Delete {selectedIds.length} Units</button>
        </>}
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete {selectedIds.length} selected units? Units with active leases will be skipped.</p>
      </Modal>
    </div>
  );
}
