import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { avatarUrl } from '../../core/data/avatars';
import { ConversationStore } from '../../core/data/conversation.store';
import { UserStore } from '../../core/data/user.store';
import { Avatar } from '../../shared/ui/avatar';
import { ChannelNamePipe } from '../../shared/ui/channel-name.pipe';
import { Icon } from '../../shared/ui/icon';

/**
 * The open Conversation: a Channel (`/channel/:id`, which its guard has loaded) or the DM with a User
 * (`/dm/:userId`). The Thread pane is routed beside it. TODO(#53): the Messages and the composer.
 */
@Component({
  selector: 'app-conversation-pane',
  imports: [Avatar, ChannelNamePipe, Icon, RouterOutlet, TranslocoPipe],
  host: { class: 'contents' },
  template: `
    <main
      class="flex min-w-0 flex-1 flex-col bg-surface max-lg:hidden max-lg:group-data-[pane=main]:flex lg:rounded-30"
    >
      <header class="px-16 py-20 shadow-header lg:px-45 lg:py-32">
        <h1 class="flex items-center gap-10 text-20 font-bold lg:text-24">
          @if (channel(); as channel) {
            <app-icon name="tag" />
            {{ channel | channelName }}
          } @else if (partner(); as partner) {
            <app-avatar [src]="avatarUrl(partner.avatar)" [name]="partner.name" decorative />
            @if (partner.id === me()?.id) {
              {{ 'sidebar.selfDm' | transloco: { name: partner.name } }}
            } @else {
              {{ partner.name }}
            }
          } @else {
            {{ 'conversation.directMessage' | transloco }}
          }
        </h1>
      </header>
      <div class="flex-1"></div>
    </main>
    <router-outlet />
  `,
})
export class ConversationPane {
  private readonly conversations = inject(ConversationStore);
  private readonly users = inject(UserStore);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap, { requireSync: true });

  protected readonly avatarUrl = avatarUrl;
  protected readonly me = this.users.me;
  protected readonly channel = computed(() => {
    const id = this.params().get('id');
    return id === null ? undefined : this.conversations.get(Number(id));
  });
  protected readonly partner = computed(() => {
    const userId = this.params().get('userId');
    return userId === null ? undefined : this.users.user(userId);
  });
}
