'use client';

import { Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { MaintenanceTask, Property, Unit } from '@/lib/types';
import { priorityBadge, taskStatusBadge, maintenancePaymentBadge, badgeClass } from '@/lib/badgeStyles';

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface MaintenanceCardProps {
  record: MaintenanceTask;
  propertyMap: Record<string, Property>;
  unitMap: Record<string, Unit>;
  currency: string;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onClick: (record: MaintenanceTask) => void;
  onDelete: (id: string) => void;
}

export default function MaintenanceCard({
  record,
  propertyMap,
  unitMap,
  currency,
  isSelected,
  onToggleSelect,
  onClick,
  onDelete,
}: MaintenanceCardProps) {
  const property = propertyMap[record.propertyId];
  const unit = record.unitId ? unitMap[record.unitId] : null;

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
      <div className="text-xs text-slate-500 mb-2">
        {record.appliesToEntireBuilding ? 'Entire Building' : (unit?.unitNumber ?? '—')} · Reported {record.dateReported}
      </div>

      {/* Description */}
      {record.description && (
        <p className="text-sm text-slate-700 mb-3 line-clamp-2">{record.description}</p>
      )}

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <span className={clsx(badgeClass, priorityBadge[record.priority])}>
          {record.priority}
        </span>
        <span className={clsx(badgeClass, taskStatusBadge[record.status])}>
          {record.status}
        </span>
        <span className={clsx(badgeClass, maintenancePaymentBadge[record.paymentStatus])}>
          {record.paymentStatus}
        </span>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-2">
        {record.category && (
          <>
            <div className="text-slate-500">Category</div>
            <div className="text-slate-700">{record.category}</div>
          </>
        )}
        {record.contractor && (
          <>
            <div className="text-slate-500">Contractor</div>
            <div className="text-slate-700">{record.contractor}</div>
          </>
        )}
      </div>

      {/* Costs */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-600 bg-slate-50 rounded-lg px-2 py-1 border border-slate-100">
          Est. {currency}{fmt(record.estimatedCost)}
        </span>
        <span className="text-xs font-medium text-slate-800 bg-blue-50 rounded-lg px-2 py-1 border border-blue-100">
          Actual {currency}{fmt(record.actualCost)}
        </span>
      </div>

      {/* Notes */}
      {record.notes && (
        <p className="mt-2 text-xs text-slate-400 truncate">{record.notes}</p>
      )}
    </div>
  );
}
