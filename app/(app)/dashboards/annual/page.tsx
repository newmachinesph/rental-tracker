'use client';

import { useState, useMemo } from 'react';
import {
  format,
  parse,
  addMonths,
  isWithinInterval,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
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


import {
  useSetupStore,
  useIncomeStore,
  useExpenseStore,
  useMileageStore,
} from '@/lib/store';

// ─── Color Constants ─────────────────────────────────────────
const BLUE = '#3b82f6';
const RED = '#ef4444';
const GREEN = '#22c55e';

const PIE_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#06b6d4', '#e11d48',
];

const MONTHS_LIST = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── Helpers ─────────────────────────────────────────────────
function fmt(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtCurrency(n: number, currency: string): string {
  return `${currency}${fmt(n)}`;
}

// ─── Main Component ──────────────────────────────────────────
export default function AnnualDashboardPage() {
  // ── Store data ───────────────────────────────────────────
  const { currency, properties, units } = useSetupStore();
  const incomeRecords = useIncomeStore((s) => s.records);
  const expenseRecords = useExpenseStore((s) => s.records);
  const mileageLogs = useMileageStore((s) => s.logs);

  // ── Filter state ─────────────────────────────────────────
  const [startYear, setStartYear] = useState(2025);
  const [startMonth, setStartMonth] = useState(0); // 0 = January
  const [selectedPropertyId, setSelectedPropertyId] = useState('all');
  const [selectedUnitId, setSelectedUnitId] = useState('all');

  // ── Derived: units for selected property ─────────────────
  const filteredUnits = useMemo(() => {
    if (selectedPropertyId === 'all') return [];
    return units.filter((u) => u.propertyId === selectedPropertyId);
  }, [selectedPropertyId, units]);

  // Reset unit when property changes
  const handlePropertyChange = (propId: string) => {
    setSelectedPropertyId(propId);
    setSelectedUnitId('all');
  };

  // ── Build 12-month windows ───────────────────────────────
  const monthWindows = useMemo(() => {
    const windows: { start: Date; end: Date; label: string; shortLabel: string }[] = [];
    const base = new Date(startYear, startMonth, 1);
    for (let i = 0; i < 12; i++) {
      const monthStart = startOfMonth(addMonths(base, i));
      const monthEnd = endOfMonth(monthStart);
      windows.push({
        start: monthStart,
        end: monthEnd,
        label: format(monthStart, 'MMMM yyyy'),
        shortLabel: format(monthStart, 'MMM yy'),
      });
    }
    return windows;
  }, [startYear, startMonth]);

  // ── Filter records by property/unit ──────────────────────
  const filteredIncome = useMemo(() => {
    return incomeRecords.filter((r) => {
      if (selectedPropertyId !== 'all' && r.propertyId !== selectedPropertyId) return false;
      if (selectedUnitId !== 'all' && r.unitId !== selectedUnitId) return false;
      return true;
    });
  }, [incomeRecords, selectedPropertyId, selectedUnitId]);

  const filteredExpenses = useMemo(() => {
    return expenseRecords.filter((r) => {
      if (selectedPropertyId !== 'all' && r.propertyId !== selectedPropertyId) return false;
      if (selectedUnitId !== 'all') {
        if (r.appliesToEntireBuilding) return true;
        if (r.unitId !== selectedUnitId) return false;
      }
      return true;
    });
  }, [expenseRecords, selectedPropertyId, selectedUnitId]);

  const filteredMileage = useMemo(() => {
    return mileageLogs.filter((l) => {
      if (selectedPropertyId !== 'all' && l.propertyId !== selectedPropertyId) return false;
      return true;
    });
  }, [mileageLogs, selectedPropertyId]);

  // ── Aggregate monthly data ───────────────────────────────
  const monthlyData = useMemo(() => {
    return monthWindows.map((w) => {
      const monthIncome = filteredIncome.filter((r) => {
        const d = parse(r.rentDueDate, 'yyyy-MM-dd', new Date());
        return isWithinInterval(d, { start: w.start, end: w.end });
      });
      const monthExpense = filteredExpenses.filter((r) => {
        const d = parse(r.date, 'yyyy-MM-dd', new Date());
        return isWithinInterval(d, { start: w.start, end: w.end });
      });
      const monthMileage = filteredMileage.filter((l) => {
        const d = parse(l.date, 'yyyy-MM-dd', new Date());
        return isWithinInterval(d, { start: w.start, end: w.end });
      });

      const income = monthIncome.reduce((s, r) => s + r.amountPaid, 0);
      const expenses = monthExpense.reduce((s, r) => s + r.total, 0);
      const mileage = monthMileage.reduce((s, l) => s + l.amount, 0);
      const totalExpenses = expenses + mileage;
      const profit = income - totalExpenses;

      return {
        label: w.label,
        shortLabel: w.shortLabel,
        income,
        expenses: totalExpenses,
        expensesOnly: expenses,
        mileage,
        profit,
        incomeRecords: monthIncome,
        expenseRecords: monthExpense,
      };
    });
  }, [monthWindows, filteredIncome, filteredExpenses, filteredMileage]);

  // ── KPI totals ───────────────────────────────────────────
  const totalIncome = monthlyData.reduce((s, m) => s + m.income, 0);
  const totalExpenses = monthlyData.reduce((s, m) => s + m.expenses, 0);
  const netProfit = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

  // ── Income by category ───────────────────────────────────
  const incomeCategoryData = useMemo(() => {
    const catMap: Record<string, number[]> = {};
    monthWindows.forEach((w, i) => {
      const monthRecs = filteredIncome.filter((r) => {
        const d = parse(r.rentDueDate, 'yyyy-MM-dd', new Date());
        return isWithinInterval(d, { start: w.start, end: w.end });
      });
      monthRecs.forEach((r) => {
        if (!catMap[r.category]) catMap[r.category] = new Array(12).fill(0);
        catMap[r.category][i] += r.amountPaid;
      });
    });
    return catMap;
  }, [monthWindows, filteredIncome]);

  const incomeCategories = Object.keys(incomeCategoryData);

  const incomePieData = useMemo(() => {
    return incomeCategories.map((cat) => ({
      name: cat,
      value: incomeCategoryData[cat].reduce((s, v) => s + v, 0),
    })).filter((d) => d.value > 0);
  }, [incomeCategories, incomeCategoryData]);

  const incomeLineData = useMemo(() => {
    return monthWindows.map((w, i) => {
      const point: Record<string, string | number> = { month: w.shortLabel };
      incomeCategories.forEach((cat) => {
        point[cat] = incomeCategoryData[cat][i];
      });
      return point;
    });
  }, [monthWindows, incomeCategories, incomeCategoryData]);

  // ── Expense by category ──────────────────────────────────
  const expenseCategoryData = useMemo(() => {
    const catMap: Record<string, number[]> = {};
    monthWindows.forEach((w, i) => {
      const monthRecs = filteredExpenses.filter((r) => {
        const d = parse(r.date, 'yyyy-MM-dd', new Date());
        return isWithinInterval(d, { start: w.start, end: w.end });
      });
      monthRecs.forEach((r) => {
        if (!catMap[r.category]) catMap[r.category] = new Array(12).fill(0);
        catMap[r.category][i] += r.total;
      });
    });
    return catMap;
  }, [monthWindows, filteredExpenses]);

  const expenseCategories = Object.keys(expenseCategoryData);

  const expensePieData = useMemo(() => {
    return expenseCategories.map((cat) => ({
      name: cat,
      value: expenseCategoryData[cat].reduce((s, v) => s + v, 0),
    })).filter((d) => d.value > 0);
  }, [expenseCategories, expenseCategoryData]);

  const expenseLineData = useMemo(() => {
    return monthWindows.map((w, i) => {
      const point: Record<string, string | number> = { month: w.shortLabel };
      expenseCategories.forEach((cat) => {
        point[cat] = expenseCategoryData[cat][i];
      });
      return point;
    });
  }, [monthWindows, expenseCategories, expenseCategoryData]);

  // ── Chart data ───────────────────────────────────────────
  const profitLineData = monthlyData.map((m) => ({
    month: m.shortLabel,
    profit: m.profit,
  }));

  const combinedChartData = monthlyData.map((m) => ({
    month: m.shortLabel,
    Income: m.income,
    Expenses: m.expenses,
    Profit: m.profit,
  }));

  // ── Mileage total ────────────────────────────────────────
  const totalMileageCost = monthlyData.reduce((s, m) => s + m.mileage, 0);

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <div className="animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Annual Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">12-month financial overview across all properties</p>
          </div>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Dashboard Filters</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Start Year */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Start Year</label>
            <input
              type="number"
              value={startYear}
              onChange={(e) => setStartYear(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
            />
          </div>

          {/* Start Month */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Start Month</label>
            <select
              value={startMonth}
              onChange={(e) => setStartMonth(Number(e.target.value))}
              className="cursor-pointer w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
            >
              {MONTHS_LIST.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
          </div>

          {/* Property Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Property</label>
            <select
              value={selectedPropertyId}
              onChange={(e) => handlePropertyChange(e.target.value)}
              className="cursor-pointer w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
            >
              <option value="all">All Properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Unit Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Unit</label>
            <select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              disabled={selectedPropertyId === 'all'}
              className="cursor-pointer w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              <option value="all">All Units</option>
              {filteredUnits.map((u) => (
                <option key={u.id} value={u.id}>Unit {u.unitNumber}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-blue-500">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Income</p>
          <p className="text-2xl font-bold text-blue-700 mt-1.5 tracking-tight">{fmtCurrency(totalIncome, currency)}</p>
          <p className="text-xs text-slate-400 mt-1">{`${monthWindows[0]?.label ?? ''} - ${monthWindows[11]?.label ?? ''}`}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-red-500">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Expenses</p>
          <p className="text-2xl font-bold text-red-700 mt-1.5 tracking-tight">{fmtCurrency(totalExpenses, currency)}</p>
          <p className="text-xs text-slate-400 mt-1">Including mileage costs</p>
        </div>
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 ${netProfit >= 0 ? 'border-l-green-500' : 'border-l-red-500'}`}>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Profit / Loss</p>
          <p className={`text-2xl font-bold mt-1.5 tracking-tight ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmtCurrency(netProfit, currency)}</p>
          <p className="text-xs text-slate-400 mt-1">{`Margin: ${profitMargin.toFixed(1)}%`}</p>
        </div>
      </div>

      {/* ── Section 1: Profit Overview ───────────────────── */}
      <section className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Profit Overview</h2>
          <p className="text-sm text-slate-500 mb-4">
            Profit Margin:{' '}
            <span className={`font-bold ${profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {profitMargin.toFixed(1)}%
            </span>
          </p>

          {/* Profit trend line chart */}
          <div className="mb-8">
            <h3 className="text-sm font-medium text-slate-600 mb-3">Monthly Profit Trend</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={profitLineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip
                    formatter={(value) => [fmtCurrency(Number(value ?? 0), currency), 'Profit']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke={GREEN}
                    strokeWidth={2}
                    dot={{ fill: GREEN, r: 4 }}
                    name="Profit"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Combined bar+line chart */}
          <div>
            <h3 className="text-sm font-medium text-slate-600 mb-3">Income vs Expenses vs Profit</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={combinedChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                  <Tooltip
                    formatter={(value, name) => [fmtCurrency(Number(value ?? 0), currency), String(name)]}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Legend />
                  <Bar dataKey="Income" fill={BLUE} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expenses" fill={RED} radius={[4, 4, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="Profit"
                    stroke={GREEN}
                    strokeWidth={2}
                    dot={{ fill: GREEN, r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Monthly Summary Table */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Monthly Summary</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Month</th>
                  <th className="text-right py-2 px-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Income</th>
                  <th className="text-right py-2 px-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Expenses</th>
                  <th className="text-right py-2 px-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Profit</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((m, i) => (
                  <tr key={i} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                    <td className="py-2 px-3 text-slate-700">{m.label}</td>
                    <td className="py-2 px-3 text-right text-blue-600 font-medium">
                      {fmtCurrency(m.income, currency)}
                    </td>
                    <td className="py-2 px-3 text-right text-red-600 font-medium">
                      {fmtCurrency(m.expenses, currency)}
                    </td>
                    <td className={`py-2 px-3 text-right font-medium ${m.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmtCurrency(m.profit, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <td className="py-2 px-3 text-slate-800">Total</td>
                  <td className="py-2 px-3 text-right text-blue-700">{fmtCurrency(totalIncome, currency)}</td>
                  <td className="py-2 px-3 text-right text-red-700">{fmtCurrency(totalExpenses, currency)}</td>
                  <td className={`py-2 px-3 text-right ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {fmtCurrency(netProfit, currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      {/* ── Section 2: Income Detail ─────────────────────── */}
      <section className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Income Detail</h2>

          {/* Income Category Table */}
          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider sticky left-0 min-w-[120px]">
                    Category
                  </th>
                  {monthWindows.map((w, i) => (
                    <th key={i} className="text-right py-2 px-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider min-w-[100px]">
                      {w.shortLabel}
                    </th>
                  ))}
                  <th className="text-right py-2 px-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider min-w-[100px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {incomeCategories.map((cat) => {
                  const rowTotal = incomeCategoryData[cat].reduce((s, v) => s + v, 0);
                  return (
                    <tr key={cat} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                      <td className="py-2 px-3 text-slate-700 font-medium sticky left-0 bg-white">
                        {cat}
                      </td>
                      {incomeCategoryData[cat].map((val, i) => (
                        <td key={i} className="py-2 px-3 text-right text-slate-600">
                          {val > 0 ? fmtCurrency(val, currency) : '-'}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right text-blue-700 font-semibold">
                        {fmtCurrency(rowTotal, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <td className="py-2 px-3 text-slate-800 sticky left-0 bg-slate-50">Total</td>
                  {monthlyData.map((m, i) => (
                    <td key={i} className="py-2 px-3 text-right text-blue-700">
                      {m.income > 0 ? fmtCurrency(m.income, currency) : '-'}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right text-blue-800">
                    {fmtCurrency(totalIncome, currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Income Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie chart */}
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-3">Income Distribution by Category</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={incomePieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {incomePieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [fmtCurrency(Number(value ?? 0), currency), 'Amount']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Line chart */}
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-3">Monthly Income Trends</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={incomeLineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <Tooltip
                      formatter={(value, name) => [fmtCurrency(Number(value ?? 0), currency), String(name)]}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                    <Legend />
                    {incomeCategories.map((cat, i) => (
                      <Line
                        key={cat}
                        type="monotone"
                        dataKey={cat}
                        stroke={PIE_COLORS[i % PIE_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: Expense Detail ────────────────────── */}
      <section className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Expense Detail</h2>

          {/* Expense Category Table */}
          <div className="overflow-x-auto mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider sticky left-0 min-w-[120px]">
                    Category
                  </th>
                  {monthWindows.map((w, i) => (
                    <th key={i} className="text-right py-2 px-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider min-w-[100px]">
                      {w.shortLabel}
                    </th>
                  ))}
                  <th className="text-right py-2 px-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider min-w-[100px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {expenseCategories.map((cat) => {
                  const rowTotal = expenseCategoryData[cat].reduce((s, v) => s + v, 0);
                  return (
                    <tr key={cat} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                      <td className="py-2 px-3 text-slate-700 font-medium sticky left-0 bg-white">
                        {cat}
                      </td>
                      {expenseCategoryData[cat].map((val, i) => (
                        <td key={i} className="py-2 px-3 text-right text-slate-600">
                          {val > 0 ? fmtCurrency(val, currency) : '-'}
                        </td>
                      ))}
                      <td className="py-2 px-3 text-right text-red-700 font-semibold">
                        {fmtCurrency(rowTotal, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <td className="py-2 px-3 text-slate-800 sticky left-0 bg-slate-50">Total</td>
                  {monthlyData.map((m, i) => (
                    <td key={i} className="py-2 px-3 text-right text-red-700">
                      {m.expensesOnly > 0 ? fmtCurrency(m.expensesOnly, currency) : '-'}
                    </td>
                  ))}
                  <td className="py-2 px-3 text-right text-red-800">
                    {fmtCurrency(
                      monthlyData.reduce((s, m) => s + m.expensesOnly, 0),
                      currency,
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Expense Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie chart */}
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-3">Expense Distribution by Category</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expensePieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {expensePieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [fmtCurrency(Number(value ?? 0), currency), 'Amount']}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Line chart */}
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-3">Monthly Expense Trends</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={expenseLineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                    <Tooltip
                      formatter={(value, name) => [fmtCurrency(Number(value ?? 0), currency), String(name)]}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                    <Legend />
                    {expenseCategories.map((cat, i) => (
                      <Line
                        key={cat}
                        type="monotone"
                        dataKey={cat}
                        stroke={PIE_COLORS[i % PIE_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 4: Cash Flow Summary ─────────────────── */}
      <section>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800 mb-4">Cash Flow Summary</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 border-b border-slate-100">
              <span className="text-sm font-medium text-slate-600">Total Income</span>
              <span className="text-lg font-bold text-blue-600">{fmtCurrency(totalIncome, currency)}</span>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-slate-100">
              <div>
                <span className="text-sm font-medium text-slate-600">Total Expenses</span>
                <span className="text-xs text-slate-400 ml-2">(includes mileage: {fmtCurrency(totalMileageCost, currency)})</span>
              </div>
              <span className="text-lg font-bold text-red-600">{fmtCurrency(totalExpenses, currency)}</span>
            </div>
            <div className="flex items-center justify-between py-3 pt-4 border-t-2 border-slate-300">
              <span className="text-base font-semibold text-slate-800">Net Profit</span>
              <span className={`text-xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmtCurrency(netProfit, currency)}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
