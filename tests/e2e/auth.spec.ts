import { test, expect } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  loginAsAdmin,
} from '../helpers';

test.describe.serial('Auth', () => {
  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------

  test('login with valid credentials', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('user');

    const { user } = body;
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('name');
    expect(user).toHaveProperty('role');
    expect(user).not.toHaveProperty('passwordHash');
    expect(user.email).toBe(ADMIN_EMAIL);
  });

  test('login with wrong password', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: 'wrong-password' },
    });

    expect(res.status()).toBe(401);

    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('login with non-existent email', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: 'nobody@nowhere.invalid', password: 'irrelevant' },
    });

    expect(res.status()).toBe(401);

    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('login with missing fields', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: {},
    });

    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  // ---------------------------------------------------------------------------
  // /api/auth/me
  // ---------------------------------------------------------------------------

  test('get current user', async ({ request }) => {
    // Establish an authenticated session for this request context
    await loginAsAdmin(request);

    const res = await request.get('/api/auth/me');

    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('user');

    const { user } = body;
    expect(user).toHaveProperty('email', ADMIN_EMAIL);
    expect(user).toHaveProperty('settings');
    expect(user).toHaveProperty('ownerInfo');
    expect(user).not.toHaveProperty('passwordHash');
  });

  test('get current user without session', async ({ request: _unused }) => {
    // Each test gets its own request context — this one has no session cookie
    // because we never called loginAsAdmin/loginAsUser in this test.
    // However, `request` is shared across a describe block in serial mode, so
    // we use a fresh context via the test-scoped `request` fixture that
    // Playwright resets between tests only when cookies were not explicitly
    // preserved. To be explicit we call /api/auth/logout first to clear any
    // residual session from previous tests, then hit /me.
    const logoutRes = await _unused.post('/api/auth/logout');
    // Logout may return 200 regardless of session state
    expect([200, 401]).toContain(logoutRes.status());

    const res = await _unused.get('/api/auth/me');
    expect(res.status()).toBe(401);
  });

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  test('logout clears session', async ({ request }) => {
    // Login first to establish a session
    await loginAsAdmin(request);

    // Confirm we are authenticated
    const meBefore = await request.get('/api/auth/me');
    expect(meBefore.status()).toBe(200);

    // Logout
    const logoutRes = await request.post('/api/auth/logout');
    expect(logoutRes.status()).toBe(200);

    const logoutBody = await logoutRes.json();
    expect(logoutBody).toEqual({ success: true });

    // Session should now be invalid
    const meAfter = await request.get('/api/auth/me');
    expect(meAfter.status()).toBe(401);
  });
});
