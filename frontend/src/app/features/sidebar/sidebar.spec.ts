import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { expectNoA11yViolations } from '../../../testing/a11y';
import {
  ada,
  alan,
  channel,
  defaultChannel,
  directMessage,
  grace,
  message,
  renderApp,
  settle,
} from '../../../testing/app';

const conversations = [
  channel(3, 'Zeta'),
  directMessage(2, ada.id),
  channel(4, 'entwicklerteam'),
  defaultChannel,
  channel(5, 'Büro'),
];

function linkNames(listName: string): string[] {
  const list = screen.getByRole('list', { name: listName });
  return within(list)
    .getAllByRole('link')
    .map((link) => link.textContent.trim());
}

describe('Sidebar', () => {
  it('pins the Default Channel first as "Allgemein", then sorts Channels alphabetically', async () => {
    await renderApp({ conversations });

    expect(linkNames('Channels')).toEqual(['Allgemein', 'Büro', 'entwicklerteam', 'Zeta']);
    await expectNoA11yViolations();
  });

  it('calls the Default Channel "General" in English', async () => {
    await renderApp({ conversations, lang: 'en' });

    expect(linkNames('Channels')[0]).toBe('General');
    await expectNoA11yViolations();
  });

  it('lists the self-DM marked "(Du)" on top of the Direct Messages', async () => {
    await renderApp({ conversations });

    expect(linkNames('Direktnachrichten')).toEqual(['Ada Lovelace (Du)']);
    await expectNoA11yViolations();
  });

  it('orders the other DMs by latest activity, below the self-DM', async () => {
    await renderApp({
      conversations: [
        directMessage(6, alan.id, '2026-01-15T09:00:00Z'),
        directMessage(2, ada.id, '2026-01-01T09:00:00Z'),
        directMessage(5, grace.id, '2026-01-15T10:00:00Z'),
      ],
      users: [ada, alan, grace],
    });

    expect(linkNames('Direktnachrichten')).toEqual([
      'Ada Lovelace (Du)',
      'Grace Hopper',
      'Alan Turing',
    ]);
  });

  it('adds a new DM from another User live', async () => {
    const { realtime, fixture } = await renderApp({
      conversations: [directMessage(2, ada.id)],
      users: [ada, alan],
    });

    realtime.emit({ type: 'conversation.upserted', conversation: directMessage(8, alan.id) });
    await settle(fixture);

    expect(linkNames('Direktnachrichten')).toEqual(['Ada Lovelace (Du)', 'Alan Turing']);
  });

  it('links each row to its Conversation', async () => {
    await renderApp({ conversations });
    const channels = within(screen.getByRole('list', { name: 'Channels' }));
    const dms = within(screen.getByRole('list', { name: 'Direktnachrichten' }));

    expect(channels.getByRole('link', { name: 'Büro' }).getAttribute('href')).toBe('/channel/5');
    expect(dms.getByRole('link', { name: /Ada Lovelace \(Du\)$/ }).getAttribute('href')).toBe(
      `/dm/${ada.id}`,
    );
    await expectNoA11yViolations();
  });

  describe('unread counts', () => {
    const unread = {
      conversations: [
        { conversationId: 4, count: 3 },
        { conversationId: 5, count: 120 },
        { conversationId: 6, count: 1 },
      ],
      threads: [],
    };
    const withDm = [...conversations, directMessage(6, alan.id)];

    it('shows a count bubble on each row with Unread Messages, 99+ above 99, and says so in its name', async () => {
      await renderApp({ conversations: withDm, users: [ada, alan], unread });
      const channels = within(screen.getByRole('list', { name: 'Channels' }));
      const dms = within(screen.getByRole('list', { name: 'Direktnachrichten' }));

      const team = channels.getByRole('link', { name: 'entwicklerteam, 3 ungelesene Nachrichten' });
      expect(within(team).getByText('3')).toBeTruthy();
      const office = channels.getByRole('link', { name: 'Büro, 120 ungelesene Nachrichten' });
      expect(within(office).getByText('99+')).toBeTruthy();
      expect(channels.getByRole('link', { name: 'Zeta' })).toBeTruthy();
      expect(dms.getByRole('link', { name: /Alan Turing, 1 ungelesene Nachricht$/ })).toBeTruthy();
      await expectNoA11yViolations();
    });

    it('counts up live when another User sends to a Conversation that is not open', async () => {
      const { realtime, fixture } = await renderApp({ conversations });

      realtime.emit({
        type: 'message.created',
        message: message(1, 'Hallo', { conversationId: 3, authorId: alan.id }),
        thread: null,
      });
      await settle(fixture);

      expect(screen.getByRole('link', { name: 'Zeta, 1 ungelesene Nachricht' })).toBeTruthy();
    });

    it('shows the total on a collapsed section', async () => {
      const user = userEvent.setup();
      await renderApp({ conversations: withDm, users: [ada, alan], unread, lang: 'en' });

      await user.click(screen.getByRole('button', { name: 'Channels' }));
      await user.click(screen.getByRole('button', { name: 'Direct messages' }));

      const channels = screen.getByRole('button', { name: 'Channels, 123 unread messages' });
      expect(within(channels).getByText('99+')).toBeTruthy();
      const dms = screen.getByRole('button', { name: 'Direct messages, 1 unread message' });
      expect(within(dms).getByText('1')).toBeTruthy();
      await expectNoA11yViolations();
    });
  });
});
