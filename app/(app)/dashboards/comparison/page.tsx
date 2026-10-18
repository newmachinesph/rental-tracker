'use client';

import { useState, useMemo, useCallback } from 'react';


import {
  useSetupStore,
  useIncomeStore,
  useExpenseStore,
  useMileageStore,
} from '@/lib/store';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

/* ── comparison slot colours ──────────────────────────────── */
const SLOT_COLORS = ['#3b82f6', '#10b981', '#8b5cf6'] as const;
const SLOT_LABELS = ['Comparison 1', 'Comparison 2', 'Comparison 3'] as const;
const SLOT_BG = ['bg-blue-50', 'bg-emerald-50', 'bg-purple-50'] as const;
const SLOT_BORDER = [
  'border-l-blue-500',
  'border-l-emerald-500',
  'border-l-purple-500',
] as const;
const SLOT_TEXT = [
  'text-blue-700',
  'text-emerald-700',
  'text-purple-700',
] as const;
const SLOT_KPI_COLOR = ['blue', 'green', 'cyan'] as const;

/* ── formatting helpers ───────────────────────────────────── */
function fmt(value: number, currency: string) {
  return `${currency}${value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function pct(value: number) {
  return `${value.toFixed(1)}%`;
}

/* ── slot selection state shape ────────────────────────────── */
interface SlotSelection {
  propertyId: string;
  unitId: string;
}

/* ── computed data per slot ────────────────────────────────── */
interface SlotData {
  label: string;
  income: number;
  expenses: number;
  profit: number;
  profitMargin: number;
  incomeByCategory: Record<string, number>;
  expenseByCategory: Record<string, number>;
  monthlyCashFlow: { month: string; income: number; expenses: number; net: number }[];
}

/* ── custom tooltip for charts ────────────────────────────── */
function ChartTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="mb-1 font-medium text-slate-700">{label}</p>
      {payload.map((entry: any, idx: number) => (
        <p key={idx} style={{ color: entry.color }} className="text-xs">
          {entry.name}: {fmt(entry.value, currency)}
        </p>
      ))}
    </div>
  );
}

/* ── page component ───────────────────────────────────────── */
export default function ComparisonDashboardPage() {
  const { properties, units, incomeCategories, expenseCategories, currency } =
    useSetupStore();
  const incomeRecords = useIncomeStore((s) => s.records);
  const expenseRecords = useExpenseStore((s) => s.records);
  const mileageLogs = useMileageStore((s) => s.logs);

  /* ── filter state ───────────────────────────────────────── */
  const [startDate, setStartDate] = useState('2025-01-01');
  const [endDate, setEndDate] = useState('2025-06-30');

  const [slots, setSlots] = useState<SlotSelection[]>([
    { propertyId: 'p1', unitId: '' },
    { propertyId: 'p2', unitId: '' },
    { propertyId: 'p3', unitId: '' },
  ]);

  /* ── update a slot ──────────────────────────────────────── */
  const updateSlot = useCallback(
    (index: number, field: keyof SlotSelection, value: string) => {
      setSlots((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        if (field === 'propertyId') {
          next[index].unitId = '';
        }
        return next;
      });
    },
    [],
  );

  /* ── helper: check if date is in range ──────────────────── */
  const inRange = useCallback(
    (dateStr: string) => {
      return dateStr >= startDate && dateStr <= endDate;
    },
    [startDate, endDate],
  );

  /* ── helper: get units for a property ───────────────────── */
  const getUnitsForProperty = useCallback(
    (propertyId: string) => units.filter((u) => u.propertyId === propertyId),
    [units],
  );

  /* ── helper: count units in a property ──────────────────── */
  const getUnitCount = useCallback(
    (propertyId: string) => units.filter((u) => u.propertyId === propertyId).length,
    [units],
  );

  /* ── compute data for each slot ─────────────────────────── */
  const slotData: SlotData[] = useMemo(() => {
    return slots.map((slot) => {
      const property = properties.find((p) => p.id === slot.propertyId);
      const unit = slot.unitId
        ? units.find((u) => u.id === slot.unitId)
        : null;

      /* label */
      let label = property?.name || 'Not selected';
      if (unit) {
        label += ` - Unit ${unit.unitNumber}`;
      }

      if (!slot.propertyId) {
        return {
          label,
          income: 0,
          expenses: 0,
          profit: 0,
          profitMargin: 0,
          incomeByCategory: {},
          expenseByCategory: {},
          monthlyCashFlow: [],
        };
      }

      /* filter income */
      const slotIncome = incomeRecords.filter((r) => {
        if (!inRange(r.rentDueDate)) return false;
        if (r.propertyId !== slot.propertyId) return false;
        if (slot.unitId && r.unitId !== slot.unitId) return false;
        return true;
      });

      /* filter expenses */
      const unitCount = getUnitCount(slot.propertyId);
      const slotExpenses = expenseRecords.filter((r) => {
        if (!inRange(r.date)) return false;
        if (r.propertyId !== slot.propertyId) return false;
        if (slot.unitId) {
          /* unit-level: include unit-specific + building-wide */
          if (!r.appliesToEntireBuilding && r.unitId !== slot.unitId) return false;
        }
        return true;
      });

      /* income total */
      const totalIncome = slotIncome.reduce((s, r) => s + r.amountPaid, 0);

      /* expense total: distribute building-wide for unit-level */
      const totalExpenses = slotExpenses.reduce((s, r) => {
        if (slot.unitId && r.appliesToEntireBuilding && unitCount > 0) {
          return s + r.total / unitCount;
        }
        return s + r.total;
      }, 0);

      const profit = totalIncome - totalExpenses;
      const profitMargin = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;

      /* income by category */
      const incByCategory: Record<string, number> = {};
      slotIncome.forEach((r) => {
        incByCategory[r.category] = (incByCategory[r.category] || 0) + r.amountPaid;
      });

      /* expense by category */
      const expByCategory: Record<string, number> = {};
      slotExpenses.forEach((r) => {
        let amount = r.total;
        if (slot.unitId && r.appliesToEntireBuilding && unitCount > 0) {
          amount = r.total / unitCount;
        }
        expByCategory[r.category] = (expByCategory[r.category] || 0) + amount;
      });

      /* monthly cash flow */
      const start = new Date(startDate);
      const end = new Date(endDate);
      const monthlyMap: Record<string, { income: number; expenses: number }> = {};

      /* populate months in range */
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cursor <= end) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
        monthlyMap[key] = { income: 0, expenses: 0 };
        cursor.setMonth(cursor.getMonth() + 1);
      }

      slotIncome.forEach((r) => {
        const d = new Date(r.rentDueDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyMap[key]) {
          monthlyMap[key].income += r.amountPaid;
        }
      });

      slotExpenses.forEach((r) => {
        const d = new Date(r.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyMap[key]) {
          let amount = r.total;
          if (slot.unitId && r.appliesToEntireBuilding && unitCount > 0) {
            amount = r.total / unitCount;
          }
          monthlyMap[key].expenses += amount;
        }
      });

      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      ];
      const monthlyCashFlow = Object.entries(monthlyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, vals]) => {
          const [yr, mo] = key.split('-');
          return {
            month: `${monthNames[parseInt(mo, 10) - 1]} ${yr}`,
            income: Math.round(vals.income * 100) / 100,
            expenses: Math.round(vals.expenses * 100) / 100,
            net: Math.round((vals.income - vals.expenses) * 100) / 100,
          };
        });

      return {
        label,
        income: totalIncome,
        expenses: totalExpenses,
        profit,
        profitMargin,
        incomeByCategory: incByCategory,
        expenseByCategory: expByCategory,
        monthlyCashFlow,
      };
    });
  }, [
    slots,
    properties,
    units,
    incomeRecords,
    expenseRecords,
    startDate,
    endDate,
    inRange,
    getUnitCount,
  ]);

  /* ── chart data: profit margin comparison ───────────────── */
  const profitMarginData = useMemo(() => {
    return slotData
      .filter((_, i) => slots[i].propertyId)
      .map((d, i) => ({
        name: d.label,
        'Profit Margin': Math.round(d.profitMargin * 10) / 10,
        fill: SLOT_COLORS[i],
      }));
  }, [slotData, slots]);

  /* ── chart data: combined income/expenses/profit ────────── */
  const combinedChartData = useMemo(() => {
    return slotData
      .filter((_, i) => slots[i].propertyId)
      .map((d) => ({
        name: d.label,
        Income: Math.round(d.income * 100) / 100,
        Expenses: Math.round(d.expenses * 100) / 100,
        Profit: Math.round(d.profit * 100) / 100,
      }));
  }, [slotData, slots]);

  /* ── collect all categories across all slots ────────────── */
  const allIncomeCategories = useMemo(() => {
    const catSet = new Set<string>();
    slotData.forEach((d) => {
      Object.keys(d.incomeByCategory).forEach((c) => catSet.add(c));
    });
    return incomeCategories.filter((c) => catSet.has(c));
  }, [slotData, incomeCategories]);

  const allExpenseCategories = useMemo(() => {
    const catSet = new Set<string>();
    slotData.forEach((d) => {
      Object.keys(d.expenseByCategory).forEach((c) => catSet.add(c));
    });
    return expenseCategories.filter((c) => catSet.has(c));
  }, [slotData, expenseCategories]);

  /* ── active slots (ones with a property selected) ───────── */
  const activeSlotIndices = useMemo(
    () => slots.map((s, i) => i).filter((i) => slots[i].propertyId),
    [slots],
  );

  /* ── render ─────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Comparison Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Compare up to 3 properties or units side by side across a date range.</p>
          </div>
        </div>
      </div>

      {/* ── editable filter section ───────────────────────────── */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-amber-700">
          Filters
        </h2>

        {/* date range */}
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="cursor-pointer hover:border-slate-300 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="cursor-pointer hover:border-slate-300 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* comparison slots */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {slots.map((slot, i) => {
            const propertyUnits = getUnitsForProperty(slot.propertyId);
            const slotAccentBorder = ['border-t-blue-500', 'border-t-emerald-500', 'border-t-purple-500'][i];
            return (
              <div
                key={i}
                className={`rounded-xl border border-slate-200 bg-white p-4 border-t-4 ${slotAccentBorder}`}
              >
                <h3
                  className="mb-3 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: SLOT_COLORS[i] }}
                >
                  {SLOT_LABELS[i]}
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Property
                    </label>
                    <select
                      value={slot.propertyId}
                      onChange={(e) => updateSlot(i, 'propertyId', e.target.value)}
                      className="cursor-pointer w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
                    >
                      <option value="">-- None --</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Unit (optional)
                    </label>
                    <select
                      value={slot.unitId}
                      onChange={(e) => updateSlot(i, 'unitId', e.target.value)}
                      disabled={!slot.propertyId}
                      className="cursor-pointer w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">All units (entire property)</option>
                      {propertyUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          Unit {u.unitNumber}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── summary cards (3 columns) ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {slotData.map((data, i) => {
          if (!slots[i].propertyId) {
            return (
              <div
                key={i}
                className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8"
              >
                <p className="text-sm text-slate-400">
                  No property selected for {SLOT_LABELS[i]}
                </p>
              </div>
            );
          }
          return (
            <div
              key={i}
              className={`rounded-xl border-l-4 ${SLOT_BORDER[i]} ${SLOT_BG[i]} p-5 shadow-sm`}
            >
              <h3
                className={`mb-3 text-sm font-bold ${SLOT_TEXT[i]}`}
              >
                {data.label}
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Income</span>
                  <span className="font-semibold text-green-700">
                    {fmt(data.income, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Expenses</span>
                  <span className="font-semibold text-red-700">
                    {fmt(data.expenses, currency)}
                  </span>
                </div>
                <div className="border-t border-slate-200 pt-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Profit</span>
                    <span
                      className={`font-bold ${
                        data.profit >= 0 ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {fmt(data.profit, currency)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Profit Margin</span>
                  <span
                    className={`font-bold ${
                      data.profitMargin >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {pct(data.profitMargin)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── comparison charts ─────────────────────────────────── */}
      {activeSlotIndices.length > 0 && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Profit Margin Comparison */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Profit Margin Comparison
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={profitMarginData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  tickFormatter={(v) => `${v}%`}
                  fontSize={12}
                  stroke="#94a3b8"
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  fontSize={12}
                  stroke="#94a3b8"
                  tick={{ fill: '#475569' }}
                />
                <Tooltip
                  formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`, 'Profit Margin']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '13px',
                  }}
                />
                <Bar dataKey="Profit Margin" radius={[0, 4, 4, 0]} barSize={32}>
                  {profitMarginData.map((entry, idx) => (
                    <rect key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Combined Income / Expenses / Profit */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Income, Expenses &amp; Profit Comparison
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={combinedChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  fontSize={11}
                  stroke="#94a3b8"
                  tick={{ fill: '#475569' }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  fontSize={12}
                  stroke="#94a3b8"
                  tickFormatter={(v) => `${currency}${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<ChartTooltip currency={currency} />} />
                <Legend
                  verticalAlign="top"
                  wrapperStyle={{ fontSize: '12px', paddingBottom: '8px' }}
                />
                <Bar
                  dataKey="Income"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  barSize={28}
                />
                <Bar
                  dataKey="Expenses"
                  fill="#ef4444"
                  radius={[4, 4, 0, 0]}
                  barSize={28}
                />
                <Bar
                  dataKey="Profit"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  barSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── income breakdown by category ──────────────────────── */}
      {activeSlotIndices.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Income Breakdown by Category
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-5 py-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Category
                  </th>
                  {activeSlotIndices.map((i) => (
                    <th
                      key={i}
                      className="px-5 py-3 text-right bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: SLOT_COLORS[i] }}
                    >
                      {slotData[i].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allIncomeCategories.length === 0 ? (
                  <tr>
                    <td
                      colSpan={1 + activeSlotIndices.length}
                      className="px-5 py-8 text-center text-slate-400"
                    >
                      No income data for this period.
                    </td>
                  </tr>
                ) : (
                  <>
                    {allIncomeCategories.map((cat) => (
                      <tr
                        key={cat}
                        className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors"
                      >
                        <td className="px-5 py-3 text-slate-700">{cat}</td>
                        {activeSlotIndices.map((i) => (
                          <td
                            key={i}
                            className="px-5 py-3 text-right font-medium text-green-700"
                          >
                            {fmt(slotData[i].incomeByCategory[cat] || 0, currency)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="bg-green-50 font-semibold">
                      <td className="px-5 py-3 text-slate-800">Total</td>
                      {activeSlotIndices.map((i) => (
                        <td
                          key={i}
                          className="px-5 py-3 text-right text-green-800"
                        >
                          {fmt(slotData[i].income, currency)}
                        </td>
                      ))}
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── expense breakdown by category ─────────────────────── */}
      {activeSlotIndices.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Expense Breakdown by Category
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="px-5 py-3 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Category
                  </th>
                  {activeSlotIndices.map((i) => (
                    <th
                      key={i}
                      className="px-5 py-3 text-right bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider"
                      style={{ color: SLOT_COLORS[i] }}
                    >
                      {slotData[i].label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allExpenseCategories.length === 0 ? (
                  <tr>
                    <td
                      colSpan={1 + activeSlotIndices.length}
                      className="px-5 py-8 text-center text-slate-400"
                    >
                      No expense data for this period.
                    </td>
                  </tr>
                ) : (
                  <>
                    {allExpenseCategories.map((cat) => (
                      <tr
                        key={cat}
                        className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors"
                      >
                        <td className="px-5 py-3 text-slate-700">{cat}</td>
                        {activeSlotIndices.map((i) => (
                          <td
                            key={i}
                            className="px-5 py-3 text-right font-medium text-red-700"
                          >
                            {fmt(
                              slotData[i].expenseByCategory[cat] || 0,
                              currency,
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="bg-red-50 font-semibold">
                      <td className="px-5 py-3 text-slate-800">Total</td>
                      {activeSlotIndices.map((i) => (
                        <td
                          key={i}
                          className="px-5 py-3 text-right text-red-800"
                        >
                          {fmt(slotData[i].expenses, currency)}
                        </td>
                      ))}
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── cash flow section ─────────────────────────────────── */}
      {activeSlotIndices.length > 0 && (
        <div>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Cash Flow by Month
          </h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {activeSlotIndices.map((i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div
                  className="border-b px-5 py-3"
                  style={{
                    borderColor: SLOT_COLORS[i],
                    backgroundColor: `${SLOT_COLORS[i]}10`,
                  }}
                >
                  <h4
                    className="text-sm font-semibold"
                    style={{ color: SLOT_COLORS[i] }}
                  >
                    {slotData[i].label}
                  </h4>
                </div>
                {slotData[i].monthlyCashFlow.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-slate-400">
                    No data for this period.
                  </p>
                ) : (
                  <>
                    {/* mini bar chart */}
                    <div className="px-3 pt-4">
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={slotData[i].monthlyCashFlow}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#e2e8f0"
                          />
                          <XAxis
                            dataKey="month"
                            fontSize={10}
                            stroke="#94a3b8"
                            tick={{ fill: '#475569' }}
                            interval={0}
                            angle={-25}
                            textAnchor="end"
                            height={45}
                          />
                          <YAxis
                            fontSize={10}
                            stroke="#94a3b8"
                            tickFormatter={(v) =>
                              `${currency}${(v / 1000).toFixed(0)}k`
                            }
                          />
                          <Tooltip
                            content={<ChartTooltip currency={currency} />}
                          />
                          <Bar
                            dataKey="income"
                            name="Income"
                            fill="#10b981"
                            radius={[2, 2, 0, 0]}
                            barSize={12}
                          />
                          <Bar
                            dataKey="expenses"
                            name="Expenses"
                            fill="#ef4444"
                            radius={[2, 2, 0, 0]}
                            barSize={12}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    {/* cash flow table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-t border-slate-100 text-left">
                            <th className="px-4 py-2 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                              Month
                            </th>
                            <th className="px-4 py-2 text-right bg-slate-50/80 text-[11px] font-semibold text-green-700 uppercase tracking-wider">
                              Income
                            </th>
                            <th className="px-4 py-2 text-right bg-slate-50/80 text-[11px] font-semibold text-red-700 uppercase tracking-wider">
                              Expenses
                            </th>
                            <th className="px-4 py-2 text-right bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                              Net
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {slotData[i].monthlyCashFlow.map((row) => (
                            <tr
                              key={row.month}
                              className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors"
                            >
                              <td className="px-4 py-2 text-slate-700">
                                {row.month}
                              </td>
                              <td className="px-4 py-2 text-right text-green-700">
                                {fmt(row.income, currency)}
                              </td>
                              <td className="px-4 py-2 text-right text-red-700">
                                {fmt(row.expenses, currency)}
                              </td>
                              <td
                                className={`px-4 py-2 text-right font-medium ${
                                  row.net >= 0
                                    ? 'text-green-700'
                                    : 'text-red-700'
                                }`}
                              >
                                {fmt(row.net, currency)}
                              </td>
                            </tr>
                          ))}
                          {/* totals row */}
                          <tr className="bg-slate-50 font-semibold">
                            <td className="px-4 py-2 text-slate-800">Total</td>
                            <td className="px-4 py-2 text-right text-green-800">
                              {fmt(
                                slotData[i].monthlyCashFlow.reduce(
                                  (s, r) => s + r.income,
                                  0,
                                ),
                                currency,
                              )}
                            </td>
                            <td className="px-4 py-2 text-right text-red-800">
                              {fmt(
                                slotData[i].monthlyCashFlow.reduce(
                                  (s, r) => s + r.expenses,
                                  0,
                                ),
                                currency,
                              )}
                            </td>
                            <td
                              className={`px-4 py-2 text-right font-bold ${
                                slotData[i].profit >= 0
                                  ? 'text-green-800'
                                  : 'text-red-800'
                              }`}
                            >
                              {fmt(
                                slotData[i].monthlyCashFlow.reduce(
                                  (s, r) => s + r.net,
                                  0,
                                ),
                                currency,
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── empty state ───────────────────────────────────────── */}
      {activeSlotIndices.length === 0 && (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12">
          <p className="text-sm text-slate-400">
            Select at least one property above to begin comparing.
          </p>
        </div>
      )}
    </div>
  );
}
