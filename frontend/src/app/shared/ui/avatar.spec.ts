import { render, screen } from '@testing-library/angular';
import { expectNoA11yViolations } from '../../../testing/a11y';
import { provideI18nTesting } from '../../../testing/i18n';
import { Avatar } from './avatar';

describe('Avatar', () => {
  it("shows the User's Avatar, described by their name", async () => {
    await render('<app-avatar src="/avatars/1.png" name="Ada Lovelace" />', {
      imports: [Avatar],
      providers: [provideI18nTesting()],
    });

    const image = screen.getByRole('img', { name: 'Ada Lovelace' });
    expect(image.getAttribute('src')).toBe('/avatars/1.png');
    await expectNoA11yViolations();
  });

  it('shows a placeholder, still named, while the User has no Avatar', async () => {
    await render('<app-avatar [src]="null" name="Ada Lovelace" />', {
      imports: [Avatar],
      providers: [provideI18nTesting()],
    });

    expect(screen.getByRole('img', { name: 'Ada Lovelace' }).tagName).not.toBe('IMG');
    await expectNoA11yViolations();
  });

  it('marks the Presence of the User as online or offline', async () => {
    await render(
      `<app-avatar src="/avatars/1.png" name="Ada Lovelace" presence="online" />
       <app-avatar src="/avatars/2.png" name="Alan Turing" presence="offline" />`,
      { imports: [Avatar], providers: [provideI18nTesting()] },
    );

    expect(screen.getByRole('img', { name: 'Aktiv' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Abwesend' })).toBeTruthy();
    await expectNoA11yViolations();
  });

  it('shows no Presence unless it is given', async () => {
    await render('<app-avatar src="/avatars/1.png" name="Ada Lovelace" />', {
      imports: [Avatar],
      providers: [provideI18nTesting()],
    });

    expect(screen.getAllByRole('img')).toHaveLength(1);
    await expectNoA11yViolations();
  });

  it('is hidden from assistive technology when decorative, with or without a picture', async () => {
    const { container } = await render(
      `<a href="/dm/1"><app-avatar src="/avatars/1.png" name="Ada Lovelace" decorative /> Ada</a>
       <a href="/dm/2"><app-avatar [src]="null" name="Alan Turing" decorative /> Alan</a>`,
      { imports: [Avatar], providers: [provideI18nTesting()] },
    );

    expect(screen.queryAllByRole('img')).toEqual([]);
    expect(screen.getByRole('link', { name: 'Ada' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Alan' })).toBeTruthy();
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('');
    await expectNoA11yViolations();
  });
});
