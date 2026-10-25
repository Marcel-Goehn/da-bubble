import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { expectNoA11yViolations } from '../../../testing/a11y';
import {
  ada as adaWithAvatar,
  defaultChannel,
  directMessage,
  noUnread,
  renderApp,
} from '../../../testing/app';
import { UserDto } from '../../core/data/user.store';

const ada: UserDto = { ...adaWithAvatar, avatar: null };

describe('Avatar step', () => {
  it('holds a User without an Avatar on "Wähle deinen Avatar", their name read-only', async () => {
    const { http } = await renderApp({ me: ada });

    expect(await screen.findByRole('heading', { name: 'Wähle deinen Avatar' })).toBeTruthy();
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Weiter' }).hasAttribute('disabled')).toBe(true);
    await expectNoA11yViolations();
    http.verify();
  });

  it('enables Weiter once an Avatar is picked and previews it', async () => {
    await renderApp({ me: ada });
    const choices = within(await screen.findByRole('radiogroup', { name: 'Aus der Liste wählen' }));
    expect(choices.getAllByRole('radio')).toHaveLength(6);

    await userEvent.click(choices.getByRole('radio', { name: 'Avatar 3' }));

    expect(choices.getByRole('radio', { name: 'Avatar 3' })).toHaveProperty('checked', true);
    expect(screen.getByRole('button', { name: 'Weiter' }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('img', { name: 'Ada Lovelace' }).getAttribute('src')).toBe(
      '/avatars/3.webp',
    );
    await expectNoA11yViolations();
  });

  it('lets the Avatar be picked by keyboard alone', async () => {
    await renderApp({ me: ada });
    await screen.findByRole('radiogroup');

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Abmelden' })).toBe(document.activeElement);
    await userEvent.tab();
    expect(screen.getByRole('radio', { name: 'Avatar 1' })).toBe(document.activeElement);
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Avatar 3' })).toHaveProperty('checked', true);
    await userEvent.tab();

    expect(screen.getByRole('button', { name: 'Weiter' })).toBe(document.activeElement);
    await expectNoA11yViolations();
  });

  it('saves the picked Avatar, shows "Konto erfolgreich erstellt!" and then lands in the Default Channel', async () => {
    const { http } = await renderApp({ me: ada });
    await userEvent.click(await screen.findByRole('radio', { name: 'Avatar 3' }));

    await userEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    const request = http.expectOne({ method: 'PUT', url: '/api/me/avatar' });
    expect(request.request.body).toEqual({ avatar: 'AVATAR_3' });
    expect(screen.getByRole('button', { name: 'Weiter' }).hasAttribute('disabled')).toBe(true);
    request.flush({ ...ada, avatar: 'AVATAR_3' });

    expect(
      await within(screen.getByRole('status')).findByText('Konto erfolgreich erstellt!'),
    ).toBeTruthy();
    await expectNoA11yViolations();
    http.expectOne('/api/conversations').flush([defaultChannel, directMessage(2, ada.id)]);
    await vi.waitFor(
      () => expect(screen.queryByRole('heading', { name: 'Wähle deinen Avatar' })).toBeNull(),
      { timeout: 3000 },
    );
    expect(
      await within(await screen.findByRole('main')).findByRole('heading', { name: 'Allgemein' }),
    ).toBeTruthy();
    expect(TestBed.inject(Router).url).toBe('/channel/1');
    http.expectOne('/api/users').flush([{ ...ada, avatar: 'AVATAR_3' }]);
    http.expectOne('/api/conversations/unread').flush(noUnread);
    http.expectOne('/api/conversations/1/messages').flush({ messages: [], nextCursor: null });
    http.verify();
  });

  it('keeps a User who already has an Avatar off the Avatar step', async () => {
    const { http } = await renderApp({ me: { ...ada, avatar: 'AVATAR_1' }, url: '/avatar' });

    expect(screen.queryByRole('heading', { name: 'Wähle deinen Avatar' })).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/');
    await expectNoA11yViolations();
    http.verify();
  });

  it('lets the User log out without picking an Avatar', async () => {
    const { keycloak, http } = await renderApp({ me: ada });

    await userEvent.click(await screen.findByRole('button', { name: 'Abmelden' }));

    expect(keycloak.logout).toHaveBeenCalledWith({ redirectUri: `${window.location.origin}/` });
    await expectNoA11yViolations();
    http.verify();
  });
});
