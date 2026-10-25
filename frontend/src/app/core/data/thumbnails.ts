import { Service } from '@angular/core';

/** The longest side of a thumbnail, in px. */
const thumbnailPx = 320;

/** Images a thumbnail is made of, which are also the ones Messages show as thumbnails. */
export const thumbnailedTypes: readonly string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

/** Makes thumbnails in the browser, so the backend never decodes an image. */
@Service()
export class Thumbnails {
  /**
   * A WebP of [image] at most 320 px on its longest side, or `null` for a file that isn't an image or a
   * browser that can't decode or encode it. Then the image shows itself instead.
   */
  async make(image: File): Promise<Blob | null> {
    if (!thumbnailedTypes.includes(image.type)) {
      return null;
    }
    try {
      const bitmap = await createImageBitmap(image);
      const scale = Math.min(1, thumbnailPx / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/webp', 0.8),
      );
      // A browser that can't encode WebP falls back to PNG, which the signed upload wouldn't take.
      return blob?.type === 'image/webp' ? blob : null;
    } catch {
      return null;
    }
  }
}
