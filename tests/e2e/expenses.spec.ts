import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers';

// IDs resolved during the first test and shared across all tests in the suite
let propertyId: string;
let unitId: string;

// IDs of expense records created during the suite, collected for cleanup
const createdIds: string[] = [];

test.describe.serial('Expenses API', () => {
  // ---------------------------------------------------------------------------
  // 1. List expense records (also resolves shared IDs)
  // ---------------------------------------------------------------------------

  test('list expense records returns seeded data', async ({ request }) => {
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

    const res = await request.get('/api/expenses');

    expect(res.status()).toBe(200);

    const records = await res.json();
    expect(Array.isArray(records)).toBe(true);
    expect(records.length).toBeGreaterThanOrEqual(12);
  });

  // ---------------------------------------------------------------------------
  // 2. Create expense with computed total
  // ---------------------------------------------------------------------------

  test('create expense record computes total as amount plus additionalFees', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.post('/api/expenses', {
      data: {
        date: '2024-08-01',
        propertyId,
        unitId,
        category: 'Repairs',
        amount: 500,
        additionalFees: 75,
        appliesToEntireBuilding: false,
        notes: 'Test expense',
      },
    });

    expect(res.status()).toBe(201);

    const record = await res.json();
    expect(record).toHaveProperty('id');
    createdIds.push(record.id);

    expect(record.total).toBe(575);
    expect(record.amount).toBe(500);
    expect(record.additionalFees).toBe(75);
    expect(record.category).toBe('Repairs');
    expect(record.notes).toBe('Test expense');
  });

  // ---------------------------------------------------------------------------
  // 3. Create building-wide expense
  // ---------------------------------------------------------------------------

  test('create building-wide expense sets appliesToEntireBuilding and nullifies unitId', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.post('/api/expenses', {
      data: {
        date: '2024-08-15',
        propertyId,
        appliesToEntireBuilding: true,
        unitId: null,
        category: 'Insurance',
        amount: 2000,
        additionalFees: 0,
      },
    });

    expect(res.status()).toBe(201);

    const record = await res.json();
    expect(record).toHaveProperty('id');
    createdIds.push(record.id);

    expect(record.appliesToEntireBuilding).toBe(true);
    // The API stores null/empty for unitId on building-wide expenses
    expect(record.unitId === null || record.unitId === '').toBe(true);
    expect(record.total).toBe(2000);
  });

  // ---------------------------------------------------------------------------
  // 4. Update expense — recomputes total
  // ---------------------------------------------------------------------------

  test('update expense record recomputes total from merged amount and additionalFees', async ({ request }) => {
    await loginAsAdmin(request);

    // Create a baseline record to update
    const createRes = await request.post('/api/expenses', {
      data: {
        date: '2024-08-20',
        propertyId,
        unitId,
        category: 'Maintenance',
        amount: 400,
        additionalFees: 50,
        appliesToEntireBuilding: false,
        notes: 'Before update',
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.total).toBe(450);
    createdIds.push(created.id);

    // Update amount and additionalFees — total must be recomputed
    const updateRes = await request.put(`/api/expenses/${created.id}`, {
      data: {
        amount: 600,
        additionalFees: 100,
      },
    });

    expect(updateRes.status()).toBe(200);

    const updated = await updateRes.json();
    expect(updated.total).toBe(700);
    expect(updated.amount).toBe(600);
    expect(updated.additionalFees).toBe(100);
  });

  // ---------------------------------------------------------------------------
  // 5. Delete expense
  // ---------------------------------------------------------------------------

  test('delete expense record returns success and makes the record unreachable', async ({ request }) => {
    await loginAsAdmin(request);

    // Create a throwaway record to delete
    const createRes = await request.post('/api/expenses', {
      data: {
        date: '2024-09-01',
        propertyId,
        unitId,
        category: 'Cleaning',
        amount: 150,
        additionalFees: 0,
        appliesToEntireBuilding: false,
        notes: 'To be deleted',
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    const deleteId = created.id;
    // Do NOT push to createdIds — we delete it in this test

    const deleteRes = await request.delete(`/api/expenses/${deleteId}`);
    expect(deleteRes.status()).toBe(200);

    const deleteBody = await deleteRes.json();
    expect(deleteBody).toEqual({ success: true });

    // Confirm the record no longer exists
    const getRes = await request.get(`/api/expenses/${deleteId}`);
    expect(getRes.status()).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // 6. List returns original count after cleanup
  // ---------------------------------------------------------------------------

  test('list expense records still returns at least seeded count after test cleanup', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.get('/api/expenses');

    expect(res.status()).toBe(200);

    const records = await res.json();
    expect(Array.isArray(records)).toBe(true);
    expect(records.length).toBeGreaterThanOrEqual(12);
  });

  // ---------------------------------------------------------------------------
  // Cleanup — delete every record created during this suite
  // ---------------------------------------------------------------------------

  test.afterAll(async ({ request }) => {
    await loginAsAdmin(request);
    for (const id of createdIds) {
      await request.delete(`/api/expenses/${id}`);
    }
  });
});
