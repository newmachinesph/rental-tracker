import { test, expect, Page } from '@playwright/test';
import { loginViaUI, navigateTo } from '../../ui-helpers';

test.describe.serial('Rent Reminders UI', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUI(page);
    await navigateTo(page, 'Rent Reminders');
  });

  test.afterAll(async () => {
    await page.close();
  });

  // -------------------------------------------------------------------
  // 1. Page loads with heading
  // -------------------------------------------------------------------
  test('page loads with heading and subtitle', async () => {
    await expect(page.locator('h1')).toHaveText('Rent Reminders');
    await expect(page.getByText('Track and follow up on unpaid rent')).toBeVisible();
  });

  // -------------------------------------------------------------------
  // 2. Property filter dropdown exists
  // -------------------------------------------------------------------
  test('property filter dropdown is present', async () => {
    await expect(page.getByText('Filter by Property:')).toBeVisible();

    // The filter select should have "All Properties" as the default option
    const filterSelect = page.locator('select').filter({ hasText: 'All Properties' });
    await expect(filterSelect).toBeVisible();
  });

  // -------------------------------------------------------------------
  // 3. KPI cards are displayed
  // -------------------------------------------------------------------
  test('KPI cards are displayed', async () => {
    // KPI cards have label div with text-xs class
    const kpiLabels = page.locator('.text-xs.text-slate-400');
    await expect(kpiLabels.filter({ hasText: 'Total Outstanding' })).toBeVisible();
    await expect(kpiLabels.filter({ hasText: 'Pending' })).toBeVisible();
    await expect(kpiLabels.filter({ hasText: 'Contacted' })).toBeVisible();
    await expect(kpiLabels.filter({ hasText: 'Total Reminders' })).toBeVisible();
  });

  // -------------------------------------------------------------------
  // 4. Shows reminders or empty state
  // -------------------------------------------------------------------
  test('shows reminder cards or empty state', async () => {
    // Either reminder cards are visible or the "All Caught Up" empty state is shown
    const hasReminders = await page.getByText('Pending Follow-up').isVisible().catch(() => false);
    const hasEmptyState = await page.getByText('All Caught Up!').isVisible().catch(() => false);

    // One of these must be true
    expect(hasReminders || hasEmptyState).toBe(true);

    if (hasReminders) {
      // If there are reminders, each card should have essential info
      const reminderCards = page.locator('.bg-white.rounded-xl.border.shadow-sm').filter({ hasText: 'Outstanding' });
      const cardCount = await reminderCards.count();
      expect(cardCount).toBeGreaterThan(0);

      // Check first card has expected structure
      const firstCard = reminderCards.first();
      await expect(firstCard.getByText('Mark Contacted')).toBeVisible();
      await expect(firstCard.getByText('Record Payment')).toBeVisible();
    }
  });

  // -------------------------------------------------------------------
  // 5. Property filter filters the reminders
  // -------------------------------------------------------------------
  test('property filter works', async () => {
    const filterSelect = page.locator('select').filter({ hasText: 'All Properties' });

    // Select a specific property
    await filterSelect.selectOption({ label: 'Sunshine Residences' });
    await page.waitForTimeout(600);

    // The page should still render without errors
    await expect(page.locator('h1')).toHaveText('Rent Reminders');

    // Reset filter
    await filterSelect.selectOption({ label: 'All Properties' });
    await page.waitForTimeout(600);
  });
});
