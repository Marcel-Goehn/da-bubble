import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Service, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ReadUpdatedEvent, UnreadDto } from '../../api/generated/model';
import { ReadsService } from '../../api/generated/reads/reads.service';
import { MessageDto, MessageStore, ThreadKey } from './message.store';
import { UserStore } from './user.store';

export type { ReadUpdatedEvent, UnreadDto };

/** How long the open Conversation or Thread waits after a new Message before it's marked read again. */
const MARK_READ_DEBOUNCE_MS = 1000;

/** From Tailwind's `lg` on, the Thread opens beside its Conversation; below, it replaces it. */
const WIDE_SCREEN = '(min-width: 64rem)';

/**
 * What the User hasn't read: each Conversation's unread count and each Thread's "N neu". The server counts
 * on load and on every reconnect; in between, they're derived from pushed Messages and reads in other tabs.
 * The open Conversation and Thread are marked read while the tab is visible, so they never count up.
 */
@Service()
export class ReadStore {
  private readonly api = inject(ReadsService);
  private readonly users = inject(UserStore);
  private readonly messages = inject(MessageStore);
  private readonly document = inject(DOCUMENT);
  /** Unread Messages and Replies by Conversation id; none is 0. */
  private readonly conversations = signal(new Map<number, number>());
  /** Unread Replies by parent Message id; none is 0. */
  private readonly threads = signal(new Map<number, number>());
  private readonly visible = signal(this.isTabVisible());
  private readonly wideQuery = this.document.defaultView?.matchMedia?.(WIDE_SCREEN);
  private readonly wide = signal(this.wideQuery?.matches ?? true);
  private loading: Promise<void> | null = null;
  private readonly conversationMark = new PendingMark();
  private readonly threadMark = new PendingMark();

  /** The Conversation the User sees: open in a visible tab, and on a narrow screen not behind its Thread. */
  private readonly shownConversation = computed(() => {
    const id = this.messages.conversation.key();
    return this.visible() && (this.wide() || this.messages.thread.key() === null) ? id : null;
  });

  /** The Thread the User sees: open in a visible tab. */
  private readonly shownThread = computed(() =>
    this.visible() ? this.messages.thread.key() : null,
  );

  constructor() {
    this.document.addEventListener('visibilitychange', () => this.visible.set(this.isTabVisible()));
    this.wideQuery?.addEventListener?.('change', (query) => this.wide.set(query.matches));
    // On showing a Conversation or Thread: what it counted is read. On hiding it (leaving it, hiding the tab),
    // a pending mark for what arrived while it showed goes out at once, before more can arrive unseen.
    effect(() => {
      const id = this.shownConversation();
      const unread = id === null ? 0 : this.unreadIn(id);
      untracked(() => {
        this.conversationMark.sendUnlessFor(id);
        if (id !== null && unread > 0) {
          this.markConversationRead(id);
        }
      });
    });
    effect(() => {
      const key = this.shownThread();
      const unread = key === null ? 0 : this.unreadRepliesIn(key.parentId);
      untracked(() => {
        this.threadMark.sendUnlessFor(key?.parentId ?? null);
        if (key !== null && unread > 0) {
          this.markThreadRead(key);
        }
      });
    });
  }

  /** How many Messages and Replies in the Conversation [conversationId] are Unread. */
  unreadIn(conversationId: number): number {
    return this.conversations().get(conversationId) ?? 0;
  }

  /** How many Replies in the Thread of the Message [parentId] are Unread: its "N neu". */
  unreadRepliesIn(parentId: number): number {
    return this.threads().get(parentId) ?? 0;
  }

  /** Fetches the counts once; later calls wait for the same request. */
  load(): Promise<void> {
    this.loading ??= this.fetch().catch((error: unknown) => {
      this.loading = null;
      throw error;
    });
    return this.loading;
  }

  /** Fetches the counts again and replaces what's held: the server's count wins over what was derived. */
  async refresh(): Promise<void> {
    await this.fetch();
    this.loading = Promise.resolve();
  }

  /**
   * Counts a pushed Message or Reply by someone else, unless the User sees it as it arrives: then its open
   * Conversation, or for a Reply its open Thread, is marked read once the Messages stop arriving.
   */
  noteCreated(message: MessageDto): void {
    if (message.authorId === this.users.me()?.id) {
      return;
    }
    const conversationId = message.conversationId;
    if (this.shownConversation() === conversationId) {
      this.conversationMark.schedule(conversationId, () =>
        this.markConversationRead(conversationId),
      );
    } else {
      this.conversations.update((counts) => increment(counts, conversationId));
    }
    const parentId = message.parentMessageId;
    if (parentId === null) {
      return;
    }
    const thread = this.shownThread();
    if (thread?.parentId === parentId) {
      this.threadMark.schedule(parentId, () => this.markThreadRead(thread));
    } else {
      this.threads.update((counts) => increment(counts, parentId));
    }
  }

  /** The User read a Conversation or Thread, in this tab or another. */
  noteRead(event: ReadUpdatedEvent): void {
    if (event.parentMessageId === null) {
      this.conversations.update((counts) => without(counts, event.conversationId));
    } else {
      const parentId = event.parentMessageId;
      this.threads.update((counts) => without(counts, parentId));
    }
  }

  /** Clears the count at once; the other tabs follow with `read.updated`. A failure waits for the refetch. */
  private markConversationRead(conversationId: number): void {
    this.conversations.update((counts) => without(counts, conversationId));
    firstValueFrom(this.api.markConversationRead(conversationId)).catch(() => undefined);
  }

  private markThreadRead({ conversationId, parentId }: ThreadKey): void {
    this.threads.update((counts) => without(counts, parentId));
    firstValueFrom(this.api.markThreadRead(conversationId, parentId)).catch(() => undefined);
  }

  private async fetch(): Promise<void> {
    const unread = await firstValueFrom(this.api.listUnread());
    this.conversations.set(new Map(unread.conversations.map((c) => [c.conversationId, c.count])));
    this.threads.set(new Map(unread.threads.map((t) => [t.parentMessageId, t.count])));
  }

  private isTabVisible(): boolean {
    return this.document.visibilityState === 'visible';
  }
}

/** A mark-read waiting for the Messages to stop arriving, for one Conversation or Thread at a time. */
class PendingMark {
  private pending: { id: number; send: () => void; timer: ReturnType<typeof setTimeout> } | null =
    null;

  /** Sends [send] for [id] once no Message has arrived for a while; a newer one replaces it. */
  schedule(id: number, send: () => void): void {
    this.sendUnlessFor(id);
    clearTimeout(this.pending?.timer);
    this.pending = { id, send, timer: setTimeout(() => this.sendNow(), MARK_READ_DEBOUNCE_MS) };
  }

  /** Sends what's pending at once, unless it's for [id], which still shows. */
  sendUnlessFor(id: number | null): void {
    if (this.pending !== null && this.pending.id !== id) {
      this.sendNow();
    }
  }

  private sendNow(): void {
    const pending = this.pending;
    this.pending = null;
    if (pending !== null) {
      clearTimeout(pending.timer);
      pending.send();
    }
  }
}

function increment(counts: Map<number, number>, id: number): Map<number, number> {
  return new Map(counts).set(id, (counts.get(id) ?? 0) + 1);
}

function without(counts: Map<number, number>, id: number): Map<number, number> {
  if (!counts.has(id)) {
    return counts;
  }
  const next = new Map(counts);
  next.delete(id);
  return next;
}
