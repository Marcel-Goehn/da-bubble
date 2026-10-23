import { render, screen } from '@testing-library/angular';
import { expectNoA11yViolations } from '../../../testing/a11y';
import { Icon } from './icon';

describe('Icon', () => {
  it('inlines the Material Symbol, hidden from assistive technology', async () => {
    const { container } = await render('<p>Text <app-icon name="close" /></p>', {
      imports: [Icon],
    });

    const icon = container.querySelector('app-icon');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.querySelector('svg path')).not.toBeNull();
    await expectNoA11yViolations();
  });

  it('is an image named by its label when it carries meaning on its own', async () => {
    await render('<app-icon name="close" label="Schließen" />', { imports: [Icon] });

    const icon = screen.getByRole('img', { name: 'Schließen' });
    expect(icon.getAttribute('aria-hidden')).toBeNull();
    await expectNoA11yViolations();
  });
});
