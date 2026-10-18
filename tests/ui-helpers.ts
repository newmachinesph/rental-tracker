import { Page, Locator, expect } from '@playwright/test';

export const ADMIN_EMAIL = 'admin@gmail.com';
export const ADMIN_PASSWORD = 'admin123';

/** Log in via the browser login form and wait for dashboard to load. */
export async function loginViaUI(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('/', { timeout: 15_000 });
  // Wait for DataLoader to finish rendering
  await page.waitForLoadState('networkidle');
}

/** Log out via the sidebar logout button. */
export async function logoutViaUI(page: Page) {
  await page.locator('aside button[title="Logout"]').click();
  await page.waitForURL('/login', { timeout: 10_000 });
}

/** Navigate via a sidebar link by its exact label text. */
export async function navigateTo(page: Page, linkText: string) {
  await page.locator('aside').getByRole('link', { name: linkText, exact: true }).click();
  await page.waitForLoadState('networkidle');
}

/** Wait for AG Grid to render and return the visible row count. */
export async function waitForAgGrid(page: Page): Promise<number> {
  await page.waitForSelector('.ag-theme-quartz', { timeout: 10_000 });
  await page.waitForTimeout(600); // let AG Grid settle
  return page.locator('.ag-center-cols-container .ag-row').count();
}

/** Get the current AG Grid row count. */
export async function agGridRowCount(page: Page): Promise<number> {
  return page.locator('.ag-center-cols-container .ag-row').count();
}

/** Navigate AG Grid to its last page (if pagination exists). */
export async function goToGridLastPage(page: Page) {
  // AG Grid pagination buttons are <div role="button" aria-label="..." aria-disabled="true|false">
  const lastBtn = page.locator('.ag-paging-panel [aria-label="Last Page"]:not(.ag-disabled)');
  if (await lastBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await lastBtn.click();
    await page.waitForTimeout(300);
  }
}

/** Navigate AG Grid to its first page (if pagination exists). */
export async function goToGridFirstPage(page: Page) {
  const firstBtn = page.locator('.ag-paging-panel [aria-label="First Page"]:not(.ag-disabled)');
  if (await firstBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await firstBtn.click();
    await page.waitForTimeout(300);
  }
}

/** Click "Add ..." button and wait for the modal to appear. */
export async function clickAddButton(page: Page, buttonText: string) {
  await page.getByRole('button', { name: buttonText }).click();
  await page.waitForSelector('.fixed.inset-0.z-\\[100\\]', { timeout: 5_000 });
}

/** Return a Locator for the currently open modal. */
export function modal(page: Page) {
  return page.locator('.fixed.inset-0.z-\\[100\\]');
}

/** Click Save in the currently open modal and wait for it to close. */
export async function saveModal(page: Page) {
  await modal(page).getByRole('button', { name: 'Save' }).click();
  await page.waitForSelector('.fixed.inset-0.z-\\[100\\]', { state: 'detached', timeout: 10_000 });
}

/** Click Cancel in the currently open modal and wait for it to close. */
export async function cancelModal(page: Page) {
  await modal(page).getByRole('button', { name: 'Cancel' }).click();
  await page.waitForSelector('.fixed.inset-0.z-\\[100\\]', { state: 'detached', timeout: 5_000 });
}

/** Click an AG Grid row that contains the given text to open the edit modal. */
export async function clickAgGridRow(page: Page, cellText: string) {
  const row = page.locator('.ag-center-cols-container .ag-row').filter({ hasText: cellText });
  await row.first().click();
  await page.waitForSelector('.fixed.inset-0.z-\\[100\\]', { timeout: 5_000 });
}

/** Delete an AG Grid row by clicking its trash icon. Handles horizontal scrolling and confirmation modal. */
export async function deleteAgGridRow(page: Page, cellText: string) {
  const row = page.locator('.ag-center-cols-container .ag-row').filter({ hasText: cellText }).first();
  // Get the row-index so we can re-find the row after scrolling
  const rowIndex = await row.getAttribute('row-index');

  // Scroll grid to the right to expose the action column (may be off-screen due to column virtualization)
  const scrollViewport = page.locator('.ag-body-horizontal-scroll-viewport');
  await scrollViewport.evaluate(el => el.scrollLeft = el.scrollWidth);
  await page.waitForTimeout(400);

  // Re-find the row by row-index (original text may have scrolled off)
  const rowAfterScroll = page.locator(`.ag-center-cols-container .ag-row[row-index="${rowIndex}"]`);
  await rowAfterScroll.locator('button[title="Remove"]').click();

  // All pages use a confirmation modal — click "Delete" to confirm
  const confirmModal = page.locator('.fixed.inset-0.z-\\[100\\]');
  await confirmModal.waitFor({ state: 'visible', timeout: 5_000 });
  await confirmModal.getByRole('button', { name: 'Delete' }).click();
  await confirmModal.waitFor({ state: 'detached', timeout: 5_000 });

  // Scroll back to left for clean state
  await scrollViewport.evaluate(el => el.scrollLeft = 0);
  await page.waitForTimeout(200);
}

/**
 * Locate a FieldGroup in the modal by its exact label text.
 * FieldGroup structure: <div class="flex flex-col gap-1.5"><label>Label</label>...</div>
 * Uses exact label matching to avoid "Property" matching "Property Type",
 * "Status" matching "Payment Status", "Unit" matching "Unit Address", etc.
 */
export function findFieldGroup(page: Page, label: string): Locator {
  const m = modal(page);
  // Escape regex special chars in the label
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match the field group whose <label> text starts with the exact label,
  // optionally followed by "*" (required), parenthetical (e.g. currency symbol), and/or "Auto" badge.
  // This avoids "Property" matching "Property Type", "Status" matching "Payment Status", etc.
  return m.locator('.flex.flex-col.gap-1\\.5').filter({
    has: page.locator('label').filter({
      hasText: new RegExp(`^\\s*${escaped}\\s*\\*?\\s*(\\(.*\\))?\\s*(Auto)?\\s*$`),
    }),
  });
}

/** Select an option in a <select> inside the modal, located by its FieldGroup label. */
export async function modalSelect(page: Page, label: string, optionText: string) {
  const fieldGroup = findFieldGroup(page, label);
  await fieldGroup.locator('select').selectOption({ label: optionText });
}

/** Fill a text/number/date input inside the modal, located by its FieldGroup label. */
export async function modalFill(page: Page, label: string, value: string) {
  const fieldGroup = findFieldGroup(page, label);
  const input = fieldGroup.locator('input:not([type="checkbox"])');
  await input.fill(value);
}

/** Toggle a checkbox inside the modal, located by its FieldGroup label. */
export async function modalCheck(page: Page, label: string, checked: boolean) {
  const fieldGroup = findFieldGroup(page, label);
  const checkbox = fieldGroup.locator('input[type="checkbox"]');
  if (checked) {
    await checkbox.check();
  } else {
    await checkbox.uncheck();
  }
}

/** Read auto-filled text content from a modal FieldGroup. */
export async function modalAutoValue(page: Page, label: string): Promise<string> {
  const fieldGroup = findFieldGroup(page, label);
  const display = fieldGroup.locator('.bg-slate-50');
  return (await display.textContent()) ?? '';
}
