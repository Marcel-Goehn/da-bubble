import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { expectNoA11yViolations } from '../../../testing/a11y';
import { FakeKeycloak, provideFakeKeycloak } from '../../../testing/fake-keycloak';
import { provideI18nTesting } from '../../../testing/i18n';
import { App } from '../../app';
import { routes } from '../../app.routes';
import { provideApi } from '../../core/api/api.providers';
import { Language } from '../../core/i18n/i18n.providers';

/** Opens [url] as a visitor who isn't logged in. */
async function visit(url: string, lang: Language = 'de') {
  const keycloak = new FakeKeycloak({ authenticated: false });
  const { navigate } = await render(App, {
    routes,
    providers: [
      provideApi(),
      provideHttpClientTesting(),
      provideFakeKeycloak(keycloak),
      provideI18nTesting(lang),
    ],
  });
  expect(await navigate(url)).toBe(true);
  return { keycloak, http: TestBed.inject(HttpTestingController) };
}

describe('Legal pages', () => {
  it('shows the Impressum without logging in', async () => {
    const { keycloak, http } = await visit('/impressum');

    expect(screen.getByRole('heading', { level: 1, name: 'Impressum' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Kontakt' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Zurück zu DABubble' }).getAttribute('href')).toBe('/');
    expect(keycloak.login).not.toHaveBeenCalled();
    await expectNoA11yViolations();
    http.verify();
  });

  it('shows the Datenschutz page without logging in', async () => {
    const { keycloak, http } = await visit('/datenschutz');

    expect(screen.getByRole('heading', { level: 1, name: 'Datenschutz' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Welche Daten wir speichern' })).toBeTruthy();
    expect(keycloak.login).not.toHaveBeenCalled();
    await expectNoA11yViolations();
    http.verify();
  });

  it('is in English too', async () => {
    await visit('/datenschutz', 'en');

    expect(screen.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeTruthy();
    await expectNoA11yViolations();
  });
});
