import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAsAdmin } from '../helpers';

test.describe('Middleware', () => {
  // ---------------------------------------------------------------------------
  // Unauthenticated API access
  // ---------------------------------------------------------------------------

  test('API routes return 401 without session', async ({ request }) => {
    // Do NOT login — the request context has no session cookie
    const res = await request.get('/api/properties');

    expect(res.status()).toBe(401);

    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  test('auth API routes accessible without session', async ({ request }) => {
    // POST /api/auth/login must be reachable without a prior session
    const res = await request.post('/api/auth/login', {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });

    // The middleware must let the request through; the route handler returns 200
    expect(res.status()).toBe(200);
  });

  // ---------------------------------------------------------------------------
  // Page-level redirect behaviour
  // ---------------------------------------------------------------------------

  test('protected pages redirect unauthenticated users to /login', async ({ request }) => {
    // Capture the redirect without following it so we can inspect the status
    // and Location header that Next.js middleware sets.
    const res = await request.get('/', { maxRedirects: 0 });

    // Middleware issues a 307 Temporary Redirect (Next.js default for
    // NextResponse.redirect). Accept 301/302/307/308 to be resilient to
    // framework variations.
    const status = res.status();
    const isRedirect = status >= 300 && status < 400;

    if (isRedirect) {
      const location = res.headers()['location'] ?? '';
      expect(location).toContain('/login');
    } else {
      // If the server followed the redirect internally, the final URL should
      // still reference /login.
      expect(res.url()).toContain('/login');
    }
  });

  test('auth pages redirect authenticated users to /', async ({ request }) => {
    // Establish a session
    await loginAsAdmin(request);

    // Try to visit /login with a valid session — middleware should redirect away
    const res = await request.get('/login', { maxRedirects: 0 });

    const status = res.status();
    const isRedirect = status >= 300 && status < 400;

    if (isRedirect) {
      const location = res.headers()['location'] ?? '';
      // Should point back to the root (or at least not to /login)
      expect(location).not.toContain('/login');
    } else {
      // Playwright followed the redirect — ensure we are NOT on /login
      expect(res.url()).not.toContain('/login');
    }
  });

  // ---------------------------------------------------------------------------
  // Auth route bypass confirmation
  // ---------------------------------------------------------------------------

  test('API auth routes bypass middleware — /api/auth/me returns 401 from route handler without session', async ({ request }) => {
    // Without a session, /api/auth/me must be reachable (middleware passes it
    // through) and the route handler itself returns 401 — NOT the middleware.
    // We verify this by checking that the response body contains the route
    // handler's specific error message rather than the middleware's generic one.
    const res = await request.get('/api/auth/me');

    expect(res.status()).toBe(401);

    const body = await res.json();
    // The middleware would return { error: 'Unauthorized' }.
    // The /api/auth/me route handler returns { error: 'Not authenticated' }.
    // Confirming the route-handler message proves the middleware bypassed the
    // request and let the handler decide the response.
    expect(body).toHaveProperty('error', 'Not authenticated');
  });
});
