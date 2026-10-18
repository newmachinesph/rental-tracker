import { test, expect } from '@playwright/test';
import { loginViaUI, navigateTo } from '../../ui-helpers';

test.describe.serial('Navigation UI', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
  });

  // -------------------------------------------------------------------
  // 1. Sidebar sections are visible
  // -------------------------------------------------------------------
  test('sidebar shows all navigation sections and links', async ({ page }) => {
    const aside = page.locator('aside');
    await expect(aside).toBeVisible();

    // Section titles (uppercase labels in nav)
    const nav = aside.locator('nav');
    await expect(nav.getByText('Management', { exact: true })).toBeVisible();
    await expect(nav.getByText('Tenant', { exact: true })).toBeVisible();
    await expect(nav.getByText('Documents', { exact: true }).first()).toBeVisible();
    await expect(nav.getByText('Analytics', { exact: true })).toBeVisible();

    // All nav links
    const expectedLinks = [
      'Dashboard',
      'Setup',
      'Lease Tracker',
      'Income',
      'Expenses',
      'Maintenance',
      'Tenants',
      'Tenant Ledger',
      'Rent Reminders',
      'Documents',
      'Property',
      'Unit',
      'Monthly',
      'Annual',
      'Five-Year',
      'Custom',
      'Comparison',
    ];

    for (const linkText of expectedLinks) {
      await expect(
        aside.getByRole('link', { name: linkText, exact: true }),
      ).toBeVisible();
    }
  });

  // -------------------------------------------------------------------
  // 2. Navigate to Setup (/setup)
  // -------------------------------------------------------------------
  test('navigate to Setup page', async ({ page }) => {
    await navigateTo(page, 'Setup');
    await expect(page).toHaveURL(/\/setup/);
    await expect(page.locator('h1')).toContainText('Setup');
  });

  // -------------------------------------------------------------------
  // 3. Navigate to Lease Tracker (/leases)
  // -------------------------------------------------------------------
  test('navigate to Lease Tracker page', async ({ page }) => {
    await navigateTo(page, 'Lease Tracker');
    await expect(page).toHaveURL(/\/leases/);
  });

  // -------------------------------------------------------------------
  // 4. Navigate to Income (/income)
  // -------------------------------------------------------------------
  test('navigate to Income page', async ({ page }) => {
    await navigateTo(page, 'Income');
    await expect(page).toHaveURL(/\/income/);
  });

  // -------------------------------------------------------------------
  // 5. Navigate to Expenses (/expenses)
  // -------------------------------------------------------------------
  test('navigate to Expenses page', async ({ page }) => {
    await navigateTo(page, 'Expenses');
    await expect(page).toHaveURL(/\/expenses/);
  });

  // -------------------------------------------------------------------
  // 6. Navigate to Maintenance (/maintenance)
  // -------------------------------------------------------------------
  test('navigate to Maintenance page', async ({ page }) => {
    await navigateTo(page, 'Maintenance');
    await expect(page).toHaveURL(/\/maintenance/);
  });

  // -------------------------------------------------------------------
  // 7. Navigate to Tenants (/tenants)
  // -------------------------------------------------------------------
  test('navigate to Tenants page', async ({ page }) => {
    await navigateTo(page, 'Tenants');
    await expect(page).toHaveURL(/\/tenants/);
    await expect(page.locator('h1')).toContainText('Tenants');
  });

  // -------------------------------------------------------------------
  // 8. Navigate to Tenant Ledger (/tenant-ledger)
  // -------------------------------------------------------------------
  test('navigate to Tenant Ledger page', async ({ page }) => {
    await navigateTo(page, 'Tenant Ledger');
    await expect(page).toHaveURL(/\/tenant-ledger/);
  });

  // -------------------------------------------------------------------
  // 8. Navigate to Rent Reminders (/rent-reminders)
  // -------------------------------------------------------------------
  test('navigate to Rent Reminders page', async ({ page }) => {
    await navigateTo(page, 'Rent Reminders');
    await expect(page).toHaveURL(/\/rent-reminders/);
  });

  // -------------------------------------------------------------------
  // 9. Navigate to Documents (/documents)
  // -------------------------------------------------------------------
  test('navigate to Documents page', async ({ page }) => {
    await navigateTo(page, 'Documents');
    await expect(page).toHaveURL(/\/documents/);
  });

  // -------------------------------------------------------------------
  // 10. Navigate to Property dashboard (/dashboards/property)
  // -------------------------------------------------------------------
  test('navigate to Property dashboard', async ({ page }) => {
    await navigateTo(page, 'Property');
    await expect(page).toHaveURL(/\/dashboards\/property/);
  });

  // -------------------------------------------------------------------
  // 11. Sidebar collapse and expand
  // -------------------------------------------------------------------
  test('sidebar collapse and expand toggles width', async ({ page }) => {
    const aside = page.locator('aside');

    // Initially expanded: w-[260px]
    await expect(aside).toHaveClass(/w-\[260px\]/);

    // Click the Collapse button (force to bypass nextjs-portal overlay in dev mode)
    const collapseBtn = aside.getByText('Collapse', { exact: true });
    await collapseBtn.click({ force: true });

    // Should now be collapsed: w-[72px]
    await expect(aside).toHaveClass(/w-\[72px\]/);

    // The "Collapse" text should be hidden when collapsed, but the button
    // should still be accessible via title attribute
    const expandBtn = aside.locator('button[title="Expand sidebar"]');
    await expect(expandBtn).toBeVisible();
    await expandBtn.click({ force: true });

    // Should be expanded again
    await expect(aside).toHaveClass(/w-\[260px\]/);
  });

  // -------------------------------------------------------------------
  // 12. Dashboard quick actions navigate correctly
  // -------------------------------------------------------------------
  test('dashboard quick actions navigate to correct pages', async ({ page }) => {
    // We should already be on the dashboard from beforeEach
    await expect(page).toHaveURL(/\/$/);

    const quickActionMap: Record<string, RegExp> = {
      'Add Income': /\/income/,
      'Add Expense': /\/expenses/,
      'New Lease': /\/leases/,
      'Maintenance': /\/maintenance/,
      'Reports': /\/dashboards\/property/,
      'Settings': /\/setup/,
    };

    for (const [label, urlPattern] of Object.entries(quickActionMap)) {
      // Navigate back to dashboard before each quick action click
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      // Click the quick action link (scoped to main to avoid sidebar matches)
      const link = page.locator('main').getByRole('link', { name: label, exact: true });
      await expect(link).toBeVisible();
      await link.click();
      await page.waitForLoadState('networkidle');

      // Verify the URL
      await expect(page).toHaveURL(urlPattern);
    }
  });
});
