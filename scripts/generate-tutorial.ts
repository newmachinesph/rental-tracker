/**
 * RentalTracker Admin Guide PDF Generator — Comprehensive Edition
 *
 * Captures screenshots of every page AND compiles them into a detailed
 * admin manual with step-by-step instructions, form field tables,
 * tip/note callouts, and workflow appendices.
 *
 * Usage:  npx tsx scripts/generate-tutorial.ts
 * Output: RentalTracker_Admin_Guide.pdf (project root)
 */

import { chromium, type Page } from 'playwright';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Configuration ────────────────────────────────────────────────────
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = 'admin@gmail.com';
const ADMIN_PASSWORD = 'admin123';
const OUTPUT_FILE = 'RentalTracker_Admin_Guide.pdf';
const VIEWPORT = { width: 1440, height: 900 };

// Brand colors (RGB tuples)
const C = {
  primary: [37, 99, 235] as const,
  dark: [15, 23, 42] as const,
  slate700: [51, 65, 85] as const,
  slate500: [100, 116, 139] as const,
  slate400: [148, 163, 184] as const,
  white: [255, 255, 255] as const,
  lightGray: [248, 250, 252] as const,
  border: [226, 232, 240] as const,
  green: [22, 163, 74] as const,
  amber: [217, 119, 6] as const,
  red: [220, 38, 38] as const,
  lightBlue: [239, 246, 255] as const,
  lightAmber: [255, 251, 235] as const,
  lightRed: [254, 242, 242] as const,
  lightSlate: [248, 250, 252] as const,
};

// A4 Portrait dimensions (mm)
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;

// ── Content Block Types ──────────────────────────────────────────────

interface TextBlock { type: 'text'; content: string }
interface StepsBlock { type: 'steps'; heading?: string; steps: string[] }
interface FieldRow {
  name: string;
  inputType: string;
  required: boolean;
  description: string;
}
interface FieldTableBlock { type: 'fieldTable'; heading?: string; fields: FieldRow[] }
interface TipBlock { type: 'tip'; variant: 'tip' | 'note' | 'important' | 'warning'; content: string }
interface BulletBlock { type: 'bullets'; heading?: string; items: string[] }
interface ScreenshotBlock { type: 'screenshot'; id: string; caption: string }
interface SubheadingBlock { type: 'subheading'; text: string }

type ContentBlock =
  | TextBlock | StepsBlock | FieldTableBlock | TipBlock
  | BulletBlock | ScreenshotBlock | SubheadingBlock;

interface CaptureInstruction {
  id: string;
  setup: (page: Page) => Promise<void>;
  teardown?: (page: Page) => Promise<void>;
}

interface GuideSection {
  title: string;
  route: string;
  group: string;
  waitFor?: string;
  content: ContentBlock[];
  captures: CaptureInstruction[];
}

// ── Section Definitions ──────────────────────────────────────────────

