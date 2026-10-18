'use client';

import { Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { IncomeRecord } from '@/lib/types';
import type { Property, Unit, Tenant } from '@/lib/types';
import { incomeStatusBadge, badgeClass } from '@/lib/badgeStyles';

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface IncomeCardProps {
  record: IncomeRecord;
  propertyMap: Record<string, Property>;
  unitMap: Record<string, Unit>;
  tenantMap: Record<string, Tenant>;
  currency: string;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onClick: (record: IncomeRecord) => void;
  onDelete: (id: string) => void;
}

export default function IncomeCard({
  record,
  propertyMap,
  unitMap,
  tenantMap,
  currency,
  isSelected,
  onToggleSelect,
  onClick,
  onDelete,
}: IncomeCardProps) {
  const property = propertyMap[record.propertyId];
  const unit = unitMap[record.unitId];
  const tenant = tenantMap[record.tenantId];

  return (
    <div
      className={clsx(
        'group bg-white rounded-xl border shadow-sm p-4 transition-all hover:shadow-md cursor-pointer relative',
        isSelected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200',
      )}
      onClick={() => onClick(record)}
    >
      {/* Header row */}
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
        {unit?.unitNumber ?? '—'} · {tenant?.name ?? '—'}
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
        <div className="text-slate-500">Category</div>
        <div className="text-slate-700 font-medium">{record.category || '—'}</div>
        <div className="text-slate-500">Due Date</div>
        <div className="text-slate-700">{record.rentDueDate || '—'}</div>
        <div className="text-slate-500">Paid Date</div>
        <div className="text-slate-700">{record.paymentDate || '—'}</div>
        <div className="text-slate-500">Method</div>
        <div className="text-slate-700">{record.paymentMethod || '—'}</div>
      </div>

      {/* Amounts + status */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-slate-600 bg-slate-50 rounded-lg px-2 py-1 border border-slate-100">
          Due {currency}{fmt(record.totalDue)}
        </span>
        <span className="text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg px-2 py-1 border border-emerald-100">
          Paid {currency}{fmt(record.amountPaid)}
        </span>
        <span className={clsx(badgeClass, incomeStatusBadge[record.paymentStatus] ?? incomeStatusBadge.Pending)}>
          {record.paymentStatus}
        </span>
      </div>

      {/* Outstanding if > 0 */}
      {record.outstandingBalance > 0 && (
        <div className="mt-2 text-xs font-medium text-red-600">
          Outstanding: {currency}{fmt(record.outstandingBalance)}
        </div>
      )}

      {/* Notes */}
      {record.notes && (
        <p className="mt-2 text-xs text-slate-400 truncate">{record.notes}</p>
      )}
    </div>
  );
}
