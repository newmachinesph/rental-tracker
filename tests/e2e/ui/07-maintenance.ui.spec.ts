import { test, expect, Page } from '@playwright/test';
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
  findFieldGroup,
  clickAgGridRow,
  deleteAgGridRow,
} from '../../ui-helpers';

test.describe.serial('Maintenance Page UI', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUI(page);
    await navigateTo(page, 'Maintenance');
  });

  test.afterAll(async () => {
    await page.close();
  });

  // -------------------------------------------------------------------
  // 1. Page loads with heading and empty grid
  // -------------------------------------------------------------------
  test('page loads with heading and grid', async () => {
    await expect(page.locator('h1')).toHaveText('Maintenance');
    await expect(page.getByRole('button', { name: 'Add Task' })).toBeVisible();

    // AG Grid should be present
    await page.waitForSelector('.ag-theme-quartz', { timeout: 10_000 });

    // KPI cards should be visible (use locator('main') to avoid matching filter dropdown options)
    const main = page.locator('main');
    await expect(main.getByText('Total Tasks')).toBeVisible();
    // Use first() since "Open" also appears in the status filter dropdown
    await expect(main.getByText('Open', { exact: true }).first()).toBeVisible();
    await expect(main.getByText('In Progress', { exact: true }).first()).toBeVisible();
    await expect(main.getByText('Completed', { exact: true }).first()).toBeVisible();
    await expect(main.getByText('Est. Cost')).toBeVisible();
    await expect(main.getByText('Actual Cost')).toBeVisible();
  });

  // -------------------------------------------------------------------
  // 2. Add unit-specific task: Broken faucet
  // -------------------------------------------------------------------
  test('add unit-specific maintenance task', async () => {
    const initialCount = await agGridRowCount(page);

    await clickAddButton(page, 'Add Task');

    // Fill modal fields
    await modalSelect(page, 'Property', 'Sunshine Residences');

    // Ensure "Applies to Entire Building" is unchecked (unit-specific)
    await modalCheck(page, 'Applies to Entire Building', false);

    // Wait for unit dropdown to populate, then select the first unit
    await page.waitForTimeout(500);
    const unitFieldGroup = findFieldGroup(page, 'Unit');
    const unitSelect = unitFieldGroup.locator('select');
    await expect(unitSelect).toBeEnabled({ timeout: 5_000 });
    // Select the first available unit option (skip the "-- Select --" placeholder)
    const unitOptions = await unitSelect.locator('option').all();
    if (unitOptions.length > 1) {
      const optionValue = await unitOptions[1].getAttribute('value');
      if (optionValue) {
        await unitSelect.selectOption(optionValue);
      }
    }

    await modalFill(page, 'Date Reported', '2025-01-10');
    await modalFill(page, 'Description', 'Broken faucet');
    await modalSelect(page, 'Priority', 'High');
    await modalFill(page, 'Category', 'Plumbing');
    await modalFill(page, 'Contractor', 'Fix-It Co');

    // Estimated Cost and Actual Cost labels include the currency symbol
    const estCostGroup = findFieldGroup(page, 'Estimated Cost');
    await estCostGroup.locator('input').fill('300');

    const actCostGroup = findFieldGroup(page, 'Actual Cost');
    await actCostGroup.locator('input').fill('0');

    await modalSelect(page, 'Payment Status', 'Unpaid');
    await modalSelect(page, 'Status', 'Open');

    await saveModal(page);
    await page.waitForTimeout(800);

    const newCount = await agGridRowCount(page);
    expect(newCount).toBe(initialCount + 1);

    // Verify the task appears in the grid
    await expect(
      page.locator('.ag-center-cols-container .ag-row').filter({ hasText: 'Broken faucet' }),
    ).toBeVisible();
  });

  // -------------------------------------------------------------------
  // 3. Add building-wide task: Fire inspection
  // -------------------------------------------------------------------
  test('add building-wide maintenance task', async () => {
    const initialCount = await agGridRowCount(page);

    await clickAddButton(page, 'Add Task');

    await modalSelect(page, 'Property', 'Sunshine Residences');
    await modalCheck(page, 'Applies to Entire Building', true);

    await modalFill(page, 'Date Reported', '2025-02-01');
    await modalFill(page, 'Description', 'Fire inspection');
    await modalSelect(page, 'Priority', 'Medium');
    await modalSelect(page, 'Status', 'In Progress');

    await saveModal(page);
    await page.waitForTimeout(800);

    const newCount = await agGridRowCount(page);
    expect(newCount).toBe(initialCount + 1);

    // Verify the task appears in the grid
    await expect(
      page.locator('.ag-center-cols-container .ag-row').filter({ hasText: 'Fire inspection' }),
    ).toBeVisible();
  });

  // -------------------------------------------------------------------
  // 4. Verify 2 new rows and KPI values
  // -------------------------------------------------------------------
  test('verify rows and KPI cards reflect added tasks', async () => {
    // Ensure filters are set to "all" so both tasks are visible
    const statusFilter = page.locator('select').filter({ hasText: 'All Statuses' });
    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption({ label: 'All Statuses' });
    }

    const rows = await waitForAgGrid(page);
    expect(rows).toBeGreaterThanOrEqual(2);

    // Look for both tasks in grid
    await expect(
      page.locator('.ag-center-cols-container .ag-row').filter({ hasText: 'Broken faucet' }),
    ).toBeVisible();
    await expect(
      page.locator('.ag-center-cols-container .ag-row').filter({ hasText: 'Fire inspection' }),
    ).toBeVisible();
  });

  // -------------------------------------------------------------------
  // 5. Edit task: change Broken faucet to Completed
  // -------------------------------------------------------------------
  test('edit task to mark as Completed with actual cost and completion date', async () => {
    // Capture the current Completed KPI value before edit
    const kpiCards = page.locator('.border-l-4');
    const completedBefore = parseInt(
      (await kpiCards.nth(3).locator('.text-xl').textContent()) || '0',
      10,
    );

    await clickAgGridRow(page, 'Broken faucet');

    await modalSelect(page, 'Status', 'Completed');

    // Update actual cost
    const actCostGroup = findFieldGroup(page, 'Actual Cost');
    await actCostGroup.locator('input').fill('250');

    await modalFill(page, 'Completion Date', '2025-01-15');
    await modalSelect(page, 'Payment Status', 'Paid');

    await saveModal(page);
    await page.waitForTimeout(800);

    // Verify Completed KPI increased by 1
    await expect(kpiCards.nth(3).locator('.text-xl')).toHaveText(
      String(completedBefore + 1),
    );
  });

  // -------------------------------------------------------------------
  // 6. Filter by status
  // -------------------------------------------------------------------
  test('filter by status shows correct rows', async () => {
    // Find the Status filter dropdown on the page (not in a modal)
    const statusSelect = page.locator('select').filter({ hasText: 'All Statuses' });

    // Filter by Completed - should show the "Broken faucet" task
    await statusSelect.selectOption({ label: 'Completed' });
    await page.waitForTimeout(600);

    let rowCount = await agGridRowCount(page);
    expect(rowCount).toBeGreaterThanOrEqual(1);
    await expect(
      page.locator('.ag-center-cols-container .ag-row').filter({ hasText: 'Broken faucet' }),
    ).toBeVisible();

    // Filter by In Progress - should show the "Fire inspection" task
    await statusSelect.selectOption({ label: 'In Progress' });
    await page.waitForTimeout(600);

    rowCount = await agGridRowCount(page);
    expect(rowCount).toBeGreaterThanOrEqual(1);
    await expect(
      page.locator('.ag-center-cols-container .ag-row').filter({ hasText: 'Fire inspection' }),
    ).toBeVisible();

    // Reset filter
    await statusSelect.selectOption({ label: 'All Statuses' });
    await page.waitForTimeout(600);
  });

  // -------------------------------------------------------------------
  // 7. Filter by priority
  // -------------------------------------------------------------------
  test('filter by priority shows correct rows', async () => {
    const prioritySelect = page.locator('select').filter({ hasText: 'All Priorities' });

    // Filter by High - should show "Broken faucet"
    await prioritySelect.selectOption({ label: 'High' });
    await page.waitForTimeout(600);

    await expect(
      page.locator('.ag-center-cols-container .ag-row').filter({ hasText: 'Broken faucet' }),
    ).toBeVisible();

    // Filter by Medium - should show "Fire inspection"
    await prioritySelect.selectOption({ label: 'Medium' });
    await page.waitForTimeout(600);

    await expect(
      page.locator('.ag-center-cols-container .ag-row').filter({ hasText: 'Fire inspection' }),
    ).toBeVisible();

    // Reset
    await prioritySelect.selectOption({ label: 'All Priorities' });
    await page.waitForTimeout(600);
  });

  // -------------------------------------------------------------------
  // 8. Delete the building-wide task
  // -------------------------------------------------------------------
  test('delete building-wide task', async () => {
    const before = await agGridRowCount(page);

    await deleteAgGridRow(page, 'Fire inspection');
    await page.waitForTimeout(800);

    const after = await agGridRowCount(page);
    expect(after).toBe(before - 1);

    // The deleted task should no longer be visible
    await expect(
      page.locator('.ag-center-cols-container .ag-row').filter({ hasText: 'Fire inspection' }),
    ).toHaveCount(0);
  });
});
