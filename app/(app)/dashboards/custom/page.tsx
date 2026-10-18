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

const PIE_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
];

export default function CustomDashboardPage() {
  const { properties, units, incomeCategories, expenseCategories, currency } =
    useSetupStore();
  const incomeRecords = useIncomeStore((s) => s.records);
  const expenseRecords = useExpenseStore((s) => s.records);

  // --- Filters ---
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2025-06-30');
  const [selectedPropertyId, setSelectedPropertyId] = useState('all');
  const [selectedUnitId, setSelectedUnitId] = useState('all');

  const isDateRangeInvalid = startDate && endDate && endDate < startDate;

  // Units available for the selected property
  const availableUnits = useMemo(
    () =>
      selectedPropertyId === 'all'
        ? []
        : units.filter((u) => u.propertyId === selectedPropertyId),
    [selectedPropertyId, units],
  );

  // Reset unit filter when property changes
  const handlePropertyChange = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setSelectedUnitId('all');
  };

  // --- Filtered Records ---
  const filteredIncome = useMemo(() => {
    if (isDateRangeInvalid) return [];
    return incomeRecords.filter((r) => {
      const date = r.rentDueDate;
      if (date < startDate || date > endDate) return false;
      if (selectedPropertyId !== 'all' && r.propertyId !== selectedPropertyId)
        return false;
      if (selectedUnitId !== 'all' && r.unitId !== selectedUnitId) return false;
      return true;
    });
  }, [
    incomeRecords,
    startDate,
    endDate,
    selectedPropertyId,
    selectedUnitId,
    isDateRangeInvalid,
  ]);

  const filteredExpenses = useMemo(() => {
    if (isDateRangeInvalid) return [];
    return expenseRecords.filter((r) => {
      const date = r.date;
      if (date < startDate || date > endDate) return false;
      if (selectedPropertyId !== 'all' && r.propertyId !== selectedPropertyId)
        return false;
      if (
        selectedUnitId !== 'all' &&
        !r.appliesToEntireBuilding &&
        r.unitId !== selectedUnitId
      )
        return false;
      if (selectedUnitId !== 'all' && r.appliesToEntireBuilding) return true;
      return true;
    });
  }, [
    expenseRecords,
    startDate,
    endDate,
    selectedPropertyId,
    selectedUnitId,
    isDateRangeInvalid,
  ]);

  // --- Aggregates ---
  const totalIncome = useMemo(
    () => filteredIncome.reduce((sum, r) => sum + r.amountPaid, 0),
    [filteredIncome],
  );

  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((sum, r) => sum + r.total, 0),
    [filteredExpenses],
  );

  const profitLoss = totalIncome - totalExpenses;
  const profitMargin =
    totalIncome > 0 ? ((profitLoss / totalIncome) * 100).toFixed(1) : '0.0';

  // --- Income by Category ---
  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredIncome.forEach((r) => {
      map[r.category] = (map[r.category] || 0) + r.amountPaid;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredIncome]);

  // --- Expense by Category ---
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    filteredExpenses.forEach((r) => {
      map[r.category] = (map[r.category] || 0) + r.total;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  // --- Format helpers ---
  const fmt = (n: number) =>
    `${currency}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderCustomLabel = (props: any) => {
    const cx = (props.cx ?? 0) as number;
    const cy = (props.cy ?? 0) as number;
    const midAngle = (props.midAngle ?? 0) as number;
    const innerRadius = (props.innerRadius ?? 0) as number;
    const outerRadius = (props.outerRadius ?? 0) as number;
    const percent = (props.percent ?? 0) as number;
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill="#fff"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-xs font-semibold"
      >
        {((percent ?? 0) * 100).toFixed(0)}%
      </text>
    );
  };

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Custom Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Analyze income and expenses over a custom date range</p>
          </div>
        </div>
      </div>

      {/* ─── Editable Filters Section ─── */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-amber-800 mb-4">
          Dashboard Filters
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Start Date */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="cursor-pointer hover:border-slate-300 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="cursor-pointer hover:border-slate-300 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
            />
            {isDateRangeInvalid && (
              <p className="text-xs text-red-600 font-medium mt-1">
                End date must be on or after the start date.
              </p>
            )}
          </div>

          {/* Property Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Property
            </label>
            <select
              value={selectedPropertyId}
              onChange={(e) => handlePropertyChange(e.target.value)}
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
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Unit
            </label>
            <select
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              disabled={selectedPropertyId === 'all'}
              className="cursor-pointer w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              <option value="all">All Units</option>
              {availableUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitNumber}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-green-500">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Income</p>
          <p className="text-2xl font-bold text-green-700 mt-1.5 tracking-tight">{fmt(totalIncome)}</p>
          <p className="text-xs text-slate-400 mt-1">{`${filteredIncome.length} record${filteredIncome.length !== 1 ? 's' : ''}`}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-red-500">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Expenses</p>
          <p className="text-2xl font-bold text-red-700 mt-1.5 tracking-tight">{fmt(totalExpenses)}</p>
          <p className="text-xs text-slate-400 mt-1">{`${filteredExpenses.length} record${filteredExpenses.length !== 1 ? 's' : ''}`}</p>
        </div>
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 ${profitLoss >= 0 ? 'border-l-blue-500' : 'border-l-amber-500'}`}>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Profit / Loss</p>
          <p className={`text-2xl font-bold mt-1.5 tracking-tight ${profitLoss >= 0 ? 'text-blue-700' : 'text-amber-700'}`}>{fmt(profitLoss)}</p>
          <p className="text-xs text-slate-400 mt-1">{profitLoss >= 0 ? 'Net positive' : 'Net negative'}</p>
        </div>
      </div>

      {/* ─── Category Tables (side by side) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income by Category Table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-700">
              Income by Category
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-2.5 text-left bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-5 py-2.5 text-right bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {incomeByCategory.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-5 py-4 text-center text-slate-400"
                    >
                      No income data for this range
                    </td>
                  </tr>
                ) : (
                  incomeByCategory.map((row) => (
                    <tr
                      key={row.name}
                      className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors"
                    >
                      <td className="px-5 py-2.5 text-slate-700">
                        {row.name}
                      </td>
                      <td className="px-5 py-2.5 text-right font-medium text-green-700">
                        {fmt(row.value)}
                      </td>
                    </tr>
                  ))
                )}
                {incomeByCategory.length > 0 && (
                  <tr className="bg-slate-50 font-semibold">
                    <td className="px-5 py-2.5 text-slate-700">Total</td>
                    <td className="px-5 py-2.5 text-right text-green-700">
                      {fmt(totalIncome)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expense by Category Table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-700">
              Expenses by Category
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="px-5 py-2.5 text-left bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-5 py-2.5 text-right bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {expenseByCategory.length === 0 ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="px-5 py-4 text-center text-slate-400"
                    >
                      No expense data for this range
                    </td>
                  </tr>
                ) : (
                  expenseByCategory.map((row) => (
                    <tr
                      key={row.name}
                      className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors"
                    >
                      <td className="px-5 py-2.5 text-slate-700">
                        {row.name}
                      </td>
                      <td className="px-5 py-2.5 text-right font-medium text-red-700">
                        {fmt(row.value)}
                      </td>
                    </tr>
                  ))
                )}
                {expenseByCategory.length > 0 && (
                  <tr className="bg-slate-50 font-semibold">
                    <td className="px-5 py-2.5 text-slate-700">Total</td>
                    <td className="px-5 py-2.5 text-right text-red-700">
                      {fmt(totalExpenses)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── Profit Margin + Pie Charts ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Profit Margin */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 flex flex-col items-center justify-center">
          <h3 className="text-sm font-semibold text-slate-500 mb-2">
            Profit Margin
          </h3>
          <div
            className={`text-5xl font-bold ${
              Number(profitMargin) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {profitMargin}%
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {Number(profitMargin) >= 0
              ? 'Healthy margin'
              : 'Operating at a loss'}
          </p>
          <div className="mt-4 w-full border-t border-slate-100 pt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Income</span>
              <span className="font-medium text-green-700">
                {fmt(totalIncome)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Expenses</span>
              <span className="font-medium text-red-700">
                {fmt(totalExpenses)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2">
              <span className="text-slate-600 font-semibold">Net</span>
              <span
                className={`font-bold ${profitLoss >= 0 ? 'text-green-700' : 'text-red-700'}`}
              >
                {fmt(profitLoss)}
              </span>
            </div>
          </div>
        </div>

        {/* Middle: Income Distribution */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Income Distribution
          </h3>
          {incomeByCategory.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
              No income data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={incomeByCategory}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  labelLine={false}
                  label={renderCustomLabel}
                >
                  {incomeByCategory.map((_, i) => (
                    <Cell
                      key={`inc-${i}`}
                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => fmt(Number(value ?? 0))}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  iconSize={10}
                  wrapperStyle={{ fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Right: Expense Distribution */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">
            Expense Distribution
          </h3>
          {expenseByCategory.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
              No expense data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={expenseByCategory}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  labelLine={false}
                  label={renderCustomLabel}
                >
                  {expenseByCategory.map((_, i) => (
                    <Cell
                      key={`exp-${i}`}
                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => fmt(Number(value ?? 0))}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Legend
                  iconSize={10}
                  wrapperStyle={{ fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
