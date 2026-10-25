import { Dialog } from '@angular/cdk/dialog';
import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ConversationDto } from '../../core/data/conversation.store';
import { UserDto } from '../../core/data/user.store';
import { expectNoA11yViolations } from '../../../testing/a11y';
import {
  ada,
  alan,
  channel,
  defaultChannel,
  grace,
  member,
  renderApp,
  settle,
} from '../../../testing/app';
import { shownText } from '../../../testing/shown-text';

const users = [ada, alan, grace];

/** "Büro", created by Alan, with Grace as another Admin and Ada as a plain Member. */
const buero = channel(7, 'Büro', {
  creatorId: alan.id,
  members: [
    member(alan.id, { isAdmin: true }),
    member(grace.id, { isAdmin: true }),
    member(ada.id),
  ],
});

/** Opens [conversation] as the User [me] and waits for its (empty) Messages. */
async function openChannel(conversation: ConversationDto, me: UserDto = ada) {
  const user = userEvent.setup();
  const app = await renderApp({
    url: `/channel/${conversation.id}`,
    me,
    conversations: [defaultChannel, conversation],
    users,
  });
  app.http
    .expectOne(`/api/conversations/${conversation.id}/messages`)
    .flush({ messages: [], nextCursor: null });
  await settle(app.fixture);
  return { ...app, user };
}

/** The rows of the Member group [name], as shown. */
function group(name: string): string[] {
  return within(screen.getByRole('list', { name })).getAllByRole('listitem').map(shownText);
}

