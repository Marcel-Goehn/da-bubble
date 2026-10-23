import { CdkDialogContainer, DialogRef } from '@angular/cdk/dialog';
import { Component, DestroyRef, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from './icon';

let nextId = 0;

/**
 * The Figma dialog card for content opened with the CDK `Dialog`: a heading that names the dialog, a ✕
 * that closes it, and the projected content below. Escape and the backdrop close it too (CDK defaults).
 */
@Component({
  selector: 'app-dialog-frame',
  imports: [Icon, TranslocoPipe],
  template: `
    <section class="flex flex-col gap-20 rounded-30 bg-surface p-40 shadow-overlay">
      <header class="flex items-center justify-between gap-20">
        <h2 [id]="headingId" class="text-24 font-bold">{{ heading() }}</h2>
        <button
          type="button"
          class="rounded-20 p-8 hover:bg-hover"
          [attr.aria-label]="'dialog.close' | transloco"
          (click)="dialogRef.close()"
        >
          <app-icon name="close" />
        </button>
      </header>
      <ng-content />
    </section>
  `,
})
export class DialogFrame {
  /** Translated by the caller. */
  readonly heading = input.required<string>();

  protected readonly dialogRef = inject(DialogRef);
  protected readonly headingId = `app-dialog-heading-${nextId++}`;

  constructor() {
    // The CDK container has role="dialog"; naming it by the heading is how Angular Material does it too.
    const container = this.dialogRef.containerInstance;
    if (container instanceof CdkDialogContainer) {
      container._addAriaLabelledBy(this.headingId);
      inject(DestroyRef).onDestroy(() => container._removeAriaLabelledBy(this.headingId));
    }
  }
}
