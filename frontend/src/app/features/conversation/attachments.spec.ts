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

  it('attaches files dropped onto the composer, highlighting it while they are dragged over', async () => {
    const { http, fixture } = await openChannel();
    const files = [file('Plan.pdf', 'application/pdf'), file('Notizen.txt', 'text/plain')];
    const dataTransfer = { types: ['Files'], files, dropEffect: 'none' };

    fireEvent.dragEnter(composer(), { dataTransfer });
    fireEvent.dragOver(composer(), { dataTransfer });
    await settle(fixture);
    expect(composer().classList).toContain('border-dashed');
    // Moving onto one of its elements enters that before leaving the composer, so it's still over it.
    fireEvent.dragEnter(sendButton(), { dataTransfer });
    fireEvent.dragLeave(composer(), { dataTransfer });
    await settle(fixture);
    expect(composer().classList).toContain('border-dashed');

    const dropped = fireEvent.drop(sendButton(), { dataTransfer });
    await settle(fixture);
    expect(dropped).toBe(false);
    expect(composer().classList).not.toContain('border-dashed');
    expect(
      http
        .match('/api/attachments/uploads')
        .map((request: TestRequest) => (request.request.body as RequestUploadRequest).name),
    ).toEqual(['Plan.pdf', 'Notizen.txt']);
    expect(within(composer()).getByText('Notizen.txt')).toBeTruthy();

    // Dragging something that isn't files, such as text, is left to the text box.
    const text = fireEvent.dragOver(composer(), {
      dataTransfer: { types: ['text/plain'], files: [] },
    });
    await settle(fixture);
    expect(text).toBe(true);
    expect(composer().classList).not.toContain('border-dashed');
    fireEvent.dragEnter(composer(), { dataTransfer });
    fireEvent.dragLeave(composer(), { dataTransfer });
    await settle(fixture);
    expect(composer().classList).not.toContain('border-dashed');
  });

  it("doesn't attach files dropped while a send is in flight, nor let the browser open them", async () => {
    const user = userEvent.setup();
    const { http, fixture } = await openChannel();
    await user.type(screen.getByRole('combobox', { name: 'Nachricht an #Allgemein' }), 'Hallo');
    await user.click(sendButton());
    const dataTransfer = { types: ['Files'], files: [file('Plan.pdf', 'application/pdf')] };

    fireEvent.dragEnter(composer(), { dataTransfer });
    await settle(fixture);
    expect(composer().classList).not.toContain('border-dashed');
    expect(fireEvent.drop(composer(), { dataTransfer })).toBe(false);
    await settle(fixture);

    http.expectNone('/api/attachments/uploads');
    http.expectOne('/api/conversations/1/messages').flush(message(1, 'Hallo'));
  });

  it('attaches images pasted into the text box, named after when they were pasted', async () => {
    const { http, fixture } = await openChannel();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 25, 9, 5, 7));
    const textBox = screen.getByRole('combobox', { name: 'Nachricht an #Allgemein' });

    const pasted = fireEvent.paste(textBox, {
      // Real bytes, as the renamed copy has the bytes' size, not a faked one.
      clipboardData: {
        types: ['Files'],
        files: [new File(['png'], 'image.png', { type: 'image/png' })],
      },
    });
    vi.useRealTimers();
    await settle(fixture);

    expect(pasted).toBe(false);
    expect(http.expectOne('/api/attachments/uploads').request.body).toEqual({
      name: 'Bild-2026-10-25-090507.png',
      size: 3,
      contentType: 'image/png',
    });
    expect(within(composer()).getByText('Bild-2026-10-25-090507.png')).toBeTruthy();

    // Text, even with an image beside it as Word puts there, and files that aren't images, paste as they would.
    const text = fireEvent.paste(textBox, {
      clipboardData: {
        types: ['text/plain', 'text/html', 'Files'],
        files: [new File(['png'], 'image.png', { type: 'image/png' })],
      },
    });
    const pdf = fireEvent.paste(textBox, {
      clipboardData: { types: ['Files'], files: [file('Plan.pdf', 'application/pdf')] },
    });
    await settle(fixture);
    expect(text).toBe(true);
    expect(pdf).toBe(true);
    http.expectNone('/api/attachments/uploads');

    // A copied image file that isn't a PNG keeps its own name.
    fireEvent.paste(textBox, {
      clipboardData: { types: ['Files'], files: [file('Foto.jpg', 'image/jpeg')] },
    });
    await settle(fixture);
    expect(
      (http.expectOne('/api/attachments/uploads').request.body as RequestUploadRequest).name,
    ).toBe('Foto.jpg');
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

