import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers';

test.describe.serial('Mileage Rates and Logs', () => {
  // A property ID from seeded data — required when creating mileage logs
  let propertyId: string;

  // IDs for test resources created during this run
  let createdRateId: string;
  let createdLogId: string;

  test.beforeAll(async ({ request }) => {
    await loginAsAdmin(request);

    // Resolve a seeded property owned by admin to attach mileage logs to
    const propertiesRes = await request.get('/api/properties');
    expect(propertiesRes.status()).toBe(200);
    const properties = await propertiesRes.json();
    expect(properties.length).toBeGreaterThan(0);
    propertyId = properties[0].id;
  });

  test.afterAll(async ({ request }) => {
    await loginAsAdmin(request);

    // Guard: remove any rate that was not cleaned up by the delete test
    if (createdRateId) {
      await request.delete(`/api/mileage/rates/${createdRateId}`);
    }
    // Guard: remove any log that was not cleaned up by the delete test
    if (createdLogId) {
      await request.delete(`/api/mileage/logs/${createdLogId}`);
    }
  });

  // -------------------------------------------------------------------------
  // 1. List mileage rates
  // -------------------------------------------------------------------------

  test('list mileage rates returns all seeded rates for admin', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.get('/api/mileage/rates');

    expect(res.status()).toBe(200);

    const rates = await res.json();
    expect(Array.isArray(rates)).toBe(true);
    expect(rates.length).toBeGreaterThanOrEqual(1);
  });

  // -------------------------------------------------------------------------
  // 2. Create mileage rate
  // -------------------------------------------------------------------------

  test('create mileage rate returns 201 with the new rate', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.post('/api/mileage/rates', {
      data: {
        rate: 0.70,
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      },
    });

    expect(res.status()).toBe(201);

    const rate = await res.json();
    expect(rate).toHaveProperty('id');
    expect(rate.rate).toBe(0.70);
    expect(rate.startDate).toBe('2025-01-01');
    expect(rate.endDate).toBe('2025-12-31');

    createdRateId = rate.id;
  });

  // -------------------------------------------------------------------------
  // 3. Update mileage rate
  // -------------------------------------------------------------------------

  test('update mileage rate changes the rate value', async ({ request }) => {
    await loginAsAdmin(request);

    expect(createdRateId).toBeTruthy();

    const res = await request.put(`/api/mileage/rates/${createdRateId}`, {
      data: { rate: 0.72 },
    });

    expect(res.status()).toBe(200);

    const updated = await res.json();
    expect(updated.id).toBe(createdRateId);
    expect(updated.rate).toBe(0.72);
  });

  // -------------------------------------------------------------------------
  // 4. Delete mileage rate
  // -------------------------------------------------------------------------

  test('delete mileage rate returns success and removes the record', async ({ request }) => {
    await loginAsAdmin(request);

    expect(createdRateId).toBeTruthy();

    const deleteRes = await request.delete(`/api/mileage/rates/${createdRateId}`);
    expect(deleteRes.status()).toBe(200);

    const deleteBody = await deleteRes.json();
    expect(deleteBody).toEqual({ success: true });

    // Confirm the rate is absent from the list
    const listRes = await request.get('/api/mileage/rates');
    expect(listRes.status()).toBe(200);
    const rates = await listRes.json();
    const stillExists = rates.some((r: { id: string }) => r.id === createdRateId);
    expect(stillExists).toBe(false);

    // Mark cleaned so afterAll guard does not attempt a second delete
    createdRateId = '';
  });

  // -------------------------------------------------------------------------
  // 5. List mileage logs
  // -------------------------------------------------------------------------

  test('list mileage logs returns all seeded logs for admin', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.get('/api/mileage/logs');

    expect(res.status()).toBe(200);

    const logs = await res.json();
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThanOrEqual(9);
  });

  // -------------------------------------------------------------------------
  // 6. Create mileage log
  // -------------------------------------------------------------------------

  test('create mileage log returns 201 with the new log', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.post('/api/mileage/logs', {
      data: {
        propertyId,
        date: '2025-01-15',
        distance: 25,
        amount: 17.5,
        description: 'Test drive',
      },
    });

    expect(res.status()).toBe(201);

    const log = await res.json();
    expect(log).toHaveProperty('id');
    expect(log.propertyId).toBe(propertyId);
    expect(log.date).toBe('2025-01-15');
    expect(log.distance).toBe(25);
    expect(log.amount).toBe(17.5);
    expect(log.description).toBe('Test drive');

    createdLogId = log.id;
  });

  // -------------------------------------------------------------------------
  // 7. Update mileage log
  // -------------------------------------------------------------------------

  test('update mileage log changes distance and amount', async ({ request }) => {
    await loginAsAdmin(request);

    expect(createdLogId).toBeTruthy();

    const res = await request.put(`/api/mileage/logs/${createdLogId}`, {
      data: { distance: 30, amount: 21.0 },
    });

    expect(res.status()).toBe(200);

    const updated = await res.json();
    expect(updated.id).toBe(createdLogId);
    expect(updated.distance).toBe(30);
    expect(updated.amount).toBe(21.0);
  });

  // -------------------------------------------------------------------------
  // 8. Delete mileage log
  // -------------------------------------------------------------------------

  test('delete mileage log returns success and removes the record', async ({ request }) => {
    await loginAsAdmin(request);

    expect(createdLogId).toBeTruthy();

    const deleteRes = await request.delete(`/api/mileage/logs/${createdLogId}`);
    expect(deleteRes.status()).toBe(200);

    const deleteBody = await deleteRes.json();
    expect(deleteBody).toEqual({ success: true });

    // Confirm the log is absent from the list
    const listRes = await request.get('/api/mileage/logs');
    expect(listRes.status()).toBe(200);
    const logs = await listRes.json();
    const stillExists = logs.some((l: { id: string }) => l.id === createdLogId);
    expect(stillExists).toBe(false);

    // Mark cleaned so afterAll guard does not attempt a second delete
    createdLogId = '';
  });
});
