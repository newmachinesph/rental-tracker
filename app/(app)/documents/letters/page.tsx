'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  FileDown, ArrowLeft, Bell, AlertTriangle, RefreshCw, XCircle,
  Home, LogOut as LogOutIcon, Wrench, CheckCircle2, Edit3, RotateCcw,
} from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { useSetupStore, useTenantStore, useLeaseStore, useIncomeStore, useMaintenanceStore } from '@/lib/store';
import type { LucideIcon } from 'lucide-react';

const LETTER_TYPES = [
  { id: 'rent-reminder', label: 'Rent Reminder', icon: Bell, color: 'text-blue-600 bg-blue-100' },
  { id: 'late-payment', label: 'Late Payment Notice', icon: AlertTriangle, color: 'text-red-600 bg-red-100' },
  { id: 'lease-renewal', label: 'Lease Renewal', icon: RefreshCw, color: 'text-emerald-600 bg-emerald-100' },
  { id: 'lease-termination', label: 'Lease Termination', icon: XCircle, color: 'text-amber-600 bg-amber-100' },
  { id: 'move-in', label: 'Move-In Welcome', icon: Home, color: 'text-purple-600 bg-purple-100' },
  { id: 'move-out', label: 'Move-Out Notice', icon: LogOutIcon, color: 'text-slate-600 bg-slate-100' },
  { id: 'maintenance-confirm', label: 'Maintenance Confirmation', icon: Wrench, color: 'text-orange-600 bg-orange-100' },
  { id: 'maintenance-complete', label: 'Maintenance Completion', icon: CheckCircle2, color: 'text-teal-600 bg-teal-100' },
] as const;

type LetterTypeId = (typeof LETTER_TYPES)[number]['id'];

const INPUT_CLS = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all cursor-pointer hover:border-slate-300';
const DISABLED_CLS = 'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400';

