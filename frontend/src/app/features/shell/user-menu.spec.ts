import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { screen, waitFor, within } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { expectNoA11yViolations } from '../../../testing/a11y';
import { renderApp } from '../../../testing/app';

function trigger(): HTMLElement {
  return screen.getByRole('button', { name: 'Ada Lovelace' });
}

async function openMenu(): Promise<HTMLElement> {
  await userEvent.click(trigger());
  return screen.findByRole('menu', { name: 'Benutzermenü' });
}

describe('User menu', () => {
  it('offers Profil, Log out and the "Impressum · Datenschutz" footer', async () => {
    await renderApp();
    expect(screen.queryByRole('menu')).toBeNull();

    const menu = await openMenu();

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent.trim()),
    ).toEqual(['Profil', 'Log out', 'Impressum', 'Datenschutz']);
    expect(within(menu).getByRole('group', { name: 'Rechtliches' }).textContent).toContain('·');
    await expectNoA11yViolations();
  });

  it('logs the User out', async () => {
    const { keycloak } = await renderApp();
    const menu = await openMenu();

    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Log out' }));

    expect(keycloak.logout).toHaveBeenCalledWith({ redirectUri: `${window.location.origin}/` });
    await expectNoA11yViolations();
  });

  it('opens the Impressum', async () => {
    await renderApp();
    const menu = await openMenu();

    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Impressum' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Impressum' })).toBeTruthy();
    expect(TestBed.inject(Router).url).toBe('/impressum');
    await expectNoA11yViolations();
  });

  it('works by keyboard: Enter opens, arrows move, Escape closes back onto the trigger', async () => {
    const { keycloak } = await renderApp();
    trigger().focus();

    await userEvent.keyboard('{Enter}');
    const menu = await screen.findByRole('menu', { name: 'Benutzermenü' });
    await waitFor(() =>
      expect(within(menu).getByRole('menuitem', { name: 'Profil' })).toBe(document.activeElement),
    );
    await userEvent.keyboard('{ArrowDown}');
    expect(within(menu).getByRole('menuitem', { name: 'Log out' })).toBe(document.activeElement);

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(trigger()).toBe(document.activeElement);
    expect(keycloak.logout).not.toHaveBeenCalled();
    await expectNoA11yViolations();

    trigger().focus();
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('menu', { name: 'Benutzermenü' });
    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(keycloak.logout).toHaveBeenCalled();
  });
});
