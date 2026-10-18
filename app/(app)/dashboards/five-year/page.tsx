'use client';

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import { parseISO, getYear, getMonth } from 'date-fns';



import {
  useSetupStore,
  useIncomeStore,
  useExpenseStore,
  useMileageStore,
} from '@/lib/store';

// ─── Constants ──────────────────────────────────────────────
const COLORS = {
  income: '#3b82f6',
  expense: '#ef4444',
  profit: '#22c55e',
};

const PIE_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// ─── Helpers ────────────────────────────────────────────────
function fmt(value: number, currency: string): string {
  return `${currency}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Check whether a date string falls within a specific year range.
 * The range is defined by startYear/startMonth through 5 full years.
 * For simplicity in a year-by-year breakdown, we bucket by calendar year.
 */
function getYearFromDate(dateStr: string): number {
  if (!dateStr) return -1;
  const d = parseISO(dateStr);
  return getYear(d);
}

function getMonthFromDate(dateStr: string): number {
  if (!dateStr) return -1;
  const d = parseISO(dateStr);
  return getMonth(d); // 0-indexed
}

/**
 * Determine whether a record falls into a given fiscal year bucket.
 * A fiscal year starts on startMonth of that year and ends the month before startMonth of the next year.
 */
function isInFiscalYear(
  dateStr: string,
  fiscalYearStart: number,
  startMonth: number,
): boolean {
  if (!dateStr) return false;
  const year = getYearFromDate(dateStr);
  const month = getMonthFromDate(dateStr);
  if (startMonth === 0) {
    // January start = calendar year
    return year === fiscalYearStart;
  }
  // Fiscal year: from startMonth of fiscalYearStart to startMonth-1 of fiscalYearStart+1
  if (year === fiscalYearStart && month >= startMonth) return true;
  if (year === fiscalYearStart + 1 && month < startMonth) return true;
  return false;
}

// ─── Component ──────────────────────────────────────────────
export default function FiveYearDashboard() {
  const { properties, units, incomeCategories, expenseCategories, currency } =
    useSetupStore();
  const { records: incomeRecords } = useIncomeStore();
  const { records: expenseRecords } = useExpenseStore();
  const { logs: mileageLogs } = useMileageStore();

  // ── Filters ─────────────────────────────────────────────
  const [startYear, setStartYear] = useState<number>(2025);
  const [startMonth, setStartMonth] = useState<number>(0); // 0-indexed (January)
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [unitFilter, setUnitFilter] = useState<string>('all');

  const filteredUnits = useMemo(
    () =>
      propertyFilter === 'all'
        ? units
        : units.filter((u) => u.propertyId === propertyFilter),
    [propertyFilter, units],
  );

  // Build the 5 fiscal year labels
  const yearLabels = useMemo(() => {
    const labels: string[] = [];
    for (let i = 0; i < 5; i++) {
      const y = startYear + i;
      if (startMonth === 0) {
        labels.push(`${y}`);
      } else {
        labels.push(`${MONTHS[startMonth].slice(0, 3)} ${y} - ${MONTHS[startMonth === 0 ? 11 : startMonth - 1].slice(0, 3)} ${y + 1}`);
      }
    }
    return labels;
  }, [startYear, startMonth]);

  // ── Filtered records based on property / unit ───────────
  const filteredIncome = useMemo(() => {
    let recs = incomeRecords;
    if (propertyFilter !== 'all') {
      recs = recs.filter((r) => r.propertyId === propertyFilter);
      if (unitFilter !== 'all') {
        recs = recs.filter((r) => r.unitId === unitFilter);
      }
    }
    return recs;
  }, [incomeRecords, propertyFilter, unitFilter]);

  const filteredExpenses = useMemo(() => {
    let recs = expenseRecords;
    if (propertyFilter !== 'all') {
      recs = recs.filter((r) => {
        if (r.propertyId !== propertyFilter) return false;
        if (unitFilter !== 'all') {
          return r.appliesToEntireBuilding || r.unitId === unitFilter;
        }
        return true;
      });
    }
    return recs;
  }, [expenseRecords, propertyFilter, unitFilter]);

  const filteredMileage = useMemo(() => {
    let logs = mileageLogs;
    if (propertyFilter !== 'all') {
      logs = logs.filter((l) => l.propertyId === propertyFilter);
    }
    return logs;
  }, [mileageLogs, propertyFilter]);

  // ── Yearly aggregation ──────────────────────────────────
  const yearlyData = useMemo(() => {
    const data: {
      label: string;
      year: number;
      income: number;
      expenses: number;
      profit: number;
      margin: number;
      mileage: number;
      incomeByCategory: Record<string, number>;
      expenseByCategory: Record<string, number>;
    }[] = [];

    for (let i = 0; i < 5; i++) {
      const fiscalYear = startYear + i;
      const label = yearLabels[i];

      // Income for this fiscal year
      const yearIncome = filteredIncome.filter((r) =>
        isInFiscalYear(r.rentDueDate, fiscalYear, startMonth),
      );
      const totalIncome = yearIncome.reduce((s, r) => s + r.amountPaid, 0);

      // Expenses for this fiscal year
      const yearExpenses = filteredExpenses.filter((r) =>
        isInFiscalYear(r.date, fiscalYear, startMonth),
      );
      const totalExpenses = yearExpenses.reduce((s, r) => s + r.total, 0);

      // Mileage for this fiscal year
      const yearMileage = filteredMileage.filter((l) =>
        isInFiscalYear(l.date, fiscalYear, startMonth),
      );
      const totalMileage = yearMileage.reduce((s, l) => s + l.amount, 0);

      const profit = totalIncome - totalExpenses;
      const margin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;

      // Income by category
      const incomeByCategory: Record<string, number> = {};
      yearIncome.forEach((r) => {
        incomeByCategory[r.category] =
          (incomeByCategory[r.category] || 0) + r.amountPaid;
      });

      // Expenses by category
      const expenseByCategory: Record<string, number> = {};
      yearExpenses.forEach((r) => {
        expenseByCategory[r.category] =
          (expenseByCategory[r.category] || 0) + r.total;
      });

      data.push({
        label,
        year: fiscalYear,
        income: totalIncome,
        expenses: totalExpenses,
        profit,
        margin,
        mileage: totalMileage,
        incomeByCategory,
        expenseByCategory,
      });
    }
    return data;
  }, [
    startYear,
    startMonth,
    yearLabels,
    filteredIncome,
    filteredExpenses,
    filteredMileage,
  ]);

  // ── Totals across entire 5-year period ──────────────────
  const totals = useMemo(() => {
    const totalIncome = yearlyData.reduce((s, y) => s + y.income, 0);
    const totalExpenses = yearlyData.reduce((s, y) => s + y.expenses, 0);
    const totalMileage = yearlyData.reduce((s, y) => s + y.mileage, 0);
    const profit = totalIncome - totalExpenses;
    const margin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;
    return { totalIncome, totalExpenses, totalMileage, profit, margin };
  }, [yearlyData]);

  // ── Chart data for profit trend ─────────────────────────
  const profitTrendData = useMemo(
    () =>
      yearlyData.map((y) => ({
        name: y.label,
        profit: y.profit,
      })),
    [yearlyData],
  );

  // ── Chart data for combined income/expenses/profit ──────
  const combinedChartData = useMemo(
    () =>
      yearlyData.map((y) => ({
        name: y.label,
        Income: y.income,
        Expenses: y.expenses,
        Profit: y.profit,
      })),
    [yearlyData],
  );

  // ── Income category aggregation across all 5 years ──────
  const incomeCategoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    yearlyData.forEach((y) => {
      Object.entries(y.incomeByCategory).forEach(([cat, val]) => {
        totals[cat] = (totals[cat] || 0) + val;
      });
    });
    return totals;
  }, [yearlyData]);

  const incomePieData = useMemo(
    () =>
      Object.entries(incomeCategoryTotals)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
    [incomeCategoryTotals],
  );

  // ── Expense category aggregation across all 5 years ─────
  const expenseCategoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    yearlyData.forEach((y) => {
      Object.entries(y.expenseByCategory).forEach(([cat, val]) => {
        totals[cat] = (totals[cat] || 0) + val;
      });
    });
    return totals;
  }, [yearlyData]);

  const expensePieData = useMemo(
    () =>
      Object.entries(expenseCategoryTotals)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
    [expenseCategoryTotals],
  );

  // ── Income category table rows (category x year) ────────
  const allUsedIncomeCategories = useMemo(() => {
    const cats = new Set<string>();
    yearlyData.forEach((y) =>
      Object.keys(y.incomeByCategory).forEach((c) => cats.add(c)),
    );
    return Array.from(cats).sort();
  }, [yearlyData]);

  const allUsedExpenseCategories = useMemo(() => {
    const cats = new Set<string>();
    yearlyData.forEach((y) =>
      Object.keys(y.expenseByCategory).forEach((c) => cats.add(c)),
    );
    return Array.from(cats).sort();
  }, [yearlyData]);

  // ─── Render ─────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <div className="animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Five-Year Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Long-term financial overview across a 5-year period</p>
          </div>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        {/* Start Year */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Start Year
          </label>
          <input
            type="number"
            value={startYear}
            onChange={(e) => setStartYear(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
            min={2000}
            max={2099}
          />
        </div>

        {/* Start Month */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Start Month
          </label>
          <select
            value={startMonth}
            onChange={(e) => setStartMonth(Number(e.target.value))}
            className="cursor-pointer w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {/* Property Filter */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Property
          </label>
          <select
            value={propertyFilter}
            onChange={(e) => {
              setPropertyFilter(e.target.value);
              setUnitFilter('all');
            }}
            className="cursor-pointer w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
          >
            <option value="all">All Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Unit Filter */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Unit
          </label>
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            disabled={propertyFilter === 'all'}
            className="cursor-pointer w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            <option value="all">All Units</option>
            {filteredUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.unitNumber}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-blue-500">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Income</p>
          <p className="text-2xl font-bold text-blue-700 mt-1.5 tracking-tight">{fmt(totals.totalIncome, currency)}</p>
          <p className="text-xs text-slate-400 mt-1">{`Over ${yearLabels[0]} - ${yearLabels[4]}`}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-red-500">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Expenses</p>
          <p className="text-2xl font-bold text-red-700 mt-1.5 tracking-tight">{fmt(totals.totalExpenses, currency)}</p>
          <p className="text-xs text-slate-400 mt-1">{`Over ${yearLabels[0]} - ${yearLabels[4]}`}</p>
        </div>
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 ${totals.profit >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Profit / Loss</p>
          <p className={`text-2xl font-bold mt-1.5 tracking-tight ${totals.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(totals.profit, currency)}</p>
          <p className="text-xs text-slate-400 mt-1">{`Margin: ${totals.margin.toFixed(1)}%`}</p>
        </div>
      </div>

      {/* ── Section 1: Profit Overview ───────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-6">
        <h2 className="text-lg font-semibold text-slate-800">
          Profit Overview
        </h2>

        {/* Profit Margin - Large Display */}
        <div className="text-center py-4">
          <div className="text-sm font-medium text-slate-500 mb-1">
            Overall Profit Margin
          </div>
          <div
            className={`text-5xl font-bold ${totals.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}
          >
            {totals.margin.toFixed(1)}%
          </div>
        </div>

        {/* Yearly Profit Trend Line Chart */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Yearly Profit Trend
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={profitTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => fmt(Number(value ?? 0), currency)}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="profit"
                name="Profit"
                stroke={COLORS.profit}
                strokeWidth={3}
                dot={{ r: 5, fill: COLORS.profit }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Combined Chart: Income (bar) + Expenses (bar) + Profit (line) */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Income, Expenses &amp; Profit by Year
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={combinedChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value) => fmt(Number(value ?? 0), currency)}
              />
              <Legend />
              <Bar
                dataKey="Income"
                fill={COLORS.income}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="Expenses"
                fill={COLORS.expense}
                radius={[4, 4, 0, 0]}
              />
              <Line
                type="monotone"
                dataKey="Profit"
                stroke={COLORS.profit}
                strokeWidth={3}
                dot={{ r: 5, fill: COLORS.profit }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Yearly Summary Table */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Yearly Summary
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Year
                  </th>
                  <th className="text-right py-2 px-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Income
                  </th>
                  <th className="text-right py-2 px-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Expenses
                  </th>
                  <th className="text-right py-2 px-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Profit
                  </th>
                  <th className="text-right py-2 px-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Margin (%)
                  </th>
                </tr>
              </thead>
              <tbody>
                {yearlyData.map((y) => (
                  <tr
                    key={y.label}
                    className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors"
                  >
                    <td className="py-2 px-3 font-medium text-slate-700">
                      {y.label}
                    </td>
                    <td className="py-2 px-3 text-right text-blue-600">
                      {fmt(y.income, currency)}
                    </td>
                    <td className="py-2 px-3 text-right text-red-600">
                      {fmt(y.expenses, currency)}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-semibold ${y.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {fmt(y.profit, currency)}
                    </td>
                    <td
                      className={`py-2 px-3 text-right ${y.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {y.margin.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <td className="py-2 px-3 text-slate-700">Total</td>
                  <td className="py-2 px-3 text-right text-blue-600">
                    {fmt(totals.totalIncome, currency)}
                  </td>
                  <td className="py-2 px-3 text-right text-red-600">
                    {fmt(totals.totalExpenses, currency)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right ${totals.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {fmt(totals.profit, currency)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right ${totals.margin >= 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {totals.margin.toFixed(1)}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* ── Section 2: Income Detail ─────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-6">
        <h2 className="text-lg font-semibold text-slate-800">
          Income Detail
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Income Category x Year Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Category
                  </th>
                  {yearlyData.map((y) => (
                    <th
                      key={y.label}
                      className="text-right py-2 px-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider"
                    >
                      {y.label}
                    </th>
                  ))}
                  <th className="text-right py-2 px-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {allUsedIncomeCategories.map((cat) => {
                  const catTotal = yearlyData.reduce(
                    (s, y) => s + (y.incomeByCategory[cat] || 0),
                    0,
                  );
                  return (
                    <tr
                      key={cat}
                      className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors"
                    >
                      <td className="py-2 px-3 font-medium text-slate-700">
                        {cat}
                      </td>
                      {yearlyData.map((y) => (
                        <td
                          key={y.label}
                          className="py-2 px-3 text-right text-slate-600"
                        >
                          {fmt(y.incomeByCategory[cat] || 0, currency)}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-semibold text-blue-600">
                        {fmt(catTotal, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <td className="py-2 px-3 text-slate-700">Total</td>
                  {yearlyData.map((y) => (
                    <td
                      key={y.label}
                      className="py-2 px-3 text-right text-blue-600"
                    >
                      {fmt(y.income, currency)}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right text-blue-600">
                    {fmt(totals.totalIncome, currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Income Pie Chart */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 text-center">
              Income Distribution by Category
            </h3>
            {incomePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={incomePieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {incomePieData.map((_, idx) => (
                      <Cell
                        key={`inc-${idx}`}
                        fill={PIE_COLORS[idx % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => fmt(Number(value ?? 0), currency)}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">
                No income data for this period
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 3: Expense Detail ────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-6">
        <h2 className="text-lg font-semibold text-slate-800">
          Expense Detail
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Expense Category x Year Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Category
                  </th>
                  {yearlyData.map((y) => (
                    <th
                      key={y.label}
                      className="text-right py-2 px-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider"
                    >
                      {y.label}
                    </th>
                  ))}
                  <th className="text-right py-2 px-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {allUsedExpenseCategories.map((cat) => {
                  const catTotal = yearlyData.reduce(
                    (s, y) => s + (y.expenseByCategory[cat] || 0),
                    0,
                  );
                  return (
                    <tr
                      key={cat}
                      className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors"
                    >
                      <td className="py-2 px-3 font-medium text-slate-700">
                        {cat}
                      </td>
                      {yearlyData.map((y) => (
                        <td
                          key={y.label}
                          className="py-2 px-3 text-right text-slate-600"
                        >
                          {fmt(y.expenseByCategory[cat] || 0, currency)}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right font-semibold text-red-600">
                        {fmt(catTotal, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <td className="py-2 px-3 text-slate-700">Total</td>
                  {yearlyData.map((y) => (
                    <td
                      key={y.label}
                      className="py-2 px-3 text-right text-red-600"
                    >
                      {fmt(y.expenses, currency)}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right text-red-600">
                    {fmt(totals.totalExpenses, currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Expense Pie Chart */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3 text-center">
              Expense Distribution by Category
            </h3>
            {expensePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expensePieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {expensePieData.map((_, idx) => (
                      <Cell
                        key={`exp-${idx}`}
                        fill={PIE_COLORS[idx % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => fmt(Number(value ?? 0), currency)}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">
                No expense data for this period
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 4: Cash Flow Summary ─────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          Cash Flow Summary
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-3 px-3 font-medium text-slate-700">
                  Total Income
                </td>
                <td className="py-3 px-3 text-right text-blue-600 font-semibold text-lg">
                  {fmt(totals.totalIncome, currency)}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 px-3 font-medium text-slate-700">
                  Total Expenses
                </td>
                <td className="py-3 px-3 text-right text-red-600 font-semibold text-lg">
                  {fmt(totals.totalExpenses, currency)}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 px-3 font-medium text-slate-700">
                  Mileage Costs
                </td>
                <td className="py-3 px-3 text-right text-amber-600 font-semibold text-lg">
                  {fmt(totals.totalMileage, currency)}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-3 px-3 font-medium text-slate-700">
                  Total Expenses (incl. Mileage)
                </td>
                <td className="py-3 px-3 text-right text-red-600 font-semibold text-lg">
                  {fmt(totals.totalExpenses + totals.totalMileage, currency)}
                </td>
              </tr>
              <tr className="bg-slate-50">
                <td className="py-3 px-3 font-bold text-slate-800 text-base">
                  Net Profit
                </td>
                <td
                  className={`py-3 px-3 text-right font-bold text-xl ${
                    totals.totalIncome -
                      totals.totalExpenses -
                      totals.totalMileage >=
                    0
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {fmt(
                    totals.totalIncome -
                      totals.totalExpenses -
                      totals.totalMileage,
                    currency,
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
