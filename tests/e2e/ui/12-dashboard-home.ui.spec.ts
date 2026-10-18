import { test, expect, Page } from '@playwright/test';
import { loginViaUI } from '../../ui-helpers';

test.describe.serial('Home Dashboard UI', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUI(page);
    // loginViaUI already waits for redirect to /
  });

  test.afterAll(async () => {
    await page.close();
  });

  // -------------------------------------------------------------------
  // 1. Renders time-aware welcome greeting
  // -------------------------------------------------------------------
  test('renders welcome greeting', async () => {
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();

    const text = await heading.textContent();
    expect(text).toBeTruthy();

    // The greeting should start with one of the time-based greetings
    expect(text).toMatch(/Good (morning|afternoon|evening)/);
  });

  // -------------------------------------------------------------------
  // 2. KPI cards are visible
  // -------------------------------------------------------------------
  test('KPI cards are visible with correct titles', async () => {
    const kpiTitles = ['Total Income', 'Total Expenses', 'Net Profit', 'Occupancy Rate'];

    for (const title of kpiTitles) {
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
    }
  });

  // -------------------------------------------------------------------
  // 3. Revenue Overview section exists
  // -------------------------------------------------------------------
  test('Revenue Overview section is present', async () => {
    await expect(page.getByText('Revenue Overview')).toBeVisible();
    await expect(page.getByText('Monthly income trend')).toBeVisible();
  });

  // -------------------------------------------------------------------
  // 4. Quick Actions section with 6 buttons
  // -------------------------------------------------------------------
  test('Quick Actions section has 6 action buttons', async () => {
    const main = page.locator('main');
    await expect(main.getByText('Quick Actions')).toBeVisible();

    const expectedActions = [
      'Add Income',
      'Add Expense',
      'New Lease',
      'Maintenance',
      'Reports',
      'Settings',
    ];

    for (const action of expectedActions) {
      await expect(
        main.getByRole('link', { name: action, exact: true }),
      ).toBeVisible();
    }
  });

  // -------------------------------------------------------------------
  // 5. Recent Activity section exists
  // -------------------------------------------------------------------
  test('Recent Activity section is present', async () => {
    await expect(page.getByText('Recent Activity')).toBeVisible();
  });

  // -------------------------------------------------------------------
  // 6. Properties Overview section shows property cards
  // -------------------------------------------------------------------
  test('Properties Overview section shows property cards', async () => {
    await expect(page.getByText('Properties Overview')).toBeVisible();

    // At least one property card should be visible (we have 2 prerequisite properties)
    // Property cards contain the property name
    await expect(page.getByText('Sunshine Residences').first()).toBeVisible();
  });

  // -------------------------------------------------------------------
  // 7. Top Properties by Revenue section exists
  // -------------------------------------------------------------------
  test('Top Properties by Revenue section is present', async () => {
    await expect(page.getByText('Top Properties by Revenue')).toBeVisible();
    await expect(page.getByText('All-time collected income')).toBeVisible();
  });

  // -------------------------------------------------------------------
  // 8. View Reports button navigates to /dashboards/property
  // -------------------------------------------------------------------
  test('View Reports button navigates to property dashboard', async () => {
    const viewReportsLink = page.getByRole('link', { name: 'View Reports' });
    await expect(viewReportsLink).toBeVisible();
    await viewReportsLink.click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/dashboards\/property/);
  });
});
