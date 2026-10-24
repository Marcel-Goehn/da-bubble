import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { expectNoA11yViolations } from '../../../testing/a11y';
import {
  ada,
  alan,
  channel,
  defaultChannel,
  directMessage,
  message,
  renderApp,
  RenderAppOptions,
  settle,
} from '../../../testing/app';
import { FakeIntersectionObserver } from '../../../testing/intersection-observer';
import { MessageDto } from '../../core/data/message.store';

const conversations = [defaultChannel, channel(3, 'Entwicklerteam'), directMessage(2, ada.id)];
const users = [ada, alan];

/** Opens [url] and answers its newest page with [messages] (newest first, as the API sends them). */
async function openChannel(
  messages: MessageDto[],
  { nextCursor = null, ...options }: RenderAppOptions & { nextCursor?: string | null } = {},
) {
  const app = await renderApp({ url: '/channel/1', conversations, users, ...options });
  app.http.expectOne('/api/conversations/1/messages').flush({ messages, nextCursor });
  await settle(app.fixture);
  return app;
}

function shownMessages(label = 'Nachrichten'): string[] {
  const log = screen.getByRole('region', { name: label });
  return within(log)
    .queryAllByRole('listitem')
    .map((item) => item.textContent.replace(/\s+/g, ' ').trim());
}

function composer(name = 'Nachricht an #Allgemein'): HTMLTextAreaElement {
  return screen.getByRole<HTMLTextAreaElement>('textbox', { name });
}

function toast(): string | undefined {
  return screen.queryByRole('button', { name: 'Hinweis schließen' })?.parentElement?.textContent;
}

describe('Reading a Channel', () => {
  it('shows its Messages oldest first, each with author and time', async () => {
    await openChannel([
      message(2, 'Ja, Angular 22.', { createdAt: new Date(2026, 0, 15, 15, 6).toISOString() }),
      message(1, 'Welche Version ist aktuell?', { authorId: alan.id }),
    ]);

    expect(shownMessages()).toEqual([
      'Alan Turing 14:25 Uhr Welche Version ist aktuell?',
      'Ada Lovelace 15:06 Uhr Ja, Angular 22.',
    ]);
    await expectNoA11yViolations();
  });

  it('shows the time in the active language', async () => {
    await openChannel([message(1, 'Hello')], { lang: 'en' });

    expect(shownMessages('Messages')).toEqual(['Ada Lovelace 2:25 PM Hello']);
  });

  it('loads the older page when the User scrolls to the top', async () => {
    const { http, fixture } = await openChannel([message(60, 'Neu')], { nextCursor: 'b2xkZXI' });

    FakeIntersectionObserver.scrollIntoView(screen.getByTestId('older-messages'));
    await settle(fixture);
    http
      .expectOne('/api/conversations/1/messages?cursor=b2xkZXI')
      .flush({ messages: [message(59, 'Alt')], nextCursor: null });
    await settle(fixture);

    expect(shownMessages().map((text) => text.split(' ').at(-1))).toEqual(['Alt', 'Neu']);
    FakeIntersectionObserver.scrollIntoView(screen.getByTestId('older-messages'));
    await settle(fixture);
    http.verify();
  });

  it("doesn't load an older page just because the top was in view while the list was empty", async () => {
    const { http, fixture } = await renderApp({ url: '/channel/1', conversations, users });

    // A real observer reports the empty list's top as in view; once the newest page is laid out, it isn't.
    FakeIntersectionObserver.scrollIntoView(screen.getByTestId('older-messages'));
    http
      .expectOne('/api/conversations/1/messages')
      .flush({ messages: [message(60, 'Neu')], nextCursor: 'b2xkZXI' });
    await settle(fixture);

    http.verify();
  });

  it('asks for nothing older at the beginning of the Channel', async () => {
    const { http, fixture } = await openChannel([message(1, 'Erste')]);

    FakeIntersectionObserver.scrollIntoView(screen.getByTestId('older-messages'));
    await settle(fixture);

    http.verify();
  });
});

/**
 * jsdom doesn't lay out, so the list's box is given a fixed 400 px view and a content height the test
 * grows as Messages go in. jsdom does keep `scrollTop`, which is what the User sees.
 */
function fakeLayout(): {
  list: HTMLElement;
  setContentHeight(px: number): void;
  scrollTo(px: number): void;
} {
  const list = screen.getByRole('region', { name: 'Nachrichten' });
  let contentHeight = 400;
  Object.defineProperty(list, 'clientHeight', { get: () => 400 });
  Object.defineProperty(list, 'scrollHeight', { get: () => contentHeight });
  return {
    list,
    setContentHeight: (px) => (contentHeight = px),
    scrollTo: (px) => {
      list.scrollTop = px;
      list.dispatchEvent(new Event('scroll'));
    },
  };
}

