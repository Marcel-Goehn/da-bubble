import { test as base, expect, Page } from '@playwright/test';
import { createVerifiedUser, TestUser } from './keycloak-admin';

export { expect };

/** The journeys' `test`: adds `user`, a fresh verified User created through the Admin API. */
export const test = base.extend<{ user: TestUser }>({
  user: async ({ request }, use) => {
    await use(await createVerifiedUser(request));
  },
});

/** Logs in as [user] on the Keycloak login, where the app sends every visitor. */
export async function logIn(page: Page, user: TestUser): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Anmeldung' })).toBeVisible();
  await page.getByLabel('E-Mail-Adresse').fill(user.email);
  await page.getByLabel('Passwort').fill(user.password);
  await page.getByRole('button', { name: 'Anmelden' }).click();
}
