'use client';

import { useState, type ReactNode } from 'react';
import { Search, SlidersHorizontal, X, LayoutGrid, List } from 'lucide-react';
import { clsx } from 'clsx';

/* ─── Filter config types ─────────────────────────────────── */

export type ViewMode = 'table' | 'card';

export interface SelectFilter {
  key: string;
  label: string;
  type: 'select';
  options: { value: string; label: string }[];
}

export interface DateRangeFilter {
  key: string;
  label: string;
  type: 'dateRange';
}

export interface NumberRangeFilter {
  key: string;
  label: string;
  type: 'numberRange';
  prefix?: string;
}

export type FilterConfig = SelectFilter | DateRangeFilter | NumberRangeFilter;

export type RangeValue = { min: string; max: string };
export type FilterValue = string | RangeValue;
export type FilterValues = Record<string, FilterValue>;

/* ─── Helpers ─────────────────────────────────────────────── */

function isRange(v: FilterValue): v is RangeValue {
  return typeof v === 'object' && 'min' in v;
}

function countActiveFilters(primary: FilterValues, advanced: FilterValues): number {
  let count = 0;
  for (const v of Object.values(primary)) {
    if (typeof v === 'string' && v !== 'all') count++;
  }
  for (const v of Object.values(advanced)) {
    if (isRange(v)) {
      if (v.min) count++;
      if (v.max) count++;
    } else if (v !== 'all' && v !== '') count++;
  }
  return count;
}

/* ─── Select input styling ────────────────────────────────── */

const selectClass =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none cursor-pointer transition-colors hover:border-slate-300';
const inputClass =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-colors';

/* ─── Component ───────────────────────────────────────────── */

interface DataToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  primaryFilters?: FilterConfig[];
  primaryFilterValues?: FilterValues;
  onPrimaryFilterChange?: (key: string, value: string) => void;

  advancedFilters?: FilterConfig[];
  advancedFilterValues?: FilterValues;
  onAdvancedFilterChange?: (key: string, value: FilterValue) => void;
  onClearAllFilters?: () => void;

  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;

  actions?: ReactNode;
}

export default function DataToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  primaryFilters = [],
  primaryFilterValues = {},
  onPrimaryFilterChange,
  advancedFilters = [],
  advancedFilterValues = {},
  onAdvancedFilterChange,
  onClearAllFilters,
  viewMode,
  onViewModeChange,
  actions,
}: DataToolbarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const activeCount = countActiveFilters(primaryFilterValues, advancedFilterValues);

  return (
    <div className="mb-5 space-y-0">
      {/* Main toolbar row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={clsx(inputClass, 'w-full pl-9 pr-8')}
          />
          {searchValue && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Primary filters */}
        {primaryFilters.map((f) => (
          <select
            key={f.key}
            value={(primaryFilterValues[f.key] as string) ?? 'all'}
            onChange={(e) => onPrimaryFilterChange?.(f.key, e.target.value)}
            className={selectClass}
          >
            {f.type === 'select' &&
              (f as SelectFilter).options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
          </select>
        ))}

        {/* Advanced filters toggle */}
        {advancedFilters.length > 0 && (
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={clsx(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all cursor-pointer',
              showAdvanced
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
            )}
          >
            <SlidersHorizontal size={15} />
            Filters
            {activeCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                {activeCount}
              </span>
            )}
          </button>
        )}

        {/* View toggle */}
        <div className="inline-flex items-center rounded-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => onViewModeChange('table')}
            title="Table view"
            className={clsx(
              'p-2 transition-colors cursor-pointer',
              viewMode === 'table'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-500 hover:bg-slate-50',
            )}
          >
            <List size={16} />
          </button>
          <button
            onClick={() => onViewModeChange('card')}
            title="Card view"
            className={clsx(
              'p-2 transition-colors cursor-pointer',
              viewMode === 'card'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-slate-500 hover:bg-slate-50',
            )}
          >
            <LayoutGrid size={16} />
          </button>
        </div>

        {/* Actions slot */}
        {actions && <div className="flex items-center gap-2 ml-auto">{actions}</div>}
      </div>

      {/* Advanced filters panel */}
      {showAdvanced && advancedFilters.length > 0 && (
        <div className="animate-slide-down mt-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {advancedFilters.map((f) => {
              if (f.type === 'select') {
                const sf = f as SelectFilter;
                return (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">{f.label}</label>
                    <select
                      value={(advancedFilterValues[f.key] as string) ?? 'all'}
                      onChange={(e) => onAdvancedFilterChange?.(f.key, e.target.value)}
                      className={clsx(selectClass, 'w-full')}
                    >
                      {sf.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }

              if (f.type === 'dateRange') {
                const val = (advancedFilterValues[f.key] as RangeValue) ?? { min: '', max: '' };
                return (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">{f.label}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={val.min}
                        onChange={(e) =>
                          onAdvancedFilterChange?.(f.key, { ...val, min: e.target.value })
                        }
                        className={clsx(inputClass, 'flex-1 min-w-0')}
                        placeholder="From"
                      />
                      <span className="text-slate-400 text-xs">to</span>
                      <input
                        type="date"
                        value={val.max}
                        onChange={(e) =>
                          onAdvancedFilterChange?.(f.key, { ...val, max: e.target.value })
                        }
                        className={clsx(inputClass, 'flex-1 min-w-0')}
                        placeholder="To"
                      />
                    </div>
                  </div>
                );
              }

              if (f.type === 'numberRange') {
                const nf = f as NumberRangeFilter;
                const val = (advancedFilterValues[f.key] as RangeValue) ?? { min: '', max: '' };
                return (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">{f.label}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={val.min}
                        onChange={(e) =>
                          onAdvancedFilterChange?.(f.key, { ...val, min: e.target.value })
                        }
                        className={clsx(inputClass, 'flex-1 min-w-0')}
                        placeholder={nf.prefix ? `${nf.prefix} Min` : 'Min'}
                      />
                      <span className="text-slate-400 text-xs">–</span>
                      <input
                        type="number"
                        value={val.max}
                        onChange={(e) =>
                          onAdvancedFilterChange?.(f.key, { ...val, max: e.target.value })
                        }
                        className={clsx(inputClass, 'flex-1 min-w-0')}
                        placeholder={nf.prefix ? `${nf.prefix} Max` : 'Max'}
                      />
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>

          {/* Clear all */}
          {activeCount > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <button
                onClick={onClearAllFilters}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
