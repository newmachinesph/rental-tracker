import { test, expect, Page } from '@playwright/test';
import { loginViaUI, navigateTo } from '../../ui-helpers';

test.describe.serial('Documents Hub UI', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaUI(page);
    await navigateTo(page, 'Documents');
  });

  test.afterAll(async () => {
    await page.close();
  });

  // -------------------------------------------------------------------
  // 1. Page loads with heading and both sections
  // -------------------------------------------------------------------
  test('page loads with heading and both sections', async () => {
    await expect(page.locator('h1')).toHaveText('Documents');

    // Two section headings
    await expect(page.getByRole('heading', { name: 'Statements of Account' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Letters & Notices' })).toBeVisible();
  });

  // -------------------------------------------------------------------
  // 2. SOA cards are displayed
  // -------------------------------------------------------------------
  test('Statement of Account cards are displayed', async () => {
    await expect(page.getByText('Tenant Statement of Account')).toBeVisible();
    await expect(page.getByText('Owner Statement of Account')).toBeVisible();
  });

  // -------------------------------------------------------------------
  // 3. Letter cards are displayed
  // -------------------------------------------------------------------
  test('letter type cards are displayed', async () => {
    const main = page.locator('main');
    const expectedLetterTypes = [
      'Rent Reminder',
      'Late Payment Notice',
      'Lease Renewal',
      'Lease Termination',
      'Move-In Welcome',
      'Move-Out Notice',
      'Maintenance Confirmation',
      'Maintenance Completion',
    ];

    for (const letterType of expectedLetterTypes) {
      await expect(
        main.getByRole('link', { name: new RegExp(letterType) }).first(),
      ).toBeVisible();
    }
  });

  // -------------------------------------------------------------------
  // 4. SOA tenant card navigates to /documents/soa-tenant
  // -------------------------------------------------------------------
  test('SOA tenant card navigates to correct page', async () => {
    const soaTenantLink = page.getByRole('link', { name: /Tenant Statement of Account/ });
    await expect(soaTenantLink).toBeVisible();
    await soaTenantLink.click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/documents\/soa-tenant/);

    // Navigate back to documents
    await page.goBack();
    await page.waitForLoadState('networkidle');
  });

  // -------------------------------------------------------------------
  // 5. SOA owner card navigates to /documents/soa-owner
  // -------------------------------------------------------------------
  test('SOA owner card navigates to correct page', async () => {
    const soaOwnerLink = page.getByRole('link', { name: /Owner Statement of Account/ });
    await expect(soaOwnerLink).toBeVisible();
    await soaOwnerLink.click();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/documents\/soa-owner/);

    // Navigate back to documents
    await page.goBack();
    await page.waitForLoadState('networkidle');
  });

  // -------------------------------------------------------------------
  // 6. Letter card navigates to /documents/letters?type=...
  // -------------------------------------------------------------------
  test('letter card navigates to letters page with type parameter', async () => {
    const main = page.locator('main');

    // Use href-based selectors to avoid ambiguity with sidebar links
    const testCases = [
      { href: '/documents/letters?type=rent-reminder', urlPattern: /\/documents\/letters\?type=rent-reminder/ },
      { href: '/documents/letters?type=late-payment', urlPattern: /\/documents\/letters\?type=late-payment/ },
      { href: '/documents/letters?type=lease-renewal', urlPattern: /\/documents\/letters\?type=lease-renewal/ },
    ];

    for (const { href, urlPattern } of testCases) {
      const link = main.locator(`a[href="${href}"]`);
      await expect(link).toBeVisible();
      await link.click();
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(urlPattern);

      // Navigate back
      await page.goBack();
      await page.waitForLoadState('networkidle');
    }
  });
});