const guideSections: GuideSection[] = [
  // ─────────────── 1. LOGIN ───────────────
  {
    title: 'Login',
    route: '/login',
    group: 'Getting Started',
    captures: [
      {
        id: 'login-page',
        setup: async (p) => {
          await p.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
          await p.waitForTimeout(500);
        },
      },
    ],
    content: [
      { type: 'text', content: 'The Login page is the entry point to the RentalTracker system. All users must authenticate with their email and password before accessing any features.' },
      { type: 'screenshot', id: 'login-page', caption: 'Login page with email and password fields' },
      { type: 'steps', heading: 'How to Sign In', steps: [
        'Open the application URL in your browser (e.g., https://your-domain.com).',
        'You will be redirected to the Login page if not already authenticated.',
        'Enter your email address in the "Email" field.',
        'Enter your password in the "Password" field.',
        'Click the "Sign In" button.',
        'Upon successful authentication, you will be redirected to the Dashboard.',
        'If the credentials are invalid, a red error message will appear.',
      ]},
      { type: 'fieldTable', heading: 'Login Form Fields', fields: [
        { name: 'Email', inputType: 'Email input', required: true, description: 'Your registered admin email address' },
        { name: 'Password', inputType: 'Password input', required: true, description: 'Your account password (characters are hidden)' },
      ]},
      { type: 'tip', variant: 'note', content: 'Default admin credentials: admin@gmail.com / admin123. Change the password after first login for security.' },
      { type: 'tip', variant: 'tip', content: 'Your session lasts 7 days. After that you will need to sign in again.' },
    ],
  },

  // ─────────────── 2. DASHBOARD ───────────────
  {
    title: 'Dashboard',
    route: '/',
    group: 'Getting Started',
    captures: [
      {
        id: 'dashboard-overview',
        setup: async (p) => {
          await p.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
          await p.waitForTimeout(1000);
        },
      },
    ],
    content: [
      { type: 'text', content: 'The Dashboard is your command center providing an at-a-glance overview of your rental business. It displays key performance indicators, revenue trends, quick navigation actions, and recent activity — all updated in real time.' },
      { type: 'screenshot', id: 'dashboard-overview', caption: 'Dashboard with KPI cards, revenue chart, quick actions, and activity feed' },
      { type: 'subheading', text: 'KPI Cards (Top Row)' },
      { type: 'bullets', items: [
        'Total Income — sum of all paid amounts across all income records, with % change vs. previous month.',
        'Total Expenses — sum of all expense totals, with trend indicator.',
        'Net Profit — Total Income minus Total Expenses. Green = positive, Red = negative.',
        'Occupancy Rate — percentage of units with active (current) tenants. Color-coded: green (80%+), amber (50-79%), red (below 50%).',
      ]},
      { type: 'subheading', text: 'Revenue Overview Chart' },
      { type: 'text', content: 'An area chart showing your monthly income trend over time. Hover over data points to see exact values for each month.' },
      { type: 'subheading', text: 'Quick Actions' },
      { type: 'text', content: 'Six shortcut buttons for the most common tasks:' },
      { type: 'bullets', items: [
        'Add Income — navigates to the Income page to record a payment.',
        'Add Expense — navigates to the Expenses page to record a cost.',
        'New Lease — navigates to the Lease Tracker to create a new lease.',
        'Maintenance — navigates to the Maintenance page to create a task.',
        'Reports — navigates to the Property Dashboard for financial analysis.',
        'Settings — navigates to the Setup page for configuration.',
      ]},
      { type: 'subheading', text: 'Recent Activity & Properties Overview' },
      { type: 'bullets', items: [
        'Recent Activity — timeline of the last 6 income and expense transactions.',
        'Properties Overview — summary cards for each property showing occupancy status.',
        'Top Properties by Revenue — bar chart ranking properties by collected income.',
      ]},
      { type: 'tip', variant: 'tip', content: 'The trend percentages on KPI cards compare the current month to the previous month. A green up arrow indicates improvement.' },
    ],
  },

  // ─────────────── 3. SETUP ───────────────
  {
    title: 'Setup',
    route: '/setup',
    group: 'Configuration',
    captures: [
      {
        id: 'setup-overview',
        setup: async (p) => {
          await p.goto(`${BASE_URL}/setup`, { waitUntil: 'networkidle' });
          await p.waitForTimeout(800);
        },
      },
      {
        id: 'setup-properties',
        setup: async (p) => {
          await p.locator('#properties').scrollIntoViewIfNeeded();
          await p.waitForTimeout(400);
        },
      },
      {
        id: 'setup-owner',
        setup: async (p) => {
          await p.locator('#owner-info').scrollIntoViewIfNeeded();
          await p.waitForTimeout(400);
        },
      },
    ],
    content: [
      { type: 'text', content: 'The Setup page is the foundational configuration page for the entire application. You should configure Setup BEFORE using any other features. Properties, categories, and payment methods defined here appear as dropdown options throughout Income, Expenses, Leases, and Maintenance.' },
      { type: 'tip', variant: 'important', content: 'Configure Setup first! All dropdown options (properties, categories, payment methods) in other pages come from your Setup configuration.' },
      { type: 'screenshot', id: 'setup-overview', caption: 'Setup page with quick-jump navigation bar and configuration sections' },
      { type: 'text', content: 'The page has a quick-jump navigation bar at the top to quickly scroll to any section: Currency, Property Types, Property Details, Income Categories, Expense Categories, Payment Methods, Owner / Company Info, and Data Management.' },

      // Currency
      { type: 'subheading', text: '1. Currency Setting' },
      { type: 'steps', steps: [
        'Locate the "Currency Setting" card at the top of the page.',
        'Enter your preferred currency symbol in the input field (e.g., $, €, £, ₱).',
        'The change is saved automatically and applies throughout the application.',
      ]},

      // Property Types
      { type: 'subheading', text: '2. Property Types' },
      { type: 'steps', steps: [
        'Scroll to or click "Property Types" in the quick-jump navigation bar.',
        'To ADD a type: type the new name in the text field and click "Add" or press Enter.',
        'To RENAME: click on an existing chip to edit the text inline.',
        'To DELETE: click the X icon on the chip you want to remove.',
      ]},
      { type: 'tip', variant: 'note', content: 'Default types: Apartment, House, Cottage, Condo, Townhouse, Commercial. Maximum 50 items. Duplicates (case-insensitive) are prevented.' },

      // Properties Table
      { type: 'subheading', text: '3. Property Details' },
      { type: 'text', content: 'This is the most important section. Properties you add here become available in all other pages (Leases, Income, Expenses, Maintenance). Each property has units that are auto-generated based on the unit count.' },
      { type: 'screenshot', id: 'setup-properties', caption: 'Property Details table with inline editing and add row (blue-highlighted)' },
      { type: 'steps', heading: 'Adding a Property', steps: [
        'Scroll to the "Property Details" section.',
        'Look for the bottom row highlighted in light blue — this is the "Add New" row.',
        'Enter the Property Name (required), number of Units (minimum 1), select a Type from the dropdown, and optionally enter an Address.',
        'Click the "Add" button or press Enter to save.',
        'The system automatically creates unit records (Unit 1, Unit 2, etc.) based on the unit count.',
      ]},
      { type: 'steps', heading: 'Editing a Property', steps: [
        'Click any white cell in an existing property row.',
        'The cell becomes editable — modify the value directly.',
        'Changes are saved automatically when you click away or press Enter.',
      ]},
      { type: 'steps', heading: 'Deleting a Property', steps: [
        'Click the trash icon in the Actions column for the property you want to remove.',
        'The property and all its units will be deleted.',
      ]},
      { type: 'fieldTable', heading: 'Property Fields', fields: [
        { name: 'Property Name', inputType: 'Text', required: true, description: 'Descriptive name (e.g., "Sunrise Apartments")' },
        { name: 'Units', inputType: 'Number', required: true, description: 'Number of units. Minimum 1. Auto-generates unit records.' },
        { name: 'Type', inputType: 'Dropdown', required: true, description: 'Select from property types configured above' },
        { name: 'Address', inputType: 'Text', required: false, description: 'Physical address of the property' },
      ]},
      { type: 'tip', variant: 'tip', content: 'White cells are editable; shaded/gray cells are read-only. The # column is auto-generated and cannot be changed.' },
      { type: 'tip', variant: 'warning', content: 'Deleting a property removes all associated units. Leases, income, and expense records referencing this property may be affected.' },

      // Income Categories
      { type: 'subheading', text: '4. Income Categories' },
      { type: 'steps', steps: [
        'Scroll to "Income Categories" or click the link in the navigation bar.',
        'ADD: type a new category name and click "Add" or press Enter.',
        'RENAME: click an existing chip to edit inline.',
        'DELETE: click the X icon on any chip.',
      ]},
      { type: 'tip', variant: 'note', content: 'Defaults: Rent, Parking, Laundry, Pet Fee, Late Fee, Storage, Other Income. These appear in the Income page category dropdown.' },

      // Expense Categories
      { type: 'subheading', text: '5. Expense Categories' },
      { type: 'steps', steps: [
        'Same pattern as Income Categories — add, rename, or delete chips.',
      ]},
      { type: 'tip', variant: 'note', content: 'Defaults: Maintenance, Repairs, Insurance, Property Tax, Utilities, Management Fee, Mortgage, Landscaping, Cleaning, Legal Fees, Advertising, Other Expense.' },

      // Payment Methods
      { type: 'subheading', text: '6. Payment Methods' },
      { type: 'steps', steps: [
        'Same pattern — add, rename, or delete chips.',
      ]},
      { type: 'tip', variant: 'note', content: 'Defaults: Bank Transfer, Cash, Credit Card, Check, E-Transfer, PayPal. These appear in Income and Rent Reminders payment method dropdowns.' },

      // Owner Info
      { type: 'subheading', text: '7. Owner / Company Info' },
      { type: 'text', content: 'This information appears on PDF letterheads for Statements of Account and Letters generated from the Documents page.' },
      { type: 'screenshot', id: 'setup-owner', caption: 'Owner / Company Info form — used for PDF document letterheads' },
      { type: 'steps', steps: [
        'Fill in your Full Name, Company Name, Address, Phone, and Email.',
        'Changes are saved automatically as you type.',
        'This info appears on all generated PDF documents (SOAs and Letters).',
      ]},
      { type: 'fieldTable', heading: 'Owner Info Fields', fields: [
        { name: 'Full Name', inputType: 'Text', required: false, description: 'Your full name as property owner/manager' },
        { name: 'Company Name', inputType: 'Text', required: false, description: 'Your property management company name' },
        { name: 'Address', inputType: 'Text', required: false, description: 'Company/office address' },
        { name: 'Phone', inputType: 'Text', required: false, description: 'Contact phone number' },
        { name: 'Email', inputType: 'Email', required: false, description: 'Contact email address' },
      ]},

      // Data Management
      { type: 'subheading', text: '8. Data Management' },
      { type: 'steps', heading: 'Exporting Data', steps: [
        'Scroll to "Data Management" section.',
        'Click "Export as JSON" to download all your data as a JSON file.',
        'The file includes all properties, units, tenants, leases, income, expenses, maintenance, and settings.',
      ]},
      { type: 'steps', heading: 'Importing Data', steps: [
        'Click "Import JSON" and select a previously exported JSON file.',
        'The system will overwrite all current data with the imported data.',
      ]},
      { type: 'tip', variant: 'warning', content: 'Importing data OVERWRITES all existing data. Always export a backup first before importing.' },
    ],
  },

  // ─────────────── 4. LEASES ───────────────
  {
    title: 'Lease Tracker',
    route: '/leases',
    group: 'Data Management',
    waitFor: '.ag-theme-quartz',
    captures: [
      {
        id: 'leases-overview',
        setup: async (p) => {
          await p.goto(`${BASE_URL}/leases`, { waitUntil: 'networkidle' });
          await p.waitForSelector('.ag-theme-quartz', { timeout: 10000 }).catch(() => {});
          await p.waitForTimeout(500);
        },
      },
      {
        id: 'leases-add-modal',
        setup: async (p) => {
          await p.getByRole('button', { name: /Add Lease/i }).click();
          await p.waitForTimeout(500);
        },
        teardown: async (p) => {
          await p.keyboard.press('Escape');
          await p.waitForTimeout(300);
        },
      },
    ],
    content: [
      { type: 'text', content: 'The Lease Tracker is where you manage all lease agreements and tenant information. You can add tenants, create leases linking tenants to property units, and track active vs. expired agreements.' },
      { type: 'screenshot', id: 'leases-overview', caption: 'Lease Tracker page with KPI cards, filters, and AG Grid data table' },

      { type: 'subheading', text: 'KPI Cards' },
      { type: 'bullets', items: [
        'Total Leases — count of all lease records (filtered by property if a filter is active).',
        'Active Tenants — count of leases where "Current Tenant" is checked.',
        'Avg. Monthly Rent — average monthly rent across active leases.',
        'Total Monthly Revenue — sum of monthly rent from all active leases.',
      ]},

      { type: 'tip', variant: 'tip', content: 'Tenants are managed from the dedicated Tenants page in the sidebar. You can also add a new tenant inline while creating a lease by clicking the green "+" button next to the Tenant dropdown.' },

      { type: 'subheading', text: 'Creating a New Lease' },
      { type: 'steps', steps: [
        'Click the blue "Add Lease" button in the top-right corner.',
        'Select a Property from the dropdown. The Property Type will auto-fill.',
        'Select a Unit — the list is filtered to show only units from the selected property.',
        'Select a Tenant from the dropdown (or use the green "+" to add a new tenant inline).',
        'Check "Current Tenant" if this is an active, ongoing lease.',
        'Set the Lease Start date and Lease End date. The Lease Length field auto-calculates the number of months.',
        'Enter the Monthly Rent amount and Security Deposit.',
        'Optionally check "Recurring Rent" — this will auto-fill the rent amount when you create income records for this tenant.',
        'Add any optional Notes about the lease.',
        'Click "Save" to create the lease record.',
      ]},
      { type: 'screenshot', id: 'leases-add-modal', caption: 'Add Lease modal with cascading Property > Unit > Tenant dropdowns' },
      { type: 'fieldTable', heading: 'Lease Form Fields', fields: [
        { name: 'Property', inputType: 'Dropdown', required: true, description: 'Select the property for this lease' },
        { name: 'Property Type', inputType: 'Auto-filled', required: false, description: 'Automatically shows the type of the selected property' },
        { name: 'Unit', inputType: 'Cascading dropdown', required: true, description: 'Units filtered by selected property' },
        { name: 'Tenant', inputType: 'Dropdown + Add', required: true, description: 'Select existing tenant or add new one with "+"' },
        { name: 'Phone', inputType: 'Auto-filled', required: false, description: 'Auto-populated from selected tenant' },
        { name: 'Email', inputType: 'Auto-filled', required: false, description: 'Auto-populated from selected tenant' },
        { name: 'Current Tenant', inputType: 'Checkbox', required: false, description: 'Check if this lease is currently active' },
        { name: 'Lease Start', inputType: 'Date picker', required: true, description: 'Start date of the lease agreement' },
        { name: 'Lease End', inputType: 'Date picker', required: true, description: 'End date of the lease agreement' },
        { name: 'Lease Length', inputType: 'Auto-calculated', required: false, description: 'Number of months between start and end dates' },
        { name: 'Monthly Rent', inputType: 'Currency input', required: true, description: 'Monthly rental amount' },
        { name: 'Deposit', inputType: 'Currency input', required: false, description: 'Security deposit amount' },
        { name: 'Recurring Rent', inputType: 'Checkbox', required: false, description: 'If checked, rent auto-fills when creating income records' },
        { name: 'Notes', inputType: 'Text area', required: false, description: 'Optional notes about the lease' },
      ]},

      { type: 'subheading', text: 'Editing a Lease' },
      { type: 'steps', steps: [
        'Click any row in the data grid to open the edit modal.',
        'Modify any field in the form.',
        'Click "Save" to apply changes.',
      ]},

      { type: 'subheading', text: 'Deleting a Lease' },
      { type: 'steps', steps: [
        'Click the red trash icon in the rightmost column of the row you want to delete.',
        'The record is removed immediately.',
      ]},
      { type: 'tip', variant: 'warning', content: 'Deletion is immediate and cannot be undone. Use Setup > Data Management > Export to back up your data regularly.' },

      { type: 'subheading', text: 'Filtering & Grid Navigation' },
      { type: 'bullets', items: [
        'Filter by Property — use the "Filter by Property" dropdown to show leases for a specific property only.',
        'Sorting — click any column header to sort ascending/descending.',
        'Pagination — use the controls at the bottom of the grid. Options: 10, 15, 25, or 50 rows per page.',
        'Column Resize — drag the edge of any column header to resize.',
      ]},
      { type: 'tip', variant: 'tip', content: 'The cascading dropdown pattern (Property → Unit → Tenant) is used throughout the app. Selecting a Property filters the Unit list; selecting a Unit filters the Tenant list.' },
    ],
  },

  // ─────────────── 5. TENANTS ───────────────
  {
    title: 'Tenants',
    route: '/tenants',
    group: 'Data Management',
    waitFor: '.ag-theme-quartz',
    captures: [
      {
        id: 'tenants-overview',
        setup: async (p) => {
          await p.goto(`${BASE_URL}/tenants`, { waitUntil: 'networkidle' });
          await p.waitForSelector('.ag-theme-quartz', { timeout: 10000 }).catch(() => {});
          await p.waitForTimeout(500);
        },
      },
      {
        id: 'tenants-add-modal',
        setup: async (p) => {
          await p.getByRole('button', { name: /Add Tenant/i }).click();
          await p.waitForTimeout(500);
        },
        teardown: async (p) => {
          await p.keyboard.press('Escape');
          await p.waitForTimeout(300);
        },
      },
    ],
    content: [
      { type: 'text', content: 'The Tenants page provides a dedicated, centralized view for managing all tenant records. You can add, edit, and delete tenants, view their lease associations, and filter by property. Tenants created here are available for selection in Lease Tracker, Income, and other pages.' },
      { type: 'screenshot', id: 'tenants-overview', caption: 'Tenants page with KPI cards, property filter, and tenant grid' },

      { type: 'subheading', text: 'KPI Cards' },
      { type: 'bullets', items: [
        'Total Tenants — count of all tenant records (filtered by property if active).',
        'Active Tenants — count of tenants with at least one active (current) lease.',
        'Without Leases — count of tenants not currently linked to any lease.',
      ]},

      { type: 'subheading', text: 'Adding a New Tenant' },
      { type: 'steps', steps: [
        'Click the blue "Add Tenant" button in the top-right corner.',
        'Enter the tenant\'s Full Name (required).',
        'Optionally enter their Phone Number.',
        'Optionally enter their Email Address.',
        'Click "Add Tenant" to save the record.',
        'The tenant will now appear in the grid and be available in Lease Tracker dropdowns.',
      ]},
      { type: 'screenshot', id: 'tenants-add-modal', caption: 'Add New Tenant modal with name, phone, and email fields' },
      { type: 'fieldTable', heading: 'Tenant Form Fields', fields: [
        { name: 'Full Name', inputType: 'Text', required: true, description: 'Tenant\'s full legal name' },
        { name: 'Phone Number', inputType: 'Tel', required: false, description: 'Contact phone number' },
        { name: 'Email Address', inputType: 'Email', required: false, description: 'Contact email address' },
      ]},

      { type: 'subheading', text: 'Editing a Tenant' },
      { type: 'steps', steps: [
        'Click any row in the data grid to open the Edit Tenant modal.',
        'Modify the name, phone, or email fields as needed.',
        'Click "Update Tenant" to save changes.',
      ]},

      { type: 'subheading', text: 'Deleting a Tenant' },
      { type: 'steps', steps: [
        'Click the red trash icon in the rightmost column of the row you want to delete.',
        'If the tenant has no leases, the record is removed immediately.',
        'If the tenant has active leases, a warning will appear — you must remove their leases first.',
      ]},
      { type: 'tip', variant: 'warning', content: 'You cannot delete a tenant who has existing leases. Remove or reassign their leases in the Lease Tracker page first.' },

      { type: 'subheading', text: 'Grid Columns' },
      { type: 'bullets', items: [
        'Name — the tenant\'s full name (bold text).',
        'Phone — phone number, or "--" if not provided.',
        'Email — email address, or "--" if not provided.',
        'Active Leases — count of current leases. Green badge if active, gray if none.',
        'Properties — comma-separated list of properties where the tenant has leases.',
        'Actions — red trash icon to delete the tenant.',
      ]},

      { type: 'subheading', text: 'Filtering by Property' },
      { type: 'text', content: 'Use the "Property" dropdown filter above the grid to show only tenants who have leases at a specific property. Select "All Properties" to reset the filter.' },
      { type: 'tip', variant: 'tip', content: 'Tenants can also be added directly from the Lease Tracker page when creating a new lease. Both methods create the same tenant record.' },
    ],
  },

  // ─────────────── 6. INCOME ────────────────
  {
    title: 'Income',
    route: '/income',
    group: 'Data Management',
    waitFor: '.ag-theme-quartz',
    captures: [
      {
        id: 'income-overview',
        setup: async (p) => {
          await p.goto(`${BASE_URL}/income`, { waitUntil: 'networkidle' });
          await p.waitForSelector('.ag-theme-quartz', { timeout: 10000 }).catch(() => {});
          await p.waitForTimeout(500);
        },
      },
      {
        id: 'income-add-modal',
        setup: async (p) => {
          await p.getByRole('button', { name: /Add Income/i }).click();
          await p.waitForTimeout(500);
        },
        teardown: async (p) => {
          await p.keyboard.press('Escape');
          await p.waitForTimeout(300);
        },
      },
    ],
    content: [
      { type: 'text', content: 'The Income page tracks all rental income, payments, and outstanding balances. The system automatically calculates payment status, outstanding amounts, and delay days based on the values you enter.' },
      { type: 'screenshot', id: 'income-overview', caption: 'Income page with KPI cards, property filter, and payment records grid' },

      { type: 'subheading', text: 'KPI Cards' },
      { type: 'bullets', items: [
        'Records — total count of income records (filtered if a property filter is active).',
        'Total Due — sum of all Total Due amounts across records.',
        'Total Paid — sum of all Amount Paid values.',
        'Outstanding — sum of all unpaid/partially paid balances.',
      ]},

      { type: 'subheading', text: 'Adding an Income Record' },
      { type: 'steps', steps: [
        'Click the blue "Add Income" button in the top-right corner.',
        'Select a Property from the dropdown.',
        'Select a Unit — filtered by the chosen property.',
        'Select a Tenant — filtered by the chosen unit. If the tenant has a recurring lease, the Rent Amount auto-fills.',
        'Select a Category (e.g., Rent, Parking, Late Fee).',
        'Enter the Rent Due Date.',
        'Verify/enter the Rent Amount.',
        'Optionally enter Additional Income (parking, fees, etc.). The Total Due auto-calculates as Rent Amount + Additional Income.',
        'When the tenant pays: enter the Payment Date, Amount Paid, and select a Payment Method.',
        'The system auto-calculates Outstanding Balance (Total Due - Amount Paid) and Payment Status.',
        'Click "Save" to create the record.',
      ]},
      { type: 'screenshot', id: 'income-add-modal', caption: 'Add Income modal showing form fields with auto-calculated values' },
      { type: 'fieldTable', heading: 'Income Form Fields', fields: [
        { name: 'Property', inputType: 'Dropdown', required: true, description: 'Select the property for this record' },
        { name: 'Unit', inputType: 'Cascading dropdown', required: true, description: 'Filtered by selected property' },
        { name: 'Tenant', inputType: 'Cascading dropdown', required: true, description: 'Filtered by selected unit' },
        { name: 'Category', inputType: 'Dropdown', required: true, description: 'Income category (from Setup)' },
        { name: 'Rent Due Date', inputType: 'Date picker', required: true, description: 'Date when rent is due' },
        { name: 'Rent Amount', inputType: 'Currency input', required: true, description: 'Base rent amount. Auto-fills if tenant has recurring lease.' },
        { name: 'Additional Income', inputType: 'Currency input', required: false, description: 'Extra income (parking, pet fee, etc.)' },
        { name: 'Total Due', inputType: 'Auto-calculated', required: false, description: 'Rent Amount + Additional Income' },
        { name: 'Payment Date', inputType: 'Date picker', required: false, description: 'Date payment was received' },
        { name: 'Amount Paid', inputType: 'Currency input', required: false, description: 'Amount actually paid by tenant' },
        { name: 'Outstanding Balance', inputType: 'Auto-calculated', required: false, description: 'Total Due - Amount Paid' },
        { name: 'Payment Status', inputType: 'Auto-calculated', required: false, description: 'Paid / Partially Paid / Unpaid / Overpaid' },
        { name: 'Delay Days', inputType: 'Auto-calculated', required: false, description: 'Days between Due Date and Payment Date' },
        { name: 'Payment Method', inputType: 'Dropdown', required: false, description: 'Method of payment (from Setup)' },
        { name: 'Notes', inputType: 'Text area', required: false, description: 'Optional notes' },
      ]},

      { type: 'subheading', text: 'Payment Status Logic' },
      { type: 'text', content: 'The payment status is automatically determined based on the amounts entered:' },
      { type: 'bullets', items: [
        'Paid (green badge) — Amount Paid equals Total Due. Balance is zero.',
        'Partially Paid (amber badge) — Amount Paid is greater than zero but less than Total Due.',
        'Unpaid (red badge) — No payment recorded (Amount Paid is zero or blank).',
        'Overpaid (blue badge) — Amount Paid exceeds Total Due.',
      ]},

      { type: 'subheading', text: 'Editing an Income Record' },
      { type: 'steps', steps: [
        'Click any row in the grid to open the edit modal.',
        'Update payment information (add Payment Date, Amount Paid, Payment Method).',
        'All auto-calculated fields (Outstanding Balance, Status, Delay Days) update automatically.',
        'Click "Save" to apply changes.',
      ]},

      { type: 'subheading', text: 'Deleting an Income Record' },
      { type: 'steps', steps: [
        'Click the red trash icon in the Actions column.',
        'The record is removed immediately.',
      ]},
      { type: 'tip', variant: 'tip', content: 'If a tenant has "Recurring Rent" checked on their lease, the Rent Amount will automatically fill when you select that tenant in the Income form.' },
      { type: 'tip', variant: 'note', content: 'Delay Days is calculated only when a Payment Date is provided. If the payment was on time or early, Delay Days is 0.' },
    ],
  },

  // ─────────────── 6. EXPENSES ───────────────
  {
    title: 'Expenses',
    route: '/expenses',
    group: 'Data Management',
    waitFor: '.ag-theme-quartz',
    captures: [
      {
        id: 'expenses-overview',
        setup: async (p) => {
          await p.goto(`${BASE_URL}/expenses`, { waitUntil: 'networkidle' });
          await p.waitForSelector('.ag-theme-quartz', { timeout: 10000 }).catch(() => {});
          await p.waitForTimeout(500);
        },
      },
      {
        id: 'expenses-add-modal',
        setup: async (p) => {
          await p.getByRole('button', { name: /Add Expense/i }).click();
          await p.waitForTimeout(500);
        },
        teardown: async (p) => {
          await p.keyboard.press('Escape');
          await p.waitForTimeout(300);
        },
      },
    ],
    content: [
      { type: 'text', content: 'The Expenses page lets you record and manage all property-related costs. Expenses can be assigned to specific units or to entire buildings (for shared costs like insurance or common area maintenance).' },
      { type: 'screenshot', id: 'expenses-overview', caption: 'Expenses page with KPI cards, property filter, and expense records grid' },

      { type: 'subheading', text: 'KPI Cards' },
      { type: 'bullets', items: [
        'Records — total count of expense records.',
        'Amount — sum of base expense amounts.',
        'Additional Fees — sum of all additional fee amounts.',
        'Total Expenses — sum of all totals (Amount + Additional Fees).',
      ]},

      { type: 'subheading', text: 'Adding an Expense' },
      { type: 'steps', steps: [
        'Click the blue "Add Expense" button.',
        'Enter the Date of the expense (defaults to today).',
        'Select a Property from the dropdown.',
        'Choose whether this expense applies to the Entire Building (check the box) or a specific Unit.',
        'If "Applies to Entire Building" is unchecked, select a specific Unit from the dropdown.',
        'Select an Expense Category (from Setup).',
        'Enter the Amount.',
        'Optionally enter Additional Fees. The Total auto-calculates as Amount + Additional Fees.',
        'Add optional Notes.',
        'Click "Save" to create the expense record.',
      ]},
      { type: 'screenshot', id: 'expenses-add-modal', caption: 'Add Expense modal with "Applies to Entire Building" checkbox' },
      { type: 'fieldTable', heading: 'Expense Form Fields', fields: [
        { name: 'Date', inputType: 'Date picker', required: true, description: 'Date of the expense' },
        { name: 'Property', inputType: 'Dropdown', required: true, description: 'Select the property' },
        { name: 'Entire Building', inputType: 'Checkbox', required: false, description: 'Check if expense applies to all units' },
        { name: 'Unit', inputType: 'Cascading dropdown', required: false, description: 'Disabled when "Entire Building" is checked' },
        { name: 'Category', inputType: 'Dropdown', required: true, description: 'Expense category (from Setup)' },
        { name: 'Amount', inputType: 'Currency input', required: true, description: 'Base expense amount' },
        { name: 'Additional Fees', inputType: 'Currency input', required: false, description: 'Extra fees or charges' },
        { name: 'Total', inputType: 'Auto-calculated', required: false, description: 'Amount + Additional Fees' },
        { name: 'Notes', inputType: 'Text area', required: false, description: 'Optional notes about the expense' },
      ]},

      { type: 'subheading', text: 'Editing / Deleting Expenses' },
      { type: 'steps', steps: [
        'Click any row to open the edit modal. Modify fields and click "Save".',
        'Click the red trash icon to delete a record immediately.',
      ]},
      { type: 'tip', variant: 'tip', content: 'Use "Applies to Entire Building" for shared costs like insurance, property tax, or common area maintenance. Unit-specific expenses (e.g., appliance repair in Unit 3) should have a specific unit selected.' },
    ],
  },

  // ─────────────── 7. MAINTENANCE ───────────────
  {
    title: 'Maintenance',
    route: '/maintenance',
    group: 'Data Management',
    waitFor: '.ag-theme-quartz',
    captures: [
      {
        id: 'maintenance-overview',
        setup: async (p) => {
          await p.goto(`${BASE_URL}/maintenance`, { waitUntil: 'networkidle' });
          await p.waitForSelector('.ag-theme-quartz', { timeout: 10000 }).catch(() => {});
          await p.waitForTimeout(500);
        },
      },
      {
        id: 'maintenance-add-modal',
        setup: async (p) => {
          await p.getByRole('button', { name: /Add Task/i }).click();
          await p.waitForTimeout(500);
        },
        teardown: async (p) => {
          await p.keyboard.press('Escape');
          await p.waitForTimeout(300);
        },
      },
    ],
    content: [
      { type: 'text', content: 'The Maintenance page tracks all work orders, repair tasks, and their progress. Manage contractor information, costs, priorities, and task statuses in one place.' },
      { type: 'screenshot', id: 'maintenance-overview', caption: 'Maintenance page with 6 KPI cards, multi-filter bar, and task grid' },

      { type: 'subheading', text: 'KPI Cards' },
      { type: 'bullets', items: [
        'Total Tasks — count of all maintenance records.',
        'Open — tasks with "Open" status.',
        'In Progress — tasks currently being worked on.',
        'Completed — finished tasks.',
        'Estimated Cost — sum of all estimated costs.',
        'Actual Cost — sum of all actual costs incurred.',
      ]},

      { type: 'subheading', text: 'Adding a Maintenance Task' },
      { type: 'steps', steps: [
        'Click the blue "Add Task" button.',
        'Select a Property and choose whether it applies to the Entire Building or a specific Unit.',
        'Enter the Date Reported.',
        'Write a Description of the issue (e.g., "Broken faucet in bathroom").',
        'Set the Priority: Low, Medium, High, or Urgent.',
        'Enter the Category (e.g., Plumbing, Electrical, HVAC).',
        'Enter the Contractor name if assigned.',
        'Set Estimated Cost and Actual Cost (can be updated later when work is done).',
        'Set Payment Status: Unpaid, Partially Paid, or Paid.',
        'Set the Task Status: Open, In Progress, Completed, or On Hold.',
        'Enter Completion Date when the task is finished.',
        'Add optional Notes.',
        'Click "Save".',
      ]},
      { type: 'screenshot', id: 'maintenance-add-modal', caption: 'Add Maintenance Task modal with priority, status, and cost fields' },
      { type: 'fieldTable', heading: 'Maintenance Form Fields', fields: [
        { name: 'Property', inputType: 'Dropdown', required: true, description: 'Select the property' },
        { name: 'Entire Building', inputType: 'Checkbox', required: false, description: 'Check if task affects the whole building' },
        { name: 'Unit', inputType: 'Cascading dropdown', required: false, description: 'Disabled when "Entire Building" is checked' },
        { name: 'Date Reported', inputType: 'Date picker', required: true, description: 'When the issue was reported' },
        { name: 'Description', inputType: 'Text area', required: true, description: 'Detailed description of the maintenance issue' },
        { name: 'Priority', inputType: 'Dropdown', required: true, description: 'Low / Medium / High / Urgent' },
        { name: 'Category', inputType: 'Text input', required: false, description: 'Type of work (Plumbing, Electrical, etc.)' },
        { name: 'Contractor', inputType: 'Text input', required: false, description: 'Name of assigned contractor' },
        { name: 'Estimated Cost', inputType: 'Currency input', required: false, description: 'Expected cost of the work' },
        { name: 'Actual Cost', inputType: 'Currency input', required: false, description: 'Actual cost after completion' },
        { name: 'Payment Status', inputType: 'Dropdown', required: false, description: 'Unpaid / Partially Paid / Paid' },
        { name: 'Status', inputType: 'Dropdown', required: true, description: 'Open / In Progress / Completed / On Hold' },
        { name: 'Completion Date', inputType: 'Date picker', required: false, description: 'Date the task was completed' },
        { name: 'Notes', inputType: 'Text area', required: false, description: 'Optional notes' },
      ]},

      { type: 'subheading', text: 'Badge Color Coding' },
      { type: 'text', content: 'Tasks use color-coded badges for quick visual identification:' },
      { type: 'bullets', items: [
        'Priority — Low (gray), Medium (blue), High (amber), Urgent (red).',
        'Status — Open (blue), In Progress (amber), Completed (green), On Hold (gray).',
        'Payment — Unpaid (red), Partially Paid (amber), Paid (green).',
      ]},

      { type: 'subheading', text: 'Filtering Tasks' },
      { type: 'text', content: 'The maintenance page supports three simultaneous filters:' },
      { type: 'bullets', items: [
        'Filter by Property — show tasks for a specific property.',
        'Filter by Status — show only Open, In Progress, Completed, or On Hold tasks.',
        'Filter by Priority — show only Low, Medium, High, or Urgent tasks.',
      ]},

      { type: 'subheading', text: 'Editing / Deleting Tasks' },
      { type: 'steps', steps: [
        'Click any row to edit. Common update: change Status from "Open" to "In Progress" or "Completed", update Actual Cost and Completion Date.',
        'Click the red trash icon to delete a task immediately.',
      ]},
      { type: 'tip', variant: 'tip', content: 'Typical workflow: Create task as "Open" → assign contractor and update to "In Progress" → when done, set "Completed", enter Actual Cost and Completion Date, mark Payment Status as "Paid".' },
    ],
  },

  // ─────────────── 8. TENANT LEDGER ───────────────
  {
    title: 'Tenant Ledger',
    route: '/tenant-ledger',
    group: 'Tenant Tools',
    captures: [
      {
        id: 'tenant-ledger',
        setup: async (p) => {
          await p.goto(`${BASE_URL}/tenant-ledger`, { waitUntil: 'networkidle' });
          await p.waitForTimeout(800);
        },
      },
    ],
    content: [
      { type: 'text', content: 'The Tenant Ledger provides a detailed payment history view for any specific tenant. It aggregates all income records, lease information, and calculates the tenant\'s overall financial standing.' },
      { type: 'screenshot', id: 'tenant-ledger', caption: 'Tenant Ledger page with cascading selectors and payment history' },

      { type: 'subheading', text: 'Selecting a Tenant' },
      { type: 'steps', steps: [
        'Use the cascading dropdowns at the top of the page:',
        'Select a Property — this enables the Unit dropdown.',
        'Select a Unit — this enables the Tenant dropdown.',
        'Select a Tenant — the ledger loads with their complete payment history.',
        'Optionally check/uncheck "Show Current Tenants Only" to filter by active leases.',
      ]},

      { type: 'subheading', text: 'Information Displayed' },
      { type: 'text', content: 'Once a tenant is selected, the page shows:' },
      { type: 'bullets', items: [
        'Status Badge — color-coded tenant standing: Excellent (green, always pays on time), Caution (amber, history of late payments), Alert (red, has outstanding balance).',
        'Contact Information — tenant name, email, and phone number.',
        'Lease Information — lease start/end dates and duration.',
        'Monthly Rent — the rent amount from the active lease.',
        'Total Amount Due — sum of all Total Due from income records.',
        'Outstanding Balance — sum of all unpaid/partially paid balances.',
        'Payment History Table — every income record showing due dates, amounts, payments, status, and delay days.',
      ]},

      { type: 'subheading', text: 'Status Badge Logic' },
      { type: 'bullets', items: [
        'Excellent (green) — all records fully paid and no late payments.',
        'Caution (amber) — all records paid but some had delays (late payments).',
        'Alert (red) — any outstanding balance exists (unpaid or partially paid records).',
      ]},
      { type: 'tip', variant: 'tip', content: 'This page is read-only. To record a payment, go to the Income page or use the Rent Reminders page.' },
    ],
  },

  // ─────────────── 9. RENT REMINDERS ───────────────
  {
    title: 'Rent Reminders',
    route: '/rent-reminders',
    group: 'Tenant Tools',
    captures: [
      {
        id: 'rent-reminders',
        setup: async (p) => {
          await p.goto(`${BASE_URL}/rent-reminders`, { waitUntil: 'networkidle' });
          await p.waitForTimeout(800);
        },
      },
    ],
    content: [
      { type: 'text', content: 'The Rent Reminders page monitors all overdue and outstanding rent payments. It helps you track which tenants need follow-up and lets you record payments directly from this page.' },
      { type: 'screenshot', id: 'rent-reminders', caption: 'Rent Reminders page with KPI cards and reminder cards for outstanding payments' },

      { type: 'subheading', text: 'KPI Cards' },
      { type: 'bullets', items: [
        'Total Outstanding — total amount of unpaid rent across all tenants.',
        'Pending — count of reminders not yet marked as contacted.',
        'Contacted — count of reminders where you\'ve reached out to the tenant.',
        'Total Reminders — total reminder count.',
      ]},

      { type: 'subheading', text: 'Reminder Cards' },
      { type: 'text', content: 'Each card shows:' },
      { type: 'bullets', items: [
        'Property name and Unit number.',
        'Tenant name with clickable phone (tel:) and email (mailto:) links.',
        'Outstanding amount displayed prominently in red.',
        'Days Overdue badge — color-coded: red (30+ days), orange (14-29), amber (7-13), yellow (1-6), gray (current).',
        'Payment details: Due Date, Total Due, Amount Paid.',
      ]},

      { type: 'subheading', text: 'Actions' },
      { type: 'steps', heading: 'Marking a Tenant as Contacted', steps: [
        'Click the "Mark Contacted" button on the reminder card.',
        'The card moves to the "Contacted" section and fades out visually.',
        'Click again to unmark if needed.',
        'Use the "Clear all contacted" button at the top to reset all contacted statuses.',
      ]},
      { type: 'steps', heading: 'Recording a Payment', steps: [
        'Click the "Record Payment" button on the reminder card.',
        'A modal opens showing the outstanding balance.',
        'Enter the Payment Amount, Payment Date, and Payment Method.',
        'Click "Record Payment" to save. The income record is updated automatically.',
        'If fully paid, the reminder disappears from the list.',
      ]},
      { type: 'tip', variant: 'tip', content: 'When all outstanding payments are cleared, the page shows a celebratory "All Caught Up!" message.' },
    ],
  },

  // ─────────────── 10. DOCUMENTS ───────────────
  {
    title: 'Documents Hub',
    route: '/documents',
    group: 'Documents',
    captures: [
      {
        id: 'documents-hub',
        setup: async (p) => {
          await p.goto(`${BASE_URL}/documents`, { waitUntil: 'networkidle' });
          await p.waitForTimeout(500);
        },
      },
    ],
    content: [
      { type: 'text', content: 'The Documents Hub is your central location for generating professional PDF documents. It includes Statements of Account for financial reporting and Letter templates for tenant communication.' },
      { type: 'screenshot', id: 'documents-hub', caption: 'Documents Hub with Statements of Account and Letters & Notices sections' },

      { type: 'subheading', text: 'Statements of Account' },
      { type: 'bullets', items: [
        'Tenant Statement of Account — generates a detailed PDF showing a specific tenant\'s payment history, balances, and transaction summary. Navigate to it, select Property > Unit > Tenant, optionally set a date range, then click "Download PDF".',
        'Owner Statement of Account — generates a financial summary showing income vs. expenses, net profit, and breakdowns by property. Select a property and date range, then download.',
      ]},

      { type: 'subheading', text: 'Letters & Notices' },
      { type: 'text', content: 'Eight pre-built letter templates for common tenant communications:' },
      { type: 'bullets', items: [
        'Rent Reminder — friendly reminder that rent is due soon.',
        'Late Payment Notice — formal notice for overdue rent.',
        'Lease Renewal — offer to renew an expiring lease.',
        'Lease Termination — formal notice of lease termination.',
        'Move-In Welcome — welcome letter for new tenants.',
        'Move-Out Notice — instructions for the move-out process.',
        'Maintenance Confirmation — confirms receipt of a maintenance request.',
        'Maintenance Completion — notifies tenant that maintenance work is complete.',
      ]},
      { type: 'tip', variant: 'important', content: 'All generated PDFs use your company letterhead from Setup > Owner / Company Info. Make sure to fill in your details before generating documents.' },
    ],
  },

  // ─────────────── 11-17. ANALYTICS DASHBOARDS ───────────────
  {
    title: 'Property Dashboard',
    route: '/dashboards/property',
    group: 'Analytics',
    captures: [{
      id: 'dash-property',
      setup: async (p) => {
        await p.goto(`${BASE_URL}/dashboards/property`, { waitUntil: 'networkidle' });
        await p.waitForTimeout(1000);
      },
    }],
    content: [
      { type: 'text', content: 'Analyze financial performance at the property level. Compare income, expenses, and profit across all your properties with interactive charts and detailed data tables.' },
      { type: 'screenshot', id: 'dash-property', caption: 'Property Dashboard with bar charts and property comparison table' },
      { type: 'bullets', items: [
        'Date range selector to filter by custom periods.',
        'Bar chart comparing Income vs. Expenses by property.',
        'Pie chart showing profit margin distribution.',
        'Data table with income, expenses, profit, and margin for each property.',
      ]},
    ],
  },
  {
    title: 'Unit Dashboard',
    route: '/dashboards/unit',
    group: 'Analytics',
    captures: [{
      id: 'dash-unit',
      setup: async (p) => {
        await p.goto(`${BASE_URL}/dashboards/unit`, { waitUntil: 'networkidle' });
        await p.waitForTimeout(1000);
      },
    }],
    content: [
      { type: 'text', content: 'Drill down to unit-level financial analysis. Filter by property to see which units are your best and worst performers.' },
      { type: 'screenshot', id: 'dash-unit', caption: 'Unit Dashboard with unit profitability comparison' },
      { type: 'bullets', items: [
        'Property filter to see units for a specific building.',
        'Unit profitability comparison charts.',
        'Income distribution across units.',
        'Unit summary table with occupancy and revenue data.',
      ]},
    ],
  },
  {
    title: 'Monthly Dashboard',
    route: '/dashboards/monthly',
    group: 'Analytics',
    captures: [{
      id: 'dash-monthly',
      setup: async (p) => {
        await p.goto(`${BASE_URL}/dashboards/monthly`, { waitUntil: 'networkidle' });
        await p.waitForTimeout(1000);
      },
    }],
    content: [
      { type: 'text', content: 'View monthly financial trends to understand seasonal patterns and track month-over-month performance changes.' },
      { type: 'screenshot', id: 'dash-monthly', caption: 'Monthly Dashboard with income and expense trends' },
      { type: 'bullets', items: [
        'Year selector to view different years.',
        'Income by category breakdown (pie chart).',
        'Expense by category breakdown (pie chart).',
        'Monthly trend lines and period comparisons.',
      ]},
    ],
  },
  {
    title: 'Annual Dashboard',
    route: '/dashboards/annual',
    group: 'Analytics',
    captures: [{
      id: 'dash-annual',
      setup: async (p) => {
        await p.goto(`${BASE_URL}/dashboards/annual`, { waitUntil: 'networkidle' });
        await p.waitForTimeout(1000);
      },
    }],
    content: [
      { type: 'text', content: 'Review annual financial performance with year-over-year comparisons and quarterly breakdowns.' },
      { type: 'screenshot', id: 'dash-annual', caption: 'Annual Dashboard with yearly summary and comparisons' },
      { type: 'bullets', items: [
        'Annual income and expense summary.',
        'Year-over-year comparison with percentage changes.',
        'Quarterly financial breakdown.',
      ]},
    ],
  },
  {
    title: 'Five-Year Dashboard',
    route: '/dashboards/five-year',
    group: 'Analytics',
    captures: [{
      id: 'dash-five-year',
      setup: async (p) => {
        await p.goto(`${BASE_URL}/dashboards/five-year`, { waitUntil: 'networkidle' });
        await p.waitForTimeout(1000);
      },
    }],
    content: [
      { type: 'text', content: 'Track long-term trends in your rental business over a rolling 5-year period. Ideal for strategic planning and identifying growth patterns.' },
      { type: 'screenshot', id: 'dash-five-year', caption: 'Five-Year Dashboard with long-term trend lines' },
      { type: 'bullets', items: [
        '5-year income and expense trend lines.',
        'Year-over-year comparison table.',
        'Growth rate indicators and projections.',
      ]},
    ],
  },
  {
    title: 'Custom Dashboard',
    route: '/dashboards/custom',
    group: 'Analytics',
    captures: [{
      id: 'dash-custom',
      setup: async (p) => {
        await p.goto(`${BASE_URL}/dashboards/custom`, { waitUntil: 'networkidle' });
        await p.waitForTimeout(1000);
      },
    }],
    content: [
      { type: 'text', content: 'Create custom reports with flexible date ranges and property selections for tailored financial analysis.' },
      { type: 'screenshot', id: 'dash-custom', caption: 'Custom Dashboard with date range and property selectors' },
      { type: 'bullets', items: [
        'Fully custom date range selector (start and end dates).',
        'Multi-property selection.',
        'Chart type options (bar, pie, line).',
        'Metric selector (income, expenses, profit).',
      ]},
    ],
  },
  {
    title: 'Comparison Dashboard',
    route: '/dashboards/comparison',
    group: 'Analytics',
    captures: [{
      id: 'dash-comparison',
      setup: async (p) => {
        await p.goto(`${BASE_URL}/dashboards/comparison`, { waitUntil: 'networkidle' });
        await p.waitForTimeout(1000);
      },
    }],
    content: [
      { type: 'text', content: 'Compare properties side-by-side to evaluate relative performance across your entire portfolio.' },
      { type: 'screenshot', id: 'dash-comparison', caption: 'Comparison Dashboard with side-by-side property metrics' },
      { type: 'bullets', items: [
        'Select multiple properties to compare.',
        'Side-by-side KPI comparison cards.',
        'Comparative bar charts showing income, expenses, and profit.',
        'Profit margin comparison.',
      ]},
    ],
  },
];

