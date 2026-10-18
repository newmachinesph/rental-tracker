'use client';

import Link from 'next/link';
import {
  FileText, Building2, Users, Bell, AlertTriangle, RefreshCw, XCircle,
  Home, LogOut as LogOutIcon, Wrench, CheckCircle2,
} from 'lucide-react';

const statementCards = [
  {
    title: 'Tenant Statement of Account',
    description: 'Generate a detailed payment history, balances, and transaction summary for a specific tenant.',
    href: '/documents/soa-tenant',
    icon: Users,
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    title: 'Owner Statement of Account',
    description: 'Generate an income vs expense breakdown, net profit analysis by property for the owner.',
    href: '/documents/soa-owner',
    icon: Building2,
    gradient: 'from-emerald-500 to-teal-500',
  },
];

const letterCards = [
  {
    title: 'Rent Reminder',
    description: 'Friendly reminder that rent is due soon.',
    href: '/documents/letters?type=rent-reminder',
    icon: Bell,
    color: 'text-blue-600 bg-blue-100',
  },
  {
    title: 'Late Payment Notice',
    description: 'Formal notice for overdue rent payments.',
    href: '/documents/letters?type=late-payment',
    icon: AlertTriangle,
    color: 'text-red-600 bg-red-100',
  },
  {
    title: 'Lease Renewal',
    description: 'Offer to renew an expiring lease.',
    href: '/documents/letters?type=lease-renewal',
    icon: RefreshCw,
    color: 'text-emerald-600 bg-emerald-100',
  },
  {
    title: 'Lease Termination',
    description: 'Formal notice of lease termination.',
    href: '/documents/letters?type=lease-termination',
    icon: XCircle,
    color: 'text-amber-600 bg-amber-100',
  },
  {
    title: 'Move-In Welcome',
    description: 'Welcome letter for new tenants.',
    href: '/documents/letters?type=move-in',
    icon: Home,
    color: 'text-purple-600 bg-purple-100',
  },
  {
    title: 'Move-Out Notice',
    description: 'Instructions for the move-out process.',
    href: '/documents/letters?type=move-out',
    icon: LogOutIcon,
    color: 'text-slate-600 bg-slate-100',
  },
  {
    title: 'Maintenance Confirmation',
    description: 'Confirm receipt of a maintenance request.',
    href: '/documents/letters?type=maintenance-confirm',
    icon: Wrench,
    color: 'text-orange-600 bg-orange-100',
  },
  {
    title: 'Maintenance Completion',
    description: 'Notify tenant that maintenance is complete.',
    href: '/documents/letters?type=maintenance-complete',
    icon: CheckCircle2,
    color: 'text-teal-600 bg-teal-100',
  },
];

export default function DocumentsPage() {
  return (
    <div className="space-y-8">
      <div className="animate-fade-in-up">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Documents</h1>
        <p className="text-sm text-slate-500 mt-1">
          Generate Statements of Account and formal letters as PDF downloads.
          Configure your company info in{' '}
          <Link href="/setup#owner-info" className="text-blue-600 hover:underline font-medium">
            Setup &rarr; Owner / Company Info
          </Link>.
        </p>
      </div>

      {/* ── Statements of Account ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
          Statements of Account
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {statementCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all p-6 flex gap-4 cursor-pointer"
              >
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center`}>
                  <Icon size={22} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{card.description}</p>
                  <span className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-blue-600 group-hover:gap-2 transition-all">
                    Generate &rarr;
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Letters & Notices ── */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
          Letters &amp; Notices
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {letterCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition-all p-5 cursor-pointer"
              >
                <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                  <Icon size={18} />
                </div>
                <h3 className="text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                  {card.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{card.description}</p>
                <span className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-blue-600 group-hover:gap-2 transition-all">
                  Generate &rarr;
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
