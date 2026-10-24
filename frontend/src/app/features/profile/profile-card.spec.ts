import { Dialog } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { fireEvent, screen, waitFor, within } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { expectNoA11yViolations } from '../../../testing/a11y';
import {
  ada,
  alan,
  defaultChannel,
  directMessage,
  message,
  renderApp,
  settle,
} from '../../../testing/app';

const users = [ada, alan];

/** The Default Channel with one Message by Alan. */
async function openChannel() {
  const app = await renderApp({ url: '/channel/1', users });
  app.http
    .expectOne('/api/conversations/1/messages')
    .flush({ messages: [message(1, 'Hallo', { authorId: alan.id })], nextCursor: null });
  await settle(app.fixture);
  return app;
}

function authorButton(): HTMLElement {
  const log = screen.getByRole('region', { name: 'Nachrichten' });
  return within(log).getByRole('button', { name: 'Alan Turing' });
}

describe('Profile card', () => {
  afterEach(() => TestBed.inject(Dialog).closeAll());

  it("shows another User's name, Presence and email from a Message's author", async () => {
    const { realtime, fixture } = await openChannel();
    realtime.emit({ type: 'presence.changed', userId: alan.id, online: true });
    await settle(fixture);

    await userEvent.click(authorButton());

    const card = await screen.findByRole('dialog', { name: 'Profil' });
    expect(within(card).getByRole('heading', { name: 'Alan Turing' })).toBeTruthy();
    expect(within(card).getByText('Aktiv')).toBeTruthy();
    expect(within(card).getByRole('link', { name: 'alan@example.com' }).getAttribute('href')).toBe(
      'mailto:alan@example.com',
    );
    await expectNoA11yViolations();
  });

  it('starts a DM with "Nachricht"', async () => {
    const { fixture } = await openChannel();
    await userEvent.click(authorButton());
    const card = await screen.findByRole('dialog', { name: 'Profil' });

    await userEvent.click(within(card).getByRole('button', { name: 'Nachricht' }));
    await settle(fixture);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(TestBed.inject(Router).url).toBe(`/dm/${alan.id}`);
    expect(screen.getByRole('textbox', { name: 'Nachricht an Alan Turing' })).toBeTruthy();
  });

  it('opens from the DM header', async () => {
    const { http, fixture } = await renderApp({
      url: `/dm/${alan.id}`,
      conversations: [defaultChannel, directMessage(2, ada.id), directMessage(6, alan.id)],
      users,
    });
    http.expectOne('/api/conversations/6/messages').flush({ messages: [], nextCursor: null });
    await settle(fixture);

    const header = screen.getByRole('heading', { level: 1 });
    await userEvent.click(within(header).getByRole('button', { name: /Alan Turing$/ }));

    expect(await screen.findByRole('dialog', { name: 'Profil' })).toBeTruthy();
  });

  it('works by keyboard: Enter opens, Escape closes back onto the author', async () => {
    await openChannel();
    authorButton().focus();

    await userEvent.keyboard('{Enter}');
    const card = await screen.findByRole('dialog', { name: 'Profil' });
    await waitFor(() => expect(card.contains(document.activeElement)).toBe(true));

    // user-event leaves keyCode at 0, but the CDK reads keyCode (browsers set 27).
    fireEvent.keyDown(card, { key: 'Escape', keyCode: 27 });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(authorButton()).toBe(document.activeElement));
  });

  it('shows the own profile from the user menu, without "Nachricht"', async () => {
    await renderApp({ users });

    await userEvent.click(screen.getByRole('button', { name: /^Ada Lovelace/ }));
    const menu = await screen.findByRole('menu', { name: 'Benutzermenü' });
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Profil' }));

    const card = await screen.findByRole('dialog', { name: 'Profil' });
    expect(within(card).getByRole('heading', { name: 'Ada Lovelace' })).toBeTruthy();
    expect(within(card).getByText('ada@example.com')).toBeTruthy();
    expect(within(card).queryByRole('button', { name: 'Nachricht' })).toBeNull();
    await expectNoA11yViolations();
  });
});
