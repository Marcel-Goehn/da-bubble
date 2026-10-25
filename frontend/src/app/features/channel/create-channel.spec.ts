import { Dialog } from '@angular/cdk/dialog';
import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { fireEvent, screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { expectNoA11yViolations } from '../../../testing/a11y';
import {
  ada,
  alan,
  channel,
  defaultChannel,
  directMessage,
  grace,
  renderApp,
  settle,
} from '../../../testing/app';

const users = [ada, alan, grace];
const conversations = [defaultChannel, directMessage(2, ada.id), channel(4, 'Marketing')];

function channelLinks(): string[] {
  const list = screen.getByRole('list', { name: 'Channels' });
  return within(list)
    .getAllByRole('link')
    .map((link) => link.textContent.trim());
}

/** Opens "Channel erstellen" from the sidebar and fills in step 1. */
async function fillNameStep(name: string, description = '') {
  const user = userEvent.setup();
  const app = await renderApp({ conversations, users });
  await user.click(screen.getByRole('button', { name: 'Channel hinzufügen' }));
  await screen.findByRole('dialog', { name: 'Channel erstellen' });
  if (name) {
    await user.type(screen.getByRole('textbox', { name: 'Channel-Name' }), name);
  }
  if (description) {
    await user.type(screen.getByRole('textbox', { name: 'Beschreibung (optional)' }), description);
  }
  return { ...app, user };
}

/** Fills in step 1 and continues to "Leute hinzufügen". */
async function reachPeopleStep(name = 'Entwicklerteam', description = '') {
  const app = await fillNameStep(name, description);
  await app.user.click(screen.getByRole('button', { name: 'Erstellen' }));
  await screen.findByRole('dialog', { name: 'Leute hinzufügen' });
  return app;
}

describe('Creating a Channel', () => {
  afterEach(() => TestBed.inject(Dialog).closeAll());

  it('asks for a name and an optional description first, as in the Figma', async () => {
    await fillNameStep('');

    const dialog = screen.getByRole('dialog', { name: 'Channel erstellen' });
    expect(dialog.textContent).toContain('Channels dienen deinem Team zur Kommunikation.');
    expect(screen.getByRole('textbox', { name: 'Channel-Name' }).getAttribute('placeholder')).toBe(
      'z.B. Kooperationsprojekte',
    );
    expect(screen.getByRole('button', { name: 'Erstellen' }).hasAttribute('disabled')).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Channel-Name' }));
    await expectNoA11yViolations();
  });

  it('refuses a name over 50 characters, counting an emoji as one', async () => {
    const { user } = await fillNameStep(`${'x'.repeat(49)}🚀`);
    expect(screen.queryByText('Ein Channel-Name hat höchstens 50 Zeichen.')).toBeNull();

    await user.type(screen.getByRole('textbox', { name: 'Channel-Name' }), 'y');

    expect(screen.getByText('Ein Channel-Name hat höchstens 50 Zeichen.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Erstellen' }).hasAttribute('disabled')).toBe(true);
  });

  it('closes only the people picker with Escape, not the dialog', async () => {
    const { user } = await reachPeopleStep();

    await user.click(screen.getByRole('radio', { name: 'Bestimmte Leute hinzufügen' }));
    const search = screen.getByRole('combobox', { name: 'Name eingeben' });
    await user.type(search, 'Gr');
    expect(search.getAttribute('aria-expanded')).toBe('true');
    // user-event leaves keyCode at 0, but the CDK reads keyCode (browsers set 27).
    fireEvent.keyDown(search, { key: 'Escape', keyCode: 27 });

    expect(search.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('dialog', { name: 'Leute hinzufügen' })).toBeTruthy();
  });

  it('refuses a name already in the sidebar, ignoring case, at the field', async () => {
    await fillNameStep('  marketing ');

    const field = screen.getByRole('textbox', { name: 'Channel-Name' });
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Diesen Channel-Namen gibt es schon.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Erstellen' }).hasAttribute('disabled')).toBe(true);
    await expectNoA11yViolations();
  });

  it('refuses the Default Channel\'s names "Allgemein" and "General"', async () => {
    await fillNameStep('General');

    expect(screen.getByText('Diesen Channel-Namen gibt es schon.')).toBeTruthy();
  });

  it('adds everyone in Allgemein by default, then opens the new Channel', async () => {
    const { user, http, fixture } = await reachPeopleStep(
      ' Entwicklerteam ',
      'Alles rund ums Code',
    );

    const everyone = screen.getByRole('radio', {
      name: 'Alle Mitglieder von Allgemein hinzufügen',
    });
    expect((everyone as HTMLInputElement).checked).toBe(true);
    await expectNoA11yViolations();
    await user.click(screen.getByRole('button', { name: 'Erstellen' }));

    const request = http.expectOne('/api/channels');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Entwicklerteam',
      description: 'Alles rund ums Code',
      addDefaultChannelMembers: true,
      memberIds: [],
    });
    request.flush(channel(7, 'Entwicklerteam', { description: 'Alles rund ums Code' }));
    await settle(fixture);
    http
      .match('/api/conversations/7/messages')
      .forEach((r) => r.flush({ messages: [], nextCursor: null }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(TestBed.inject(Location).path()).toBe('/channel/7');
    expect(channelLinks()).toEqual(['Allgemein', 'Entwicklerteam', 'Marketing']);
  });

  it('adds the specific people picked by name, removable before creating', async () => {
    const { user, http } = await reachPeopleStep();

    await user.click(screen.getByRole('radio', { name: 'Bestimmte Leute hinzufügen' }));
    const search = screen.getByRole('combobox', { name: 'Name eingeben' });
    await user.type(search, 'gr');
    // The User themselves isn't offered: they're the Creator anyway.
    expect(screen.getAllByRole('option').map((o) => o.textContent.trim())).toEqual([
      'Grace Hopper',
    ]);
    await user.click(screen.getByRole('option', { name: 'Grace Hopper' }));
    await user.type(search, 'Al');
    await user.keyboard('{Enter}');
    expect((search as HTMLInputElement).value).toBe('');
    await expectNoA11yViolations();
    await user.click(screen.getByRole('button', { name: 'Grace Hopper entfernen' }));
    await user.click(screen.getByRole('button', { name: 'Erstellen' }));

    expect(http.expectOne('/api/channels').request.body).toEqual({
      name: 'Entwicklerteam',
      description: null,
      addDefaultChannelMembers: false,
      memberIds: [alan.id],
    });
  });

  it("goes back to the name when the server says it is taken, e.g. by a Channel the User can't see", async () => {
    const { user, http, fixture } = await reachPeopleStep('Geheim');

    await user.click(screen.getByRole('button', { name: 'Erstellen' }));
    http
      .expectOne('/api/channels')
      .flush(
        { status: 409, code: 'CHANNEL_NAME_TAKEN', errors: [] },
        { status: 409, statusText: 'Conflict' },
      );
    await settle(fixture);

    await screen.findByRole('dialog', { name: 'Channel erstellen' });
    const field = screen.getByRole('textbox', { name: 'Channel-Name' });
    expect((field as HTMLInputElement).value).toBe('Geheim');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field);
  });

  it('can be opened with the + next to the Channels heading too', async () => {
    const user = userEvent.setup();
    await renderApp({ conversations, users });

    await user.click(screen.getByRole('button', { name: 'Channel erstellen' }));

    expect(await screen.findByRole('dialog', { name: 'Channel erstellen' })).toBeTruthy();
  });
});

