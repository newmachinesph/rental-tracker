'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { Plus, Trash2, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import '@/lib/ag-grid-setup';

import { useSetupStore, useTenantStore, useLeaseStore } from '@/lib/store';
import type { Tenant } from '@/lib/types';
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
import TenantCard from '@/components/cards/TenantCard';

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none';

export default function TenantsPage() {
  const router = useRouter();
  const { properties } = useSetupStore();
  const { tenants, addTenant, updateTenant, removeTenant } = useTenantStore();
  const { leases } = useLeaseStore();

  const [filterPropertyId, setFilterPropertyId] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [tenantForm, setTenantForm] = useState({ name: '', phone: '', email: '' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const gridRef = useRef<AgGridReact<Tenant>>(null);

  /* ─── New state for search, view toggle, and advanced filters ─── */
  const [searchValue, setSearchValue] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [advancedFilters, setAdvancedFilters] = useState<FilterValues>({});
  const debouncedSearch = useDebounce(searchValue);

  /* ─── Lookup maps ──────────────────────────────────────────────── */
  const propertyMap = useMemo(() => Object.fromEntries(properties.map((p) => [p.id, p])), [properties]);

  const tenantLeaseMap = useMemo(() => {
    const map = new Map<string, typeof leases>();
    for (const lease of leases) {
      const arr = map.get(lease.tenantId) || [];
      arr.push(lease);
      map.set(lease.tenantId, arr);
    }
    return map;
  }, [leases]);

  /* ─── Enhanced filtered tenants ─────────────────────────────────── */
  const filteredTenants = useMemo(() => {
    let result = tenants;

    // 1. Property filter
    if (filterPropertyId !== 'all') {
      result = result.filter((t) => {
        const tLeases = tenantLeaseMap.get(t.id) || [];
        return tLeases.some((l) => l.propertyId === filterPropertyId);
      });
    }

    // 2. Search
    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      result = result.filter((t) => {
        const tLeases = tenantLeaseMap.get(t.id) || [];
        const propNames = tLeases.map((l) => propertyMap[l.propertyId]?.name ?? '').join(' ');
        return (
          t.name.toLowerCase().includes(term) ||
          t.phone.toLowerCase().includes(term) ||
          t.email.toLowerCase().includes(term) ||
          propNames.toLowerCase().includes(term)
        );
      });
    }

    return result;
  }, [tenants, filterPropertyId, tenantLeaseMap, debouncedSearch, propertyMap]);

  /* ─── KPI totals ───────────────────────────────────────────────── */
  const totalTenants = filteredTenants.length;

  const activeTenants = useMemo(
    () => filteredTenants.filter((t) => {
      const tLeases = tenantLeaseMap.get(t.id) || [];
      return tLeases.some((l) => l.isCurrentTenant);
    }).length,
    [filteredTenants, tenantLeaseMap],
  );

  const tenantsWithoutLeases = useMemo(
    () => filteredTenants.filter((t) => {
      const tLeases = tenantLeaseMap.get(t.id) || [];
      return tLeases.length === 0;
    }).length,
    [filteredTenants, tenantLeaseMap],
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

  const handleClearAllFilters = useCallback(() => {
    setFilterPropertyId('all');
    setAdvancedFilters({});
  }, []);

  const handleAdvancedFilterChange = useCallback((key: string, value: FilterValue) => {
    setAdvancedFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  /* ─── Card selection toggle ────────────────────────────────────── */
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const handleCardClick = useCallback((record: Tenant) => {
    setEditingTenant({ ...record });
    setTenantForm({ name: record.name, phone: record.phone, email: record.email });
    setIsNewRecord(false);
    setModalOpen(true);
  }, []);

  /* ─── Handlers (unchanged) ─────────────────────────────────────── */
  const handleDelete = useCallback((id: string) => {
    const tLeases = tenantLeaseMap.get(id) || [];
    if (tLeases.length > 0) {
      alert('Cannot delete tenant with active leases. Remove their leases first.');
      return;
    }
    removeTenant(id);
    if (editingTenant?.id === id) {
      setModalOpen(false);
      setEditingTenant(null);
    }
  }, [tenantLeaseMap, removeTenant, editingTenant]);

  const handleBulkDelete = useCallback(() => {
    let skipped = 0;
    for (const id of selectedIds) {
      const tLeases = tenantLeaseMap.get(id) || [];
      if (tLeases.length > 0) { skipped++; continue; }
      removeTenant(id);
    }
    setSelectedIds([]);
    setBulkDeleteOpen(false);
    gridRef.current?.api.deselectAll();
    if (skipped > 0) alert(`${skipped} tenant(s) with leases were skipped.`);
  }, [selectedIds, tenantLeaseMap, removeTenant]);

  const handleSelectionChanged = useCallback(() => {
    const rows = gridRef.current?.api.getSelectedRows() ?? [];
    setSelectedIds(rows.map(r => r.id));
  }, []);

  const handleAddTenant = () => {
    setEditingTenant(null);
    setTenantForm({ name: '', phone: '', email: '' });
    setIsNewRecord(true);
    setModalOpen(true);
  };

  const handleCellClicked = useCallback((event: {
    data: Tenant | undefined;
    column: { getColId: () => string };
  }) => {
    if (event.column.getColId() === 'actions' || event.column.getColId().startsWith('ag-Grid')) return;
    if (event.data) {
      setEditingTenant({ ...event.data });
      setTenantForm({ name: event.data.name, phone: event.data.phone, email: event.data.email });
      setIsNewRecord(false);
      setModalOpen(true);
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingTenant(null);
    setIsNewRecord(false);
  }, []);

  const handleSaveModal = useCallback(async () => {
    if (!tenantForm.name.trim()) return;
    if (isNewRecord) {
      await addTenant({ id: '', name: tenantForm.name.trim(), phone: tenantForm.phone.trim(), email: tenantForm.email.trim() });
    } else if (editingTenant) {
      await updateTenant(editingTenant.id, { name: tenantForm.name.trim(), phone: tenantForm.phone.trim(), email: tenantForm.email.trim() });
    }
    setModalOpen(false);
    setEditingTenant(null);
    setIsNewRecord(false);
  }, [tenantForm, isNewRecord, editingTenant, addTenant, updateTenant]);

  /* ─── Column definitions (unchanged) ───────────────────────────── */
  const columnDefs = useMemo<ColDef<Tenant>[]>(() => [
    {
      headerName: 'Name',
      field: 'name',
      width: 200,
      cellRenderer: (p: { value: string }) => <span className="font-medium">{p.value}</span>,
    },
    {
      headerName: 'Phone',
      field: 'phone',
      width: 150,
      cellRenderer: (p: { value: string }) => p.value || '--',
    },
    {
      headerName: 'Email',
      field: 'email',
      width: 220,
      cellRenderer: (p: { value: string }) => p.value || '--',
    },
    {
      headerName: 'Active Leases',
      colId: 'activeLeases',
      width: 130,
      valueGetter: (p: { data: Tenant | undefined }) => {
        if (!p.data) return 0;
        const tLeases = tenantLeaseMap.get(p.data.id) || [];
        return tLeases.filter((l) => l.isCurrentTenant).length;
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
      headerName: 'Properties',
      colId: 'properties',
      flex: 1,
      minWidth: 200,
      valueGetter: (p: { data: Tenant | undefined }) => {
        if (!p.data) return '';
        const tLeases = tenantLeaseMap.get(p.data.id) || [];
        const propIds = [...new Set(tLeases.map((l) => l.propertyId))];
        return propIds.map((id) => propertyMap[id]?.name ?? '--').join(', ');
      },
      cellRenderer: (p: { value: string }) => p.value || '--',
    },
    {
      headerName: '',
      colId: 'actions',
      width: 90,
      sortable: false,
      resizable: false,
      cellRenderer: (p: { data: Tenant }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => router.push(`/tenants/${p.data.id}`)}
            className="text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg p-1.5 transition-colors cursor-pointer"
            title="View Profile"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={() => setDeleteConfirmId(p.data.id)}
            className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-1.5 transition-colors cursor-pointer"
            title="Remove"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ], [tenantLeaseMap, propertyMap, handleDelete]);

  const defaultColDef = useMemo<ColDef>(() => ({ sortable: true, resizable: true }), []);

  return (
    <div>
      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tenants</h1>
            <p className="text-sm text-slate-500 mt-1">Manage all tenants and their contact information.</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-blue-500">
          <div className="text-xs text-slate-500 font-medium">Total Tenants</div>
          <div className="text-xl font-bold text-slate-800 mt-1">{totalTenants}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-emerald-500">
          <div className="text-xs text-slate-500 font-medium">Active Tenants</div>
          <div className="text-xl font-bold text-emerald-600 mt-1">{activeTenants}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 border-l-4 border-l-amber-500">
          <div className="text-xs text-slate-500 font-medium">Without Leases</div>
          <div className="text-xl font-bold text-amber-600 mt-1">{tenantsWithoutLeases}</div>
        </div>
      </div>

      {/* DataToolbar replaces old filter bar */}
      <DataToolbar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search by name, phone, email, property..."
        primaryFilters={primaryFilterConfigs}
        primaryFilterValues={primaryFilterValues}
        onPrimaryFilterChange={handlePrimaryFilterChange}
        advancedFilters={[]}
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
            <button onClick={handleAddTenant} className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 text-sm font-medium flex items-center gap-2 shadow-sm transition-all cursor-pointer">
              <Plus size={16} /> Add Tenant
            </button>
          </>
        }
      />

      {/* Conditional table / card rendering */}
      {viewMode === 'table' ? (
        <div className="ag-theme-quartz ag-theme-custom" style={{ height: 600 }}>
          <AgGridReact<Tenant>
            ref={gridRef}
            theme="legacy"
            rowData={filteredTenants}
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
        <CardGrid<Tenant>
          records={filteredTenants}
          pageSize={15}
          emptyMessage="No tenants found."
          renderCard={(record) => (
            <TenantCard
              key={record.id}
              record={record}
              tenantLeaseMap={tenantLeaseMap}
              propertyMap={propertyMap}
              isSelected={selectedIds.includes(record.id)}
              onToggleSelect={handleToggleSelect}
              onClick={handleCardClick}
              onDelete={(id) => setDeleteConfirmId(id)}
              onViewProfile={(id) => router.push(`/tenants/${id}`)}
            />
          )}
        />
      )}

      {/* Edit / Add Modal */}
      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        title={isNewRecord ? 'Add New Tenant' : 'Edit Tenant'}
        subtitle="Enter tenant contact information"
        size="md"
        footer={<>
          <button onClick={handleCloseModal} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button
            onClick={handleSaveModal}
            disabled={!tenantForm.name.trim()}
            className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium cursor-pointer shadow-sm"
          >
            {isNewRecord ? 'Add' : 'Update'} Tenant
          </button>
        </>}
      >
        <div className="flex flex-col gap-4">
          <FieldGroup label="Full Name">
            <input
              type="text"
              value={tenantForm.name}
              onChange={(e) => setTenantForm((f) => ({ ...f, name: e.target.value }))}
              className={inputClass}
              placeholder="Tenant full name"
              autoFocus
            />
          </FieldGroup>
          <FieldGroup label="Phone Number">
            <input
              type="tel"
              value={tenantForm.phone}
              onChange={(e) => setTenantForm((f) => ({ ...f, phone: e.target.value }))}
              className={inputClass}
              placeholder="(555) 000-0000"
            />
          </FieldGroup>
          <FieldGroup label="Email Address">
            <input
              type="email"
              value={tenantForm.email}
              onChange={(e) => setTenantForm((f) => ({ ...f, email: e.target.value }))}
              className={inputClass}
              placeholder="tenant@example.com"
            />
          </FieldGroup>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Delete Tenant"
        subtitle="This action cannot be undone."
        size="sm"
        footer={<>
          <button onClick={() => setDeleteConfirmId(null)} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button onClick={() => { if (deleteConfirmId) { handleDelete(deleteConfirmId); setDeleteConfirmId(null); } }} className="rounded-lg bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-sm font-medium cursor-pointer shadow-sm">Delete</button>
        </>}
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete this tenant?</p>
      </Modal>

      {/* Bulk Delete Modal */}
      <Modal open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} title="Delete Selected Tenants"
        subtitle="This action cannot be undone."
        size="sm"
        footer={<>
          <button onClick={() => setBulkDeleteOpen(false)} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button onClick={handleBulkDelete} className="rounded-lg bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-sm font-medium cursor-pointer shadow-sm">Delete {selectedIds.length} Tenants</button>
        </>}
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete {selectedIds.length} selected tenants? Tenants with leases will be skipped.</p>
      </Modal>
    </div>
  );
}
