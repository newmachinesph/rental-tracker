import { test, expect } from '@playwright/test';
import {
  loginViaUI,
  logoutViaUI,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
} from '../../ui-helpers';

test.describe.serial('Auth UI', () => {
  // -------------------------------------------------------------------
  // 1. Login page renders correctly
  // -------------------------------------------------------------------
  test('login page renders with heading, inputs, and sign-in button', async ({ page }) => {
    await page.goto('/login');

    // Heading
    await expect(page.locator('h1')).toHaveText('Welcome back');

    // Email and password inputs
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();

    // Sign In button
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  // -------------------------------------------------------------------
  // 2. Invalid credentials show error
  // -------------------------------------------------------------------
  test('invalid credentials display error message', async ({ page }) => {
    await page.goto('/login');

    await page.locator('#email').fill('wrong@example.com');
    await page.locator('#password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Error message appears in a red-bordered div
    const errorDiv = page.locator('div.border-red-200');
    await expect(errorDiv).toBeVisible({ timeout: 10_000 });
    await expect(errorDiv).toContainText(/invalid|wrong|failed/i);
  });

  // -------------------------------------------------------------------
  // 3. Valid login redirects to dashboard (/)
  // -------------------------------------------------------------------
  test('valid login redirects to dashboard', async ({ page }) => {
    await loginViaUI(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Should be on the root dashboard
    expect(page.url()).toMatch(/\/$/);
  });

  // -------------------------------------------------------------------
  // 4. Authenticated user visiting /login is redirected to /
  // -------------------------------------------------------------------
  test('authenticated user is redirected from /login to /', async ({ page }) => {
    // First log in
    await loginViaUI(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    // Now navigate to /login -- should redirect back to /
    await page.goto('/login');
    await page.waitForURL(/^\/$|^http:\/\/localhost:\d+\/$/, { timeout: 10_000 });

    // Confirm we are NOT on the login page
    expect(page.url()).not.toContain('/login');
  });

  // -------------------------------------------------------------------
  // 5. Logout works
  // -------------------------------------------------------------------
  test('logout redirects to login page', async ({ page }) => {
    await loginViaUI(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await logoutViaUI(page);

    // Should be on /login
    await expect(page).toHaveURL(/\/login/);
  });

  // -------------------------------------------------------------------
  // 6. Unauthenticated user is redirected to /login
  // -------------------------------------------------------------------
  test('unauthenticated user visiting / is redirected to /login', async ({ page }) => {
    // Go to the root without logging in
    await page.goto('/');
    await page.waitForURL(/\/login/, { timeout: 10_000 });

    await expect(page).toHaveURL(/\/login/);
  });

  // -------------------------------------------------------------------
  // 7. /register redirects to /login (registration disabled)
  // -------------------------------------------------------------------
  test('visiting /register redirects to /login', async ({ page }) => {
    await page.goto('/register');
    await page.waitForURL(/\/login/, { timeout: 10_000 });

    await expect(page).toHaveURL(/\/login/);
  });
});
