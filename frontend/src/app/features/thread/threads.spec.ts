import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { expectNoA11yViolations } from '../../../testing/a11y';
import { ada, alan, defaultChannel, message, renderApp, reply, settle } from '../../../testing/app';
import { MessageDto } from '../../core/data/message.store';

const users = [ada, alan];
const lastReplyAt = new Date(2026, 0, 15, 14, 56).toISOString();

/** A Message by Alan with [replyCount] Replies, the last at 14:56. */
function question(replyCount = 2): MessageDto {
  return {
    ...message(1, 'Welche Version ist aktuell?', { authorId: alan.id }),
    replyCount,
    lastReplyAt: replyCount > 0 ? lastReplyAt : null,
  };
}

/** Opens the Default Channel at [url] with [messages] (newest first) as its newest page. */
async function openChannel(messages: MessageDto[], url = '/channel/1') {
  const app = await renderApp({ url, conversations: [defaultChannel], users });
  app.http.expectOne('/api/conversations/1/messages').flush({ messages, nextCursor: null });
  await settle(app.fixture);
  return app;
}

function conversation(): HTMLElement {
  return screen.getByRole('main');
}

function threadPane(): HTMLElement {
  return screen.getByRole('complementary', { name: 'Thread' });
}

/** What [element] shows, with whitespace collapsed; a closed ⋮ popover shows nothing. */
function shownText(element: HTMLElement): string {
  const shown = element.cloneNode(true) as HTMLElement;
  shown.querySelectorAll('[role=menu][hidden]').forEach((menu) => menu.remove());
  return shown.textContent.replace(/\s+/g, ' ').trim();
}

/** The Thread's parent and Replies, as shown. */
function threadMessages(): HTMLElement {
  return within(threadPane()).getByRole('region', { name: 'Nachrichten im Thread' });
}

