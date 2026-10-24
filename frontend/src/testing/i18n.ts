import { EnvironmentProviders, importProvidersFrom } from '@angular/core';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { provideTranslocoLocale } from '@jsverse/transloco-locale';
import { provideTranslocoMessageformat } from '@jsverse/transloco-messageformat';
import de from '../i18n/de.json';
import en from '../i18n/en.json';
import { Language, languages, locales } from '../app/core/i18n/i18n.providers';

/**
 * The real German and English translations, loaded synchronously, so component tests can find elements
 * by the copy a User reads. German by default, like the Figma.
 */
export function provideI18nTesting(lang: Language = 'de'): EnvironmentProviders[] {
  return [
    importProvidersFrom(
      TranslocoTestingModule.forRoot({
        langs: { de, en },
        translocoConfig: { availableLangs: [...languages], defaultLang: lang },
        preloadLangs: true,
      }),
    ),
    provideTranslocoMessageformat(),
    ...provideTranslocoLocale({ langToLocaleMapping: locales }),
  ];
}
