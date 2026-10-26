import { Dialog } from '@angular/cdk/dialog';
import { HttpEventType } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { fireEvent, screen, waitFor, within } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { SetAvatarRequest } from '../../api/generated/model';
import { expectNoA11yViolations } from '../../../testing/a11y';
import { ada, alan, message, renderApp, settle } from '../../../testing/app';
import { FakeKeycloak } from '../../../testing/fake-keycloak';
import { UserDto } from '../../core/data/user.store';

const users = [ada, alan];
const uploadedUrl = 'http://storage.test/dabubble/avatars/neu?X-Amz-Signature=1';

function image(name: string, type: string, size = 1000): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

/** Opens Ada's own profile from the user menu and switches it to editing. */
async function openEdit(options: { me?: UserDto } = {}) {
  const app = await renderApp({ users, ...options });
  await userEvent.click(screen.getByRole('button', { name: /^Ada Lovelace/ }));
  const menu = await screen.findByRole('menu', { name: 'Benutzermenü' });
  await userEvent.click(within(menu).getByRole('menuitem', { name: 'Profil' }));
  const card = await screen.findByRole('dialog', { name: 'Profil' });
  await userEvent.click(within(card).getByRole('button', { name: 'Bearbeiten' }));
  const dialog = await screen.findByRole('dialog', { name: 'Dein Profil bearbeiten' });
  return { ...app, dialog };
}

function avatarButton(dialog: HTMLElement): HTMLElement {
  return within(dialog).getByRole('button', { name: 'Avatar ändern' });
}

async function chooseFromMenu(dialog: HTMLElement, item: string): Promise<void> {
  await userEvent.click(avatarButton(dialog));
  const menu = await screen.findByRole('menu', { name: 'Avatar ändern' });
  await userEvent.click(within(menu).getByRole('menuitem', { name: item }));
}

function fileInput(dialog: HTMLElement): HTMLInputElement {
  return dialog.querySelector('input[type=file]')!;
}

function save(dialog: HTMLElement) {
  return userEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
}

