import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers';

// ── Shared ID storage across serial tests ────────────────────────────────────
const propertyIds: Record<string, string> = {};
const unitIds: Record<string, string> = {};
const tenantIds: Record<string, string> = {};

// Shorthand helpers (usable after IDs are populated)
const p = (name: string) => propertyIds[name];
const u = (prop: string, unit: string) => unitIds[`${prop}-${unit}`];
const t = (name: string) => tenantIds[name];

test.describe.serial('Scenario Seed: Philippine Rental Data (Dec 2025 – Feb 2026)', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Clean existing seed data
  // ═══════════════════════════════════════════════════════════════════════════

  test('clean existing seed data', async ({ request }) => {
    await loginAsAdmin(request);

    const propsRes = await request.get('/api/properties');
    expect(propsRes.status()).toBe(200);
    const props = await propsRes.json();
    for (const prop of props) {
      const del = await request.delete(`/api/properties/${prop.id}`);
      expect(del.status()).toBe(200);
    }

    const tenantsRes = await request.get('/api/tenants');
    expect(tenantsRes.status()).toBe(200);
    const tenants = await tenantsRes.json();
    for (const tenant of tenants) {
      const del = await request.delete(`/api/tenants/${tenant.id}`);
      expect(del.status()).toBe(200);
    }

    const ratesRes = await request.get('/api/mileage/rates');
    expect(ratesRes.status()).toBe(200);
    const rates = await ratesRes.json();
    for (const rate of rates) {
      const del = await request.delete(`/api/mileage/rates/${rate.id}`);
      expect(del.status()).toBe(200);
    }

    const [p2, t2, r2] = await Promise.all([
      request.get('/api/properties'),
      request.get('/api/tenants'),
      request.get('/api/mileage/rates'),
    ]);
    expect((await p2.json()).length).toBe(0);
    expect((await t2.json()).length).toBe(0);
    expect((await r2.json()).length).toBe(0);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Configure settings and owner info
  // ═══════════════════════════════════════════════════════════════════════════

  test('configure settings and owner info', async ({ request }) => {
    await loginAsAdmin(request);

    const settingsRes = await request.put('/api/settings', {
      data: {
        currency: '₱',
        mileageUnit: 'km',
        propertyTypes: ['Apartment', 'House', 'Cottage', 'Condo', 'Townhouse', 'Commercial'],
        incomeCategories: ['Rent', 'Parking', 'Pet Fee', 'Storage', 'Late Fee', 'Laundry', 'Other Income'],
        expenseCategories: ['Mortgage', 'Insurance', 'Property Tax', 'Repairs', 'Maintenance', 'Utilities', 'Landscaping', 'Management Fee', 'Cleaning', 'Legal Fees', 'Advertising', 'Other Expense'],
        paymentMethods: ['Bank Transfer', 'Cash', 'Credit Card', 'Check', 'E-Transfer', 'PayPal'],
      },
    });
    expect(settingsRes.status()).toBe(200);

    const ownerRes = await request.put('/api/settings/owner-info', {
      data: {
        name: 'Juan Carlos Reyes',
        company: 'JCR Property Management',
        address: 'Unit 1205, One Ayala Tower, Makati City',
        phone: '0917-888-1234',
        email: 'admin@gmail.com',
      },
    });
    expect(ownerRes.status()).toBe(200);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Create properties (4 Philippine locations)
  // ═══════════════════════════════════════════════════════════════════════════

  test('create properties', async ({ request }) => {
    await loginAsAdmin(request);

    const properties = [
      { name: 'Sunshine Residences', type: 'Apartment', address: '123 Ayala Ave, Makati City', units: 0 },
      { name: 'Greenfield Villas', type: 'House', address: '456 Commonwealth Ave, Quezon City', units: 0 },
      { name: 'Bayview Condominiums', type: 'Condo', address: '789 Roxas Blvd, Pasay City', units: 0 },
      { name: 'Maplewood Townhomes', type: 'Townhouse', address: '321 McKinley Rd, Taguig City', units: 0 },
    ];

    for (const prop of properties) {
      const res = await request.post('/api/properties', { data: prop });
      expect(res.status()).toBe(201);
      const body = await res.json();
      propertyIds[prop.name] = body.id;
    }

    expect(Object.keys(propertyIds)).toHaveLength(4);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Create units (21 total)
  // ═══════════════════════════════════════════════════════════════════════════

  test('create units', async ({ request }) => {
    await loginAsAdmin(request);

    const unitDefs = [
      // Sunshine Residences — 8 units
      ...['101', '102', '103', '104', '201', '202', '203', '204'].map(n => ({
        propertyName: 'Sunshine Residences', unitNumber: n,
        address: `123 Ayala Ave, Unit ${n}, Makati City`,
      })),
      // Greenfield Villas — 3 units
      ...['A', 'B', 'C'].map(n => ({
        propertyName: 'Greenfield Villas', unitNumber: n,
        address: `456 Commonwealth Ave, Villa ${n}, Quezon City`,
      })),
      // Bayview Condominiums — 6 units
      ...['1A', '1B', '2A', '2B', '3A', '3B'].map(n => ({
        propertyName: 'Bayview Condominiums', unitNumber: n,
        address: `789 Roxas Blvd, Unit ${n}, Pasay City`,
      })),
      // Maplewood Townhomes — 4 units
      ...['1', '2', '3', '4'].map(n => ({
        propertyName: 'Maplewood Townhomes', unitNumber: n,
        address: `321 McKinley Rd, Unit ${n}, Taguig City`,
      })),
    ];

    for (const ud of unitDefs) {
      const res = await request.post('/api/units', {
        data: {
          propertyId: propertyIds[ud.propertyName],
          unitNumber: ud.unitNumber,
          address: ud.address,
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      unitIds[`${ud.propertyName}-${ud.unitNumber}`] = body.id;
    }

    expect(Object.keys(unitIds)).toHaveLength(21);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Create tenants (14 Filipino tenants)
  // ═══════════════════════════════════════════════════════════════════════════

  test('create tenants', async ({ request }) => {
    await loginAsAdmin(request);

    const tenants = [
      { name: 'Maria Santos', phone: '0917-555-0101', email: 'maria.santos@email.com' },
      { name: 'Juan Dela Cruz', phone: '0918-555-0102', email: 'juan.delacruz@email.com' },
      { name: 'Rosa Reyes', phone: '0919-555-0103', email: 'rosa.reyes@email.com' },
      { name: 'Carlos Garcia', phone: '0917-555-0104', email: 'carlos.garcia@email.com' },
      { name: 'Ana Bautista', phone: '0918-555-0105', email: 'ana.bautista@email.com' },
      { name: 'Miguel Ramos', phone: '0919-555-0106', email: 'miguel.ramos@email.com' },
      { name: 'Sofia Cruz', phone: '0917-555-0107', email: 'sofia.cruz@email.com' },
      { name: 'Ramon Torres', phone: '0918-555-0108', email: 'ramon.torres@email.com' },
      { name: 'Isabella Mendoza', phone: '0919-555-0109', email: 'isabella.mendoza@email.com' },
      { name: 'Pedro Villanueva', phone: '0917-555-0110', email: 'pedro.villanueva@email.com' },
      { name: 'Carmen Flores', phone: '0918-555-0111', email: 'carmen.flores@email.com' },
      { name: 'Jose Aquino', phone: '0919-555-0112', email: 'jose.aquino@email.com' },
      { name: 'Elena Pascual', phone: '0917-555-0113', email: 'elena.pascual@email.com' },
      { name: 'Roberto Lim', phone: '0918-555-0114', email: 'roberto.lim@email.com' },
    ];

    for (const tenant of tenants) {
      const res = await request.post('/api/tenants', { data: tenant });
      expect(res.status()).toBe(201);
      const body = await res.json();
      tenantIds[tenant.name] = body.id;
    }

    expect(Object.keys(tenantIds)).toHaveLength(14);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Create leases (14 active — 7 units vacant)
  // ═══════════════════════════════════════════════════════════════════════════

  test('create leases', async ({ request }) => {
    await loginAsAdmin(request);

    const leases = [
      // Sunshine Residences — 6 of 8 occupied (203, 204 vacant)
      { tenant: 'Maria Santos',    property: 'Sunshine Residences', unit: '101', rent: 15000, deposit: 30000, start: '2025-06-01', end: '2026-05-31' },
      { tenant: 'Juan Dela Cruz',  property: 'Sunshine Residences', unit: '102', rent: 16000, deposit: 32000, start: '2025-09-01', end: '2026-08-31' },
      { tenant: 'Rosa Reyes',      property: 'Sunshine Residences', unit: '103', rent: 14000, deposit: 28000, start: '2025-03-01', end: '2026-02-28' },
      { tenant: 'Carlos Garcia',   property: 'Sunshine Residences', unit: '104', rent: 17000, deposit: 34000, start: '2025-07-01', end: '2026-06-30' },
      { tenant: 'Ana Bautista',    property: 'Sunshine Residences', unit: '201', rent: 18000, deposit: 36000, start: '2025-01-01', end: '2026-12-31' },
      { tenant: 'Miguel Ramos',    property: 'Sunshine Residences', unit: '202', rent: 15500, deposit: 31000, start: '2025-11-01', end: '2026-10-31' },

      // Greenfield Villas — 2 of 3 occupied (C vacant)
      { tenant: 'Sofia Cruz',      property: 'Greenfield Villas', unit: 'A', rent: 25000, deposit: 50000, start: '2025-04-01', end: '2026-03-31' },
      { tenant: 'Ramon Torres',    property: 'Greenfield Villas', unit: 'B', rent: 28000, deposit: 56000, start: '2025-01-01', end: '2026-12-31' },

      // Bayview Condominiums — 4 of 6 occupied (3A, 3B vacant)
      { tenant: 'Isabella Mendoza', property: 'Bayview Condominiums', unit: '1A', rent: 22000, deposit: 44000, start: '2025-08-01', end: '2026-07-31' },
      { tenant: 'Pedro Villanueva', property: 'Bayview Condominiums', unit: '1B', rent: 20000, deposit: 40000, start: '2025-05-01', end: '2026-04-30' },
      { tenant: 'Carmen Flores',    property: 'Bayview Condominiums', unit: '2A', rent: 24000, deposit: 48000, start: '2025-02-01', end: '2027-01-31' },
      { tenant: 'Jose Aquino',      property: 'Bayview Condominiums', unit: '2B', rent: 21000, deposit: 42000, start: '2025-10-01', end: '2026-09-30' },

      // Maplewood Townhomes — 2 of 4 occupied (3, 4 vacant)
      { tenant: 'Elena Pascual',   property: 'Maplewood Townhomes', unit: '1', rent: 19000, deposit: 38000, start: '2025-03-01', end: '2026-02-28' },
      { tenant: 'Roberto Lim',     property: 'Maplewood Townhomes', unit: '2', rent: 20000, deposit: 40000, start: '2025-07-01', end: '2026-06-30' },
    ];

    for (const l of leases) {
      const res = await request.post('/api/leases', {
        data: {
          propertyId: p(l.property),
          unitId: u(l.property, l.unit),
          tenantId: t(l.tenant),
          leaseStart: l.start,
          leaseEnd: l.end,
          monthlyRent: l.rent,
          deposit: l.deposit,
        },
      });
      expect(res.status()).toBe(201);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. Create 3 months of income records (Dec 2025, Jan 2026, Feb 2026)
  // ═══════════════════════════════════════════════════════════════════════════

  test('create December 2025 income records', async ({ request }) => {
    await loginAsAdmin(request);

    const records = [
      // ── On-time payments ──
      { prop: 'Sunshine Residences', unit: '101', tenant: 'Maria Santos',      rent: 15000, extra: 0,    paidDate: '2025-12-01', paid: 15000, method: 'Bank Transfer' },
      { prop: 'Sunshine Residences', unit: '102', tenant: 'Juan Dela Cruz',    rent: 16000, extra: 0,    paidDate: '2025-12-01', paid: 16000, method: 'E-Transfer' },
      { prop: 'Sunshine Residences', unit: '103', tenant: 'Rosa Reyes',        rent: 14000, extra: 500,  paidDate: '2025-12-01', paid: 14500, method: 'Bank Transfer' },
      { prop: 'Sunshine Residences', unit: '201', tenant: 'Ana Bautista',      rent: 18000, extra: 1000, paidDate: '2025-12-01', paid: 19000, method: 'Bank Transfer' },
      { prop: 'Greenfield Villas',   unit: 'A',   tenant: 'Sofia Cruz',        rent: 25000, extra: 0,    paidDate: '2025-12-01', paid: 25000, method: 'Bank Transfer' },
      { prop: 'Greenfield Villas',   unit: 'B',   tenant: 'Ramon Torres',      rent: 28000, extra: 1500, paidDate: '2025-12-02', paid: 29500, method: 'E-Transfer' },
      { prop: 'Bayview Condominiums', unit: '1A', tenant: 'Isabella Mendoza',  rent: 22000, extra: 0,    paidDate: '2025-12-01', paid: 22000, method: 'Credit Card' },
      { prop: 'Bayview Condominiums', unit: '2A', tenant: 'Carmen Flores',     rent: 24000, extra: 0,    paidDate: '2025-12-01', paid: 24000, method: 'Bank Transfer' },
      // ── Late payments ──
      { prop: 'Sunshine Residences', unit: '104', tenant: 'Carlos Garcia',     rent: 17000, extra: 0,    paidDate: '2025-12-05', paid: 17000, method: 'Check' },
      { prop: 'Sunshine Residences', unit: '202', tenant: 'Miguel Ramos',      rent: 15500, extra: 0,    paidDate: '2025-12-08', paid: 15500, method: 'Cash' },
      { prop: 'Bayview Condominiums', unit: '1B', tenant: 'Pedro Villanueva',  rent: 20000, extra: 0,    paidDate: '2025-12-10', paid: 20000, method: 'Bank Transfer' },
      // ── Partial payment ──
      { prop: 'Bayview Condominiums', unit: '2B', tenant: 'Jose Aquino',       rent: 21000, extra: 0,    paidDate: '2025-12-03', paid: 12000, method: 'PayPal' },
      // ── Unpaid ──
      { prop: 'Maplewood Townhomes', unit: '1',  tenant: 'Elena Pascual',      rent: 19000, extra: 0,    paidDate: '',           paid: 0,     method: '' },
      // ── On-time ──
      { prop: 'Maplewood Townhomes', unit: '2',  tenant: 'Roberto Lim',        rent: 20000, extra: 0,    paidDate: '2025-12-01', paid: 20000, method: 'E-Transfer' },
    ];

    for (const r of records) {
      const res = await request.post('/api/income', {
        data: {
          propertyId: p(r.prop), unitId: u(r.prop, r.unit), tenantId: t(r.tenant),
          category: 'Rent', rentDueDate: '2025-12-01', rentAmount: r.rent,
          additionalIncome: r.extra, paymentDate: r.paidDate, amountPaid: r.paid,
          paymentMethod: r.method,
        },
      });
      expect(res.status()).toBe(201);
    }
  });

  test('create January 2026 income records', async ({ request }) => {
    await loginAsAdmin(request);

    const records = [
      // ── On-time ──
      { prop: 'Sunshine Residences', unit: '101', tenant: 'Maria Santos',      rent: 15000, extra: 0,    paidDate: '2026-01-01', paid: 15000, method: 'Bank Transfer' },
      { prop: 'Sunshine Residences', unit: '102', tenant: 'Juan Dela Cruz',    rent: 16000, extra: 0,    paidDate: '2026-01-01', paid: 16000, method: 'E-Transfer' },
      { prop: 'Sunshine Residences', unit: '103', tenant: 'Rosa Reyes',        rent: 14000, extra: 500,  paidDate: '2026-01-01', paid: 14500, method: 'Bank Transfer' },
      { prop: 'Sunshine Residences', unit: '201', tenant: 'Ana Bautista',      rent: 18000, extra: 0,    paidDate: '2026-01-01', paid: 18000, method: 'Bank Transfer' },
      { prop: 'Greenfield Villas',   unit: 'A',   tenant: 'Sofia Cruz',        rent: 25000, extra: 0,    paidDate: '2026-01-01', paid: 25000, method: 'Bank Transfer' },
      { prop: 'Bayview Condominiums', unit: '1A', tenant: 'Isabella Mendoza',  rent: 22000, extra: 0,    paidDate: '2026-01-01', paid: 22000, method: 'Credit Card' },
      { prop: 'Bayview Condominiums', unit: '2A', tenant: 'Carmen Flores',     rent: 24000, extra: 0,    paidDate: '2026-01-01', paid: 24000, method: 'Bank Transfer' },
      { prop: 'Maplewood Townhomes', unit: '2',  tenant: 'Roberto Lim',        rent: 20000, extra: 0,    paidDate: '2026-01-01', paid: 20000, method: 'E-Transfer' },
      // ── Late ──
      { prop: 'Sunshine Residences', unit: '104', tenant: 'Carlos Garcia',     rent: 17000, extra: 0,    paidDate: '2026-01-04', paid: 17000, method: 'Check' },
      { prop: 'Sunshine Residences', unit: '202', tenant: 'Miguel Ramos',      rent: 15500, extra: 0,    paidDate: '2026-01-07', paid: 15500, method: 'Cash' },
      { prop: 'Greenfield Villas',   unit: 'B',   tenant: 'Ramon Torres',      rent: 28000, extra: 1500, paidDate: '2026-01-02', paid: 29500, method: 'E-Transfer' },
      // ── Partial ──
      { prop: 'Bayview Condominiums', unit: '1B', tenant: 'Pedro Villanueva',  rent: 20000, extra: 0,    paidDate: '2026-01-05', paid: 10000, method: 'Bank Transfer' },
      // ── Overpaid ──
      { prop: 'Bayview Condominiums', unit: '2B', tenant: 'Jose Aquino',       rent: 21000, extra: 0,    paidDate: '2026-01-01', paid: 22000, method: 'PayPal' },
      // ── Unpaid ──
      { prop: 'Maplewood Townhomes', unit: '1',  tenant: 'Elena Pascual',      rent: 19000, extra: 0,    paidDate: '',           paid: 0,     method: '' },
    ];

    for (const r of records) {
      const res = await request.post('/api/income', {
        data: {
          propertyId: p(r.prop), unitId: u(r.prop, r.unit), tenantId: t(r.tenant),
          category: 'Rent', rentDueDate: '2026-01-01', rentAmount: r.rent,
          additionalIncome: r.extra, paymentDate: r.paidDate, amountPaid: r.paid,
          paymentMethod: r.method,
        },
      });
      expect(res.status()).toBe(201);
    }
  });

  test('create February 2026 income records', async ({ request }) => {
    await loginAsAdmin(request);

    const records = [
      // ── On-time ──
      { prop: 'Sunshine Residences', unit: '101', tenant: 'Maria Santos',      rent: 15000, extra: 0,    paidDate: '2026-02-01', paid: 15000, method: 'Bank Transfer' },
      { prop: 'Sunshine Residences', unit: '102', tenant: 'Juan Dela Cruz',    rent: 16000, extra: 0,    paidDate: '2026-02-01', paid: 16000, method: 'E-Transfer' },
      { prop: 'Sunshine Residences', unit: '201', tenant: 'Ana Bautista',      rent: 18000, extra: 1000, paidDate: '2026-02-01', paid: 19000, method: 'Bank Transfer' },
      { prop: 'Greenfield Villas',   unit: 'A',   tenant: 'Sofia Cruz',        rent: 25000, extra: 0,    paidDate: '2026-02-01', paid: 25000, method: 'Bank Transfer' },
      { prop: 'Greenfield Villas',   unit: 'B',   tenant: 'Ramon Torres',      rent: 28000, extra: 0,    paidDate: '2026-02-01', paid: 28000, method: 'E-Transfer' },
      { prop: 'Bayview Condominiums', unit: '1A', tenant: 'Isabella Mendoza',  rent: 22000, extra: 0,    paidDate: '2026-02-01', paid: 22000, method: 'Credit Card' },
      { prop: 'Bayview Condominiums', unit: '2A', tenant: 'Carmen Flores',     rent: 24000, extra: 0,    paidDate: '2026-02-01', paid: 24000, method: 'Bank Transfer' },
      // ── Late ──
      { prop: 'Sunshine Residences', unit: '103', tenant: 'Rosa Reyes',        rent: 14000, extra: 500,  paidDate: '2026-02-05', paid: 14500, method: 'Bank Transfer' },
      { prop: 'Sunshine Residences', unit: '104', tenant: 'Carlos Garcia',     rent: 17000, extra: 0,    paidDate: '2026-02-06', paid: 17000, method: 'Check' },
      { prop: 'Sunshine Residences', unit: '202', tenant: 'Miguel Ramos',      rent: 15500, extra: 0,    paidDate: '2026-02-10', paid: 15500, method: 'Cash' },
      // ── Partial ──
      { prop: 'Bayview Condominiums', unit: '1B', tenant: 'Pedro Villanueva',  rent: 20000, extra: 0,    paidDate: '2026-02-03', paid: 8000,  method: 'Bank Transfer' },
      { prop: 'Bayview Condominiums', unit: '2B', tenant: 'Jose Aquino',       rent: 21000, extra: 0,    paidDate: '2026-02-02', paid: 15000, method: 'PayPal' },
      // ── Unpaid ──
      { prop: 'Maplewood Townhomes', unit: '1',  tenant: 'Elena Pascual',      rent: 19000, extra: 0,    paidDate: '',           paid: 0,     method: '' },
      // ── On-time ──
      { prop: 'Maplewood Townhomes', unit: '2',  tenant: 'Roberto Lim',        rent: 20000, extra: 0,    paidDate: '2026-02-01', paid: 20000, method: 'E-Transfer' },
    ];

    for (const r of records) {
      const res = await request.post('/api/income', {
        data: {
          propertyId: p(r.prop), unitId: u(r.prop, r.unit), tenantId: t(r.tenant),
          category: 'Rent', rentDueDate: '2026-02-01', rentAmount: r.rent,
          additionalIncome: r.extra, paymentDate: r.paidDate, amountPaid: r.paid,
          paymentMethod: r.method,
        },
      });
      expect(res.status()).toBe(201);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. Create 3 months of expenses
  // ═══════════════════════════════════════════════════════════════════════════

  test('create December 2025 – February 2026 expenses', async ({ request }) => {
    await loginAsAdmin(request);

    const expenses = [
      // ── December 2025 ──
      { date: '2025-12-02', propertyId: p('Sunshine Residences'), unitId: null, category: 'Mortgage',
        amount: 45000, additionalFees: 0, appliesToEntireBuilding: true, notes: 'Monthly mortgage — Sunshine Residences' },
      { date: '2025-12-02', propertyId: p('Greenfield Villas'), unitId: null, category: 'Mortgage',
        amount: 35000, additionalFees: 0, appliesToEntireBuilding: true, notes: 'Monthly mortgage — Greenfield Villas' },
      { date: '2025-12-02', propertyId: p('Bayview Condominiums'), unitId: null, category: 'Mortgage',
        amount: 55000, additionalFees: 0, appliesToEntireBuilding: true, notes: 'Monthly mortgage — Bayview Condominiums' },
      { date: '2025-12-02', propertyId: p('Maplewood Townhomes'), unitId: null, category: 'Mortgage',
        amount: 38000, additionalFees: 0, appliesToEntireBuilding: true, notes: 'Monthly mortgage — Maplewood Townhomes' },
      { date: '2025-12-10', propertyId: p('Sunshine Residences'), unitId: null, category: 'Insurance',
        amount: 12000, additionalFees: 1500, appliesToEntireBuilding: true, notes: 'Annual property insurance installment' },
      { date: '2025-12-18', propertyId: p('Sunshine Residences'), unitId: u('Sunshine Residences', '102'),
        category: 'Repairs', amount: 5500, additionalFees: 800, appliesToEntireBuilding: false,
        notes: 'Aircon compressor replacement' },
      { date: '2025-12-20', propertyId: p('Greenfield Villas'), unitId: null, category: 'Utilities',
        amount: 8500, additionalFees: 0, appliesToEntireBuilding: true, notes: 'December water/electric bill' },

      // ── January 2026 ──
      { date: '2026-01-02', propertyId: p('Sunshine Residences'), unitId: null, category: 'Mortgage',
        amount: 45000, additionalFees: 0, appliesToEntireBuilding: true, notes: 'Monthly mortgage — Sunshine Residences' },
      { date: '2026-01-02', propertyId: p('Greenfield Villas'), unitId: null, category: 'Mortgage',
        amount: 35000, additionalFees: 0, appliesToEntireBuilding: true, notes: 'Monthly mortgage — Greenfield Villas' },
      { date: '2026-01-02', propertyId: p('Bayview Condominiums'), unitId: null, category: 'Mortgage',
        amount: 55000, additionalFees: 0, appliesToEntireBuilding: true, notes: 'Monthly mortgage — Bayview Condominiums' },
      { date: '2026-01-02', propertyId: p('Maplewood Townhomes'), unitId: null, category: 'Mortgage',
        amount: 38000, additionalFees: 0, appliesToEntireBuilding: true, notes: 'Monthly mortgage — Maplewood Townhomes' },
      { date: '2026-01-15', propertyId: p('Bayview Condominiums'), unitId: null, category: 'Property Tax',
        amount: 42000, additionalFees: 0, appliesToEntireBuilding: true, notes: 'Q1 property tax payment' },
      { date: '2026-01-25', propertyId: p('Maplewood Townhomes'), unitId: u('Maplewood Townhomes', '2'),
        category: 'Maintenance', amount: 3200, additionalFees: 500, appliesToEntireBuilding: false,
        notes: 'Plumbing repair — kitchen sink' },
      { date: '2026-01-28', propertyId: p('Sunshine Residences'), unitId: null, category: 'Management Fee',
        amount: 12000, additionalFees: 0, appliesToEntireBuilding: true, notes: 'January property management fee' },

      // ── February 2026 ──
      { date: '2026-02-02', propertyId: p('Sunshine Residences'), unitId: null, category: 'Mortgage',
        amount: 45000, additionalFees: 0, appliesToEntireBuilding: true, notes: 'Monthly mortgage — Sunshine Residences' },
      { date: '2026-02-02', propertyId: p('Greenfield Villas'), unitId: null, category: 'Mortgage',
        amount: 35000, additionalFees: 0, appliesToEntireBuilding: true, notes: 'Monthly mortgage — Greenfield Villas' },
      { date: '2026-02-02', propertyId: p('Bayview Condominiums'), unitId: null, category: 'Mortgage',
        amount: 55000, additionalFees: 0, appliesToEntireBuilding: true, notes: 'Monthly mortgage — Bayview Condominiums' },
      { date: '2026-02-02', propertyId: p('Maplewood Townhomes'), unitId: null, category: 'Mortgage',
        amount: 38000, additionalFees: 0, appliesToEntireBuilding: true, notes: 'Monthly mortgage — Maplewood Townhomes' },
      { date: '2026-02-15', propertyId: p('Bayview Condominiums'), unitId: u('Bayview Condominiums', '1B'),
        category: 'Repairs', amount: 4800, additionalFees: 600, appliesToEntireBuilding: false,
        notes: 'Water heater replacement' },
      { date: '2026-02-22', propertyId: p('Greenfield Villas'), unitId: null, category: 'Landscaping',
        amount: 5000, additionalFees: 0, appliesToEntireBuilding: true, notes: 'February garden maintenance' },
    ];

    for (const exp of expenses) {
      const res = await request.post('/api/expenses', { data: exp });
      expect(res.status()).toBe(201);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. Create maintenance tasks across 3 months
  // ═══════════════════════════════════════════════════════════════════════════

  test('create maintenance tasks', async ({ request }) => {
    await loginAsAdmin(request);

    const tasks = [
      // ── Completed (Dec 2025) ──
      { propertyId: p('Sunshine Residences'), unitId: u('Sunshine Residences', '102'), appliesToEntireBuilding: false,
        dateReported: '2025-12-05', description: 'Aircon compressor failure in unit 102',
        priority: 'High', category: 'HVAC', contractor: 'CoolBreeze Aircon Services',
        estimatedCost: 5000, actualCost: 6300, paymentStatus: 'Paid',
        completionDate: '2025-12-18', status: 'Completed', notes: 'Replaced compressor and recharged refrigerant' },

      { propertyId: p('Bayview Condominiums'), unitId: null, appliesToEntireBuilding: true,
        dateReported: '2025-12-08', description: 'Parking area lighting failure in basement level',
        priority: 'Medium', category: 'Electrical', contractor: 'BrightSpark Electric',
        estimatedCost: 8000, actualCost: 6500, paymentStatus: 'Paid',
        completionDate: '2025-12-14', status: 'Completed', notes: 'Replaced 6 LED fixtures and rewired junction box' },

      // ── Completed (Jan 2026) ──
      { propertyId: p('Maplewood Townhomes'), unitId: u('Maplewood Townhomes', '2'), appliesToEntireBuilding: false,
        dateReported: '2026-01-12', description: 'Kitchen sink clogged and leaking underneath',
        priority: 'High', category: 'Plumbing', contractor: 'QuickFix Plumbing',
        estimatedCost: 3000, actualCost: 3700, paymentStatus: 'Paid',
        completionDate: '2026-01-25', status: 'Completed', notes: 'Replaced P-trap and cleared drain blockage' },

      // ── In Progress ──
      { propertyId: p('Greenfield Villas'), unitId: u('Greenfield Villas', 'A'), appliesToEntireBuilding: false,
        dateReported: '2026-01-20', description: 'Bathroom tile grout cracking and mold forming',
        priority: 'Medium', category: 'General', contractor: 'TilePro Renovations',
        estimatedCost: 4500, actualCost: 0, paymentStatus: 'Unpaid',
        completionDate: '', status: 'InProgress', notes: 'Contractor scheduled for next week' },

      // ── Open — Urgent ──
      { propertyId: p('Sunshine Residences'), unitId: null, appliesToEntireBuilding: true,
        dateReported: '2026-02-10', description: 'Fire exit stairwell railing loose on 2nd floor',
        priority: 'Urgent', category: 'Safety', contractor: 'SafeStep Contractors',
        estimatedCost: 15000, actualCost: 0, paymentStatus: 'Unpaid',
        completionDate: '', status: 'Open', notes: 'Safety hazard — tenant reported wobbling railing' },

      // ── Open — Low ──
      { propertyId: p('Bayview Condominiums'), unitId: u('Bayview Condominiums', '2A'), appliesToEntireBuilding: false,
        dateReported: '2026-02-15', description: 'Window seal broken, cold draft in bedroom',
        priority: 'Low', category: 'General', contractor: '',
        estimatedCost: 4000, actualCost: 0, paymentStatus: 'Unpaid',
        completionDate: '', status: 'Open', notes: 'Tenant reports draft — non-urgent' },

      // ── On Hold ──
      { propertyId: p('Maplewood Townhomes'), unitId: null, appliesToEntireBuilding: true,
        dateReported: '2026-02-20', description: 'Roof gutter clogged causing water overflow',
        priority: 'Medium', category: 'Exterior', contractor: '',
        estimatedCost: 6000, actualCost: 0, paymentStatus: 'Unpaid',
        completionDate: '', status: 'OnHold', notes: 'Waiting for dry weather before scheduling' },
    ];

    for (const task of tasks) {
      const res = await request.post('/api/maintenance', { data: task });
      expect(res.status()).toBe(201);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. Create mileage rate (km)
  // ═══════════════════════════════════════════════════════════════════════════

  test('create 2025-2026 mileage rate', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.post('/api/mileage/rates', {
      data: { rate: 10.00, startDate: '2025-01-01', endDate: '2026-12-31' },
    });
    expect(res.status()).toBe(201);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. Create 3 months of mileage logs
  // ═══════════════════════════════════════════════════════════════════════════

  test('create mileage logs', async ({ request }) => {
    await loginAsAdmin(request);

    const logs = [
      // December 2025
      { propertyId: p('Sunshine Residences'), date: '2025-12-05', distance: 12, amount: 120,
        description: 'Monthly inspection — Sunshine Residences' },
      { propertyId: p('Greenfield Villas'), date: '2025-12-10', distance: 18, amount: 180,
        description: 'Tenant follow-up — Greenfield Villa A' },
      { propertyId: p('Bayview Condominiums'), date: '2025-12-14', distance: 25, amount: 250,
        description: 'Parking lighting repair oversight' },
      // January 2026
      { propertyId: p('Sunshine Residences'), date: '2026-01-08', distance: 12, amount: 120,
        description: 'Monthly inspection — Sunshine Residences' },
      { propertyId: p('Maplewood Townhomes'), date: '2026-01-20', distance: 20, amount: 200,
        description: 'Plumbing repair check — Unit 2' },
      { propertyId: p('Bayview Condominiums'), date: '2026-01-28', distance: 25, amount: 250,
        description: 'Quarterly property assessment' },
      // February 2026
      { propertyId: p('Sunshine Residences'), date: '2026-02-05', distance: 12, amount: 120,
        description: 'Monthly inspection — Sunshine Residences' },
      { propertyId: p('Sunshine Residences'), date: '2026-02-10', distance: 12, amount: 120,
        description: 'Emergency stairwell railing assessment' },
      { propertyId: p('Greenfield Villas'), date: '2026-02-22', distance: 18, amount: 180,
        description: 'Garden maintenance oversight' },
    ];

    for (const log of logs) {
      const res = await request.post('/api/mileage/logs', { data: log });
      expect(res.status()).toBe(201);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. Verify final data counts
  // ═══════════════════════════════════════════════════════════════════════════

  test('verify seeded data counts', async ({ request }) => {
    await loginAsAdmin(request);

    const [propRes, unitRes, tenantRes, leaseRes, incomeRes, expenseRes, maintRes, rateRes, logRes] =
      await Promise.all([
        request.get('/api/properties'),
        request.get('/api/units'),
        request.get('/api/tenants'),
        request.get('/api/leases'),
        request.get('/api/income'),
        request.get('/api/expenses'),
        request.get('/api/maintenance'),
        request.get('/api/mileage/rates'),
        request.get('/api/mileage/logs'),
      ]);

    expect(propRes.status()).toBe(200);
    expect(unitRes.status()).toBe(200);
    expect(tenantRes.status()).toBe(200);
    expect(leaseRes.status()).toBe(200);
    expect(incomeRes.status()).toBe(200);
    expect(expenseRes.status()).toBe(200);
    expect(maintRes.status()).toBe(200);
    expect(rateRes.status()).toBe(200);
    expect(logRes.status()).toBe(200);

    expect((await propRes.json()).length).toBe(4);    // 4 properties
    expect((await unitRes.json()).length).toBe(21);   // 21 units
    expect((await tenantRes.json()).length).toBe(14);  // 14 tenants
    expect((await leaseRes.json()).length).toBe(14);   // 14 leases
    expect((await incomeRes.json()).length).toBe(42);  // 14 × 3 months
    expect((await expenseRes.json()).length).toBe(20);  // 20 expenses
    expect((await maintRes.json()).length).toBe(7);    // 7 tasks
    expect((await rateRes.json()).length).toBe(1);     // 1 rate
    expect((await logRes.json()).length).toBe(9);      // 9 logs
  });
});
