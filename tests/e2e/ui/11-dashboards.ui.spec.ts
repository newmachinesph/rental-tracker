import { test, expect, Page } from '@playwright/test';
import { loginViaUI } from '../../ui-helpers';

test.describe.serial('Dashboard Pages UI', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUI(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // -------------------------------------------------------------------
  // Helper: visit a dashboard page and assert it renders without error
  // -------------------------------------------------------------------
  async function assertDashboardLoads(path: string) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');

    // The page body should have visible content (not a blank page)
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Should not contain common error text
    const mainText = await page.locator('main').textContent();
    expect(mainText).not.toContain('Application error');
    expect(mainText).not.toContain('Internal Server Error');
    expect(mainText).not.toContain('This page could not be found');
  }

  // -------------------------------------------------------------------
  // 1. Property Dashboard
  // -------------------------------------------------------------------
  test('Property dashboard renders without errors', async () => {
    await assertDashboardLoads('/dashboards/property');
    await expect(page).toHaveURL(/\/dashboards\/property/);
  });

  // -------------------------------------------------------------------
  // 2. Unit Dashboard
  // -------------------------------------------------------------------
  test('Unit dashboard renders without errors', async () => {
    await assertDashboardLoads('/dashboards/unit');
    await expect(page).toHaveURL(/\/dashboards\/unit/);
  });

  // -------------------------------------------------------------------
  // 3. Monthly Dashboard
  // -------------------------------------------------------------------
  test('Monthly dashboard renders without errors', async () => {
    await assertDashboardLoads('/dashboards/monthly');
    await expect(page).toHaveURL(/\/dashboards\/monthly/);
  });

  // -------------------------------------------------------------------
  // 4. Annual Dashboard
  // -------------------------------------------------------------------
  test('Annual dashboard renders without errors', async () => {
    await assertDashboardLoads('/dashboards/annual');
    await expect(page).toHaveURL(/\/dashboards\/annual/);
  });

  // -------------------------------------------------------------------
  // 5. Five-Year Dashboard
  // -------------------------------------------------------------------
  test('Five-Year dashboard renders without errors', async () => {
    await assertDashboardLoads('/dashboards/five-year');
    await expect(page).toHaveURL(/\/dashboards\/five-year/);
  });

  // -------------------------------------------------------------------
  // 6. Custom Dashboard
  // -------------------------------------------------------------------
  test('Custom dashboard renders without errors', async () => {
    await assertDashboardLoads('/dashboards/custom');
    await expect(page).toHaveURL(/\/dashboards\/custom/);
  });

  // -------------------------------------------------------------------
  // 7. Comparison Dashboard
  // -------------------------------------------------------------------
  test('Comparison dashboard renders without errors', async () => {
    await assertDashboardLoads('/dashboards/comparison');
    await expect(page).toHaveURL(/\/dashboards\/comparison/);
  });
});
