export const ALWAYS_VISIBLE_KEYS = ['dashboard', 'setup'] as const;

export const DEFAULT_SIDEBAR_MODULES: Record<string, boolean> = {
  properties: true,
  units: true,
  leases: true,
  income: true,
  expenses: true,
  maintenance: true,
  mileage: false,
  tenants: true,
  'tenant-ledger': true,
  'rent-reminders': true,
  documents: true,
  'dashboards/property': true,
  'dashboards/unit': true,
  'dashboards/monthly': true,
  'dashboards/annual': true,
  'dashboards/five-year': true,
  'dashboards/custom': true,
  'dashboards/comparison': true,
};

export const SIDEBAR_SECTIONS = [
  {
    title: 'Management',
    items: [
      { key: 'dashboard', label: 'Dashboard', alwaysVisible: true },
      { key: 'setup', label: 'Setup', alwaysVisible: true },
      { key: 'properties', label: 'Properties' },
      { key: 'units', label: 'Units' },
      { key: 'leases', label: 'Lease Tracker' },
      { key: 'income', label: 'Income' },
      { key: 'expenses', label: 'Expenses' },
      { key: 'maintenance', label: 'Maintenance' },
      { key: 'mileage', label: 'Mileage' },
    ],
  },
  {
    title: 'Tenant',
    items: [
      { key: 'tenants', label: 'Tenants' },
      { key: 'tenant-ledger', label: 'Tenant Ledger' },
      { key: 'rent-reminders', label: 'Rent Reminders' },
    ],
  },
  {
    title: 'Documents',
    items: [
      { key: 'documents', label: 'Documents' },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { key: 'dashboards/property', label: 'Property' },
      { key: 'dashboards/unit', label: 'Unit' },
      { key: 'dashboards/monthly', label: 'Monthly' },
      { key: 'dashboards/annual', label: 'Annual' },
      { key: 'dashboards/five-year', label: 'Five-Year' },
      { key: 'dashboards/custom', label: 'Custom' },
      { key: 'dashboards/comparison', label: 'Comparison' },
    ],
  },
] as const;
