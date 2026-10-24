import { HttpErrorResponse } from '@angular/common/http';
import {
  afterRenderEffect,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ConversationStore } from '../../core/data/conversation.store';
import { DraftKey, DraftService } from '../../core/data/draft.service';
import { MessageStore, ThreadKey } from '../../core/data/message.store';
import { UserStore } from '../../core/data/user.store';
import { ErrorService } from '../../core/errors/error.service';
import { ChannelNamePipe } from '../../shared/ui/channel-name.pipe';
import { Composer } from '../../shared/ui/composer';
import { Icon } from '../../shared/ui/icon';
import { MessageList } from '../conversation/message-list';

/**
 * The Thread of a Message (`…/thread/:messageId`) in the open Conversation: the parent Message above its
 * Replies, and a composer of its own. It opens beside the Conversation on desktop and replaces it on mobile.
 */
@Component({
  selector: 'app-thread-pane',
  imports: [ChannelNamePipe, Composer, Icon, MessageList, RouterLink, TranslocoPipe],
  host: { class: 'contents' },
  template: `
    <aside
      class="flex min-w-0 flex-col bg-surface max-lg:hidden max-lg:flex-1 max-lg:group-data-[pane=thread]:flex lg:w-485 lg:shrink-0 lg:rounded-30"
      aria-labelledby="thread-title"
    >
      <header class="flex items-center justify-between px-16 py-20 shadow-header lg:px-40 lg:py-32">
        <h2 class="flex items-baseline gap-10">
          <span id="thread-title" class="text-20 font-bold lg:text-24">{{
            'thread.title' | transloco
          }}</span>
          @if (channel(); as channel) {
            <span class="flex items-center gap-4 text-14 text-interactive">
              <app-icon name="tag" class="size-16!" />
              {{ channel | channelName }}
            </span>
          } @else if (partnerName(); as partnerName) {
            <span class="text-14 text-interactive">{{ partnerName }}</span>
          }
        </h2>
        <a class="rounded-20 p-8 hover:bg-hover" [routerLink]="conversationUrl">
          <app-icon name="close" [label]="'thread.close' | transloco" />
        </a>
      </header>
      @if (key(); as key) {
        <app-message-list
          class="min-h-0 flex-1"
          [window]="messages.thread"
          [label]="'thread.messages' | transloco"
          [lead]="messages.threadParent()"
        />
        <app-composer
          class="px-16 pb-16 lg:px-40 lg:pb-40"
          [label]="'composer.placeholderThread' | transloco"
          [text]="drafts.get(draft(key))"
          (textChange)="drafts.set(draft(key), $event)"
          [busy]="sending() === draft(key)"
          (send)="send(key, $event)"
        />
      } @else {
        <div class="flex-1"></div>
      }
    </aside>
  `,
})
export class ThreadPane {
  private readonly conversations = inject(ConversationStore);
  private readonly users = inject(UserStore);
  private readonly errors = inject(ErrorService);
  private readonly transloco = inject(TranslocoService);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  private readonly conversationParams = toSignal(this.route.parent!.paramMap, {
    requireSync: true,
  });
  private readonly composer = viewChild(Composer);

  protected readonly messages = inject(MessageStore);
  protected readonly drafts = inject(DraftService);

  // Not "..", which would only drop `:messageId` of the two-segment `thread/:messageId`.
  protected readonly conversationUrl = [
    '/',
    ...this.route
      .parent!.snapshot.pathFromRoot.flatMap((route) => route.url)
      .map((segment) => segment.path),
  ];

  /** The open Thread: its parent in the Conversation the pane beside it has open. */
  protected readonly key = computed((): ThreadKey | null => {
    const conversationId = this.messages.conversation.key();
    const parentId = Number(this.params().get('messageId'));
    return conversationId === null || !Number.isSafeInteger(parentId) || parentId <= 0
      ? null
      : { conversationId, parentId };
  });
  protected readonly channel = computed(() => {
    const conversationId = this.key()?.conversationId;
    const conversation =
      conversationId === undefined ? undefined : this.conversations.get(conversationId);
    return conversation?.kind === 'CHANNEL' ? conversation : undefined;
  });
  protected readonly partnerName = computed(() => {
    const partnerId = this.conversationParams().get('userId');
    return partnerId === null ? undefined : this.users.user(partnerId)?.name;
  });

  /** The Thread a Reply is in flight for, if any. */
  protected readonly sending = signal<DraftKey | null>(null);

  constructor() {
    effect(() => {
      const key = this.key();
      untracked(() => {
        if (key === null) {
          this.messages.closeThread();
          return;
        }
        this.messages.openThread(key).catch((error: unknown) => {
          // One that's gone or out of reach has sent the User away with a toast already.
          const unavailable =
            error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404);
          if (!unavailable) {
            this.errors.show(this.transloco.translate('errors.generic'));
          }
        });
      });
    });
    inject(DestroyRef).onDestroy(() => this.messages.closeThread());

    // Opening a Thread, or another one, takes the User to its composer.
    let focusedFor: number | undefined;
    afterRenderEffect(() => {
      const parentId = this.key()?.parentId;
      const composer = this.composer();
      if (parentId !== undefined && composer !== undefined && parentId !== focusedFor) {
        focusedFor = parentId;
        composer.focus();
      }
    });
  }

  protected draft(key: ThreadKey): DraftKey {
    return `thread:${key.parentId}`;
  }

  /** Sends a Reply; only a sent one clears the draft, so a failed one can be retried. */
  protected async send(key: ThreadKey, text: string): Promise<void> {
    const draft = this.draft(key);
    this.sending.set(draft);
    try {
      await this.messages.sendReply(key, text);
      this.drafts.set(draft, '');
    } catch {
      this.errors.show(this.transloco.translate('errors.sendFailed'));
    } finally {
      this.sending.set(null);
    }
  }
}
