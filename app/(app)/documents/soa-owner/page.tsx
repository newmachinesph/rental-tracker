'use client';

import { useState, useMemo } from 'react';
import { FileDown, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSetupStore, useTenantStore, useIncomeStore, useExpenseStore } from '@/lib/store';

export default function SOAOwnerPage() {
  const { properties, units, currency, ownerInfo } = useSetupStore();
  const { tenants } = useTenantStore();
  const { records: incomeRecords } = useIncomeStore();
  const { records: expenseRecords } = useExpenseStore();

  const [selectedPropertyId, setSelectedPropertyId] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [generating, setGenerating] = useState(false);

  const filteredProperties = useMemo(() => {
    if (selectedPropertyId === 'all') return properties;
    return properties.filter((p) => p.id === selectedPropertyId);
  }, [properties, selectedPropertyId]);

  const filteredIncome = useMemo(() => {
    return incomeRecords.filter((r) => {
      if (selectedPropertyId !== 'all' && r.propertyId !== selectedPropertyId) return false;
      if (dateFrom && r.rentDueDate < dateFrom) return false;
      if (dateTo && r.rentDueDate > dateTo) return false;
      return true;
    });
  }, [incomeRecords, selectedPropertyId, dateFrom, dateTo]);

  const filteredExpenses = useMemo(() => {
    return expenseRecords.filter((r) => {
      if (selectedPropertyId !== 'all' && r.propertyId !== selectedPropertyId) return false;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      return true;
    });
  }, [expenseRecords, selectedPropertyId, dateFrom, dateTo]);

  const grossIncome = filteredIncome.reduce((s, r) => s + r.amountPaid, 0);
  const totalExpenses = filteredExpenses.reduce((s, r) => s + r.total, 0);
  const netProfit = grossIncome - totalExpenses;
  const margin = grossIncome > 0 ? ((netProfit / grossIncome) * 100).toFixed(1) : '0.0';

  function fmt(n: number) {
    return `${currency}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  async function handleDownload() {
    setGenerating(true);
    try {
      const { generateOwnerSOA } = await import('@/lib/pdf/soaOwnerPdf');
      const doc = generateOwnerSOA({
        owner: ownerInfo,
        properties: filteredProperties,
        units,
        tenants,
        incomeRecords: filteredIncome,
        expenseRecords: filteredExpenses,
        currency,
        dateFrom,
        dateTo,
      });
      doc.save(`OwnerSOA_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setGenerating(false);
    }
  }

  const canDownload = filteredIncome.length > 0 || filteredExpenses.length > 0;

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <Link href="/documents" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors mb-4">
          <ArrowLeft size={14} /> Back to Documents
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Owner Statement of Account</h1>
        <p className="text-sm text-slate-500 mt-1">View income vs expenses by property and download as PDF.</p>
      </div>

      {/* ── Filter Panel ── */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-emerald-700">Filters</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Property</label>
            <select value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none transition-all cursor-pointer hover:border-slate-300">
              <option value="all">All Properties</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none transition-all" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 focus:outline-none transition-all" />
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-emerald-500">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Gross Income</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1.5">{fmt(grossIncome)}</p>
          <p className="text-xs text-slate-400 mt-1">{filteredIncome.length} records</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-red-500">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Expenses</p>
          <p className="text-2xl font-bold text-red-700 mt-1.5">{fmt(totalExpenses)}</p>
          <p className="text-xs text-slate-400 mt-1">{filteredExpenses.length} records</p>
        </div>
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 ${netProfit >= 0 ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Net Profit</p>
          <p className={`text-2xl font-bold mt-1.5 ${netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(netProfit)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-blue-500">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Profit Margin</p>
          <p className="text-2xl font-bold text-blue-700 mt-1.5">{margin}%</p>
        </div>
      </div>

      <button
        onClick={handleDownload}
        disabled={!canDownload || generating}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
      >
        <FileDown size={18} />
        {generating ? 'Generating...' : 'Download PDF'}
      </button>
    </div>
  );
}
