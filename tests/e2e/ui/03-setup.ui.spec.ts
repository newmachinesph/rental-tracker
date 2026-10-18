import { test, expect } from '@playwright/test';
import { loginViaUI } from '../../ui-helpers';

test.describe.serial('Setup Page UI', () => {
  // -------------------------------------------------------------------
  // 1. Page loads with all sections
  // -------------------------------------------------------------------
  test('page loads with all section headings visible', async ({ page }) => {
    await loginViaUI(page);
    await page.goto('/setup');
    await page.waitForLoadState('networkidle');

    // All section cards should exist with their ids
    const sectionIds = [
      'currency',
      'property-types',
      'income-categories',
      'expense-categories',
      'payment-methods',
      'owner-info',
    ];

    for (const id of sectionIds) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }

    // Verify section headings
    await expect(page.locator('#currency h2')).toContainText('Currency');
    await expect(page.locator('#property-types h2')).toContainText('Property Types');
    await expect(page.locator('#income-categories h2')).toContainText('Income Categories');
    await expect(page.locator('#expense-categories h2')).toContainText('Expense Categories');
    await expect(page.locator('#payment-methods h2')).toContainText('Payment Methods');
    await expect(page.locator('#owner-info h2')).toContainText('Owner');
  });

  // -------------------------------------------------------------------
  // 2. Currency section shows default symbol
  // -------------------------------------------------------------------
  test('currency section shows default peso symbol', async ({ page }) => {
    await loginViaUI(page);
    await page.goto('/setup');
    await page.waitForLoadState('networkidle');

    const currencyInput = page.locator('#currency-input');
    await expect(currencyInput).toBeVisible();
    await expect(currencyInput).toHaveValue('\u20B1'); // peso sign
  });

  // -------------------------------------------------------------------
  // 3. Property types show seeded defaults
  // -------------------------------------------------------------------
  test('property types show seeded defaults', async ({ page }) => {
    await loginViaUI(page);
    await page.goto('/setup');
    await page.waitForLoadState('networkidle');

    const section = page.locator('#property-types');
    const expectedTypes = ['Apartment', 'House', 'Cottage', 'Condo', 'Townhouse', 'Commercial'];

    for (const type of expectedTypes) {
      // Each type is displayed as an editable input value inside a chip
      const chip = section.locator('input[type="text"]').filter({ hasText: '' });
      // Alternatively, look for the input whose value matches
      const typeInput = section.locator(`input[value="${type}"]`);
      await expect(typeInput).toBeVisible();
    }
  });

  // -------------------------------------------------------------------
  // 4. Income categories show seeded defaults
  // -------------------------------------------------------------------
  test('income categories show seeded defaults', async ({ page }) => {
    await loginViaUI(page);
    await page.goto('/setup');
    await page.waitForLoadState('networkidle');

    const section = page.locator('#income-categories');
    const expectedCategories = [
      'Rent',
      'Parking',
      'Laundry',
      'Pet Fee',
      'Late Fee',
      'Storage',
      'Other Income',
    ];

    for (const category of expectedCategories) {
      const catInput = section.locator(`input[value="${category}"]`);
      await expect(catInput).toBeVisible();
    }
  });

  // -------------------------------------------------------------------
  // 8. Expense categories show seeded defaults
  // -------------------------------------------------------------------
  test('expense categories show seeded defaults', async ({ page }) => {
    await loginViaUI(page);
    await page.goto('/setup');
    await page.waitForLoadState('networkidle');

    const section = page.locator('#expense-categories');
    const expectedCategories = [
      'Maintenance',
      'Repairs',
      'Insurance',
      'Property Tax',
      'Utilities',
      'Management Fee',
      'Mortgage',
      'Landscaping',
      'Cleaning',
      'Legal Fees',
      'Advertising',
      'Other Expense',
    ];

    for (const category of expectedCategories) {
      const catInput = section.locator(`input[value="${category}"]`);
      await expect(catInput).toBeVisible();
    }
  });

  // -------------------------------------------------------------------
  // 9. Payment methods show seeded defaults
  // -------------------------------------------------------------------
  test('payment methods show seeded defaults', async ({ page }) => {
    await loginViaUI(page);
    await page.goto('/setup');
    await page.waitForLoadState('networkidle');

    const section = page.locator('#payment-methods');
    const expectedMethods = [
      'Bank Transfer',
      'Cash',
      'Credit Card',
      'Check',
      'E-Transfer',
      'PayPal',
    ];

    for (const method of expectedMethods) {
      const methodInput = section.locator(`input[value="${method}"]`);
      await expect(methodInput).toBeVisible();
    }
  });

  // -------------------------------------------------------------------
  // 10. Owner info shows seeded data
  // -------------------------------------------------------------------
  test('owner info shows seeded data', async ({ page }) => {
    await loginViaUI(page);
    await page.goto('/setup');
    await page.waitForLoadState('networkidle');

    const section = page.locator('#owner-info');

    // Full Name
    const nameLabel = section.locator('label').filter({ hasText: 'Full Name' });
    const nameInput = nameLabel.locator('..').locator('input');
    await expect(nameInput).toHaveValue('Juan Carlos Reyes');

    // Company Name
    const companyLabel = section.locator('label').filter({ hasText: 'Company Name' });
    const companyInput = companyLabel.locator('..').locator('input');
    await expect(companyInput).toHaveValue('JCR Property Management');

    // Address
    const addressLabel = section.locator('label').filter({ hasText: 'Address' });
    const addressInput = addressLabel.locator('..').locator('input');
    await expect(addressInput).toHaveValue('Unit 1205, One Ayala Tower, Makati City');

    // Phone
    const phoneLabel = section.locator('label').filter({ hasText: 'Phone' });
    const phoneInput = phoneLabel.locator('..').locator('input');
    await expect(phoneInput).toHaveValue('0917-888-1234');

    // Email
    const emailLabel = section.locator('label').filter({ hasText: 'Email' });
    const emailInput = emailLabel.locator('..').locator('input');
    await expect(emailInput).toHaveValue('admin@gmail.com');
  });

  // -------------------------------------------------------------------
  // 11. Section navigation links scroll to sections
  // -------------------------------------------------------------------
  test('section nav links work and scroll to sections', async ({ page }) => {
    await loginViaUI(page);
    await page.goto('/setup');
    await page.waitForLoadState('networkidle');

    // The quick-navigation bar has links like "Currency", "Property Types", etc.
    const navLinks: Record<string, string> = {
      'Currency': 'currency',
      'Property Types': 'property-types',
      'Income Categories': 'income-categories',
      'Expense Categories': 'expense-categories',
      'Payment Methods': 'payment-methods',
      'Owner / Company Info': 'owner-info',
    };

    for (const [linkText, sectionId] of Object.entries(navLinks)) {
      // Click the nav link
      const navLink = page.locator('nav[aria-label="Jump to section"]').getByText(linkText, { exact: true });
      await expect(navLink).toBeVisible();
      await navLink.click();

      // After clicking, the URL hash should point to the section
      // and the section should be in the viewport
      await page.waitForTimeout(500); // allow scroll animation

      const section = page.locator(`#${sectionId}`);
      await expect(section).toBeInViewport();
    }
  });
});
