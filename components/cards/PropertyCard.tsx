'use client';

import { Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { Property } from '@/lib/types';
import { badgeClass } from '@/lib/badgeStyles';

interface PropertyCardProps {
  record: Property;
  unitCount: number;
  occupiedCount: number;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onClick: (record: Property) => void;
  onDelete: (id: string) => void;
}

export default function PropertyCard({
  record,
  unitCount,
  occupiedCount,
  isSelected,
  onToggleSelect,
  onClick,
  onDelete,
}: PropertyCardProps) {
  const vacantCount = unitCount - occupiedCount;

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
          <span className="font-semibold text-slate-800 text-sm truncate">{record.name}</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(record.id); }}
          className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg p-1 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer flex-shrink-0"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Type badge */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <span className={clsx(badgeClass, 'bg-blue-50 text-blue-700 border border-blue-200')}>
          {record.type}
        </span>
      </div>

      {/* Unit stats */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center bg-slate-50 rounded-lg px-2 py-1.5 border border-slate-100">
          <div className="text-xs text-slate-500">Units</div>
          <div className="text-sm font-bold text-slate-800">{unitCount}</div>
        </div>
        <div className="text-center bg-emerald-50 rounded-lg px-2 py-1.5 border border-emerald-100">
          <div className="text-xs text-emerald-600">Occupied</div>
          <div className="text-sm font-bold text-emerald-700">{occupiedCount}</div>
        </div>
        <div className="text-center bg-amber-50 rounded-lg px-2 py-1.5 border border-amber-100">
          <div className="text-xs text-amber-600">Vacant</div>
          <div className="text-sm font-bold text-amber-700">{vacantCount}</div>
        </div>
      </div>

      {/* Address */}
      {record.address && (
        <p className="text-xs text-slate-400 truncate">{record.address}</p>
      )}
    </div>
  );
}
