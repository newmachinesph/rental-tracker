'use client';

import { useState, useRef } from 'react';
import { Download, Upload, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  useSetupStore,
  useTenantStore,
  useLeaseStore,
  useIncomeStore,
  useExpenseStore,
  useMileageStore,
  useMaintenanceStore,
} from '@/lib/store';

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function DataManagement() {
  const [exportStatus, setExportStatus] = useState<Status>('idle');
  const [importStatus, setImportStatus] = useState<Status>('idle');
  const [modalOpen, setModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [resultMessage, setResultMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Export ──
  const handleExport = async () => {
    setExportStatus('loading');
    try {
      const res = await fetch('/api/data/export');
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') ?? '';
      const match = disposition.match(/filename="(.+)"/);
      const filename = match?.[1] ?? 'rental-data-export.json';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 3000);
    } catch {
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 3000);
    }
  };

  // ── Import — file selection ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setModalOpen(true);
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  // ── Import — confirm ──
  const handleImportConfirm = async () => {
    if (!importFile) return;
    setImportStatus('loading');

    try {
      const text = await importFile.text();
      const json = JSON.parse(text);

      const res = await fetch('/api/data/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Import failed');
      }

      const result = await res.json();
      const c = result.counts;
      setResultMessage(
        `Imported ${c.properties} properties, ${c.units} units, ${c.tenants} tenants, ${c.leases} leases, ${c.income} income, ${c.expenses} expenses, ${c.maintenance} maintenance, ${c.mileageRates} rates, ${c.mileageLogs} logs.`
      );
      setImportStatus('success');
      setModalOpen(false);
      setImportFile(null);

      // Refetch all stores after import
      await useSetupStore.getState().fetchAll();
      await Promise.all([
        useTenantStore.getState().fetchTenants(),
        useLeaseStore.getState().fetchLeases(),
        useIncomeStore.getState().fetchRecords(),
        useExpenseStore.getState().fetchRecords(),
        useMileageStore.getState().fetchAll(),
        useMaintenanceStore.getState().fetchTasks(),
      ]);

      setTimeout(() => {
        setImportStatus('idle');
        setResultMessage('');
      }, 8000);
    } catch (err) {
      setResultMessage(err instanceof Error ? err.message : 'Import failed');
      setImportStatus('error');
      setModalOpen(false);
      setImportFile(null);
      setTimeout(() => {
        setImportStatus('idle');
        setResultMessage('');
      }, 8000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Export */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleExport}
          disabled={exportStatus === 'loading'}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
        >
          <Download className="w-4 h-4" />
          {exportStatus === 'loading' ? 'Exporting...' : 'Export Data'}
        </button>
        {exportStatus === 'success' && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle className="w-4 h-4" /> Downloaded
          </span>
        )}
        {exportStatus === 'error' && (
          <span className="flex items-center gap-1.5 text-sm text-red-600">
            <XCircle className="w-4 h-4" /> Export failed
          </span>
        )}
      </div>

      {/* Import */}
      <div className="flex items-center gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importStatus === 'loading'}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          {importStatus === 'loading' ? 'Importing...' : 'Import Data'}
        </button>
        {importStatus === 'success' && resultMessage && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle className="w-4 h-4" /> {resultMessage}
          </span>
        )}
        {importStatus === 'error' && resultMessage && (
          <span className="flex items-center gap-1.5 text-sm text-red-600">
            <XCircle className="w-4 h-4" /> {resultMessage}
          </span>
        )}
      </div>

      {/* Confirm Modal */}
      <Modal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setImportFile(null);
        }}
        title="Import Data"
        subtitle={importFile?.name}
        size="sm"
        footer={
          <>
            <button
              onClick={() => {
                setModalOpen(false);
                setImportFile(null);
              }}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleImportConfirm}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors cursor-pointer"
            >
              Replace All Data
            </button>
          </>
        }
      >
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold mb-1">This will replace ALL existing data</p>
            <p>
              All current properties, units, tenants, leases, income, expenses,
              maintenance tasks, and mileage records will be deleted and replaced
              with data from the imported file. This action cannot be undone.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
