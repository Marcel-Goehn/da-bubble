import {
  booleanAttribute,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  AttachmentUploads,
  maxAttachments,
  maxAttachmentSize,
  UploadError,
  UploadFailure,
} from '../../core/data/attachment-uploads';
import { thumbnailedTypes } from '../../core/data/thumbnails';
import { EmojiPickerButton } from './emoji-picker-button';
import { Icon } from './icon';
import { MentionField } from './mention-field';

/** A file picked for the next Message, while it uploads and once it has. */
export interface PendingAttachment {
  /** Tells it apart from the others while it has no Pending Upload. */
  readonly key: number;
  readonly name: string;
  /** An image's own pixels, shown while it's attached; `null` for other files. */
  readonly previewUrl: string | null;
  /** How much of it has arrived, from 0 to 1. */
  readonly progress: number;
  /** Its Pending Upload, once uploaded. */
  readonly uploadId: number | null;
  /** Why it can't be sent; it stays, in red, until it's removed. */
  readonly error: UploadError | null;
}

/** What the User sends: the text, trimmed, and the Pending Uploads of the files attached to it. */
export interface ComposedMessage {
  text: string;
  attachmentIds: number[];
}

let nextKey = 0;

/** Two digits, as in a time: 9 is `09`. */
function twoDigits(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * [image], pasted at [now]: a screenshot or other copied picture, which the clipboard holds as a PNG named
 * something like `image.png`, renamed `Bild-<yyyy-mm-dd-hhmmss>.png` in local time. The name is the file's,
 * kept as it is for everyone, not copy in the User's language. A copied image file of another type keeps
 * its own name.
 */
function pastedImage(image: File, now: Date): File {
  if (image.type !== 'image/png') {
    return image;
  }
  const date = [now.getFullYear(), twoDigits(now.getMonth() + 1), twoDigits(now.getDate())];
  const time = [now.getHours(), now.getMinutes(), now.getSeconds()].map(twoDigits).join('');
  return new File([image], `Bild-${date.join('-')}-${time}.png`, { type: image.type });
}

/** Whether [event] drags files, rather than e.g. text, which is the text box's. */
function dragsFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false;
}

/**
 * The text box Messages are written in (component sheets 61. and 63.). Enter sends, Shift+Enter starts a
 * new line. `@` and `#` mention a User or Channel from a picker, and the emoji button inserts an emoji from
 * the picker where the caret is. The text is a model, with Mentions as tokens, so the owner can keep it as a
 * draft; it's only cleared by the owner. 📎 attaches up to 5 files of up to 25 MB, which upload at once and
 * show inside the composer with their progress, a ✕ to remove them, and why one was refused. Files dropped
 * on it (dashed while they're dragged over) and images pasted into it are attached the same way. The attached
 * files are a model too, which the owner clears once they're sent.
 */
