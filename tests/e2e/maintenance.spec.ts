import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers';

// Valid enum values defined by the Prisma schema
const VALID_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'] as const;
const VALID_STATUSES = ['Open', 'InProgress', 'Completed', 'OnHold'] as const;

test.describe.serial('Maintenance Tasks', () => {
  // IDs resolved from seeded data in beforeAll and shared across tests
  let propertyId: string;
  let unitId: string;

  // IDs for resources created during this test run (cleaned up in afterAll)
  let createdTaskId: string;

  test.beforeAll(async ({ request }) => {
    await loginAsAdmin(request);

    // Fetch the first property owned by admin to use as the test target
    const propertiesRes = await request.get('/api/properties');
    expect(propertiesRes.status()).toBe(200);
    const properties = await propertiesRes.json();
    expect(properties.length).toBeGreaterThan(0);

    const firstProperty = properties[0];
    propertyId = firstProperty.id;

    // Fetch units and pick the first unit belonging to this property
    const unitsRes = await request.get(`/api/units?propertyId=${propertyId}`);
    expect(unitsRes.status()).toBe(200);
    const units = await unitsRes.json();
    expect(units.length).toBeGreaterThan(0);
    unitId = units[0].id;
  });

  test.afterAll(async ({ request }) => {
    // Guard: clean up any task that was created but not deleted by the delete test
    if (createdTaskId) {
      await request.delete(`/api/maintenance/${createdTaskId}`);
    }
  });

  // -------------------------------------------------------------------------
  // 1. List maintenance tasks
  // -------------------------------------------------------------------------

  test('list maintenance tasks returns all seeded tasks for admin', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.get('/api/maintenance');

    expect(res.status()).toBe(200);

    const tasks = await res.json();
    expect(Array.isArray(tasks)).toBe(true);
    expect(tasks.length).toBeGreaterThanOrEqual(7);
  });

  // -------------------------------------------------------------------------
  // 2. Create maintenance task
  // -------------------------------------------------------------------------

  test('create maintenance task returns 201 with the new task', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.post('/api/maintenance', {
      data: {
        propertyId,
        unitId,
        dateReported: '2024-08-01',
        description: 'Test repair',
        priority: 'High',
        category: 'Plumbing',
        contractor: 'Test Co',
        estimatedCost: 500,
        status: 'Open',
      },
    });

    expect(res.status()).toBe(201);

    const task = await res.json();
    expect(task).toHaveProperty('id');
    expect(task.propertyId).toBe(propertyId);
    expect(task.unitId).toBe(unitId);
    expect(task.description).toBe('Test repair');
    expect(task.priority).toBe('High');
    expect(task.category).toBe('Plumbing');
    expect(task.contractor).toBe('Test Co');
    expect(task.estimatedCost).toBe(500);
    expect(task.status).toBe('Open');
    expect(task.dateReported).toBe('2024-08-01');

    // Persist the ID so subsequent tests can reference and clean up
    createdTaskId = task.id;
  });

  // -------------------------------------------------------------------------
  // 3. Update maintenance task
  // -------------------------------------------------------------------------

  test('update maintenance task changes status and actualCost', async ({ request }) => {
    await loginAsAdmin(request);

    expect(createdTaskId).toBeTruthy();

    const res = await request.put(`/api/maintenance/${createdTaskId}`, {
      data: {
        status: 'InProgress',
        actualCost: 450,
      },
    });

    expect(res.status()).toBe(200);

    const updated = await res.json();
    expect(updated.id).toBe(createdTaskId);
    expect(updated.status).toBe('InProgress');
    expect(updated.actualCost).toBe(450);
  });

  // -------------------------------------------------------------------------
  // 4. Delete maintenance task
  // -------------------------------------------------------------------------

  test('delete maintenance task returns success and removes the record', async ({ request }) => {
    await loginAsAdmin(request);

    expect(createdTaskId).toBeTruthy();

    const deleteRes = await request.delete(`/api/maintenance/${createdTaskId}`);
    expect(deleteRes.status()).toBe(200);

    const deleteBody = await deleteRes.json();
    expect(deleteBody).toEqual({ success: true });

    // Verify the task is no longer present in the list
    const listRes = await request.get('/api/maintenance');
    expect(listRes.status()).toBe(200);
    const tasks = await listRes.json();
    const stillExists = tasks.some((t: { id: string }) => t.id === createdTaskId);
    expect(stillExists).toBe(false);

    // Mark as cleaned so afterAll does not attempt a second delete
    createdTaskId = '';
  });

  // -------------------------------------------------------------------------
  // 5. Verify enum values on seeded data
  // -------------------------------------------------------------------------

  test('seeded tasks have valid priority and status enum values', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.get('/api/maintenance');
    expect(res.status()).toBe(200);

    const tasks = await res.json();
    expect(tasks.length).toBeGreaterThan(0);

    for (const task of tasks) {
      expect(VALID_PRIORITIES).toContain(task.priority);
      expect(VALID_STATUSES).toContain(task.status);
    }
  });
});
