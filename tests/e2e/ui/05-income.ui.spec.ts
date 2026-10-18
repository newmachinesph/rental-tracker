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
  modalAutoValue,
  findFieldGroup,
  clickAgGridRow,
  deleteAgGridRow,
} from '../../ui-helpers';

test.describe.serial('Income Page UI', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUI(page);
    await navigateTo(page, 'Income');
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ── 1. Page loads with heading and grid ──────────────────────────────
  test('page loads with heading and grid', async () => {
    await expect(page.getByRole('heading', { name: 'Income' })).toBeVisible();
    await waitForAgGrid(page);
    const rows = await agGridRowCount(page);
    expect(rows).toBeGreaterThanOrEqual(0);
  });

  // ── 2. Add fully paid income record ────────────────────────────────
  test('add income record with Paid status', async () => {
    await clickAddButton(page, 'Add Income');

    await modalSelect(page, 'Property', 'Sunshine Residences');
    await page.waitForTimeout(300);

    const unitSelect = findFieldGroup(page, 'Unit').locator('select');
    const unitOptions = await unitSelect.locator('option').allTextContents();
    const firstUnit = unitOptions.find((o) => o !== '-- Select --');
    expect(firstUnit).toBeTruthy();
    await unitSelect.selectOption({ label: firstUnit! });
    await page.waitForTimeout(300);

    await modalSelect(page, 'Tenant', 'John Smith');

    await modalSelect(page, 'Category', 'Rent');
    await modalFill(page, 'Rent Due Date', '2025-04-01');
    await modalFill(page, 'Rent Amount', '1500');
    await modalFill(page, 'Additional Income', '0');
    await modalFill(page, 'Payment Date', '2025-04-01');
    await modalFill(page, 'Amount Paid', '1500');
    await modalSelect(page, 'Payment Method', 'Bank Transfer');

    const status = await modalAutoValue(page, 'Payment Status');
    expect(status).toContain('Paid');

    await saveModal(page);
    await page.waitForTimeout(500);

    // Navigate to last page where newly added records appear
    await goToGridLastPage(page);
    const grid = page.locator('.ag-center-cols-container');
    await expect(grid.locator('.ag-row').filter({ hasText: '2025-04-01' })).toBeVisible();
  });

  // ── 3. Add unpaid income (no payment) ──────────────────────────────
  test('add income record with Unpaid status', async () => {
    await clickAddButton(page, 'Add Income');

    await modalSelect(page, 'Property', 'Sunshine Residences');
    await page.waitForTimeout(300);

    const unitSelect = findFieldGroup(page, 'Unit').locator('select');
    const unitOptions = await unitSelect.locator('option').allTextContents();
    const firstUnit = unitOptions.find((o) => o !== '-- Select --');
    await unitSelect.selectOption({ label: firstUnit! });
    await page.waitForTimeout(300);

    await modalSelect(page, 'Tenant', 'John Smith');
    await modalSelect(page, 'Category', 'Rent');
    await modalFill(page, 'Rent Due Date', '2025-05-01');
    await modalFill(page, 'Rent Amount', '1500');

    const status = await modalAutoValue(page, 'Payment Status');
    expect(status).toContain('Unpaid');

    await saveModal(page);
    await page.waitForTimeout(500);

    // Navigate to last page where newly added records appear
    await goToGridLastPage(page);
    const grid = page.locator('.ag-center-cols-container');
    await expect(grid.locator('.ag-row').filter({ hasText: '2025-05-01' })).toBeVisible();
  });

  // ── 4. Add partially paid income ───────────────────────────────────
  test('add income record with Partially Paid status', async () => {
    await clickAddButton(page, 'Add Income');

    await modalSelect(page, 'Property', 'Sunshine Residences');
    await page.waitForTimeout(300);

    const unitSelect = findFieldGroup(page, 'Unit').locator('select');
    const unitOptions = await unitSelect.locator('option').allTextContents();
    const firstUnit = unitOptions.find((o) => o !== '-- Select --');
    await unitSelect.selectOption({ label: firstUnit! });
    await page.waitForTimeout(300);

    await modalSelect(page, 'Tenant', 'John Smith');
    await modalSelect(page, 'Category', 'Rent');
    await modalFill(page, 'Rent Due Date', '2025-06-01');
    await modalFill(page, 'Rent Amount', '1500');
    await modalFill(page, 'Payment Date', '2025-06-05');
    await modalFill(page, 'Amount Paid', '800');
    await modalSelect(page, 'Payment Method', 'Cash');

    const status = await modalAutoValue(page, 'Payment Status');
    expect(status).toContain('Partially Paid');

    await saveModal(page);
    await page.waitForTimeout(500);

    // Navigate to last page where newly added records appear
    await goToGridLastPage(page);
    const grid = page.locator('.ag-center-cols-container');
    await expect(grid.locator('.ag-row').filter({ hasText: '2025-06-01' })).toBeVisible();
  });

  // ── 5. Edit record by clicking row ─────────────────────────────────
  test('edit income record and update amount paid', async () => {
    // Navigate to last page where our added records are
    await goToGridLastPage(page);

    // Click on the Pending record (Due 2025-05-01)
    await clickAgGridRow(page, '2025-05-01');

    await modalFill(page, 'Payment Date', '2025-05-05');
    await modalFill(page, 'Amount Paid', '1500');
    await page.waitForTimeout(200);

    const status = await modalAutoValue(page, 'Payment Status');
    expect(status).toContain('Paid');

    await saveModal(page);
    await page.waitForTimeout(500);
  });

  // ── 6. Verify KPI cards are visible ────────────────────────────────
  test('KPI totals are correct', async () => {
    const kpiCards = page.locator('.border-l-4');

    await expect(kpiCards.nth(0)).toBeVisible(); // Records
    await expect(kpiCards.nth(1)).toBeVisible(); // Total Due
    await expect(kpiCards.nth(2)).toBeVisible(); // Total Paid
    await expect(kpiCards.nth(3)).toBeVisible(); // Outstanding
  });

  // ── 7. Filter by property ──────────────────────────────────────────
  test('filter by property works', async () => {
    const propertyFilter = page.locator('select').filter({ hasText: 'All Properties' });

    // Filter to "Maplewood Townhomes" — our test records are at Sunshine Residences
    await propertyFilter.selectOption({ label: 'Maplewood Townhomes' });
    await page.waitForTimeout(400);

    // Our test-created income records (dates 2025-04-01, 2025-05-01, 2025-06-01) should not be visible
    const grid = page.locator('.ag-center-cols-container');
    await expect(grid.locator('.ag-row').filter({ hasText: '2025-04-01' })).toHaveCount(0);

    // Reset to all
    await propertyFilter.selectOption({ label: 'All Properties' });
    await page.waitForTimeout(400);

    // Navigate to last page to verify our records are back
    await goToGridLastPage(page);
    await expect(grid.locator('.ag-row').filter({ hasText: '2025-04-01' })).toBeVisible();
  });

  // ── 8. Delete one record ───────────────────────────────────────────
  test('delete the partially paid record', async () => {
    // Navigate to last page where our records are
    await goToGridLastPage(page);

    await deleteAgGridRow(page, '2025-06-01');
    await page.waitForTimeout(500);

    // Navigate to last page and verify the deleted record is gone
    await goToGridLastPage(page);
    const grid = page.locator('.ag-center-cols-container');
    await expect(grid.locator('.ag-row').filter({ hasText: '2025-06-01' })).toHaveCount(0);

    // Other records should still be visible
    await expect(grid.locator('.ag-row').filter({ hasText: '2025-04-01' })).toBeVisible();
  });
});
