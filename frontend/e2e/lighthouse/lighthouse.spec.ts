import { BrowserContext, chromium, Page } from '@playwright/test';
import lighthouse, { Config } from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { expect, logIn, test } from '../support/fixtures';
import { createVerifiedUser } from '../support/keycloak-admin';

/**
 * `npm run lighthouse`: Lighthouse on desktop and mobile for each measured screen. Fails below 90
 * for Accessibility and reports the other categories (in the log and as attached HTML reports).
 */

const debuggingPort = 9222;
// Lighthouse's default config emulates a phone.
const formFactors: Record<string, Config | undefined> = {
  desktop: desktopConfig,
  mobile: undefined,
};

// Lighthouse opens its own tabs over the debugging port. They live in the browser's default
// context, so this one persistent context holds the login session the audited tabs need.
let context: BrowserContext;
let page: Page;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const { baseURL, locale } = test.info().project.use;
  context = await chromium.launchPersistentContext('', {
    args: [`--remote-debugging-port=${debuggingPort}`, `--lang=${locale}`],
    baseURL,
    locale,
  });
  page = context.pages()[0] ?? (await context.newPage());
});

test.afterAll(async () => {
  await context.close();
});

async function audit(url: string): Promise<void> {
  const testInfo = test.info();
  for (const [formFactor, config] of Object.entries(formFactors)) {
    const result = await lighthouse(
      url,
      // Keeps the login session; Lighthouse otherwise clears the origin's storage first.
      { port: debuggingPort, output: 'html', logLevel: 'error', disableStorageReset: true },
      config,
    );
    const { lhr, report } = result!;
    // A lost session would send the tab to the login and measure that instead.
    expect(lhr.finalDisplayedUrl, `the ${formFactor} audit's page`).toBe(url);
    const scores = Object.values(lhr.categories)
      .map(({ title, score }) => `${title} ${Math.round((score ?? 0) * 100)}`)
      .join(', ');
    console.log(`${testInfo.title} (${formFactor}): ${scores}`);
    await testInfo.attach(`${formFactor}.html`, {
      body: report as string,
      contentType: 'text/html',
    });
    expect
      .soft(lhr.categories['accessibility']?.score, `Accessibility on ${formFactor}`)
      .toBeGreaterThanOrEqual(0.9);
  }
}

test('Keycloak login', async () => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Anmeldung' })).toBeVisible();
  await audit(page.url());
});

test('main view', async ({ request }) => {
  const user = await createVerifiedUser(request);
  await page.goto('/');
  await logIn(page, user);
  await page.getByAltText('Avatar 1').click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  // The Avatar step lands in the Default Channel, so a Conversation is open.
  await expect(page.getByRole('main').getByRole('heading', { name: 'Allgemein' })).toBeVisible();
  // TODO(#74): also measure an open Thread once Threads exist.
  await audit(page.url());
});