// ── Workflow Appendix Data ────────────────────────────────────────────

const workflows = [
  {
    title: 'A. Setting Up Your First Property',
    steps: [
      'Go to Setup and set your preferred Currency symbol.',
      'In Property Types, add the types of properties you manage (e.g., Apartment, House, Condo).',
      'In Property Details, add your first property with a name, unit count, type, and address.',
      'The system auto-generates unit records (Unit 1, Unit 2, etc.) based on the count.',
      'Add Income Categories you\'ll use (e.g., Rent, Parking, Late Fee).',
      'Add Expense Categories (e.g., Maintenance, Insurance, Property Tax).',
      'Add Payment Methods your tenants use (e.g., Bank Transfer, Cash, Check).',
      'Fill in Owner / Company Info for PDF letterheads.',
    ],
  },
  {
    title: 'B. Onboarding a New Tenant',
    steps: [
      'Go to the Tenants page in the sidebar.',
      'Click "Add Tenant" and enter the tenant\'s name, phone, and email.',
      'Click "Add Tenant" in the modal to save the record.',
      'Go to the Lease Tracker page.',
      'Click "Add Lease" and select the property, unit, and the new tenant.',
      'Set the lease start and end dates, monthly rent, and deposit.',
      'Check "Current Tenant" and optionally "Recurring Rent".',
      'Click "Save" to finalize the lease.',
      'The tenant will now appear in Income, Tenant Ledger, and Rent Reminders.',
    ],
  },
  {
    title: 'C. Recording a Rent Payment',
    steps: [
      'Go to the Income page and click "Add Income".',
      'Select Property > Unit > Tenant (rent auto-fills if "Recurring" is set).',
      'Set the Rent Due Date and verify the Rent Amount.',
      'When the tenant pays: enter Payment Date, Amount Paid, and Payment Method.',
      'The system auto-calculates Total Due, Outstanding Balance, Payment Status, and Delay Days.',
      'Click "Save" to record the payment.',
      'Check the Tenant Ledger to confirm the payment appears in history.',
    ],
  },
  {
    title: 'D. Handling Late Payments',
    steps: [
      'Go to Rent Reminders to see all outstanding payments.',
      'Filter by property if needed to focus on specific buildings.',
      'Use the phone/email links on reminder cards to contact tenants.',
      'Click "Mark Contacted" to track your outreach.',
      'When payment arrives, click "Record Payment" on the reminder card.',
      'Enter the payment amount, date, and method in the modal.',
      'For formal notices, go to Documents > Letters > Late Payment Notice.',
    ],
  },
  {
    title: 'E. Generating Documents',
    steps: [
      'Ensure your Owner / Company Info is filled in at Setup > Owner / Company Info.',
      'Go to the Documents Hub page.',
      'For Tenant Statements: click "Tenant Statement of Account", select tenant, set date range, download PDF.',
      'For Owner Statements: click "Owner Statement of Account", select property, set date range, download PDF.',
      'For Letters: click the appropriate letter type, select tenant, customize if needed, and download.',
      'All PDFs include your company letterhead automatically.',
    ],
  },
  {
    title: 'F. Monthly Financial Review',
    steps: [
      'Start at the Dashboard for a quick overview of KPIs.',
      'Go to the Monthly Dashboard and select the current year.',
      'Review income and expense breakdowns by category.',
      'Go to the Property Dashboard for property-level analysis.',
      'Use the Comparison Dashboard to compare property performance.',
      'Generate an Owner Statement of Account for the month from Documents.',
      'Check Rent Reminders for any outstanding follow-ups.',
    ],
  },
];

