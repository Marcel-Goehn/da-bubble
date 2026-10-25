import { DIALOG_DATA } from '@angular/cdk/dialog';
import { Component, computed, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ConversationStore } from '../../core/data/conversation.store';
import { UserStore } from '../../core/data/user.store';
import { ChannelNamePipe } from '../../shared/ui/channel-name.pipe';
import { DialogFrame } from '../../shared/ui/dialog-frame';
import { Icon } from '../../shared/ui/icon';
import { ProfileCards } from '../profile/profile-cards';

export interface ChannelDetailsData {
  channelId: number;
}

const cardClasses = 'flex flex-col gap-20 rounded-20 border border-border p-20';

/**
 * A Channel's details ("Channel Edition"): its name, description and the Creator, whose profile card opens
 * from their name. TODO(#61): editing, leaving and the Default Channel's "Standard-Channel".
 */
@Component({
  selector: 'app-channel-details-dialog',
  imports: [ChannelNamePipe, DialogFrame, Icon, TranslocoPipe],
  template: `
    <!-- The frame is always there: it names the dialog as it opens. -->
    <app-dialog-frame
      class="block w-[min(54rem,calc(100vw-2rem))]"
      [heading]="channel() ? (channel()! | channelName) : ''"
    >
      @if (channel(); as channel) {
        <section [class]="cardClasses">
          <h3 class="font-bold">{{ 'channelDetails.name' | transloco }}</h3>
          <p class="flex items-center gap-10">
            <app-icon name="tag" />
            {{ channel | channelName }}
          </p>
        </section>
        <section [class]="cardClasses">
          <h3 class="font-bold">{{ 'channelDetails.description' | transloco }}</h3>
          <p class="break-words" [class.text-text-muted]="!channel.description">
            {{ channel.description || ('channelDetails.noDescription' | transloco) }}
          </p>
          @if (creator(); as creator) {
            <hr class="border-border" />
            <h3 class="font-bold">{{ 'channelDetails.createdBy' | transloco }}</h3>
            <button
              type="button"
              class="self-start text-24 text-interactive hover:text-interactive-hover hover:underline"
              (click)="profiles.open(creator.id)"
            >
              {{ creator.name }}
            </button>
          }
        </section>
      }
    </app-dialog-frame>
  `,
})
export class ChannelDetailsDialog {
  private readonly data = inject<ChannelDetailsData>(DIALOG_DATA);
  private readonly conversations = inject(ConversationStore);
  private readonly users = inject(UserStore);

  protected readonly profiles = inject(ProfileCards);
  protected readonly cardClasses = cardClasses;
  protected readonly channel = computed(() => this.conversations.get(this.data.channelId));
  protected readonly creator = computed(() => {
    const creatorId = this.channel()?.creatorId;
    return creatorId ? this.users.user(creatorId) : undefined;
  });
}