@Component({
  selector: 'app-composer',
  imports: [EmojiPickerButton, Icon, MentionField, TranslocoPipe],
  template: `
    <form
      class="flex flex-col gap-20 rounded-20 border bg-surface p-20"
      [class]="
        dragging()
          ? 'border-dashed border-border-focus bg-hover'
          : 'border-border hover:border-border-hover has-[textarea:focus-visible]:border-border-focus'
      "
      (submit)="submit($event)"
      (dragenter)="dragEnter($event)"
      (dragover)="dragOver($event)"
      (dragleave)="dragLeave($event)"
      (drop)="drop($event)"
      (paste)="paste($event)"
    >
      <app-mention-field
        [label]="label()"
        [placeholder]="label()"
        [busy]="busy()"
        [(text)]="text"
        (enterPressed)="enter($event)"
      />
      @if (attachments().length > 0) {
        <ul
          class="flex flex-wrap gap-10"
          aria-live="polite"
          [attr.aria-label]="'composer.attachments' | transloco"
        >
          @for (attachment of attachments(); track attachment.key) {
            <li
              class="flex max-w-full items-center gap-10 rounded-20 border p-8"
              [class]="attachment.error === null ? 'border-border' : 'border-danger'"
            >
              @if (attachment.previewUrl; as previewUrl) {
                <img
                  class="h-60 w-80 shrink-0 rounded-10 object-cover"
                  [src]="previewUrl"
                  [alt]="attachment.name"
                />
              } @else {
                <app-icon name="description" />
              }
              <span class="flex min-w-0 flex-col gap-4">
                <span class="truncate text-14 font-semibold">{{ attachment.name }}</span>
                @switch (attachment.error) {
                  @case ('tooLarge') {
                    <span class="text-14 text-danger">{{
                      'attachments.errors.tooLarge' | transloco
                    }}</span>
                  }
                  @case ('tooMany') {
                    <span class="text-14 text-danger">{{
                      'attachments.errors.tooMany' | transloco
                    }}</span>
                  }
                  @case ('failed') {
                    <span class="text-14 text-danger">{{
                      'attachments.errors.failed' | transloco
                    }}</span>
                  }
                  @default {
                    @if (attachment.uploadId === null) {
                      <span
                        class="h-4 w-80 overflow-hidden rounded-full bg-hover"
                        role="progressbar"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        [attr.aria-valuenow]="percent(attachment)"
                        [attr.aria-label]="
                          'composer.uploading' | transloco: { name: attachment.name }
                        "
                      >
                        <span
                          class="block h-full bg-accent"
                          [style.width.%]="percent(attachment)"
                        ></span>
                      </span>
                    }
                  }
                }
              </span>
              <button
                type="button"
                class="flex shrink-0 rounded-full p-4 hover:bg-hover hover:text-interactive"
                [attr.aria-label]="
                  'composer.removeAttachment' | transloco: { name: attachment.name }
                "
                (click)="remove(attachment)"
              >
                <app-icon name="close" />
              </button>
            </li>
          }
        </ul>
      }
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <app-emoji-picker-button
            icon="mood"
            position="above"
            [label]="'composer.emoji' | transloco"
            (picked)="insert($event)"
          />
          <button
            type="button"
            class="flex rounded-20 p-8 enabled:hover:bg-hover enabled:hover:text-interactive disabled:text-disabled"
            [attr.aria-label]="'composer.attach' | transloco"
            [disabled]="busy()"
            (click)="picker.click()"
          >
            <app-icon name="attachFile" />
          </button>
          <input
            type="file"
            multiple
            hidden
            [attr.aria-label]="'composer.chooseFiles' | transloco"
            (change)="pick(picker)"
            #picker
          />
        </div>
        <button
          type="submit"
          class="rounded-20 p-8 text-accent enabled:hover:bg-hover disabled:text-disabled"
          [attr.aria-label]="'composer.send' | transloco"
          [disabled]="!canSend()"
        >
          <app-icon name="sendFilled" />
        </button>
      </div>
    </form>
  `,
})
export class Composer {
  /** Names the text box for assistive technology and shows as its placeholder. */
  readonly label = input.required<string>();
  readonly text = model('');
  /** The files attached to the next Message. */
  readonly attachments = model<readonly PendingAttachment[]>([]);
  /** While a send is in flight: the text stays as it is and can't be sent again. */
  readonly busy = input(false, { transform: booleanAttribute });
  /** The text to send, trimmed, and the uploaded files; it has text or a file, and every file has arrived. */
  readonly send = output<ComposedMessage>();

  protected readonly canSend = computed(() => {
    const attachments = this.attachments();
    const ready = attachments.every((it) => it.error === null && it.uploadId !== null);
    return !this.busy() && ready && (this.text().trim() !== '' || attachments.length > 0);
  });

  /** Whether files are being dragged over it, to be dropped and attached. */
  protected readonly dragging = signal(false);
  /** How many of its elements, itself included, the dragged files are in. */
  private dragDepth = 0;

  private readonly uploads = inject(AttachmentUploads);

  private readonly field = viewChild.required(MentionField);

  constructor() {
    // An image's preview is let go once it's no longer attached, whether removed, sent or cleared.
    let previews = new Set<string>();
    effect(() => {
      const shown = new Set(this.attachments().flatMap((it) => it.previewUrl ?? []));
      previews.forEach((url) => {
        if (!shown.has(url)) {
          URL.revokeObjectURL(url);
        }
      });
      previews = shown;
    });
  }

  /** Attaches the files picked in [picker]. */
  protected pick(picker: HTMLInputElement): void {
    const files = Array.from(picker.files ?? []);
    // So picking the same file again still counts as a change.
    picker.value = '';
    this.attach(files);
  }

  /** Counts one up for each of its elements the files are dragged into; see [dragLeave]. */
  protected dragEnter(event: DragEvent): void {
    if (dragsFiles(event)) {
      this.dragDepth++;
      this.dragOver(event);
    }
  }

