'use client';

import { Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { ExpenseRecord, Property, Unit } from '@/lib/types';
import { boolBadge, badgeClass } from '@/lib/badgeStyles';

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface ExpenseCardProps {
  record: ExpenseRecord;
  propertyMap: Record<string, Property>;
  unitMap: Record<string, Unit>;
  currency: string;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onClick: (record: ExpenseRecord) => void;
  onDelete: (id: string) => void;
}

export default function ExpenseCard({
  record,
  propertyMap,
  unitMap,
  currency,
  isSelected,
  onToggleSelect,
  onClick,
  onDelete,
}: ExpenseCardProps) {
  const property = propertyMap[record.propertyId];
  const unit = record.unitId ? unitMap[record.unitId] : null;
  const building = boolBadge(record.appliesToEntireBuilding, 'Entire Building', 'Unit');

  return (
    <div
      className={clsx(
        'group bg-white rounded-xl border shadow-sm p-4 transition-all hover:shadow-md cursor-pointer relative',
        isSelected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200',
      )}
      onClick={() => onClick(record)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => { e.stopPropagation(); onToggleSelect(record.id); }}
            onClick={(e) => e.stopPropagation()}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0"
          />
          <span className="font-semibold text-slate-800 text-sm truncate">{property?.name ?? '—'}</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(record.id); }}
          className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg p-1 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer flex-shrink-0"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Subheader */}
      <div className="text-xs text-slate-500 mb-3">
        {record.appliesToEntireBuilding ? 'All Units' : (unit?.unitNumber ?? '—')} · {record.date}
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
        <div className="text-slate-500">Category</div>
        <div className="text-slate-700 font-medium">{record.category || '—'}</div>
        <div className="text-slate-500">Scope</div>
        <div><span className={clsx(badgeClass, building.className)}>{building.label}</span></div>
      </div>

      {/* Amounts */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-slate-600 bg-slate-50 rounded-lg px-2 py-1 border border-slate-100">
          {currency}{fmt(record.amount)}
        </span>
        {record.additionalFees > 0 && (
          <span className="text-xs font-medium text-slate-500 bg-slate-50 rounded-lg px-2 py-1 border border-slate-100">
            +{currency}{fmt(record.additionalFees)} fees
          </span>
        )}
        <span className="text-xs font-bold text-slate-800 bg-blue-50 rounded-lg px-2 py-1 border border-blue-100">
          Total {currency}{fmt(record.total)}
        </span>
      </div>

      {/* Notes */}
      {record.notes && (
        <p className="mt-2 text-xs text-slate-400 truncate">{record.notes}</p>
      )}
    </div>
  );
}
