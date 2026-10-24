import { screen, within } from '@testing-library/angular';
import { expectNoA11yViolations } from '../../../testing/a11y';
import { ada, channel, defaultChannel, directMessage, renderApp } from '../../../testing/app';

const conversations = [
  channel(3, 'Zeta'),
  directMessage(2, ada.id),
  channel(4, 'entwicklerteam'),
  defaultChannel,
  channel(5, 'Büro'),
];

function linkNames(listName: string): string[] {
  const list = screen.getByRole('list', { name: listName });
  return within(list)
    .getAllByRole('link')
    .map((link) => link.textContent.trim());
}

describe('Sidebar', () => {
  it('pins the Default Channel first as "Allgemein", then sorts Channels alphabetically', async () => {
    await renderApp({ conversations });

    expect(linkNames('Channels')).toEqual(['Allgemein', 'Büro', 'entwicklerteam', 'Zeta']);
    await expectNoA11yViolations();
  });

  it('calls the Default Channel "General" in English', async () => {
    await renderApp({ conversations, lang: 'en' });

    expect(linkNames('Channels')[0]).toBe('General');
    await expectNoA11yViolations();
  });

  it('lists the self-DM marked "(Du)" on top of the Direct Messages', async () => {
    await renderApp({ conversations });

    expect(linkNames('Direktnachrichten')).toEqual(['Ada Lovelace (Du)']);
    await expectNoA11yViolations();
  });

  it('links each row to its Conversation', async () => {
    await renderApp({ conversations });
    const channels = within(screen.getByRole('list', { name: 'Channels' }));
    const dms = within(screen.getByRole('list', { name: 'Direktnachrichten' }));

    expect(channels.getByRole('link', { name: 'Büro' }).getAttribute('href')).toBe('/channel/5');
    expect(dms.getByRole('link', { name: /Ada Lovelace \(Du\)$/ }).getAttribute('href')).toBe(
      `/dm/${ada.id}`,
    );
    await expectNoA11yViolations();
  });
});
