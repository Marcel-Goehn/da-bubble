import { render, screen } from '@testing-library/angular';
import { expectNoA11yViolations } from '../../../testing/a11y';
import { Button } from './button';

describe('Button', () => {
  it('stays a native button for primary and secondary actions', async () => {
    const save = vi.fn();
    await render(
      `<button appButton type="button" (click)="save()">Speichern</button>
       <button appButton="secondary" type="button">Abbrechen</button>`,
      { imports: [Button], componentProperties: { save } },
    );

    screen.getByRole('button', { name: 'Speichern' }).click();

    expect(save).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeTruthy();
    await expectNoA11yViolations();
  });

  it('can be disabled', async () => {
    await render('<button appButton type="submit" [disabled]="true">Weiter</button>', {
      imports: [Button],
    });

    expect(screen.getByRole('button', { name: 'Weiter' }).hasAttribute('disabled')).toBe(true);
    await expectNoA11yViolations();
  });
});
