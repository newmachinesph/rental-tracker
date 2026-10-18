import { test, expect } from '@playwright/test';
import { loginAsAdmin } from '../helpers';

test.describe.serial('Settings and Owner Info', () => {
  test.beforeEach(async ({ request }) => {
    // Each test starts with a fresh authenticated admin session
    await loginAsAdmin(request);
  });

  test.afterAll(async ({ request }) => {
    // Restore the admin settings to the original seeded values so subsequent
    // test files start with a clean state
    await loginAsAdmin(request);
    await request.put('/api/settings', {
      data: { currency: '₱', mileageUnit: 'miles' },
    });
  });

  // -------------------------------------------------------------------------
  // 1. Get settings — verify all expected fields are present
  // -------------------------------------------------------------------------

  test('get settings returns 200 with all expected fields', async ({ request }) => {
    const res = await request.get('/api/settings');

    expect(res.status()).toBe(200);

    const settings = await res.json();
    expect(settings).toHaveProperty('currency');
    expect(settings).toHaveProperty('propertyTypes');
    expect(settings).toHaveProperty('incomeCategories');
    expect(settings).toHaveProperty('expenseCategories');
    expect(settings).toHaveProperty('paymentMethods');
    expect(settings).toHaveProperty('mileageUnit');

    expect(Array.isArray(settings.propertyTypes)).toBe(true);
    expect(Array.isArray(settings.incomeCategories)).toBe(true);
    expect(Array.isArray(settings.expenseCategories)).toBe(true);
    expect(Array.isArray(settings.paymentMethods)).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 2. Update currency
  // -------------------------------------------------------------------------

  test('update currency to € persists the change', async ({ request }) => {
    const res = await request.put('/api/settings', {
      data: { currency: '€' },
    });

    expect(res.status()).toBe(200);

    // Fetch again to confirm the server persisted the value
    const fetchRes = await request.get('/api/settings');
    expect(fetchRes.status()).toBe(200);
    const settings = await fetchRes.json();
    expect(settings.currency).toBe('€');
  });

  // -------------------------------------------------------------------------
  // 3. Partial update — update mileageUnit without touching currency
  // -------------------------------------------------------------------------

  test('partial update changes mileageUnit while preserving existing currency', async ({ request }) => {
    // Currency was set to '€' by the previous test in this serial describe block
    const res = await request.put('/api/settings', {
      data: { mileageUnit: 'km' },
    });

    expect(res.status()).toBe(200);

    const fetchRes = await request.get('/api/settings');
    expect(fetchRes.status()).toBe(200);
    const settings = await fetchRes.json();

    // mileageUnit must reflect the update
    expect(settings.mileageUnit).toBe('km');

    // currency must be unchanged from the previous test
    expect(settings.currency).toBe('€');
  });

  // -------------------------------------------------------------------------
  // 4. Restore defaults
  // -------------------------------------------------------------------------

  test('restore currency and mileageUnit to seeded defaults', async ({ request }) => {
    const res = await request.put('/api/settings', {
      data: { currency: '₱', mileageUnit: 'miles' },
    });

    expect(res.status()).toBe(200);

    const fetchRes = await request.get('/api/settings');
    expect(fetchRes.status()).toBe(200);
    const settings = await fetchRes.json();

    expect(settings.currency).toBe('₱');
    expect(settings.mileageUnit).toBe('miles');
  });

  // -------------------------------------------------------------------------
  // 5. Get owner info
  // -------------------------------------------------------------------------

  test('get owner info returns 200 with all expected fields', async ({ request }) => {
    const res = await request.get('/api/settings/owner-info');

    expect(res.status()).toBe(200);

    const ownerInfo = await res.json();
    expect(ownerInfo).toHaveProperty('name');
    expect(ownerInfo).toHaveProperty('company');
    expect(ownerInfo).toHaveProperty('address');
    expect(ownerInfo).toHaveProperty('phone');
    expect(ownerInfo).toHaveProperty('email');
  });

  // -------------------------------------------------------------------------
  // 6. Update owner info
  // -------------------------------------------------------------------------

  test('update owner info changes company and phone', async ({ request }) => {
    const res = await request.put('/api/settings/owner-info', {
      data: {
        company: 'Updated Company',
        phone: '555-999-0000',
      },
    });

    expect(res.status()).toBe(200);

    // Fetch to verify persistence
    const fetchRes = await request.get('/api/settings/owner-info');
    expect(fetchRes.status()).toBe(200);
    const ownerInfo = await fetchRes.json();

    expect(ownerInfo.company).toBe('Updated Company');
    expect(ownerInfo.phone).toBe('555-999-0000');
  });

  // -------------------------------------------------------------------------
  // 7. Restore owner info to defaults (so UI tests see expected values)
  // -------------------------------------------------------------------------

  test('restore owner info to defaults', async ({ request }) => {
    const res = await request.put('/api/settings/owner-info', {
      data: {
        name: 'Juan Carlos Reyes',
        company: 'JCR Property Management',
        address: 'Unit 1205, One Ayala Tower, Makati City',
        phone: '0917-888-1234',
        email: 'admin@gmail.com',
      },
    });

    expect(res.status()).toBe(200);
  });
});
