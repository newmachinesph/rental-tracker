/* Shared badge style maps — used by both AgGrid cell renderers and card components */

// Income payment status
export const incomeStatusBadge: Record<string, string> = {
  Paid: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'Partially Paid': 'bg-amber-50 text-amber-700 border border-amber-200',
  Overpaid: 'bg-blue-50 text-blue-700 border border-blue-200',
  Unpaid: 'bg-red-50 text-red-700 border border-red-200',
  Pending: 'bg-slate-50 text-slate-500 border border-slate-200',
};

// Maintenance priority
export const priorityBadge: Record<string, string> = {
  Low: 'bg-slate-50 text-slate-600 border border-slate-200',
  Medium: 'bg-blue-50 text-blue-700 border border-blue-200',
  High: 'bg-amber-50 text-amber-700 border border-amber-200',
  Urgent: 'bg-red-50 text-red-700 border border-red-200',
};

// Maintenance task status
export const taskStatusBadge: Record<string, string> = {
  Open: 'bg-blue-50 text-blue-700 border border-blue-200',
  'In Progress': 'bg-amber-50 text-amber-700 border border-amber-200',
  Completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'On Hold': 'bg-slate-50 text-slate-600 border border-slate-200',
};

// Maintenance payment status
export const maintenancePaymentBadge: Record<string, string> = {
  Paid: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'Partially Paid': 'bg-amber-50 text-amber-700 border border-amber-200',
  Unpaid: 'bg-red-50 text-red-700 border border-red-200',
};

// Boolean badge helper
export function boolBadge(val: boolean, yesLabel = 'Yes', noLabel = 'No') {
  return {
    label: val ? yesLabel : noLabel,
    className: val
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : 'bg-slate-50 text-slate-500 border border-slate-200',
  };
}

// Common badge span class
export const badgeClass = 'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium';
