'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import '@/lib/ag-grid-setup';

import { useSetupStore, useMileageStore } from '@/lib/store';
import type { MileageRate, MileageLog } from '@/lib/types';
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
import MileageCard from '@/components/cards/MileageCard';

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type RateWarning = { id: string; type: 'invalid-range' | 'overlap'; message: string };

function validateRates(rates: MileageRate[]): RateWarning[] {
  const warnings: RateWarning[] = [];
  for (const rate of rates) {
    if (rate.startDate && rate.endDate && rate.endDate < rate.startDate) {
      warnings.push({ id: rate.id, type: 'invalid-range', message: 'End date is before start date' });
    }
  }
  for (let i = 0; i < rates.length; i++) {
    for (let j = i + 1; j < rates.length; j++) {
      const a = rates[i], b = rates[j];
      if (a.startDate && a.endDate && b.startDate && b.endDate && a.startDate <= b.endDate && b.startDate <= a.endDate) {
        if (!warnings.find((w) => w.id === a.id && w.type === 'overlap')) warnings.push({ id: a.id, type: 'overlap', message: 'Date range overlaps' });
        if (!warnings.find((w) => w.id === b.id && w.type === 'overlap')) warnings.push({ id: b.id, type: 'overlap', message: 'Date range overlaps' });
      }
    }
  }
  return warnings;
}

