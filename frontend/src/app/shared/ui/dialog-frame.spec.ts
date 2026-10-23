import { Dialog } from '@angular/cdk/dialog';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { fireEvent, render, screen, waitFor } from '@testing-library/angular';
import { userEvent } from '@testing-library/user-event';
import { expectNoA11yViolations } from '../../../testing/a11y';
import { provideI18nTesting } from '../../../testing/i18n';
import { DialogFrame } from './dialog-frame';

@Component({
  imports: [DialogFrame],
  template: `
    <app-dialog-frame heading="Channel erstellen">
      <p>Channels dienen deinem Team zur Kommunikation.</p>
    </app-dialog-frame>
  `,
})
class CreateChannelDialog {}

async function openDialog() {
  await render('', { providers: [provideI18nTesting()] });
  TestBed.inject(Dialog).open(CreateChannelDialog);
  return screen.findByRole('dialog', { name: 'Channel erstellen' });
}

describe('DialogFrame', () => {
  afterEach(() => TestBed.inject(Dialog).closeAll());

  it('shows its content in a dialog named by its heading', async () => {
    const dialog = await openDialog();

    expect(dialog.textContent).toContain('Channels dienen deinem Team zur Kommunikation.');
    await expectNoA11yViolations();
  });

  it('closes with the ✕ button', async () => {
    await openDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closes with Escape', async () => {
    const dialog = await openDialog();

    // user-event leaves keyCode at 0, but the CDK reads keyCode (browsers set 27).
    fireEvent.keyDown(dialog, { key: 'Escape', keyCode: 27 });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
