'use client';

import { useState, useMemo, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

interface CardGridProps<T> {
  records: T[];
  pageSize?: number;
  renderCard: (record: T, index: number) => ReactNode;
  emptyMessage?: string;
}

export default function CardGrid<T>({
  records,
  pageSize = 15,
  renderCard,
  emptyMessage = 'No records found.',
}: CardGridProps<T>) {
  const [currentPage, setCurrentPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages - 1);

  const pageRecords = useMemo(
    () => records.slice(safeCurrentPage * pageSize, (safeCurrentPage + 1) * pageSize),
    [records, safeCurrentPage, pageSize],
  );

  // Reset to first page when records change significantly
  if (currentPage >= totalPages && currentPage > 0) {
    setCurrentPage(0);
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pageRecords.map((record, index) => renderCard(record, safeCurrentPage * pageSize + index))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
          <span className="text-sm text-slate-500">
            {safeCurrentPage * pageSize + 1}–{Math.min((safeCurrentPage + 1) * pageSize, records.length)} of {records.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(Math.max(0, safeCurrentPage - 1))}
              disabled={safeCurrentPage === 0}
              className={clsx(
                'p-1.5 rounded-lg transition-colors cursor-pointer',
                safeCurrentPage === 0
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i)}
                className={clsx(
                  'w-8 h-8 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                  i === safeCurrentPage
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {i + 1}
              </button>
            )).slice(
              Math.max(0, safeCurrentPage - 2),
              Math.min(totalPages, safeCurrentPage + 3),
            )}
            {safeCurrentPage + 3 < totalPages && (
              <>
                <span className="text-slate-400 text-sm px-1">...</span>
                <button
                  onClick={() => setCurrentPage(totalPages - 1)}
                  className="w-8 h-8 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {totalPages}
                </button>
              </>
            )}
            <button
              onClick={() => setCurrentPage(Math.min(totalPages - 1, safeCurrentPage + 1))}
              disabled={safeCurrentPage >= totalPages - 1}
              className={clsx(
                'p-1.5 rounded-lg transition-colors cursor-pointer',
                safeCurrentPage >= totalPages - 1
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