describe('Editing the own profile', () => {
  afterEach(() => TestBed.inject(Dialog).closeAll());

  it('renames the User, trimmed, and shows the new name in the card and the header', async () => {
    const { dialog, http, fixture } = await openEdit();
    const name = within(dialog).getByRole('textbox', { name: 'Vollständiger Name' });
    expect((name as HTMLInputElement).value).toBe('Ada Lovelace');
    await expectNoA11yViolations();

    await userEvent.clear(name);
    await userEvent.type(name, '  Ada King  ');
    await save(dialog);

    const request = http.expectOne({ method: 'PUT', url: '/api/me/name' });
    expect(request.request.body).toEqual({ name: 'Ada King' });
    request.flush({ ...ada, name: 'Ada King' });
    await settle(fixture);

    const card = await screen.findByRole('dialog', { name: 'Profil' });
    expect(within(card).getByRole('heading', { name: 'Ada King' })).toBeTruthy();
    // The open dialog hides the rest of the page from assistive technology.
    TestBed.inject(Dialog).closeAll();
    await settle(fixture);
    expect(screen.getByRole('button', { name: /^Ada King/ })).toBeTruthy();
    http.expectNone('/api/me/avatar');
  });

  it('refuses a blank name or one over 50 characters, and sends nothing', async () => {
    const { dialog, http } = await openEdit();
    const name = within(dialog).getByRole('textbox', { name: 'Vollständiger Name' });

    await userEvent.clear(name);
    await userEvent.type(name, '   ');
    await save(dialog);
    expect(within(dialog).getByText('Bitte gib deinen Namen ein.')).toBeTruthy();
    expect(name.getAttribute('aria-invalid')).toBe('true');

    await userEvent.clear(name);
    await userEvent.type(name, 'a'.repeat(51));
    await save(dialog);
    expect(within(dialog).getByText('Ein Name hat höchstens 50 Zeichen.')).toBeTruthy();

    http.expectNone('/api/me/name');
    await expectNoA11yViolations();
  });

  it('changes nothing on "Abbrechen", and goes back to the profile', async () => {
    const { dialog, http } = await openEdit();
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Vollständiger Name' }), '!');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));

    const card = await screen.findByRole('dialog', { name: 'Profil' });
    expect(within(card).getByRole('heading', { name: 'Ada Lovelace' })).toBeTruthy();
    http.expectNone('/api/me/name');
  });

  it('picks one of the 6 predefined Avatars from the list', async () => {
    const { dialog, http, fixture } = await openEdit();

    await chooseFromMenu(dialog, 'Aus der Liste wählen');
    const list = await screen.findByRole('radiogroup', { name: 'Aus der Liste wählen' });
    expect(within(list).getAllByRole('radio')).toHaveLength(6);
    await expectNoA11yViolations();
    await userEvent.click(within(list).getByRole('radio', { name: 'Avatar 3' }));

    await waitFor(() => expect(screen.queryByRole('radiogroup')).toBeNull());
    const preview = within(dialog).getByRole('img', { name: 'Ada Lovelace' });
    expect(preview.getAttribute('src')).toBe('/avatars/3.webp');
    await save(dialog);

    http.expectNone('/api/me/name');
    const request = http.expectOne({ method: 'PUT', url: '/api/me/avatar' });
    expect(request.request.body).toEqual({ avatar: 'AVATAR_3' } satisfies SetAvatarRequest);
    request.flush({ ...ada, avatar: 'AVATAR_3' });
    await settle(fixture);
    expect(await screen.findByRole('dialog', { name: 'Profil' })).toBeTruthy();
  });

  it('uploads a picture with a progress ring, previews it, and saves it', async () => {
    const { dialog, http, fixture } = await openEdit();

    await chooseFromMenu(dialog, 'Foto hochladen');
    await userEvent.upload(fileInput(dialog), image('Urlaub.jpg', 'image/jpeg'));

    const upload = http.expectOne({ method: 'POST', url: '/api/me/avatar/uploads' });
    expect((upload.request.body as FormData).get('file')).toBeInstanceOf(File);
    upload.event({ type: HttpEventType.UploadProgress, loaded: 40, total: 100 });
    await settle(fixture);
    const ring = within(dialog).getByRole('progressbar', { name: 'Avatar wird hochgeladen' });
    expect(ring.getAttribute('aria-valuenow')).toBe('40');
    expect(
      within(dialog).getByRole<HTMLButtonElement>('button', { name: 'Speichern' }).disabled,
    ).toBe(true);
    await expectNoA11yViolations();

    upload.flush({ id: 9, url: uploadedUrl });
    await settle(fixture);
    expect(within(dialog).queryByRole('progressbar')).toBeNull();
    expect(within(dialog).getByRole('img', { name: 'Ada Lovelace' }).getAttribute('src')).toBe(
      uploadedUrl,
    );
    await save(dialog);

    const request = http.expectOne({ method: 'PUT', url: '/api/me/avatar' });
    expect(request.request.body).toEqual({ uploadId: 9 } satisfies SetAvatarRequest);
    request.flush({ ...ada, avatar: null, uploadedAvatarUrl: uploadedUrl });
    await settle(fixture);
    TestBed.inject(Dialog).closeAll();
    await settle(fixture);
    const header = screen.getByRole('button', { name: /^Ada Lovelace/ });
    expect(header.querySelector('img')!.getAttribute('src')).toBe(uploadedUrl);
  });

  it('uploads a picture dropped on the Avatar', async () => {
    const { dialog, http, fixture } = await openEdit();
    const dataTransfer = { types: ['Files'], files: [image('Foto.png', 'image/png')] };

    fireEvent.dragEnter(avatarButton(dialog), { dataTransfer });
    fireEvent.dragOver(avatarButton(dialog), { dataTransfer });
    await settle(fixture);
    expect(within(dialog).getByText('Loslassen zum Hochladen')).toBeTruthy();
    const dropped = fireEvent.drop(avatarButton(dialog), { dataTransfer });
    await settle(fixture);

    expect(dropped).toBe(false);
    expect(within(dialog).queryByText('Loslassen zum Hochladen')).toBeNull();
    http.expectOne({ method: 'POST', url: '/api/me/avatar/uploads' });
  });

  it('refuses a file over 5 MB or of another type at once, in a red pill', async () => {
    const { dialog, http, fixture } = await openEdit();

    fireEvent.drop(avatarButton(dialog), {
      dataTransfer: {
        types: ['Files'],
        files: [image('Riesig.jpg', 'image/jpeg', 6 * 1024 * 1024)],
      },
    });
    await settle(fixture);
    const pill = within(dialog).getByRole('alert');
    expect(pill.textContent).toContain('„Riesig.jpg“ ist zu groß. Ein Avatar hat höchstens 5 MB.');
    await expectNoA11yViolations();

    fireEvent.drop(avatarButton(dialog), {
      dataTransfer: { types: ['Files'], files: [image('Animation.gif', 'image/gif')] },
    });
    await settle(fixture);
    expect(within(dialog).getByRole('alert').textContent).toContain(
      '„Animation.gif“ geht nicht: nur JPG, PNG oder WebP.',
    );

    await userEvent.click(within(dialog).getByRole('button', { name: 'Fehlermeldung schließen' }));
    expect(within(dialog).queryByRole('alert')).toBeNull();
    http.expectNone('/api/me/avatar/uploads');
  });

  it("leaves a file whose type the browser doesn't know to the server", async () => {
    const { dialog, http, fixture } = await openEdit();

    fireEvent.drop(avatarButton(dialog), {
      dataTransfer: { types: ['Files'], files: [image('Foto.webp', '')] },
    });
    await settle(fixture);

    expect(within(dialog).queryByRole('alert')).toBeNull();
    http.expectOne({ method: 'POST', url: '/api/me/avatar/uploads' });
  });

  it("shows the server's verdict on a file it can't read", async () => {
    const { dialog, http, fixture } = await openEdit();

    await chooseFromMenu(dialog, 'Foto hochladen');
    await userEvent.upload(fileInput(dialog), image('Kaputt.png', 'image/png'));
    http
      .expectOne('/api/me/avatar/uploads')
      .flush(
        { status: 415, code: 'AVATAR_TYPE_UNSUPPORTED' },
        { status: 415, statusText: 'Unsupported Media Type' },
      );
    await settle(fixture);

    expect(within(dialog).getByRole('alert').textContent).toContain(
      '„Kaputt.png“ geht nicht: nur JPG, PNG oder WebP.',
    );
    expect(within(dialog).getByRole('img', { name: 'Ada Lovelace' }).getAttribute('src')).toBe(
      '/avatars/1.webp',
    );
  });

  it('discards an unsaved upload on "Abbrechen"', async () => {
    const { dialog, http, fixture } = await openEdit();
    await chooseFromMenu(dialog, 'Foto hochladen');
    await userEvent.upload(fileInput(dialog), image('Urlaub.jpg', 'image/jpeg'));
    http.expectOne('/api/me/avatar/uploads').flush({ id: 9, url: uploadedUrl });
    await settle(fixture);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));

    const card = await screen.findByRole('dialog', { name: 'Profil' });
    expect(card.querySelector('img')!.getAttribute('src')).toBe('/avatars/1.webp');
    http.expectNone('/api/me/avatar');
  });

  it('removes an uploaded Avatar, falling back to the first predefined one', async () => {
    const me = { ...ada, avatar: null, uploadedAvatarUrl: uploadedUrl };
    const { dialog, http } = await openEdit({ me });

    await chooseFromMenu(dialog, 'Foto entfernen');
    await save(dialog);

    expect(http.expectOne('/api/me/avatar').request.body).toEqual({
      avatar: 'AVATAR_1',
    } satisfies SetAvatarRequest);
  });

  it('offers "Foto entfernen" only while the Avatar is an uploaded one', async () => {
    const { dialog } = await openEdit();

    await userEvent.click(avatarButton(dialog));
    const menu = await screen.findByRole('menu', { name: 'Avatar ändern' });

    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent.trim()),
    ).toEqual(['Foto hochladen', 'Aus der Liste wählen']);
    await expectNoA11yViolations();
  });

  it('works by keyboard: the Avatar menu opens with Enter and closes with Escape', async () => {
    const { dialog } = await openEdit();
    avatarButton(dialog).focus();

    await userEvent.keyboard('{Enter}');
    const menu = await screen.findByRole('menu', { name: 'Avatar ändern' });
    await waitFor(() =>
      expect(within(menu).getByRole('menuitem', { name: 'Foto hochladen' })).toBe(
        document.activeElement,
      ),
    );
    await userEvent.keyboard('{ArrowDown}{Enter}');
    const list = await screen.findByRole('radiogroup', { name: 'Aus der Liste wählen' });
    await waitFor(() => expect(list.contains(document.activeElement)).toBe(true));

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('radiogroup')).toBeNull());
    expect(avatarButton(dialog)).toBe(document.activeElement);
    expect(screen.getByRole('dialog', { name: 'Dein Profil bearbeiten' })).toBeTruthy();
  });

  it('offers the Guest no editing', async () => {
    const keycloak = new FakeKeycloak();
    keycloak.realmAccess.roles = ['guest'];
    await renderApp({ users, keycloak, me: { ...ada, name: 'Guest', avatar: 'GUEST' } });

    await userEvent.click(screen.getByRole('button', { name: /^Guest/ }));
    const menu = await screen.findByRole('menu', { name: 'Benutzermenü' });
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Profil' }));

    const card = await screen.findByRole('dialog', { name: 'Profil' });
    expect(within(card).queryByRole('button', { name: 'Bearbeiten' })).toBeNull();
  });
});

