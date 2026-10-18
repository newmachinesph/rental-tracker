'use client';

import Link from 'next/link';
import { useState, useMemo, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  Building2,
  Users,
  DollarSign,
  CreditCard,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Settings,
  FileText,
  Wrench,
  BarChart3,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from 'recharts';
import {
  useSetupStore,
  useIncomeStore,
  useExpenseStore,
  useLeaseStore,
} from '@/lib/store';
import { Modal } from '@/components/ui/Modal';

/* ── Helpers ─────────────────────────────────────────────────── */

function formatCurrency(value: number, symbol: string): string {
  return `${symbol}${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getRelativeDate(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr + 'T00:00:00');
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

/* ── Quick Actions config ────────────────────────────────────── */

const quickActions = [
  {
    label: 'Add Income',
    href: '/income',
    icon: DollarSign,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  {
    label: 'Add Expense',
    href: '/expenses',
    icon: CreditCard,
    color: 'text-red-500',
    bg: 'bg-red-50',
  },
  {
    label: 'New Lease',
    href: '/leases',
    icon: FileText,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  {
    label: 'Maintenance',
    href: '/maintenance',
    icon: Wrench,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  {
    label: 'Reports',
    href: '/dashboards/property',
    icon: BarChart3,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
  },
  {
    label: 'Settings',
    href: '/setup',
    icon: Settings,
    color: 'text-slate-600',
    bg: 'bg-slate-100',
  },
];

/* ── Page Component ──────────────────────────────────────────── */

export default function Home() {
  const { properties, units, currency, ownerInfo, addUnit, updateUnit, removeUnit } = useSetupStore();
  const { records: incomeRecords } = useIncomeStore();
  const { records: expenseRecords } = useExpenseStore();
  const { leases } = useLeaseStore();

  /* ── Derived KPIs ──────────────────────────────────────────── */

  const activeTenants = useMemo(
    () => leases.filter((l) => l.isCurrentTenant).length,
    [leases],
  );

  const totalIncome = useMemo(
    () => incomeRecords.reduce((sum, r) => sum + r.amountPaid, 0),
    [incomeRecords],
  );

  const totalExpenses = useMemo(
    () => expenseRecords.reduce((sum, r) => sum + r.total, 0),
    [expenseRecords],
  );

  const netProfit = totalIncome - totalExpenses;

  const occupancyRate = useMemo(() => {
    if (units.length === 0) return 0;
    return Math.round((activeTenants / units.length) * 100);
  }, [activeTenants, units.length]);

  /* ── Monthly income data for sparkline ─────────────────────── */

  const monthlyIncomeData = useMemo(() => {
    const monthMap: Record<string, number> = {};

    incomeRecords.forEach((r) => {
      const month = r.paymentDate.slice(0, 7); // "YYYY-MM"
      monthMap[month] = (monthMap[month] || 0) + r.amountPaid;
    });

    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => {
        const [y, m] = month.split('-');
        const label = new Date(Number(y), Number(m) - 1).toLocaleDateString(
          'en-US',
          { month: 'short' },
        );
        return { month: label, income: amount };
      });
  }, [incomeRecords]);

  /* ── Recent Activity feed ──────────────────────────────────── */

  const recentActivity = useMemo(() => {
    type ActivityItem = {
      id: string;
      type: 'income' | 'expense';
      date: string;
      description: string;
      amount: number;
    };

    const items: ActivityItem[] = [];

    incomeRecords.forEach((r) => {
      const property = properties.find((p) => p.id === r.propertyId);
      items.push({
        id: `inc-${r.id}`,
        type: 'income',
        date: r.paymentDate,
        description: `${r.category}${property ? ` - ${property.name}` : ''}`,
        amount: r.amountPaid,
      });
    });

    expenseRecords.forEach((r) => {
      const property = properties.find((p) => p.id === r.propertyId);
      items.push({
        id: `exp-${r.id}`,
        type: 'expense',
        date: r.date,
        description: `${r.category}${property ? ` - ${property.name}` : ''}`,
        amount: r.total,
      });
    });

    return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  }, [incomeRecords, expenseRecords, properties]);

  /* ── Properties overview with per-property stats ───────────── */

  const propertyStats = useMemo(() => {
    return properties.map((property) => {
      const propUnits = units.filter((u) => u.propertyId === property.id);
      const propLeases = leases.filter(
        (l) => l.propertyId === property.id && l.isCurrentTenant,
      );
      const propIncome = incomeRecords
        .filter((r) => r.propertyId === property.id)
        .reduce((sum, r) => sum + r.amountPaid, 0);
      const occ =
        propUnits.length > 0
          ? Math.round((propLeases.length / propUnits.length) * 100)
          : 0;

      return {
        ...property,
        unitCount: propUnits.length,
        tenantCount: propLeases.length,
        revenue: propIncome,
        occupancy: occ,
      };
    });
  }, [properties, units, leases, incomeRecords]);

  /* ── Top properties by revenue ─────────────────────────────── */

  const topProperties = useMemo(() => {
    const sorted = [...propertyStats].sort((a, b) => b.revenue - a.revenue);
    return sorted.slice(0, 3);
  }, [propertyStats]);

  const maxRevenue = topProperties.length > 0 ? topProperties[0].revenue : 1;

  /* ── Trend percentages (simulated, comparing last 2 months) ── */

  const trends = useMemo(() => {
    const months = Object.keys(
      incomeRecords.reduce(
        (acc, r) => {
          acc[r.paymentDate.slice(0, 7)] = true;
          return acc;
        },
        {} as Record<string, boolean>,
      ),
    ).sort();

    if (months.length < 2) {
      return { income: 0, expense: 0 };
    }

    const lastMonth = months[months.length - 1];
    const prevMonth = months[months.length - 2];

    const lastIncome = incomeRecords
      .filter((r) => r.paymentDate.startsWith(lastMonth))
      .reduce((s, r) => s + r.amountPaid, 0);
    const prevIncome = incomeRecords
      .filter((r) => r.paymentDate.startsWith(prevMonth))
      .reduce((s, r) => s + r.amountPaid, 0);

    const expMonths = Object.keys(
      expenseRecords.reduce(
        (acc, r) => {
          acc[r.date.slice(0, 7)] = true;
          return acc;
        },
        {} as Record<string, boolean>,
      ),
    ).sort();

    let expTrend = 0;
    if (expMonths.length >= 2) {
      const lastExp = expenseRecords
        .filter((r) => r.date.startsWith(expMonths[expMonths.length - 1]))
        .reduce((s, r) => s + r.total, 0);
      const prevExp = expenseRecords
        .filter((r) => r.date.startsWith(expMonths[expMonths.length - 2]))
        .reduce((s, r) => s + r.total, 0);
      expTrend = prevExp > 0 ? Math.round(((lastExp - prevExp) / prevExp) * 100) : 0;
    }

    return {
      income:
        prevIncome > 0
          ? Math.round(((lastIncome - prevIncome) / prevIncome) * 100)
          : 0,
      expense: expTrend,
    };
  }, [incomeRecords, expenseRecords]);

  /* ── Unit management state ─────────────────────────────────── */

  const [expandedPropertyId, setExpandedPropertyId] = useState<string | null>(null);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editUnitForm, setEditUnitForm] = useState({ unitNumber: '', address: '' });
  const [deleteUnitConfirmId, setDeleteUnitConfirmId] = useState<string | null>(null);

  const toggleProperty = useCallback((id: string) => {
    setExpandedPropertyId((prev) => (prev === id ? null : id));
    setEditingUnitId(null);
  }, []);

  const getPropertyUnits = useCallback(
    (propertyId: string) => units.filter((u) => u.propertyId === propertyId),
    [units],
  );

  const handleAddUnit = useCallback(
    async (propertyId: string) => {
      const property = properties.find((p) => p.id === propertyId);
      const propUnits = units.filter((u) => u.propertyId === propertyId);
      if (property && propUnits.length >= property.units) {
        alert(`This property allows a maximum of ${property.units} units.`);
        return;
      }
      const nextNum = propUnits.length + 1;
      await addUnit({
        id: '',
        propertyId,
        unitNumber: `Unit ${nextNum}`,
        address: '',
      });
    },
    [properties, units, addUnit],
  );

  const startEditUnit = useCallback((unit: { id: string; unitNumber: string; address: string }) => {
    setEditingUnitId(unit.id);
    setEditUnitForm({ unitNumber: unit.unitNumber, address: unit.address });
  }, []);

  const saveEditUnit = useCallback(async () => {
    if (editingUnitId && editUnitForm.unitNumber.trim()) {
      await updateUnit(editingUnitId, {
        unitNumber: editUnitForm.unitNumber.trim(),
        address: editUnitForm.address.trim(),
      });
    }
    setEditingUnitId(null);
  }, [editingUnitId, editUnitForm, updateUnit]);

  const cancelEditUnit = useCallback(() => {
    setEditingUnitId(null);
  }, []);

  const confirmDeleteUnit = useCallback(async () => {
    if (deleteUnitConfirmId) {
      await removeUnit(deleteUnitConfirmId);
      setDeleteUnitConfirmId(null);
    }
  }, [deleteUnitConfirmId, removeUnit]);

  /* ── KPI card definitions ──────────────────────────────────── */

  const kpiCards = [
    {
      title: 'Total Income',
      value: formatCurrency(totalIncome, currency),
      trend: trends.income,
      icon: DollarSign,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      borderColor: 'border-l-emerald-500',
    },
    {
      title: 'Total Expenses',
      value: formatCurrency(totalExpenses, currency),
      trend: trends.expense,
      trendInverted: true,
      icon: CreditCard,
      iconBg: 'bg-red-100',
      iconColor: 'text-red-500',
      borderColor: 'border-l-red-500',
    },
    {
      title: 'Net Profit',
      value: `${netProfit < 0 ? '-' : ''}${formatCurrency(netProfit, currency)}`,
      trend: trends.income - trends.expense,
      icon: TrendingUp,
      iconBg: netProfit >= 0 ? 'bg-blue-100' : 'bg-red-100',
      iconColor: netProfit >= 0 ? 'text-blue-600' : 'text-red-500',
      borderColor: netProfit >= 0 ? 'border-l-blue-500' : 'border-l-red-500',
    },
    {
      title: 'Occupancy Rate',
      value: `${occupancyRate}%`,
      trend: occupancyRate > 75 ? 5 : occupancyRate > 50 ? 0 : -5,
      icon: Users,
      iconBg: 'bg-cyan-100',
      iconColor: 'text-cyan-600',
      borderColor: 'border-l-cyan-500',
    },
  ];

  /* ── Render ────────────────────────────────────────────────── */

  return (
    <div className="animate-fade-in-up space-y-8">
      {/* ── 1. Welcome Header ────────────────────────────────── */}
      <section className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            {getGreeting()}{ownerInfo.name ? `, ${ownerInfo.name}` : ''}
          </h1>
          <p className="mt-1 text-sm text-text-tertiary">{getFormattedDate()}</p>
        </div>
        <Link
          href="/dashboards/property"
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-primary-hover sm:mt-0"
        >
          <BarChart3 className="h-4 w-4" />
          View Reports
        </Link>
      </section>

      {/* ── 2. KPI Row ───────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          const isPositiveTrend = kpi.trendInverted
            ? kpi.trend <= 0
            : kpi.trend >= 0;

          return (
            <div
              key={kpi.title}
              className={clsx(
                'relative overflow-hidden rounded-xl border border-border-default bg-surface shadow-sm transition-all duration-200',
                'border-l-4',
                kpi.borderColor,
                'card-hover',
              )}
            >
              <div className="flex items-start justify-between p-5">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                    {kpi.title}
                  </p>
                  <p className="text-2xl font-bold tracking-tight text-text-primary">
                    {kpi.value}
                  </p>
                  <div
                    className={clsx(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                      isPositiveTrend
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-red-50 text-red-500',
                    )}
                  >
                    {isPositiveTrend ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {Math.abs(kpi.trend)}% vs last month
                  </div>
                </div>
                <div
                  className={clsx(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                    kpi.iconBg,
                  )}
                >
                  <Icon className={clsx('h-5 w-5', kpi.iconColor)} />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* ── 3. Two-column layout ─────────────────────────────── */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── LEFT COLUMN (2/3) ──────────────────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Revenue Overview sparkline */}
          <div className="rounded-xl border border-border-default bg-surface p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  Revenue Overview
                </h2>
                <p className="text-xs text-text-tertiary">
                  Monthly income trend
                </p>
              </div>
              <Link
                href="/dashboards/property"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-hover transition-colors"
              >
                Details <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="h-44 w-full">
              {monthlyIncomeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={monthlyIncomeData}
                    margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="incomeGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#3b82f6"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="#3b82f6"
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="income"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      fill="url(#incomeGradient)"
                      dot={false}
                      activeDot={{
                        r: 4,
                        fill: '#3b82f6',
                        stroke: '#fff',
                        strokeWidth: 2,
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
                  No income data yet
                </div>
              )}
            </div>
            {/* Month labels */}
            {monthlyIncomeData.length > 0 && (
              <div className="mt-2 flex justify-between px-1">
                {monthlyIncomeData.map((d) => (
                  <span
                    key={d.month}
                    className="text-[10px] font-medium text-text-tertiary"
                  >
                    {d.month}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="rounded-xl border border-border-default bg-surface p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-text-primary">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.label}
                    href={action.href}
                    className="card-hover group flex flex-col items-center gap-2.5 rounded-xl border border-border-default bg-surface-secondary p-4 text-center transition-all duration-200 hover:border-primary/30 hover:bg-primary-light"
                  >
                    <div
                      className={clsx(
                        'flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
                        action.bg,
                        'group-hover:bg-primary-light',
                      )}
                    >
                      <Icon
                        className={clsx(
                          'h-5 w-5 transition-colors',
                          action.color,
                          'group-hover:text-primary',
                        )}
                      />
                    </div>
                    <span className="text-xs font-semibold text-text-secondary group-hover:text-primary transition-colors">
                      {action.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN (1/3) ─────────────────────────────── */}
        <div className="space-y-6">
          {/* Recent Activity */}
          <div className="rounded-xl border border-border-default bg-surface p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-text-primary">
                Recent Activity
              </h2>
              <Activity className="h-4 w-4 text-text-tertiary" />
            </div>
            {recentActivity.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-tertiary">
                No transactions recorded yet.
              </p>
            ) : (
              <div className="space-y-0">
                {recentActivity.map((item, idx) => {
                  const isIncome = item.type === 'income';
                  return (
                    <div key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
                      {/* Timeline line */}
                      {idx < recentActivity.length - 1 && (
                        <div className="absolute left-[7px] top-5 h-full w-px bg-border-default" />
                      )}
                      {/* Timeline dot */}
                      <div
                        className={clsx(
                          'relative z-10 mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-2',
                          isIncome
                            ? 'border-emerald-400 bg-emerald-100'
                            : 'border-red-400 bg-red-100',
                        )}
                      />
                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text-primary">
                          {item.description}
                        </p>
                        <div className="mt-0.5 flex items-center justify-between">
                          <span
                            className={clsx(
                              'text-sm font-semibold',
                              isIncome ? 'text-emerald-600' : 'text-red-500',
                            )}
                          >
                            {isIncome ? '+' : '-'}
                            {formatCurrency(item.amount, currency)}
                          </span>
                          <span className="text-[11px] text-text-tertiary">
                            {getRelativeDate(item.date)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Properties Overview */}
          <div className="rounded-xl border border-border-default bg-surface p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-text-primary">
                Properties Overview
              </h2>
              <Link
                href="/setup"
                className="text-xs font-medium text-primary hover:text-primary-hover transition-colors"
              >
                Manage
              </Link>
            </div>
            <div className="space-y-3">
              {propertyStats.map((prop) => {
                const isExpanded = expandedPropertyId === prop.id;
                const propUnits = getPropertyUnits(prop.id);

                return (
                  <div
                    key={prop.id}
                    className="rounded-lg border border-border-light bg-surface-secondary overflow-hidden transition-colors"
                  >
                    <button
                      onClick={() => toggleProperty(prop.id)}
                      className="w-full p-3 text-left transition-colors hover:bg-surface-hover cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex items-start gap-2">
                          <ChevronDown
                            className={clsx(
                              'h-4 w-4 mt-0.5 shrink-0 text-text-tertiary transition-transform duration-200',
                              !isExpanded && '-rotate-90',
                            )}
                          />
                          <div>
                            <p className="truncate text-sm font-semibold text-text-primary">
                              {prop.name}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="inline-flex items-center rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                                {prop.type}
                              </span>
                              <span className="text-[11px] text-text-tertiary">
                                {prop.unitCount} units
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={clsx(
                              'text-xs font-bold',
                              prop.occupancy >= 80
                                ? 'text-emerald-600'
                                : prop.occupancy >= 50
                                  ? 'text-amber-600'
                                  : 'text-red-500',
                            )}
                          >
                            {prop.occupancy}%
                          </span>
                          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={clsx(
                                'h-full rounded-full transition-all duration-500',
                                prop.occupancy >= 80
                                  ? 'bg-emerald-500'
                                  : prop.occupancy >= 50
                                    ? 'bg-amber-500'
                                    : 'bg-red-500',
                              )}
                              style={{ width: `${prop.occupancy}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border-light px-3 pb-3">
                        {propUnits.length === 0 ? (
                          <p className="py-3 text-center text-xs text-text-tertiary">No units yet</p>
                        ) : (
                          <div className="mt-2 space-y-1.5">
                            {propUnits.map((unit) => (
                              <div
                                key={unit.id}
                                className="flex items-center gap-2 rounded-md bg-white border border-border-light px-2.5 py-1.5"
                              >
                                {editingUnitId === unit.id ? (
                                  <>
                                    <input
                                      value={editUnitForm.unitNumber}
                                      onChange={(e) => setEditUnitForm((f) => ({ ...f, unitNumber: e.target.value }))}
                                      className="w-20 rounded border border-slate-200 px-1.5 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
                                      placeholder="Unit #"
                                      autoFocus
                                    />
                                    <input
                                      value={editUnitForm.address}
                                      onChange={(e) => setEditUnitForm((f) => ({ ...f, address: e.target.value }))}
                                      className="min-w-0 flex-1 rounded border border-slate-200 px-1.5 py-0.5 text-xs focus:border-blue-500 focus:outline-none"
                                      placeholder="Address"
                                    />
                                    <button onClick={saveEditUnit} className="text-emerald-500 hover:text-emerald-700 p-0.5 cursor-pointer" title="Save">
                                      <Check size={13} />
                                    </button>
                                    <button onClick={cancelEditUnit} className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer" title="Cancel">
                                      <X size={13} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => startEditUnit(unit)}
                                      className="min-w-0 flex-1 flex items-center gap-2 text-left cursor-pointer hover:opacity-70 transition-opacity"
                                      title="Click to edit"
                                    >
                                      <span className="text-xs font-medium text-text-primary shrink-0">
                                        {unit.unitNumber}
                                      </span>
                                      <span className="text-[11px] text-text-tertiary truncate">
                                        {unit.address || 'No address'}
                                      </span>
                                    </button>
                                    <button
                                      onClick={() => setDeleteUnitConfirmId(unit.id)}
                                      className="text-red-300 hover:text-red-500 p-0.5 shrink-0 cursor-pointer transition-colors"
                                      title="Delete unit"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => handleAddUnit(prop.id)}
                          className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 py-1.5 text-xs font-medium text-slate-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-colors cursor-pointer"
                        >
                          <Plus size={12} /> Add Unit
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delete Unit Confirmation */}
          <Modal open={!!deleteUnitConfirmId} onClose={() => setDeleteUnitConfirmId(null)} title="Delete Unit"
            subtitle="This action cannot be undone."
            size="sm"
            footer={<>
              <button onClick={() => setDeleteUnitConfirmId(null)} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">Cancel</button>
              <button onClick={confirmDeleteUnit} className="rounded-lg bg-red-600 text-white hover:bg-red-700 px-4 py-2 text-sm font-medium cursor-pointer shadow-sm">Delete</button>
            </>}
          >
            <p className="text-sm text-slate-600">Are you sure you want to delete this unit?</p>
          </Modal>
        </div>
      </section>

      {/* ── 4. Bottom Row: Top Properties by Revenue ─────────── */}
      <section className="rounded-xl border border-border-default bg-surface p-5 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Top Properties by Revenue
            </h2>
            <p className="text-xs text-text-tertiary">
              All-time collected income
            </p>
          </div>
          <Building2 className="h-5 w-5 text-text-tertiary" />
        </div>
        {topProperties.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-tertiary">
            No revenue data yet.
          </p>
        ) : (
          <div className="space-y-4">
            {topProperties.map((prop, idx) => {
              const barWidth =
                maxRevenue > 0
                  ? Math.max(8, Math.round((prop.revenue / maxRevenue) * 100))
                  : 0;
              const colors = [
                { bar: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-200' },
                { bar: 'bg-violet-500', bg: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-200' },
                { bar: 'bg-cyan-500', bg: 'bg-cyan-50', text: 'text-cyan-700', ring: 'ring-cyan-200' },
              ];
              const c = colors[idx] || colors[0];

              return (
                <div key={prop.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={clsx(
                          'flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-bold ring-1',
                          c.bg,
                          c.text,
                          c.ring,
                        )}
                      >
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-text-primary">
                        {prop.name}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-text-primary">
                      {formatCurrency(prop.revenue, currency)}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={clsx(
                        'h-full rounded-full transition-all duration-700 ease-out',
                        c.bar,
                      )}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