describe('Channel Members and Admins', () => {
  afterEach(() => TestBed.inject(Dialog).closeAll());

  it("shows a Member the Admins and Members, the Creator first, and why they can't manage them", async () => {
    const { user } = await openChannel(buero);

    await user.click(screen.getByRole('button', { name: 'Mitglieder (3)' }));

    await screen.findByRole('dialog', { name: 'Mitglieder' });
    expect(group('Admins · 2')).toEqual(['Alan Turing Hat den Channel erstellt', 'Grace Hopper']);
    expect(group('Mitglieder · 1')).toEqual(['Ada Lovelace (Du)']);
    expect(
      screen.getByText('Nur Admins können Mitglieder hinzufügen oder entfernen.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Verwalten' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mitglieder hinzufügen' })).toBeNull();
    await expectNoA11yViolations();
  });

  it('lets an Admin grant Admin in "Verwalten", by keyboard, never on the Creator or themselves', async () => {
    const { user, http, fixture } = await openChannel(buero, grace);
    await user.click(screen.getByRole('button', { name: 'Mitglieder (3)' }));
    await screen.findByRole('dialog', { name: 'Mitglieder' });

    expect(group('Admins · 2')).toEqual([
      'Grace Hopper (Du)',
      'Alan Turing Hat den Channel erstellt',
    ]);
    expect(screen.queryByRole('switch')).toBeNull();
    screen.getByRole('button', { name: 'Verwalten' }).focus();
    await user.keyboard('{Enter}');

    expect(screen.getAllByRole('switch').map((s) => s.getAttribute('aria-label'))).toEqual([
      'Ada Lovelace ist Admin',
    ]);
    expect(screen.getAllByRole('button', { name: /entfernen$/ })).toHaveLength(1);
    expect(screen.getByText('bleibt immer Admin')).toBeTruthy();
    await expectNoA11yViolations();

    const adaIsAdmin = screen.getByRole('switch', { name: 'Ada Lovelace ist Admin' });
    expect(adaIsAdmin.getAttribute('aria-checked')).toBe('false');
    adaIsAdmin.focus();
    await user.keyboard(' ');
    const request = http.expectOne(`/api/channels/7/members/${ada.id}/admin`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ isAdmin: true });
    request.flush({
      ...buero,
      members: buero.members.map((m) => (m.userId === ada.id ? { ...m, isAdmin: true } : m)),
    });
    await settle(fixture);

    expect(group('Admins · 3')).toEqual([
      'Grace Hopper (Du)',
      'Alan Turing Hat den Channel erstellt bleibt immer Admin',
      'Ada Lovelace Admin',
    ]);
    expect(screen.queryByRole('list', { name: /^Mitglieder/ })).toBeNull();
  });

  it('removes a Member at once, and "Rückgängig" restores their Admin flag and join time', async () => {
    const { user, http, fixture } = await openChannel(buero, grace);
    await user.click(screen.getByRole('button', { name: 'Mitglieder (3)' }));
    await user.click(await screen.findByRole('button', { name: 'Verwalten' }));

    await user.click(screen.getByRole('button', { name: 'Ada Lovelace entfernen' }));
    const removal = http.expectOne(`/api/channels/7/members/${ada.id}`);
    expect(removal.request.method).toBe('DELETE');
    removal.flush(member(ada.id));
    await settle(fixture);

    expect(screen.queryByRole('list', { name: /^Mitglieder/ })).toBeNull();
    expect(screen.getByText('Ada Lovelace entfernt')).toBeTruthy();
    // The focused remove button went with the row.
    const undoButton = screen.getByRole('button', { name: 'Rückgängig' });
    expect(document.activeElement).toBe(undoButton);
    await user.keyboard('{Enter}');

    const undo = http.expectOne(`/api/channels/7/members/${ada.id}`);
    expect(undo.request.method).toBe('PUT');
    expect(undo.request.body).toEqual({ isAdmin: false, joinedAt: member(ada.id).joinedAt });
    undo.flush(buero);
    await settle(fixture);
    expect(group('Mitglieder · 1')).toEqual(['Ada Lovelace Admin']);
    expect(screen.queryByText('Ada Lovelace entfernt')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fertig' }));
  });

  it('shows the Default Channel as "Standard-Channel", everyone in one group, with no controls', async () => {
    const { user } = await openChannel(defaultChannel, alan);

    await user.click(screen.getByRole('button', { name: 'Allgemein' }));
    const details = within(await screen.findByRole('dialog', { name: 'Allgemein' }));
    expect(details.getByRole('heading', { name: 'Standard-Channel' })).toBeTruthy();
    expect(details.queryByRole('heading', { name: 'Erstellt von' })).toBeNull();
    expect(details.queryByRole('button', { name: /bearbeiten/ })).toBeNull();
    expect(details.queryByRole('button', { name: 'Channel verlassen' })).toBeNull();
    // The Mitglieder card, which the details show on mobile.
    expect(
      within(details.getByRole('list', { name: 'Alle · 3' }))
        .getAllByRole('listitem')
        .map(shownText),
    ).toEqual(['Alan Turing (Du)', 'Ada Lovelace', 'Grace Hopper']);
    expect(details.queryByRole('button', { name: 'Verwalten' })).toBeNull();
    expect(
      details.queryByText('Nur Admins können Mitglieder hinzufügen oder entfernen.'),
    ).toBeNull();
    await expectNoA11yViolations();
  });

  it('lets an Admin rename the Channel and change its description', async () => {
    const { user, http, fixture } = await openChannel(buero, grace);
    await user.click(screen.getByRole('button', { name: 'Büro' }));
    const details = within(await screen.findByRole('dialog', { name: 'Büro' }));

    await user.click(details.getByRole('button', { name: 'Channel-Name bearbeiten' }));
    const name = details.getByRole('textbox', { name: 'Channel-Name' });
    expect(document.activeElement).toBe(name);
    await user.clear(name);
    await user.type(name, 'Allgemein');
    expect(details.getByText('Diesen Channel-Namen gibt es schon.')).toBeTruthy();
    await user.clear(name);
    await user.type(name, ' Büro 2 {Enter}');

    const rename = http.expectOne('/api/channels/7');
    expect(rename.request.method).toBe('PATCH');
    expect(rename.request.body).toEqual({ name: 'Büro 2' });
    rename.flush({ ...buero, name: 'Büro 2' });
    await settle(fixture);
    expect(details.queryByRole('textbox', { name: 'Channel-Name' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Büro 2' })).toBeTruthy();

    await user.click(details.getByRole('button', { name: 'Beschreibung bearbeiten' }));
    await user.type(details.getByRole('textbox', { name: 'Beschreibung' }), 'Alles fürs Büro');
    await user.click(details.getByRole('button', { name: 'Beschreibung speichern' }));
    const describe = http.expectOne('/api/channels/7');
    expect(describe.request.body).toEqual({ description: 'Alles fürs Büro' });
    describe.flush({ ...buero, name: 'Büro 2', description: 'Alles fürs Büro' });
    await settle(fixture);
    expect(details.getByText('Alles fürs Büro')).toBeTruthy();
    await expectNoA11yViolations();
  });

  it('gives a plain Member no editing, but "Channel verlassen"', async () => {
    const { user } = await openChannel(buero);

    await user.click(screen.getByRole('button', { name: 'Büro' }));
    const details = within(await screen.findByRole('dialog', { name: 'Büro' }));
    expect(details.queryByRole('button', { name: /bearbeiten/ })).toBeNull();
    expect(details.getByRole('button', { name: 'Channel verlassen' })).toBeTruthy();
    expect(
      details.getByText('Nur Admins können Mitglieder hinzufügen oder entfernen.'),
    ).toBeTruthy();
    await expectNoA11yViolations();
  });

  it('gives the Creator no way to leave', async () => {
    const { user } = await openChannel(buero, alan);

    await user.click(screen.getByRole('button', { name: 'Büro' }));
    const details = within(await screen.findByRole('dialog', { name: 'Büro' }));
    expect(details.getByRole('button', { name: 'Channel-Name bearbeiten' })).toBeTruthy();
    expect(details.queryByRole('button', { name: 'Channel verlassen' })).toBeNull();
  });

  it('lands a Member who leaves in the Default Channel, the Channel gone from the sidebar', async () => {
    const { user, http, fixture } = await openChannel(buero);
    await user.click(screen.getByRole('button', { name: 'Büro' }));
    await user.click(await screen.findByRole('button', { name: 'Channel verlassen' }));

    const leave = http.expectOne('/api/channels/7/leave');
    expect(leave.request.method).toBe('POST');
    leave.flush(null);
    await settle(fixture);
    http
      .match('/api/conversations/1/messages')
      .forEach((r) => r.flush({ messages: [], nextCursor: null }));
    await settle(fixture);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(TestBed.inject(Location).path()).toBe('/channel/1');
    expect(within(screen.getByRole('list', { name: 'Channels' })).queryByText('Büro')).toBeNull();
  });

  it('closes the Channel of a removed Member live and lands them in the Default Channel', async () => {
    const { user, http, fixture, realtime } = await openChannel(buero);
    await user.click(screen.getByRole('button', { name: 'Büro' }));
    await screen.findByRole('dialog', { name: 'Büro' });

    realtime.emit({ type: 'conversation.removed', conversationId: 7 });
    await settle(fixture);
    http
      .match('/api/conversations/1/messages')
      .forEach((r) => r.flush({ messages: [], nextCursor: null }));
    await settle(fixture);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(TestBed.inject(Location).path()).toBe('/channel/1');
    expect(within(screen.getByRole('list', { name: 'Channels' })).queryByText('Büro')).toBeNull();
  });

  it('lets an Admin add Members from the Channel header, offering only those not in it', async () => {
    const { user, http, fixture } = await openChannel(
      channel(7, 'Büro', { members: [member(ada.id, { isAdmin: true }), member(alan.id)] }),
    );

    await user.click(screen.getByRole('button', { name: 'Mitglieder hinzufügen' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Leute hinzufügen' }));
    expect(dialog.getByText('Büro')).toBeTruthy();
    expect(dialog.getByRole('button', { name: 'Hinzufügen' }).hasAttribute('disabled')).toBe(true);
    const search = dialog.getByRole('combobox', { name: 'Name eingeben' });
    await user.type(search, 'r');
    expect(screen.getAllByRole('option').map((o) => o.textContent.trim())).toEqual([
      'Grace Hopper',
    ]);
    await user.keyboard('{ArrowDown}{Enter}');
    await expectNoA11yViolations();
    await user.click(dialog.getByRole('button', { name: 'Hinzufügen' }));

    const add = http.expectOne('/api/channels/7/members');
    expect(add.request.method).toBe('POST');
    expect(add.request.body).toEqual({ userIds: [grace.id] });
    add.flush(
      channel(7, 'Büro', {
        members: [member(ada.id, { isAdmin: true }), member(alan.id), member(grace.id)],
      }),
    );
    await settle(fixture);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Mitglieder (3)' })).toBeTruthy();
  });

  it('gives a plain Member no "Mitglieder hinzufügen" in the Channel header', async () => {
    await openChannel(buero);

    expect(screen.queryByRole('button', { name: 'Mitglieder hinzufügen' })).toBeNull();
  });
});
