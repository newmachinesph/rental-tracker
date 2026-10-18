import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers';

// IDs resolved during the first test and shared across all tests in the suite
let propertyId: string;
let unitId: string;
let tenantId: string;

// IDs of income records created during the suite, collected for cleanup
const createdIds: string[] = [];

test.describe.serial('Income API', () => {
  // ---------------------------------------------------------------------------
  // 1. List income records (also resolves shared IDs)
  // ---------------------------------------------------------------------------

  test('list income records returns seeded data with relations', async ({ request }) => {
    await loginAsAdmin(request);

    // Resolve shared IDs for subsequent tests
    const propertiesRes = await request.get('/api/properties');
    expect(propertiesRes.status()).toBe(200);
    const properties = await propertiesRes.json();
    expect(properties.length).toBeGreaterThanOrEqual(1);
    propertyId = properties[0].id;

    const unitsRes = await request.get(`/api/units?propertyId=${propertyId}`);
    expect(unitsRes.status()).toBe(200);
    const units = await unitsRes.json();
    expect(units.length).toBeGreaterThanOrEqual(1);
    unitId = units[0].id;

    const tenantsRes = await request.get('/api/tenants');
    expect(tenantsRes.status()).toBe(200);
    const tenants = await tenantsRes.json();
    expect(tenants.length).toBeGreaterThanOrEqual(1);
    tenantId = tenants[0].id;

    const res = await request.get('/api/income');

    expect(res.status()).toBe(200);

    const records = await res.json();
    expect(Array.isArray(records)).toBe(true);
    expect(records.length).toBeGreaterThanOrEqual(42);

    // Every record must include the three related objects
    for (const record of records) {
      expect(record).toHaveProperty('property');
      expect(record).toHaveProperty('unit');
      // tenant may legitimately be null on some seed records but the key must exist
      expect(Object.keys(record)).toContain('tenant');
    }
  });

  // ---------------------------------------------------------------------------
  // 2. Create income — Paid status
  // ---------------------------------------------------------------------------

  test('create income record computes Paid status when amountPaid equals totalDue', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.post('/api/income', {
      data: {
        propertyId,
        unitId,
        tenantId,
        category: 'Rent',
        rentDueDate: '2024-07-01',
        rentAmount: 1000,
        additionalIncome: 50,
        paymentDate: '2024-07-01',
        amountPaid: 1050,
        paymentMethod: 'Bank Transfer',
      },
    });

    expect(res.status()).toBe(201);

    const record = await res.json();
    expect(record).toHaveProperty('id');
    createdIds.push(record.id);

    expect(record.totalDue).toBe(1050);
    expect(record.outstandingBalance).toBe(0);
    expect(record.paymentStatus).toBe('Paid');
    expect(record.delayDays).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 3. Create income — PartiallyPaid status
  // ---------------------------------------------------------------------------

  test('create income record computes PartiallyPaid status when amountPaid is less than totalDue', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.post('/api/income', {
      data: {
        propertyId,
        unitId,
        tenantId,
        category: 'Rent',
        rentDueDate: '2024-07-01',
        rentAmount: 1200,
        additionalIncome: 0,
        paymentDate: '2024-07-01',
        amountPaid: 500,
        paymentMethod: 'Cash',
      },
    });

    expect(res.status()).toBe(201);

    const record = await res.json();
    expect(record).toHaveProperty('id');
    createdIds.push(record.id);

    expect(record.totalDue).toBe(1200);
    expect(record.outstandingBalance).toBe(700);
    expect(record.paymentStatus).toBe('PartiallyPaid');
  });

  // ---------------------------------------------------------------------------
  // 4. Create income — Pending status
  // ---------------------------------------------------------------------------

  test('create income record computes Unpaid status when amountPaid is zero', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.post('/api/income', {
      data: {
        propertyId,
        unitId,
        tenantId,
        category: 'Rent',
        rentDueDate: '2024-08-01',
        rentAmount: 1000,
        additionalIncome: 0,
        amountPaid: 0,
        paymentMethod: '',
      },
    });

    expect(res.status()).toBe(201);

    const record = await res.json();
    expect(record).toHaveProperty('id');
    createdIds.push(record.id);

    expect(record.totalDue).toBe(1000);
    expect(record.paymentStatus).toBe('Unpaid');
    expect(record.outstandingBalance).toBe(1000);
  });

  // ---------------------------------------------------------------------------
  // 5. Create income — Overpaid status
  // ---------------------------------------------------------------------------

  test('create income record computes Overpaid status when amountPaid exceeds totalDue', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.post('/api/income', {
      data: {
        propertyId,
        unitId,
        tenantId,
        category: 'Rent',
        rentDueDate: '2024-08-01',
        rentAmount: 900,
        additionalIncome: 0,
        paymentDate: '2024-08-01',
        amountPaid: 1000,
        paymentMethod: 'Check',
      },
    });

    expect(res.status()).toBe(201);

    const record = await res.json();
    expect(record).toHaveProperty('id');
    createdIds.push(record.id);

    expect(record.paymentStatus).toBe('Overpaid');
    expect(record.outstandingBalance).toBe(-100);
  });

  // ---------------------------------------------------------------------------
  // 6. Create income — delay days calculated
  // ---------------------------------------------------------------------------

  test('create income record calculates delayDays from rentDueDate to paymentDate', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.post('/api/income', {
      data: {
        propertyId,
        unitId,
        tenantId,
        category: 'Rent',
        rentDueDate: '2024-07-01',
        rentAmount: 1000,
        additionalIncome: 0,
        paymentDate: '2024-07-06',
        amountPaid: 1000,
        paymentMethod: 'Bank Transfer',
      },
    });

    expect(res.status()).toBe(201);

    const record = await res.json();
    expect(record).toHaveProperty('id');
    createdIds.push(record.id);

    expect(record.delayDays).toBe(5);
  });

  // ---------------------------------------------------------------------------
  // 7. Update income — recomputes derived fields
  // ---------------------------------------------------------------------------

  test('update income record recomputes paymentStatus to Overpaid when amountPaid exceeds totalDue', async ({ request }) => {
    await loginAsAdmin(request);

    // Create a baseline record with totalDue = 1000 and Paid status
    const createRes = await request.post('/api/income', {
      data: {
        propertyId,
        unitId,
        tenantId,
        category: 'Rent',
        rentDueDate: '2024-09-01',
        rentAmount: 1000,
        additionalIncome: 0,
        paymentDate: '2024-09-01',
        amountPaid: 1000,
        paymentMethod: 'Bank Transfer',
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.paymentStatus).toBe('Paid');
    createdIds.push(created.id);

    // Update only amountPaid to trigger Overpaid recomputation
    const updateRes = await request.put(`/api/income/${created.id}`, {
      data: { amountPaid: 1200 },
    });

    expect(updateRes.status()).toBe(200);

    const updated = await updateRes.json();
    expect(updated.paymentStatus).toBe('Overpaid');
    expect(updated.totalDue).toBe(1000);
    expect(updated.outstandingBalance).toBe(-200);
  });

  // ---------------------------------------------------------------------------
  // 8. Delete income
  // ---------------------------------------------------------------------------

  test('delete income record returns success and makes the record unreachable', async ({ request }) => {
    await loginAsAdmin(request);

    // Create a throwaway record to delete
    const createRes = await request.post('/api/income', {
      data: {
        propertyId,
        unitId,
        tenantId,
        category: 'Rent',
        rentDueDate: '2024-10-01',
        rentAmount: 800,
        additionalIncome: 0,
        amountPaid: 0,
        paymentMethod: '',
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    const deleteId = created.id;
    // Do NOT push to createdIds — we delete it in this test

    const deleteRes = await request.delete(`/api/income/${deleteId}`);
    expect(deleteRes.status()).toBe(200);

    const deleteBody = await deleteRes.json();
    expect(deleteBody).toEqual({ success: true });

    // Confirm the record no longer exists
    const getRes = await request.get(`/api/income/${deleteId}`);
    expect(getRes.status()).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // Cleanup — delete every record created during this suite
  // ---------------------------------------------------------------------------

  test.afterAll(async ({ request }) => {
    await loginAsAdmin(request);
    for (const id of createdIds) {
      await request.delete(`/api/income/${id}`);
    }
  });
});
