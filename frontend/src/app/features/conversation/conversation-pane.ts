import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { avatarUrl } from '../../core/data/avatars';
import { ConversationStore } from '../../core/data/conversation.store';
import { DraftKey, DraftService } from '../../core/data/draft.service';
import { MessageStore } from '../../core/data/message.store';
import { UserStore } from '../../core/data/user.store';
import { ErrorService } from '../../core/errors/error.service';
import { Avatar } from '../../shared/ui/avatar';
import { ChannelNamePipe } from '../../shared/ui/channel-name.pipe';
import { Composer } from '../../shared/ui/composer';
import { Icon } from '../../shared/ui/icon';
import { MessageList } from './message-list';

/**
 * The open Conversation: a Channel (`/channel/:id`, which its guard has loaded) or the DM with a User
 * (`/dm/:userId`), with its Messages and the composer. The Thread pane is routed beside it.
 * TODO(#56): the Messages of a DM.
 */
@Component({
  selector: 'app-conversation-pane',
  imports: [Avatar, ChannelNamePipe, Composer, Icon, MessageList, RouterOutlet, TranslocoPipe],
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
      @if (channel(); as channel) {
        <app-message-list class="min-h-0 flex-1" />
        <app-composer
          class="px-16 pb-16 lg:px-45 lg:pb-40"
          [label]="'composer.placeholder' | transloco: { channel: channel | channelName }"
          [text]="drafts.get(draftKey(channel.id))"
          (textChange)="drafts.set(draftKey(channel.id), $event)"
          [busy]="sendingTo() === channel.id"
          (send)="send(channel.id, $event)"
        />
      } @else {
        <div class="flex-1"></div>
      }
    </main>
    <router-outlet />
  `,
})
export class ConversationPane {
  private readonly conversations = inject(ConversationStore);
  private readonly users = inject(UserStore);
  private readonly messages = inject(MessageStore);
  private readonly errors = inject(ErrorService);
  private readonly transloco = inject(TranslocoService);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap, { requireSync: true });

  protected readonly drafts = inject(DraftService);
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

  /** The Conversation a send is in flight for, if any. */
  protected readonly sendingTo = signal<number | null>(null);

  constructor() {
    // On the id, not the Channel, so a renamed or re-fetched Channel doesn't reload its Messages.
    const channelId = computed(() => this.channel()?.id);
    effect(() => {
      const id = channelId();
      if (id !== undefined) {
        untracked(() => this.messages.open(id)).catch(() =>
          this.errors.show(this.transloco.translate('errors.generic')),
        );
      }
    });
  }

  protected draftKey(conversationId: number): DraftKey {
    return `conversation:${conversationId}`;
  }

  /** Sends the composer's text; only a sent Message clears the draft, so a failed one can be retried. */
  protected async send(conversationId: number, text: string): Promise<void> {
    this.sendingTo.set(conversationId);
    try {
      await this.messages.send(conversationId, text);
      this.drafts.set(this.draftKey(conversationId), '');
    } catch {
      this.errors.show(this.transloco.translate('errors.sendFailed'));
    } finally {
      this.sendingTo.set(null);
    }
  }
}
