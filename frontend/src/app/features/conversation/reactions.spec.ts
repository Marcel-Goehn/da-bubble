import { screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { expectNoA11yViolations } from '../../../testing/a11y';
import { ada, alan, defaultChannel, grace, message, renderApp, settle } from '../../../testing/app';
import { MessageDto } from '../../core/data/message.store';

const users = [ada, alan, grace];

/** Opens the Default Channel with [messages] (newest first, as the API sends them) as its newest page. */
async function openChannel(messages: MessageDto[]) {
  const app = await renderApp({ url: '/channel/1', conversations: [defaultChannel], users });
  app.http.expectOne('/api/conversations/1/messages').flush({ messages, nextCursor: null });
  await settle(app.fixture);
  return app;
}

/** The list item of the Message showing [text]. */
function shownMessage(text: string): HTMLElement {
  const log = screen.getByRole('region', { name: 'Nachrichten' });
  return within(log)
    .getAllByRole('listitem')
    .find((item) => item.textContent.includes(text))!;
}

/** The tooltip text describing [element], whitespace collapsed. */
function description(element: HTMLElement): string {
  const ids = element.getAttribute('aria-describedby')?.split(' ') ?? [];
  return ids
    .map((id) => document.getElementById(id)?.textContent ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('Reactions', () => {
  it('shows each emoji with its count, and says who reacted', async () => {
    await openChannel([
      {
        ...message(1, 'Hallo', { authorId: alan.id }),
        reactions: [
          { emoji: '👍', userIds: [alan.id, ada.id] },
          { emoji: '✅', userIds: [alan.id] },
          { emoji: '🎉', userIds: [ada.id] },
          { emoji: '🚀', userIds: [alan.id, grace.id] },
        ],
      },
    ]);
    const shown = within(shownMessage('Hallo'));

    const thumbs = shown.getByRole('button', { name: '👍 2' });
    expect(thumbs.getAttribute('aria-pressed')).toBe('true');
    expect(description(thumbs)).toBe('Alan Turing und Du haben reagiert');
    const check = shown.getByRole('button', { name: '✅ 1' });
    expect(check.getAttribute('aria-pressed')).toBe('false');
    expect(description(check)).toBe('Alan Turing hat reagiert');
    expect(description(shown.getByRole('button', { name: '🎉 1' }))).toBe('Du hast reagiert');
    expect(description(shown.getByRole('button', { name: '🚀 2' }))).toBe(
      'Alan Turing und Grace Hopper haben reagiert',
    );
    await expectNoA11yViolations();
  });

  it("removes the User's Reaction when they click its chip, and adds theirs to another", async () => {
    const user = userEvent.setup();
    const sent = {
      ...message(1, 'Hallo', { authorId: alan.id }),
      reactions: [
        { emoji: '👍', userIds: [ada.id] },
        { emoji: '✅', userIds: [alan.id] },
      ],
    };
    const { http, fixture } = await openChannel([sent]);

    await user.click(within(shownMessage('Hallo')).getByRole('button', { name: '👍 1' }));
    const removal = http.expectOne('/api/conversations/1/messages/1/reactions');
    expect(removal.request.method).toBe('POST');
    expect(removal.request.body).toEqual({ emoji: '👍' });
    removal.flush({ ...sent, reactions: [{ emoji: '✅', userIds: [alan.id] }] });
    await settle(fixture);

    expect(within(shownMessage('Hallo')).queryByRole('button', { name: /^👍 \d/ })).toBeNull();

    await user.click(within(shownMessage('Hallo')).getByRole('button', { name: '✅ 1' }));
    const addition = http.expectOne('/api/conversations/1/messages/1/reactions');
    expect(addition.request.body).toEqual({ emoji: '✅' });
    addition.flush({ ...sent, reactions: [{ emoji: '✅', userIds: [alan.id, ada.id] }] });
    await settle(fixture);

    const check = within(shownMessage('Hallo')).getByRole('button', { name: '✅ 2' });
    expect(check.getAttribute('aria-pressed')).toBe('true');
  });

  it("says so when a Reaction can't be saved", async () => {
    const user = userEvent.setup();
    const { http, fixture } = await openChannel([
      { ...message(1, 'Hallo'), reactions: [{ emoji: '👍', userIds: [alan.id] }] },
    ]);

    await user.click(within(shownMessage('Hallo')).getByRole('button', { name: '👍 1' }));
    http
      .expectOne('/api/conversations/1/messages/1/reactions')
      .flush(null, { status: 500, statusText: 'Internal Server Error' });
    await settle(fixture);

    expect(screen.getByText(/Deine Reaktion konnte nicht gespeichert werden/)).toBeTruthy();
    expect(within(shownMessage('Hallo')).getByRole('button', { name: '👍 1' })).toBeTruthy();
  });

  it('shows a Reaction pushed live', async () => {
    const { realtime, fixture } = await openChannel([message(1, 'Hallo')]);

    realtime.emit({
      type: 'message.updated',
      message: { ...message(1, 'Hallo'), reactions: [{ emoji: '🎉', userIds: [alan.id] }] },
    });
    await settle(fixture);

    expect(within(shownMessage('Hallo')).getByRole('button', { name: '🎉 1' })).toBeTruthy();
  });

  it('reacts with ✅ or 👍 from the hover bar', async () => {
    const user = userEvent.setup();
    const { http } = await openChannel([message(1, 'Hallo', { authorId: alan.id })]);

    await user.click(
      within(shownMessage('Hallo')).getByRole('button', { name: 'Mit ✅ reagieren' }),
    );
    expect(http.expectOne('/api/conversations/1/messages/1/reactions').request.body).toEqual({
      emoji: '✅',
    });
    await user.click(
      within(shownMessage('Hallo')).getByRole('button', { name: 'Mit 👍 reagieren' }),
    );
    expect(http.expectOne('/api/conversations/1/messages/1/reactions').request.body).toEqual({
      emoji: '👍',
    });
  });

  it('reacts with any emoji from the picker, which closes and returns focus afterwards', async () => {
    const user = userEvent.setup();
    const { http } = await openChannel([message(1, 'Hallo', { authorId: alan.id })]);
    const add = within(shownMessage('Hallo')).getByRole('button', { name: 'Reaktion hinzufügen' });

    await user.click(add);
    const picker = await screen.findByRole('dialog', { name: 'Emoji auswählen' });
    expect(add.getAttribute('aria-expanded')).toBe('true');
    await waitFor(() => expect(picker.contains(document.activeElement)).toBe(true));
    await expectNoA11yViolations();
    await user.click(within(picker).getByRole('button', { name: '👍🏽' }));

    expect(http.expectOne('/api/conversations/1/messages/1/reactions').request.body).toEqual({
      emoji: '👍🏽',
    });
    expect(screen.queryByRole('dialog', { name: 'Emoji auswählen' })).toBeNull();
    expect(document.activeElement).toBe(add);
  });

  it('closes the picker with Escape, reacting with nothing', async () => {
    const user = userEvent.setup();
    const { http } = await openChannel([message(1, 'Hallo', { authorId: alan.id })]);
    const add = within(shownMessage('Hallo')).getByRole('button', { name: 'Reaktion hinzufügen' });

    add.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('dialog', { name: 'Emoji auswählen' });
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Emoji auswählen' })).toBeNull();
    expect(document.activeElement).toBe(add);
    http.expectNone('/api/conversations/1/messages/1/reactions');
  });

  it('works by keyboard: Tab reaches the hover bar and the chips, Enter and Space react', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await openChannel([
      {
        ...message(1, 'Hallo', { authorId: alan.id }),
        reactions: [{ emoji: '🎉', userIds: [alan.id] }],
      },
    ]);
    const shown = within(shownMessage('Hallo'));

    shown.getByRole('button', { name: 'Alan Turing' }).focus();
    await user.tab();
    expect(document.activeElement).toBe(shown.getByRole('button', { name: '🎉 1' }));
    await user.keyboard(' ');
    expect(http.expectOne('/api/conversations/1/messages/1/reactions').request.body).toEqual({
      emoji: '🎉',
    });
    await settle(fixture);

    await user.tab();
    expect(document.activeElement).toBe(shown.getByRole('button', { name: 'Mit ✅ reagieren' }));
    await user.keyboard('{Enter}');
    expect(http.expectOne('/api/conversations/1/messages/1/reactions').request.body).toEqual({
      emoji: '✅',
    });
  });

  it('offers no Reactions on a Deleted Message', async () => {
    await openChannel([
      { ...message(1, 'Hallo', { authorId: alan.id }), deletedAt: message(1, '').createdAt },
    ]);
    const shown = within(shownMessage('gelöscht'));

    expect(shown.queryByRole('button', { name: 'Mit ✅ reagieren' })).toBeNull();
    expect(shown.queryByRole('button', { name: 'Reaktion hinzufügen' })).toBeNull();
  });

  it('shows 20 Reactions in a Conversation, then "+X weitere" until expanded', async () => {
    const user = userEvent.setup();
    await openChannel([{ ...message(1, 'Hallo'), reactions: manyReactions(22) }]);
    const shown = within(shownMessage('Hallo'));

    expect(chips(shownMessage('Hallo'))).toHaveLength(20);
    await user.click(shown.getByRole('button', { name: '+2 weitere' }));
    expect(chips(shownMessage('Hallo'))).toHaveLength(22);
    await user.click(shown.getByRole('button', { name: 'Weniger anzeigen' }));
    expect(chips(shownMessage('Hallo'))).toHaveLength(20);
  });

  it('shows 7 Reactions in a Thread, then "+X weitere" until expanded', async () => {
    const user = userEvent.setup();
    const parent = { ...message(1, 'Frage'), replyCount: 1, reactions: manyReactions(9) };
    const { http, fixture } = await renderApp({
      url: '/channel/1/thread/1',
      conversations: [defaultChannel],
      users,
    });
    http.expectOne('/api/conversations/1/messages').flush({ messages: [parent], nextCursor: null });
    (await vi.waitFor(() => http.expectOne('/api/conversations/1/messages/1/replies'))).flush({
      parent,
      replies: [{ ...message(2, 'Antwort'), parentMessageId: 1 }],
      nextCursor: null,
    });
    await settle(fixture);
    const thread = screen.getByRole('region', { name: 'Nachrichten im Thread' });

    expect(chips(thread)).toHaveLength(7);
    await user.click(within(thread).getByRole('button', { name: '+2 weitere' }));
    expect(chips(thread)).toHaveLength(9);
    await user.click(within(thread).getByRole('button', { name: 'Weniger anzeigen' }));
    expect(chips(thread)).toHaveLength(7);
    await expectNoA11yViolations();
  });

  it("inserts an emoji from the composer's picker where the caret is, and keeps typing there", async () => {
    const user = userEvent.setup();
    await openChannel([]);
    const composer = screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Nachricht an #Allgemein',
    });
    await user.type(composer, 'Gute Nacht');
    composer.setSelectionRange(4, 4);

    await user.click(screen.getByRole('button', { name: 'Emoji einfügen' }));
    const picker = await screen.findByRole('dialog', { name: 'Emoji auswählen' });
    await user.click(within(picker).getByRole('button', { name: '🎉' }));

    expect(composer.value).toBe('Gute🎉 Nacht');
    expect(document.activeElement).toBe(composer);
    await user.keyboard('!');
    expect(composer.value).toBe('Gute🎉! Nacht');
    await expectNoA11yViolations();
  });
});

/** [count] Reactions by Alan, each with another emoji. */
function manyReactions(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    emoji: String.fromCodePoint(0x1f600 + index),
    userIds: [alan.id],
  }));
}

/** The Reaction chips within [element]: the pressable ones. */
function chips(element: HTMLElement): HTMLElement[] {
  return within(element)
    .getAllByRole('button')
    .filter((button) => button.hasAttribute('aria-pressed'));
}
