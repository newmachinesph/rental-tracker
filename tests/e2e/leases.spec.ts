import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers';

test.describe.serial('Leases API', () => {
  let seededPropertyId: string;
  let seededUnitId: string;
  let seededTenantId: string;
  let createdLeaseId: string;

  test('list leases returns seeded leases with relations', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.get('/api/leases');

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(14);

    for (const lease of body) {
      expect(lease).toHaveProperty('id');
      expect(lease).toHaveProperty('property');
      expect(lease).toHaveProperty('unit');
      expect(lease).toHaveProperty('tenant');
      expect(lease.property).toHaveProperty('id');
      expect(lease.unit).toHaveProperty('id');
      expect(lease.tenant).toHaveProperty('id');
    }
  });

  test('create lease returns 201 with lease data', async ({ request }) => {
    await loginAsAdmin(request);

    // Fetch seeded IDs to use for a new lease
    const propertiesRes = await request.get('/api/properties');
    expect(propertiesRes.status()).toBe(200);
    const properties = await propertiesRes.json();

    // Pick the first property
    const property = properties[0];
    seededPropertyId = property.id;

    // Get units for this property and find one not already leased
    const unitsRes = await request.get(`/api/units?propertyId=${seededPropertyId}`);
    expect(unitsRes.status()).toBe(200);
    const allUnits = await unitsRes.json();

    const leasesRes = await request.get('/api/leases');
    expect(leasesRes.status()).toBe(200);
    const existingLeases = await leasesRes.json();
    const leasedUnitIds = new Set(existingLeases.map((l: { unitId: string }) => l.unitId));

    const freeUnit = allUnits.find((u: { id: string }) => !leasedUnitIds.has(u.id));
    expect(freeUnit).toBeDefined();
    seededUnitId = freeUnit.id;

    // Create a fresh tenant specifically for this test lease
    const tenantRes = await request.post('/api/tenants', {
      data: {
        name: 'LeaseTest Tenant',
        email: 'leasetest@example.com',
        phone: '555-0199',
      },
    });
    expect(tenantRes.status()).toBe(201);
    const testTenant = await tenantRes.json();
    seededTenantId = testTenant.id;

    const payload = {
      propertyId: seededPropertyId,
      unitId: seededUnitId,
      tenantId: seededTenantId,
      leaseStart: '2025-01-01',
      leaseEnd: '2025-12-31',
      monthlyRent: 1500,
      deposit: 1500,
    };

    const res = await request.post('/api/leases', { data: payload });

    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('propertyId', seededPropertyId);
    expect(body).toHaveProperty('unitId', seededUnitId);
    expect(body).toHaveProperty('tenantId', seededTenantId);
    expect(body).toHaveProperty('monthlyRent', 1500);
    expect(body).toHaveProperty('deposit', 1500);

    createdLeaseId = body.id;
  });

  test('update lease changes monthlyRent', async ({ request }) => {
    await loginAsAdmin(request);

    const payload = { monthlyRent: 1800 };

    const res = await request.put(`/api/leases/${createdLeaseId}`, { data: payload });

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('id', createdLeaseId);
    expect(body).toHaveProperty('monthlyRent', 1800);
  });

  test('delete lease returns success true', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.delete(`/api/leases/${createdLeaseId}`);

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  test('list leases returns original count after cleanup', async ({ request }) => {
    await loginAsAdmin(request);

    const res = await request.get('/api/leases');

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(14);

    const ids = body.map((l: { id: string }) => l.id);
    expect(ids).not.toContain(createdLeaseId);
  });

  // Cleanup — remove the test tenant created for this suite
  test.afterAll(async ({ request }) => {
    await loginAsAdmin(request);
    if (seededTenantId) {
      await request.delete(`/api/tenants/${seededTenantId}`);
    }
  });
});
