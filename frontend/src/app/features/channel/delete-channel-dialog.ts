import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ConversationStore } from '../../core/data/conversation.store';
import { ErrorService } from '../../core/errors/error.service';
import { Button } from '../../shared/ui/button';
import { DialogFrame } from '../../shared/ui/dialog-frame';
import { fieldClasses } from './create-channel-dialog';

export interface DeleteChannelData {
  channelId: number;
}

/**
 * Asks the Creator before the Channel is deleted for every Member: "Löschen" is enabled only once they type its
 * name, case included. Deletes it, then closes; it stays open when that fails, and closes when the Channel is
 * gone anyway.
 */
@Component({
  selector: 'app-delete-channel-dialog',
  imports: [Button, DialogFrame, TranslocoPipe],
  template: `
    <app-dialog-frame
      class="block max-w-500"
      [heading]="'deleteChannel.title' | transloco: { name: name() }"
    >
      <form class="flex flex-col gap-20" novalidate (submit)="confirm($event)">
        <p id="delete-channel-text">
          {{ 'deleteChannel.text' | transloco: { count: memberCount() } }}
        </p>
        <label for="delete-channel-name" class="sr-only">{{
          'deleteChannel.name' | transloco
        }}</label>
        <div [class]="fieldClasses">
          <input
            id="delete-channel-name"
            class="min-w-0 flex-1 bg-transparent outline-none placeholder:text-text-muted"
            autocomplete="off"
            aria-describedby="delete-channel-text"
            [placeholder]="name()"
            [value]="typed()"
            (input)="typed.set($any($event.target).value)"
          />
        </div>
        <div class="flex justify-end gap-20">
          <button appButton="secondary" type="button" (click)="dialogRef.close()">
            {{ 'deleteChannel.cancel' | transloco }}
          </button>
          <button appButton="danger" type="submit" [disabled]="!confirmed() || deleting()">
            {{ 'deleteChannel.confirm' | transloco }}
          </button>
        </div>
      </form>
    </app-dialog-frame>
  `,
})
export class DeleteChannelDialog {
  private readonly data = inject<DeleteChannelData>(DIALOG_DATA);
  private readonly conversations = inject(ConversationStore);
  private readonly errors = inject(ErrorService);
  private readonly transloco = inject(TranslocoService);

  protected readonly dialogRef = inject(DialogRef);
  protected readonly fieldClasses = fieldClasses;
  private readonly channel = computed(() => this.conversations.get(this.data.channelId));
  protected readonly name = computed(() => this.channel()?.name ?? '');
  protected readonly memberCount = computed(() => this.channel()?.members.length ?? 0);

  protected readonly typed = signal('');
  protected readonly deleting = signal(false);
  /** The name typed, case included; spaces around it don't matter. */
  protected readonly confirmed = computed(
    () => this.channel() !== undefined && this.typed().trim() === this.name(),
  );

  constructor() {
    // Deleted from another tab.
    effect(() => {
      if (this.channel() === undefined) {
        this.dialogRef.close();
      }
    });
  }

  protected async confirm(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.confirmed() || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    try {
      // Once it's gone, the details close and the Channel's view moves to the Default Channel.
      await this.conversations.deleteChannel(this.data.channelId);
      this.dialogRef.close();
    } catch {
      this.errors.show(this.transloco.translate('errors.deleteChannelFailed'));
    } finally {
      this.deleting.set(false);
    }
  }
}
