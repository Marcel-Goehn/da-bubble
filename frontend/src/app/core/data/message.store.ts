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

  /** The Conversation whose Messages the store holds. */
  readonly conversationId = this.openId.asReadonly();
  readonly messages = computed(() => [...this.byId().values()].sort(byCreation));
  /** Whether there are Messages before the oldest one held. */
  readonly hasOlder = computed(() => this.cursor() !== null);
  readonly loadingOlder = this.loadingOlderState.asReadonly();

  /** Replaces the window with the newest page of [conversationId]. */
  async open(conversationId: number): Promise<void> {
    const generation = ++this.generation;
    this.openId.set(conversationId);
    this.byId.set(new Map());
    this.cursor.set(null);
    this.loadingOlderState.set(false);
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

  /** Sends [text] to [conversationId]; the Message joins the window if that Conversation is still open. */
  async send(conversationId: number, text: string): Promise<void> {
    this.upsert(await firstValueFrom(this.api.sendMessage(conversationId, { text })));
  }

  upsert(message: MessageDto): void {
    this.merge([message]);
  }

  /** Adds [page] unless the User opened another Conversation since it was asked for. */
  private applyPage(generation: number, page: MessagePageDto): void {
    if (generation === this.generation) {
      this.merge(page.messages);
      this.cursor.set(page.nextCursor);
    }
  }

  private merge(messages: MessageDto[]): void {
    const open = messages.filter((message) => message.conversationId === this.openId());
    if (open.length > 0) {
      this.byId.update((map) => {
        const next = new Map(map);
        open.forEach((message) => next.set(message.id, message));
        return next;
      });
    }
  }
}
