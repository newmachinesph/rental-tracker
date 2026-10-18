import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers';

test.describe.serial('Units API', () => {
  let seededPropertyId: string;
  let createdUnitId: string;

  test('list all units returns seeded units', async ({ request }) => {
    await loginAsAdmin(request);

    // Fetch properties first to capture a real seeded property id for later tests
    const propertiesRes = await request.get('/api/properties');
    expect(propertiesRes.status()).toBe(200);
    const properties = await propertiesRes.json();
    expect(properties.length).toBeGreaterThan(0);
    seededPropertyId = properties[0].id;

    const res = await request.get('/api/units');

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(21);
  });

  test('filter units by propertyId returns only that property units', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.get(`/api/units?propertyId=${seededPropertyId}`);

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    for (const unit of body) {
      expect(unit).toHaveProperty('propertyId', seededPropertyId);
    }
  });

  test('create unit returns 201 with unit data', async ({ request }) => {
    await loginAsAdmin(request);

    const payload = {
      propertyId: seededPropertyId,
      unitNumber: 'TEST-1',
      address: '123 Test',
    };

    const res = await request.post('/api/units', { data: payload });

    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('propertyId', seededPropertyId);
    expect(body).toHaveProperty('unitNumber', 'TEST-1');
    expect(body).toHaveProperty('address', '123 Test');

    createdUnitId = body.id;
  });

  test('update unit changes unitNumber', async ({ request }) => {
    await loginAsAdmin(request);

    const payload = { unitNumber: 'TEST-UPDATED' };

    const res = await request.put(`/api/units/${createdUnitId}`, { data: payload });

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('id', createdUnitId);
    expect(body).toHaveProperty('unitNumber', 'TEST-UPDATED');
  });

  test('delete unit returns success true', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.delete(`/api/units/${createdUnitId}`);

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  test('create unit with nonexistent propertyId returns 403', async ({ request }) => {
    await loginAsAdmin(request);

    const payload = {
      propertyId: 'nonexistent-property-id',
      unitNumber: 'X',
    };

    const res = await request.post('/api/units', { data: payload });

    expect(res.status()).toBe(403);

    const body = await res.json();
    expect(body).toHaveProperty('error');
  });
});
