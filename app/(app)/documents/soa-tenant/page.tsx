'use client';

import { useState, useMemo } from 'react';
import { FileDown, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSetupStore, useTenantStore, useLeaseStore, useIncomeStore } from '@/lib/store';

export default function SOATenantPage() {
  const { properties, units, currency, ownerInfo } = useSetupStore();
  const { tenants } = useTenantStore();
  const { leases } = useLeaseStore();
  const { records } = useIncomeStore();

  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [generating, setGenerating] = useState(false);

  const filteredUnits = useMemo(() => {
    if (!selectedPropertyId) return [];
    return units.filter((u) => u.propertyId === selectedPropertyId);
  }, [units, selectedPropertyId]);

  const filteredTenants = useMemo(() => {
    if (!selectedUnitId) return [];
    const tenantIds = [...new Set(leases.filter((l) => l.unitId === selectedUnitId).map((l) => l.tenantId))];
    return tenants.filter((t) => tenantIds.includes(t.id));
  }, [tenants, leases, selectedUnitId]);

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId);
  const selectedLease = leases.find((l) => l.unitId === selectedUnitId && l.tenantId === selectedTenantId);
  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);
  const selectedUnit = units.find((u) => u.id === selectedUnitId);

  const filteredRecords = useMemo(() => {
    if (!selectedTenantId) return [];
    return records
      .filter((r) => {
        if (r.tenantId !== selectedTenantId) return false;
        if (dateFrom && r.rentDueDate < dateFrom) return false;
        if (dateTo && r.rentDueDate > dateTo) return false;
        return true;
      })
      .sort((a, b) => a.rentDueDate.localeCompare(b.rentDueDate));
  }, [records, selectedTenantId, dateFrom, dateTo]);

  const totalBilled = filteredRecords.reduce((s, r) => s + r.totalDue, 0);
  const totalPaid = filteredRecords.reduce((s, r) => s + r.amountPaid, 0);
  const outstanding = filteredRecords.reduce((s, r) => s + r.outstandingBalance, 0);

  function fmt(n: number) {
    return `${currency}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  async function handleDownload() {
    if (!selectedTenant || !selectedLease || !selectedProperty || !selectedUnit) return;
    setGenerating(true);
    try {
      const { generateTenantSOA } = await import('@/lib/pdf/soaTenantPdf');
      const doc = generateTenantSOA({
        owner: ownerInfo,
        tenant: selectedTenant,
        lease: selectedLease,
        property: selectedProperty,
        unit: selectedUnit,
        records: filteredRecords,
        currency,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      doc.save(`SOA_${selectedTenant.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setGenerating(false);
    }
  }

  function handlePropertyChange(id: string) {
    setSelectedPropertyId(id);
    setSelectedUnitId('');
    setSelectedTenantId('');
  }

  function handleUnitChange(id: string) {
    setSelectedUnitId(id);
    setSelectedTenantId('');
  }

  const canDownload = selectedTenant && selectedLease && selectedProperty && selectedUnit && filteredRecords.length > 0;

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <Link href="/documents" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors mb-4">
          <ArrowLeft size={14} /> Back to Documents
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tenant Statement of Account</h1>
        <p className="text-sm text-slate-500 mt-1">Select a tenant and date range, then download the statement as PDF.</p>
      </div>

      {/* ── Selector Panel ── */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-blue-700">Select Tenant &amp; Period</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Property</label>
            <select value={selectedPropertyId} onChange={(e) => handlePropertyChange(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all cursor-pointer hover:border-slate-300">
              <option value="">-- Select --</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Unit</label>
            <select value={selectedUnitId} onChange={(e) => handleUnitChange(e.target.value)} disabled={!selectedPropertyId} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all cursor-pointer hover:border-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
              <option value="">-- Select --</option>
              {filteredUnits.map((u) => <option key={u.id} value={u.id}>Unit {u.unitNumber}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Tenant</label>
            <select value={selectedTenantId} onChange={(e) => setSelectedTenantId(e.target.value)} disabled={!selectedUnitId} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all cursor-pointer hover:border-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
              <option value="">-- Select --</option>
              {filteredTenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" />
          </div>
        </div>
      </div>

      {/* ── Preview ── */}
      {selectedTenant && selectedLease ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-blue-500">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Records</p>
              <p className="text-2xl font-bold text-blue-700 mt-1.5">{filteredRecords.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-cyan-500">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Billed</p>
              <p className="text-2xl font-bold text-cyan-700 mt-1.5">{fmt(totalBilled)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-emerald-500">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Paid</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1.5">{fmt(totalPaid)}</p>
            </div>
            <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 ${outstanding > 0 ? 'border-l-red-500' : 'border-l-emerald-500'}`}>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Outstanding</p>
              <p className={`text-2xl font-bold mt-1.5 ${outstanding > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmt(outstanding)}</p>
            </div>
          </div>

          <button
            onClick={handleDownload}
            disabled={!canDownload || generating}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
          >
            <FileDown size={18} />
            {generating ? 'Generating...' : 'Download PDF'}
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <FileDown size={28} />
          </div>
          <h3 className="text-lg font-semibold text-slate-700">Select a Tenant</h3>
          <p className="mt-1 max-w-sm text-sm text-slate-400">
            Choose a property, unit, and tenant above to preview the statement and download the PDF.
          </p>
        </div>
      )}
    </div>
  );
}