// ── PDF Rendering Helpers ────────────────────────────────────────────

type RGB = readonly [number, number, number];

function setFill(doc: jsPDF, c: RGB) { doc.setFillColor(c[0], c[1], c[2]); }
function setTextC(doc: jsPDF, c: RGB) { doc.setTextColor(c[0], c[1], c[2]); }
function setDraw(doc: jsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }

function drawPageHeader(doc: jsPDF, title: string) {
  setFill(doc, C.primary);
  doc.rect(0, 0, PAGE_W, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  setTextC(doc, [200, 220, 255]);
  doc.text('RENTALTRACKER ADMIN GUIDE', MARGIN, 9);
  doc.setFontSize(13);
  setTextC(doc, C.white);
  doc.text(title, MARGIN, 16);
  setDraw(doc, C.border);
  doc.setLineWidth(0.2);
  doc.line(0, 20, PAGE_W, 20);
}

/** Returns new Y after checking page break */
function ensureSpace(doc: jsPDF, y: number, needed: number, headerTitle?: string): number {
  if (y + needed > PAGE_H - 15) {
    doc.addPage();
    if (headerTitle) drawPageHeader(doc, headerTitle + ' (continued)');
    return headerTitle ? 28 : 15;
  }
  return y;
}

// ── Block Renderers ──────────────────────────────────────────────────

function renderText(doc: jsPDF, block: TextBlock, y: number, hdr?: string): number {
  y = ensureSpace(doc, y, 15, hdr);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  setTextC(doc, C.slate700);
  const lines: string[] = doc.splitTextToSize(block.content, CONTENT_W);
  doc.text(lines, MARGIN, y);
  return y + lines.length * 4.2 + 3;
}

function renderSubheading(doc: jsPDF, block: SubheadingBlock, y: number, hdr?: string): number {
  y = ensureSpace(doc, y, 12, hdr);
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  setTextC(doc, C.dark);
  doc.text(block.text, MARGIN, y);
  return y + 6;
}

function renderSteps(doc: jsPDF, block: StepsBlock, y: number, hdr?: string): number {
  if (block.heading) {
    y = ensureSpace(doc, y, 10, hdr);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setTextC(doc, C.dark);
    doc.text(block.heading, MARGIN, y);
    y += 6;
  }
  for (let i = 0; i < block.steps.length; i++) {
    const stepText = `${i + 1}. ${block.steps[i]}`;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setTextC(doc, C.slate700);
    const wrapped: string[] = doc.splitTextToSize(stepText, CONTENT_W - 4);
    y = ensureSpace(doc, y, wrapped.length * 4 + 2, hdr);
    doc.text(wrapped, MARGIN + 2, y);
    y += wrapped.length * 4 + 1.5;
  }
  return y + 3;
}

function renderBullets(doc: jsPDF, block: BulletBlock, y: number, hdr?: string): number {
  if (block.heading) {
    y = ensureSpace(doc, y, 10, hdr);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    setTextC(doc, C.dark);
    doc.text(block.heading, MARGIN, y);
    y += 6;
  }
  for (const item of block.items) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setTextC(doc, C.slate700);
    const wrapped: string[] = doc.splitTextToSize(item, CONTENT_W - 8);
    y = ensureSpace(doc, y, wrapped.length * 4 + 2, hdr);
    setFill(doc, C.primary);
    doc.circle(MARGIN + 2, y - 1, 0.8, 'F');
    doc.text(wrapped, MARGIN + 6, y);
    y += wrapped.length * 4 + 1.5;
  }
  return y + 2;
}

