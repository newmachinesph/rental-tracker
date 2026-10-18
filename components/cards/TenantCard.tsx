'use client';

import { Trash2, Eye } from 'lucide-react';
import { clsx } from 'clsx';
import type { Tenant, Lease, Property } from '@/lib/types';
import { badgeClass } from '@/lib/badgeStyles';

interface TenantCardProps {
  record: Tenant;
  tenantLeaseMap: Map<string, Lease[]>;
  propertyMap: Record<string, Property>;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onClick: (record: Tenant) => void;
  onDelete: (id: string) => void;
  onViewProfile: (id: string) => void;
}

export default function TenantCard({
  record,
  tenantLeaseMap,
  propertyMap,
  isSelected,
  onToggleSelect,
  onClick,
  onDelete,
  onViewProfile,
}: TenantCardProps) {
  const tLeases = tenantLeaseMap.get(record.id) || [];
  const activeLeases = tLeases.filter((l) => l.isCurrentTenant).length;
  const propIds = [...new Set(tLeases.map((l) => l.propertyId))];
  const propertyNames = propIds.map((id) => propertyMap[id]?.name ?? '--').join(', ');

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
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onViewProfile(record.id); }}
            className="text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg p-1 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
            title="View Profile"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(record.id); }}
            className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg p-1 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Contact */}
      <div className="text-xs text-slate-500 mb-3 space-y-0.5">
        {record.phone && <div>{record.phone}</div>}
        {record.email && <div className="truncate">{record.email}</div>}
        {!record.phone && !record.email && <div>No contact info</div>}
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <span className={clsx(badgeClass, activeLeases > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-50 text-slate-500 border border-slate-200')}>
          {activeLeases} Active Lease{activeLeases !== 1 ? 's' : ''}
        </span>
        <span className={clsx(badgeClass, 'bg-blue-50 text-blue-700 border border-blue-200')}>
          {tLeases.length} Total
        </span>
      </div>

      {/* Properties */}
      {propertyNames && (
        <p className="text-xs text-slate-400 truncate">{propertyNames}</p>
      )}
    </div>
  );
}
