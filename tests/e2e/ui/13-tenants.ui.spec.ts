import { test, expect, Page } from '@playwright/test';
import {
  loginViaUI,
  navigateTo,
  waitForAgGrid,
  agGridRowCount,
  clickAddButton,
  modal,
  modalFill,
  clickAgGridRow,
  deleteAgGridRow,
  goToGridLastPage,
  goToGridFirstPage,
} from '../../ui-helpers';

test.describe.serial('Tenants Page UI', () => {
  let page: Page;
  let initialRowCount: number;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUI(page);
    await navigateTo(page, 'Tenants');
  });

  test.afterAll(async () => {
    await page.close();
  });

  // -------------------------------------------------------------------
  // 1. Page loads with heading, grid, and KPI cards
  // -------------------------------------------------------------------
  test('page loads with heading, grid, and KPI cards', async () => {
    await expect(page.getByRole('heading', { name: 'Tenants' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Tenant' })).toBeVisible();

    initialRowCount = await waitForAgGrid(page);
    expect(initialRowCount).toBeGreaterThanOrEqual(0);

    // KPI cards visible
    await expect(page.getByText('Total Tenants')).toBeVisible();
    await expect(page.getByText('Active Tenants')).toBeVisible();
    await expect(page.getByText('Without Leases')).toBeVisible();
  });

  // -------------------------------------------------------------------
  // 2. Add a new tenant "Alice Test"
  // -------------------------------------------------------------------
  test('add tenant Alice Test', async () => {
    await clickAddButton(page, 'Add Tenant');
    await modalFill(page, 'Full Name', 'Alice Test');
    await modalFill(page, 'Phone Number', '555-9001');
    await modalFill(page, 'Email Address', 'alice@test.com');
    await modal(page).getByRole('button', { name: 'Add Tenant' }).click();
    await page.waitForSelector('.fixed.inset-0.z-\\[100\\]', { state: 'detached', timeout: 10_000 });
    await page.waitForTimeout(500);

    await goToGridLastPage(page);
    const rows = await agGridRowCount(page);
    expect(rows).toBeGreaterThan(0);

    const grid = page.locator('.ag-center-cols-container');
    await expect(grid.locator('.ag-row').filter({ hasText: 'Alice Test' })).toBeVisible();
  });

  // -------------------------------------------------------------------
  // 3. Add a second tenant "Bob Test" (without email)
  // -------------------------------------------------------------------
  test('add tenant Bob Test without email', async () => {
    await clickAddButton(page, 'Add Tenant');
    await modalFill(page, 'Full Name', 'Bob Test');
    await modalFill(page, 'Phone Number', '555-9002');
    await modal(page).getByRole('button', { name: 'Add Tenant' }).click();
    await page.waitForSelector('.fixed.inset-0.z-\\[100\\]', { state: 'detached', timeout: 10_000 });
    await page.waitForTimeout(500);

    await goToGridLastPage(page);
    const grid = page.locator('.ag-center-cols-container');
    await expect(grid.locator('.ag-row').filter({ hasText: 'Bob Test' })).toBeVisible();
  });

  // -------------------------------------------------------------------
  // 4. KPI cards reflect updated totals
  // -------------------------------------------------------------------
  test('KPI cards show updated counts', async () => {
    // Without Leases should include both new tenants (they have no leases)
    const withoutLeasesCard = page.locator('.border-l-amber-500');
    const withoutCount = await withoutLeasesCard.locator('.text-xl').textContent();
    expect(parseInt(withoutCount ?? '0')).toBeGreaterThanOrEqual(2);
  });

  // -------------------------------------------------------------------
  // 5. Edit tenant by clicking row - change phone number
  // -------------------------------------------------------------------
  test('edit Alice Test phone via row click', async () => {
    await goToGridLastPage(page);
    await clickAgGridRow(page, 'Alice Test');

    // Modal should show "Edit Tenant" title
    await expect(modal(page).getByText('Edit Tenant')).toBeVisible();

    await modalFill(page, 'Phone Number', '555-9099');
    await modal(page).getByRole('button', { name: 'Update Tenant' }).click();
    await page.waitForSelector('.fixed.inset-0.z-\\[100\\]', { state: 'detached', timeout: 10_000 });
    await page.waitForTimeout(500);

    // Verify updated phone in grid
    await goToGridLastPage(page);
    const grid = page.locator('.ag-center-cols-container');
    const row = grid.locator('.ag-row').filter({ hasText: 'Alice Test' });
    await expect(row).toContainText('555-9099');
  });

  // -------------------------------------------------------------------
  // 6. Filter by property
  // -------------------------------------------------------------------
  test('filter by property works', async () => {
    const propertyFilter = page.locator('select').filter({ hasText: 'All Properties' });

    // Get first property option (requires seeded properties from 00-scenarios)
    const options = await propertyFilter.locator('option').allTextContents();
    const firstProperty = options.find((o) => o !== 'All Properties');

    // Skip filter interaction if no properties available (only admin seed present)
    if (!firstProperty) {
      test.skip();
      return;
    }

    // Filter by specific property - new tenants without leases should disappear
    await propertyFilter.selectOption({ label: firstProperty });
    await page.waitForTimeout(500);

    const grid = page.locator('.ag-center-cols-container');
    // Alice Test and Bob Test have no leases, should not appear
    await expect(grid.locator('.ag-row').filter({ hasText: 'Alice Test' })).toHaveCount(0);
    await expect(grid.locator('.ag-row').filter({ hasText: 'Bob Test' })).toHaveCount(0);

    // Reset filter
    await propertyFilter.selectOption({ label: 'All Properties' });
    await page.waitForTimeout(500);

    // They should reappear
    await goToGridLastPage(page);
    await expect(grid.locator('.ag-row').filter({ hasText: 'Alice Test' })).toBeVisible();
    await expect(grid.locator('.ag-row').filter({ hasText: 'Bob Test' })).toBeVisible();
  });

  // -------------------------------------------------------------------
  // 7. Cannot delete tenant with leases (shows warning)
  // -------------------------------------------------------------------
  test('cannot delete tenant with leases (shows warning)', async () => {
    await goToGridFirstPage(page);
    const totalRows = await agGridRowCount(page);

    // Need at least 3 rows (2 test tenants + at least 1 seeded tenant with leases)
    // If only test tenants exist (isolated run), skip this test
    if (totalRows <= 2) {
      test.skip();
      return;
    }

    // Set up dialog listener before the action — alert fires when clicking "Delete" in confirmation modal
    let dialogMessage = '';
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    const before = totalRows;

    // The first row should be a seeded tenant with leases
    const firstRow = page.locator('.ag-center-cols-container .ag-row').first();
    const rowIndex = await firstRow.getAttribute('row-index');

    // Scroll to action column and click trash button
    const scrollViewport = page.locator('.ag-body-horizontal-scroll-viewport');
    await scrollViewport.evaluate(el => el.scrollLeft = el.scrollWidth);
    await page.waitForTimeout(400);

    const rowAfterScroll = page.locator(`.ag-center-cols-container .ag-row[row-index="${rowIndex}"]`);
    await rowAfterScroll.locator('button[title="Remove"]').click();

    // Confirmation modal opens — click "Delete" to trigger handleDelete which calls alert()
    const confirmModal = page.locator('.fixed.inset-0.z-\\[100\\]');
    await confirmModal.waitFor({ state: 'visible', timeout: 5_000 });
    await confirmModal.getByRole('button', { name: 'Delete' }).click();
    await page.waitForTimeout(500);

    // Scroll back
    await scrollViewport.evaluate(el => el.scrollLeft = 0);
    await page.waitForTimeout(200);

    expect(dialogMessage).toContain('Cannot delete tenant');

    // Confirmation modal should be closed now (setDeleteConfirmId(null) runs after alert)
    // Close any lingering modal just in case
    const modalEl = page.locator('.fixed.inset-0.z-\\[100\\]');
    if (await modalEl.isVisible({ timeout: 500 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForSelector('.fixed.inset-0.z-\\[100\\]', { state: 'detached', timeout: 5_000 });
    }

    const after = await agGridRowCount(page);
    expect(after).toBe(before);

    // Clean up dialog listener
    page.removeAllListeners('dialog');
  });

  // -------------------------------------------------------------------
  // 8. Delete Bob Test (no leases)
  // -------------------------------------------------------------------
  test('delete Bob Test', async () => {
    // Dismiss any lingering modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await goToGridLastPage(page);
    await deleteAgGridRow(page, 'Bob Test');
    await page.waitForTimeout(500);

    // Dismiss edit modal if it opened from row click side-effect
    if (await page.locator('.fixed.inset-0.z-\\[100\\]').isVisible({ timeout: 500 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForSelector('.fixed.inset-0.z-\\[100\\]', { state: 'detached', timeout: 5_000 });
    }

    await goToGridLastPage(page);
    const grid = page.locator('.ag-center-cols-container');
    await expect(grid.locator('.ag-row').filter({ hasText: 'Bob Test' })).toHaveCount(0);
  });

  // -------------------------------------------------------------------
  // 9. Delete Alice Test for cleanup
  // -------------------------------------------------------------------
  test('delete Alice Test', async () => {
    // Dismiss any lingering modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    await goToGridLastPage(page);
    await deleteAgGridRow(page, 'Alice Test');
    await page.waitForTimeout(500);

    // Dismiss edit modal if it opened from row click side-effect
    if (await page.locator('.fixed.inset-0.z-\\[100\\]').isVisible({ timeout: 500 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForSelector('.fixed.inset-0.z-\\[100\\]', { state: 'detached', timeout: 5_000 });
    }

    await goToGridLastPage(page);
    const grid = page.locator('.ag-center-cols-container');
    await expect(grid.locator('.ag-row').filter({ hasText: 'Alice Test' })).toHaveCount(0);
  });
});
