import { Dialog } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { fireEvent, screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { expectNoA11yViolations } from '../../../testing/a11y';
import { ada, alan, defaultChannel, message, renderApp, settle } from '../../../testing/app';
import { MessageDto, MessageStore } from '../../core/data/message.store';

const users = [ada, alan];
const editedAt = new Date(2026, 0, 15, 15, 6).toISOString();

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

/** What [element] shows, with whitespace collapsed; a closed ⋮ popover shows nothing. */
function shownText(element: HTMLElement): string {
  const shown = element.cloneNode(true) as HTMLElement;
  shown.querySelectorAll('[role=menu][hidden]').forEach((menu) => menu.remove());
  return shown.textContent.replace(/\s+/g, ' ').trim();
}

function toast(): string | undefined {
  return screen.queryByRole('button', { name: 'Hinweis schließen' })?.parentElement?.textContent;
}

/** The ⋮ button of the Message showing [text]. */
function actionsButton(text: string): HTMLElement {
  return within(shownMessage(text)).getByRole('button', { name: 'Weitere Aktionen' });
}

describe('Edited Messages', () => {
  it('shows an edit pushed live, with "(bearbeitet)" next to the time', async () => {
    const { realtime, fixture } = await openChannel([message(1, 'Hallo', { authorId: alan.id })]);

    realtime.emit({
      type: 'message.updated',
      message: { ...message(1, 'Hallo zusammen', { authorId: alan.id }), editedAt },
    });
    await settle(fixture);

    expect(shownText(shownMessage('Hallo zusammen'))).toContain(
      '14:25 Uhr (bearbeitet) Hallo zusammen',
    );
  });

  it('lets the author edit their Message inline from the ⋮ popover', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await openChannel([message(1, 'Hallo zusamen')]);

    await user.click(actionsButton('Hallo zusamen'));
    await user.click(screen.getByRole('menuitem', { name: 'Nachricht bearbeiten' }));
    const editor = screen.getByRole('textbox', { name: 'Nachricht bearbeiten' });
    expect((editor as HTMLTextAreaElement).value).toBe('Hallo zusamen');
    await user.clear(editor);
    await user.type(editor, 'Hallo zusammen');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    const request = http.expectOne('/api/conversations/1/messages/1');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ text: 'Hallo zusammen' });
    request.flush({ ...message(1, 'Hallo zusammen'), editedAt });
    await settle(fixture);

    expect(screen.queryByRole('textbox', { name: 'Nachricht bearbeiten' })).toBeNull();
    expect(shownText(shownMessage('Hallo zusammen'))).toContain(
      '14:25 Uhr (bearbeitet) Hallo zusammen',
    );
  });

  it('cancels an edit with Abbrechen or Escape, keeping the text and returning focus to ⋮', async () => {
    const user = userEvent.setup();
    const { http } = await openChannel([message(1, 'Hallo')]);

    await user.click(actionsButton('Hallo'));
    await user.click(screen.getByRole('menuitem', { name: 'Nachricht bearbeiten' }));
    await user.type(screen.getByRole('textbox', { name: 'Nachricht bearbeiten' }), ' Welt');
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(screen.queryByRole('textbox', { name: 'Nachricht bearbeiten' })).toBeNull();
    expect(shownText(shownMessage('Hallo'))).toBe('Ada Lovelace 14:25 Uhr Hallo');

    await user.click(actionsButton('Hallo'));
    await user.click(screen.getByRole('menuitem', { name: 'Nachricht bearbeiten' }));
    await user.keyboard(' Welt{Escape}');

    expect(screen.queryByRole('textbox', { name: 'Nachricht bearbeiten' })).toBeNull();
    await waitFor(() => expect(actionsButton('Hallo')).toBe(document.activeElement));
    http.expectNone('/api/conversations/1/messages/1');
  });

  it('keeps what the User typed when the Message is edited live meanwhile', async () => {
    const user = userEvent.setup();
    const { realtime, fixture } = await openChannel([message(1, 'Hallo')]);
    await user.click(actionsButton('Hallo'));
    await user.click(screen.getByRole('menuitem', { name: 'Nachricht bearbeiten' }));
    await user.keyboard(' Welt');

    realtime.emit({ type: 'message.updated', message: { ...message(1, 'Anders'), editedAt } });
    await settle(fixture);

    expect(
      screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Nachricht bearbeiten' }).value,
    ).toBe('Hallo Welt');
  });

  it("can't save an edit that leaves no text, and saves nothing for unchanged text", async () => {
    const user = userEvent.setup();
    const { http } = await openChannel([message(1, 'Hallo')]);
    await user.click(actionsButton('Hallo'));
    await user.click(screen.getByRole('menuitem', { name: 'Nachricht bearbeiten' }));
    const editor = screen.getByRole('textbox', { name: 'Nachricht bearbeiten' });

    await user.clear(editor);
    await user.type(editor, '   ');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Speichern' }).disabled).toBe(
      true,
    );

    await user.clear(editor);
    await user.type(editor, 'Hallo{Enter}');
    expect(screen.queryByRole('textbox', { name: 'Nachricht bearbeiten' })).toBeNull();
    http.expectNone('/api/conversations/1/messages/1');
  });

  it('keeps the editor open with the new text when saving fails', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await openChannel([message(1, 'Hallo')]);
    await user.click(actionsButton('Hallo'));
    await user.click(screen.getByRole('menuitem', { name: 'Nachricht bearbeiten' }));

    await user.keyboard(' Welt{Enter}');
    http
      .expectOne('/api/conversations/1/messages/1')
      .flush(null, { status: 500, statusText: 'Internal Server Error' });
    await settle(fixture);

    expect(
      screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Nachricht bearbeiten' }).value,
    ).toBe('Hallo Welt');
    await waitFor(() =>
      expect(toast()).toContain('Deine Änderung konnte nicht gespeichert werden.'),
    );
  });

  it("offers no actions on others' Messages or on Deleted Messages", async () => {
    await openChannel([
      message(3, 'Weg', { authorId: ada.id }),
      message(2, 'Fremd', { authorId: alan.id }),
      message(1, 'Meins'),
    ]);
    const deleted = { ...message(4, '', { authorId: ada.id }), deletedAt: editedAt };
    TestBed.inject(MessageStore).upsert(deleted);

    expect(actionsButton('Meins')).toBeTruthy();
    expect(
      within(shownMessage('Fremd')).queryByRole('button', { name: 'Weitere Aktionen' }),
    ).toBeNull();
    await waitFor(() =>
      expect(
        within(shownMessage('Diese Nachricht wurde gelöscht.')).queryByRole('button', {
          name: 'Weitere Aktionen',
        }),
      ).toBeNull(),
    );
  });

  it('works by keyboard, and the popover and editor pass axe', async () => {
    const { http, fixture } = await openChannel([message(1, 'Hallo')]);
    actionsButton('Hallo').focus();

    await userEvent.keyboard('{Enter}');
    const menu = await screen.findByRole('menu', { name: 'Weitere Aktionen' });
    await waitFor(() =>
      expect(within(menu).getByRole('menuitem', { name: 'Nachricht bearbeiten' })).toBe(
        document.activeElement,
      ),
    );
    await expectNoA11yViolations();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(actionsButton('Hallo')).toBe(document.activeElement);

    await userEvent.keyboard('{Enter}');
    await screen.findByRole('menu', { name: 'Weitere Aktionen' });
    await userEvent.keyboard('{Enter}');
    const editor = screen.getByRole('textbox', { name: 'Nachricht bearbeiten' });
    await waitFor(() => expect(editor).toBe(document.activeElement));
    await expectNoA11yViolations();
    await userEvent.keyboard('!{Enter}');

    http.expectOne('/api/conversations/1/messages/1').flush({ ...message(1, 'Hallo!'), editedAt });
    await settle(fixture);
    expect(shownText(shownMessage('Hallo!'))).toContain('(bearbeitet) Hallo!');
  });
});