function renderFieldTable(doc: jsPDF, block: FieldTableBlock, y: number, hdr?: string): number {
  if (block.heading) {
    y = ensureSpace(doc, y, 10, hdr);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    setTextC(doc, C.dark);
    doc.text(block.heading, MARGIN, y);
    y += 5;
  }
  y = ensureSpace(doc, y, 20, hdr);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Field', 'Input Type', 'Req.', 'Description']],
    body: block.fields.map(f => [
      f.name,
      f.inputType,
      f.required ? 'Yes' : '-',
      f.description,
    ]),
    styles: { fontSize: 7.5, cellPadding: 2, textColor: [51, 65, 85], lineColor: [226, 232, 240], lineWidth: 0.2 },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    columnStyles: {
      0: { cellWidth: 30, fontStyle: 'bold' },
      1: { cellWidth: 28 },
      2: { cellWidth: 10, halign: 'center' },
      3: { cellWidth: 'auto' },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    theme: 'grid',
  });

  return (doc as any).lastAutoTable.finalY + 5;
}

function renderTip(doc: jsPDF, block: TipBlock, y: number, hdr?: string): number {
  const config: Record<string, { border: RGB; bg: RGB; label: string }> = {
    tip: { border: C.primary, bg: C.lightBlue, label: 'TIP' },
    note: { border: C.slate500, bg: C.lightSlate, label: 'NOTE' },
    important: { border: C.amber, bg: C.lightAmber, label: 'IMPORTANT' },
    warning: { border: C.red, bg: C.lightRed, label: 'WARNING' },
  };
  const cfg = config[block.variant];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const textLines: string[] = doc.splitTextToSize(block.content, CONTENT_W - 14);
  const boxH = textLines.length * 3.8 + 10;

  y = ensureSpace(doc, y, boxH + 4, hdr);

  // Background
  setFill(doc, cfg.bg);
  doc.roundedRect(MARGIN, y - 2, CONTENT_W, boxH, 1.5, 1.5, 'F');

  // Left accent border
  setFill(doc, cfg.border);
  doc.rect(MARGIN, y - 2, 3, boxH, 'F');

  // Label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  setTextC(doc, cfg.border);
  doc.text(cfg.label, MARGIN + 6, y + 3);

  // Content
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  setTextC(doc, C.slate700);
  doc.text(textLines, MARGIN + 6, y + 8);

  return y + boxH + 4;
}

