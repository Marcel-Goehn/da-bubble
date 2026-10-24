import { computed, inject, Service, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MessagesService } from '../../api/generated/messages/messages.service';
import { MessageDto, MessagePageDto } from '../../api/generated/model';

export type { MessageDto };

/** Oldest first, as the list shows them; ties on the timestamp fall back to the id, as the API orders them. */
function byCreation(a: MessageDto, b: MessageDto): number {
  return Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id;
}

/**
 * The open Conversation's window of Messages: its newest page, plus the older pages scrolled to so far.
 * TODO(#58): the open Thread.
 */
@Service()
export class MessageStore {
  private readonly api = inject(MessagesService);
  private readonly byId = signal(new Map<number, MessageDto>());
  private readonly openId = signal<number | null>(null);
  private readonly cursor = signal<string | null>(null);
  private readonly loadingOlderState = signal(false);
  // Bumped by every open, so a page that arrives after the User moved on is dropped.
  private generation = 0;
  // The newest Message held with nothing missing between it and the oldest one, which a catch-up must reach.
  private reached: MessageDto | null = null;

  /** The Conversation whose Messages the store holds. */
  readonly conversationId = this.openId.asReadonly();
  readonly messages = computed(() => [...this.byId().values()].sort(byCreation));
  /** Whether there are Messages before the oldest one held. */
  readonly hasOlder = computed(() => this.cursor() !== null);
  readonly loadingOlder = this.loadingOlderState.asReadonly();

  /** Replaces the window with the newest page of [conversationId]. */
  async open(conversationId: number): Promise<void> {
    const generation = this.reset(conversationId);
    this.applyPage(generation, await firstValueFrom(this.api.listMessages(conversationId)));
  }

  /** Adds the next older page; does nothing at the beginning of the Conversation or while a page loads. */
  async loadOlder(): Promise<void> {
    const conversationId = this.openId();
    const cursor = this.cursor();
    if (conversationId === null || cursor === null || this.loadingOlderState()) {
      return;
    }
    const generation = this.generation;
    this.loadingOlderState.set(true);
    try {
      const page = await firstValueFrom(this.api.listMessages(conversationId, { cursor }));
      this.applyPage(generation, page);
    } finally {
      if (generation === this.generation) {
        this.loadingOlderState.set(false);
      }
    }
  }

  /**
   * Fetches the open Conversation's newest page again and merges it by id. If it doesn't reach the newest
   * Message held without a gap, more was missed than a page holds: the window starts over at that page.
   */
  async refreshNewest(): Promise<void> {
    const conversationId = this.openId();
    if (conversationId === null) {
      return;
    }
    // Before the request: Messages pushed while it runs are newer than the ones missed.
    const reached = this.reached;
    const generation = this.generation;
    const page = await firstValueFrom(this.api.listMessages(conversationId));
    if (generation !== this.generation) {
      return;
    }
    const oldestFetched = page.messages.at(-1);
    const gap =
      page.nextCursor !== null &&
      reached !== null &&
      oldestFetched !== undefined &&
      byCreation(oldestFetched, reached) > 0;
    if (gap) {
      // Also drops an older page still on its way, which would belong before the old window.
      this.reset(conversationId);
    }
    if (gap || reached === null) {
      this.cursor.set(page.nextCursor);
    }
    this.merge(page.messages, { contiguous: true });
  }

  /** Sends [text] to [conversationId]; the Message joins the window if that Conversation is still open. */
  async send(conversationId: number, text: string): Promise<void> {
    // Not contiguous: while disconnected, others' Messages before it may be missing.
    this.merge([await firstValueFrom(this.api.sendMessage(conversationId, { text }))]);
  }

  /** Adds a Message pushed live; with the connection up, nothing before it was missed. */
  upsert(message: MessageDto): void {
    this.merge([message], { contiguous: true });
  }

  /** Empties the window for [conversationId] and returns the generation pages for it must carry. */
  private reset(conversationId: number): number {
    this.openId.set(conversationId);
    this.byId.set(new Map());
    this.reached = null;
    this.cursor.set(null);
    this.loadingOlderState.set(false);
    return ++this.generation;
  }

  /** Adds [page] unless the User opened another Conversation since it was asked for. */
  private applyPage(generation: number, page: MessagePageDto): void {
    if (generation === this.generation) {
      this.merge(page.messages, { contiguous: true });
      this.cursor.set(page.nextCursor);
    }
  }

  /** Adds the open Conversation's [messages]; [contiguous] ones are known to leave no gap below them. */
  private merge(messages: MessageDto[], { contiguous = false } = {}): void {
    const open = messages.filter((message) => message.conversationId === this.openId());
    if (contiguous) {
      for (const message of open) {
        if (this.reached === null || byCreation(message, this.reached) > 0) {
          this.reached = message;
        }
      }
    }
    if (open.length > 0) {
      this.byId.update((map) => {
        const next = new Map(map);
        open.forEach((message) => next.set(message.id, message));
        return next;
      });
    }
  }
}
