import AxeBuilder from '@axe-core/playwright';
import { expect, Page } from '@playwright/test';

/**
 * Fails the test when axe finds WCAG 2.0/2.1 A or AA violations on the screen [page] shows, colour
 * contrast included. Call it once per screen a journey visits, the Keycloak pages included.
 */
export async function expectNoA11yViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const report = violations.map(
    ({ id, help, nodes }) => `${id}: ${help}\n${nodes.map((node) => `  ${node.html}`).join('\n')}`,
  );
  expect(report, `axe violations on ${page.url()}`).toEqual([]);
}
