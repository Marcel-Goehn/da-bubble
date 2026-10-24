import {
  afterNextRender,
  afterRenderEffect,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { avatarUrl } from '../../core/data/avatars';
import { MessageDto, MessageStore } from '../../core/data/message.store';
import { PresenceStore } from '../../core/data/presence.store';
import { UserStore } from '../../core/data/user.store';
import { MessageBubble } from '../../shared/ui/message-bubble';

/** How close to the bottom, in px, still counts as at the bottom. */
const bottomSlackPx = 40;

/** What the observer last said about the top of the list, and about which Messages it said it. */
interface OlderReport {
  inView: boolean;
  messages: MessageDto[];
}

/** What the list showed at the last render, to tell an older page from a new Message. */
interface Rendered {
  conversationId: number | null;
  oldestId: number | undefined;
  newestId: number | undefined;
}

/**
 * The open Conversation's Messages, oldest at the top. It opens at the bottom, loads the older page when the
 * User scrolls up to the top, keeps what they're reading in place while that page is added above, and
 * follows new Messages only while they're at the bottom.
 */
@Component({
  selector: 'app-message-list',
  imports: [MessageBubble, TranslocoPipe],
  template: `
    <div
      class="flex h-full flex-col overflow-y-auto overflow-anchor-none"
      role="region"
      tabindex="0"
      [attr.aria-label]="'messages.label' | transloco"
      (scroll)="measure()"
      #scroller
    >
      <div class="h-1 shrink-0" data-testid="older-messages" #olderSentinel></div>
      <ol class="mt-auto py-20">
        @for (message of store.messages(); track message.id) {
          @let author = users.user(message.authorId);
          <li>
            <app-message-bubble
              [authorName]="author?.name ?? ('message.unknownAuthor' | transloco)"
              [avatarSrc]="avatarUrl(author?.avatar ?? null)"
              [presence]="presence.of(message.authorId)"
              [text]="message.text"
              [createdAt]="message.createdAt"
              [own]="message.authorId === users.me()?.id"
            />
          </li>
        }
      </ol>
    </div>
  `,
})
export class MessageList {
  protected readonly store = inject(MessageStore);
  protected readonly users = inject(UserStore);
  protected readonly presence = inject(PresenceStore);
  protected readonly avatarUrl = avatarUrl;

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly olderSentinel = viewChild.required<ElementRef<HTMLElement>>('olderSentinel');
  private readonly olderReport = signal<OlderReport | null>(null);
  private observer: IntersectionObserver | undefined;
  private atBottom = true;
  private distanceFromBottom = 0;
  private rendered: Rendered = { conversationId: null, oldestId: undefined, newestId: undefined };

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const observer = new IntersectionObserver(
        (entries) =>
          this.olderReport.set({
            inView: entries.at(-1)?.isIntersecting ?? false,
            messages: this.store.messages(),
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
      const current = report?.inView === true && report.messages === this.store.messages();
      if (current && this.store.hasOlder() && !this.store.loadingOlder()) {
        void this.store.loadOlder();
      }
    });

    afterRenderEffect(() => {
      const messages = this.store.messages();
      const next: Rendered = {
        conversationId: this.store.conversationId(),
        oldestId: messages.at(0)?.id,
        newestId: messages.at(-1)?.id,
      };
      const scroller = this.scroller().nativeElement;
      if (next.conversationId !== this.rendered.conversationId) {
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
