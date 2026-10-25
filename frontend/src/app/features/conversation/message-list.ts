import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { avatarUrl } from '../../core/data/avatars';
import { MessageDto, MessageStore, MessageWindowView } from '../../core/data/message.store';
import { PresenceStore } from '../../core/data/presence.store';
import { UserStore } from '../../core/data/user.store';
import { ErrorService } from '../../core/errors/error.service';
import { MessageBubble } from '../../shared/ui/message-bubble';
import { ReactionView } from '../../shared/ui/reaction-chips';
import { ProfileCards } from '../profile/profile-cards';
import { DeleteMessageDialog } from './delete-message-dialog';

/** How close to the bottom, in px, still counts as at the bottom. */
const bottomSlackPx = 40;

/** What the observer last said about the top of the list, and about which Messages it said it. */
interface OlderReport {
  inView: boolean;
  messages: MessageDto[];
}

/** What the list showed at the last render, to tell an older page from a new Message. */
interface Rendered {
  /** What the window held Messages of; another one starts at the bottom again. */
  key: unknown;
  oldestId: number | undefined;
  newestId: number | undefined;
}

/**
 * A window of Messages, the open Conversation's or the open Thread's, oldest at the top. It opens at the bottom, loads the older page when the
 * User scrolls up to the top, keeps what they're reading in place while that page is added above, and
 * follows new Messages only while they're at the bottom. Projected content goes above the oldest Message
 * once the beginning is reached.
 */
@Component({
  selector: 'app-message-list',
  imports: [MessageBubble, NgTemplateOutlet, TranslocoPipe],
  template: `
    <div
      class="flex h-full flex-col overflow-y-auto overflow-anchor-none"
      role="region"
      tabindex="0"
      [attr.aria-label]="label()"
      (scroll)="measure()"
      #scroller
    >
      <div class="h-1 shrink-0" data-testid="older-messages" #olderSentinel></div>
      <div class="mt-auto"></div>
      <!-- What the list starts with, once the User has scrolled back to its beginning. -->
      @if (!window().hasOlder()) {
        <ng-content />
      }
      <!-- Always on top: older pages go in below it, between it and the Messages already shown. -->
      @if (lead(); as lead) {
        <ng-container *ngTemplateOutlet="bubble; context: { $implicit: lead }" />
        @if (lead.replyCount > 0) {
          <p class="flex items-center gap-20 px-16 text-text-muted lg:px-45">
            {{ 'thread.replyCount' | transloco: { count: lead.replyCount } }}
            <span class="h-px flex-1 bg-border" aria-hidden="true"></span>
          </p>
        }
      }
      <ol class="py-20">
        @for (message of window().messages(); track message.id) {
          <li>
            <ng-container *ngTemplateOutlet="bubble; context: { $implicit: message }" />
          </li>
        }
      </ol>
    </div>

    <ng-template #bubble let-message>
      @let author = users.user(message.authorId);
      <app-message-bubble
        [authorName]="author?.name ?? ('message.unknownAuthor' | transloco)"
        [avatarSrc]="avatarUrl(author?.avatar ?? null)"
        [presence]="presence.of(message.authorId)"
        [text]="message.text"
        [createdAt]="message.createdAt"
        [edited]="message.editedAt !== null"
        [deleted]="message.deletedAt !== null"
        [own]="message.authorId === users.me()?.id"
        [editing]="editingId() === message.id"
        [saving]="savingId() === message.id"
        [replyCount]="message.replyCount"
        [lastReplyAt]="message.lastReplyAt"
        [threadLink]="opensThreads() ? ['thread', message.id] : null"
        [reactions]="reactionViews(message)"
        [compactReactions]="compactReactions()"
        (authorSelected)="profiles.open(message.authorId)"
        (mentionSelected)="profiles.open($event)"
        (editRequested)="editingId.set(message.id)"
        (editCancelled)="editingId.set(null)"
        (editSaved)="saveEdit(message, $event)"
        (deleteRequested)="confirmDelete(message, $event)"
        (reactionToggled)="toggleReaction(message, $event)"
      />
    </ng-template>
  `,
})
export class MessageList {
  /** The Messages to show: the open Conversation's or the open Thread's. */
  readonly window = input.required<MessageWindowView>();
  /** Names the list for assistive technology. */
  readonly label = input.required<string>();
  /** Whether its Messages open Threads, which Replies don't. */
  readonly opensThreads = input(false, { transform: booleanAttribute });
  /** Whether long Reaction lists collapse after 7 at every width, as in a Thread. */
  readonly compactReactions = input(false, { transform: booleanAttribute });
  /** A Message always shown above the others, with the count of Replies below it: a Thread's parent. */
  readonly lead = input<MessageDto | null>(null);

  protected readonly store = inject(MessageStore);
  protected readonly users = inject(UserStore);
  protected readonly presence = inject(PresenceStore);
  protected readonly profiles = inject(ProfileCards);
  protected readonly avatarUrl = avatarUrl;
  /** The User's own Message being edited in place, if any; one at a time. */
  protected readonly editingId = signal<number | null>(null);
  /** The Message whose edit is being saved, if any. */
  protected readonly savingId = signal<number | null>(null);

