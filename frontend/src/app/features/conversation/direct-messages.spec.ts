import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
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

function shownMessages(): string[] {
  const log = screen.getByRole('region', { name: 'Nachrichten' });
  return within(log)
    .queryAllByRole('listitem')
    .map((item) => item.textContent.replace(/\s+/g, ' ').trim());
}

function composer(name = 'Nachricht an Alan Turing'): HTMLTextAreaElement {
  return screen.getByRole<HTMLTextAreaElement>('textbox', { name });
}

describe('A Direct Message', () => {
  it('shows the Messages of an existing DM and sends to it', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await renderApp({
      url: `/dm/${alan.id}`,
      conversations: [defaultChannel, directMessage(2, ada.id), directMessage(6, alan.id)],
      users,
    });
    http.expectOne('/api/conversations/6/messages').flush({
      messages: [message(1, 'Hallo Ada', { authorId: alan.id, conversationId: 6 })],
      nextCursor: null,
    });
    await settle(fixture);

    await user.type(composer(), 'Hallo Alan{Enter}');
    const request = http.expectOne(`/api/direct-messages/${alan.id}/messages`);
    expect(request.request.body).toEqual({ text: 'Hallo Alan' });
    request.flush(message(2, 'Hallo Alan', { conversationId: 6 }));
    await settle(fixture);

    expect(shownMessages()).toEqual([
      'Alan Turing 14:25 Uhr Hallo Ada',
      'Ada Lovelace 14:25 Uhr Hallo Alan',
    ]);
    expect(composer().value).toBe('');
    await expectNoA11yViolations();
  });

  it('shows an empty DM before its first Message, which creates it and lists it in the sidebar', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await renderApp({
      url: `/dm/${alan.id}`,
      conversations: [defaultChannel, directMessage(2, ada.id)],
      users,
    });

    expect(screen.getByText(/Diese Unterhaltung findet nur zwischen/).textContent).toMatch(
      /Diese Unterhaltung findet nur zwischen\s*@Alan Turing\s*und dir statt\./,
    );
    expect(screen.queryByRole('region', { name: 'Nachrichten' })).toBeNull();
    await expectNoA11yViolations();

    await user.type(composer(), 'Hallo Alan{Enter}');
    http
      .expectOne(`/api/direct-messages/${alan.id}/messages`)
      .flush(message(1, 'Hallo Alan', { conversationId: 8 }));
    await settle(fixture);
    http.expectOne('/api/conversations/8').flush(directMessage(8, alan.id));
    await settle(fixture);
    http
      .expectOne('/api/conversations/8/messages')
      .flush({ messages: [message(1, 'Hallo Alan', { conversationId: 8 })], nextCursor: null });
    await settle(fixture);

    expect(shownMessages()).toEqual(['Ada Lovelace 14:25 Uhr Hallo Alan']);
    expect(composer().value).toBe('');
    const sidebar = within(screen.getByRole('list', { name: 'Direktnachrichten' }));
    expect(sidebar.getByRole('link', { name: /Alan Turing$/ }).getAttribute('aria-current')).toBe(
      'page',
    );
  });

  it('keeps the draft of an empty DM while the User looks elsewhere', async () => {
    const user = userEvent.setup();
    const { http, fixture, navigate } = await renderApp({
      url: `/dm/${alan.id}`,
      conversations: [defaultChannel, directMessage(2, ada.id)],
      users,
    });

    await user.type(composer(), 'Entwurf');
    await navigate('/channel/1');
    await settle(fixture);
    http.expectOne('/api/conversations/1/messages').flush({ messages: [], nextCursor: null });
    await navigate(`/dm/${alan.id}`);
    await settle(fixture);

    expect(composer().value).toBe('Entwurf');
  });

  it("shows the self-DM's note when it has no Messages yet", async () => {
    const { http, fixture } = await renderApp({ url: `/dm/${ada.id}`, users });
    http.expectOne('/api/conversations/2/messages').flush({ messages: [], nextCursor: null });
    await settle(fixture);

    expect(screen.getByText('Dieser Raum ist nur für dich da.')).toBeTruthy();
    expect(composer('Nachricht an Ada Lovelace')).toBeTruthy();
    await expectNoA11yViolations();
  });

  it('fetches a partner who joined after the Workspace was loaded', async () => {
    const grace = { ...alan, id: '7d1e0c2a-0000-4000-8000-000000000009', name: 'Grace Hopper' };
    const { http, fixture } = await renderApp({ url: `/dm/${grace.id}`, users });
    http.expectOne(`/api/users/${grace.id}`).flush(grace);
    await settle(fixture);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Grace Hopper');
  });

  it("sends the User to the start with a notice for a User who doesn't exist", async () => {
    const unknown = '7d1e0c2a-0000-4000-8000-00000000dead';
    const { http, fixture } = await renderApp({ url: `/dm/${unknown}`, users });
    http.expectOne(`/api/users/${unknown}`).flush(null, { status: 404, statusText: 'Not Found' });
    await settle(fixture);

    expect(TestBed.inject(Router).url).toBe('/');
    expect(
      screen.getByRole('button', { name: 'Hinweis schließen' }).parentElement?.textContent,
    ).toContain('gibt es nicht');
  });

  it("sends the User to the start for a URL that can't name a User", async () => {
    const { http } = await renderApp({ url: '/dm/kaputt', users });

    expect(TestBed.inject(Router).url).toBe('/');
    http.expectNone('/api/users/kaputt');
  });
});
