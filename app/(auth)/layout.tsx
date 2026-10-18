import { Building2 } from 'lucide-react';
import Link from 'next/link';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 p-4">
      {/* Decorative background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-400/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-[420px]">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-3 mb-8 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 transition-transform group-hover:scale-105">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold text-slate-900 tracking-tight">RentalTracker</span>
            <span className="text-[11px] text-slate-500 -mt-0.5">Property Management</span>
          </div>
        </Link>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/60 p-8">
          {children}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          &copy; {new Date().getFullYear()} RentalTracker. All rights reserved.
        </p>
      </div>
    </div>
  );
}
