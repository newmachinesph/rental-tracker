'use client';

import { Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { Unit, Lease, Property } from '@/lib/types';
import { boolBadge, badgeClass } from '@/lib/badgeStyles';

interface UnitCardProps {
  record: Unit;
  propertyMap: Record<string, Property>;
  unitLeaseMap: Map<string, Lease[]>;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onClick: (record: Unit) => void;
  onDelete: (id: string) => void;
}

export default function UnitCard({
  record,
  propertyMap,
  unitLeaseMap,
  isSelected,
  onToggleSelect,
  onClick,
  onDelete,
}: UnitCardProps) {
  const property = propertyMap[record.propertyId];
  const uLeases = unitLeaseMap.get(record.id) || [];
  const isOccupied = uLeases.some((l) => l.isCurrentTenant);
  const occupiedBadge = boolBadge(isOccupied, 'Occupied', 'Vacant');

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
          <span className="font-semibold text-slate-800 text-sm truncate">{record.unitNumber}</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(record.id); }}
          className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg p-1 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer flex-shrink-0"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Property info */}
      <div className="text-xs text-slate-500 mb-3">
        {property?.name ?? '--'} · {property?.type ?? '--'}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <span className={clsx(badgeClass, occupiedBadge.className)}>{occupiedBadge.label}</span>
      </div>

      {/* Address */}
      {record.address && (
        <p className="text-xs text-slate-400 truncate">{record.address}</p>
      )}
    </div>
  );
}
