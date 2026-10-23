import { expectNoA11yViolations } from './support/a11y';
import { expect, logIn, test } from './support/fixtures';

test('a User logs in with their password and logs out again', async ({ page, user }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Anmeldung' })).toBeVisible();
  await expectNoA11yViolations(page);

  await logIn(page, user);
  // A first visit: the User has no Avatar yet.
  await expect(page.getByRole('heading', { name: 'Wähle deinen Avatar' })).toBeVisible();
  await expect(page.getByText(user.name)).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page.getByRole('heading', { name: 'Anmeldung' })).toBeVisible();

  // The Keycloak session is gone too: the app asks for the login again.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Anmeldung' })).toBeVisible();
});
