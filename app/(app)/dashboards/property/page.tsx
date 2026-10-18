'use client';

import { useMemo, useState } from 'react';
import { useSetupStore, useIncomeStore, useExpenseStore } from '@/lib/store';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';

// ── Color Constants ──────────────────────────────────────────
const BAR_BLUE = '#3b82f6';
const BAR_GREEN = '#22c55e';
const BAR_RED = '#ef4444';

const PIE_COLORS = [
  '#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];

// ── Helpers ──────────────────────────────────────────────────
function fmt(value: number, currency: string): string {
  return `${currency}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function isInRange(dateStr: string, start: string, end: string): boolean {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= start && d <= end;
}

// ── Property‑level aggregated data shape ─────────────────────
interface PropertyData {
  propertyId: string;
  name: string;
  income: number;
  expenses: number;
  profit: number;
  margin: number;
  totalDue: number;
  collected: number;
  outstanding: number;
}

// ── Custom Tooltip for Recharts ──────────────────────────────
interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

function CustomBarTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg text-sm">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {fmt(entry.value, currency)}
        </p>
      ))}
    </div>
  );
}

function CustomPieTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { fill: string } }[];
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg text-sm">
      <p className="font-semibold" style={{ color: item.payload.fill }}>
        {item.name}
      </p>
      <p className="text-slate-600">{fmt(item.value, currency)}</p>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────
export default function PropertyDashboardPage() {
  const { properties, currency } = useSetupStore();
  const { records: incomeRecords } = useIncomeStore();
  const { records: expenseRecords } = useExpenseStore();

  // Date range state — default to the current calendar year
  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-12-31`);

  // ── Filter & aggregate ───────────────────────────────────
  const propertyData: PropertyData[] = useMemo(() => {
    return properties.map((prop) => {
      const filteredIncome = incomeRecords.filter(
        (r) => r.propertyId === prop.id && isInRange(r.rentDueDate, startDate, endDate),
      );
      const filteredExpenses = expenseRecords.filter(
        (r) => r.propertyId === prop.id && isInRange(r.date, startDate, endDate),
      );

      const income = filteredIncome.reduce((sum, r) => sum + r.amountPaid, 0);
      const expenses = filteredExpenses.reduce((sum, r) => sum + r.total, 0);
      const profit = income - expenses;
      const margin = income > 0 ? (profit / income) * 100 : 0;
      const totalDue = filteredIncome.reduce((sum, r) => sum + r.totalDue, 0);
      const collected = income; // sum of amountPaid
      const outstanding = totalDue - collected;

      return {
        propertyId: prop.id,
        name: prop.name,
        income,
        expenses,
        profit,
        margin,
        totalDue,
        collected,
        outstanding,
      };
    });
  }, [properties, incomeRecords, expenseRecords, startDate, endDate]);

  // ── KPI totals ───────────────────────────────────────────
  const totals = useMemo(() => {
    const totalIncome = propertyData.reduce((s, d) => s + d.income, 0);
    const totalExpenses = propertyData.reduce((s, d) => s + d.expenses, 0);
    const profit = totalIncome - totalExpenses;
    const margin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;
    return { totalIncome, totalExpenses, profit, margin };
  }, [propertyData]);

  // ── Chart data ───────────────────────────────────────────
  const barChartData = useMemo(
    () =>
      propertyData.map((d) => ({
        name: d.name,
        Income: d.income,
        Expenses: d.expenses,
        Profit: d.profit,
      })),
    [propertyData],
  );

  const incomePieData = useMemo(
    () =>
      propertyData
        .filter((d) => d.income > 0)
        .map((d) => ({ name: d.name, value: d.income })),
    [propertyData],
  );

  const expensePieData = useMemo(
    () =>
      propertyData
        .filter((d) => d.expenses > 0)
        .map((d) => ({ name: d.name, value: d.expenses })),
    [propertyData],
  );

  // ── Top performers ──────────────────────────────────────
  const topByIncome = useMemo(
    () => [...propertyData].sort((a, b) => b.income - a.income).slice(0, 3),
    [propertyData],
  );
  const topByProfit = useMemo(
    () => [...propertyData].sort((a, b) => b.profit - a.profit).slice(0, 3),
    [propertyData],
  );
  const highestExpenses = useMemo(
    () => [...propertyData].sort((a, b) => b.expenses - a.expenses).slice(0, 3),
    [propertyData],
  );

  // ── Payment status helper ────────────────────────────────
  function paymentStatus(d: PropertyData): string {
    if (d.totalDue === 0) return 'No Activity';
    if (d.outstanding <= 0) return 'Fully Collected';
    if (d.collected > 0) return 'Partially Collected';
    return 'Uncollected';
  }

  function statusColor(status: string): string {
    switch (status) {
      case 'Fully Collected':
        return 'text-green-600 bg-green-50';
      case 'Partially Collected':
        return 'text-amber-600 bg-amber-50';
      case 'Uncollected':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-slate-500 bg-slate-50';
    }
  }

  // ── Overall profit margin for the gauge ──────────────────
  const overallMargin = totals.margin;

  function marginColor(m: number): string {
    if (m >= 50) return 'text-green-600';
    if (m >= 25) return 'text-blue-600';
    if (m >= 0) return 'text-amber-600';
    return 'text-red-600';
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Property Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Overview of income, expenses, and profitability across all properties.</p>
          </div>
        </div>
      </div>

      {/* ── Date Range Picker ─────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="cursor-pointer hover:border-slate-300 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="cursor-pointer hover:border-slate-300 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
          />
        </div>
        <p className="text-xs text-slate-400 self-center">
          Showing data from <span className="font-medium text-slate-600">{startDate}</span> to{' '}
          <span className="font-medium text-slate-600">{endDate}</span>
        </p>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-blue-500">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Income</p>
          <p className="text-2xl font-bold text-blue-700 mt-1.5 tracking-tight">{fmt(totals.totalIncome, currency)}</p>
          <p className="text-xs text-slate-400 mt-1">All properties combined</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-red-500">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Expenses</p>
          <p className="text-2xl font-bold text-red-700 mt-1.5 tracking-tight">{fmt(totals.totalExpenses, currency)}</p>
          <p className="text-xs text-slate-400 mt-1">All properties combined</p>
        </div>
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 ${totals.profit >= 0 ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Profit / Loss</p>
          <p className={`text-2xl font-bold mt-1.5 tracking-tight ${totals.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(totals.profit, currency)}</p>
          <p className="text-xs text-slate-400 mt-1">{totals.profit >= 0 ? 'Net positive' : 'Net negative'}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-amber-500">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Profit Margin</p>
          <p className="text-2xl font-bold text-amber-700 mt-1.5 tracking-tight">{pct(totals.margin)}</p>
          <p className="text-xs text-slate-400 mt-1">Overall margin</p>
        </div>
      </div>

      {/* ── Bar Chart: Income / Expenses / Profit per Property ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">
          Income, Expenses &amp; Profit by Property
        </h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={barChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
            <Tooltip content={<CustomBarTooltip currency={currency} />} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            <Bar dataKey="Income" fill={BAR_BLUE} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Expenses" fill={BAR_RED} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Profit" fill={BAR_GREEN} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Two Tables Side by Side ───────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left Table: Property Data */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Property Data</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Property Name</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Income</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Expenses</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Profit</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Margin (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {propertyData.map((d) => (
                  <tr key={d.propertyId} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-700">{d.name}</td>
                    <td className="px-4 py-3 text-right text-blue-600">{fmt(d.income, currency)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{fmt(d.expenses, currency)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${d.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmt(d.profit, currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{pct(d.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Table: Payment Overview */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Payment Overview</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Property Name</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Amount Due</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Collected</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Outstanding</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {propertyData.map((d) => {
                  const status = paymentStatus(d);
                  return (
                    <tr key={d.propertyId} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-700">{d.name}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(d.totalDue, currency)}</td>
                      <td className="px-4 py-3 text-right text-green-600">{fmt(d.collected, currency)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${d.outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {fmt(d.outstanding, currency)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(status)}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Three Charts on Left Side ─────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Profit Margin Gauge */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col items-center justify-center">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 self-start">Profit Margin</h3>
          <div className="flex flex-col items-center justify-center flex-1 w-full">
            {/* Circular gauge visualization */}
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                {/* Background circle */}
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="#e2e8f0"
                  strokeWidth="10"
                />
                {/* Filled arc */}
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke={overallMargin >= 50 ? '#22c55e' : overallMargin >= 25 ? '#3b82f6' : overallMargin >= 0 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="10"
                  strokeDasharray={`${Math.max(0, Math.min(100, overallMargin)) * 3.267} 326.7`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold ${marginColor(overallMargin)}`}>
                  {pct(overallMargin)}
                </span>
                <span className="text-xs text-slate-400 mt-0.5">Overall</span>
              </div>
            </div>
            {/* Per-property margin list */}
            <div className="mt-4 w-full space-y-2">
              {propertyData.map((d) => (
                <div key={d.propertyId} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 truncate mr-2">{d.name}</span>
                  <span className={`font-medium ${marginColor(d.margin)}`}>{pct(d.margin)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Income Breakdown Pie */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Income Breakdown</h3>
          {incomePieData.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">No income data for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={incomePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                  style={{ fontSize: 11 }}
                >
                  {incomePieData.map((_, index) => (
                    <Cell key={`inc-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip currency={currency} />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Expense Breakdown Pie */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Expense Breakdown</h3>
          {expensePieData.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">No expense data for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={expensePieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                  style={{ fontSize: 11 }}
                >
                  {expensePieData.map((_, index) => (
                    <Cell key={`exp-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip currency={currency} />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Top Performing Properties ─────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top by Income */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Top by Income</h3>
          <div className="space-y-3">
            {topByIncome.map((d, i) => (
              <div key={d.propertyId} className="flex items-center gap-3">
                <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${
                  i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-slate-400' : 'bg-orange-400'
                }`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{d.name}</p>
                  <p className="text-xs text-slate-400">{fmt(d.income, currency)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top by Profit */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Top by Profit</h3>
          <div className="space-y-3">
            {topByProfit.map((d, i) => (
              <div key={d.propertyId} className="flex items-center gap-3">
                <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${
                  i === 0 ? 'bg-green-500' : i === 1 ? 'bg-slate-400' : 'bg-orange-400'
                }`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{d.name}</p>
                  <p className={`text-xs ${d.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {fmt(d.profit, currency)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Highest Expenses */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Highest Expenses</h3>
          <div className="space-y-3">
            {highestExpenses.map((d, i) => (
              <div key={d.propertyId} className="flex items-center gap-3">
                <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${
                  i === 0 ? 'bg-red-500' : i === 1 ? 'bg-slate-400' : 'bg-orange-400'
                }`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{d.name}</p>
                  <p className="text-xs text-red-500">{fmt(d.expenses, currency)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
