import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ConversationStore } from '../../core/data/conversation.store';
import { ErrorService } from '../../core/errors/error.service';
import { Button } from '../../shared/ui/button';
import { ChannelNamePipe } from '../../shared/ui/channel-name.pipe';
import { DialogFrame } from '../../shared/ui/dialog-frame';
import { Icon } from '../../shared/ui/icon';
import { PeoplePicker } from './people-picker';

interface AddMembersData {
  channelId: number;
}

/** Opens "Leute hinzufügen" for the Channel [channelId]; for its Admins. */
export function openAddMembers(dialog: Dialog, channelId: number): void {
  dialog.open<void, AddMembersData>(AddMembersDialog, { data: { channelId } });
}

/**
 * "Leute hinzufügen" (frames 41. and 41b.): an Admin picks Users by name and adds them to the Channel. Closes
 * when the User loses the Channel.
 */
@Component({
  selector: 'app-add-members-dialog',
  imports: [Button, ChannelNamePipe, DialogFrame, Icon, PeoplePicker, TranslocoPipe],
  template: `
    <app-dialog-frame
      class="block w-[min(32rem,calc(100vw-2rem))]"
      [heading]="'addMembers.title' | transloco"
    >
      @if (channel(); as channel) {
        <p class="-mt-10 flex items-center gap-10 text-link-soft">
          <app-icon name="tag" />
          {{ channel | channelName }}
        </p>
        <form class="flex flex-col gap-20" novalidate (submit)="add($event)">
          <app-people-picker [(picked)]="picked" [excluded]="memberIds()" />
          <button
            appButton
            type="submit"
            class="self-end"
            [disabled]="picked().length === 0 || adding()"
          >
            {{ 'addMembers.add' | transloco }}
          </button>
        </form>
      }
    </app-dialog-frame>
  `,
})
export class AddMembersDialog {
  private readonly data = inject<AddMembersData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef);
  private readonly conversations = inject(ConversationStore);
  private readonly errors = inject(ErrorService);
  private readonly transloco = inject(TranslocoService);

  protected readonly picked = signal<string[]>([]);
  protected readonly adding = signal(false);
  protected readonly channel = computed(() => this.conversations.get(this.data.channelId));
  protected readonly memberIds = computed(
    () => this.channel()?.members.map((member) => member.userId) ?? [],
  );

  constructor() {
    effect(() => {
      if (this.channel() === undefined) {
        this.dialogRef.close();
      }
    });
  }

  protected async add(event: Event): Promise<void> {
    event.preventDefault();
    this.adding.set(true);
    try {
      await this.conversations.addMembers(this.data.channelId, this.picked());
      this.dialogRef.close();
    } catch {
      this.errors.show(this.transloco.translate('errors.manageMembersFailed'));
    } finally {
      this.adding.set(false);
    }
  }
}
