import { HttpEventType } from '@angular/common/http';
import { TestRequest } from '@angular/common/http/testing';
import { fireEvent, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { expectNoA11yViolations } from '../../../testing/a11y';
import { ada, alan, defaultChannel, message, renderApp, settle } from '../../../testing/app';
import { shownText } from '../../../testing/shown-text';
import { AttachmentDto, MessageDto } from '../../core/data/message.store';
import { Thumbnails } from '../../core/data/thumbnails';
import { RequestUploadRequest } from '../../api/generated/model';

const users = [ada, alan];
const megabyte = 1024 * 1024;

/** Makes no thumbnails, as jsdom can't draw; or [thumbnail] for every image. */
class FakeThumbnails {
  constructor(private readonly thumbnail: Blob | null = null) {}

  make(): Promise<Blob | null> {
    return Promise.resolve(this.thumbnail);
  }
}

/** Opens the Default Channel with [messages] (newest first) as its newest page. */
async function openChannel(messages: MessageDto[] = [], thumbnail: Blob | null = null) {
  const app = await renderApp({
    url: '/channel/1',
    conversations: [defaultChannel],
    users,
    providers: [{ provide: Thumbnails, useValue: new FakeThumbnails(thumbnail) }],
  });
  app.http.expectOne('/api/conversations/1/messages').flush({ messages, nextCursor: null });
  await settle(app.fixture);
  return app;
}

/** A file of [size] bytes, which only reports that size, so a large one costs nothing. */
function file(name: string, type: string, size = 5): File {
  const result = new File(['x'], name, { type });
  Object.defineProperty(result, 'size', { value: size });
  return result;
}

function composer(): HTMLElement {
  return screen.getByRole('combobox', { name: 'Nachricht an #Allgemein' }).closest('form')!;
}

function sendButton(): HTMLButtonElement {
  return within(composer()).getByRole('button', { name: 'Nachricht senden' });
}

/** Picks [files] with 📎, as the file picker would. */
async function attach(user: ReturnType<typeof userEvent.setup>, ...files: File[]): Promise<void> {
  await user.upload(within(composer()).getByLabelText('Dateien auswählen'), files);
}

function attachment(id: number, name: string, contentType: string, size = 1200): AttachmentDto {
  return {
    id,
    name,
    size,
    contentType,
    url: `http://storage/dabubble/attachments/${id}?sig=show`,
    thumbnailUrl: null,
  };
}

function shownMessage(text: string): HTMLElement {
  const log = screen.getByRole('region', { name: 'Nachrichten' });
  return within(log)
    .getAllByRole('listitem')
    .find((item) => item.textContent.includes(text))!;
}

describe('Attaching files', () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });

  it('uploads a file picked with 📎 with progress, and sends it without text', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await openChannel();

    await attach(user, file('Plan.pdf', 'application/pdf', 1200));
    const request = http.expectOne('/api/attachments/uploads');
    expect(request.request.body).toEqual({
      name: 'Plan.pdf',
      size: 1200,
      contentType: 'application/pdf',
    });
    request.flush({ id: 7, uploadUrl: 'http://storage/put?sig=1', thumbnailUploadUrl: null });
    await settle(fixture);

    const put = http.expectOne('http://storage/put?sig=1');
    expect(put.request.method).toBe('PUT');
    expect(put.request.headers.get('Content-Type')).toBe('application/pdf');
    expect(put.request.headers.has('Authorization')).toBe(false);
    put.event({ type: HttpEventType.UploadProgress, loaded: 600, total: 1200 });
    await settle(fixture);
    const progress = within(composer()).getByRole('progressbar', {
      name: 'Plan.pdf wird hochgeladen',
    });
    expect(progress.getAttribute('aria-valuenow')).toBe('50');
    expect(sendButton().disabled).toBe(true);
    await expectNoA11yViolations();

    put.flush(null);
    await settle(fixture);
    expect(within(composer()).queryByRole('progressbar')).toBeNull();
    expect(sendButton().disabled).toBe(false);

    await user.click(sendButton());
    const send = http.expectOne('/api/conversations/1/messages');
    expect(send.request.body).toEqual({ text: '', attachmentIds: [7] });
    send.flush({
      ...message(1, ''),
      attachments: [attachment(1, 'Plan.pdf', 'application/pdf')],
    });
    await settle(fixture);

    expect(within(composer()).queryByText('Plan.pdf')).toBeNull();
    expect(shownMessage('Plan.pdf')).toBeTruthy();
  });

  it('uploads a browser-made WebP thumbnail with an image', async () => {
    const user = userEvent.setup();
    const thumbnail = new Blob(['webp'], { type: 'image/webp' });
    const { http, fixture } = await openChannel([], thumbnail);

    await attach(user, file('Foto.jpg', 'image/jpeg', 2000));
    await settle(fixture);
    const request = http.expectOne('/api/attachments/uploads');
    expect(request.request.body).toEqual({
      name: 'Foto.jpg',
      size: 2000,
      contentType: 'image/jpeg',
      thumbnailSize: 4,
    });
    request.flush({
      id: 8,
      uploadUrl: 'http://storage/put?sig=file',
      thumbnailUploadUrl: 'http://storage/put?sig=thumb',
    });
    await settle(fixture);

    const thumbPut = http.expectOne('http://storage/put?sig=thumb');
    expect(thumbPut.request.headers.get('Content-Type')).toBe('image/webp');
    expect(thumbPut.request.body).toBe(thumbnail);
    thumbPut.flush(null);
    http.expectOne('http://storage/put?sig=file').flush(null);
    await settle(fixture);

    expect(within(composer()).getByRole('img', { name: 'Foto.jpg' })).toBeTruthy();
    expect(sendButton().disabled).toBe(false);
  });

  it('refuses a file over 25 MB and a sixth file in red, until they are removed with ✕', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await openChannel();

    await attach(
      user,
      file('Riesig.mp4', 'video/mp4', 25 * megabyte + 1),
      ...[1, 2, 3, 4, 5, 6].map((n) => file(`${n}.txt`, 'text/plain')),
    );
    const uploads = http.match('/api/attachments/uploads');
    expect(
      uploads.map((request: TestRequest) => (request.request.body as RequestUploadRequest).name),
    ).toEqual(['1.txt', '2.txt', '3.txt', '4.txt', '5.txt']);
    expect(shownText(within(composer()).getByText('Riesig.mp4').closest('li')!)).toContain(
      'Größer als 25 MB',
    );
    expect(shownText(within(composer()).getByText('6.txt').closest('li')!)).toContain(
      'Höchstens 5 Dateien pro Nachricht',
    );
    uploads.forEach((request: TestRequest, i: number) =>
      request.flush({ id: i + 1, uploadUrl: `http://storage/${i}`, thumbnailUploadUrl: null }),
    );
    await settle(fixture);
    http
      .match((request) => request.url.startsWith('http://storage/'))
      .forEach((put) => put.flush(null));
    await settle(fixture);
    expect(sendButton().disabled).toBe(true);
    await expectNoA11yViolations();

    await user.click(within(composer()).getByRole('button', { name: 'Riesig.mp4 entfernen' }));
    await user.click(within(composer()).getByRole('button', { name: '6.txt entfernen' }));

    expect(within(composer()).queryByText('Riesig.mp4')).toBeNull();
    expect(sendButton().disabled).toBe(false);
  });

  it("shows the server's refusal of a file in red", async () => {
    const user = userEvent.setup();
    const { http, fixture } = await openChannel();

    await attach(user, file('Plan.pdf', 'application/pdf'));
    http
      .expectOne('/api/attachments/uploads')
      .flush({ code: 'ATTACHMENT_TOO_LARGE' }, { status: 413, statusText: 'Content Too Large' });
    await settle(fixture);

    expect(shownText(within(composer()).getByText('Plan.pdf').closest('li')!)).toContain(
      'Größer als 25 MB',
    );
  });

  it('shows a failed upload in red', async () => {
    const user = userEvent.setup();
    const { http, fixture } = await openChannel();

    await attach(user, file('Plan.pdf', 'application/pdf'));
    http
      .expectOne('/api/attachments/uploads')
      .flush({ id: 7, uploadUrl: 'http://storage/put', thumbnailUploadUrl: null });
    await settle(fixture);
    http.expectOne('http://storage/put').flush(null, { status: 403, statusText: 'Forbidden' });
    await settle(fixture);

    expect(shownText(within(composer()).getByText('Plan.pdf').closest('li')!)).toContain(
      'Hochladen fehlgeschlagen',
    );
    expect(sendButton().disabled).toBe(true);
  });
});

