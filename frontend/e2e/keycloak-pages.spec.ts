import { expectNoA11yViolations } from './support/a11y';
import { expect, logIn, test } from './support/fixtures';
import { createVerifiedUser, keycloakUrl, realm } from './support/keycloak-admin';

const keycloakAuthUrl = `${keycloakUrl}/realms/${realm}/protocol/openid-connect/auth`;

test('a broken login link shows the themed error page with a way back to the app', async ({
  page,
}) => {
  await page.goto(`${keycloakAuthUrl}?client_id=unknown&response_type=code`);

  await expect(page.getByRole('heading', { name: 'Das hat nicht geklappt' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Zu DABubble' })).toHaveAttribute(
    'href',
    'http://localhost:4200',
  );
  await expectNoA11yViolations(page);
});

test('a User who still has to agree to the privacy policy does so once on the themed terms page', async ({
  page,
  request,
}) => {
  // Google sign-ups skip the sign-up form's checkbox, so Keycloak asks them on this page.
  const user = await createVerifiedUser(request, { requiredActions: ['TERMS_AND_CONDITIONS'] });
  await page.goto('/');
  await logIn(page, user);

  await expect(page.getByRole('heading', { name: 'Fast geschafft' })).toBeVisible();
  await expect(page.getByText(`Hallo ${user.name}!`)).toBeVisible();
  await expectNoA11yViolations(page);

  await page.getByRole('checkbox', { name: 'Ich stimme der Datenschutzerklärung zu.' }).check();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByRole('heading', { name: 'Wähle deinen Avatar' })).toBeVisible();

  await page.getByRole('button', { name: 'Abmelden' }).click();
  await logIn(page, user);
  await expect(page.getByRole('heading', { name: 'Wähle deinen Avatar' })).toBeVisible();
});

test('a logged-in User asked to log in again confirms only their password', async ({
  page,
  user,
}) => {
  await page.goto('/');
  await logIn(page, user);
  await expect(page.getByRole('heading', { name: 'Wähle deinen Avatar' })).toBeVisible();

  // The forced re-login the app's email change gets from max_age; prompt=login takes the same path
  // in Keycloak without waiting for the login to age.
  const reauth = new URL(keycloakAuthUrl);
  reauth.search = new URLSearchParams({
    client_id: 'da-bubble-app',
    redirect_uri: 'http://localhost:4200/',
    response_type: 'code',
    scope: 'openid',
    prompt: 'login',
    // The client requires PKCE; the code is never redeemed, so RFC 7636's example challenge will do.
    code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    code_challenge_method: 'S256',
  }).toString();
  await page.goto(reauth.toString());

  await expect(page.getByRole('heading', { name: 'Bitte erneut anmelden' })).toBeVisible();
  await expect(page.getByLabel('E-Mail-Adresse')).toHaveValue(user.email);
  await expect(page.getByLabel('E-Mail-Adresse')).not.toBeEditable();
  await expect(page.getByRole('button', { name: 'Gäste-Login' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Konto erstellen' })).toHaveCount(0);
  await expectNoA11yViolations(page);

  await page.getByLabel('Passwort').fill(user.password);
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page).toHaveURL(/^http:\/\/localhost:4200\//);
});

test('without the Google secret, the login offers no Google button and no divider', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Anmeldung' })).toBeVisible();

  await expect(page.getByRole('link', { name: /Google/ })).toHaveCount(0);
  await expect(page.getByText('ODER')).toHaveCount(0);
});