function calculateAmount(date: string, distance: number, rates: MileageRate[]): number {
  if (!date || distance <= 0) return 0;
  const applicable = rates.find((r) => r.startDate && r.endDate && date >= r.startDate && date <= r.endDate);
  if (applicable) return Math.round(distance * applicable.rate * 100) / 100;
  const sorted = [...rates].filter((r) => r.startDate && r.startDate <= date).sort((a, b) => b.startDate.localeCompare(a.startDate));
  if (sorted.length > 0) return Math.round(distance * sorted[0].rate * 100) / 100;
  if (rates.length > 0) return Math.round(distance * rates[0].rate * 100) / 100;
  return 0;
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none';

export default function MileagePage() {
  const { properties, currency } = useSetupStore();
  const { unit, rates, logs, setUnit, addRate, updateRate, removeRate, addLog, updateLog, removeLog } = useMileageStore();

  const [rateSetupOpen, setRateSetupOpen] = useState(true);
  const [filterPropertyId, setFilterPropertyId] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<MileageLog | null>(null);
  const [isNewLog, setIsNewLog] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const gridRef = useRef<AgGridReact<MileageLog>>(null);

  /* ─── New state for search, view toggle, and advanced filters ─── */
  const [searchValue, setSearchValue] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [advancedFilters, setAdvancedFilters] = useState<FilterValues>({});
  const debouncedSearch = useDebounce(searchValue);

  const unitLabel = unit === 'km' ? 'km' : 'mile';
  const unitLabelPlural = unit === 'km' ? 'km' : 'miles';

  const rateWarnings = useMemo(() => validateRates(rates), [rates]);
  const getWarningsForRate = useCallback((rateId: string) => rateWarnings.filter((w) => w.id === rateId), [rateWarnings]);

  const propertyMap = useMemo(() => Object.fromEntries(properties.map((p) => [p.id, p])), [properties]);

  /* ─── Enhanced filtered logs ─────────────────────────────────── */
  const filteredLogs = useMemo(() => {
    let result = filterPropertyId === 'all' ? logs : logs.filter((l) => l.propertyId === filterPropertyId);

    // Advanced filters: date range
    const dateRange = advancedFilters.date as RangeValue | undefined;
    if (dateRange) {
      if (dateRange.min) result = result.filter((l) => l.date >= dateRange.min);
      if (dateRange.max) result = result.filter((l) => l.date <= dateRange.max);
    }

    // Advanced filters: distance range
    const distRange = advancedFilters.distance as RangeValue | undefined;
    if (distRange) {
      if (distRange.min) result = result.filter((l) => l.distance >= parseFloat(distRange.min));
      if (distRange.max) result = result.filter((l) => l.distance <= parseFloat(distRange.max));
    }

    // Search
    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      result = result.filter((l) => {
        const propertyName = propertyMap[l.propertyId]?.name ?? '';
        return (
          l.date.includes(term) ||
          propertyName.toLowerCase().includes(term) ||
          l.description.toLowerCase().includes(term)
        );
      });
    }

    return result;
  }, [logs, filterPropertyId, advancedFilters, debouncedSearch, propertyMap]);

  const totalDistance = useMemo(() => filteredLogs.reduce((s, l) => s + l.distance, 0), [filteredLogs]);
  const totalAmount = useMemo(() => filteredLogs.reduce((s, l) => s + l.amount, 0), [filteredLogs]);

  // Rate handlers
  const handleRateChange = useCallback((id: string, field: keyof MileageRate, value: string | number) => {
    updateRate(id, { [field]: value });
  }, [updateRate]);

  const handleAddRate = useCallback(() => {
    if (rates.length >= 5) return;
    addRate({ id: '', rate: 0, startDate: '', endDate: '' });
  }, [rates.length, addRate]);

  // Log handlers
  const handleLogFieldChange = useCallback(
    (log: MileageLog, field: keyof MileageLog, value: string | number) => {
      const patch: Partial<MileageLog> = { [field]: value };
      if (field === 'date' || field === 'distance') {
        const date = field === 'date' ? (value as string) : log.date;
        const distance = field === 'distance' ? (value as number) : log.distance;
        patch.amount = calculateAmount(date, distance, rates);
      }
      setEditingLog((prev) => prev && prev.id === log.id ? { ...prev, ...patch } as MileageLog : prev);
    },
    [rates],
  );

  const handleAddLog = () => {
    const today = new Date().toISOString().split('T')[0];
    setEditingLog({ id: '', date: today, distance: 0, amount: 0, propertyId: '', description: '' });
    setIsNewLog(true);
    setModalOpen(true);
  };

  const handleCellClicked = useCallback((event: { data: MileageLog | undefined; column: { getColId: () => string } }) => {
    if (event.column.getColId() === 'actions' || event.column.getColId().startsWith('ag-Grid')) return;
    if (event.data) { setEditingLog({ ...event.data }); setModalOpen(true); }
  }, []);

  const handleCloseModal = useCallback(() => { setModalOpen(false); setEditingLog(null); setIsNewLog(false); }, []);
  const handleSaveModal = useCallback(async () => {
    if (editingLog) {
      if (isNewLog) {
        await addLog(editingLog);
      } else {
        await updateLog(editingLog.id, editingLog);
      }
    }
    setModalOpen(false);
    setEditingLog(null);
    setIsNewLog(false);
  }, [editingLog, isNewLog, addLog, updateLog]);

  const handleDeleteLog = useCallback((id: string) => {
    removeLog(id);
    if (editingLog?.id === id) { setModalOpen(false); setEditingLog(null); }
  }, [removeLog, editingLog]);

  const handleBulkDelete = useCallback(() => {
    for (const id of selectedIds) { removeLog(id); }
    setSelectedIds([]);
    setBulkDeleteOpen(false);
    gridRef.current?.api.deselectAll();
  }, [selectedIds, removeLog]);

  const handleSelectionChanged = useCallback(() => {
    const rows = gridRef.current?.api.getSelectedRows() ?? [];
    setSelectedIds(rows.map(r => r.id));
  }, []);

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
    { key: 'date', label: 'Date Range', type: 'dateRange' },
    { key: 'distance', label: 'Distance Range', type: 'numberRange', prefix: unitLabelPlural },
  ], [unitLabelPlural]);

  const handleAdvancedFilterChange = useCallback((key: string, value: FilterValue) => {
    setAdvancedFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleClearAllFilters = useCallback(() => {
    setFilterPropertyId('all');
    setAdvancedFilters({});
  }, []);

  /* ─── Card selection & click handlers ──────────────────────────── */
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const handleCardClick = useCallback((record: MileageLog) => {
    setEditingLog({ ...record });
    setIsNewLog(false);
    setModalOpen(true);
  }, []);

  /* ─── Column definitions ───────────────────────────────────────── */
  const columnDefs = useMemo<ColDef<MileageLog>[]>(() => [
    { headerName: 'Date', field: 'date', width: 130 },
    { headerName: `Distance (${unitLabelPlural})`, field: 'distance', width: 140, cellRenderer: (p: { value: number }) => <span className="font-medium">{p.value.toLocaleString('en-US')}</span> },
    { headerName: `Amount (${currency})`, field: 'amount', width: 130, cellRenderer: (p: { value: number }) => <span className="font-semibold text-blue-700">{currency}{fmt(p.value)}</span> },
    { headerName: 'Property', field: 'propertyId', width: 170, cellRenderer: (p: { value: string }) => propertyMap[p.value]?.name ?? '--' },
    { headerName: 'Description', field: 'description', flex: 1, minWidth: 200 },
    { headerName: '', colId: 'actions', width: 60, sortable: false, resizable: false, cellRenderer: (p: { data: MileageLog }) => (
      <button onClick={() => setDeleteConfirmId(p.data.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-1.5 transition-colors cursor-pointer" title="Remove"><Trash2 size={14} /></button>
    )},
  ], [propertyMap, currency, unitLabelPlural, handleDeleteLog]);

  const defaultColDef = useMemo<ColDef>(() => ({ sortable: true, resizable: true }), []);

  const onFieldChange = useCallback((field: keyof MileageLog, value: string | number) => {
    if (editingLog) handleLogFieldChange(editingLog, field, value);
  }, [editingLog, handleLogFieldChange]);

  return (
    <div>
      <div className="animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mileage</h1>
            <p className="text-sm text-slate-500 mt-1">Track mileage rates and property visit travel logs.</p>
          </div>
        </div>
      </div>

      {/* Rate Setup Section (collapsible, keeps HTML table) */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-6 overflow-hidden">
        <button onClick={() => setRateSetupOpen(!rateSetupOpen)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors group cursor-pointer">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-800">Mileage Rate Setup</h2>
            <span className="text-[11px] text-slate-400 font-semibold bg-slate-100 px-2.5 py-0.5 rounded-full uppercase tracking-wide">{rates.length} rate{rates.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center transition-colors">
            {rateSetupOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </div>
        </button>

        {rateSetupOpen && (
          <div className="px-5 pb-5 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-6 mt-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-600">Unit:</span>
                <div className="flex bg-slate-100 rounded-lg p-0.5">
                  <button onClick={() => setUnit('km')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${unit === 'km' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Kilometers</button>
                  <button onClick={() => setUnit('miles')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${unit === 'miles' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Miles</button>
                </div>
              </div>
              <div className="flex gap-3 ml-auto">
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-center min-w-[120px]">
                  <div className="text-xs text-slate-500 font-medium">Total Mileage</div>
                  <div className="text-lg font-bold text-slate-800">{totalDistance.toLocaleString('en-US')} {unitLabelPlural}</div>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-center min-w-[120px]">
                  <div className="text-xs text-slate-500 font-medium">Total Amount</div>
                  <div className="text-lg font-bold text-blue-600">{currency}{fmt(totalAmount)}</div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200">
                    <th className="px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap text-right">Rate ({currency}/{unitLabel})</th>
                    <th className="px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Start Date</th>
                    <th className="px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">End Date</th>
                    <th className="px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                    <th className="px-3 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-slate-400">No rates configured. Add a rate to get started.</td></tr>
                  )}
                  {rates.map((rate) => {
                    const warnings = getWarningsForRate(rate.id);
                    const hasInvalidRange = warnings.some((w) => w.type === 'invalid-range');
                    const hasOverlap = warnings.some((w) => w.type === 'overlap');
                    let rowBg = '';
                    if (hasOverlap) rowBg = 'bg-red-50/50';
                    else if (hasInvalidRange) rowBg = 'bg-amber-50/50';

                    return (
                      <tr key={rate.id} className={`border-b border-slate-100 hover:bg-blue-50/30 transition-colors ${rowBg}`}>
                        <td className="px-3 py-2.5">
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{currency}</span>
                            <input type="number" min="0" step="0.01" value={rate.rate || ''} onChange={(e) => handleRateChange(rate.id, 'rate', parseFloat(e.target.value) || 0)} className="rounded-lg border border-slate-200 bg-white pl-6 pr-3 py-2 text-sm w-[120px] text-right focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" placeholder="0.00" />
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <input type="date" value={rate.startDate} onChange={(e) => handleRateChange(rate.id, 'startDate', e.target.value)} className={`rounded-lg border px-3 py-2 text-sm w-[150px] focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all ${hasInvalidRange ? 'border-amber-300 bg-amber-50/50 focus:border-amber-400' : hasOverlap ? 'border-red-300 bg-red-50/50 focus:border-red-400' : 'border-slate-200 bg-white focus:border-blue-500'}`} />
                        </td>
                        <td className="px-3 py-2.5">
                          <input type="date" value={rate.endDate} onChange={(e) => handleRateChange(rate.id, 'endDate', e.target.value)} className={`rounded-lg border px-3 py-2 text-sm w-[150px] focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all ${hasInvalidRange ? 'border-amber-300 bg-amber-50/50 focus:border-amber-400' : hasOverlap ? 'border-red-300 bg-red-50/50 focus:border-red-400' : 'border-slate-200 bg-white focus:border-blue-500'}`} />
                        </td>
                        <td className="px-3 py-2.5">
                          {warnings.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {warnings.map((w, idx) => (
                                <span key={idx} className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg ${w.type === 'overlap' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                                  <AlertTriangle className="w-3 h-3" />{w.message}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                              <CheckCircle2 className="w-3 h-3" />Valid
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button onClick={() => removeRate(rate.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50 cursor-pointer" title="Remove rate"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {rates.length < 5 && (
              <div className="mt-4">
                <button onClick={handleAddRate} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors bg-blue-50 hover:bg-blue-100 px-3.5 py-2 rounded-lg cursor-pointer">
                  <Plus className="w-4 h-4" /> Add Rate ({rates.length}/5)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mileage Log section heading */}
      <h2 className="text-base font-bold text-slate-800 mb-3">Mileage Log</h2>

      <DataToolbar
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search by date, property, description..."
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
            <button onClick={handleAddLog} className="bg-blue-600 text-white hover:bg-blue-700 rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 shadow-sm transition-colors cursor-pointer">
              <Plus className="w-4 h-4" /> Add Log
            </button>
          </>
        }
      />

      {/* Conditional table / card rendering */}
      {viewMode === 'table' ? (
        <div className="ag-theme-quartz ag-theme-custom" style={{ height: 500 }}>
          <AgGridReact<MileageLog>
            ref={gridRef}
            theme="legacy"
            rowData={filteredLogs}
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
        <CardGrid<MileageLog>
          records={filteredLogs}
          pageSize={15}
          emptyMessage="No mileage logs found."
          renderCard={(record) => (
            <MileageCard
              key={record.id}
              record={record}
              propertyMap={propertyMap}
              currency={currency}
              unitLabelPlural={unitLabelPlural}
              isSelected={selectedIds.includes(record.id)}
              onToggleSelect={handleToggleSelect}
              onClick={handleCardClick}
              onDelete={(id) => setDeleteConfirmId(id)}
            />
          )}
        />
      )}

      <Modal open={modalOpen} onClose={handleCloseModal} title="Edit Mileage Log"
        subtitle={editingLog ? `${propertyMap[editingLog.propertyId]?.name ?? 'New Log'}${editingLog.date ? ` - ${editingLog.date}` : ''}` : undefined}
        size="md"
        footer={<>
          <button onClick={handleCloseModal} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button onClick={handleSaveModal} className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 text-sm font-medium cursor-pointer shadow-sm">Save</button>
        </>}
      >
        {editingLog && (
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Date">
              <input type="date" value={editingLog.date} onChange={(e) => onFieldChange('date', e.target.value)} className={inputClass} />
            </FieldGroup>
            <FieldGroup label={`Distance (${unitLabelPlural})`}>
              <input type="number" min="0" step="0.1" value={editingLog.distance || ''} onChange={(e) => onFieldChange('distance', parseFloat(e.target.value) || 0)} className={inputClass} placeholder="0" />
            </FieldGroup>
            <FieldGroup label={`Amount (${currency})`} autoFilled>
              <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-blue-700">{currency}{fmt(editingLog.amount)}</div>
            </FieldGroup>
            <FieldGroup label="Property">
              <select value={editingLog.propertyId} onChange={(e) => onFieldChange('propertyId', e.target.value)} className={inputClass}>
                <option value="">-- Select --</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </FieldGroup>
            <div className="col-span-2">
              <FieldGroup label="Description">
                <input type="text" value={editingLog.description} onChange={(e) => onFieldChange('description', e.target.value)} className={inputClass} placeholder="Trip description..." />
              </FieldGroup>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} title="Delete Mileage Log"
        subtitle="This action cannot be undone."
        size="sm"
        footer={<>
          <button onClick={() => setDeleteConfirmId(null)} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button onClick={() => { if (deleteConfirmId) { handleDeleteLog(deleteConfirmId); setDeleteConfirmId(null); } }} className="rounded-lg bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-sm font-medium cursor-pointer shadow-sm">Delete</button>
        </>}
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete this mileage log entry?</p>
      </Modal>

      <Modal open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} title="Delete Selected Logs"
        subtitle="This action cannot be undone."
        size="sm"
        footer={<>
          <button onClick={() => setBulkDeleteOpen(false)} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
          <button onClick={handleBulkDelete} className="rounded-lg bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-sm font-medium cursor-pointer shadow-sm">Delete {selectedIds.length} Logs</button>
        </>}
      >
        <p className="text-sm text-slate-600">Are you sure you want to delete {selectedIds.length} selected mileage log entries?</p>
      </Modal>
    </div>
  );
}
