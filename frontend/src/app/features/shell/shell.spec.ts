import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterOutlet } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import { expectNoA11yViolations } from '../../../testing/a11y';
import { FakeKeycloak, provideFakeKeycloak } from '../../../testing/fake-keycloak';
import { provideApi } from '../../core/api/api.providers';
import { routes } from '../../app.routes';
import { UserDto } from '../../core/data/user.store';

const ada: UserDto = {
  id: '7d1e0c2a-0000-4000-8000-000000000001',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  avatar: null,
};

async function renderApp(keycloak: FakeKeycloak) {
  const result = await render('<router-outlet />', {
    imports: [RouterOutlet],
    routes,
    providers: [provideApi(), provideHttpClientTesting(), provideFakeKeycloak(keycloak)],
  });
  return { ...result, http: TestBed.inject(HttpTestingController) };
}

describe('Shell', () => {
  it("shows the logged-in User's name, loaded from /api/me with their token", async () => {
    const { navigate, http } = await renderApp(new FakeKeycloak({ token: 'ada-token' }));

    const navigation = navigate('/');
    const request = await vi.waitFor(() => http.expectOne('/api/me'));
    expect(request.request.headers.get('Authorization')).toBe('Bearer ada-token');
    request.flush(ada);
    await navigation;

    expect(await within(screen.getByRole('main')).findByText('Ada Lovelace')).toBeTruthy();
    await expectNoA11yViolations();
    http.verify();
  });

  it('sends a visitor who is not logged in to the Keycloak login, back to where they were going', async () => {
    const keycloak = new FakeKeycloak({ authenticated: false });
    const { navigate, http } = await renderApp(keycloak);

    expect(await navigate('/')).toBe(false);

    expect(keycloak.login).toHaveBeenCalledWith({ redirectUri: `${window.location.origin}/` });
    expect(screen.queryByRole('main')).toBeNull();
    http.verify();
  });
});
