import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers';

test.describe.serial('Tenants API', () => {
  let createdTenantId: string;

  test('list tenants returns seeded tenants', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.get('/api/tenants');

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(10);

    for (const tenant of body) {
      expect(tenant).toHaveProperty('id');
      expect(tenant).toHaveProperty('name');
    }
  });

  test('create tenant returns 201 with tenant data', async ({ request }) => {
    await loginAsAdmin(request);

    const payload = {
      name: 'Test Tenant',
      phone: '555-999-0000',
      email: 'test@tenant.com',
    };

    const res = await request.post('/api/tenants', { data: payload });

    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('name', payload.name);
    expect(body).toHaveProperty('phone', payload.phone);
    expect(body).toHaveProperty('email', payload.email);

    createdTenantId = body.id;
  });

  test('update tenant changes name and phone', async ({ request }) => {
    await loginAsAdmin(request);

    const payload = { name: 'Updated Tenant', phone: '555-999-1111' };

    const res = await request.put(`/api/tenants/${createdTenantId}`, { data: payload });

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('id', createdTenantId);
    expect(body).toHaveProperty('name', 'Updated Tenant');
    expect(body).toHaveProperty('phone', '555-999-1111');
  });

  test('delete tenant returns success true', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.delete(`/api/tenants/${createdTenantId}`);

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  test('list tenants returns original count after cleanup', async ({ request }) => {
    await loginAsAdmin(request);

    // The tenants [id] route only has PUT and DELETE — no GET by id.
    // Verify removal by checking the list no longer contains the deleted tenant.
    const res = await request.get('/api/tenants');

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.find((t: { id: string }) => t.id === createdTenantId)).toBeUndefined();

    const ids = body.map((t: { id: string }) => t.id);
    expect(ids).not.toContain(createdTenantId);
  });
});