describe('Scrolling a Channel', () => {
  it('follows a new Message while the User is at the bottom', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await openChannel([message(1, 'Erste')]);
    const layout = fakeLayout();
    layout.setContentHeight(1000);
    layout.scrollTo(600);

    await user.type(composer(), 'Neu{Enter}');
    layout.setContentHeight(1100);
    http.expectOne('/api/conversations/1/messages').flush(message(2, 'Neu'));
    await settle(fixture);

    expect(layout.list.scrollTop).toBe(1100);
  });

  it('stays where the User reads when a new Message arrives while scrolled up', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await openChannel([message(1, 'Erste')]);
    const layout = fakeLayout();
    layout.setContentHeight(1000);
    layout.scrollTo(100);

    await user.type(composer(), 'Neu{Enter}');
    layout.setContentHeight(1100);
    http.expectOne('/api/conversations/1/messages').flush(message(2, 'Neu'));
    await settle(fixture);

    expect(layout.list.scrollTop).toBe(100);
  });

  it('keeps the same Messages in view when an older page goes in above', async () => {
    const { http, fixture } = await openChannel([message(60, 'Neu')], { nextCursor: 'b2xkZXI' });
    const layout = fakeLayout();
    layout.setContentHeight(1000);
    layout.scrollTo(0);

    FakeIntersectionObserver.scrollIntoView(screen.getByTestId('older-messages'));
    await settle(fixture);
    layout.setContentHeight(1500);
    http
      .expectOne('/api/conversations/1/messages?cursor=b2xkZXI')
      .flush({ messages: [message(59, 'Alt')], nextCursor: null });
    await settle(fixture);

    expect(layout.list.scrollTop).toBe(500);
  });
});

describe('Sending a Message', () => {
  it('sends with Enter, shows the Message and empties the composer', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await openChannel([]);

    await user.type(composer(), 'Hallo zusammen{Enter}');
    const request = http.expectOne('/api/conversations/1/messages');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ text: 'Hallo zusammen' });
    request.flush(message(1, 'Hallo zusammen'));
    await settle(fixture);

    expect(shownMessages()).toEqual(['Ada Lovelace 14:25 Uhr Hallo zusammen']);
    expect(composer().value).toBe('');
    await expectNoA11yViolations();
  });

  it('starts a new line with Shift+Enter and sends with the button', async () => {
    const user = userEvent.setup();
    const { http } = await openChannel([]);

    await user.type(composer(), 'Zeile 1{Shift>}{Enter}{/Shift}Zeile 2');
    await user.click(screen.getByRole('button', { name: 'Nachricht senden' }));

    expect(http.expectOne('/api/conversations/1/messages').request.body).toEqual({
      text: 'Zeile 1\nZeile 2',
    });
  });

  it("doesn't send blank text", async () => {
    const user = userEvent.setup();
    const { http } = await openChannel([]);

    await user.type(composer(), '   {Enter}');
    await user.click(screen.getByRole('button', { name: 'Nachricht senden' }));

    http.verify();
  });

  it('keeps the text and shows a toast when sending fails', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await openChannel([]);

    await user.type(composer(), 'Wichtig{Enter}');
    http
      .expectOne('/api/conversations/1/messages')
      .flush(null, { status: 500, statusText: 'Internal Server Error' });
    await settle(fixture);

    expect(composer().value).toBe('Wichtig');
    await waitFor(() => expect(toast()).toContain('Deine Nachricht konnte nicht gesendet werden.'));
    expect(shownMessages()).toEqual([]);
    await expectNoA11yViolations();
  });

  it('keeps an unsent draft per Conversation', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await openChannel([]);

    await user.type(composer(), 'Halb fertig');
    await TestBed.inject(Router).navigateByUrl('/channel/3');
    await settle(fixture);
    http.expectOne('/api/conversations/3/messages').flush({ messages: [], nextCursor: null });
    await settle(fixture);
    expect(composer('Nachricht an #Entwicklerteam').value).toBe('');

    await TestBed.inject(Router).navigateByUrl('/channel/1');
    await settle(fixture);
    http.expectOne('/api/conversations/1/messages').flush({ messages: [], nextCursor: null });
    await settle(fixture);

    expect(composer().value).toBe('Halb fertig');
  });
});