  /** Lets files dragged over it be dropped, and shows that they can; anything else is the text box's. */
  protected dragOver(event: DragEvent): void {
    if (!dragsFiles(event)) {
      return;
    }
    // Even while busy: a file dropped where the app doesn't take it opens in place of the app.
    event.preventDefault();
    this.dragging.set(!this.busy());
    event.dataTransfer!.dropEffect = this.busy() ? 'none' : 'copy';
  }

  /**
   * Counts one down when the files leave one of its elements. A child is entered before its parent is
   * left, so only leaving the composer itself counts down to 0; `relatedTarget` would tell too, but some
   * browsers leave it `null` here.
   */
  protected dragLeave(event: DragEvent): void {
    if (dragsFiles(event)) {
      this.dragDepth = Math.max(0, this.dragDepth - 1);
      this.dragging.set(this.dragDepth > 0);
    }
  }

  /** Attaches the files dropped on it, unless a send is in flight. */
  protected drop(event: DragEvent): void {
    this.dragDepth = 0;
    this.dragging.set(false);
    if (!dragsFiles(event)) {
      return;
    }
    // Otherwise the browser opens the file in place of the app.
    event.preventDefault();
    if (!this.busy()) {
      this.attach(Array.from(event.dataTransfer!.files));
    }
  }

  /**
   * Attaches the images pasted into it. Text pastes as it would anyway, even with an image beside it, as
   * Word and Excel put one there; so do files that aren't images.
   */
  protected paste(event: ClipboardEvent): void {
    const clipboard = event.clipboardData;
    const images = Array.from(clipboard?.files ?? []).filter((file) =>
      file.type.startsWith('image/'),
    );
    const text = clipboard?.types.some((type) => type === 'text/plain' || type === 'text/html');
    if (this.busy() || text || images.length === 0) {
      return;
    }
    event.preventDefault();
    const now = new Date();
    this.attach(images.map((image) => pastedImage(image, now)));
  }

  /**
   * Attaches [files] and starts uploading them. A file over 25 MB, or one more than the 5 a Message may have,
   * is shown with its error instead.
   */
  private attach(files: readonly File[]): void {
    let accepted = this.attachments().filter((it) => it.error === null).length;
    const picked = files.map((file) => {
      let error: UploadError | null = null;
      if (file.size > maxAttachmentSize) {
        error = 'tooLarge';
      } else if (accepted >= maxAttachments) {
        error = 'tooMany';
      } else {
        accepted++;
      }
      const attachment: PendingAttachment = {
        key: nextKey++,
        name: file.name,
        previewUrl: thumbnailedTypes.includes(file.type) ? URL.createObjectURL(file) : null,
        progress: 0,
        uploadId: null,
        error,
      };
      return { file, attachment };
    });
    this.attachments.update((attachments) => [
      ...attachments,
      ...picked.map((it) => it.attachment),
    ]);
    picked
      .filter(({ attachment }) => attachment.error === null)
      .forEach(({ file, attachment }) => void this.upload(file, attachment.key));
  }

  protected remove(attachment: PendingAttachment): void {
    this.attachments.update((attachments) => attachments.filter((it) => it.key !== attachment.key));
  }

  protected percent(attachment: PendingAttachment): number {
    return Math.round(attachment.progress * 100);
  }

  private async upload(file: File, key: number): Promise<void> {
    try {
      const uploadId = await this.uploads.upload(file, (progress) =>
        this.change(key, { progress }),
      );
      this.change(key, { progress: 1, uploadId });
    } catch (error) {
      this.change(key, { error: error instanceof UploadFailure ? error.reason : 'failed' });
    }
  }

  /** Applies [change] to the attached file [key], unless it's been removed or sent meanwhile. */
  private change(key: number, change: Partial<PendingAttachment>): void {
    this.attachments.update((attachments) =>
      attachments.map((it) => (it.key === key ? { ...it, ...change } : it)),
    );
  }

  /** Moves focus into the text box, e.g. when the pane it belongs to opens. */
  focus(): void {
    this.field().focus();
  }

  /** Puts [emoji] in place of the selection, with the caret after it and focus back in the text box. */
  protected insert(emoji: string): void {
    this.field().insert(emoji);
  }

  protected enter(event: KeyboardEvent): void {
    // An Enter that confirms an IME composition isn't meant to send.
    if (!event.isComposing) {
      this.submit(event);
    }
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.canSend()) {
      this.send.emit({
        text: this.text().trim(),
        attachmentIds: this.attachments().flatMap((it) => it.uploadId ?? []),
      });
    }
  }
}
