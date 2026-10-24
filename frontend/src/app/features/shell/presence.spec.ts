import { screen, within } from '@testing-library/angular';
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

const conversations = [defaultChannel, directMessage(2, ada.id), directMessage(3, alan.id)];
const users = [ada, alan];

/** The Presence the sidebar shows for the DM with [name]. */
function sidebarPresence(name: string): string | null {
  const dms = within(screen.getByRole('list', { name: 'Direktnachrichten' }));
  const row = dms.getByRole('link', { name: new RegExp(name) });
  return within(row).getByRole('img').getAttribute('aria-label');
}

describe('Presence', () => {
  it('shows a User as offline until they come online, and offline again once they go', async () => {
    const { realtime, fixture } = await renderApp({ conversations, users });
    expect(sidebarPresence('Alan Turing')).toBe('Abwesend');

    realtime.emit({ type: 'presence.changed', userId: alan.id, online: true });
    await settle(fixture);
    expect(sidebarPresence('Alan Turing')).toBe('Aktiv');

    realtime.emit({ type: 'presence.changed', userId: alan.id, online: false });
    await settle(fixture);
    expect(sidebarPresence('Alan Turing')).toBe('Abwesend');
    await expectNoA11yViolations();
  });

  it('shows who is online right after connecting, and again after each reconnect', async () => {
    const { realtime, http, fixture } = await renderApp({ conversations, users });

    realtime.reconnect();
    (await vi.waitFor(() => http.expectOne('/api/presence'))).flush([ada.id, alan.id]);
    await settle(fixture);
    expect(sidebarPresence('Alan Turing')).toBe('Aktiv');

    realtime.reconnect();
    (await vi.waitFor(() => http.expectOne('/api/presence'))).flush([ada.id]);
    await settle(fixture);
    expect(sidebarPresence('Alan Turing')).toBe('Abwesend');
    expect(sidebarPresence('Ada Lovelace')).toBe('Aktiv');
  });

  it('keeps a change pushed while it catches up over the older snapshot', async () => {
    const { realtime, http, fixture } = await renderApp({ conversations, users });

    realtime.reconnect();
    const snapshot = await vi.waitFor(() => http.expectOne('/api/presence'));
    realtime.emit({ type: 'presence.changed', userId: alan.id, online: true });
    snapshot.flush([ada.id]);
    await settle(fixture);

    expect(sidebarPresence('Alan Turing')).toBe('Aktiv');
  });

  it("shows the DM partner's Presence above the DM", async () => {
    const { realtime, fixture } = await renderApp({ url: `/dm/${alan.id}`, conversations, users });

    realtime.emit({ type: 'presence.changed', userId: alan.id, online: true });
    await settle(fixture);

    const heading = within(screen.getByRole('main')).getByRole('heading', { name: /Alan Turing/ });
    expect(within(heading).getByRole('img').getAttribute('aria-label')).toBe('Aktiv');
    await expectNoA11yViolations();
  });

  it("shows each Message author's Presence", async () => {
    const { realtime, http, fixture } = await renderApp({
      url: '/channel/1',
      conversations,
      users,
    });
    http.expectOne('/api/conversations/1/messages').flush({
      messages: [message(2, 'Hallo', { authorId: alan.id }), message(1, 'Hi')],
      nextCursor: null,
    });
    realtime.emit({ type: 'presence.changed', userId: alan.id, online: true });
    await settle(fixture);

    const log = within(screen.getByRole('region', { name: 'Nachrichten' }));
    const presences = log
      .getAllByRole('listitem')
      .map((item) => within(item).getByRole('img').getAttribute('aria-label'));
    expect(presences).toEqual(['Abwesend', 'Aktiv']);
    await expectNoA11yViolations();
  });

  it("shows the User's own Presence in the user menu", async () => {
    const { realtime, fixture } = await renderApp({ conversations, users });

    realtime.emit({ type: 'presence.changed', userId: ada.id, online: true });
    await settle(fixture);

    const menu = screen.getByRole('button', { name: /Ada Lovelace/ });
    expect(within(menu).getByRole('img').getAttribute('aria-label')).toBe('Aktiv');
  });
});
