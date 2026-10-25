import { HttpClient, HttpEventType } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { filter, firstValueFrom, lastValueFrom, tap } from 'rxjs';
import { AttachmentsService } from '../../api/generated/attachments/attachments.service';
import { problemCode } from '../errors/problem';
import { Thumbnails } from './thumbnails';

/** 25 MB, the most a file may have. */
export const maxAttachmentSize = 25 * 1024 * 1024;
/** The most Attachments a Message may have. */
export const maxAttachments = 5;

/** Why a file can't be attached. */
export type UploadError = 'tooLarge' | 'tooMany' | 'failed';

/** An upload that failed, and why. */
export class UploadFailure extends Error {
  constructor(readonly reason: UploadError) {
    super(reason);
  }
}

/** The type a file is uploaded and stored with; one the browser doesn't know is plain bytes. */
export function uploadType(file: File): string {
  return file.type || 'application/octet-stream';
}

/**
 * Uploads files for Attachments: a Pending Upload from the backend, then the file and an image's thumbnail
 * straight to storage with the presigned PUTs. The Pending Upload is sent with the Message.
 */
@Service()
export class AttachmentUploads {
  private readonly api = inject(AttachmentsService);
  private readonly http = inject(HttpClient);
  private readonly thumbnails = inject(Thumbnails);

  /**
   * Uploads [file], telling [progress] how much of it has arrived (0 to 1). Resolves to the Pending Upload's
   * id, or rejects with an [UploadFailure].
   */
  async upload(file: File, progress: (fraction: number) => void): Promise<number> {
    if (file.size > maxAttachmentSize) {
      throw new UploadFailure('tooLarge');
    }
    const contentType = uploadType(file);
    const thumbnail = await this.thumbnails.make(file);
    try {
      const upload = await firstValueFrom(
        this.api.requestUpload({
          name: file.name,
          size: file.size,
          contentType,
          ...(thumbnail === null ? {} : { thumbnailSize: thumbnail.size }),
        }),
      );
      // A thumbnail that fails to arrive only costs the thumbnail; the image then shows itself.
      const thumbnailPut =
        thumbnail !== null && upload.thumbnailUploadUrl !== null
          ? this.put(upload.thumbnailUploadUrl, thumbnail, 'image/webp').catch(() => undefined)
          : Promise.resolve();
      await Promise.all([this.put(upload.uploadUrl, file, contentType, progress), thumbnailPut]);
      return upload.id;
    } catch (error) {
      throw new UploadFailure(
        problemCode(error) === 'ATTACHMENT_TOO_LARGE' ? 'tooLarge' : 'failed',
      );
    }
  }

  /** PUTs [body] to the presigned [url] with the type it was signed for; its length is the body's. */
  private async put(
    url: string,
    body: Blob,
    contentType: string,
    progress?: (fraction: number) => void,
  ): Promise<void> {
    await lastValueFrom(
      this.http
        .put(url, body, {
          headers: { 'Content-Type': contentType },
          observe: 'events',
          reportProgress: progress !== undefined,
        })
        .pipe(
          tap((event) => {
            if (event.type === HttpEventType.UploadProgress && event.total) {
              progress?.(event.loaded / event.total);
            }
          }),
          filter((event) => event.type === HttpEventType.Response),
        ),
    );
  }
}
