import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers';

test.describe.serial('Properties API', () => {
  let createdPropertyId: string;

  test('list properties returns seeded data', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.get('/api/properties');

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(4);

    for (const property of body) {
      expect(property).toHaveProperty('id');
      expect(property).toHaveProperty('name');
      expect(property).toHaveProperty('type');
      expect(property).toHaveProperty('units');
      expect(property).toHaveProperty('unitList');
      expect(Array.isArray(property.unitList)).toBe(true);
    }
  });

  test('create property returns 201 with all fields', async ({ request }) => {
    await loginAsAdmin(request);

    const payload = {
      name: 'Test Property',
      type: 'Apartment',
      units: 0,
      address: '123 Test St',
    };

    const res = await request.post('/api/properties', { data: payload });

    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('name', payload.name);
    expect(body).toHaveProperty('type', payload.type);
    expect(body).toHaveProperty('units', 0);
    expect(body).toHaveProperty('address', payload.address);

    createdPropertyId = body.id;
  });

  test('get single property by id returns unitList', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.get(`/api/properties/${createdPropertyId}`);

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('id', createdPropertyId);
    expect(body).toHaveProperty('name', 'Test Property');
    expect(body).toHaveProperty('unitList');
    expect(Array.isArray(body.unitList)).toBe(true);
  });

  test('update property changes name and type', async ({ request }) => {
    await loginAsAdmin(request);

    const payload = { name: 'Updated Property', type: 'Condo' };

    const res = await request.put(`/api/properties/${createdPropertyId}`, {
      data: payload,
    });

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('id', createdPropertyId);
    expect(body).toHaveProperty('name', 'Updated Property');
    expect(body).toHaveProperty('type', 'Condo');
  });

  test('delete property returns success true', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.delete(`/api/properties/${createdPropertyId}`);

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  test('get deleted property returns 404', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.get(`/api/properties/${createdPropertyId}`);

    expect(res.status()).toBe(404);
  });

  test('list properties returns original seeded count after cleanup', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.get('/api/properties');

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(4);
  });
});