  private readonly dialog = inject(Dialog);
  private readonly errors = inject(ErrorService);
  private readonly transloco = inject(TranslocoService);

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly olderSentinel = viewChild.required<ElementRef<HTMLElement>>('olderSentinel');
  private readonly olderReport = signal<OlderReport | null>(null);
  private observer: IntersectionObserver | undefined;
  private atBottom = true;
  private distanceFromBottom = 0;
  private rendered: Rendered = { key: null, oldestId: undefined, newestId: undefined };

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const observer = new IntersectionObserver(
        (entries) =>
          this.olderReport.set({
            inView: entries.at(-1)?.isIntersecting ?? false,
            messages: this.window().messages(),
          }),
        { root: this.scroller().nativeElement },
      );
      observer.observe(this.olderSentinel().nativeElement);
      this.observer = observer;
      destroyRef.onDestroy(() => observer.disconnect());
    });

    // A report about an earlier list is stale: the empty list's top is in view, the first page's isn't.
    // Re-runs when a page finishes, so a short page with the top still in view loads the next one.
    effect(() => {
      const report = this.olderReport();
      const window = this.window();
      const current = report?.inView === true && report.messages === window.messages();
      if (current && window.hasOlder() && !window.loadingOlder()) {
        void window.loadOlder();
      }
    });

    afterRenderEffect(() => {
      const messages = this.window().messages();
      const next: Rendered = {
        key: this.window().key(),
        oldestId: messages.at(0)?.id,
        newestId: messages.at(-1)?.id,
      };
      const scroller = this.scroller().nativeElement;
      if (next.key !== this.rendered.key) {
        this.atBottom = true;
      } else if (
        next.newestId === this.rendered.newestId &&
        next.oldestId !== this.rendered.oldestId
      ) {
        // An older page went in above: keep the same Messages under the User's eyes.
        scroller.scrollTop = scroller.scrollHeight - this.distanceFromBottom;
      }
      if (this.atBottom) {
        scroller.scrollTop = scroller.scrollHeight;
      }
      this.rendered = next;
      this.measure();
      this.reobserveOlder();
    });
  }

  /** Saves the edited [text] of [message]; a failed save keeps the editor open, so it can be retried. */
  protected async saveEdit(message: MessageDto, text: string): Promise<void> {
    // Unchanged text isn't an edit, so it isn't marked "(bearbeitet)".
    if (text === message.text) {
      this.editingId.set(null);
      return;
    }
    this.savingId.set(message.id);
    try {
      await this.store.edit(message, text);
      this.editingId.update((id) => (id === message.id ? null : id));
    } catch {
      this.errors.show(this.transloco.translate('errors.editFailed'));
    } finally {
      this.savingId.set(null);
    }
  }

  /**
   * Deletes [message] once the User confirms in the dialog. Focus goes back to its ⋮ [trigger], or to the
   * list once the Message is deleted and the ⋮ gone, rather than to the page.
   */
  protected async confirmDelete(message: MessageDto, trigger: HTMLElement): Promise<void> {
    const dialogRef = this.dialog.open<boolean>(DeleteMessageDialog, { restoreFocus: false });
    if ((await firstValueFrom(dialogRef.closed)) !== true) {
      trigger.focus();
      return;
    }
    try {
      await this.store.delete(message);
      this.scroller().nativeElement.focus();
    } catch {
      this.errors.show(this.transloco.translate('errors.deleteFailed'));
      trigger.focus();
    }
  }

  /** [message]'s Reactions as the chips show them: the User's own, and the names of everyone else. */
  protected reactionViews(message: MessageDto): ReactionView[] {
    const me = this.users.me()?.id;
    return message.reactions.map(({ emoji, userIds }) => ({
      emoji,
      mine: userIds.includes(me ?? ''),
      others: userIds
        .filter((id) => id !== me)
        .map(
          (id) => this.users.user(id)?.name ?? this.transloco.translate('message.unknownAuthor'),
        ),
    }));
  }

  /** Adds or removes the User's Reaction with [emoji] on [message]. */
  protected async toggleReaction(message: MessageDto, emoji: string): Promise<void> {
    try {
      await this.store.toggleReaction(message, emoji);
    } catch {
      this.errors.show(this.transloco.translate('errors.reactionFailed'));
    }
  }

  /** Asks the observer about the new layout; it reports on observe, but otherwise only when the view changes. */
  private reobserveOlder(): void {
    const sentinel = this.olderSentinel().nativeElement;
    this.observer?.unobserve(sentinel);
    this.observer?.observe(sentinel);
  }

  protected measure(): void {
    const { scrollHeight, scrollTop, clientHeight } = this.scroller().nativeElement;
    this.distanceFromBottom = scrollHeight - scrollTop;
    this.atBottom = scrollHeight - scrollTop - clientHeight <= bottomSlackPx;
  }
}
