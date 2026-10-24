import { Page } from '@playwright/test';
import { expectNoA11yViolations } from './support/a11y';
import { expect, test } from './support/fixtures';

test('a visitor logs in as the Guest with one click and lands in the Workspace', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Anmeldung' })).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole('button', { name: 'Gäste-Login' }).click();

  // The Guest has a fixed Avatar, so there is no Avatar step.
  await expect(page.getByRole('link', { name: 'Allgemein' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guest' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Wähle deinen Avatar' })).toHaveCount(0);
  await expectNoA11yViolations(page);

  await page.getByRole('button', { name: 'Guest' }).click();
  await expect(page.getByRole('menu', { name: 'Benutzermenü' })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page.getByRole('heading', { name: 'Anmeldung' })).toBeVisible();
});

test("the Guest can't be changed through Keycloak", async ({ page }) => {
  for (const action of ['UPDATE_PASSWORD', 'UPDATE_EMAIL', 'UPDATE_PROFILE']) {
    await openLoginWithKcAction(page, action);
    await page.getByRole('button', { name: 'Gäste-Login' }).click();

    await expect(page.getByText('Der Gast kann nicht geändert werden.')).toBeVisible();
  }

  await page.goto('/');
  await page.getByRole('link', { name: 'Passwort vergessen?' }).click();
  await page.getByLabel('E-Mail-Adresse').fill('guest@dabubble.com');
  await page.getByRole('button', { name: 'E-Mail senden' }).click();

  await expect(page.getByText('Der Gast kann nicht geändert werden.')).toBeVisible();
  await expectNoA11yViolations(page);
});

/** Opens the Keycloak login the app redirects to, asking Keycloak to run [action] after it. */
async function openLoginWithKcAction(page: Page, action: string): Promise<void> {
  await page.context().clearCookies();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Anmeldung' })).toBeVisible();
  const login = new URL(page.url());
  login.searchParams.set('kc_action', action);
  await page.goto(login.toString());
}