describe('A new Channel', () => {
  afterEach(() => TestBed.inject(Dialog).closeAll());

  it('appears live in the sidebar of a User it was created with', async () => {
    const { realtime, fixture } = await renderApp({ conversations, users });

    realtime.emit({
      type: 'conversation.upserted',
      conversation: channel(7, 'Büro', { creatorId: alan.id }),
    });
    await settle(fixture);

    expect(channelLinks()).toEqual(['Allgemein', 'Büro', 'Marketing']);
  });

  it('shows its name, description and "Erstellt von" in the Channel details', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await renderApp({
      url: '/channel/7',
      conversations: [
        defaultChannel,
        channel(7, 'Büro', { description: 'Alles rund ums Büro', creatorId: alan.id }),
      ],
      users,
    });
    http.expectOne('/api/conversations/7/messages').flush({ messages: [], nextCursor: null });
    await settle(fixture);

    await user.click(screen.getByRole('button', { name: 'Büro' }));

    const dialog = await screen.findByRole('dialog', { name: 'Büro' });
    const details = within(dialog);
    expect(details.getByRole('heading', { name: 'Channel-Name' })).toBeTruthy();
    expect(details.getByText('Alles rund ums Büro')).toBeTruthy();
    expect(details.getByRole('heading', { name: 'Erstellt von' })).toBeTruthy();
    expect(details.getByRole('button', { name: 'Alan Turing' })).toBeTruthy();
    await expectNoA11yViolations();
  });
});
