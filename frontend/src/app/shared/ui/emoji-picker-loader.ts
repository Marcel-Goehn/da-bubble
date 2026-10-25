import { inject, Service } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Language } from '../../core/i18n/i18n.providers';

/** A picker ready to be placed: it fires `emoji-click` with `detail.unicode`, skin tone included. */
export interface LoadedEmojiPicker {
  element: HTMLElement;
  /** Moves focus into it, to its search field. */
  focus(): void;
}

/**
 * Loads `emoji-picker-element` on first use, in the active language, with the emoji data the app serves
 * itself (`/emoji/<lang>/data.json`, copied from `emoji-picker-element-data` at build time). The emoji are
 * the OS's native ones.
 */
@Service()
export class EmojiPickerLoader {
  private readonly transloco = inject(TranslocoService);

  async create(): Promise<LoadedEmojiPicker> {
    const lang = this.transloco.getActiveLang() as Language;
    const [{ default: Picker }, { default: i18n }] = await Promise.all([
      import('emoji-picker-element/picker.js'),
      lang === 'de'
        ? import('emoji-picker-element/i18n/de.js')
        : import('emoji-picker-element/i18n/en.js'),
    ]);
    const element = new Picker({ dataSource: `/emoji/${lang}/data.json`, locale: lang, i18n });
    return {
      element,
      focus: () => element.shadowRoot?.querySelector<HTMLElement>('input')?.focus(),
    };
  }
}