describe('Attachments in Messages', () => {
  it('shows images as thumbnails and other files as pills with name and size, without an empty bubble', async () => {
    const photo = {
      ...attachment(1, 'Foto.jpg', 'image/jpeg'),
      thumbnailUrl: 'http://storage/thumb?sig=1',
    };
    const plain = attachment(2, 'Logo.png', 'image/png');
    const pdf = attachment(3, 'Plan.pdf', 'application/pdf', 1_258_291);
    await openChannel([
      { ...message(1, '', { authorId: alan.id }), attachments: [photo, plain, pdf] },
    ]);

    const shown = shownMessage('Plan.pdf');
    expect(within(shown).getByRole('img', { name: 'Foto.jpg' }).getAttribute('src')).toBe(
      'http://storage/thumb?sig=1',
    );
    // Without a thumbnail, the image shows itself.
    expect(within(shown).getByRole('img', { name: 'Logo.png' }).getAttribute('src')).toBe(
      plain.url,
    );
    expect(shownText(within(shown).getByRole('button', { name: /^Plan\.pdf .+ öffnen$/ }))).toBe(
      'Plan.pdf 1,2 MB',
    );
    expect(shown.querySelector('[class*="bg-bubble"]')).toBeNull();
    await expectNoA11yViolations();
  });

  it('opens a file in a new tab, or downloads it, with a fresh URL', async () => {
    const user = userEvent.setup();
    const tab = { opener: {}, location: { href: '' }, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const pdf = attachment(3, 'Plan.pdf', 'application/pdf');
    const { http, fixture } = await openChannel([
      { ...message(1, 'Hier', { authorId: alan.id }), attachments: [pdf] },
    ]);

    await user.click(screen.getByRole('button', { name: /^Plan\.pdf .+ öffnen$/ }));
    http
      .expectOne('/api/conversations/1/messages/1/attachments/3/url?download=false')
      .flush({ url: 'http://storage/open?sig=1' });
    await settle(fixture);

    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(tab.opener).toBeNull();
    expect(tab.location.href).toBe('http://storage/open?sig=1');

    await user.click(screen.getByRole('button', { name: 'Plan.pdf herunterladen' }));
    http
      .expectOne('/api/conversations/1/messages/1/attachments/3/url?download=true')
      .flush({ url: 'http://storage/download?sig=1' });
    await settle(fixture);

    const anchor = click.mock.contexts.at(-1) as HTMLAnchorElement;
    expect(anchor.href).toBe('http://storage/download?sig=1');
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('lets the author remove the text of a Message with Attachments, leaving no bubble', async () => {
    const user = userEvent.setup();
    const pdf = attachment(3, 'Plan.pdf', 'application/pdf');
    const { http, fixture } = await openChannel([{ ...message(1, 'Hier'), attachments: [pdf] }]);

    await user.click(
      within(shownMessage('Hier')).getByRole('button', { name: 'Weitere Aktionen' }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Nachricht bearbeiten' }));
    await user.clear(screen.getByRole('combobox', { name: 'Nachricht bearbeiten' }));
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    const request = http.expectOne('/api/conversations/1/messages/1');
    expect(request.request.body).toEqual({ text: '' });
    request.flush({ ...message(1, ''), attachments: [pdf], editedAt: message(1, '').createdAt });
    await settle(fixture);
    expect(shownMessage('Plan.pdf').querySelector('[class*="bg-bubble"]')).toBeNull();
  });

  it('fetches the Message again when its image no longer loads', async () => {
    const photo = attachment(1, 'Foto.jpg', 'image/jpeg');
    const { http, fixture } = await openChannel([
      { ...message(1, 'Schau', { authorId: alan.id }), attachments: [photo] },
    ]);

    fireEvent.error(screen.getByRole('img', { name: 'Foto.jpg' }));
    await settle(fixture);
    http.expectOne('/api/conversations/1/messages/1').flush({
      ...message(1, 'Schau', { authorId: alan.id }),
      attachments: [{ ...photo, url: 'http://storage/fresh' }],
    });
    await settle(fixture);

    expect(screen.getByRole('img', { name: 'Foto.jpg' }).getAttribute('src')).toBe(
      'http://storage/fresh',
    );
    // A fresh URL that fails too isn't asked for again and again.
    fireEvent.error(screen.getByRole('img', { name: 'Foto.jpg' }));
    fireEvent.error(screen.getByRole('img', { name: 'Foto.jpg' }));
    await settle(fixture);
    expect(http.match('/api/conversations/1/messages/1')).toHaveLength(0);
  });
});