// Helper to format currency
function fmtCurrency(amount: number, currency: string) {
  return `${currency}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Helper to format date
function fmtDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function LettersPageWrapper() {
  return (
    <Suspense>
      <LettersPage />
    </Suspense>
  );
}

function LettersPage() {
  const searchParams = useSearchParams();
  const initialType = (searchParams.get('type') as LetterTypeId) || 'rent-reminder';

  const { properties, units, currency, ownerInfo } = useSetupStore();
  const { tenants } = useTenantStore();
  const { leases } = useLeaseStore();
  const { records } = useIncomeStore();
  const { tasks } = useMaintenanceStore();

  const [letterType, setLetterType] = useState<LetterTypeId>(initialType);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [letterDate, setLetterDate] = useState(new Date().toISOString().slice(0, 10));
  const [generating, setGenerating] = useState(false);

  // Letter-specific fields
  const [newLeaseEnd, setNewLeaseEnd] = useState('');
  const [newMonthlyRent, setNewMonthlyRent] = useState('');
  const [vacateByDate, setVacateByDate] = useState('');
  const [reason, setReason] = useState('');
  const [moveOutDate, setMoveOutDate] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');

  // Customizable letter content
  const [letterSubject, setLetterSubject] = useState('');
  const [letterBody, setLetterBody] = useState('');
  const [isCustomized, setIsCustomized] = useState(false);

  // Cascading filters
  const filteredUnits = useMemo(() => {
    if (!selectedPropertyId) return [];
    return units.filter((u) => u.propertyId === selectedPropertyId);
  }, [units, selectedPropertyId]);

  const filteredTenants = useMemo(() => {
    if (!selectedUnitId) return [];
    const tenantIds = [...new Set(leases.filter((l) => l.unitId === selectedUnitId).map((l) => l.tenantId))];
    return tenants.filter((t) => tenantIds.includes(t.id));
  }, [tenants, leases, selectedUnitId]);

  const filteredTasks = useMemo(() => {
    if (!selectedPropertyId) return [];
    return tasks.filter((t) => {
      if (t.propertyId !== selectedPropertyId) return false;
      if (selectedUnitId && !t.appliesToEntireBuilding && t.unitId !== selectedUnitId) return false;
      return true;
    });
  }, [tasks, selectedPropertyId, selectedUnitId]);

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId);
  const selectedLease = leases.find((l) => l.unitId === selectedUnitId && l.tenantId === selectedTenantId);
  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);
  const selectedUnit = units.find((u) => u.id === selectedUnitId);
  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  // Late payment auto-calculations
  const outstandingBalance = useMemo(() => {
    if (!selectedTenantId) return 0;
    return records.filter((r) => r.tenantId === selectedTenantId).reduce((s, r) => s + r.outstandingBalance, 0);
  }, [records, selectedTenantId]);

  const latestUnpaidRecord = useMemo(() => {
    if (!selectedTenantId) return null;
    return records
      .filter((r) => r.tenantId === selectedTenantId && r.outstandingBalance > 0)
      .sort((a, b) => b.rentDueDate.localeCompare(a.rentDueDate))[0] ?? null;
  }, [records, selectedTenantId]);

  const daysPastDue = useMemo(() => {
    if (!latestUnpaidRecord) return 0;
    const due = new Date(latestUnpaidRecord.rentDueDate);
    const now = new Date();
    return Math.max(0, Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
  }, [latestUnpaidRecord]);

  // Generate default letter content based on type and context
  const getDefaultLetterContent = useMemo(() => {
    if (!selectedTenant || !selectedLease) {
      return { subject: '', body: '' };
    }

    const templates: Record<LetterTypeId, { subject: string; body: string }> = {
      'rent-reminder': {
        subject: 'Rent Payment Reminder',
        body: `This is a friendly reminder that your monthly rent of ${fmtCurrency(selectedLease.monthlyRent, currency)} is due on the 1st of the upcoming month.

Please ensure that your payment is made on time to avoid any late fees or penalties. You may use any of our accepted payment methods including bank transfer, e-transfer, or check.

If you have already submitted your payment, please disregard this notice. Should you have any questions or need to discuss alternative payment arrangements, please do not hesitate to contact us.

We appreciate your prompt attention to this matter and thank you for being a valued tenant.`
      },
      'late-payment': {
        subject: 'Late Rent Payment Notice',
        body: `Our records indicate that your rent payment of ${fmtCurrency(selectedLease.monthlyRent, currency)} due on ${fmtDate(latestUnpaidRecord?.rentDueDate || '')} has not been received. As of the date of this letter, your payment is ${daysPastDue} day(s) overdue.

Your current outstanding balance is ${fmtCurrency(outstandingBalance, currency)}. Please be advised that continued non-payment may result in additional late fees and further action as outlined in your lease agreement.

We strongly urge you to make the full payment at your earliest convenience. If you are experiencing financial difficulties, please contact us immediately so we can discuss possible arrangements.

Please treat this matter as urgent and ensure payment is made within five (5) business days of receiving this notice.`
      },
      'lease-renewal': {
        subject: 'Lease Renewal Offer',
        body: `Your current lease agreement is set to expire on ${fmtDate(selectedLease.leaseEnd)}. We are pleased to offer you the opportunity to renew your lease${newLeaseEnd ? ` for an additional term ending ${fmtDate(newLeaseEnd)}` : ''}.

${newMonthlyRent ? `The monthly rent for the renewal term will be ${fmtCurrency(parseFloat(newMonthlyRent), currency)}, adjusted from the current rate of ${fmtCurrency(selectedLease.monthlyRent, currency)}.` : `The monthly rent will remain at ${fmtCurrency(selectedLease.monthlyRent, currency)} for the renewal term.`}

All other terms and conditions of the lease will remain unchanged unless otherwise specified in the renewal agreement. Please review the enclosed renewal terms carefully.

If you wish to renew, please sign and return the renewal agreement by ${fmtDate(selectedLease.leaseEnd)}. If we do not hear from you by this date, we will assume you do not wish to renew, and the lease will terminate on the current end date.

We value your tenancy and hope you will continue to enjoy your home with us.`
      },
      'lease-termination': {
        subject: 'Lease Termination Notice',
        body: `This letter serves as formal notice that your lease agreement will not be renewed and will terminate as scheduled. You are required to vacate the premises no later than ${fmtDate(vacateByDate)}.

${reason ? `Reason for termination: ${reason}\n\n` : ''}Please ensure that the unit is returned in the same condition as it was at the commencement of your lease, subject to normal wear and tear. A move-out inspection will be scheduled prior to your departure.

Your security deposit will be returned in accordance with the terms of your lease and applicable local laws, within 30 days of the move-out inspection, minus any deductions for damages or outstanding balances.

Should you have any questions regarding the move-out process, please do not hesitate to contact our office.`
      },
      'move-in': {
        subject: 'Welcome to Your New Home',
        body: `We are delighted to welcome you to your new home! Your lease begins on ${fmtDate(selectedLease.leaseStart)} and your monthly rent is ${fmtCurrency(selectedLease.monthlyRent, currency)}.

Your security deposit of ${fmtCurrency(selectedLease.deposit, currency)} has been received and recorded. Rent is due on the 1st of each month. Please ensure payments are made promptly using our accepted payment methods.

A move-in inspection will be conducted on your move-in date. Please report any existing damages or concerns within 48 hours of moving in so they can be documented appropriately.

For any maintenance requests or emergencies, please contact our office immediately. We are committed to ensuring your comfort and satisfaction throughout your tenancy.

Once again, welcome! We hope you enjoy your new home.`
      },
      'move-out': {
        subject: 'Move-Out Instructions',
        body: `This letter confirms your scheduled move-out date of ${fmtDate(moveOutDate)}. Please ensure all personal belongings are removed from the premises by this date.

A move-out inspection will be scheduled within 3 business days of your departure. Please ensure the unit is cleaned and returned in good condition, subject to normal wear and tear.

Your security deposit of ${fmtCurrency(selectedLease.deposit, currency)} will be reviewed following the inspection. Any deductions for damages, cleaning, or outstanding balances will be itemized and communicated to you. The remaining balance will be refunded within 30 days.

Please return all keys, access cards, and remote controls to our office on or before your move-out date. Failure to return these items may result in additional charges.

We thank you for your tenancy and wish you all the best in your future endeavors.`
      },
      'maintenance-confirm': {
        subject: selectedTask ? `Maintenance Request Confirmation - Case #${selectedTask.id.toUpperCase()}` : 'Maintenance Request Confirmation',
        body: selectedTask ? `We acknowledge receipt of your maintenance request submitted on ${fmtDate(selectedTask.dateReported)}. Your request has been logged and assigned the following case number: ${selectedTask.id.toUpperCase()}.

Request details:
  - Category: ${selectedTask.category}
  - Priority: ${selectedTask.priority}
  - Description: ${selectedTask.description}

${selectedTask.contractor ? `A contractor (${selectedTask.contractor}) has been assigned to address this issue.` : 'We are currently evaluating the request and will assign a contractor shortly.'} The estimated cost for this repair is ${fmtCurrency(selectedTask.estimatedCost, currency)}.

We will make every effort to resolve this matter promptly. If you have any questions or need to provide additional information, please contact our office and reference your case number.

Thank you for reporting this issue. Your cooperation in maintaining the property is greatly appreciated.` : ''
      },
      'maintenance-complete': {
        subject: selectedTask ? `Maintenance Completed - Case #${selectedTask.id.toUpperCase()}` : 'Maintenance Completed',
        body: selectedTask ? `We are pleased to inform you that the maintenance work for Case #${selectedTask.id.toUpperCase()} has been completed as of ${fmtDate(selectedTask.completionDate)}.

Work summary:
  - Category: ${selectedTask.category}
  - Description: ${selectedTask.description}
  - Contractor: ${selectedTask.contractor || 'In-house'}
  - Actual Cost: ${fmtCurrency(selectedTask.actualCost, currency)}

If you notice any issues related to the completed work, please contact our office within 7 days so we can arrange a follow-up inspection at no additional charge.

Thank you for your patience during the repair process. We strive to maintain the property to the highest standards for your comfort and safety.` : ''
      },
    };

    return templates[letterType];
  }, [selectedTenant, selectedLease, selectedTask, letterType, currency, outstandingBalance, daysPastDue, latestUnpaidRecord, newLeaseEnd, newMonthlyRent, vacateByDate, reason, moveOutDate]);

  // Reset letter content when template changes or relevant fields change
  useEffect(() => {
    if (!isCustomized && getDefaultLetterContent) {
      setLetterSubject(getDefaultLetterContent.subject);
      setLetterBody(getDefaultLetterContent.body);
    }
  }, [getDefaultLetterContent, isCustomized]);

  // Reset customization when letter type changes
  useEffect(() => {
    setIsCustomized(false);
  }, [letterType]);

  const handleResetToDefault = () => {
    setLetterSubject(getDefaultLetterContent.subject);
    setLetterBody(getDefaultLetterContent.body);
    setIsCustomized(false);
  };

  const handleLetterContentChange = (field: 'subject' | 'body', value: string) => {
    setIsCustomized(true);
    if (field === 'subject') {
      setLetterSubject(value);
    } else {
      setLetterBody(value);
    }
  };

  function handlePropertyChange(id: string) {
    setSelectedPropertyId(id);
    setSelectedUnitId('');
    setSelectedTenantId('');
    setSelectedTaskId('');
  }

  function handleUnitChange(id: string) {
    setSelectedUnitId(id);
    setSelectedTenantId('');
    setSelectedTaskId('');
  }

  const isMaintenance = letterType === 'maintenance-confirm' || letterType === 'maintenance-complete';
  const canGenerate = selectedTenant && selectedLease && selectedProperty && selectedUnit
    && (!isMaintenance || selectedTask);

  async function handleDownload() {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      const mod = await import('@/lib/pdf/lettersPdf');
      const baseOpts = {
        owner: ownerInfo,
        tenant: selectedTenant!,
        lease: selectedLease!,
        property: selectedProperty!,
        unit: selectedUnit!,
        currency,
        letterDate,
      };

      // Use custom content - split body into paragraphs
      const bodyParagraphs = letterBody.split('\n\n').filter((p) => p.trim());
      const doc = mod.generateCustomLetter({
        ...baseOpts,
        subject: letterSubject,
        bodyParagraphs,
      });

      const typeName = LETTER_TYPES.find((t) => t.id === letterType)?.label.replace(/\s+/g, '_') ?? 'Letter';
      doc.save(`${typeName}_${selectedTenant!.name.replace(/\s+/g, '_')}_${letterDate}.pdf`);
    } finally {
      setGenerating(false);
    }
  }

  const currentType = LETTER_TYPES.find((t) => t.id === letterType)!;

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <Link href="/documents" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors mb-4">
          <ArrowLeft size={14} /> Back to Documents
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Letters &amp; Notices</h1>
        <p className="text-sm text-slate-500 mt-1">Select a letter type, fill in the details, and download as PDF.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* ── Left: Letter type selector ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 px-1">Letter Type</h2>
          <div className="flex flex-col gap-1">
            {LETTER_TYPES.map((type) => {
              const Icon: LucideIcon = type.icon;
              const active = letterType === type.id;
              return (
                <button
                  key={type.id}
                  onClick={() => setLetterType(type.id)}
                  className={clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all text-left cursor-pointer',
                    active
                      ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800',
                  )}
                >
                  <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', type.color)}>
                    <Icon size={15} />
                  </div>
                  <span className="truncate">{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right: Form ── */}
        <div className="space-y-5">
          {/* Current type header */}
          <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', currentType.color)}>
              {(() => { const I: LucideIcon = currentType.icon; return <I size={18} />; })()}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">{currentType.label}</h3>
              <p className="text-xs text-slate-500">Fill in the details below and download the PDF</p>
            </div>
          </div>

          {/* Common fields */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Recipient</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Property</label>
                <select value={selectedPropertyId} onChange={(e) => handlePropertyChange(e.target.value)} className={INPUT_CLS}>
                  <option value="">-- Select --</option>
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Unit</label>
                <select value={selectedUnitId} onChange={(e) => handleUnitChange(e.target.value)} disabled={!selectedPropertyId} className={`${INPUT_CLS} ${DISABLED_CLS}`}>
                  <option value="">-- Select --</option>
                  {filteredUnits.map((u) => <option key={u.id} value={u.id}>Unit {u.unitNumber}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Tenant</label>
                <select value={selectedTenantId} onChange={(e) => setSelectedTenantId(e.target.value)} disabled={!selectedUnitId} className={`${INPUT_CLS} ${DISABLED_CLS}`}>
                  <option value="">-- Select --</option>
                  {filteredTenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Letter Date</label>
                <input type="date" value={letterDate} onChange={(e) => setLetterDate(e.target.value)} className={INPUT_CLS} />
              </div>
            </div>
          </div>

          {/* Letter-specific fields */}
          {letterType === 'late-payment' && selectedTenantId && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Late Payment Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Outstanding Balance</label>
                  <input type="text" readOnly value={`${currency}${outstandingBalance.toFixed(2)}`} className={`${INPUT_CLS} bg-slate-50`} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Days Past Due</label>
                  <input type="text" readOnly value={daysPastDue} className={`${INPUT_CLS} bg-slate-50`} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Due Date</label>
                  <input type="text" readOnly value={latestUnpaidRecord?.rentDueDate || '-'} className={`${INPUT_CLS} bg-slate-50`} />
                </div>
              </div>
            </div>
          )}

          {letterType === 'lease-renewal' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Renewal Terms</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">New Lease End Date</label>
                  <input type="date" value={newLeaseEnd} onChange={(e) => setNewLeaseEnd(e.target.value)} className={INPUT_CLS} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">New Monthly Rent (optional)</label>
                  <input type="number" step="0.01" value={newMonthlyRent} onChange={(e) => setNewMonthlyRent(e.target.value)} placeholder="Leave blank to keep current" className={INPUT_CLS} />
                </div>
              </div>
            </div>
          )}

          {letterType === 'lease-termination' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Termination Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Vacate By Date</label>
                  <input type="date" value={vacateByDate} onChange={(e) => setVacateByDate(e.target.value)} className={INPUT_CLS} />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Reason (optional)</label>
                  <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. End of lease term" className={INPUT_CLS} />
                </div>
              </div>
            </div>
          )}

          {letterType === 'move-out' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Move-Out Details</h2>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Move-Out Date</label>
                <input type="date" value={moveOutDate} onChange={(e) => setMoveOutDate(e.target.value)} className={`${INPUT_CLS} max-w-xs`} />
              </div>
            </div>
          )}

          {isMaintenance && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Maintenance Task</h2>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Select Task</label>
                <select value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)} disabled={filteredTasks.length === 0} className={`${INPUT_CLS} ${DISABLED_CLS}`}>
                  <option value="">-- Select Task --</option>
                  {filteredTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.category} - {t.description.slice(0, 50)} ({t.status})
                    </option>
                  ))}
                </select>
              </div>
              {selectedTask && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] text-slate-400 uppercase">Priority</p>
                    <p className="text-sm font-medium text-slate-700">{selectedTask.priority}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] text-slate-400 uppercase">Status</p>
                    <p className="text-sm font-medium text-slate-700">{selectedTask.status}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] text-slate-400 uppercase">Est. Cost</p>
                    <p className="text-sm font-medium text-slate-700">{currency}{selectedTask.estimatedCost.toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] text-slate-400 uppercase">Contractor</p>
                    <p className="text-sm font-medium text-slate-700">{selectedTask.contractor || '-'}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Letter Content Editor */}
          {selectedTenant && selectedLease && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit3 size={16} className="text-slate-400" />
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Letter Content</h2>
                  {isCustomized && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Customized</span>
                  )}
                </div>
                {isCustomized && (
                  <button
                    onClick={handleResetToDefault}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors cursor-pointer"
                  >
                    <RotateCcw size={12} />
                    Reset to default
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500">Edit the letter content below. Changes will be reflected in the generated PDF.</p>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Subject Line</label>
                <input
                  type="text"
                  value={letterSubject}
                  onChange={(e) => handleLetterContentChange('subject', e.target.value)}
                  className={INPUT_CLS}
                  placeholder="Enter subject..."
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Letter Body</label>
                <textarea
                  value={letterBody}
                  onChange={(e) => handleLetterContentChange('body', e.target.value)}
                  className={`${INPUT_CLS} min-h-[300px] font-mono text-xs leading-relaxed`}
                  placeholder="Enter letter content..."
                />
                <p className="mt-1.5 text-[10px] text-slate-400">Tip: Separate paragraphs with blank lines for proper formatting in the PDF.</p>
              </div>
            </div>
          )}

          {/* Download button */}
          <button
            onClick={handleDownload}
            disabled={!canGenerate || generating}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
          >
            <FileDown size={18} />
            {generating ? 'Generating...' : `Download ${currentType.label} PDF`}
          </button>
        </div>
      </div>
    </div>
  );
}
