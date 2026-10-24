import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterOutlet } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { expectNoA11yViolations } from '../../../testing/a11y';
import { ada, channel, defaultChannel, directMessage, renderApp } from '../../../testing/app';
import { FakeKeycloak, provideFakeKeycloak } from '../../../testing/fake-keycloak';
import { routes } from '../../app.routes';
import { provideApi } from '../../core/api/api.providers';

const conversations = [defaultChannel, directMessage(2, ada.id), channel(3, 'Entwicklerteam')];

function frame(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Workspace-Menü' }).closest('[data-pane]')!;
}

describe('Shell', () => {
  it('loads the logged-in User and the sidebar with their token', async () => {
    const { http } = await renderApp({ keycloak: new FakeKeycloak({ token: 'ada-token' }) });

    expect(screen.getByRole('button', { name: 'Ada Lovelace' }).textContent).toContain(
      'Ada Lovelace',
    );
    expect(screen.getByRole('navigation', { name: 'Workspace-Menü' })).toBeTruthy();
    await expectNoA11yViolations();
    http.verify();
  });

  it('sends a visitor who is not logged in to the Keycloak login, back to where they were going', async () => {
    const keycloak = new FakeKeycloak({ authenticated: false });
    const { navigate } = await render('<router-outlet />', {
      imports: [RouterOutlet],
      routes,
      providers: [provideApi(), provideHttpClientTesting(), provideFakeKeycloak(keycloak)],
    });

    expect(await navigate('/channel/1')).toBe(false);

    expect(keycloak.login).toHaveBeenCalledWith({
      redirectUri: `${window.location.origin}/channel/1`,
    });
  });

  it('shows the menu pane at / with the empty state "Wähle einen Channel oder eine Direktnachricht"', async () => {
    await renderApp({ conversations });

    expect(frame().dataset['pane']).toBe('menu');
    expect(
      within(screen.getByRole('main')).getByRole('heading', {
        name: 'Wähle einen Channel oder eine Direktnachricht',
      }),
    ).toBeTruthy();
    await expectNoA11yViolations();
  });

  it('shows the main pane for an open Channel, with its row marked as the current page', async () => {
    await renderApp({ conversations, url: '/channel/3' });

    expect(frame().dataset['pane']).toBe('main');
    expect(
      within(screen.getByRole('main')).getByRole('heading', { name: 'Entwicklerteam' }),
    ).toBeTruthy();
    const row = screen.getByRole('link', { name: 'Entwicklerteam' });
    expect(row.getAttribute('aria-current')).toBe('page');
    await expectNoA11yViolations();
  });

  it('shows the main pane for a DM, the self-DM named "(Du)"', async () => {
    await renderApp({ conversations, url: `/dm/${ada.id}` });

    expect(frame().dataset['pane']).toBe('main');
    expect(
      within(screen.getByRole('main')).getByRole('heading', { name: 'Ada Lovelace (Du)' }),
    ).toBeTruthy();
    await expectNoA11yViolations();
  });

  it('shows the Thread pane beside its Conversation, closed back to the Conversation', async () => {
    const { fixture } = await renderApp({ conversations, url: '/channel/3/thread/42' });

    expect(frame().dataset['pane']).toBe('thread');
    const thread = screen.getByRole('complementary', { name: 'Thread' });
    expect(screen.getByRole('main')).toBeTruthy();
    await expectNoA11yViolations();

    await userEvent.click(within(thread).getByRole('link', { name: 'Thread schließen' }));
    await fixture.whenStable();

    expect(frame().dataset['pane']).toBe('main');
    expect(screen.queryByRole('complementary', { name: 'Thread' })).toBeNull();
  });

  it('closes and reopens the Workspace menu with the "Workspace-Menü" toggle', async () => {
    await renderApp({ conversations });
    const toggle = screen.getByRole('button', { name: 'Workspace-Menü schließen' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-controls')).toBe('workspace-menu');

    await userEvent.click(toggle);

    expect(frame().dataset['menu']).toBe('closed');
    const reopen = screen.getByRole('button', { name: 'Workspace-Menü öffnen' });
    expect(reopen.getAttribute('aria-expanded')).toBe('false');
    await expectNoA11yViolations();

    await userEvent.keyboard('{Enter}');

    expect(frame().dataset['menu']).toBe('open');
  });

  it("says so in a toast when the sidebar can't be loaded", async () => {
    await renderApp({ conversations: null });

    expect(
      await screen.findByText('Etwas ist schiefgelaufen. Bitte lade die Seite neu.'),
    ).toBeTruthy();
  });
});
