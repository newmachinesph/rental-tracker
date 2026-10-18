'use client';

import { Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { MileageLog, Property } from '@/lib/types';

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface MileageCardProps {
  record: MileageLog;
  propertyMap: Record<string, Property>;
  currency: string;
  unitLabelPlural: string;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onClick: (record: MileageLog) => void;
  onDelete: (id: string) => void;
}

export default function MileageCard({
  record,
  propertyMap,
  currency,
  unitLabelPlural,
  isSelected,
  onToggleSelect,
  onClick,
  onDelete,
}: MileageCardProps) {
  const property = propertyMap[record.propertyId];

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
          <span className="font-semibold text-slate-800 text-sm truncate">{record.date}</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(record.id); }}
          className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg p-1 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer flex-shrink-0"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Property */}
      <div className="text-xs text-slate-500 mb-3">
        {property?.name ?? '--'}
      </div>

      {/* Amounts */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className="text-xs font-medium text-slate-800 bg-blue-50 rounded-lg px-2 py-1 border border-blue-100">
          {record.distance.toLocaleString('en-US')} {unitLabelPlural}
        </span>
        <span className="text-xs font-semibold text-blue-700 bg-blue-50 rounded-lg px-2 py-1 border border-blue-100">
          {currency}{fmt(record.amount)}
        </span>
      </div>

      {/* Description */}
      {record.description && (
        <p className="text-xs text-slate-400 truncate">{record.description}</p>
      )}
    </div>
  );
}
