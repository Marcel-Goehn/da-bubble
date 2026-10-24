import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  EnvironmentProviders,
  inject,
  Injectable,
  isDevMode,
  provideAppInitializer,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Translation,
  TranslocoLoader,
  TranslocoService,
  provideTransloco,
} from '@jsverse/transloco';
import { provideTranslocoLocale } from '@jsverse/transloco-locale';
import { provideTranslocoMessageformat } from '@jsverse/transloco-messageformat';
import { firstValueFrom } from 'rxjs';

export const languages = ['de', 'en'] as const;
export type Language = (typeof languages)[number];

/** The locale each language formats dates and numbers in. */
export const locales: Record<Language, string> = { de: 'de-DE', en: 'en-US' };

/** German for any `de*` browser language, English for everything else. */
export function browserLanguage(preferred: readonly string[]): Language {
  return preferred[0]?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

/** Bundles each language's JSON as its own lazy chunk; no HTTP request, no deployed asset path. */
@Injectable()
class BundledLoader implements TranslocoLoader {
  getTranslation(lang: Language): Promise<Translation> {
    const translation =
      lang === 'de' ? import('../../../i18n/de.json') : import('../../../i18n/en.json');
    return translation.then((module) => module.default);
  }
}

/**
 * Transloco with messageformat (plurals) and locale (dates, numbers). Before login the language follows
 * the browser; `<html lang>` always follows the active language.
 */
export function provideI18n(): EnvironmentProviders[] {
  return [
    ...provideTransloco({
      config: {
        availableLangs: [...languages],
        defaultLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
      },
      loader: BundledLoader,
    }),
    provideTranslocoMessageformat(),
    ...provideTranslocoLocale({ langToLocaleMapping: locales }),
    provideAppInitializer(() => {
      const transloco = inject(TranslocoService);
      const document = inject(DOCUMENT);
      transloco.langChanges$
        .pipe(takeUntilDestroyed(inject(DestroyRef)))
        .subscribe((lang) => (document.documentElement.lang = lang));
      const lang = browserLanguage(document.defaultView?.navigator.languages ?? []);
      transloco.setActiveLang(lang);
      // Waits for the first language so the app never renders raw keys.
      return firstValueFrom(transloco.load(lang)).then(() => undefined);
    }),
  ];
}