describe('Profile changes of others', () => {
  afterEach(() => TestBed.inject(Dialog).closeAll());

  it('show live wherever the User appears', async () => {
    const { http, fixture, realtime } = await renderApp({ url: '/channel/1', users });
    http
      .expectOne('/api/conversations/1/messages')
      .flush({ messages: [message(1, 'Hallo', { authorId: alan.id })], nextCursor: null });
    await settle(fixture);

    realtime.emit({
      type: 'user.updated',
      user: { ...alan, name: 'Alan M. Turing', avatar: null, uploadedAvatarUrl: uploadedUrl },
    });
    await settle(fixture);

    const log = screen.getByRole('region', { name: 'Nachrichten' });
    const author = within(log).getByRole('button', { name: 'Alan M. Turing' });
    expect(author).toBeTruthy();
    expect(log.querySelector(`img[src="${uploadedUrl}"]`)).toBeTruthy();
  });

  it('refetches a User whose uploaded Avatar stopped loading, its URL having expired', async () => {
    const withUpload = { ...alan, avatar: null, uploadedAvatarUrl: uploadedUrl };
    const { http, fixture } = await renderApp({ url: '/channel/1', users: [ada, withUpload] });
    http
      .expectOne('/api/conversations/1/messages')
      .flush({ messages: [message(1, 'Hallo', { authorId: alan.id })], nextCursor: null });
    await settle(fixture);
    const log = screen.getByRole('region', { name: 'Nachrichten' });

    fireEvent.error(log.querySelector(`img[src="${uploadedUrl}"]`)!);

    const fresh = `${uploadedUrl}2`;
    (await vi.waitFor(() => http.expectOne(`/api/users/${alan.id}`))).flush({
      ...withUpload,
      uploadedAvatarUrl: fresh,
    });
    await settle(fixture);
    expect(log.querySelector(`img[src="${fresh}"]`)).toBeTruthy();
  });
});
