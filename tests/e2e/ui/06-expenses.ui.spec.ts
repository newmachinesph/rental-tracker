import { test, expect, type Page } from '@playwright/test';
import {
  loginViaUI,
  navigateTo,
  waitForAgGrid,
  agGridRowCount,
  goToGridLastPage,
  clickAddButton,
  modal,
  saveModal,
  modalSelect,
  modalFill,
  modalCheck,
  modalAutoValue,
  findFieldGroup,
  clickAgGridRow,
  deleteAgGridRow,
} from '../../ui-helpers';

test.describe.serial('Expenses Page UI', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUI(page);
    await navigateTo(page, 'Expenses');
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ── 1. Page loads with heading and grid ──────────────────────────────
  test('page loads with heading and grid', async () => {
    await expect(page.getByRole('heading', { name: 'Expenses' })).toBeVisible();
    await waitForAgGrid(page);
    // Grid may have pre-existing data — just verify it loads
    const rows = await agGridRowCount(page);
    expect(rows).toBeGreaterThanOrEqual(0);
  });

  // ── 2. Add unit-specific expense ───────────────────────────────────
  test('add unit-specific expense for maintenance', async () => {
    await clickAddButton(page, 'Add Expense');

    await modalFill(page, 'Date', '2025-04-15');
    await modalSelect(page, 'Property', 'Sunshine Residences');
    await page.waitForTimeout(300);

    await modalCheck(page, 'Applies to Entire Building', false);

    const unitSelect = findFieldGroup(page, 'Unit').locator('select');
    const unitOptions = await unitSelect.locator('option').allTextContents();
    const firstUnit = unitOptions.find((o) => o !== '-- Select --');
    expect(firstUnit).toBeTruthy();
    await unitSelect.selectOption({ label: firstUnit! });

    await modalSelect(page, 'Category', 'Maintenance');
    await modalFill(page, 'Amount', '500');
    await modalFill(page, 'Additional Fees', '50');
    await page.waitForTimeout(200);

    const totalText = await modalAutoValue(page, 'Total');
    expect(totalText).toContain('550');

    await saveModal(page);
    await page.waitForTimeout(500);

    // Navigate to last page where newly added records appear
    await goToGridLastPage(page);
    // Verify the expense appears in grid (use unique date)
    const grid = page.locator('.ag-center-cols-container');
    await expect(grid.locator('.ag-row').filter({ hasText: '2025-04-15' })).toBeVisible();
  });

  // ── 3. Add building-wide expense ───────────────────────────────────
  test('add building-wide expense for insurance', async () => {
    await clickAddButton(page, 'Add Expense');

    await modalFill(page, 'Date', '2025-04-20');
    await modalSelect(page, 'Property', 'Sunshine Residences');
    await page.waitForTimeout(300);

    await modalCheck(page, 'Applies to Entire Building', true);
    await page.waitForTimeout(200);

    const unitSelect = findFieldGroup(page, 'Unit').locator('select');
    await expect(unitSelect).toBeDisabled();

    await modalSelect(page, 'Category', 'Insurance');
    await modalFill(page, 'Amount', '2000');
    await modalFill(page, 'Additional Fees', '0');
    await page.waitForTimeout(200);

    const totalText = await modalAutoValue(page, 'Total');
    expect(totalText).toContain('2,000');

    await saveModal(page);
    await page.waitForTimeout(500);
  });

  // ── 4. Verify both expenses in grid ─────────────────────────────────
  test('grid shows 2 expense rows', async () => {
    await goToGridLastPage(page);
    const grid = page.locator('.ag-center-cols-container');
    await expect(grid.locator('.ag-row').filter({ hasText: '2025-04-15' })).toBeVisible();
    await expect(grid.locator('.ag-row').filter({ hasText: '2025-04-20' })).toBeVisible();
  });

  // ── 5. Edit expense by clicking row ────────────────────────────────
  test('edit maintenance expense and change amount', async () => {
    await goToGridLastPage(page);
    await clickAgGridRow(page, '2025-04-15');

    await modalFill(page, 'Amount', '750');
    await page.waitForTimeout(200);

    const totalText = await modalAutoValue(page, 'Total');
    expect(totalText).toContain('800');

    await saveModal(page);
    await page.waitForTimeout(500);

    // Verify the row still exists after edit
    const grid = page.locator('.ag-center-cols-container');
    await expect(grid.locator('.ag-row').filter({ hasText: '2025-04-15' })).toBeVisible();
  });

  // ── 6. Filter by property ──────────────────────────────────────────
  test('filter by property works', async () => {
    const propertyFilter = page.locator('select').filter({ hasText: 'All Properties' });

    // Filter to "Maplewood Townhomes" — our test expenses are at Sunshine Residences
    await propertyFilter.selectOption({ label: 'Maplewood Townhomes' });
    await page.waitForTimeout(400);

    // Our test-created expense records (dates 2025-04-15, 2025-04-20) should not be visible
    const grid = page.locator('.ag-center-cols-container');
    await expect(grid.locator('.ag-row').filter({ hasText: '2025-04-15' })).toHaveCount(0);

    // Reset to all
    await propertyFilter.selectOption({ label: 'All Properties' });
    await page.waitForTimeout(400);

    // Navigate to last page to verify our expenses are back
    await goToGridLastPage(page);
    await expect(grid.locator('.ag-row').filter({ hasText: '2025-04-15' })).toBeVisible();
  });

  // ── 7. Delete the building-wide expense ────────────────────────────
  test('delete the building-wide insurance expense', async () => {
    await goToGridLastPage(page);
    await deleteAgGridRow(page, '2025-04-20');
    await page.waitForTimeout(500);

    // Navigate to last page and verify deleted record is gone and other remains
    await goToGridLastPage(page);
    const grid = page.locator('.ag-center-cols-container');
    await expect(grid.locator('.ag-row').filter({ hasText: '2025-04-20' })).toHaveCount(0);
    await expect(grid.locator('.ag-row').filter({ hasText: '2025-04-15' })).toBeVisible();
  });
});
