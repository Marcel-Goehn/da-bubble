import { inject, Pipe, PipeTransform } from '@angular/core';
import { TranslocoLocaleService } from '@jsverse/transloco-locale';

const kilobyte = 1024;
const megabyte = kilobyte * 1024;

/** A size in bytes as people read it, in the active locale: "1,2 MB", "340 KB" or "12 Byte". */
@Pipe({ name: 'fileSize', pure: false })
export class FileSizePipe implements PipeTransform {
  private readonly locale = inject(TranslocoLocaleService);

  transform(bytes: number): string {
    const [value, unit] =
      bytes >= megabyte
        ? [bytes / megabyte, 'megabyte']
        : bytes >= kilobyte
          ? [bytes / kilobyte, 'kilobyte']
          : [bytes, 'byte'];
    return new Intl.NumberFormat(this.locale.getLocale(), {
      style: 'unit',
      unit,
      unitDisplay: 'short',
      maximumFractionDigits: 1,
    }).format(value);
  }
}