describe('Threads', () => {
  it('shows the reply count and the time of the last Reply under a Message', async () => {
    await openChannel([question()]);

    const link = within(conversation()).getByRole('link', { name: /2 Antworten/ });
    expect(link.textContent.replace(/\s+/g, ' ').trim()).toBe('2 Antworten Letzte Antwort 14:56');
    await expectNoA11yViolations();
  });

  it('opens the Thread from "N Antworten", with the parent above its Replies', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await openChannel([question()]);

    await user.click(within(conversation()).getByRole('link', { name: /2 Antworten/ }));
    (await vi.waitFor(() => http.expectOne('/api/conversations/1/messages/1/replies'))).flush({
      parent: question(),
      replies: [
        reply(3, 1, 'Ja, die 22', { authorId: ada.id }),
        reply(2, 1, 'Die 22?', { authorId: alan.id }),
      ],
      nextCursor: null,
    });
    await settle(fixture);

    expect(shownText(threadMessages())).toBe(
      'Alan Turing 14:25 Uhr Welche Version ist aktuell? 2 Antworten ' +
        'Alan Turing 14:25 Uhr Die 22? Ada Lovelace 14:25 Uhr Ja, die 22',
    );
    await expectNoA11yViolations();
  });

  it('opens a Thread from the hover menu, with focus in its composer, and sends a Reply', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await openChannel([message(1, 'Frage', { authorId: alan.id })]);

    await user.click(within(conversation()).getByRole('link', { name: 'Im Thread antworten' }));
    (await vi.waitFor(() => http.expectOne('/api/conversations/1/messages/1/replies'))).flush({
      parent: message(1, 'Frage', { authorId: alan.id }),
      replies: [],
      nextCursor: null,
    });
    await settle(fixture);

    const composer = within(threadPane()).getByRole('textbox', { name: 'Antworten …' });
    expect(document.activeElement).toBe(composer);
    await user.keyboard('Meine Antwort{Enter}');
    const request = http.expectOne('/api/conversations/1/messages/1/replies');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ text: 'Meine Antwort' });
    request.flush(reply(2, 1, 'Meine Antwort'));
    await settle(fixture);

    expect(shownText(threadMessages())).toBe(
      'Alan Turing 14:25 Uhr Frage Ada Lovelace 14:25 Uhr Meine Antwort',
    );
    expect((composer as HTMLTextAreaElement).value).toBe('');
    // Replies have no Thread of their own.
    expect(within(threadPane()).queryByRole('link', { name: 'Im Thread antworten' })).toBeNull();
  });

  it('shows a live Reply in the open Thread, and the new count under its parent everywhere', async () => {
    const { http, realtime, fixture } = await openChannel([question(1)], '/channel/1/thread/1');
    (await vi.waitFor(() => http.expectOne('/api/conversations/1/messages/1/replies'))).flush({
      parent: question(1),
      replies: [reply(2, 1, 'Erste')],
      nextCursor: null,
    });
    await settle(fixture);

    const at = new Date(2026, 0, 15, 15, 30).toISOString();
    realtime.emit({
      type: 'message.created',
      message: reply(3, 1, 'Zweite', { authorId: alan.id, createdAt: at }),
      thread: { parentMessageId: 1, replyCount: 2, lastReplyAt: at },
    });
    // A late event for the first Reply doesn't take the count back.
    realtime.emit({
      type: 'message.created',
      message: reply(2, 1, 'Erste'),
      thread: { parentMessageId: 1, replyCount: 1, lastReplyAt },
    });
    await settle(fixture);

    expect(within(conversation()).getByRole('link', { name: /Antwort/ }).textContent).toMatch(
      /2 Antworten\s+Letzte Antwort 15:30/,
    );
    expect(shownText(threadMessages())).toBe(
      'Alan Turing 14:25 Uhr Welche Version ist aktuell? 2 Antworten ' +
        'Ada Lovelace 14:25 Uhr Erste Alan Turing 15:30 Uhr Zweite',
    );
    // Replies stay in their Thread.
    expect(within(conversation()).queryByText('Zweite')).toBeNull();
  });

  it("keeps a Deleted Message's Thread link and lets the User reply to it", async () => {
    const deleted = { ...question(), text: '', deletedAt: lastReplyAt };
    await openChannel([deleted]);

    expect(within(conversation()).getByText('Diese Nachricht wurde gelöscht.')).toBeTruthy();
    expect(within(conversation()).getByRole('link', { name: /2 Antworten/ })).toBeTruthy();
    expect(within(conversation()).getByRole('link', { name: 'Im Thread antworten' })).toBeTruthy();
    await expectNoA11yViolations();
  });

  it('keeps a draft per Thread', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await openChannel(
      [message(2, 'Zweite Frage', { authorId: alan.id }), question(0)],
      '/channel/1/thread/1',
    );
    (await vi.waitFor(() => http.expectOne('/api/conversations/1/messages/1/replies'))).flush({
      parent: question(0),
      replies: [],
      nextCursor: null,
    });
    await settle(fixture);
    await user.type(within(threadPane()).getByRole('textbox', { name: 'Antworten …' }), 'Entwurf');

    const links = within(conversation()).getAllByRole('link', { name: 'Im Thread antworten' });
    await user.click(links[1]);
    (await vi.waitFor(() => http.expectOne('/api/conversations/1/messages/2/replies'))).flush({
      parent: message(2, 'Zweite Frage', { authorId: alan.id }),
      replies: [],
      nextCursor: null,
    });
    await settle(fixture);
    const composer = () =>
      within(threadPane()).getByRole<HTMLTextAreaElement>('textbox', { name: 'Antworten …' });
    expect(composer().value).toBe('');

    await user.click(links[0]);
    (await vi.waitFor(() => http.expectOne('/api/conversations/1/messages/1/replies'))).flush({
      parent: question(0),
      replies: [],
      nextCursor: null,
    });
    await settle(fixture);
    expect(composer().value).toBe('Entwurf');
  });

  it('refetches the open Thread after a reconnect and merges what was missed', async () => {
    const { http, realtime, fixture } = await openChannel([question(1)], '/channel/1/thread/1');
    (await vi.waitFor(() => http.expectOne('/api/conversations/1/messages/1/replies'))).flush({
      parent: question(1),
      replies: [reply(2, 1, 'Erste')],
      nextCursor: null,
    });
    await settle(fixture);

    realtime.reconnect();
    (await vi.waitFor(() => http.expectOne('/api/conversations'))).flush([defaultChannel]);
    http
      .expectOne('/api/conversations/1/messages')
      .flush({ messages: [question(2)], nextCursor: null });
    http.expectOne('/api/conversations/1/messages/1/replies').flush({
      parent: question(2),
      replies: [reply(3, 1, 'Verpasst', { authorId: alan.id }), reply(2, 1, 'Erste')],
      nextCursor: null,
    });
    await settle(fixture);

    expect(shownText(threadMessages())).toBe(
      'Alan Turing 14:25 Uhr Welche Version ist aktuell? 2 Antworten ' +
        'Ada Lovelace 14:25 Uhr Erste Alan Turing 14:25 Uhr Verpasst',
    );
  });

  it('sends the User away with a toast when the Thread is gone', async () => {
    const { http, fixture } = await openChannel([], '/channel/1/thread/9');

    (await vi.waitFor(() => http.expectOne('/api/conversations/1/messages/9/replies'))).flush(
      { code: 'NOT_FOUND' },
      { status: 404, statusText: 'Not Found' },
    );
    await settle(fixture);

    expect(screen.queryByRole('complementary', { name: 'Thread' })).toBeNull();
    expect(screen.getByText(/gibt es nicht/)).toBeTruthy();
  });

  it('shows the parent on top while older Replies are still to load', async () => {
    const { http, fixture } = await openChannel([question(51)], '/channel/1/thread/1');
    (await vi.waitFor(() => http.expectOne('/api/conversations/1/messages/1/replies'))).flush({
      parent: question(51),
      replies: [reply(52, 1, 'Neueste')],
      nextCursor: 'b2xkZXI',
    });
    await settle(fixture);

    expect(shownText(threadMessages())).toBe(
      'Alan Turing 14:25 Uhr Welche Version ist aktuell? 51 Antworten Ada Lovelace 14:25 Uhr Neueste',
    );
  });
});
