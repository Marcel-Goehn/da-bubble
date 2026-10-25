import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  Signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoPipe } from '@jsverse/transloco';
import { DateFormatOptions, TranslocoDatePipe } from '@jsverse/transloco-locale';
import { AttachmentDto } from '../../core/data/message.store';
import { nameDialogBy } from './dialog-frame';
import { Icon } from './icon';

/** How far, in px, a pointer must travel sideways to count as a swipe rather than a tap. */
const swipePx = 50;

/** What the lightbox shows: one Message's images, and who sent them when. */
export interface AttachmentLightboxData {
  /** The Message's images, in the order they were sent; kept current, e.g. with fresh URLs. */
  images: Signal<readonly AttachmentDto[]>;
  /** The image shown first. */
  start: AttachmentDto;
  authorName: string;
  /** When the Message was sent, as an ISO instant. */
  sentAt: string;
  /** [attachment] is to be downloaded. */
  download: (attachment: AttachmentDto) => void;
  /** An image didn't load, e.g. because its URL has expired. */
  failed: () => void;
}

let nextId = 0;

/**
 * A Message's images at full size, opened with the CDK `Dialog` over the whole viewport: a dark overlay with
 * the image fitted inside it (edge to edge on mobile), and a top bar with the image's name, its sender and
 * time, a download button and ✕. ✕, Escape or a click outside the image closes it; ← → and a swipe step
 * through the Message's images. The CDK traps focus inside and gives it back to the thumbnail on close.
 */
@Component({
  selector: 'app-attachment-lightbox',
  imports: [Icon, TranslocoDatePipe, TranslocoPipe],
  host: {
    class: 'flex h-full flex-col bg-scrim/90 text-text-inverse',
    // On the host, as the stage itself isn't a control: the keyboard has Escape and ✕ instead.
    '(pointerdown)': 'pointerDown($event)',
    '(pointerup)': 'pointerUp($event)',
    '(click)': 'clicked($event)',
  },
  template: `
    @if (image(); as image) {
      <header class="flex items-center gap-20 px-16 py-10 lg:px-45" #bar>
        <div class="flex min-w-0 flex-1 flex-col">
          <h2 [id]="headingId" class="truncate font-bold">{{ image.name }}</h2>
          <p class="truncate text-14">
            {{
              'attachments.lightbox.byline'
                | transloco
                  : { name: data.authorName, date: data.sentAt | translocoDate: dateFormat }
            }}
          </p>
        </div>
        @if (images().length > 1) {
          <span class="text-14">{{
            'attachments.lightbox.position'
              | transloco: { index: index() + 1, count: images().length }
          }}</span>
        }
        <button
          type="button"
          class="flex rounded-full p-8 hover:bg-scrim/60"
          [attr.aria-label]="'attachments.download' | transloco: { name: image.name }"
          (click)="data.download(image)"
        >
          <app-icon name="download" />
        </button>
        <button
          type="button"
          class="flex rounded-full p-8 hover:bg-scrim/60"
          [attr.aria-label]="'dialog.close' | transloco"
          (click)="dialogRef.close()"
        >
          <app-icon name="close" />
        </button>
      </header>
      <!-- Clicks around the image close the lightbox; sideways swipes step. -->
      <div
        class="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center lg:p-45"
        #stage
      >
        <img
          class="max-h-full max-w-full object-contain select-none"
          draggable="false"
          [src]="image.url"
          [alt]="image.name"
          (error)="data.failed()"
        />
        @if (images().length > 1) {
          <button
            type="button"
            class="absolute left-16 flex rounded-full bg-scrim/60 p-8 hover:bg-scrim disabled:invisible"
            [attr.aria-label]="'attachments.lightbox.previous' | transloco"
            [disabled]="index() === 0"
            (click)="step(-1)"
          >
            <app-icon name="chevronLeft" />
          </button>
          <button
            type="button"
            class="absolute right-16 flex rounded-full bg-scrim/60 p-8 hover:bg-scrim disabled:invisible"
            [attr.aria-label]="'attachments.lightbox.next' | transloco"
            [disabled]="index() === images().length - 1"
            (click)="step(1)"
          >
            <app-icon name="chevronRight" />
          </button>
        }
      </div>
    }
  `,
})
export class AttachmentLightbox {
  protected readonly data = inject<AttachmentLightboxData>(DIALOG_DATA);
  protected readonly dialogRef = inject(DialogRef);
  protected readonly headingId = `app-lightbox-heading-${nextId++}`;
  protected readonly dateFormat: DateFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };

  protected readonly images = this.data.images;
  /** The shown image's id, so it stays shown when the images are replaced, e.g. with fresh URLs. */
  private readonly shownId = signal(this.data.start.id);
  protected readonly index = computed(() =>
    Math.max(
      0,
      this.images().findIndex((it) => it.id === this.shownId()),
    ),
  );
  protected readonly image = computed(() => this.images()[this.index()]);
  /** The empty space of these two is outside the image, where a click closes the lightbox. */
  private readonly bar = viewChild<ElementRef<HTMLElement>>('bar');
  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');

  /** Where the current pointer went down, to tell a swipe and a drag from a click. */
  private pointerStart: { x: number; y: number } | null = null;
  /** Whether the pointer moved too far for its click to count. */
  private moved = false;

  constructor() {
    // Named by the shown image's name.
    nameDialogBy(this.dialogRef, this.headingId);
    // ← → step wherever focus is, as long as the lightbox is the topmost overlay.
    this.dialogRef.keydownEvents.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        this.step(event.key === 'ArrowLeft' ? -1 : 1);
      }
    });
    // A Message deleted while it's open has no images left to show.
    effect(() => {
      if (this.images().length === 0) {
        this.dialogRef.close();
      }
    });
  }

  /** Shows the image [by] places on, if there is one. */
  protected step(by: number): void {
    const next = this.images()[this.index() + by];
    if (next) {
      this.shownId.set(next.id);
    }
  }

  /** Notes where a pointer went down, for [pointerUp] to tell a swipe from a click. */
  protected pointerDown(event: PointerEvent): void {
    this.pointerStart = { x: event.clientX, y: event.clientY };
    this.moved = false;
  }

  /** Steps on a sideways swipe; any movement this far means the click that follows doesn't count. */
  protected pointerUp(event: PointerEvent): void {
    if (!this.pointerStart) {
      return;
    }
    const dx = event.clientX - this.pointerStart.x;
    const dy = event.clientY - this.pointerStart.y;
    this.pointerStart = null;
    this.moved = Math.hypot(dx, dy) >= swipePx;
    if (this.moved && Math.abs(dx) > Math.abs(dy)) {
      // Swiping left brings the next image in from the right.
      this.step(dx < 0 ? 1 : -1);
    }
  }

  /** Closes on a click outside the image and the controls, unless it ended a swipe. */
  protected clicked(event: MouseEvent): void {
    const outside = [this.bar(), this.stage()].some((it) => it?.nativeElement === event.target);
    if (outside && !this.moved) {
      this.dialogRef.close();
    }
    this.moved = false;
  }
}
