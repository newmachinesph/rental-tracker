'use client';

import { useMemo, useState } from 'react';


import { useSetupStore, useIncomeStore, useExpenseStore } from '@/lib/store';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmt(value: number, currency: string): string {
  return `${currency}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getDefaultDateRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear(), 11, 31);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface UnitBreakdown {
  unitId: string;
  unitNumber: string;
  propertyId: string;
  propertyName: string;
  income: number;
  expenses: number;
  profit: number;
  margin: number;
}

interface UnitPayment {
  unitId: string;
  unitNumber: string;
  propertyId: string;
  propertyName: string;
  totalDue: number;
  collected: number;
  outstanding: number;
  status: string;
}

/* ------------------------------------------------------------------ */
/*  Bar chart colors                                                   */
/* ------------------------------------------------------------------ */

const CHART_COLORS = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#06b6d4', '#8b5cf6'];
const PIE_COLORS = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6'];

/* ================================================================== */
/*  Component                                                          */
/* ================================================================== */

export default function UnitDashboard() {
  const { properties, units, currency } = useSetupStore();
  const incomeRecords = useIncomeStore((s) => s.records);
  const expenseRecords = useExpenseStore((s) => s.records);

  const defaults = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);

  /* ---------------------------------------------------------------- */
  /*  Filtered records                                                 */
  /* ---------------------------------------------------------------- */

  const filteredIncome = useMemo(
    () =>
      incomeRecords.filter((r) => {
        const d = r.rentDueDate;
        return d >= startDate && d <= endDate;
      }),
    [incomeRecords, startDate, endDate],
  );

  const filteredExpenses = useMemo(
    () =>
      expenseRecords.filter((r) => {
        const d = r.date;
        return d >= startDate && d <= endDate;
      }),
    [expenseRecords, startDate, endDate],
  );

  /* ---------------------------------------------------------------- */
  /*  Build per-unit map for income                                    */
  /* ---------------------------------------------------------------- */

  const unitMap = useMemo(() => {
    const map = new Map<
      string,
      { income: number; expenses: number; totalDue: number; collected: number; outstanding: number }
    >();

    const ensureUnit = (uid: string) => {
      if (!map.has(uid)) {
        map.set(uid, { income: 0, expenses: 0, totalDue: 0, collected: 0, outstanding: 0 });
      }
      return map.get(uid)!;
    };

    // Seed every unit so we always show all units in tables
    for (const u of units) {
      ensureUnit(u.id);
    }

    // Aggregate income per unit
    for (const rec of filteredIncome) {
      const entry = ensureUnit(rec.unitId);
      entry.income += rec.amountPaid;
      entry.totalDue += rec.totalDue;
      entry.collected += rec.amountPaid;
      entry.outstanding += Math.max(0, rec.outstandingBalance);
    }

    // Aggregate expenses per unit
    for (const exp of filteredExpenses) {
      if (exp.appliesToEntireBuilding) {
        // Distribute evenly across all units of that property
        const propertyUnits = units.filter((u) => u.propertyId === exp.propertyId);
        const share = propertyUnits.length > 0 ? exp.total / propertyUnits.length : 0;
        for (const pu of propertyUnits) {
          const entry = ensureUnit(pu.id);
          entry.expenses += share;
        }
      } else {
        // Assign to that specific unit
        const entry = ensureUnit(exp.unitId);
        entry.expenses += exp.total;
      }
    }

    return map;
  }, [filteredIncome, filteredExpenses, units]);

  /* ---------------------------------------------------------------- */
  /*  Build breakdown rows                                             */
  /* ---------------------------------------------------------------- */

  const breakdowns: UnitBreakdown[] = useMemo(() => {
    const rows: UnitBreakdown[] = [];
    for (const u of units) {
      const data = unitMap.get(u.id);
      if (!data) continue;
      const property = properties.find((p) => p.id === u.propertyId);
      const profit = data.income - data.expenses;
      const margin = data.income > 0 ? (profit / data.income) * 100 : 0;
      rows.push({
        unitId: u.id,
        unitNumber: u.unitNumber,
        propertyId: u.propertyId,
        propertyName: property?.name ?? 'Unknown',
        income: data.income,
        expenses: data.expenses,
        profit,
        margin,
      });
    }
    return rows.sort((a, b) => b.income - a.income);
  }, [units, unitMap, properties]);

  /* ---------------------------------------------------------------- */
  /*  Payment overview rows                                            */
  /* ---------------------------------------------------------------- */

  const payments: UnitPayment[] = useMemo(() => {
    const rows: UnitPayment[] = [];
    for (const u of units) {
      const data = unitMap.get(u.id);
      if (!data) continue;
      const property = properties.find((p) => p.id === u.propertyId);
      let status = 'No Activity';
      if (data.totalDue > 0) {
        if (data.outstanding <= 0) {
          status = 'Fully Collected';
        } else if (data.collected > 0) {
          status = 'Partially Collected';
        } else {
          status = 'Uncollected';
        }
      }
      rows.push({
        unitId: u.id,
        unitNumber: u.unitNumber,
        propertyId: u.propertyId,
        propertyName: property?.name ?? 'Unknown',
        totalDue: data.totalDue,
        collected: data.collected,
        outstanding: data.outstanding,
        status,
      });
    }
    return rows;
  }, [units, unitMap, properties]);

  /* ---------------------------------------------------------------- */
  /*  KPIs                                                             */
  /* ---------------------------------------------------------------- */

  const totalIncome = useMemo(() => breakdowns.reduce((s, r) => s + r.income, 0), [breakdowns]);
  const totalExpenses = useMemo(() => breakdowns.reduce((s, r) => s + r.expenses, 0), [breakdowns]);
  const profitLoss = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? (profitLoss / totalIncome) * 100 : 0;

  /* ---------------------------------------------------------------- */
  /*  Top performing units                                             */
  /* ---------------------------------------------------------------- */

  const topIncome = useMemo(() => {
    const sorted = [...breakdowns].sort((a, b) => b.income - a.income);
    return sorted[0] ?? null;
  }, [breakdowns]);

  const topProfit = useMemo(() => {
    const sorted = [...breakdowns].sort((a, b) => b.profit - a.profit);
    return sorted[0] ?? null;
  }, [breakdowns]);

  const topExpenses = useMemo(() => {
    const sorted = [...breakdowns].sort((a, b) => b.expenses - a.expenses);
    return sorted[0] ?? null;
  }, [breakdowns]);

  /* ---------------------------------------------------------------- */
  /*  Chart data                                                       */
  /* ---------------------------------------------------------------- */

  const barChartData = useMemo(() => {
    return breakdowns
      .filter((b) => b.income > 0 || b.expenses > 0)
      .slice(0, 15)
      .map((b) => ({
        name: `${b.propertyName.slice(0, 10)}.. #${b.unitNumber}`,
        Income: Math.round(b.income),
        Expenses: Math.round(b.expenses),
        Profit: Math.round(b.profit),
      }));
  }, [breakdowns]);

  const incomeDistPie = useMemo(() => {
    return breakdowns
      .filter((b) => b.income > 0)
      .map((b) => ({
        name: `${b.propertyName.slice(0, 12)} #${b.unitNumber}`,
        value: Math.round(b.income),
      }));
  }, [breakdowns]);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Unit Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Financial performance breakdown for each individual unit across all properties.</p>
          </div>
        </div>
      </div>

      {/* ── Date range filters ────────────────────────────────── */}
      <div className="mb-8 flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="cursor-pointer hover:border-slate-300 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="cursor-pointer hover:border-slate-300 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
          />
        </div>
        <button
          onClick={() => {
            const d = getDefaultDateRange();
            setStartDate(d.start);
            setEndDate(d.end);
          }}
          className="cursor-pointer rounded-md bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 transition-colors"
        >
          Reset
        </button>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-blue-500">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Income</p>
          <p className="text-2xl font-bold text-blue-700 mt-1.5 tracking-tight">{fmt(totalIncome, currency)}</p>
          <p className="text-xs text-slate-400 mt-1">All units combined</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-red-500">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Expenses</p>
          <p className="text-2xl font-bold text-red-700 mt-1.5 tracking-tight">{fmt(totalExpenses, currency)}</p>
          <p className="text-xs text-slate-400 mt-1">Including distributed building costs</p>
        </div>
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 ${profitLoss >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Profit / Loss</p>
          <p className={`text-2xl font-bold mt-1.5 tracking-tight ${profitLoss >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(profitLoss, currency)}</p>
          <p className="text-xs text-slate-400 mt-1">{profitLoss >= 0 ? 'Net positive' : 'Net negative'}</p>
        </div>
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 ${profitMargin >= 30 ? 'border-l-green-500' : profitMargin >= 0 ? 'border-l-amber-500' : 'border-l-red-500'}`}>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Profit Margin</p>
          <p className={`text-2xl font-bold mt-1.5 tracking-tight ${profitMargin >= 30 ? 'text-green-700' : profitMargin >= 0 ? 'text-amber-700' : 'text-red-700'}`}>{pct(profitMargin)}</p>
          <p className="text-xs text-slate-400 mt-1">Income-based margin</p>
        </div>
      </div>

      {/* ── Charts ────────────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Bar chart: Income vs Expenses vs Profit per Unit */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-700">Income vs Expenses by Unit</h2>
          {barChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={barChartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(value) => fmt(Number(value ?? 0), currency)}
                  contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0' }}
                />
                <Legend wrapperStyle={{ paddingTop: 8 }} />
                <Bar dataKey="Income" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Profit" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-16 text-center text-sm text-slate-400">No data in selected range.</p>
          )}
        </div>

        {/* Pie chart: Income Distribution */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-700">Income Distribution by Unit</h2>
          {incomeDistPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={340}>
              <PieChart>
                <Pie
                  data={incomeDistPie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  labelLine={true}
                >
                  {incomeDistPie.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => fmt(Number(value ?? 0), currency)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-16 text-center text-sm text-slate-400">No income data in selected range.</p>
          )}
        </div>
      </div>

      {/* ── Detailed Breakdown Table ──────────────────────────── */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-700">Detailed Breakdown per Unit</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-5 py-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Property</th>
                <th className="px-5 py-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Unit</th>
                <th className="px-5 py-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Income</th>
                <th className="px-5 py-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Expenses</th>
                <th className="px-5 py-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Profit</th>
                <th className="px-5 py-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Margin (%)</th>
              </tr>
            </thead>
            <tbody>
              {breakdowns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    No data in selected range.
                  </td>
                </tr>
              ) : (
                breakdowns.map((row) => (
                  <tr
                    key={row.unitId}
                    className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3 font-medium text-slate-700">{row.propertyName}</td>
                    <td className="px-5 py-3 text-slate-600">#{row.unitNumber}</td>
                    <td className="px-5 py-3 text-right font-medium text-blue-600">
                      {fmt(row.income, currency)}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-red-600">
                      {fmt(row.expenses, currency)}
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-semibold ${
                        row.profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {fmt(row.profit, currency)}
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-medium ${
                        row.margin >= 30
                          ? 'text-green-600'
                          : row.margin >= 0
                          ? 'text-amber-600'
                          : 'text-red-600'
                      }`}
                    >
                      {pct(row.margin)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {breakdowns.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <td className="px-5 py-3 text-slate-700" colSpan={2}>
                    Totals
                  </td>
                  <td className="px-5 py-3 text-right text-blue-700">{fmt(totalIncome, currency)}</td>
                  <td className="px-5 py-3 text-right text-red-700">{fmt(totalExpenses, currency)}</td>
                  <td
                    className={`px-5 py-3 text-right ${
                      profitLoss >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {fmt(profitLoss, currency)}
                  </td>
                  <td
                    className={`px-5 py-3 text-right ${
                      profitMargin >= 30
                        ? 'text-green-700'
                        : profitMargin >= 0
                        ? 'text-amber-700'
                        : 'text-red-700'
                    }`}
                  >
                    {pct(profitMargin)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Payment Overview Table ────────────────────────────── */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-700">Payment Overview</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-5 py-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Property</th>
                <th className="px-5 py-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Unit</th>
                <th className="px-5 py-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Amount Due</th>
                <th className="px-5 py-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Collected</th>
                <th className="px-5 py-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Outstanding</th>
                <th className="px-5 py-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    No payment data in selected range.
                  </td>
                </tr>
              ) : (
                payments.map((row) => (
                  <tr
                    key={row.unitId}
                    className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3 font-medium text-slate-700">{row.propertyName}</td>
                    <td className="px-5 py-3 text-slate-600">#{row.unitNumber}</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-700">
                      {fmt(row.totalDue, currency)}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-green-600">
                      {fmt(row.collected, currency)}
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-medium ${
                        row.outstanding > 0 ? 'text-red-600' : 'text-slate-500'
                      }`}
                    >
                      {fmt(row.outstanding, currency)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          row.status === 'Fully Collected'
                            ? 'bg-green-100 text-green-700'
                            : row.status === 'Partially Collected'
                            ? 'bg-amber-100 text-amber-700'
                            : row.status === 'Uncollected'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Top Performing Units ──────────────────────────────── */}
      <div className="mb-8 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-700">Top Performing Units</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-3">
          {/* Highest Income */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-500">
              Highest Income
            </div>
            {topIncome ? (
              <>
                <div className="text-lg font-bold text-blue-800">
                  {topIncome.propertyName} #{topIncome.unitNumber}
                </div>
                <div className="mt-1 text-2xl font-bold text-blue-600">
                  {fmt(topIncome.income, currency)}
                </div>
                <div className="mt-1 text-xs text-blue-400">
                  Margin: {pct(topIncome.margin)}
                </div>
              </>
            ) : (
              <div className="text-sm text-blue-400">No data available</div>
            )}
          </div>

          {/* Highest Profit */}
          <div className="rounded-xl border border-green-200 bg-green-50 p-5">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-green-500">
              Highest Profit
            </div>
            {topProfit ? (
              <>
                <div className="text-lg font-bold text-green-800">
                  {topProfit.propertyName} #{topProfit.unitNumber}
                </div>
                <div className="mt-1 text-2xl font-bold text-green-600">
                  {fmt(topProfit.profit, currency)}
                </div>
                <div className="mt-1 text-xs text-green-400">
                  Margin: {pct(topProfit.margin)}
                </div>
              </>
            ) : (
              <div className="text-sm text-green-400">No data available</div>
            )}
          </div>

          {/* Highest Expenses */}
          <div className="rounded-xl border border-red-200 bg-red-50 p-5">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-red-500">
              Highest Expenses
            </div>
            {topExpenses ? (
              <>
                <div className="text-lg font-bold text-red-800">
                  {topExpenses.propertyName} #{topExpenses.unitNumber}
                </div>
                <div className="mt-1 text-2xl font-bold text-red-600">
                  {fmt(topExpenses.expenses, currency)}
                </div>
                <div className="mt-1 text-xs text-red-400">
                  Profit: {fmt(topExpenses.profit, currency)}
                </div>
              </>
            ) : (
              <div className="text-sm text-red-400">No data available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