describe('Deleted Messages', () => {
  afterEach(() => TestBed.inject(Dialog).closeAll());

  it("deletes the author's Message after they confirm, leaving a ghost", async () => {
    const user = userEvent.setup();
    const { http, fixture } = await openChannel([message(1, 'Peinlich')]);

    await user.click(actionsButton('Peinlich'));
    await user.click(screen.getByRole('menuitem', { name: 'Nachricht löschen' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nachricht löschen?' });
    expect(shownText(dialog)).toContain(
      'Die Nachricht und ihre Anhänge werden für alle entfernt. Das lässt sich nicht rückgängig machen. Antworten im Thread bleiben erhalten.',
    );
    await expectNoA11yViolations();
    await user.click(within(dialog).getByRole('button', { name: 'Löschen' }));

    const request = http.expectOne('/api/conversations/1/messages/1');
    expect(request.request.method).toBe('DELETE');
    request.flush({ ...message(1, ''), deletedAt: editedAt });
    await settle(fixture);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('region', { name: 'Nachrichten' })).toBe(document.activeElement);
    await expectNoA11yViolations();
    expect(shownText(shownMessage('gelöscht'))).toBe(
      'Ada Lovelace 14:25 Uhr Diese Nachricht wurde gelöscht.',
    );
  });

  it('deletes nothing when the User cancels, closes or presses Escape', async () => {
    const user = userEvent.setup();
    const { http } = await openChannel([message(1, 'Bleibt')]);

    for (const close of [
      () => user.click(screen.getByRole('button', { name: 'Abbrechen' })),
      () => user.click(screen.getByRole('button', { name: 'Schließen' })),
      // The CDK reads the keyCode, which user-event leaves out.
      () => fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', keyCode: 27 }),
    ]) {
      await user.click(actionsButton('Bleibt'));
      await user.click(screen.getByRole('menuitem', { name: 'Nachricht löschen' }));
      await screen.findByRole('dialog', { name: 'Nachricht löschen?' });
      await close();
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(actionsButton('Bleibt')).toBe(document.activeElement);
    }

    http.expectNone('/api/conversations/1/messages/1');
    expect(shownText(shownMessage('Bleibt'))).toBe('Ada Lovelace 14:25 Uhr Bleibt');
  });

  it('keeps the Message and says so when deleting fails', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await openChannel([message(1, 'Bleibt')]);
    await user.click(actionsButton('Bleibt'));
    await user.click(screen.getByRole('menuitem', { name: 'Nachricht löschen' }));
    await user.click(await screen.findByRole('button', { name: 'Löschen' }));

    http
      .expectOne('/api/conversations/1/messages/1')
      .flush(null, { status: 500, statusText: 'Internal Server Error' });
    await settle(fixture);

    expect(shownText(shownMessage('Bleibt'))).toBe('Ada Lovelace 14:25 Uhr Bleibt');
    await waitFor(() => expect(toast()).toContain('Die Nachricht konnte nicht gelöscht werden.'));
  });
  it('turns a Message deleted live into a ghost that keeps its place, author and time', async () => {
    const { realtime, fixture } = await openChannel([
      message(3, 'Danach'),
      message(2, 'Peinlich', { authorId: alan.id }),
      message(1, 'Davor'),
    ]);

    realtime.emit({
      type: 'message.updated',
      message: { ...message(2, '', { authorId: alan.id }), editedAt, deletedAt: editedAt },
    });
    await settle(fixture);

    const log = screen.getByRole('region', { name: 'Nachrichten' });
    expect(within(log).getAllByRole('listitem').map(shownText)).toEqual([
      'Ada Lovelace 14:25 Uhr Davor',
      'Alan Turing 14:25 Uhr Diese Nachricht wurde gelöscht.',
      'Ada Lovelace 14:25 Uhr Danach',
    ]);
  });
});
