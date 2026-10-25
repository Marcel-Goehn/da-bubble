import { screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { expectNoA11yViolations } from '../../../testing/a11y';
import {
  ada,
  alan,
  channel,
  defaultChannel,
  grace,
  message,
  renderApp,
  settle,
} from '../../../testing/app';
import { shownText } from '../../../testing/shown-text';
import { MessageDto } from '../../core/data/message.store';

const users = [ada, alan, grace];
const development = channel(7, 'Entwicklung');

/** Opens the Default Channel with [messages] (newest first, as the API sends them) as its newest page. */
async function openChannel(messages: MessageDto[]) {
  const app = await renderApp({
    url: '/channel/1',
    conversations: [defaultChannel, development],
    users,
  });
  app.http.expectOne('/api/conversations/1/messages').flush({ messages, nextCursor: null });
  await settle(app.fixture);
  return app;
}

/** The list item of the Message showing [text]. */
function shownMessage(text: string): HTMLElement {
  const log = screen.getByRole('region', { name: 'Nachrichten' });
  return within(log)
    .getAllByRole('listitem')
    .find((item) => shownText(item).includes(text))!;
}

function composer(): HTMLTextAreaElement {
  return screen.getByRole<HTMLTextAreaElement>('combobox', { name: 'Nachricht an #Allgemein' });
}

function optionNames(listbox: string): string[] {
  return within(screen.getByRole('listbox', { name: listbox }))
    .getAllByRole('option')
    .map((option) => shownText(option));
}

describe('Mentions in a Message', () => {
  const text =
    `Siehe <@${alan.id}|Alan T.> und <#7|Dev> und <#1|General> und <#9|Geheim> ` +
    `und <@00000000-0000-4000-8000-000000000009|Niemand>`;

  it('show the current names, the Default Channel translated, and others as plain text', async () => {
    await openChannel([message(1, text)]);
    const shown = within(shownMessage('Siehe'));

    expect(shownText(shownMessage('Siehe'))).toContain(
      'Siehe @Alan Turing und #Entwicklung und #Allgemein und #Geheim und @Niemand',
    );
    expect(shown.getByRole('link', { name: '#Entwicklung' }).getAttribute('href')).toBe(
      '/channel/7',
    );
    expect(shown.getByRole('link', { name: '#Allgemein' }).getAttribute('href')).toBe('/channel/1');
    expect(shown.queryByRole('link', { name: /Geheim/ })).toBeNull();
    expect(shown.queryByRole('button', { name: /Niemand/ })).toBeNull();
    await expectNoA11yViolations();
  });

  it("open the User's profile card from an @ Mention", async () => {
    const user = userEvent.setup();
    await openChannel([message(1, text)]);

    await user.click(within(shownMessage('Siehe')).getByRole('button', { name: '@Alan Turing' }));

    const card = await screen.findByRole('dialog', { name: 'Profil' });
    expect(within(card).getByText('Alan Turing')).toBeTruthy();
  });

  it('open the Channel from a # Mention', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await openChannel([message(1, text)]);

    await user.click(within(shownMessage('Siehe')).getByRole('link', { name: '#Entwicklung' }));
    await settle(fixture);
    http.expectOne('/api/conversations/7/messages').flush({ messages: [], nextCursor: null });
    await settle(fixture);

    expect(screen.getByRole('combobox', { name: 'Nachricht an #Entwicklung' })).toBeTruthy();
  });

  it('read as the current names after a Channel is renamed live', async () => {
    const { realtime, fixture } = await openChannel([message(1, text)]);

    realtime.emit({ type: 'conversation.upserted', conversation: { ...development, name: 'Dev' } });
    await settle(fixture);

    expect(within(shownMessage('Siehe')).getByRole('link', { name: '#Dev' })).toBeTruthy();
  });
});

describe('The Mention pickers', () => {
  it('offer every User after @, narrow as the User types, and insert the pick as a Mention', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await openChannel([]);

    await user.type(composer(), 'Hallo @');
    expect(composer().getAttribute('aria-expanded')).toBe('true');
    expect(optionNames('Personen')).toEqual(['Ada Lovelace', 'Alan Turing', 'Grace Hopper']);
    await expectNoA11yViolations();

    await user.type(composer(), 'gr');
    expect(optionNames('Personen')).toEqual(['Grace Hopper']);
    await user.keyboard('{Enter}');
    await settle(fixture);

    http.expectNone('/api/conversations/1/messages');
    expect(composer().value).toBe('Hallo @Grace Hopper ');
    expect(screen.queryByRole('listbox')).toBeNull();

    await user.type(composer(), 'schau mal{Enter}');
    expect(http.expectOne('/api/conversations/1/messages').request.body).toEqual({
      text: `Hallo <@${grace.id}|Grace Hopper> schau mal`,
    });
  });

  it("offer the User's Channels after #, the Default Channel translated", async () => {
    const user = userEvent.setup();
    const { http, fixture } = await openChannel([]);

    await user.type(composer(), '#');
    expect(optionNames('Channels')).toEqual(['Allgemein', 'Entwicklung']);
    await user.click(screen.getByRole('option', { name: 'Entwicklung' }));
    await settle(fixture);
    await user.type(composer(), 'und #all');
    await user.keyboard('{Enter}');
    await settle(fixture);

    expect(composer().value).toBe('#Entwicklung und #Allgemein ');
    await user.keyboard('{Enter}');
    expect(http.expectOne('/api/conversations/1/messages').request.body).toEqual({
      text: '<#7|Entwicklung> und <#1|Allgemein>',
    });
  });

  it('work by keyboard: arrows move through the options, Escape closes and keeps the text', async () => {
    const user = userEvent.setup();
    const { fixture } = await openChannel([]);

    await user.type(composer(), '@');
    await user.keyboard('{ArrowDown}');
    const active = () => document.getElementById(composer().getAttribute('aria-activedescendant')!);
    await waitFor(() => expect(shownText(active()!)).toBe('Alan Turing'));
    await user.keyboard('{Enter}');
    await settle(fixture);
    expect(composer().value).toBe('@Alan Turing ');

    await user.type(composer(), '@zz');
    expect(screen.queryByRole('listbox')).toBeNull();
    await user.type(composer(), '{Backspace}{Backspace}');
    expect(screen.getByRole('listbox', { name: 'Personen' })).toBeTruthy();
    await user.keyboard('{Escape}');
    await settle(fixture);

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(composer().value).toBe('@Alan Turing @');
  });

  it("don't open on ArrowDown, which moves the caret in the text", async () => {
    const user = userEvent.setup();
    await openChannel([]);

    await user.type(composer(), 'Zeile 1{Shift>}{Enter}{/Shift}Zeile 2{ArrowUp}{ArrowDown}');

    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('keep a Mention while editing, and offer more', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await openChannel([message(1, `Hallo <@${alan.id}|Alan Turing>`)]);

    await user.click(
      within(shownMessage('Hallo')).getByRole('button', { name: 'Weitere Aktionen' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Nachricht bearbeiten' }));
    const editor = screen.getByRole<HTMLTextAreaElement>('combobox', {
      name: 'Nachricht bearbeiten',
    });
    expect(editor.value).toBe('Hallo @Alan Turing');
    await user.type(editor, ' und @gra');
    await user.click(screen.getByRole('option', { name: 'Grace Hopper' }));
    await settle(fixture);
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(http.expectOne('/api/conversations/1/messages/1').request.body).toEqual({
      text: `Hallo <@${alan.id}|Alan Turing> und <@${grace.id}|Grace Hopper>`,
    });
  });
});
