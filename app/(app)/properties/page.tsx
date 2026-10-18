'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import '@/lib/ag-grid-setup';

import { useSetupStore, useLeaseStore } from '@/lib/store';
import type { Property } from '@/lib/types';
import { Modal, FieldGroup } from '@/components/ui/Modal';
import { useDebounce } from '@/lib/hooks/useDebounce';
import DataToolbar, {
  type ViewMode,
  type FilterConfig,
  type FilterValues,
  type FilterValue,
} from '@/components/DataToolbar';
import CardGrid from '@/components/cards/CardGrid';
import PropertyCard from '@/components/cards/PropertyCard';

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none';

export default function PropertiesPage() {
  const { properties, units, propertyTypes, addProperty, updateProperty, removeProperty } = useSetupStore();
  const { leases } = useLeaseStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [propertyForm, setPropertyForm] = useState({ name: '', units: 1, type: '', address: '' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const gridRef = useRef<AgGridReact<Property>>(null);

  /* ─── New state for search, view toggle, and advanced filters ─── */
  const [searchValue, setSearchValue] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [advancedFilters, setAdvancedFilters] = useState<FilterValues>({});

  const debouncedSearch = useDebounce(searchValue);

  /* ─── Lookup maps ──────────────────────────────────────────────── */
  const activeLeasesByProperty = useMemo(() => {
    const map = new Map<string, number>();
    for (const lease of leases) {
      if (lease.isCurrentTenant) {
        map.set(lease.propertyId, (map.get(lease.propertyId) || 0) + 1);
      }
    }
    return map;
  }, [leases]);

  const unitCountByProperty = useMemo(() => {
    const map = new Map<string, number>();
    for (const unit of units) {
      map.set(unit.propertyId, (map.get(unit.propertyId) || 0) + 1);
    }
    return map;
  }, [units]);

  /* ─── Filtered properties ──────────────────────────────────────── */
  const filteredProperties = useMemo(() => {
    let result = properties;

    // Advanced filter: property type
    const typeFilter = advancedFilters.type as string | undefined;
    if (typeFilter && typeFilter !== 'all') {
      result = result.filter((p) => p.type === typeFilter);
    }

    // Search
    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      result = result.filter((p) =>
        p.name.toLowerCase().includes(term) ||
        p.type.toLowerCase().includes(term) ||
        (p.address ?? '').toLowerCase().includes(term)
      );
    }

    return result;
  }, [properties, advancedFilters, debouncedSearch]);

  /* ─── KPI totals (based on filtered data) ──────────────────────── */
  const totalProperties = filteredProperties.length;
  const totalUnitsFiltered = useMemo(
    () => filteredProperties.reduce((s, p) => s + (unitCountByProperty.get(p.id) || 0), 0),
    [filteredProperties, unitCountByProperty],
  );
  const occupiedUnitsFiltered = useMemo(
    () => filteredProperties.reduce((s, p) => s + (activeLeasesByProperty.get(p.id) || 0), 0),
    [filteredProperties, activeLeasesByProperty],
  );
  const vacantUnitsFiltered = totalUnitsFiltered - occupiedUnitsFiltered;

  /* ─── DataToolbar filter configs ───────────────────────────────── */
  const primaryFilterConfigs = useMemo<FilterConfig[]>(() => [], []);
  const primaryFilterValues = useMemo<FilterValues>(() => ({}), []);
  const handlePrimaryFilterChange = useCallback(() => {}, []);

  const advancedFilterConfigs = useMemo<FilterConfig[]>(() => [
    {
      key: 'type',
      label: 'Property Type',
      type: 'select',
      options: [
        { value: 'all', label: 'All Types' },
        ...propertyTypes.map((t) => ({ value: t, label: t })),
      ],
    },
  ], [propertyTypes]);

  const handleAdvancedFilterChange = useCallback((key: string, value: FilterValue) => {
    setAdvancedFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setAdvancedFilters({});
  }, []);

  /* ─── Card selection toggle ────────────────────────────────────── */
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const handleCardClick = useCallback((record: Property) => {
    setEditingProperty({ ...record });
    setPropertyForm({ name: record.name, units: record.units, type: record.type, address: record.address || '' });
    setIsNewRecord(false);
    setModalOpen(true);
  }, []);

  /* ─── Handlers ─────────────────────────────────────────────────── */
  const handleDelete = useCallback((id: string) => {
    const activeLeases = activeLeasesByProperty.get(id) || 0;
    if (activeLeases > 0) {
      alert('Cannot delete property with active leases. Remove the leases first.');
      return;
    }
    removeProperty(id);
    if (editingProperty?.id === id) {
      setModalOpen(false);
      setEditingProperty(null);
    }
  }, [activeLeasesByProperty, removeProperty, editingProperty]);

  const handleBulkDelete = useCallback(() => {
    let skipped = 0;
    for (const id of selectedIds) {
      const activeLeases = activeLeasesByProperty.get(id) || 0;
      if (activeLeases > 0) { skipped++; continue; }
      removeProperty(id);
    }
    setSelectedIds([]);
    setBulkDeleteOpen(false);
    gridRef.current?.api.deselectAll();
    if (skipped > 0) alert(`${skipped} property(ies) with active leases were skipped.`);
  }, [selectedIds, activeLeasesByProperty, removeProperty]);

  const handleSelectionChanged = useCallback(() => {
    const rows = gridRef.current?.api.getSelectedRows() ?? [];
    setSelectedIds(rows.map(r => r.id));
  }, []);

  const handleAddProperty = () => {
    setEditingProperty(null);
    setPropertyForm({ name: '', units: 1, type: propertyTypes[0] || '', address: '' });
    setIsNewRecord(true);
    setModalOpen(true);
  };

  const handleCellClicked = useCallback((event: {
    data: Property | undefined;
    column: { getColId: () => string };
  }) => {
    if (event.column.getColId() === 'actions' || event.column.getColId().startsWith('ag-Grid')) return;
    if (event.data) {
      setEditingProperty({ ...event.data });
      setPropertyForm({ name: event.data.name, units: event.data.units, type: event.data.type, address: event.data.address || '' });
      setIsNewRecord(false);
      setModalOpen(true);
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingProperty(null);
    setIsNewRecord(false);
  }, []);

  const handleSaveModal = useCallback(async () => {
    if (!propertyForm.name.trim() || !propertyForm.type || (isNewRecord && propertyForm.units < 1)) return;
    if (isNewRecord) {
      await addProperty({
        id: '',
        name: propertyForm.name.trim(),
        units: propertyForm.units,
        type: propertyForm.type,
        address: propertyForm.address.trim(),
      });
    } else if (editingProperty) {
      updateProperty(editingProperty.id, {
        name: propertyForm.name.trim(),
        type: propertyForm.type,
        address: propertyForm.address.trim(),
      });
    }
    setModalOpen(false);
    setEditingProperty(null);
    setIsNewRecord(false);
  }, [propertyForm, isNewRecord, editingProperty, addProperty, updateProperty]);

  /* ─── Column definitions ───────────────────────────────────────── */
  const columnDefs = useMemo<ColDef<Property>[]>(() => [
    {
      headerName: 'Name',
      field: 'name',
      width: 200,
      cellRenderer: (p: { value: string }) => <span className="font-medium">{p.value}</span>,
    },
    {
      headerName: 'Type',
      field: 'type',
      width: 130,
      cellRenderer: (p: { value: string }) => (
        <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          {p.value}
        </span>
      ),
    },
    {
      headerName: 'Units',
      colId: 'unitCount',
      width: 90,
      valueGetter: (p: { data: Property | undefined }) => {
        if (!p.data) return 0;
        return unitCountByProperty.get(p.data.id) || 0;
      },
    },
    {
      headerName: 'Occupied',
      colId: 'occupied',
      width: 110,
      valueGetter: (p: { data: Property | undefined }) => {
        if (!p.data) return 0;
        return activeLeasesByProperty.get(p.data.id) || 0;
      },
      cellRenderer: (p: { value: number }) => (
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
          p.value > 0
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-slate-50 text-slate-500 border border-slate-200'
        }`}>
          {p.value}
        </span>
      ),
    },
    {
      headerName: 'Vacant',
      colId: 'vacant',
      width: 100,
      valueGetter: (p: { data: Property | undefined }) => {
        if (!p.data) return 0;
        const total = unitCountByProperty.get(p.data.id) || 0;
        const occ = activeLeasesByProperty.get(p.data.id) || 0;
        return total - occ;
      },
      cellRenderer: (p: { value: number }) => (
        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
          p.value > 0
            ? 'bg-amber-50 text-amber-700 border border-amber-200'
            : 'bg-slate-50 text-slate-500 border border-slate-200'
        }`}>
          {p.value}
        </span>
      ),
    },
    {
      headerName: 'Address',
      field: 'address',
      flex: 1,
      minWidth: 200,
      cellRenderer: (p: { value: string | undefined }) => p.value || '--',
    },
    {
      headerName: '',
      colId: 'actions',
      width: 60,
      sortable: false,
      resizable: false,
      cellRenderer: (p: { data: Property }) => (
        <button
          onClick={() => setDeleteConfirmId(p.data.id)}
          className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-1.5 transition-colors cursor-pointer"
          title="Remove"
        >
          <Trash2 size={14} />
        </button>
      ),
    },
  ], [unitCountByProperty, activeLeasesByProperty]);

  const defaultColDef = useMemo<ColDef>(() => ({ sortable: true, resizable: true }), []);

  return (
    <div>
      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Properties</h1>
            <p className="text-sm text-slate-500 mt-1">Manage all properties and their details.</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-blue-500">
          <div className="text-xs text-slate-500 font-medium">Properties</div>
          <div className="text-xl font-bold text-slate-800 mt-1">{totalProperties}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-slate-500">
          <div className="text-xs text-slate-500 font-medium">Total Units</div>
          <div className="text-xl font-bold text-slate-800 mt-1">{totalUnitsFiltered}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-emerald-500">
          <div className="text-xs text-slate-500 font-medium">Occupied</div>
          <div className="text-xl font-bold text-emerald-600 mt-1">{occupiedUnitsFiltered}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-amber-500">
          <div className="text-xs text-slate-500 font-medium">Vacant</div>
          <div className="text-xl font-bold text-amber-600 mt-1">{vacantUnitsFiltered}</div>
        </div>
      </div>

      {/* DataToolbar */}
      <DataToolbar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search by name, type, address..."
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
            <button onClick={handleAddProperty} className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 text-sm font-medium flex items-center gap-2 shadow-sm transition-all cursor-pointer">
              <Plus size={16} /> Add Property
            </button>
          </>
        }
      />

      {/* Conditional table / card rendering */}
      {viewMode === 'table' ? (
        <div className="ag-theme-quartz ag-theme-custom" style={{ height: 600 }}>
          <AgGridReact<Property>
            ref={gridRef}
            theme="legacy"
            rowData={filteredProperties}
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
        <CardGrid<Property>
          records={filteredProperties}
          pageSize={15}
          emptyMessage="No properties found."
          renderCard={(record) => (
            <PropertyCard
              key={record.id}
              record={record}
              unitCount={unitCountByProperty.get(record.id) || 0}
              occupiedCount={activeLeasesByProperty.get(record.id) || 0}
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
        title={isNewRecord ? 'Add New Property' : 'Edit Property'}
        subtitle={isNewRecord ? 'Units will be auto-generated based on the count below' : 'Update property information'}
        size="md"
        footer={<>
          <button onClick={handleCloseModal} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button
            onClick={handleSaveModal}
            disabled={!propertyForm.name.trim() || !propertyForm.type || (isNewRecord && propertyForm.units < 1)}
            className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium cursor-pointer shadow-sm"
          >
            {isNewRecord ? 'Add' : 'Update'} Property
          </button>
        </>}
      >
        <div className="flex flex-col gap-4">
          <FieldGroup label="Property Name">
            <input
              type="text"
              value={propertyForm.name}
              onChange={(e) => setPropertyForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
              placeholder="e.g., Sunset Apartments"
              autoFocus
            />
          </FieldGroup>
          <FieldGroup label="Property Type">
            <select
              value={propertyForm.type}
              onChange={(e) => setPropertyForm((f) => ({ ...f, type: e.target.value }))}
              className={inputClass}
            >
              <option value="">-- Select --</option>
              {propertyTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </FieldGroup>
          {isNewRecord && (
            <FieldGroup label="Number of Units" hint="Units will be auto-generated when the property is created">
              <input
                type="number"
                min="1"
                value={propertyForm.units}
                onChange={(e) => setPropertyForm((f) => ({ ...f, units: Math.max(1, parseInt(e.target.value) || 1) }))}
                className={inputClass}
                placeholder="1"
              />
            </FieldGroup>
          )}
          <FieldGroup label="Address">
            <input
              type="text"
              value={propertyForm.address}
              onChange={(e) => setPropertyForm((f) => ({ ...f, address: e.target.value }))}
              className={inputClass}
              placeholder="Property address (optional)"
            />
          </FieldGroup>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Delete Property"
        subtitle="This action cannot be undone."
        size="sm"
        footer={<>
          <button onClick={() => setDeleteConfirmId(null)} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button onClick={() => { if (deleteConfirmId) { handleDelete(deleteConfirmId); setDeleteConfirmId(null); } }} className="rounded-lg bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-sm font-medium cursor-pointer shadow-sm">Delete</button>
        </>}
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete this property? All associated units will also be removed.</p>
      </Modal>

      {/* Bulk Delete Modal */}
      <Modal open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} title="Delete Selected Properties"
        subtitle="This action cannot be undone."
        size="sm"
        footer={<>
          <button onClick={() => setBulkDeleteOpen(false)} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button onClick={handleBulkDelete} className="rounded-lg bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-sm font-medium cursor-pointer shadow-sm">Delete {selectedIds.length} Properties</button>
        </>}
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete {selectedIds.length} selected properties? Properties with active leases will be skipped.</p>
      </Modal>
    </div>
  );
}
