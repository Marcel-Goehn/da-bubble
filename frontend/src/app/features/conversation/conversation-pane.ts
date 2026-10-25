import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { avatarUrl } from '../../core/data/avatars';
import { ConversationStore } from '../../core/data/conversation.store';
import { DraftKey, DraftService } from '../../core/data/draft.service';
import { MessageStore } from '../../core/data/message.store';
import { PresenceStore } from '../../core/data/presence.store';
import { UserStore } from '../../core/data/user.store';
import { ErrorService } from '../../core/errors/error.service';
import { Avatar } from '../../shared/ui/avatar';
import { ChannelNamePipe } from '../../shared/ui/channel-name.pipe';
import { ComposedMessage, Composer, PendingAttachment } from '../../shared/ui/composer';
import { Icon } from '../../shared/ui/icon';
import { ChannelDialogs } from '../channel/channel-dialogs';
import { ProfileCards } from '../profile/profile-cards';
import { DmIntro } from './dm-intro';
import { MessageList } from './message-list';

/**
 * The open Conversation: a Channel (`/channel/:id`, which its guard has loaded) or the DM with a User
 * (`/dm/:userId`), with its Messages and the composer. The Thread pane is routed beside it. A DM with no
 * Message yet doesn't exist: its view is empty, and the first Message sent from it creates it.
 */