function renderScreenshot(
  doc: jsPDF,
  block: ScreenshotBlock,
  screenshots: Map<string, Buffer>,
  y: number,
  hdr?: string,
): number {
  const buf = screenshots.get(block.id);
  if (!buf) return y;

  const imgData = `data:image/jpeg;base64,${buf.toString('base64')}`;
  const imgW = CONTENT_W;
  const imgH = imgW / 1.6; // 1440/900 aspect ratio

  y = ensureSpace(doc, y, imgH + 14, hdr);

  // Drop shadow
  setFill(doc, [220, 220, 220]);
  doc.rect(MARGIN + 0.8, y + 0.8, imgW, imgH, 'F');

  // Border
  setDraw(doc, C.border);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN - 0.3, y - 0.3, imgW + 0.6, imgH + 0.6);

  // Image
  doc.addImage(imgData, 'JPEG', MARGIN, y, imgW, imgH);
  y += imgH + 2;

  // Caption
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  setTextC(doc, C.slate500);
  doc.text(block.caption, PAGE_W / 2, y + 2, { align: 'center' });

  return y + 7;
}

// ── Section Renderer ─────────────────────────────────────────────────

function renderSection(
  doc: jsPDF,
  section: GuideSection,
  chapterNum: number,
  screenshots: Map<string, Buffer>,
): void {
  doc.addPage();
  const headerTitle = `${chapterNum}. ${section.title}`;
  drawPageHeader(doc, headerTitle);
  let y = 28;

  // Route badge
  const routeText = `Route: ${section.route}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const badgeW = Math.max(doc.getTextWidth(routeText) + 8, 40);
  setFill(doc, C.lightGray);
  setDraw(doc, C.border);
  doc.roundedRect(MARGIN, y - 4, badgeW, 8, 1.5, 1.5, 'FD');
  setTextC(doc, C.slate500);
  doc.text(routeText, MARGIN + 3, y);
  y += 10;

  // Render each content block
  for (const block of section.content) {
    switch (block.type) {
      case 'text':        y = renderText(doc, block, y, headerTitle); break;
      case 'subheading':  y = renderSubheading(doc, block, y, headerTitle); break;
      case 'steps':       y = renderSteps(doc, block, y, headerTitle); break;
      case 'bullets':     y = renderBullets(doc, block, y, headerTitle); break;
      case 'fieldTable':  y = renderFieldTable(doc, block, y, headerTitle); break;
      case 'tip':         y = renderTip(doc, block, y, headerTitle); break;
      case 'screenshot':  y = renderScreenshot(doc, block, screenshots, y, headerTitle); break;
    }
  }
}

// ── Workflow Appendix Renderer ───────────────────────────────────────

function renderWorkflowAppendix(doc: jsPDF): void {
  doc.addPage();
  drawPageHeader(doc, 'Appendix: Common Workflows');
  let y = 30;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  setTextC(doc, C.slate700);
  const intro = doc.splitTextToSize(
    'These step-by-step workflows show how to accomplish common tasks by navigating across multiple pages in the application.',
    CONTENT_W,
  );
  doc.text(intro, MARGIN, y);
  y += intro.length * 4.2 + 6;

  for (const wf of workflows) {
    y = ensureSpace(doc, y, 15, 'Appendix: Common Workflows');
    // Workflow title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    setTextC(doc, C.primary);
    doc.text(wf.title, MARGIN, y);
    y += 6;

    // Steps
    for (let i = 0; i < wf.steps.length; i++) {
      const stepText = `${i + 1}. ${wf.steps[i]}`;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setTextC(doc, C.slate700);
      const wrapped: string[] = doc.splitTextToSize(stepText, CONTENT_W - 4);
      y = ensureSpace(doc, y, wrapped.length * 4 + 2, 'Appendix: Common Workflows');
      doc.text(wrapped, MARGIN + 2, y);
      y += wrapped.length * 4 + 1.5;
    }
    y += 5;
  }
}

// ── Main PDF Builder ─────────────────────────────────────────────────

interface TocEntry {
  title: string;
  group: string;
  pageNum: number;
}

function buildPdf(screenshots: Map<string, Buffer>): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // ── Cover Page ─────────────────────────────────────────────────
  setFill(doc, C.primary);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(36);
  setTextC(doc, C.white);
  doc.text('RentalTracker', PAGE_W / 2, PAGE_H / 2 - 30, { align: 'center' });

  doc.setFontSize(20);
  doc.setFont('helvetica', 'normal');
  doc.text('Admin User Guide', PAGE_W / 2, PAGE_H / 2 - 10, { align: 'center' });

  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.line(PAGE_W / 2 - 40, PAGE_H / 2, PAGE_W / 2 + 40, PAGE_H / 2);

  doc.setFontSize(12);
  doc.text(today, PAGE_W / 2, PAGE_H / 2 + 14, { align: 'center' });

  doc.setFontSize(10);
  setTextC(doc, [200, 220, 255]);
  const subLines = doc.splitTextToSize(
    'A comprehensive guide to navigating, configuring, and managing your rental properties with the RentalTracker system.',
    PAGE_W - 60,
  );
  doc.text(subLines, PAGE_W / 2, PAGE_H / 2 + 30, { align: 'center' });

  // ── Reserve TOC pages ──────────────────────────────────────────
  doc.addPage(); // TOC page 1
  const tocPage1 = doc.getNumberOfPages();
  doc.addPage(); // TOC page 2
  const tocPage2 = doc.getNumberOfPages();

  // ── Render all sections ────────────────────────────────────────
  const tocEntries: TocEntry[] = [];
  let chapterNum = 1;

  for (const section of guideSections) {
    const pageNum = doc.getNumberOfPages() + 1;
    tocEntries.push({
      title: `${chapterNum}. ${section.title}`,
      group: section.group,
      pageNum,
    });
    renderSection(doc, section, chapterNum, screenshots);
    chapterNum++;
  }

  // Workflow appendix
  const appendixPageNum = doc.getNumberOfPages() + 1;
  tocEntries.push({ title: 'Appendix: Common Workflows', group: 'Appendix', pageNum: appendixPageNum });
  renderWorkflowAppendix(doc);

  // ── Fill in Table of Contents ──────────────────────────────────
  doc.setPage(tocPage1);
  drawPageHeader(doc, 'Table of Contents');
  let tocY = 34;
  let lastGroup = '';
  let usedPage2 = false;

  for (const entry of tocEntries) {
    // Group heading
    if (entry.group !== lastGroup) {
      tocY += lastGroup ? 4 : 0;
      if (tocY > PAGE_H - 25) {
        doc.setPage(tocPage2);
        drawPageHeader(doc, 'Table of Contents (continued)');
        tocY = 34;
        usedPage2 = true;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      setTextC(doc, C.primary);
      doc.text(entry.group.toUpperCase(), MARGIN, tocY);
      tocY += 6;
      lastGroup = entry.group;
    }

    if (tocY > PAGE_H - 20) {
      if (!usedPage2) {
        doc.setPage(tocPage2);
        drawPageHeader(doc, 'Table of Contents (continued)');
        tocY = 34;
        usedPage2 = true;
      }
    }

    // Alternating row bg
    const idx = tocEntries.indexOf(entry);
    if (idx % 2 === 0) {
      setFill(doc, C.lightGray);
      doc.rect(MARGIN, tocY - 4, CONTENT_W, 9, 'F');
    }

    // Title
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    setTextC(doc, C.dark);
    doc.text(entry.title, MARGIN + 4, tocY);

    // Page number (right-aligned)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    setTextC(doc, C.slate500);
    doc.text(String(entry.pageNum - 1), PAGE_W - MARGIN, tocY, { align: 'right' });

    // Dot leader
    const titleW = doc.getTextWidth(entry.title) + MARGIN + 6;
    const pageNumW = doc.getTextWidth(String(entry.pageNum - 1)) + 4;
    const dotsStart = titleW;
    const dotsEnd = PAGE_W - MARGIN - pageNumW;
    if (dotsEnd > dotsStart + 5) {
      doc.setFontSize(7);
      setTextC(doc, C.slate400);
      let dotX = dotsStart;
      while (dotX < dotsEnd) {
        doc.text('.', dotX, tocY);
        dotX += 2;
      }
    }

    tocY += 10;
  }

  // ── Footers on all pages ───────────────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i === 1) continue; // skip cover
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    setTextC(doc, C.slate400);
    doc.text(`Page ${i - 1} of ${totalPages - 1}`, MARGIN, PAGE_H - 8);
    doc.text(
      `RentalTracker Admin Guide \u2014 Generated ${today}`,
      PAGE_W - MARGIN,
      PAGE_H - 8,
      { align: 'right' },
    );
  }

  return doc;
}

// ── Main Entry Point ─────────────────────────────────────────────────

async function main() {
  console.log('\u{1F680} RentalTracker Admin Guide Generator (Comprehensive Edition)');
  console.log(`   Target: ${BASE_URL}`);
  console.log('');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  const screenshots = new Map<string, Buffer>();

  try {
    // ── Capture login page BEFORE logging in ─────────────────────
    const loginSection = guideSections.find(s => s.route === '/login')!;
    for (const cap of loginSection.captures) {
      console.log(`\u{1F4F8} Capturing: ${cap.id}`);
      await cap.setup(page);
      screenshots.set(cap.id, await page.screenshot({ type: 'jpeg', quality: 80 }));
      if (cap.teardown) await cap.teardown(page);
    }

    // ── Log in ───────────────────────────────────────────────────
    console.log('\u{1F511} Logging in as admin...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#email', { timeout: 30_000 });
    await page.locator('#email').fill(ADMIN_EMAIL);
    await page.locator('#password').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/', { timeout: 30_000 });
    await page.waitForLoadState('networkidle', { timeout: 30_000 });
    await page.waitForTimeout(1_000);
    console.log('   \u2713 Logged in successfully\n');

    // ── Capture all other sections ───────────────────────────────
    for (const section of guideSections) {
      if (section.route === '/login') continue;

      console.log(`\u{1F4F8} Capturing: ${section.title} (${section.route})`);

      for (const cap of section.captures) {
        await cap.setup(page);
        await page.waitForTimeout(200);
        screenshots.set(cap.id, await page.screenshot({ type: 'jpeg', quality: 80 }));
        if (cap.teardown) {
          await cap.teardown(page);
        }
      }
    }

    console.log(`\n\u{1F4F8} Captured ${screenshots.size} screenshots\n`);

    // ── Build PDF ────────────────────────────────────────────────
    console.log('\u{1F4C4} Building PDF...');
    const doc = buildPdf(screenshots);

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    const fs = await import('fs');
    const path = await import('path');
    const outputPath = path.join(process.cwd(), OUTPUT_FILE);
    fs.writeFileSync(outputPath, pdfBuffer);

    console.log(`\u2705 PDF saved: ${outputPath}`);
    console.log(`   Pages: ${doc.getNumberOfPages()}`);
    console.log(`   Size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);
  } catch (err) {
    console.error('\u274C Error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
