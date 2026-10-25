import { randomUUID } from 'node:crypto';
import { expectNoA11yViolations } from './support/a11y';
import { expect, logIn, test } from './support/fixtures';

// A 1×1 PNG, small enough to inline and real enough for the browser to make a thumbnail of.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const pdf = Buffer.from('%PDF-1.4\n%%EOF\n');

test('a User attaches an image and a PDF, sends them without text, and opens and downloads the PDF', async ({
  page,
  user,
}) => {
  // Unique, as the Default Channel keeps every earlier run's Messages.
  const id = randomUUID().slice(0, 8);
  const photoName = `Foto-${id}.png`;
  const pdfName = `Plan-${id}.pdf`;
  await page.goto('/');
  await logIn(page, user);
  await page.getByAltText('Avatar 1').click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  const composer = page.locator('form').filter({
    has: page.getByRole('combobox', { name: 'Nachricht an #Allgemein' }),
  });

  // Straight to storage with the presigned PUTs, so this also proves the browser may upload there.
  await composer.getByLabel('Dateien auswählen').setInputFiles([
    { name: photoName, mimeType: 'image/png', buffer: png },
    { name: pdfName, mimeType: 'application/pdf', buffer: pdf },
  ]);
  const send = composer.getByRole('button', { name: 'Nachricht senden' });
  await expect(send).toBeEnabled();
  await expectNoA11yViolations(page);
  await send.click();

  const sent = page
    .getByRole('region', { name: 'Nachrichten' })
    .getByRole('listitem')
    .filter({ hasText: pdfName });
  const image = sent.getByRole('img', { name: photoName });
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
    .toBeGreaterThan(0);
  await expect(composer.getByText(pdfName)).toHaveCount(0);
  await expectNoA11yViolations(page);

  const popup = page.waitForEvent('popup');
  await sent.getByRole('button', { name: new RegExp(`^${pdfName} .+ öffnen$`) }).click();
  const tab = await popup;
  // Headless Chromium has no PDF viewer and aborts the navigation, but the tab asked for the file.
  const opened = await tab.waitForEvent('request', (request) =>
    request.url().includes('/dabubble/attachments/'),
  );
  const file = await page.request.get(opened.url());
  expect(file.headers()['content-disposition']).toMatch(/^inline;/);
  expect(await file.text()).toBe(pdf.toString());
  await tab.close();

  const download = page.waitForEvent('download');
  await sent.getByRole('button', { name: `${pdfName} herunterladen` }).click();
  expect((await download).suggestedFilename()).toBe(pdfName);
});