@Component({
  selector: 'app-conversation-pane',
  imports: [
    Avatar,
    ChannelNamePipe,
    Composer,
    DmIntro,
    Icon,
    MessageList,
    RouterOutlet,
    TranslocoPipe,
  ],
  host: { class: 'contents' },
  template: `
    <main
      class="flex min-w-0 flex-1 flex-col bg-surface max-lg:hidden max-lg:group-data-[pane=main]:flex lg:rounded-30"
    >
      <header class="flex items-center gap-10 px-16 py-20 shadow-header lg:px-45 lg:py-32">
        <h1 class="flex items-center gap-10 text-20 font-bold lg:text-24">
          @if (channel(); as channel) {
            <button
              type="button"
              class="flex items-center gap-10 rounded-full py-4 pr-10 pl-15 hover:bg-hover hover:text-menu-active"
              (click)="channelDialogs.openDetails(channel.id)"
            >
              <app-icon name="tag" />
              {{ channel | channelName }}
              <app-icon name="keyboardArrowDown" />
            </button>
          } @else if (partner(); as partner) {
            <button
              type="button"
              class="flex items-center gap-10 rounded-full py-4 pr-15 pl-4 hover:bg-hover hover:text-menu-active"
              (click)="profiles.open(partner.id)"
            >
              <app-avatar
                [src]="avatarUrl(partner.avatar)"
                [name]="partner.name"
                [presence]="presence.of(partner.id)"
                decorative
              />
              @if (isSelf()) {
                {{ 'sidebar.selfDm' | transloco: { name: partner.name } }}
              } @else {
                {{ partner.name }}
              }
            </button>
          } @else {
            {{ 'conversation.directMessage' | transloco }}
          }
        </h1>
        @if (channel(); as channel) {
          <div class="ml-auto flex items-center gap-10">
            <button
              #membersButton
              type="button"
              class="flex items-center gap-5 rounded-full py-4 pr-12 pl-4 text-20 font-semibold hover:bg-hover hover:text-menu-active max-lg:hidden"
              [attr.aria-label]="
                'channelMembers.open' | transloco: { count: channel.members.length }
              "
              (click)="channelDialogs.openMembers(channel.id, membersButton)"
            >
              <span class="flex -space-x-12">
                @for (member of memberStack(); track member.id) {
                  <app-avatar
                    class="rounded-full border-2 border-surface"
                    [src]="avatarUrl(member.avatar)"
                    [name]="member.name"
                    [size]="40"
                    decorative
                  />
                }
              </span>
              {{ channel.members.length }}
            </button>
            @if (iAmChannelAdmin()) {
              <button
                type="button"
                class="flex size-40 items-center justify-center rounded-full bg-hover hover:text-menu-active"
                [attr.aria-label]="'channelMembers.add' | transloco"
                (click)="channelDialogs.openAddMembers(channel.id)"
              >
                <app-icon name="personAdd" />
              </button>
            }
          </div>
        }
      </header>
      @if (channel(); as channel) {
        <app-message-list
          class="min-h-0 flex-1"
          [window]="messages.conversation"
          [label]="'messages.label' | transloco"
          opensThreads
        />
        <app-composer
          class="px-16 pb-16 lg:px-45 lg:pb-40"
          [label]="'composer.placeholder' | transloco: { channel: channel | channelName }"
          [text]="drafts.get(conversationDraft(channel.id))"
          (textChange)="drafts.set(conversationDraft(channel.id), $event)"
          [(attachments)]="attachments"
          [busy]="sending() === conversationDraft(channel.id)"
          (send)="sendToChannel(channel.id, $event)"
        />
      } @else if (partner(); as partner) {
        @if (directMessage()) {
          <app-message-list
            class="min-h-0 flex-1"
            [window]="messages.conversation"
            [label]="'messages.label' | transloco"
            opensThreads
          >
            <app-dm-intro [partner]="partner" [self]="isSelf()" />
          </app-message-list>
        } @else {
          <app-dm-intro class="mt-auto" [partner]="partner" [self]="isSelf()" />
        }
        <app-composer
          class="px-16 pb-16 lg:px-45 lg:pb-40"
          [label]="'composer.placeholderDm' | transloco: { name: partner.name }"
          [text]="drafts.get(dmDraft(partner.id))"
          (textChange)="drafts.set(dmDraft(partner.id), $event)"
          [(attachments)]="attachments"
          [busy]="sending() === dmDraft(partner.id)"
          (send)="sendToPartner(partner.id, $event)"
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
  protected readonly messages = inject(MessageStore);
  private readonly errors = inject(ErrorService);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap, { requireSync: true });

  protected readonly drafts = inject(DraftService);
  protected readonly presence = inject(PresenceStore);
  protected readonly profiles = inject(ProfileCards);
  protected readonly channelDialogs = inject(ChannelDialogs);
  protected readonly avatarUrl = avatarUrl;
  protected readonly me = this.users.me;
  protected readonly channel = computed(() => {
    const id = this.params().get('id');
    return id === null ? undefined : this.conversations.get(Number(id));
  });
  /** The first three Members, as the stack in the header shows them. */
  protected readonly memberStack = computed(() =>
    (this.channel()?.members ?? [])
      .slice(0, 3)
      .flatMap((member) => this.users.user(member.userId) ?? []),
  );
  protected readonly iAmChannelAdmin = computed(() => {
    const channel = this.channel();
    return channel !== undefined && this.conversations.isAdmin(channel.id);
  });
  private readonly partnerId = computed(() => this.params().get('userId'));
  protected readonly partner = computed(() => {
    const userId = this.partnerId();
    return userId === null ? undefined : this.users.user(userId);
  });
  /** Whether the DM is the User's self-DM. */
  protected readonly isSelf = computed(() => this.partnerId() === this.me()?.id);
  /** The DM with the partner, once it has a Message. */
  protected readonly directMessage = computed(() => {
    const userId = this.partnerId();
    return userId === null ? undefined : this.conversations.directMessageWith(userId);
  });

  /** The composer a send is in flight for, if any. */
  protected readonly sending = signal<DraftKey | null>(null);
  /** The files attached in the composer; unlike its text, they're not kept for another Conversation. */
  protected readonly attachments = signal<readonly PendingAttachment[]>([]);

  constructor() {
    const draft = computed(() => {
      const channel = this.channel();
      const partnerId = this.partnerId();
      return channel ? this.conversationDraft(channel.id) : partnerId && this.dmDraft(partnerId);
    });
    effect(() => {
      draft();
      untracked(() => this.attachments.set([]));
    });
    // On the id, not the Conversation, so a renamed or bumped one doesn't reload its Messages.
    const conversationId = computed(() => (this.channel() ?? this.directMessage())?.id);
    effect(() => {
      const id = conversationId();
      if (id !== undefined) {
        untracked(() => this.messages.conversation.open(id)).catch(() =>
          this.errors.show(this.transloco.translate('errors.generic')),
        );
      } else if (this.partnerId() !== null) {
        untracked(() => this.messages.conversation.close());
      }
    });
    // A Channel the User lost (they left or were removed) closes, and they land in the Default Channel.
    effect(() => {
      const id = this.params().get('id');
      const defaultChannel = this.conversations.defaultChannel();
      if (id !== null && this.channel() === undefined && defaultChannel) {
        void untracked(() =>
          this.router.navigate(['/channel', defaultChannel.id], { replaceUrl: true }),
        );
      }
    });
    // A partner who joined after the Workspace was loaded is fetched; an unknown one sends the User to `/`.
    effect(() => {
      const userId = this.partnerId();
      if (userId !== null) {
        // A failed load has shown its toast already, and a missing User sent the User to `/`.
        untracked(() => this.users.open(userId)).catch(() => undefined);
      }
    });
  }

  protected conversationDraft(conversationId: number): DraftKey {
    return `conversation:${conversationId}`;
  }

  protected dmDraft(partnerId: string): DraftKey {
    return `dm:${partnerId}`;
  }

  protected sendToChannel(conversationId: number, message: ComposedMessage): Promise<void> {
    return this.send(this.conversationDraft(conversationId), () =>
      this.messages.send(conversationId, message.text, message.attachmentIds),
    );
  }

  /** Sends to the DM by partner, so the first Message creates it; the sidebar then lists it. */
  protected sendToPartner(partnerId: string, message: ComposedMessage): Promise<void> {
    return this.send(this.dmDraft(partnerId), async () => {
      const sent = await this.messages.sendDirect(partnerId, message.text, message.attachmentIds);
      // Without waiting for `conversation.upserted`, which a dropped connection would lose.
      this.conversations
        .ensure(sent.conversationId)
        .catch(() => this.errors.show(this.transloco.translate('errors.generic')));
    });
  }

  /** Runs [sendMessage]; only a sent Message clears the draft and its files, so a failed one can be retried. */
  private async send(draft: DraftKey, sendMessage: () => Promise<void>): Promise<void> {
    this.sending.set(draft);
    try {
      await sendMessage();
      this.drafts.set(draft, '');
      this.attachments.set([]);
    } catch {
      this.errors.show(this.transloco.translate('errors.sendFailed'));
    } finally {
      this.sending.set(null);
    }
  }
}