describe('The lightbox', () => {
  const photo = {
    ...attachment(1, 'Foto.jpg', 'image/jpeg'),
    thumbnailUrl: 'http://storage/thumb?sig=1',
  };
  const logo = attachment(2, 'Logo.png', 'image/png');
  const pdf = attachment(3, 'Plan.pdf', 'application/pdf');

  function openChannelWithImages() {
    return openChannel([
      { ...message(1, 'Schau', { authorId: alan.id }), attachments: [photo, pdf, logo] },
    ]);
  }

  function lightbox(): HTMLElement {
    return screen.getByRole('dialog');
  }

  it('opens an image fitted on a dark overlay, with its name, sender, time and download', async () => {
    const user = userEvent.setup();
    await openChannelWithImages();

    await user.click(screen.getByRole('button', { name: 'Bild Foto.jpg öffnen' }));

    expect(screen.getByRole('dialog', { name: 'Foto.jpg' })).toBe(lightbox());
    expect(within(lightbox()).getByRole('img', { name: 'Foto.jpg' }).getAttribute('src')).toBe(
      photo.url,
    );
    expect(shownText(lightbox())).toContain('Alan Turing');
    expect(shownText(lightbox())).toContain('15.01.2026, 14:25');
    expect(within(lightbox()).getByRole('button', { name: 'Foto.jpg herunterladen' })).toBeTruthy();
    expect(within(lightbox()).getByText('1 / 2')).toBeTruthy();
    await expectNoA11yViolations();
  });

  it("steps through the Message's images with ← →, the arrow buttons and a swipe", async () => {
    const user = userEvent.setup();
    await openChannelWithImages();
    await user.click(screen.getByRole('button', { name: 'Bild Foto.jpg öffnen' }));

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('dialog', { name: 'Logo.png' })).toBeTruthy();
    expect(within(lightbox()).getByText('2 / 2')).toBeTruthy();
    // The last image is as far as it goes.
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('dialog', { name: 'Logo.png' })).toBeTruthy();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('dialog', { name: 'Foto.jpg' })).toBeTruthy();

    await user.click(within(lightbox()).getByRole('button', { name: 'Nächstes Bild' }));
    expect(screen.getByRole('dialog', { name: 'Logo.png' })).toBeTruthy();
    await user.click(within(lightbox()).getByRole('button', { name: 'Vorheriges Bild' }));
    expect(screen.getByRole('dialog', { name: 'Foto.jpg' })).toBeTruthy();

    // Swiping left brings in the next image, and doesn't count as a click outside it.
    const stage = within(lightbox()).getByRole('img').parentElement!;
    fireEvent.pointerDown(stage, { clientX: 300, clientY: 200 });
    fireEvent.pointerUp(stage, { clientX: 120, clientY: 210 });
    fireEvent.click(stage);
    expect(screen.getByRole('dialog', { name: 'Logo.png' })).toBeTruthy();
    fireEvent.pointerDown(stage, { clientX: 120, clientY: 200 });
    fireEvent.pointerUp(stage, { clientX: 300, clientY: 200 });
    expect(screen.getByRole('dialog', { name: 'Foto.jpg' })).toBeTruthy();
  });

  it('closes with ✕, Escape or a click outside the image, giving focus back to the thumbnail', async () => {
    const user = userEvent.setup();
    const { fixture } = await openChannelWithImages();
    const thumbnail = screen.getByRole('button', { name: 'Bild Foto.jpg öffnen' });

    await user.click(thumbnail);
    await settle(fixture);
    // jsdom lays nothing out, so the CDK's focus trap finds nothing to Tab to; the E2E journey checks it.
    expect(lightbox().contains(document.activeElement)).toBe(true);
    await user.click(within(lightbox()).getByRole('button', { name: 'Schließen' }));
    await settle(fixture);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(thumbnail);

    await user.keyboard('{Enter}');
    await settle(fixture);
    // user-event leaves keyCode at 0, but the CDK reads keyCode (browsers set 27).
    fireEvent.keyDown(lightbox(), { key: 'Escape', keyCode: 27 });
    await settle(fixture);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(thumbnail);

    await user.click(thumbnail);
    // A click on the image itself keeps it open.
    await user.click(within(lightbox()).getByRole('img'));
    expect(screen.queryByRole('dialog')).not.toBeNull();
    await user.click(within(lightbox()).getByRole('img').parentElement!);
    await settle(fixture);
    expect(screen.queryByRole('dialog')).toBeNull();

    // The top bar's empty space is outside the image too.
    await user.click(thumbnail);
    await user.click(lightbox().querySelector('header')!);
    await settle(fixture);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('downloads the shown image with a fresh URL', async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { http, fixture } = await openChannelWithImages();
    await user.click(screen.getByRole('button', { name: 'Bild Foto.jpg öffnen' }));
    await user.keyboard('{ArrowRight}');

    await user.click(within(lightbox()).getByRole('button', { name: 'Logo.png herunterladen' }));
    http
      .expectOne('/api/conversations/1/messages/1/attachments/2/url?download=true')
      .flush({ url: 'http://storage/download?sig=2' });
    await settle(fixture);

    expect((click.mock.contexts.at(-1) as HTMLAnchorElement).href).toBe(
      'http://storage/download?sig=2',
    );
  });

  it('shows fresh URLs once an image fails to load, and closes once the Message is deleted', async () => {
    const user = userEvent.setup();
    const { http, fixture, realtime } = await openChannelWithImages();
    await user.click(screen.getByRole('button', { name: 'Bild Foto.jpg öffnen' }));

    fireEvent.error(within(lightbox()).getByRole('img'));
    await settle(fixture);
    http.expectOne('/api/conversations/1/messages/1').flush({
      ...message(1, 'Schau', { authorId: alan.id }),
      attachments: [{ ...photo, url: 'http://storage/fresh' }, pdf, logo],
    });
    await settle(fixture);
    expect(within(lightbox()).getByRole('img').getAttribute('src')).toBe('http://storage/fresh');

    realtime.emit({
      type: 'message.updated',
      message: { ...message(1, '', { authorId: alan.id }), deletedAt: message(1, '').createdAt },
    });
    await settle(fixture);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
