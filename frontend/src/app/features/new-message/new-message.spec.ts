import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { screen } from '@testing-library/angular';
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
  settle,
} from '../../../testing/app';

const users = [ada, alan];
const design = channel(5, 'Design');
const conversations = [defaultChannel, directMessage(2, ada.id), design];

function recipient(): HTMLInputElement {
  return screen.getByRole<HTMLInputElement>('combobox', { name: 'Empfänger' });
}

function composer(): HTMLTextAreaElement {
  return screen.getByRole<HTMLTextAreaElement>('combobox', {
    name: 'Starte eine neue Nachricht',
  });
}

describe('A new Message', () => {
  it('goes to a #Channel picked as its recipient, which then opens', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await renderApp({ url: '/new', conversations, users });

    expect(screen.getByRole('heading', { level: 1, name: 'Neue Nachricht' })).toBeTruthy();
    await user.type(recipient(), '#De');
    await user.click(screen.getByRole('option', { name: 'Design' }));
    await user.type(composer(), 'Hallo Design{Enter}');

    const request = http.expectOne('/api/conversations/5/messages');
    expect(request.request.body).toEqual({ text: 'Hallo Design' });
    request.flush(message(1, 'Hallo Design', { conversationId: 5 }));
    await settle(fixture);

    expect(TestBed.inject(Router).url).toBe('/channel/5');
    http.expectOne('/api/conversations/5/messages').flush({ messages: [], nextCursor: null });
    await expectNoA11yViolations();
  });

  it('goes to the DM with an @User picked by keyboard, which the first Message creates', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await renderApp({ url: '/new', conversations, users });

    await user.type(recipient(), '@Al{Enter}');
    expect(
      screen.getByRole('button', { name: 'Alan Turing als Empfänger entfernen' }),
    ).toBeTruthy();
    await user.type(composer(), 'Hallo Alan{Enter}');

    const request = http.expectOne(`/api/direct-messages/${alan.id}/messages`);
    expect(request.request.body).toEqual({ text: 'Hallo Alan' });
    request.flush(message(1, 'Hallo Alan', { conversationId: 8 }));
    await settle(fixture);
    http.expectOne('/api/conversations/8').flush(directMessage(8, alan.id));
    await settle(fixture);
    http
      .expectOne('/api/conversations/8/messages')
      .flush({ messages: [message(1, 'Hallo Alan', { conversationId: 8 })], nextCursor: null });
    await settle(fixture);

    expect(TestBed.inject(Router).url).toBe(`/dm/${alan.id}`);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Alan Turing');
  });

  it('offers a User for their exact email only', async () => {
    const user = userEvent.setup();
    await renderApp({ url: '/new', conversations, users });

    await user.type(recipient(), 'alan@example.co');
    expect(screen.queryByRole('option')).toBeNull();

    await user.type(recipient(), 'm');
    expect(screen.getAllByRole('option').map((option) => option.textContent?.trim())).toEqual([
      'Alan Turing',
    ]);
    await user.keyboard('{Enter}');
    expect(
      screen.getByRole('button', { name: 'Alan Turing als Empfänger entfernen' }),
    ).toBeTruthy();
    await expectNoA11yViolations();
  });

  it('asks for a recipient before sending, and keeps the text', async () => {
    const user = userEvent.setup();
    const { http } = await renderApp({ url: '/new', conversations, users });

    await user.type(composer(), 'Hallo{Enter}');

    http.expectNone((request) => request.method === 'POST');
    expect(recipient().getAttribute('aria-invalid')).toBe('true');
    expect(recipient().getAttribute('aria-describedby')).toBeTruthy();
    expect(
      document.getElementById(recipient().getAttribute('aria-describedby')!)?.textContent,
    ).toContain('Wähle zuerst, an wen die Nachricht geht.');
    expect(document.activeElement).toBe(recipient());
    expect(composer().value).toBe('Hallo');
    await expectNoA11yViolations();

    await user.type(recipient(), '#De{Enter}');
    expect(screen.queryByText('Wähle zuerst, an wen die Nachricht geht.')).toBeNull();
  });

  it('keeps the text when sending fails', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await renderApp({ url: '/new', conversations, users });

    await user.type(recipient(), '#De{Enter}');
    await user.type(composer(), 'Hallo{Enter}');
    http
      .expectOne('/api/conversations/5/messages')
      .flush(null, { status: 500, statusText: 'Internal Server Error' });
    await settle(fixture);

    expect(TestBed.inject(Router).url).toBe('/new');
    expect(composer().value).toBe('Hallo');
    expect(screen.getByText(/konnte nicht gesendet werden/)).toBeTruthy();
    await expectNoA11yViolations();
  });

  it('lets the User pick another recipient after removing one', async () => {
    const user = userEvent.setup();
    await renderApp({ url: '/new', conversations, users });

    await user.type(recipient(), '#De{Enter}');
    await user.click(screen.getByRole('button', { name: 'Design als Empfänger entfernen' }));

    expect(document.activeElement).toBe(recipient());
    expect(recipient().value).toBe('');
    await expectNoA11yViolations();
  });

  it('closes the list of possible recipients on Escape and while nothing matches', async () => {
    const user = userEvent.setup();
    await renderApp({ url: '/new', conversations, users });

    await user.type(recipient(), '#De');
    expect(recipient().getAttribute('aria-expanded')).toBe('true');
    await user.keyboard('{Escape}');
    expect(recipient().getAttribute('aria-expanded')).toBe('false');

    await user.clear(recipient());
    await user.type(recipient(), '#xyz');
    expect(recipient().getAttribute('aria-expanded')).toBe('false');
  });

  it('opens from the Workspace menu', async () => {
    const user = userEvent.setup();
    const { fixture } = await renderApp({ conversations, users });

    await user.click(screen.getByRole('link', { name: 'Neue Nachricht' }));
    await settle(fixture);

    expect(TestBed.inject(Router).url).toBe('/new');
    expect(recipient()).toBeTruthy();
    await expectNoA11yViolations();
  });
});
