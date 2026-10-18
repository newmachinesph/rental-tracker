'use client';

import { useState, useMemo } from 'react';
import { useSetupStore, useTenantStore, useLeaseStore, useIncomeStore } from '@/lib/store';
import { AlertCircle, Phone, Mail, Calendar, DollarSign, Users, Clock, Check, X, Building2 } from 'lucide-react';

interface ReminderRow {
  id: string;
  propertyId: string;
  unitId: string;
  tenantId: string;
  propertyName: string;
  unitNumber: string;
  tenantName: string;
  tenantPhone: string;
  tenantEmail: string;
  rentDueDate: string;
  totalDue: number;
  amountPaid: number;
  outstandingBalance: number;
  delayDays: number;
  paymentStatus: string;
}

export default function RentRemindersPage() {
  const { properties, units, currency, paymentMethods } = useSetupStore();
  const { tenants } = useTenantStore();
  const { leases } = useLeaseStore();
  const { records, updateRecord } = useIncomeStore();

  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [contactedIds, setContactedIds] = useState<Set<string>>(new Set());

  // Payment modal state
  const [paymentModal, setPaymentModal] = useState<ReminderRow | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  // Get all records with outstanding balance
  const reminders = useMemo<ReminderRow[]>(() => {
    const today = new Date();

    return records
      .filter((r) => {
        const hasBalance = r.outstandingBalance > 0;
        const isUnpaid = r.paymentStatus === 'Unpaid' || r.paymentStatus === 'Partially Paid' || r.paymentStatus === 'Pending';

        if (selectedPropertyId && r.propertyId !== selectedPropertyId) {
          return false;
        }

        return hasBalance || isUnpaid;
      })
      .map((r) => {
        const property = properties.find((p) => p.id === r.propertyId);
        const unit = units.find((u) => u.id === r.unitId);
        const tenant = tenants.find((t) => t.id === r.tenantId);

        let daysOverdue = 0;
        if (r.rentDueDate) {
          const dueDate = new Date(r.rentDueDate);
          if (today > dueDate) {
            daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          }
        }

        return {
          id: r.id,
          propertyId: r.propertyId,
          unitId: r.unitId,
          tenantId: r.tenantId,
          propertyName: property?.name ?? 'Unknown',
          unitNumber: unit?.unitNumber ?? 'Unknown',
          tenantName: tenant?.name ?? 'Unknown',
          tenantPhone: tenant?.phone ?? '-',
          tenantEmail: tenant?.email ?? '-',
          rentDueDate: r.rentDueDate,
          totalDue: r.totalDue,
          amountPaid: r.amountPaid,
          outstandingBalance: r.outstandingBalance,
          delayDays: daysOverdue,
          paymentStatus: r.paymentStatus,
        };
      })
      .sort((a, b) => {
        if (b.delayDays !== a.delayDays) return b.delayDays - a.delayDays;
        return b.outstandingBalance - a.outstandingBalance;
      });
  }, [records, properties, units, tenants, selectedPropertyId]);

  const pendingReminders = reminders.filter(r => !contactedIds.has(r.id));
  const contactedReminders = reminders.filter(r => contactedIds.has(r.id));

  // Summary statistics
  const totalOutstanding = useMemo(
    () => pendingReminders.reduce((sum, r) => sum + r.outstandingBalance, 0),
    [pendingReminders]
  );

  // Toggle contacted status
  function toggleContacted(id: string) {
    setContactedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Open payment modal
  function openPaymentModal(reminder: ReminderRow) {
    setPaymentModal(reminder);
    setPaymentAmount(reminder.outstandingBalance.toString());
    setPaymentMethod('Bank Transfer');
    setPaymentDate(new Date().toISOString().split('T')[0]);
  }

  // Record payment
  function handleRecordPayment() {
    if (!paymentModal) return;

    const amount = parseFloat(paymentAmount) || 0;
    if (amount <= 0) return;

    const originalRecord = records.find(r => r.id === paymentModal.id);
    if (!originalRecord) return;

    const newAmountPaid = originalRecord.amountPaid + amount;

    updateRecord(paymentModal.id, {
      amountPaid: newAmountPaid,
      paymentDate: paymentDate,
      paymentMethod: paymentMethod,
    });

    setPaymentModal(null);
    setPaymentAmount('');
  }

  // Format helpers
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

  function getOverdueBadge(days: number) {
    if (days >= 30) return 'bg-red-500 text-white';
    if (days >= 14) return 'bg-orange-500 text-white';
    if (days >= 7) return 'bg-amber-500 text-white';
    if (days > 0) return 'bg-yellow-500 text-white';
    return 'bg-slate-400 text-white';
  }

  function getStatusBadge(status: string) {
    const map: Record<string, string> = {
      'Partially Paid': 'bg-amber-100 text-amber-800',
      Unpaid: 'bg-red-100 text-red-800',
      Pending: 'bg-slate-100 text-slate-600',
    };
    return map[status] ?? 'bg-slate-100 text-slate-600';
  }

  // Render reminder card
  function renderCard(r: ReminderRow, isContacted: boolean) {
    return (
      <div
        key={r.id}
        className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
          isContacted
            ? 'border-green-300 bg-green-50/50 opacity-70'
            : 'border-slate-200 hover:shadow-md'
        }`}
      >
        {/* Header with status */}
        <div className={`px-4 py-3 flex items-center justify-between ${isContacted ? 'bg-green-100' : 'bg-slate-50'}`}>
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-slate-400" />
            <span className="font-medium text-slate-700">{r.propertyName}</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-600">Unit {r.unitNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            {r.delayDays > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getOverdueBadge(r.delayDays)}`}>
                {r.delayDays} days overdue
              </span>
            )}
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusBadge(r.paymentStatus)}`}>
              {r.paymentStatus}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          {/* Tenant Info */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">{r.tenantName}</h3>
              <div className="flex flex-col gap-1 mt-1">
                <a href={`tel:${r.tenantPhone}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                  <Phone size={14} />
                  {r.tenantPhone}
                </a>
                <a href={`mailto:${r.tenantEmail}`} className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                  <Mail size={14} />
                  {r.tenantEmail}
                </a>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 uppercase">Outstanding</p>
              <p className="text-2xl font-bold text-red-600">{fmt(r.outstandingBalance)}</p>
            </div>
          </div>

          {/* Payment Details */}
          <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-slate-50 rounded-lg">
            <div>
              <p className="text-xs text-slate-400">Due Date</p>
              <p className="text-sm font-medium text-slate-700">{fmtDate(r.rentDueDate)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Total Due</p>
              <p className="text-sm font-medium text-slate-700">{fmt(r.totalDue)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Amount Paid</p>
              <p className="text-sm font-medium text-slate-700">{fmt(r.amountPaid)}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => toggleContacted(r.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all cursor-pointer ${
                isContacted
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <Check size={18} />
              {isContacted ? 'Contacted' : 'Mark Contacted'}
            </button>
            <button
              onClick={() => openPaymentModal(r)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-all cursor-pointer"
            >
              <DollarSign size={18} />
              Record Payment
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Rent Reminders</h1>
            <p className="text-sm text-slate-500 mt-1">Track and follow up on unpaid rent</p>
          </div>
          {contactedIds.size > 0 && (
            <button
              onClick={() => setContactedIds(new Set())}
              className="text-sm text-slate-500 hover:text-slate-700 underline cursor-pointer"
            >
              Clear all contacted ({contactedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-4">
          <label className="text-sm font-medium text-slate-600">Filter by Property:</label>
          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-colors cursor-pointer hover:border-slate-300"
          >
            <option value="">All Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Total Outstanding</p>
              <p className="text-xl font-bold text-red-600">{fmt(totalOutstanding)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <AlertCircle size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Pending</p>
              <p className="text-xl font-bold text-amber-600">{pendingReminders.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
              <Check size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Contacted</p>
              <p className="text-xl font-bold text-green-600">{contactedReminders.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <Users size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Total Reminders</p>
              <p className="text-xl font-bold text-blue-600">{reminders.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reminders List */}
      {reminders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="flex flex-col items-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
              <Check size={32} />
            </div>
            <h3 className="text-lg font-semibold text-slate-700">All Caught Up!</h3>
            <p className="text-sm text-slate-400 mt-1">No outstanding rent payments to follow up on.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending Reminders */}
          {pendingReminders.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-500" />
                Pending Follow-up ({pendingReminders.length})
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {pendingReminders.map((r) => renderCard(r, false))}
              </div>
            </div>
          )}

          {/* Contacted Reminders */}
          {contactedReminders.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Check size={16} className="text-green-500" />
                Contacted ({contactedReminders.length})
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {contactedReminders.map((r) => renderCard(r, true))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Record Payment</h3>
                <p className="text-sm text-slate-500">{paymentModal.tenantName} - Unit {paymentModal.unitNumber}</p>
              </div>
              <button
                onClick={() => setPaymentModal(null)}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Outstanding info */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-red-700">Outstanding Balance:</span>
                  <span className="text-2xl font-bold text-red-700">{fmt(paymentModal.outstandingBalance)}</span>
                </div>
              </div>

              {/* Payment amount */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Payment Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">{currency}</span>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-3 text-lg font-semibold text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>

              {/* Payment date */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none"
                />
              </div>

              {/* Payment method */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-colors cursor-pointer hover:border-slate-300"
                >
                  {paymentMethods.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <button
                onClick={() => setPaymentModal(null)}
                className="flex-1 px-4 py-3 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayment}
                className="flex-1 px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
