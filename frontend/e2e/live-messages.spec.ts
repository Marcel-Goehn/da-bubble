import { Browser, Page, WebSocket } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { expectNoA11yViolations } from './support/a11y';
import { expect, logIn, test } from './support/fixtures';
import { createVerifiedUser, TestUser } from './support/keycloak-admin';

test('a Message sent in one browser shows up live in another', async ({
  browser,
  request,
  user,
}) => {
  const sender = await openDefaultChannel(browser, user);
  const reader = await openDefaultChannel(browser, await createVerifiedUser(request));
  const text = `Live ${randomUUID().slice(0, 8)}`;
  // Proves the push itself: a refetch would show the Message too, but not over the socket.
  const pushed = reader.socket.waitForEvent('framereceived', (frame) =>
    String(frame.payload).includes(text),
  );

  await sender.page.getByRole('textbox', { name: 'Nachricht an #Allgemein' }).fill(text);
  await sender.page.keyboard.press('Enter');

  await pushed;
  await expect(
    reader.page.getByRole('region', { name: 'Nachrichten' }).getByText(text),
  ).toBeVisible();
  await expect(
    sender.page.getByRole('region', { name: 'Nachrichten' }).getByText(text),
  ).toHaveCount(1);
  await expectNoA11yViolations(reader.page);
  await Promise.all([sender.page.context().close(), reader.page.context().close()]);
});

/**
 * Logs [user] in through their own browser context, past the Avatar step, into the Default Channel, and
 * waits until the app has subscribed to its events.
 */
async function openDefaultChannel(
  browser: Browser,
  user: TestUser,
): Promise<{ page: Page; socket: WebSocket }> {
  const page = await (await browser.newContext()).newPage();
  const subscribed = new Promise<WebSocket>((resolve) => {
    page.on('websocket', (socket) => {
      socket.on('framesent', (frame) => {
        if (String(frame.payload).startsWith('SUBSCRIBE')) {
          resolve(socket);
        }
      });
    });
  });
  await page.goto('/');
  await logIn(page, user);
  await page.getByAltText('Avatar 1').click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByRole('textbox', { name: 'Nachricht an #Allgemein' })).toBeVisible();
  return { page, socket: await subscribed };
}
