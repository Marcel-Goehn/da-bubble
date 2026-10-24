import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { screen, waitFor, within } from '@testing-library/angular';
import { expectNoA11yViolations } from '../../../testing/a11y';
import { channel, defaultChannel, renderApp, startApp } from '../../../testing/app';

const notFound = {
  type: 'about:blank',
  title: 'Not Found',
  status: 404,
  detail: null,
  instance: '/api/conversations/9',
  code: 'NOT_FOUND',
  errors: [],
};

const unavailable =
  'Diesen Channel oder diese Direktnachricht gibt es nicht, oder du hast keinen Zugriff darauf.';

function location(): string {
  return TestBed.inject(Router).url;
}

/** The toast on screen, found by its dismiss button. */
function toast(): string | undefined {
  return screen.queryByRole('button', { name: 'Hinweis schließen' })?.parentElement?.textContent;
}

/** What the CDK LiveAnnouncer last told screen readers. */
function announced(): string | undefined {
  return document.querySelector('.cdk-live-announcer-element')?.textContent ?? undefined;
}

describe('Opening a Conversation', () => {
  it('asks for a Channel missing from the sidebar and opens it when it is visible', async () => {
    const { http, navigation, fixture } = await startApp({ url: '/channel/9' });

    (await vi.waitFor(() => http.expectOne('/api/conversations/9'))).flush(channel(9, 'Neu hier'));
    await navigation;
    await fixture.whenStable();

    expect(
      within(screen.getByRole('main')).getByRole('heading', { name: 'Neu hier' }),
    ).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Channels' }).textContent).toContain('Neu hier');
    await expectNoA11yViolations();
  });

  it("sends the User to / with a toast when they can't see the Conversation", async () => {
    const { http, fixture } = await startApp({ url: '/channel/9' });

    (await vi.waitFor(() => http.expectOne('/api/conversations/9'))).flush(notFound, {
      status: 404,
      statusText: 'Not Found',
    });
    await fixture.whenStable();

    await waitFor(() => expect(location()).toBe('/'));
    await waitFor(() => expect(toast()).toContain(unavailable));
    await waitFor(() => expect(announced()).toBe(unavailable));
    expect(
      screen.getByRole('heading', { name: 'Wähle einen Channel oder eine Direktnachricht' }),
    ).toBeTruthy();
    await expectNoA11yViolations();
  });

  it('sends the User to / with a toast for an id that is no Channel, without asking', async () => {
    const { http } = await renderApp({ url: '/channel/abc', conversations: [defaultChannel] });

    expect(location()).toBe('/');
    expect(toast()).toContain(unavailable);
    await expectNoA11yViolations();
    http.verify();
  });
});
