import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './support/a11y';

test('the legal pages open without logging in', async ({ page }) => {
  await page.goto('/impressum');
  await expect(page.getByRole('heading', { level: 1, name: 'Impressum' })).toBeVisible();
  await expectNoA11yViolations(page);

  await page.goto('/datenschutz');
  await expect(page.getByRole('heading', { level: 1, name: 'Datenschutz' })).toBeVisible();
  await expectNoA11yViolations(page);
});
