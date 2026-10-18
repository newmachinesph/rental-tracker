import { test, expect } from '@playwright/test';
import { APIRequestContext } from '@playwright/test';
import { loginAsAdmin } from '../helpers';

// ---------------------------------------------------------------------------
// Cascade deletion tests
//
// Every test in this file creates its own isolated resources so that failures
// in one test do not bleed into another. Resources are cleaned up in afterAll
// guards using property deletion (which cascades to all child records).
// ---------------------------------------------------------------------------

test.describe.serial('Cascade Deletion Behaviour', () => {
  // Property IDs created during these tests — used as afterAll cleanup handles
  const createdPropertyIds: string[] = [];

  test.afterAll(async ({ request }) => {
    await loginAsAdmin(request);
    // Delete any properties that a test may have left behind (e.g. on failure).
    // Property deletion cascades to units, expenses, maintenance tasks, and
    // mileage logs, so this single call is sufficient for full cleanup.
    for (const pid of createdPropertyIds) {
      await request.delete(`/api/properties/${pid}`);
    }
  });

  // Helper: create a minimal property owned by admin
  async function createProperty(request: APIRequestContext, name: string): Promise<string> {
    const res = await request.post('/api/properties', {
      data: { name, units: 0, type: 'Apartment', address: '1 Test St' },
    });
    expect(res.status()).toBe(201);
    const property = await res.json();
    createdPropertyIds.push(property.id);
    return property.id;
  }

  // Helper: create a unit on a property
  async function createUnit(
    request: APIRequestContext,
    propertyId: string,
    unitNumber: string
  ): Promise<string> {
    const res = await request.post('/api/units', {
      data: { propertyId, unitNumber, address: `${unitNumber} Test Ave` },
    });
    expect(res.status()).toBe(201);
    const unit = await res.json();
    return unit.id;
  }

  // Helper: create an expense record
  async function createExpense(
    request: APIRequestContext,
    propertyId: string,
    unitId: string | null,
    appliesToEntireBuilding: boolean
  ): Promise<string> {
    const data: Record<string, unknown> = {
      date: '2025-03-01',
      propertyId,
      appliesToEntireBuilding,
      category: 'Repairs',
      amount: 100,
      additionalFees: 0,
      notes: 'Cascade test expense',
    };
    if (unitId !== null) {
      data.unitId = unitId;
    }
    const res = await request.post('/api/expenses', { data });
    expect(res.status()).toBe(201);
    const expense = await res.json();
    return expense.id;
  }

  // -------------------------------------------------------------------------
  // 1. Deleting a property cascades to its units
  // -------------------------------------------------------------------------

  test('deleting property cascades to units — units no longer appear in list', async ({ request }) => {
    await loginAsAdmin(request);

    // Create a fresh property with two units
    const propertyId = await createProperty(request, 'Cascade Test Property - Units');
    const unitId1 = await createUnit(request, propertyId, 'C1');
    const unitId2 = await createUnit(request, propertyId, 'C2');

    // Verify both units exist under this property
    const beforeRes = await request.get(`/api/units?propertyId=${propertyId}`);
    expect(beforeRes.status()).toBe(200);
    const unitsBefore = await beforeRes.json();
    expect(unitsBefore.length).toBe(2);

    // Delete the property
    const deleteRes = await request.delete(`/api/properties/${propertyId}`);
    expect(deleteRes.status()).toBe(200);
    expect(await deleteRes.json()).toEqual({ success: true });

    // Remove from cleanup list since deletion succeeded
    const idx = createdPropertyIds.indexOf(propertyId);
    if (idx !== -1) createdPropertyIds.splice(idx, 1);

    // Verify neither unit appears in the full unit list
    const allUnitsRes = await request.get('/api/units');
    expect(allUnitsRes.status()).toBe(200);
    const allUnits = await allUnitsRes.json();
    const unitIds = allUnits.map((u: { id: string }) => u.id);

    expect(unitIds).not.toContain(unitId1);
    expect(unitIds).not.toContain(unitId2);
  });

  // -------------------------------------------------------------------------
  // 2. Deleting a property cascades to its expense records
  // -------------------------------------------------------------------------

  test('deleting property cascades to expenses — expense no longer appears in list', async ({ request }) => {
    await loginAsAdmin(request);

    // Create property -> unit -> expense
    const propertyId = await createProperty(request, 'Cascade Test Property - Expenses');
    const unitId = await createUnit(request, propertyId, 'E1');
    const expenseId = await createExpense(request, propertyId, unitId, false);

    // Verify the expense exists before deletion
    const beforeRes = await request.get('/api/expenses');
    expect(beforeRes.status()).toBe(200);
    const expensesBefore = await beforeRes.json();
    expect(expensesBefore.some((e: { id: string }) => e.id === expenseId)).toBe(true);

    // Delete the property — cascades to the expense
    const deleteRes = await request.delete(`/api/properties/${propertyId}`);
    expect(deleteRes.status()).toBe(200);
    expect(await deleteRes.json()).toEqual({ success: true });

    // Remove from cleanup list since deletion succeeded
    const idx = createdPropertyIds.indexOf(propertyId);
    if (idx !== -1) createdPropertyIds.splice(idx, 1);

    // Verify the expense is gone
    const afterRes = await request.get('/api/expenses');
    expect(afterRes.status()).toBe(200);
    const expensesAfter = await afterRes.json();
    expect(expensesAfter.some((e: { id: string }) => e.id === expenseId)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 3. Deleting a unit sets the expense's unitId to null (SetNull behaviour)
  // -------------------------------------------------------------------------

  test('deleting unit sets expense unitId to null — property and expense remain', async ({ request }) => {
    await loginAsAdmin(request);

    // Create property -> unit -> unit-scoped expense
    const propertyId = await createProperty(request, 'Cascade Test Property - SetNull');
    const unitId = await createUnit(request, propertyId, 'S1');
    const expenseId = await createExpense(request, propertyId, unitId, false);

    // Confirm the expense is linked to the unit before deletion
    const beforeRes = await request.get('/api/expenses');
    expect(beforeRes.status()).toBe(200);
    const expensesBefore = await beforeRes.json();
    const expenseBefore = expensesBefore.find((e: { id: string }) => e.id === expenseId);
    expect(expenseBefore).toBeDefined();
    expect(expenseBefore.unitId).toBe(unitId);

    // Delete the unit — the schema specifies onDelete: SetNull for ExpenseRecord.unit
    const deleteUnitRes = await request.delete(`/api/units/${unitId}`);
    expect(deleteUnitRes.status()).toBe(200);
    expect(await deleteUnitRes.json()).toEqual({ success: true });

    // The expense must still exist but with unitId === null
    const afterRes = await request.get('/api/expenses');
    expect(afterRes.status()).toBe(200);
    const expensesAfter = await afterRes.json();
    const expenseAfter = expensesAfter.find((e: { id: string }) => e.id === expenseId);

    expect(expenseAfter).toBeDefined();
    expect(expenseAfter.unitId).toBeNull();

    // Clean up: deleting the property cascades to the now-orphaned expense
    const cleanupRes = await request.delete(`/api/properties/${propertyId}`);
    expect(cleanupRes.status()).toBe(200);

    // Remove from cleanup list since deletion succeeded
    const idx = createdPropertyIds.indexOf(propertyId);
    if (idx !== -1) createdPropertyIds.splice(idx, 1);
  });
});
