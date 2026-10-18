'use client';

import { useState, useCallback, useEffect } from 'react';
import { Plus, X, Save, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { useSetupStore } from '@/lib/store';
import { SIDEBAR_SECTIONS } from '@/lib/sidebar-modules';
import DataManagement from '@/components/DataManagement';

/* ------------------------------------------------------------------ */
/*  Navigation sections for the quick-jump bar                        */
/* ------------------------------------------------------------------ */
const NAV_SECTIONS = [
  { id: 'currency', label: 'Currency' },
  { id: 'property-types', label: 'Property Types' },
  { id: 'income-categories', label: 'Income Categories' },
  { id: 'expense-categories', label: 'Expense Categories' },
  { id: 'payment-methods', label: 'Payment Methods' },
  { id: 'menu-modules', label: 'Menu Modules' },
  { id: 'owner-info', label: 'Owner / Company Info' },
  { id: 'data-management', label: 'Data Management' },
] as const;

const MAX_LIST_ITEMS = 50;

/* ================================================================== */
/*  Reusable: Editable List                                           */
/* ================================================================== */
function EditableList({
  items,
  onChange,
  placeholder = 'New item',
  maxItems = MAX_LIST_ITEMS,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  maxItems?: number;
}) {
  const [draft, setDraft] = useState('');

  const handleAdd = () => {
    const value = draft.trim();
    if (!value || items.length >= maxItems) return;
    if (items.some((i) => i.toLowerCase() === value.toLowerCase())) return;
    onChange([...items, value]);
    setDraft('');
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const handleRename = (index: number, newValue: string) => {
    const updated = [...items];
    updated[index] = newValue;
    onChange(updated);
  };

  return (
    <div>
      {/* Item chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="group flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
          >
            <input
              type="text"
              value={item}
              onChange={(e) => handleRename(idx, e.target.value)}
              className="bg-white border border-slate-200 rounded px-2 py-0.5 text-sm text-slate-700 min-w-[60px] focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
              style={{ width: `${Math.max(item.length * 0.55 + 1.5, 3.5)}em` }}
            />
            <button
              onClick={() => handleRemove(idx)}
              className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50 ml-0.5 cursor-pointer"
              title="Remove"
              aria-label={`Remove ${item}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add row */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
        />
        <button
          onClick={handleAdd}
          disabled={!draft.trim() || items.length >= maxItems}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add
        </button>
      </div>
      <div className="text-xs text-slate-400 mt-1.5">
        {items.length} / {maxItems} items
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Reusable: Section Card wrapper                                    */
/* ================================================================== */
function SectionCard({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 scroll-mt-6"
    >
      <h2 className="text-lg font-semibold text-slate-800 mb-1">{title}</h2>
      {description && (
        <p className="text-sm text-slate-500 mb-4">{description}</p>
      )}
      {!description && <div className="mb-4" />}
      {children}
    </section>
  );
}

/* ================================================================== */
/*  Main Page                                                         */
/* ================================================================== */
export default function SetupPage() {
  const {
    currency,
    propertyTypes,
    incomeCategories,
    expenseCategories,
    paymentMethods,
    ownerInfo,
    setCurrency,
    setOwnerInfo,
    setPropertyTypes,
    setIncomeCategories,
    setExpenseCategories,
    setPaymentMethods,
    sidebarModules,
    toggleSidebarModule,
  } = useSetupStore();

  /* Local owner info form state — only saved on explicit button click */
  const [ownerForm, setOwnerForm] = useState(ownerInfo);
  const [ownerSaved, setOwnerSaved] = useState(false);

  useEffect(() => {
    setOwnerForm(ownerInfo);
  }, [ownerInfo]);

  const handleSaveOwnerInfo = useCallback(() => {
    setOwnerInfo(ownerForm);
    setOwnerSaved(true);
    setTimeout(() => setOwnerSaved(false), 2000);
  }, [ownerForm, setOwnerInfo]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Setup</h1>
            <p className="text-sm text-slate-500 mt-1">Configure your rental tracker settings -- currency, properties, categories, and payment methods.</p>
          </div>
        </div>
      </div>

      {/* ---- Color-code convention banner ---- */}
      <div className="mb-6 flex items-center gap-5 rounded-xl border border-slate-100 bg-slate-50/60 px-5 py-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 rounded border border-slate-200 bg-white shadow-sm" />
          <span>Editable cell</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 rounded border border-slate-200 bg-slate-100" />
          <span>Automated / read-only</span>
        </div>
      </div>

      {/* ---- Quick-navigation ---- */}
      <nav className="mb-6 flex flex-wrap gap-2" aria-label="Jump to section">
        {NAV_SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-lg bg-white border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm"
          >
            {s.label}
          </a>
        ))}
      </nav>

      {/* ---- Sections ---- */}
      <div className="flex flex-col gap-6">
        {/* 1. Currency */}
        <SectionCard
          id="currency"
          title="Currency Setting"
          description="Set the currency symbol displayed throughout the tracker."
        >
          <div className="flex items-center gap-3 max-w-xs">
            <label htmlFor="currency-input" className="text-sm font-medium text-slate-700 whitespace-nowrap">
              Currency symbol
            </label>
            <input
              id="currency-input"
              type="text"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              maxLength={4}
              className="w-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-lg font-semibold text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all"
            />
            <span className="text-xs text-slate-400">e.g. $, EUR, &pound;</span>
          </div>
        </SectionCard>

        {/* 2. Property Types */}
        <SectionCard
          id="property-types"
          title="Property Types"
          description="Manage the list of property types available when adding properties."
        >
          <EditableList
            items={propertyTypes}
            onChange={setPropertyTypes}
            placeholder="Add property type..."
          />
        </SectionCard>

        {/* 3. Income Categories */}
        <SectionCard
          id="income-categories"
          title="Income Categories"
          description="Define the types of income you want to track (up to 50)."
        >
          <EditableList
            items={incomeCategories}
            onChange={setIncomeCategories}
            placeholder="Add income category..."
            maxItems={MAX_LIST_ITEMS}
          />
        </SectionCard>

        {/* 5. Expense Categories */}
        <SectionCard
          id="expense-categories"
          title="Expense Categories"
          description="Define the types of expenses you want to track (up to 50)."
        >
          <EditableList
            items={expenseCategories}
            onChange={setExpenseCategories}
            placeholder="Add expense category..."
            maxItems={MAX_LIST_ITEMS}
          />
        </SectionCard>

        {/* 6. Payment Methods */}
        <SectionCard
          id="payment-methods"
          title="Payment Methods"
          description="Manage the payment methods tenants can use."
        >
          <EditableList
            items={paymentMethods}
            onChange={setPaymentMethods}
            placeholder="Add payment method..."
          />
        </SectionCard>

        {/* 7. Menu Modules */}
        <SectionCard
          id="menu-modules"
          title="Menu Modules"
          description="Show or hide sidebar navigation items. Dashboard and Setup are always visible."
        >
          <div className="space-y-6">
            {SIDEBAR_SECTIONS.map((section) => (
              <div key={section.title}>
                <h3 className="text-sm font-semibold text-slate-700 mb-3">
                  {section.title}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {section.items.map((item) => {
                    const isLocked = 'alwaysVisible' in item && item.alwaysVisible;
                    const isVisible = isLocked || (sidebarModules[item.key] !== false);
                    return (
                      <label
                        key={item.key}
                        className={clsx(
                          'flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm transition-all',
                          isLocked
                            ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-blue-200 cursor-pointer',
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {item.label}
                          {isLocked && (
                            <span className="text-[10px] text-slate-400 font-medium">(always visible)</span>
                          )}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isVisible}
                          disabled={!!isLocked}
                          onClick={() => !isLocked && toggleSidebarModule(item.key, !isVisible)}
                          className={clsx(
                            'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors',
                            isLocked
                              ? 'bg-slate-200 cursor-not-allowed'
                              : isVisible
                                ? 'bg-blue-600 cursor-pointer'
                                : 'bg-slate-300 cursor-pointer',
                          )}
                        >
                          <span
                            className={clsx(
                              'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                              isVisible ? 'translate-x-6' : 'translate-x-1',
                            )}
                          />
                        </button>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 8. Owner / Company Info */}
        <SectionCard
          id="owner-info"
          title="Owner / Company Info"
          description="Your details used on PDF letterheads for Statements of Account and Letters."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Full Name</label>
              <input type="text" value={ownerForm.name} onChange={(e) => setOwnerForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Company Name</label>
              <input type="text" value={ownerForm.company} onChange={(e) => setOwnerForm((f) => ({ ...f, company: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Address</label>
              <input type="text" value={ownerForm.address} onChange={(e) => setOwnerForm((f) => ({ ...f, address: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Phone</label>
              <input type="text" value={ownerForm.phone} onChange={(e) => setOwnerForm((f) => ({ ...f, phone: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-500 uppercase tracking-wider">Email</label>
              <input type="text" value={ownerForm.email} onChange={(e) => setOwnerForm((f) => ({ ...f, email: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleSaveOwnerInfo}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
            >
              {ownerSaved ? <Check size={16} /> : <Save size={16} />}
              {ownerSaved ? 'Saved!' : 'Save'}
            </button>
            {ownerSaved && (
              <span className="text-sm text-emerald-600 font-medium animate-fade-in">Changes saved successfully</span>
            )}
          </div>
        </SectionCard>

        {/* 8. Data Management */}
        <SectionCard
          id="data-management"
          title="Data Management"
          description="Export all your data as a JSON file or import data from a previously exported file."
        >
          <DataManagement />
        </SectionCard>
      </div>
    </div>
  );
}
