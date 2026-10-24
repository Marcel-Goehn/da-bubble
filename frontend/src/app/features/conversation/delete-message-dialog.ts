import { DialogRef } from '@angular/cdk/dialog';
import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Button } from '../../shared/ui/button';
import { DialogFrame } from '../../shared/ui/dialog-frame';

/** Asks before a Message is deleted for everyone; closes with `true` only when "Löschen" is chosen. */
@Component({
  selector: 'app-delete-message-dialog',
  imports: [Button, DialogFrame, TranslocoPipe],
  template: `
    <app-dialog-frame class="block max-w-500" [heading]="'deleteMessage.title' | transloco">
      <p>{{ 'deleteMessage.text' | transloco }}</p>
      <div class="flex justify-end gap-20">
        <button appButton="secondary" type="button" (click)="dialogRef.close(false)">
          {{ 'deleteMessage.cancel' | transloco }}
        </button>
        <button appButton type="button" (click)="dialogRef.close(true)">
          {{ 'deleteMessage.confirm' | transloco }}
        </button>
      </div>
    </app-dialog-frame>
  `,
})
export class DeleteMessageDialog {
  protected readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
}
