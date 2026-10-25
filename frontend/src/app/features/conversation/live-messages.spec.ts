import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  ada,
  alan,
  channel,
  defaultChannel,
  message,
  renderApp,
  settle,
} from '../../../testing/app';
import { FakeIntersectionObserver } from '../../../testing/intersection-observer';
import { MessageDto } from '../../core/data/message.store';
import { shownText } from '../../../testing/shown-text';

const users = [ada, alan];

/** Opens the Default Channel with [messages] (newest first, as the API sends them) as its newest page. */
async function openChannel(messages: MessageDto[], nextCursor: string | null = null) {
  const app = await renderApp({ url: '/channel/1', conversations: [defaultChannel], users });
  app.http.expectOne('/api/conversations/1/messages').flush({ messages, nextCursor });
  await settle(app.fixture);
  return app;
}

/** Each shown Message's text; the tests' texts are one word, which follows the author and time. */
function shownTexts(): string[] {
  const log = screen.getByRole('region', { name: 'Nachrichten' });
  return within(log)
    .queryAllByRole('listitem')
    .map((item) => shownText(item).split(' ').at(-1) ?? '');
}

describe('Live Messages', () => {
  it('shows a Message another User sends to the open Channel', async () => {
    const { realtime, fixture } = await openChannel([message(1, 'Erste')]);

    realtime.emit({
      type: 'message.created',
      message: message(2, 'Live', { authorId: alan.id }),
      thread: null,
    });
    await settle(fixture);

    expect(shownTexts()).toEqual(['Erste', 'Live']);
  });

  it("doesn't show a Message of another Conversation in the open one", async () => {
    const { realtime, fixture } = await openChannel([message(1, 'Erste')]);

    realtime.emit({
      type: 'message.created',
      message: message(2, 'Woanders', { conversationId: 3 }),
      thread: null,
    });
    await settle(fixture);

    expect(shownTexts()).toEqual(['Erste']);
  });

  it('shows a sent Message once when its echo arrives after the response', async () => {
    const user = userEvent.setup();
    const { realtime, http, fixture } = await openChannel([]);

    await user.type(composer(), 'Hallo{Enter}');
    http.expectOne('/api/conversations/1/messages').flush(message(1, 'Hallo'));
    await settle(fixture);
    realtime.emit({ type: 'message.created', message: message(1, 'Hallo'), thread: null });
    await settle(fixture);

    expect(shownTexts()).toEqual(['Hallo']);
  });

  it('shows a sent Message once when its echo arrives before the response', async () => {
    const user = userEvent.setup();
    const { realtime, http, fixture } = await openChannel([]);

    await user.type(composer(), 'Hallo{Enter}');
    realtime.emit({ type: 'message.created', message: message(1, 'Hallo'), thread: null });
    await settle(fixture);
    http.expectOne('/api/conversations/1/messages').flush(message(1, 'Hallo'));
    await settle(fixture);

    expect(shownTexts()).toEqual(['Hallo']);
  });
});

describe('Catching up after a reconnect', () => {
  it('refetches the sidebar and the open Channel and merges what was missed', async () => {
    const { realtime, http, fixture } = await openChannel([message(1, 'Erste')]);

    realtime.reconnect();
    (await vi.waitFor(() => http.expectOne('/api/conversations'))).flush([
      defaultChannel,
      channel(3, 'Neuland'),
    ]);
    http
      .expectOne('/api/conversations/1/messages')
      .flush({ messages: [message(2, 'Verpasst'), message(1, 'Erste')], nextCursor: null });
    await settle(fixture);

    expect(shownTexts()).toEqual(['Erste', 'Verpasst']);
    expect(screen.getByRole('link', { name: 'Neuland' })).toBeTruthy();
  });

  it('keeps the older pages already scrolled to', async () => {
    const { realtime, http, fixture } = await openChannel([message(60, 'Neu')], 'b2xkZXI');
    FakeIntersectionObserver.scrollIntoView(screen.getByTestId('older-messages'));
    await settle(fixture);
    http
      .expectOne('/api/conversations/1/messages?cursor=b2xkZXI')
      .flush({ messages: [message(59, 'Alt')], nextCursor: null });
    await settle(fixture);

    realtime.reconnect();
    (await vi.waitFor(() => http.expectOne('/api/conversations'))).flush([defaultChannel]);
    http
      .expectOne('/api/conversations/1/messages')
      .flush({ messages: [message(61, 'Verpasst'), message(60, 'Neu')], nextCursor: 'bmV1' });
    await settle(fixture);

    expect(shownTexts()).toEqual(['Alt', 'Neu', 'Verpasst']);
  });

  it('starts over at the newest page when more was missed than a page holds', async () => {
    const { realtime, http, fixture } = await openChannel([message(1, 'Erste')]);

    realtime.reconnect();
    (await vi.waitFor(() => http.expectOne('/api/conversations'))).flush([defaultChannel]);
    http.expectOne('/api/conversations/1/messages').flush({
      messages: [message(100, 'Neueste'), message(51, 'Älteste')],
      nextCursor: 'bHVlY2tl',
    });
    await settle(fixture);
    expect(shownTexts()).toEqual(['Älteste', 'Neueste']);

    // The Messages between the page and the window are reached by scrolling up, as usual.
    FakeIntersectionObserver.scrollIntoView(screen.getByTestId('older-messages'));
    await settle(fixture);
    http
      .expectOne('/api/conversations/1/messages?cursor=bHVlY2tl')
      .flush({ messages: [message(50, 'Dazwischen')], nextCursor: null });
    await settle(fixture);
    expect(shownTexts()).toEqual(['Dazwischen', 'Älteste', 'Neueste']);
  });

  it('still starts over when a live Message arrives while it catches up', async () => {
    const { realtime, http, fixture } = await openChannel([message(1, 'Erste')]);

    realtime.reconnect();
    const sidebar = await vi.waitFor(() => http.expectOne('/api/conversations'));
    realtime.emit({ type: 'message.created', message: message(101, 'Live'), thread: null });
    sidebar.flush([defaultChannel]);
    http.expectOne('/api/conversations/1/messages').flush({
      messages: [message(101, 'Live'), message(100, 'Neueste'), message(52, 'Älteste')],
      nextCursor: 'bHVlY2tl',
    });
    await settle(fixture);

    expect(shownTexts()).toEqual(['Älteste', 'Neueste', 'Live']);
  });

  it('still starts over when the User sent a Message while disconnected', async () => {
    const user = userEvent.setup();
    const { realtime, http, fixture } = await openChannel([message(1, 'Erste')]);
    await user.type(composer(), 'Offline{Enter}');
    http.expectOne('/api/conversations/1/messages').flush(message(101, 'Offline'));
    await settle(fixture);

    realtime.reconnect();
    (await vi.waitFor(() => http.expectOne('/api/conversations'))).flush([defaultChannel]);
    http.expectOne('/api/conversations/1/messages').flush({
      messages: [message(101, 'Offline'), message(100, 'Neueste'), message(52, 'Älteste')],
      nextCursor: 'bHVlY2tl',
    });
    await settle(fixture);

    expect(shownTexts()).toEqual(['Älteste', 'Neueste', 'Offline']);
  });
});

function composer(): HTMLTextAreaElement {
  return screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Nachricht an #Allgemein' });
}
