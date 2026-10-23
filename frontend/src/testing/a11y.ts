import axe from 'axe-core';

/**
 * Fails the test when axe finds WCAG 2.0/2.1 A or AA violations in [context]. Defaults to the whole
 * body, so CDK overlays (dialogs, menus) rendered outside the component are checked too. Colour
 * contrast is off: jsdom doesn't lay out or paint, so axe can't compute it (the E2E run checks it).
 */
export async function expectNoA11yViolations(context: Element = document.body): Promise<void> {
  const { violations } = await axe.run(context, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    rules: { 'color-contrast': { enabled: false } },
  });
  const report = violations.map(
    ({ id, help, nodes }) => `${id}: ${help}\n${nodes.map((node) => `  ${node.html}`).join('\n')}`,
  );
  expect(report, 'axe violations').toEqual([]);
}
