import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { provideI18n } from './i18n.providers';

async function startWithBrowserLanguages(languages: string[]) {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
  TestBed.configureTestingModule({ providers: [provideI18n()] });
  await TestBed.inject(ApplicationInitStatus).donePromise;
  return TestBed.inject(TranslocoService);
}

describe('provideI18n', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.lang = '';
  });

  it('starts in German when the browser prefers any German', async () => {
    const transloco = await startWithBrowserLanguages(['de-AT', 'en']);

    expect(transloco.getActiveLang()).toBe('de');
    expect(transloco.translate('dialog.close')).toBe('Schließen');
    expect(document.documentElement.lang).toBe('de');
  });

  it('starts in English when the browser prefers anything else', async () => {
    const transloco = await startWithBrowserLanguages(['fr-FR', 'de']);

    expect(transloco.getActiveLang()).toBe('en');
    expect(transloco.translate('dialog.close')).toBe('Close');
    expect(document.documentElement.lang).toBe('en');
  });

  it('keeps <html lang> on the active language when it changes', async () => {
    const transloco = await startWithBrowserLanguages(['en-GB']);

    transloco.setActiveLang('de');

    await vi.waitFor(() => expect(document.documentElement.lang).toBe('de'));
  });
});
