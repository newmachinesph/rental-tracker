import { test, expect, Page } from '@playwright/test';
import { loginViaUI, navigateTo } from '../../ui-helpers';

test.describe.serial('Tenant Ledger UI', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUI(page);
    await navigateTo(page, 'Tenant Ledger');
  });

  test.afterAll(async () => {
    await page.close();
  });

  // -------------------------------------------------------------------
  // 1. Page loads with heading and cascading dropdowns
  // -------------------------------------------------------------------
  test('page loads with heading and selection dropdowns', async () => {
    await expect(page.locator('h1')).toHaveText('Tenant Ledger');

    // "Show current tenants only" checkbox should be visible and checked by default
    const checkbox = page.locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    await expect(checkbox).toBeChecked();

    // Property, Unit, Tenant dropdowns should be present
    await expect(page.getByText('Property', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Unit', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Tenant', { exact: true }).first()).toBeVisible();

    // Empty state should be shown initially
    await expect(page.getByText('No Tenant Selected')).toBeVisible();
  });

  // -------------------------------------------------------------------
  // 2. Selecting a property enables the unit dropdown
  // -------------------------------------------------------------------
  test('selecting property enables unit dropdown', async () => {
    // Unit dropdown should be disabled before property is selected
    const selectionArea = page.locator('.bg-gradient-to-r.from-amber-50');
    const selects = selectionArea.locator('select');

    // Property dropdown (first select in the grid)
    const propertySelect = selects.nth(0);
    // Unit dropdown (second select)
    const unitSelect = selects.nth(1);
    // Tenant dropdown (third select)
    const tenantSelect = selects.nth(2);

    // Unit and tenant should be disabled initially
    await expect(unitSelect).toBeDisabled();
    await expect(tenantSelect).toBeDisabled();

    // Select Sunshine Residences
    await propertySelect.selectOption({ label: 'Sunshine Residences' });
    await page.waitForTimeout(500);

    // Unit dropdown should now be enabled
    await expect(unitSelect).toBeEnabled();
    // Tenant should still be disabled (no unit selected yet)
    await expect(tenantSelect).toBeDisabled();
  });

  // -------------------------------------------------------------------
  // 3. Selecting a unit enables the tenant dropdown
  // -------------------------------------------------------------------
  test('selecting unit enables tenant dropdown', async () => {
    const selectionArea = page.locator('.bg-gradient-to-r.from-amber-50');
    const selects = selectionArea.locator('select');

    const unitSelect = selects.nth(1);
    const tenantSelect = selects.nth(2);

    // Select the first available unit
    const unitOptions = await unitSelect.locator('option').all();
    if (unitOptions.length > 1) {
      const optionValue = await unitOptions[1].getAttribute('value');
      if (optionValue) {
        await unitSelect.selectOption(optionValue);
      }
    }
    await page.waitForTimeout(500);

    // Tenant dropdown should now be enabled
    await expect(tenantSelect).toBeEnabled();
  });

  // -------------------------------------------------------------------
  // 4. Selecting a tenant shows payment details
  // -------------------------------------------------------------------
  test('selecting tenant shows payment details and info cards', async () => {
    const selectionArea = page.locator('.bg-gradient-to-r.from-amber-50');
    const selects = selectionArea.locator('select');
    const tenantSelect = selects.nth(2);

    // Select the first available tenant
    const tenantOptions = await tenantSelect.locator('option').all();
    if (tenantOptions.length > 1) {
      const optionValue = await tenantOptions[1].getAttribute('value');
      if (optionValue) {
        await tenantSelect.selectOption(optionValue);
      }
    }
    await page.waitForTimeout(1500);

    // The empty state should disappear
    await expect(page.getByText('No Tenant Selected')).toBeHidden({ timeout: 10_000 });

    // Info cards should be visible
    await expect(page.getByText('Contact Information')).toBeVisible();
    await expect(page.getByText('Lease Information')).toBeVisible();
    await expect(page.getByText('Monthly Rent')).toBeVisible();

    // Payment History heading should be visible
    await expect(page.getByRole('heading', { name: 'Payment History' })).toBeVisible();
  });

  // -------------------------------------------------------------------
  // 5. Changing property resets unit and tenant selections
  // -------------------------------------------------------------------
  test('changing property resets unit and tenant selections', async () => {
    const selectionArea = page.locator('.bg-gradient-to-r.from-amber-50');
    const selects = selectionArea.locator('select');

    const propertySelect = selects.nth(0);
    const unitSelect = selects.nth(1);
    const tenantSelect = selects.nth(2);

    // Change property to Greenfield Villas
    await propertySelect.selectOption({ label: 'Greenfield Villas' });
    await page.waitForTimeout(500);

    // Unit should be reset and still enabled (new property selected)
    await expect(unitSelect).toBeEnabled();
    // Tenant should be disabled again (no unit selected)
    await expect(tenantSelect).toBeDisabled();

    // The empty state should reappear since no tenant is selected
    await expect(page.getByText('No Tenant Selected')).toBeVisible();
  });
});
