import { TestBed } from '@angular/core/testing';
import {
  ada,
  alan,
  channel,
  defaultChannel,
  directMessage,
  message,
  renderApp,
  reply,
  settle,
} from '../../../testing/app';
import { resetTabVisibility, setTabVisible } from '../../../testing/visibility';
import { ReadStore, UnreadDto } from './read.store';

const conversations = [defaultChannel, channel(3, 'Marketing'), directMessage(2, ada.id)];
const users = [ada, alan];

async function start(options: { url?: string; unread?: UnreadDto } = {}) {
  const app = await renderApp({ conversations, users, ...options });
  return { ...app, reads: TestBed.inject(ReadStore) };
}

/** Opens the Default Channel with no Messages. */
async function openDefaultChannel(unread?: UnreadDto) {
  const app = await start({ url: '/channel/1', unread });
  app.http.expectOne('/api/conversations/1/messages').flush({ messages: [], nextCursor: null });
  await settle(app.fixture);
  return app;
}

const fromAlan = { authorId: alan.id };

describe('ReadStore', () => {
  afterEach(() => {
    resetTabVisibility();
    vi.unstubAllGlobals();
  });

  it('starts from what the server counts', async () => {
    const { reads } = await start({
      unread: {
        conversations: [{ conversationId: 3, count: 4 }],
        threads: [{ conversationId: 3, parentMessageId: 7, count: 2 }],
      },
    });

    expect(reads.unreadIn(3)).toBe(4);
    expect(reads.unreadIn(1)).toBe(0);
    expect(reads.unreadRepliesIn(7)).toBe(2);
  });

  it("counts others' Messages and Replies pushed to a Conversation that isn't open, but not the User's own", async () => {
    const { reads, realtime, fixture } = await start();

    realtime.emit({
      type: 'message.created',
      message: message(1, 'Hallo', { conversationId: 3, ...fromAlan }),
      thread: null,
    });
    realtime.emit({
      type: 'message.created',
      message: reply(2, 1, 'Antwort', { conversationId: 3, ...fromAlan }),
      thread: { parentMessageId: 1, replyCount: 1, lastReplyAt: '2026-01-15T14:25:00Z' },
    });
    realtime.emit({
      type: 'message.created',
      message: message(3, 'Eigene', { conversationId: 3 }),
      thread: null,
    });
    await settle(fixture);

    expect(reads.unreadIn(3)).toBe(2);
    expect(reads.unreadRepliesIn(1)).toBe(1);
  });

  it('clears a count when the User read it in another tab', async () => {
    const { reads, realtime, fixture } = await start({
      unread: {
        conversations: [{ conversationId: 3, count: 4 }],
        threads: [{ conversationId: 3, parentMessageId: 7, count: 2 }],
      },
    });

    realtime.emit({ type: 'read.updated', conversationId: 3, parentMessageId: 7, readAt: '' });
    await settle(fixture);
    expect([reads.unreadIn(3), reads.unreadRepliesIn(7)]).toEqual([4, 0]);

    realtime.emit({ type: 'read.updated', conversationId: 3, parentMessageId: null, readAt: '' });
    await settle(fixture);
    expect(reads.unreadIn(3)).toBe(0);
  });

  it('marks a Conversation with Unread Messages read on opening it, and clears its count', async () => {
    const { reads, http } = await openDefaultChannel({
      conversations: [{ conversationId: 1, count: 3 }],
      threads: [],
    });

    const request = http.expectOne('/api/conversations/1/read');
    expect(request.request.method).toBe('PUT');
    expect(reads.unreadIn(1)).toBe(0);
  });

  it("doesn't count up the open, visible Conversation, and marks it read about a second later", async () => {
    const { reads, realtime, http, fixture } = await openDefaultChannel();

    realtime.emit({ type: 'message.created', message: message(1, 'Live', fromAlan), thread: null });
    realtime.emit({ type: 'message.created', message: message(2, 'Noch', fromAlan), thread: null });
    await settle(fixture);
    expect(reads.unreadIn(1)).toBe(0);
    http.expectNone('/api/conversations/1/read');

    // Debounced: the two Messages mark it read once.
    await vi.waitFor(() => http.expectOne('/api/conversations/1/read'), { timeout: 2000 });
  });

  it('counts up the open Conversation while the tab is hidden, and marks it read when it shows again', async () => {
    const { reads, realtime, http, fixture } = await openDefaultChannel();
    setTabVisible(false);

    realtime.emit({ type: 'message.created', message: message(1, 'Live', fromAlan), thread: null });
    await settle(fixture);
    expect(reads.unreadIn(1)).toBe(1);

    setTabVisible(true);
    await settle(fixture);
    http.expectOne('/api/conversations/1/read');
    expect(reads.unreadIn(1)).toBe(0);
  });

  it('marks the open Conversation read at once when the tab hides before the second is up', async () => {
    const { realtime, http, fixture } = await openDefaultChannel();

    realtime.emit({ type: 'message.created', message: message(1, 'Live', fromAlan), thread: null });
    await settle(fixture);
    setTabVisible(false);
    await settle(fixture);

    http.expectOne('/api/conversations/1/read');
  });

  it('marks the Conversation read at once when the User leaves it before the second is up', async () => {
    const { realtime, http, fixture, navigate } = await openDefaultChannel();

    realtime.emit({ type: 'message.created', message: message(1, 'Live', fromAlan), thread: null });
    await settle(fixture);
    await navigate('/channel/3');
    await settle(fixture);

    http.expectOne('/api/conversations/1/read');
  });

  it('counts the Conversation behind the Thread on a narrow screen, where the Thread replaces it', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query }));
    const { reads, realtime, http, fixture } = await start({ url: '/channel/1/thread/5' });
    http.expectOne('/api/conversations/1/messages').flush({ messages: [], nextCursor: null });
    http
      .expectOne('/api/conversations/1/messages/5/replies')
      .flush({ parent: message(5, 'Frage'), replies: [], nextCursor: null });
    await settle(fixture);

    realtime.emit({ type: 'message.created', message: message(1, 'Oben', fromAlan), thread: null });
    await settle(fixture);

    expect(reads.unreadIn(1)).toBe(1);
  });

  it('marks the open Thread read on opening it and while Replies arrive', async () => {
    const { reads, realtime, http, fixture } = await start({
      url: '/channel/1/thread/5',
      unread: { conversations: [], threads: [{ conversationId: 1, parentMessageId: 5, count: 2 }] },
    });
    http.expectOne('/api/conversations/1/messages').flush({ messages: [], nextCursor: null });
    http
      .expectOne('/api/conversations/1/messages/5/replies')
      .flush({ parent: message(5, 'Frage'), replies: [], nextCursor: null });
    await settle(fixture);

    http.expectOne('/api/conversations/1/messages/5/replies/read');
    expect(reads.unreadRepliesIn(5)).toBe(0);

    realtime.emit({
      type: 'message.created',
      message: reply(6, 5, 'Antwort', fromAlan),
      thread: { parentMessageId: 5, replyCount: 1, lastReplyAt: '2026-01-15T14:25:00Z' },
    });
    await settle(fixture);
    expect(reads.unreadRepliesIn(5)).toBe(0);
    await vi.waitFor(() => http.expectOne('/api/conversations/1/messages/5/replies/read'), {
      timeout: 2000,
    });
  });

  it('takes the counts the server sends again on a reconnect', async () => {
    const { reads, realtime, http, fixture } = await start({
      unread: { conversations: [{ conversationId: 3, count: 4 }], threads: [] },
    });

    realtime.reconnect();
    (await vi.waitFor(() => http.expectOne('/api/conversations/unread'))).flush({
      conversations: [{ conversationId: 2, count: 1 }],
      threads: [],
    } satisfies UnreadDto);
    await settle(fixture);

    expect([reads.unreadIn(3), reads.unreadIn(2)]).toEqual([0, 1]);
  });
});
