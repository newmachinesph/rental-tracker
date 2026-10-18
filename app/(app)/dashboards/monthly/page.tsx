'use client';

import { useState, useMemo } from 'react';
import { useSetupStore, useIncomeStore, useExpenseStore } from '@/lib/store';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';

/* ── colour palettes for pie charts ────────────────────────── */
const INCOME_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6',
];
const EXPENSE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#84cc16',
  '#06b6d4', '#6366f1', '#d946ef', '#f43f5e',
  '#0ea5e9', '#22d3ee', '#a78bfa', '#fb923c',
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/* ── formatting helpers ────────────────────────────────────── */
function fmt(value: number, currency: string) {
  return `${currency}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(value: number) {
  return `${value.toFixed(1)}%`;
}

/* ── custom tooltip for pie charts ─────────────────────────── */
function PieTooltip({ active, payload, currency }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-slate-700">{d.name}</p>
      <p className="text-slate-500">{fmt(d.value, currency)}</p>
    </div>
  );
}

/* ── page component ────────────────────────────────────────── */
export default function MonthlyDashboardPage() {
  const { properties, units, incomeCategories, expenseCategories, currency } =
    useSetupStore();
  const incomeRecords = useIncomeStore((s) => s.records);
  const expenseRecords = useExpenseStore((s) => s.records);

  /* ── filter state (default: June 2025) ─────────────────── */
  const [year, setYear] = useState(2025);
  const [month, setMonth] = useState(5); // 0-indexed: 5 = June
  const [propertyId, setPropertyId] = useState('all');
  const [unitId, setUnitId] = useState('');

  /* ── derived: units for selected property ──────────────── */
  const propertyUnits = useMemo(
    () => (propertyId === 'all' ? [] : units.filter((u) => u.propertyId === propertyId)),
    [propertyId, units],
  );

  /* ── reset unit when property changes ──────────────────── */
  function handlePropertyChange(id: string) {
    setPropertyId(id);
    setUnitId('');
  }

  /* ── filtered income records ───────────────────────────── */
  const filteredIncome = useMemo(() => {
    return incomeRecords.filter((r) => {
      const d = new Date(r.rentDueDate);
      if (d.getFullYear() !== year || d.getMonth() !== month) return false;
      if (propertyId !== 'all') {
        if (r.propertyId !== propertyId) return false;
        if (unitId && r.unitId !== unitId) return false;
      }
      return true;
    });
  }, [incomeRecords, year, month, propertyId, unitId]);

  /* ── filtered expense records ──────────────────────────── */
  const filteredExpenses = useMemo(() => {
    return expenseRecords.filter((r) => {
      const d = new Date(r.date);
      if (d.getFullYear() !== year || d.getMonth() !== month) return false;
      if (propertyId !== 'all') {
        if (r.propertyId !== propertyId) return false;
        // include building-wide expenses when filtering by unit
        if (unitId && !r.appliesToEntireBuilding && r.unitId !== unitId) return false;
      }
      return true;
    });
  }, [expenseRecords, year, month, propertyId, unitId]);

  /* ── KPI totals ────────────────────────────────────────── */
  const totalIncome = useMemo(
    () => filteredIncome.reduce((s, r) => s + r.amountPaid, 0),
    [filteredIncome],
  );
  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((s, r) => s + r.total, 0),
    [filteredExpenses],
  );
  const profitLoss = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? (profitLoss / totalIncome) * 100 : 0;

  /* ── income by category ────────────────────────────────── */
  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredIncome.forEach((r) => {
      map[r.category] = (map[r.category] || 0) + r.amountPaid;
    });
    return incomeCategories
      .map((cat) => ({ name: cat, value: map[cat] || 0 }))
      .filter((c) => c.value > 0);
  }, [filteredIncome, incomeCategories]);

  /* ── expense by category ───────────────────────────────── */
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach((r) => {
      map[r.category] = (map[r.category] || 0) + r.total;
    });
    return expenseCategories
      .map((cat) => ({ name: cat, value: map[cat] || 0 }))
      .filter((c) => c.value > 0);
  }, [filteredExpenses, expenseCategories]);

  /* ── render ────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Monthly Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Financial data categorized by income and expense types for a specific month.</p>
          </div>
        </div>
      </div>

      {/* ── editable filter section ─────────────────────────── */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-amber-700">
          Filters
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Year */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">
              Year
            </label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
            />
          </div>

          {/* Month */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">
              Month
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="cursor-pointer w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Property */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">
              Property
            </label>
            <select
              value={propertyId}
              onChange={(e) => handlePropertyChange(e.target.value)}
              className="cursor-pointer w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
            >
              <option value="all">All</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Unit */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">
              Unit
            </label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              disabled={propertyId === 'all'}
              className="cursor-pointer w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">All units</option>
              {propertyUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitNumber}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── KPI cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-emerald-500">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Income</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1.5 tracking-tight">{fmt(totalIncome, currency)}</p>
          <p className="text-xs text-slate-400 mt-1">{`${filteredIncome.length} record${filteredIncome.length !== 1 ? 's' : ''}`}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-red-500">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Expenses</p>
          <p className="text-2xl font-bold text-red-700 mt-1.5 tracking-tight">{fmt(totalExpenses, currency)}</p>
          <p className="text-xs text-slate-400 mt-1">{`${filteredExpenses.length} record${filteredExpenses.length !== 1 ? 's' : ''}`}</p>
        </div>
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 ${profitLoss >= 0 ? 'border-l-blue-500' : 'border-l-amber-500'}`}>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Profit / Loss</p>
          <p className={`text-2xl font-bold mt-1.5 tracking-tight ${profitLoss >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>{fmt(profitLoss, currency)}</p>
          <p className="text-xs text-slate-400 mt-1">{profitLoss >= 0 ? 'Net profit' : 'Net loss'}</p>
        </div>
      </div>

      {/* ── main content: charts (left) + tables (right) ───── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* ── left column: profit margin + pie charts ──────── */}
        <div className="space-y-6 xl:col-span-1">
          {/* Profit Margin */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">
              Profit Margin
            </h3>
            <p
              className={`text-5xl font-extrabold ${
                profitMargin >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {pct(profitMargin)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {MONTHS[month]} {year}
            </p>
          </div>

          {/* Income Distribution Pie */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              Income Distribution
            </h3>
            {incomeByCategory.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                No income data for this period.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={incomeByCategory}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={45}
                    paddingAngle={2}
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {incomeByCategory.map((_, idx) => (
                      <Cell
                        key={`ic-${idx}`}
                        fill={INCOME_COLORS[idx % INCOME_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip currency={currency} />} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Expense Distribution Pie */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              Expense Distribution
            </h3>
            {expenseByCategory.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                No expense data for this period.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={45}
                    paddingAngle={2}
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {expenseByCategory.map((_, idx) => (
                      <Cell
                        key={`ec-${idx}`}
                        fill={EXPENSE_COLORS[idx % EXPENSE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip currency={currency} />} />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── right columns: category tables ───────────────── */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:col-span-2">
          {/* Income by Category */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-700">
                Income by Category
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                    <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {incomeByCategory.length === 0 ? (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-5 py-8 text-center text-slate-400"
                      >
                        No income data for this period.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {incomeByCategory.map((row) => (
                        <tr
                          key={row.name}
                          className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors"
                        >
                          <td className="px-5 py-3 text-slate-700">
                            {row.name}
                          </td>
                          <td className="px-5 py-3 text-right font-medium text-green-700">
                            {fmt(row.value, currency)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-green-50 font-semibold">
                        <td className="px-5 py-3 text-slate-800">Total</td>
                        <td className="px-5 py-3 text-right text-green-800">
                          {fmt(totalIncome, currency)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expense by Category */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-700">
                Expense by Category
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-left">
                    <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {expenseByCategory.length === 0 ? (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-5 py-8 text-center text-slate-400"
                      >
                        No expense data for this period.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {expenseByCategory.map((row) => (
                        <tr
                          key={row.name}
                          className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors"
                        >
                          <td className="px-5 py-3 text-slate-700">
                            {row.name}
                          </td>
                          <td className="px-5 py-3 text-right font-medium text-red-700">
                            {fmt(row.value, currency)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-red-50 font-semibold">
                        <td className="px-5 py-3 text-slate-800">Total</td>
                        <td className="px-5 py-3 text-right text-red-800">
                          {fmt(totalExpenses, currency)}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
