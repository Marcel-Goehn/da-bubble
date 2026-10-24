import { expectNoA11yViolations } from './support/a11y';
import { expect, test } from './support/fixtures';
import { uniqueEmail, uniquePassword } from './support/keycloak-admin';
import { emailTo, linkIn } from './support/mailpit';

// The one journey that signs up for real; every other test gets its User from the Admin API.
test('a visitor signs up, verifies their email and lands in the Workspace', async ({
  page,
  request,
}) => {
  const name = 'Noah Braun';
  const email = uniqueEmail('signup');
  const password = uniquePassword();

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Anmeldung' })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole('link', { name: 'Konto erstellen' }).click();

  await expect(page.getByRole('heading', { name: 'Konto erstellen' })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByLabel('Name und Nachname').fill(name);
  await page.getByLabel('E-Mail-Adresse').fill(email);
  await page.getByRole('checkbox', { name: 'Ich stimme der Datenschutzerklärung zu.' }).check();
  await page.getByRole('button', { name: 'Weiter' }).click();

  await expect(page.getByRole('heading', { name: 'Passwort festlegen' })).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByLabel('Neues Passwort', { exact: true }).fill(password);
  await page.getByLabel('Neues Passwort bestätigen').fill(password);
  await page.getByRole('button', { name: 'Passwort speichern' }).click();

  await expect(page.getByRole('heading', { name: 'Bestätige deine E-Mail-Adresse' })).toBeVisible();
  await expect(page.getByText(`Wir haben dir eine E-Mail an ${email} geschickt.`)).toBeVisible();
  await expectNoA11yViolations(page);

  const verification = await emailTo(request, email);
  expect(verification.Subject).toBe('Bestätige deine E-Mail-Adresse');
  expect(verification.Text).toContain('Hallo,');
  expect(verification.Text).toContain(
    'Willkommen bei DABubble! Bitte bestätige deine E-Mail-Adresse, indem du auf den folgenden Link klickst:',
  );
  expect(verification.Text).toContain('nur 24 Stunden gültig');
  expect(verification.Text).toContain('Dein DABubble Team!');
  expect(verification.HTML).toContain('E-Mail-Adresse bestätigen</a>');

  // Opened in the same browser, the link goes straight into the app, already logged in.
  await page.goto(linkIn(verification));
  await expect(page.getByRole('heading', { name: 'Wähle deinen Avatar' })).toBeVisible();
  await expect(page.getByText(name)).toBeVisible();
  await expectNoA11yViolations(page);
  // The radio itself is visually hidden; Users click its picture.
  await page.getByAltText('Avatar 3').click();
  await expect(page.getByRole('radio', { name: 'Avatar 3' })).toBeChecked();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByRole('status')).toHaveText('Konto erfolgreich erstellt!');

  // A new User lands in the Default Channel, already a Member, with their self-DM in the sidebar.
  await expect(page).toHaveURL(/\/channel\/\d+$/);
  await expect(page.getByRole('main').getByRole('heading', { name: 'Allgemein' })).toBeVisible();
  await expect(page.getByRole('link', { name: `${name} (Du)` })).toBeVisible();
  await expectNoA11yViolations(page);
});
