import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, effect, inject } from '@angular/core';
import { ConversationStore } from '../../core/data/conversation.store';
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogFrame } from '../../shared/ui/dialog-frame';
import { ChannelMembers } from './channel-members';

export interface ChannelMembersData {
  channelId: number;
}

/**
 * "Mitglieder" (frame 43.) as a popover below the Member stack in the Channel header, on desktop. Closes when
 * the User loses the Channel.
 */
@Component({
  selector: 'app-channel-members-dialog',
  imports: [ChannelMembers, DialogFrame, TranslocoPipe],
  template: `
    <app-dialog-frame
      class="block w-[min(30rem,calc(100vw-2rem))] [&>section]:rounded-tr-none"
      [heading]="'channelMembers.title' | transloco"
    >
      <app-channel-members class="max-h-[60vh] overflow-y-auto" [channelId]="data.channelId" />
    </app-dialog-frame>
  `,
})
export class ChannelMembersDialog {
  protected readonly data = inject<ChannelMembersData>(DIALOG_DATA);

  constructor() {
    const conversations = inject(ConversationStore);
    const dialogRef = inject(DialogRef);
    effect(() => {
      if (conversations.get(this.data.channelId) === undefined) {
        dialogRef.close();
      }
    });
  }
}
