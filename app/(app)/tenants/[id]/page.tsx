'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Phone, Mail, Building2, Home, Calendar, DollarSign,
  FileText, StickyNote, Plus, Trash2, Pencil, Check, X, Upload,
  Download, Eye, Clock, TrendingUp, AlertCircle, Receipt,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  useSetupStore, useIncomeStore, useLeaseStore, useTenantStore,
} from '@/lib/store';
import { computeIncomeFields } from '@/lib/clientUtils';
import { apiFetch } from '@/lib/api';
import type { IncomeRecord } from '@/lib/types';
import { Modal, FieldGroup } from '@/components/ui/Modal';
import { generateReactHelpers } from '@uploadthing/react';
import type { OurFileRouter } from '@/lib/uploadthing';

const { useUploadThing } = generateReactHelpers<OurFileRouter>();

interface TenantNote {
  id: string;
  tenantId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface TenantFile {
  id: string;
  tenantId: string;
  name: string;
  url: string;
  size: number;
  type: string;
  createdAt: string;
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none';

const statusBadge: Record<string, string> = {
  Paid: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'Partially Paid': 'bg-amber-50 text-amber-700 border border-amber-200',
  Overpaid: 'bg-blue-50 text-blue-700 border border-blue-200',
  Unpaid: 'bg-red-50 text-red-700 border border-red-200',
  Pending: 'bg-slate-50 text-slate-500 border border-slate-200',
};

const PIE_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#94a3b8'];

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function TenantProfilePage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const { properties, units, incomeCategories, paymentMethods, currency } = useSetupStore();
  const { tenants } = useTenantStore();
  const { records, addRecord } = useIncomeStore();
  const { leases } = useLeaseStore();

  const tenant = useMemo(() => tenants.find(t => t.id === tenantId), [tenants, tenantId]);

  // Notes state
  const [notes, setNotes] = useState<TenantNote[]>([]);
  const [noteContent, setNoteContent] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');

  // Files state
  const [files, setFiles] = useState<TenantFile[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentRecord, setPaymentRecord] = useState<Partial<IncomeRecord>>({});
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'notes' | 'files'>('overview');

  // UploadThing hooks
  const { startUpload: startTenantUpload } = useUploadThing('tenantFile');
  const { startUpload: startReceiptUpload } = useUploadThing('paymentReceipt');

  // Fetch notes and files on mount
  useEffect(() => {
    if (!tenantId) return;
    apiFetch<TenantNote[]>(`/api/tenants/${tenantId}/notes`).then(setNotes).catch(() => {});
    apiFetch<TenantFile[]>(`/api/tenants/${tenantId}/files`).then(setFiles).catch(() => {});
  }, [tenantId]);

  // Derived data
  const tenantLeases = useMemo(
    () => leases.filter(l => l.tenantId === tenantId),
    [leases, tenantId],
  );

  const activeLeases = useMemo(
    () => tenantLeases.filter(l => l.isCurrentTenant),
    [tenantLeases],
  );

  const tenantRecords = useMemo(
    () => records.filter(r => r.tenantId === tenantId).sort((a, b) =>
      (b.rentDueDate || '').localeCompare(a.rentDueDate || ''),
    ),
    [records, tenantId],
  );

  const totalPaid = useMemo(() => tenantRecords.reduce((s, r) => s + r.amountPaid, 0), [tenantRecords]);
  const totalDue = useMemo(() => tenantRecords.reduce((s, r) => s + r.totalDue, 0), [tenantRecords]);
  const totalOutstanding = useMemo(() => tenantRecords.reduce((s, r) => s + r.outstandingBalance, 0), [tenantRecords]);
  const monthlyRent = useMemo(() => {
    const active = activeLeases[0];
    return active ? active.monthlyRent : 0;
  }, [activeLeases]);

  // Payment status distribution for pie chart
  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    tenantRecords.forEach(r => {
      counts[r.paymentStatus] = (counts[r.paymentStatus] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [tenantRecords]);

  // Monthly payment chart data (last 12 months)
  const monthlyChartData = useMemo(() => {
    const now = new Date();
    const months: { month: string; paid: number; due: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const monthRecords = tenantRecords.filter(r => r.rentDueDate?.startsWith(key));
      months.push({
        month: label,
        paid: monthRecords.reduce((s, r) => s + r.amountPaid, 0),
        due: monthRecords.reduce((s, r) => s + r.totalDue, 0),
      });
    }
    return months;
  }, [tenantRecords]);

  // Helpers
  const propertyMap = useMemo(() => Object.fromEntries(properties.map(p => [p.id, p])), [properties]);
  const unitMap = useMemo(() => Object.fromEntries(units.map(u => [u.id, u])), [units]);
  const getUnitsForProperty = useCallback((pid: string) => units.filter(u => u.propertyId === pid), [units]);

  // ─── Notes CRUD ──────────────────────────
  const handleAddNote = useCallback(async () => {
    if (!noteContent.trim()) return;
    const note = await apiFetch<TenantNote>(`/api/tenants/${tenantId}/notes`, {
      method: 'POST', body: JSON.stringify({ content: noteContent }),
    });
    setNotes(prev => [note, ...prev]);
    setNoteContent('');
  }, [tenantId, noteContent]);

  const handleUpdateNote = useCallback(async (noteId: string) => {
    if (!editingNoteContent.trim()) return;
    const note = await apiFetch<TenantNote>(`/api/tenants/${tenantId}/notes/${noteId}`, {
      method: 'PUT', body: JSON.stringify({ content: editingNoteContent }),
    });
    setNotes(prev => prev.map(n => n.id === noteId ? note : n));
    setEditingNoteId(null);
    setEditingNoteContent('');
  }, [tenantId, editingNoteContent]);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    await apiFetch(`/api/tenants/${tenantId}/notes/${noteId}`, { method: 'DELETE' });
    setNotes(prev => prev.filter(n => n.id !== noteId));
  }, [tenantId]);

  // ─── File Upload ─────────────────────────
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setUploadingFile(true);
    try {
      const result = await startTenantUpload(Array.from(fileList));
      if (result) {
        for (const r of result) {
          const saved = await apiFetch<TenantFile>(`/api/tenants/${tenantId}/files`, {
            method: 'POST',
            body: JSON.stringify({ name: r.name, url: r.url, size: r.size, type: r.type }),
          });
          setFiles(prev => [saved, ...prev]);
        }
      }
    } catch (err) {
      console.error('Upload failed:', err);
    }
    setUploadingFile(false);
    e.target.value = '';
  }, [tenantId, startTenantUpload]);

  const handleDeleteFile = useCallback(async (fileId: string) => {
    await apiFetch(`/api/tenants/${tenantId}/files/${fileId}`, { method: 'DELETE' });
    setFiles(prev => prev.filter(f => f.id !== fileId));
  }, [tenantId]);

  // ─── Create Payment ─────────────────────
  const openPaymentModal = useCallback(() => {
    const activeLease = activeLeases[0];
    const computed = computeIncomeFields(activeLease?.monthlyRent ?? 0, 0, 0, '', '');
    setPaymentRecord({
      propertyId: activeLease?.propertyId ?? '',
      unitId: activeLease?.unitId ?? '',
      tenantId,
      category: 'Rent',
      rentDueDate: '',
      rentAmount: activeLease?.monthlyRent ?? 0,
      additionalIncome: 0,
      ...computed,
      paymentDate: new Date().toISOString().split('T')[0],
      amountPaid: activeLease?.monthlyRent ?? 0,
      paymentMethod: '',
      notes: '',
      receiptUrl: '',
    });
    setReceiptFile(null);
    setPaymentModalOpen(true);
  }, [activeLeases, tenantId]);

  const handlePaymentFieldChange = useCallback((field: string, value: string | number) => {
    setPaymentRecord(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'propertyId') { updated.unitId = ''; }
      const rentAmount = field === 'rentAmount' ? Number(value) : (updated.rentAmount ?? 0);
      const additionalIncome = field === 'additionalIncome' ? Number(value) : (updated.additionalIncome ?? 0);
      const amountPaid = field === 'amountPaid' ? Number(value) : (updated.amountPaid ?? 0);
      const rentDueDate = field === 'rentDueDate' ? String(value) : (updated.rentDueDate ?? '');
      const paymentDate = field === 'paymentDate' ? String(value) : (updated.paymentDate ?? '');
      const computed = computeIncomeFields(rentAmount, additionalIncome, amountPaid, rentDueDate, paymentDate);
      return { ...updated, ...computed };
    });
  }, []);

  const handleSavePayment = useCallback(async () => {
    let receiptUrl = '';
    if (receiptFile) {
      setUploadingReceipt(true);
      try {
        const result = await startReceiptUpload([receiptFile]);
        if (result && result[0]) {
          receiptUrl = result[0].url;
        }
      } catch (err) {
        console.error('Receipt upload failed:', err);
      }
      setUploadingReceipt(false);
    }

    await addRecord({ ...paymentRecord, receiptUrl, id: '' } as IncomeRecord);
    setPaymentModalOpen(false);
    setPaymentRecord({});
    setReceiptFile(null);
  }, [paymentRecord, receiptFile, addRecord, startReceiptUpload]);

  const paymentModalUnits = useMemo(
    () => paymentRecord.propertyId ? getUnitsForProperty(paymentRecord.propertyId) : [],
    [paymentRecord.propertyId, getUnitsForProperty],
  );

  if (!tenant) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-slate-500">Tenant not found</p>
        <Link href="/tenants" className="text-blue-600 hover:underline mt-2 text-sm">Back to Tenants</Link>
      </div>
    );
  }

  const tabs = [
    { key: 'overview', label: 'Overview', icon: TrendingUp },
    { key: 'payments', label: 'Payments', icon: DollarSign },
    { key: 'notes', label: 'Notes', icon: StickyNote },
    { key: 'files', label: 'Files', icon: FileText },
  ] as const;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/tenants')} className="p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
            <ArrowLeft size={20} className="text-slate-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{tenant.name}</h1>
            <div className="flex items-center gap-4 mt-1">
              {tenant.phone && (
                <a href={`tel:${tenant.phone}`} className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                  <Phone size={14} /> {tenant.phone}
                </a>
              )}
              {tenant.email && (
                <a href={`mailto:${tenant.email}`} className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
                  <Mail size={14} /> {tenant.email}
                </a>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={openPaymentModal}
          className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 px-4 py-2 text-sm font-medium flex items-center gap-2 shadow-sm transition-all cursor-pointer"
        >
          <Plus size={16} /> Create Payment
        </button>
      </div>

      {/* Active Lease Info */}
      {activeLeases.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Active Lease</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {activeLeases.map(lease => (
              <div key={lease.id} className="contents">
                <div>
                  <p className="text-xs text-slate-400">Property</p>
                  <p className="text-sm font-medium text-slate-700">{propertyMap[lease.propertyId]?.name ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Unit</p>
                  <p className="text-sm font-medium text-slate-700">{unitMap[lease.unitId]?.unitNumber ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Monthly Rent</p>
                  <p className="text-sm font-bold text-slate-800">{currency}{fmt(lease.monthlyRent)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Lease Start</p>
                  <p className="text-sm font-medium text-slate-700">{fmtDate(lease.leaseStart)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Lease End</p>
                  <p className="text-sm font-medium text-slate-700">{fmtDate(lease.leaseEnd)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Deposit</p>
                  <p className="text-sm font-medium text-slate-700">{currency}{fmt(lease.deposit)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Monthly Rent</p>
              <p className="text-xl font-bold text-blue-600">{currency}{fmt(monthlyRent)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <Check size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Total Paid</p>
              <p className="text-xl font-bold text-emerald-600">{currency}{fmt(totalPaid)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <AlertCircle size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Outstanding</p>
              <p className={`text-xl font-bold ${totalOutstanding > 0 ? 'text-red-600' : 'text-slate-800'}`}>{currency}{fmt(totalOutstanding)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
              <Receipt size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-400">Total Payments</p>
              <p className="text-xl font-bold text-purple-600">{tenantRecords.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon size={16} />
                {tab.label}
                {tab.key === 'notes' && notes.length > 0 && (
                  <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-1.5 py-0.5 rounded-full">{notes.length}</span>
                )}
                {tab.key === 'files' && files.length > 0 && (
                  <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-1.5 py-0.5 rounded-full">{files.length}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payment History Chart */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Payment History (12 Months)</h3>
            {monthlyChartData.some(d => d.due > 0 || d.paid > 0) ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip
                    formatter={(value) => `${currency}${fmt(Number(value))}`}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Bar dataKey="due" name="Due" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="paid" name="Paid" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-sm text-slate-400">No payment data yet</div>
            )}
          </div>

          {/* Payment Status Distribution */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Payment Status Distribution</h3>
            {statusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusDistribution.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-sm text-slate-400">No payment data yet</div>
            )}
          </div>

          {/* Recent Payments */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700">Recent Payments</h3>
              <button onClick={() => setActiveTab('payments')} className="text-xs text-blue-600 hover:underline cursor-pointer">View all</button>
            </div>
            {tenantRecords.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">No payment records yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400">Due Date</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400">Property</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400">Unit</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-slate-400">Due</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-slate-400">Paid</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-slate-400">Balance</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-slate-400">Status</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-slate-400">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantRecords.slice(0, 5).map(r => (
                      <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 text-slate-700">{fmtDate(r.rentDueDate)}</td>
                        <td className="py-2.5 px-3 text-slate-600">{propertyMap[r.propertyId]?.name ?? '-'}</td>
                        <td className="py-2.5 px-3 text-slate-600">{unitMap[r.unitId]?.unitNumber ?? '-'}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-700">{currency}{fmt(r.totalDue)}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-emerald-700">{currency}{fmt(r.amountPaid)}</td>
                        <td className={`py-2.5 px-3 text-right font-medium ${r.outstandingBalance > 0 ? 'text-red-600' : 'text-slate-600'}`}>{currency}{fmt(r.outstandingBalance)}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[r.paymentStatus] ?? statusBadge.Pending}`}>{r.paymentStatus}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {r.receiptUrl ? (
                            <a href={r.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                              <Eye size={16} className="inline" />
                            </a>
                          ) : <span className="text-slate-300">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">All Payments ({tenantRecords.length})</h3>
            <button onClick={openPaymentModal} className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 cursor-pointer">
              <Plus size={14} /> Add Payment
            </button>
          </div>
          {tenantRecords.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No payment records yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400">Due Date</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400">Property</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400">Unit</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400">Category</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-400">Rent</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-400">Addl.</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-400">Total Due</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400">Paid Date</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-400">Paid</th>
                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-400">Balance</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold text-slate-400">Status</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-400">Method</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold text-slate-400">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {tenantRecords.map(r => (
                    <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-slate-700">{fmtDate(r.rentDueDate)}</td>
                      <td className="py-2.5 px-3 text-slate-600">{propertyMap[r.propertyId]?.name ?? '-'}</td>
                      <td className="py-2.5 px-3 text-slate-600">{unitMap[r.unitId]?.unitNumber ?? '-'}</td>
                      <td className="py-2.5 px-3 text-slate-600">{r.category || '-'}</td>
                      <td className="py-2.5 px-3 text-right text-slate-700">{currency}{fmt(r.rentAmount)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600">{currency}{fmt(r.additionalIncome)}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-800">{currency}{fmt(r.totalDue)}</td>
                      <td className="py-2.5 px-3 text-slate-600">{fmtDate(r.paymentDate)}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-emerald-700">{currency}{fmt(r.amountPaid)}</td>
                      <td className={`py-2.5 px-3 text-right font-medium ${r.outstandingBalance > 0 ? 'text-red-600' : 'text-slate-600'}`}>{currency}{fmt(r.outstandingBalance)}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[r.paymentStatus] ?? statusBadge.Pending}`}>{r.paymentStatus}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{r.paymentMethod || '-'}</td>
                      <td className="py-2.5 px-3 text-center">
                        {r.receiptUrl ? (
                          <a href={r.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                            <Eye size={16} className="inline" />
                          </a>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="space-y-4">
          {/* Add note */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Add Note</h3>
            <div className="flex gap-3">
              <textarea
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                className={`${inputClass} min-h-[80px] resize-y flex-1`}
                placeholder="Write a note about this tenant..."
              />
              <button
                onClick={handleAddNote}
                disabled={!noteContent.trim()}
                className="self-end rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium cursor-pointer transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Notes list */}
          {notes.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <StickyNote size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">No notes yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map(note => (
                <div key={note.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  {editingNoteId === note.id ? (
                    <div className="space-y-3">
                      <textarea
                        value={editingNoteContent}
                        onChange={e => setEditingNoteContent(e.target.value)}
                        className={`${inputClass} min-h-[80px] resize-y`}
                      />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setEditingNoteId(null); setEditingNoteContent(''); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 cursor-pointer">
                          <X size={14} className="inline mr-1" />Cancel
                        </button>
                        <button onClick={() => handleUpdateNote(note.id)} className="rounded-lg bg-blue-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-blue-700 cursor-pointer">
                          <Check size={14} className="inline mr-1" />Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.content}</p>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(note.createdAt).toLocaleString()}
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setEditingNoteId(note.id); setEditingNoteContent(note.content); }}
                            className="text-slate-400 hover:text-blue-600 p-1 cursor-pointer"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'files' && (
        <div className="space-y-4">
          {/* Upload */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Upload Files</h3>
              <span className="text-xs text-slate-400">Images, PDF, DOC (up to 16MB)</span>
            </div>
            <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-slate-200 rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer">
              {uploadingFile ? (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium">Uploading...</span>
                </div>
              ) : (
                <>
                  <Upload size={24} className="text-slate-400 mb-2" />
                  <span className="text-sm text-slate-500">Click to upload files</span>
                </>
              )}
              <input type="file" multiple onChange={handleFileUpload} className="hidden" accept="image/*,.pdf,.doc,.docx" />
            </label>
          </div>

          {/* Files list */}
          {files.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <FileText size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">No files uploaded yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {files.map(file => (
                <div key={file.id} className="flex items-center justify-between p-4 hover:bg-slate-50/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500 flex-shrink-0">
                      {file.type?.startsWith('image/') ? <Eye size={18} /> : <FileText size={18} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                      <p className="text-xs text-slate-400">{fmtBytes(file.size)} &middot; {new Date(file.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <Download size={16} />
                    </a>
                    <button
                      onClick={() => handleDeleteFile(file.id)}
                      className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Payment Modal */}
      <Modal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="Create Payment"
        subtitle={`${tenant.name}`}
        size="xl"
        footer={
          <>
            <button onClick={() => setPaymentModalOpen(false)} className="rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-4 py-2 text-sm font-medium cursor-pointer transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSavePayment}
              disabled={uploadingReceipt}
              className="rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 px-4 py-2 text-sm font-medium cursor-pointer shadow-sm"
            >
              {uploadingReceipt ? 'Uploading...' : 'Save Payment'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <FieldGroup label="Property">
            <select value={paymentRecord.propertyId ?? ''} onChange={e => handlePaymentFieldChange('propertyId', e.target.value)} className={inputClass}>
              <option value="">-- Select --</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="Unit">
            <select value={paymentRecord.unitId ?? ''} onChange={e => handlePaymentFieldChange('unitId', e.target.value)} className={inputClass} disabled={!paymentRecord.propertyId}>
              <option value="">-- Select --</option>
              {paymentModalUnits.map(u => <option key={u.id} value={u.id}>{u.unitNumber}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="Category">
            <select value={paymentRecord.category ?? ''} onChange={e => handlePaymentFieldChange('category', e.target.value)} className={inputClass}>
              <option value="">-- Select --</option>
              {incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </FieldGroup>
          <FieldGroup label="Rent Due Date">
            <input type="date" value={paymentRecord.rentDueDate ?? ''} onChange={e => handlePaymentFieldChange('rentDueDate', e.target.value)} className={inputClass} />
          </FieldGroup>
          <FieldGroup label={`Rent Amount (${currency})`}>
            <input type="number" min="0" step="0.01" value={paymentRecord.rentAmount || ''} onChange={e => handlePaymentFieldChange('rentAmount', parseFloat(e.target.value) || 0)} className={inputClass} placeholder="0.00" />
          </FieldGroup>
          <FieldGroup label={`Additional Income (${currency})`}>
            <input type="number" min="0" step="0.01" value={paymentRecord.additionalIncome || ''} onChange={e => handlePaymentFieldChange('additionalIncome', parseFloat(e.target.value) || 0)} className={inputClass} placeholder="0.00" />
          </FieldGroup>
          <FieldGroup label={`Total Due (${currency})`} autoFilled>
            <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 font-medium">{currency}{fmt(paymentRecord.totalDue ?? 0)}</div>
          </FieldGroup>
          <FieldGroup label="Payment Date">
            <input type="date" value={paymentRecord.paymentDate ?? ''} onChange={e => handlePaymentFieldChange('paymentDate', e.target.value)} className={inputClass} />
          </FieldGroup>
          <FieldGroup label={`Amount Paid (${currency})`}>
            <input type="number" min="0" step="0.01" value={paymentRecord.amountPaid || ''} onChange={e => handlePaymentFieldChange('amountPaid', parseFloat(e.target.value) || 0)} className={inputClass} placeholder="0.00" />
          </FieldGroup>
          <FieldGroup label="Outstanding Balance" autoFilled>
            <div className={`w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium ${(paymentRecord.outstandingBalance ?? 0) > 0 ? 'text-red-600' : 'text-slate-600'}`}>{currency}{fmt(paymentRecord.outstandingBalance ?? 0)}</div>
          </FieldGroup>
          <FieldGroup label="Payment Status" autoFilled>
            <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge[paymentRecord.paymentStatus ?? 'Pending'] ?? statusBadge.Pending}`}>{paymentRecord.paymentStatus ?? 'Pending'}</span>
            </div>
          </FieldGroup>
          <FieldGroup label="Payment Method">
            <select value={paymentRecord.paymentMethod ?? ''} onChange={e => handlePaymentFieldChange('paymentMethod', e.target.value)} className={inputClass}>
              <option value="">-- Select --</option>
              {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </FieldGroup>
          <div className="col-span-2">
            <FieldGroup label="Notes">
              <input type="text" value={paymentRecord.notes ?? ''} onChange={e => handlePaymentFieldChange('notes', e.target.value)} className={inputClass} placeholder="Notes..." />
            </FieldGroup>
          </div>
          <div className="col-span-2">
            <FieldGroup label="Upload Receipt (optional)">
              <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer">
                <Upload size={18} className="text-slate-400" />
                <span className="text-sm text-slate-500">
                  {receiptFile ? receiptFile.name : 'Click to attach receipt image or PDF'}
                </span>
                <input type="file" onChange={e => setReceiptFile(e.target.files?.[0] ?? null)} className="hidden" accept="image/*,.pdf" />
              </label>
            </FieldGroup>
          </div>
        </div>
      </Modal>
    </div>
  );
}
