'use client';

import { useState, useMemo } from 'react';
import { useSetupStore, useTenantStore, useLeaseStore, useIncomeStore } from '@/lib/store';

export default function TenantLedgerPage() {
  const { properties, units, currency } = useSetupStore();
  const { tenants } = useTenantStore();
  const { leases } = useLeaseStore();
  const { records } = useIncomeStore();

  const [showCurrentOnly, setShowCurrentOnly] = useState(true);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('');

  // --- Filtered units based on selected property ---
  const filteredUnits = useMemo(() => {
    if (!selectedPropertyId) return [];
    return units.filter((u) => u.propertyId === selectedPropertyId);
  }, [units, selectedPropertyId]);

  // --- Filtered tenants based on selected unit and lease data ---
  const filteredTenants = useMemo(() => {
    if (!selectedUnitId) return [];
    const relevantLeases = leases.filter(
      (l) =>
        l.unitId === selectedUnitId &&
        (!showCurrentOnly || l.isCurrentTenant)
    );
    const tenantIds = [...new Set(relevantLeases.map((l) => l.tenantId))];
    return tenants.filter((t) => tenantIds.includes(t.id));
  }, [tenants, leases, selectedUnitId, showCurrentOnly]);

  // --- Selected tenant data ---
  const selectedTenant = useMemo(
    () => tenants.find((t) => t.id === selectedTenantId) ?? null,
    [tenants, selectedTenantId]
  );

  // --- Selected lease for the tenant/unit combination ---
  const selectedLease = useMemo(() => {
    if (!selectedUnitId || !selectedTenantId) return null;
    return (
      leases.find(
        (l) =>
          l.unitId === selectedUnitId &&
          l.tenantId === selectedTenantId
      ) ?? null
    );
  }, [leases, selectedUnitId, selectedTenantId]);

  // --- Income records for the selected tenant ---
  const tenantRecords = useMemo(() => {
    if (!selectedTenantId) return [];
    return records
      .filter((r) => r.tenantId === selectedTenantId)
      .sort((a, b) => a.rentDueDate.localeCompare(b.rentDueDate));
  }, [records, selectedTenantId]);

  // --- Financial summaries ---
  const totalAmountDue = useMemo(
    () => tenantRecords.reduce((sum, r) => sum + r.totalDue, 0),
    [tenantRecords]
  );

  const totalOutstandingBalance = useMemo(
    () => tenantRecords.reduce((sum, r) => sum + r.outstandingBalance, 0),
    [tenantRecords]
  );

  // --- Lease length calculation ---
  const leaseLength = useMemo(() => {
    if (!selectedLease) return '';
    const start = new Date(selectedLease.leaseStart);
    const end = new Date(selectedLease.leaseEnd);
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
    return `${months} month${months !== 1 ? 's' : ''}`;
  }, [selectedLease]);

  // --- Color-coded status logic ---
  const tenantStatus = useMemo<'green' | 'amber' | 'red' | null>(() => {
    if (tenantRecords.length === 0) return null;

    // RED: any outstanding balance exists
    const hasOutstanding = tenantRecords.some((r) => r.outstandingBalance > 0);
    if (hasOutstanding) return 'red';

    // YELLOW: all paid/overpaid but some have delays
    const allPaidOrOverpaid = tenantRecords.every(
      (r) => r.paymentStatus === 'Paid' || r.paymentStatus === 'Overpaid'
    );
    const hasDelays = tenantRecords.some((r) => r.delayDays > 0);
    if (allPaidOrOverpaid && hasDelays) return 'amber';

    // GREEN: all paid on time
    if (allPaidOrOverpaid && !hasDelays) return 'green';

    return null;
  }, [tenantRecords]);

  const statusLabel = useMemo(() => {
    switch (tenantStatus) {
      case 'green':
        return 'Excellent - Always on time';
      case 'amber':
        return 'Caution - History of late payments';
      case 'red':
        return 'Alert - Outstanding balance';
      default:
        return 'No data';
    }
  }, [tenantStatus]);

  const statusBadgeClasses = useMemo(() => {
    switch (tenantStatus) {
      case 'green':
        return 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-300 shadow-sm';
      case 'amber':
        return 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border border-amber-300 shadow-sm';
      case 'red':
        return 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border border-red-300 shadow-sm';
      default:
        return 'bg-gradient-to-r from-slate-100 to-slate-50 text-slate-500 border border-slate-300';
    }
  }, [tenantStatus]);

  const statusDotClasses = useMemo(() => {
    switch (tenantStatus) {
      case 'green':
        return 'bg-green-500';
      case 'amber':
        return 'bg-amber-500';
      case 'red':
        return 'bg-red-500';
      default:
        return 'bg-slate-400';
    }
  }, [tenantStatus]);

  // --- Payment status badge helper ---
  function paymentStatusBadge(status: string) {
    const map: Record<string, string> = {
      Paid: 'bg-gradient-to-r from-green-100 to-emerald-50 text-green-800 border border-green-200',
      Overpaid: 'bg-gradient-to-r from-blue-100 to-sky-50 text-blue-800 border border-blue-200',
      'Partially Paid': 'bg-gradient-to-r from-amber-100 to-yellow-50 text-amber-800 border border-amber-200',
      Unpaid: 'bg-gradient-to-r from-red-100 to-rose-50 text-red-800 border border-red-200',
      Pending: 'bg-gradient-to-r from-slate-100 to-slate-50 text-slate-600 border border-slate-200',
    };
    return map[status] ?? 'bg-gradient-to-r from-slate-100 to-slate-50 text-slate-600 border border-slate-200';
  }

  // --- Format helpers ---
  function fmt(n: number) {
    return `${currency}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function fmtDate(d: string) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  // --- Handlers ---
  function handlePropertyChange(id: string) {
    setSelectedPropertyId(id);
    setSelectedUnitId('');
    setSelectedTenantId('');
  }

  function handleUnitChange(id: string) {
    setSelectedUnitId(id);
    setSelectedTenantId('');
  }

  function handleTenantChange(id: string) {
    setSelectedTenantId(id);
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tenant Ledger</h1>
            <p className="text-sm text-slate-500 mt-1">Track tenant payment history, outstanding balances, and payment behavior</p>
          </div>
        </div>
      </div>

      {/* ─── Top Selection Section ─────────────────────────────────── */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-amber-700">
          Select Tenant
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Show current tenants only */}
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showCurrentOnly}
              onChange={(e) => {
                setShowCurrentOnly(e.target.checked);
                setSelectedTenantId('');
              }}
              className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            Show current tenants only
          </label>

          {/* Property dropdown */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">
              Property
            </label>
            <select
              value={selectedPropertyId}
              onChange={(e) => handlePropertyChange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all cursor-pointer hover:border-slate-300"
            >
              <option value="">-- Select Property --</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Unit dropdown */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">
              Unit
            </label>
            <select
              value={selectedUnitId}
              onChange={(e) => handleUnitChange(e.target.value)}
              disabled={!selectedPropertyId}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all cursor-pointer hover:border-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="">-- Select Unit --</option>
              {filteredUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  Unit {u.unitNumber}
                </option>
              ))}
            </select>
          </div>

          {/* Tenant dropdown */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">
              Tenant
            </label>
            <select
              value={selectedTenantId}
              onChange={(e) => handleTenantChange(e.target.value)}
              disabled={!selectedUnitId}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all cursor-pointer hover:border-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="">-- Select Tenant --</option>
              {filteredTenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ─── Tenant Info Section ──────────────────────────────────── */}
      {selectedTenant && selectedLease ? (
        <>
          {/* Status Badge */}
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold ${statusBadgeClasses}`}
            >
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${statusDotClasses}`} />
              {statusLabel}
            </span>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {/* Contact */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Contact Information
              </h3>
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-slate-400">Name</span>
                  <p className="text-sm font-medium text-slate-800">
                    {selectedTenant.name}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Email</span>
                  <p className="text-sm font-medium text-slate-800">
                    {selectedTenant.email}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Phone</span>
                  <p className="text-sm font-medium text-slate-800">
                    {selectedTenant.phone}
                  </p>
                </div>
              </div>
            </div>

            {/* Lease Info */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Lease Information
              </h3>
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-slate-400">Lease Length</span>
                  <p className="text-sm font-medium text-slate-800">
                    {leaseLength}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">Start Date</span>
                  <p className="text-sm font-medium text-slate-800">
                    {fmtDate(selectedLease.leaseStart)}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400">End Date</span>
                  <p className="text-sm font-medium text-slate-800">
                    {fmtDate(selectedLease.leaseEnd)}
                  </p>
                </div>
              </div>
            </div>

            {/* Financial KPI Cards */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-blue-500">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Monthly Rent</p>
              <p className="text-2xl font-bold text-blue-700 mt-1.5 tracking-tight">{fmt(selectedLease.monthlyRent)}</p>
              <p className="text-xs text-slate-400 mt-1">Per lease agreement</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 border-l-cyan-500">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Amount Due</p>
              <p className="text-2xl font-bold text-cyan-700 mt-1.5 tracking-tight">{fmt(totalAmountDue)}</p>
              <p className="text-xs text-slate-400 mt-1">{`Across ${tenantRecords.length} record${tenantRecords.length !== 1 ? 's' : ''}`}</p>
            </div>
            <div className={`bg-white rounded-xl border border-slate-200 shadow-sm p-5 border-l-4 ${totalOutstandingBalance > 0 ? 'border-l-red-500' : 'border-l-emerald-500'}`}>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Outstanding Balance</p>
              <p className={`text-2xl font-bold mt-1.5 tracking-tight ${totalOutstandingBalance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{fmt(totalOutstandingBalance)}</p>
              <p className="text-xs text-slate-400 mt-1">{totalOutstandingBalance > 0 ? 'Payment required' : 'Fully settled'}</p>
            </div>
          </div>

          {/* ─── Payment History Table ──────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-md">
            <div className="border-b border-slate-200 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-700">
                Payment History
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete payment record for {selectedTenant.name}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-left">
                    <th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Due Date</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Rent Amount
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Additional Income
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Total Due
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Payment Date
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Amount Paid
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Outstanding
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Delay (days)
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Method</th>
                  </tr>
                </thead>
                <tbody>
                  {tenantRecords.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-8 text-center text-slate-400"
                      >
                        No payment records found for this tenant.
                      </td>
                    </tr>
                  ) : (
                    tenantRecords.map((r, idx) => (
                      <tr
                        key={r.id}
                        className={`border-b border-slate-100 hover:bg-blue-50/30 transition-colors ${
                          idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'
                        }`}
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                          {fmtDate(r.rentDueDate)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">
                          {fmt(r.rentAmount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">
                          {r.additionalIncome > 0
                            ? fmt(r.additionalIncome)
                            : '-'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-700">
                          {fmt(r.totalDue)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {fmtDate(r.paymentDate)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-slate-700">
                          {fmt(r.amountPaid)}
                        </td>
                        <td
                          className={`whitespace-nowrap px-4 py-3 text-right font-medium ${
                            r.outstandingBalance > 0
                              ? 'text-red-600'
                              : r.outstandingBalance < 0
                                ? 'text-blue-600'
                                : 'text-green-600'
                          }`}
                        >
                          {fmt(r.outstandingBalance)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${paymentStatusBadge(r.paymentStatus)}`}
                          >
                            {r.paymentStatus}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center">
                          {r.delayDays > 0 ? (
                            <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                              {r.delayDays}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {r.paymentMethod || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* ─── Empty State ──────────────────────────────────────────── */
        <div className="mt-10 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <svg
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-700">
            No Tenant Selected
          </h3>
          <p className="mt-1 max-w-sm text-sm text-slate-400">
            Use the selection filters above to choose a property, unit, and
            tenant to view their payment ledger.
          </p>
        </div>
      )}
    </div>
  );
}
