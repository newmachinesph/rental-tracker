'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { useSetupStore } from '@/lib/store';
import { ALWAYS_VISIBLE_KEYS } from '@/lib/sidebar-modules';
import {
  Settings, FileText, DollarSign, CreditCard, Car, Wrench, Users, Contact,
  LayoutDashboard, Building2, Home, CalendarDays, BarChart3, TrendingUp,
  SlidersHorizontal, GitCompare, ChevronLeft, ChevronRight, LogOut,
  PanelLeftClose, PanelLeftOpen, FileDown, Bell,
} from 'lucide-react';

const navSections = [
  {
    title: 'Management',
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard },
      { label: 'Setup', href: '/setup', icon: Settings },
      { label: 'Properties', href: '/properties', icon: Building2 },
      { label: 'Units', href: '/units', icon: Home },
      { label: 'Lease Tracker', href: '/leases', icon: FileText },
      { label: 'Income', href: '/income', icon: DollarSign },
      { label: 'Expenses', href: '/expenses', icon: CreditCard },
      { label: 'Maintenance', href: '/maintenance', icon: Wrench },
      { label: 'Mileage', href: '/mileage', icon: Car },
    ],
  },
  {
    title: 'Tenant',
    items: [
      { label: 'Tenants', href: '/tenants', icon: Contact },
      { label: 'Tenant Ledger', href: '/tenant-ledger', icon: Users },
      { label: 'Rent Reminders', href: '/rent-reminders', icon: Bell },
    ],
  },
  {
    title: 'Documents',
    items: [
      { label: 'Documents', href: '/documents', icon: FileDown },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { label: 'Property', href: '/dashboards/property', icon: Building2 },
      { label: 'Unit', href: '/dashboards/unit', icon: Home },
      { label: 'Monthly', href: '/dashboards/monthly', icon: CalendarDays },
      { label: 'Annual', href: '/dashboards/annual', icon: BarChart3 },
      { label: 'Five-Year', href: '/dashboards/five-year', icon: TrendingUp },
      { label: 'Custom', href: '/dashboards/custom', icon: SlidersHorizontal },
      { label: 'Comparison', href: '/dashboards/comparison', icon: GitCompare },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const sidebarModules = useSetupStore((s) => s.sidebarModules);

  const filteredSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const key = item.href === '/' ? 'dashboard' : item.href.slice(1);
        if ((ALWAYS_VISIBLE_KEYS as readonly string[]).includes(key)) return true;
        return sidebarModules[key] !== false;
      }),
    }))
    .filter((section) => section.items.length > 0);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setUser({ name: data.name ?? 'Admin', email: data.email ?? '' }); })
      .catch(() => {});
  }, []);

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'A';

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <aside
      className={clsx(
        'fixed top-0 left-0 h-screen bg-sidebar-bg flex flex-col z-50',
        'transition-all duration-300 ease-in-out',
        collapsed ? 'w-[72px]' : 'w-[260px]',
      )}
    >
      {/* Logo */}
      <div className={clsx(
        'flex items-center h-16 border-b border-sidebar-border flex-shrink-0',
        collapsed ? 'justify-center px-2' : 'px-5',
      )}>
        {!collapsed && (
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 size={18} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white leading-none">RentalTracker</span>
              <span className="text-[10px] text-sidebar-text leading-none mt-0.5">Property Management</span>
            </div>
          </Link>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Building2 size={18} className="text-white" />
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {filteredSections.map((section, si) => (
          <div key={section.title} className={clsx(si > 0 && 'mt-6')}>
            {!collapsed && (
              <div className="px-2 mb-2 text-[10px] uppercase tracking-[0.1em] text-sidebar-text font-semibold">
                {section.title}
              </div>
            )}
            {collapsed && si > 0 && <div className="h-px bg-sidebar-border mx-2 mb-3" />}
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href ||
                  (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={clsx(
                      'group/nav relative flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150',
                      collapsed ? 'justify-center p-2.5' : 'px-3 py-2',
                      isActive
                        ? 'bg-sidebar-active text-white shadow-md shadow-primary/20'
                        : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white',
                    )}
                  >
                    <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                    {!collapsed && <span>{item.label}</span>}
                    {collapsed && (
                      <span className="absolute left-full ml-3 px-2.5 py-1 bg-slate-800 text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 invisible group-hover/nav:opacity-100 group-hover/nav:visible transition-all duration-150 pointer-events-none z-50 shadow-lg tooltip-arrow">
                        {item.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-sidebar-border p-3">
        {!collapsed ? (
          <div className="flex items-center gap-3 px-2 py-2 mb-2 rounded-lg bg-sidebar-hover">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-xs font-bold text-white">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user?.name ?? 'Admin'}</p>
              <p className="text-[10px] text-sidebar-text truncate">{user?.email ?? ''}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-sidebar-text hover:text-white transition-colors p-1 cursor-pointer"
              title="Logout"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="flex items-center justify-center p-2.5 mb-2 rounded-lg text-sidebar-text hover:text-white hover:bg-sidebar-hover transition-colors w-full cursor-pointer"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={clsx(
            'flex items-center gap-2 text-sidebar-text hover:text-white transition-colors text-xs w-full rounded-lg hover:bg-sidebar-hover cursor-pointer',
            collapsed ? 'justify-center p-2.5' : 'px-3 py-2',
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
