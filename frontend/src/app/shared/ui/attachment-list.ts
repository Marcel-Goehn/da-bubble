import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AttachmentDto } from '../../core/data/message.store';
import { thumbnailedTypes } from '../../core/data/thumbnails';
import { FileSizePipe } from './file-size.pipe';
import { Icon } from './icon';
import { IconName } from './icons';

/** Which Attachment to open, and whether to download it rather than open it in a tab. */
export interface AttachmentOpening {
  attachment: AttachmentDto;
  download: boolean;
}

/** The Material Symbol a file pill shows for [contentType]. */
function fileIcon(contentType: string): IconName {
  if (contentType === 'application/pdf') {
    return 'pictureAsPdf';
  }
  if (contentType.startsWith('image/')) {
    return 'image';
  }
  if (contentType.startsWith('video/')) {
    return 'movie';
  }
  if (contentType.startsWith('audio/')) {
    return 'audioFile';
  }
  return 'description';
}

/**
 * A Message's Attachments below its bubble: images as thumbnails (160×120, 110×90 on mobile), every other
 * file as a pill with its type icon, name and size, and a separate download button.
 */
@Component({
  selector: 'app-attachment-list',
  imports: [FileSizePipe, Icon, TranslocoPipe],
  host: { class: 'flex flex-wrap gap-10' },
  template: `
    @for (attachment of attachments(); track attachment.id) {
      @if (isImage(attachment)) {
        <button
          type="button"
          class="overflow-hidden rounded-20 border border-border hover:border-border-hover"
          [attr.aria-label]="'attachments.openImage' | transloco: { name: attachment.name }"
          (click)="imageOpened.emit(attachment)"
        >
          <img
            class="h-90 w-110 object-cover lg:h-120 lg:w-160"
            [src]="attachment.thumbnailUrl ?? attachment.url"
            [alt]="attachment.name"
            (error)="failed.emit()"
          />
        </button>
      } @else {
        <span
          class="flex max-w-full items-center rounded-full border border-border bg-surface hover:border-border-hover"
        >
          <button
            type="button"
            class="flex min-w-0 items-center gap-10 rounded-full py-8 pr-10 pl-15 text-left hover:text-interactive"
            [attr.aria-label]="
              'attachments.open'
                | transloco: { name: attachment.name, size: attachment.size | fileSize }
            "
            (click)="opened.emit({ attachment, download: false })"
          >
            <app-icon [name]="icon(attachment)" />
            <span class="truncate font-semibold">{{ attachment.name }}</span>
            &ngsp;<span class="text-14 whitespace-nowrap text-text-muted">{{
              attachment.size | fileSize
            }}</span>
          </button>
          <button
            type="button"
            class="flex rounded-full p-8 hover:bg-hover hover:text-interactive"
            [attr.aria-label]="'attachments.download' | transloco: { name: attachment.name }"
            (click)="opened.emit({ attachment, download: true })"
          >
            <app-icon name="download" />
          </button>
        </span>
      }
    }
  `,
})
export class AttachmentList {
  readonly attachments = input.required<readonly AttachmentDto[]>();
  /** An Attachment is to be opened in a new tab or downloaded. */
  readonly opened = output<AttachmentOpening>();
  /** An image is to be shown in the lightbox. */
  readonly imageOpened = output<AttachmentDto>();
  /** An image didn't load, e.g. because its URL has expired. */
  readonly failed = output();

  protected isImage(attachment: AttachmentDto): boolean {
    return thumbnailedTypes.includes(attachment.contentType);
  }

  protected icon(attachment: AttachmentDto): IconName {
    return fileIcon(attachment.contentType);
  }
}
