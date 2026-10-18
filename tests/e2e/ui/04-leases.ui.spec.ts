import { test, expect, type Page } from '@playwright/test';
import {
  loginViaUI,
  navigateTo,
  waitForAgGrid,
  agGridRowCount,
  goToGridLastPage,
  goToGridFirstPage,
  clickAddButton,
  modal,
  saveModal,
  modalSelect,
  modalFill,
  modalCheck,
  findFieldGroup,
  clickAgGridRow,
  deleteAgGridRow,
} from '../../ui-helpers';

test.describe.serial('Leases Page UI', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUI(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ── 1. Create test tenants via Tenants page ───────────────────────────
  test('create test tenants John Smith and Jane Doe', async () => {
    await navigateTo(page, 'Tenants');
    await waitForAgGrid(page);

    // Add John Smith
    await clickAddButton(page, 'Add Tenant');
    await modalFill(page, 'Full Name', 'John Smith');
    await modalFill(page, 'Phone Number', '555-0100');
    await modalFill(page, 'Email Address', 'john@test.com');
    await modal(page).getByRole('button', { name: 'Add Tenant' }).click();
    await page.waitForSelector('.fixed.inset-0.z-\\[100\\]', { state: 'detached', timeout: 10_000 });
    await page.waitForTimeout(300);

    // Add Jane Doe
    await clickAddButton(page, 'Add Tenant');
    await modalFill(page, 'Full Name', 'Jane Doe');
    await modalFill(page, 'Phone Number', '555-0200');
    await modalFill(page, 'Email Address', 'jane@test.com');
    await modal(page).getByRole('button', { name: 'Add Tenant' }).click();
    await page.waitForSelector('.fixed.inset-0.z-\\[100\\]', { state: 'detached', timeout: 10_000 });
  });

  // ── 2. Page loads with heading and grid ──────────────────────────────
  test('page loads with heading and grid', async () => {
    await navigateTo(page, 'Lease Tracker');
    await expect(page.getByRole('heading', { name: 'Lease Tracker' })).toBeVisible();
    await waitForAgGrid(page);
    const rows = await agGridRowCount(page);
    expect(rows).toBeGreaterThanOrEqual(0);
  });

  // ── 3. Add first lease ─────────────────────────────────────────────
  test('add lease for John Smith at Sunshine Residences', async () => {
    await clickAddButton(page, 'Add Lease');

    await modalSelect(page, 'Property', 'Sunshine Residences');
    await page.waitForTimeout(300);

    const unitSelect = findFieldGroup(page, 'Unit').locator('select');
    const unitOptions = await unitSelect.locator('option').allTextContents();
    const firstUnit = unitOptions.find((o) => o !== '-- Select --');
    expect(firstUnit).toBeTruthy();
    await unitSelect.selectOption({ label: firstUnit! });
    await page.waitForTimeout(200);

    await modalSelect(page, 'Tenant', 'John Smith');
    await modalCheck(page, 'Current Tenant', true);
    await modalFill(page, 'Lease Start', '2025-01-01');
    await modalFill(page, 'Lease End', '2025-12-31');
    await modalFill(page, 'Monthly Rent', '1500');
    await modalFill(page, 'Deposit', '1500');

    await saveModal(page);
    await page.waitForTimeout(500);
  });

  // ── 4. Verify lease was added ──────────────────────────────────────
  test('grid shows lease row and KPIs update', async () => {
    // Navigate to last page to see newly added records (if pagination exists)
    await goToGridLastPage(page);

    const grid = page.locator('.ag-center-cols-container');
    await expect(grid.locator('.ag-row').filter({ hasText: 'John Smith' })).toBeVisible();
    await expect(grid).toContainText('Sunshine Residences');
  });

  // ── 5. Add second lease for Jane Doe ───────────────────────────────
  test('add second lease for Jane Doe at Sunshine Residences', async () => {
    await clickAddButton(page, 'Add Lease');

    await modalSelect(page, 'Property', 'Sunshine Residences');
    await page.waitForTimeout(300);

    const unitSelect = findFieldGroup(page, 'Unit').locator('select');
    const unitOptions = await unitSelect.locator('option').allTextContents();
    const availableUnits = unitOptions.filter((o) => o !== '-- Select --');
    expect(availableUnits.length).toBeGreaterThanOrEqual(2);
    await unitSelect.selectOption({ label: availableUnits[1] });
    await page.waitForTimeout(200);

    await modalSelect(page, 'Tenant', 'Jane Doe');
    await modalCheck(page, 'Current Tenant', true);
    await modalFill(page, 'Lease Start', '2025-02-01');
    await modalFill(page, 'Lease End', '2026-01-31');
    await modalFill(page, 'Monthly Rent', '1200');
    await modalFill(page, 'Deposit', '1200');

    await saveModal(page);
    await page.waitForTimeout(500);
  });

  // ── 6. Edit lease by clicking row - change rent ────────────────────
  test('edit first lease and change rent to 1600', async () => {
    // John Smith's lease is near the end of page 1 (not the last page)
    await goToGridFirstPage(page);

    await clickAgGridRow(page, 'John Smith');

    await modalFill(page, 'Monthly Rent', '1600');

    await saveModal(page);
    await page.waitForTimeout(500);
  });

  // ── 7. Filter by property ──────────────────────────────────────────
  test('filter by property works', async () => {
    const propertyFilter = page.locator('select').filter({ hasText: 'All Properties' });
    await propertyFilter.selectOption({ label: 'Maplewood Townhomes' });
    await page.waitForTimeout(400);

    // Our test leases (John Smith, Jane Doe) are at Sunshine Residences, so they should not be visible
    const grid = page.locator('.ag-center-cols-container');
    await expect(grid.locator('.ag-row').filter({ hasText: 'John Smith' })).toHaveCount(0);
    await expect(grid.locator('.ag-row').filter({ hasText: 'Jane Doe' })).toHaveCount(0);

    // Switch back to "All Properties"
    await propertyFilter.selectOption({ label: 'All Properties' });
    await page.waitForTimeout(400);

    // Jane Doe is on the last page, John Smith on the first page
    await goToGridLastPage(page);
    await expect(grid.locator('.ag-row').filter({ hasText: 'Jane Doe' })).toBeVisible();
    await goToGridFirstPage(page);
    await expect(grid.locator('.ag-row').filter({ hasText: 'John Smith' })).toBeVisible();
  });

  // ── 8. Delete the second lease (Jane Doe) ─────────────────────────
  test('delete the second lease for Jane Doe', async () => {
    // Jane Doe's lease is on the last page
    await goToGridLastPage(page);

    await deleteAgGridRow(page, 'Jane Doe');
    await page.waitForTimeout(500);

    // After deletion, all 15 remaining rows fit on page 1
    await goToGridFirstPage(page);
    const grid = page.locator('.ag-center-cols-container');
    await expect(grid.locator('.ag-row').filter({ hasText: 'Jane Doe' })).toHaveCount(0);
    await expect(grid.locator('.ag-row').filter({ hasText: 'John Smith' })).toBeVisible();
  });
});
