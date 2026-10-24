import { computed, Signal, signal } from '@angular/core';
import { MessageDto } from '../../api/generated/model';

/** One page of a window, newest first; [nextCursor] asks for the older page, `null` at the beginning. */
export interface MessagePage {
  messages: MessageDto[];
  nextCursor: string | null;
}

/** Oldest first, as the list shows them; ties on the timestamp fall back to the id, as the API orders them. */
export function byCreation(a: MessageDto, b: MessageDto): number {
  return Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id - b.id;
}

/** What a list needs of a window, whatever it holds Messages of. */
export type MessageWindowView = Pick<
  MessageWindow<unknown>,
  'key' | 'messages' | 'hasOlder' | 'loadingOlder' | 'loadOlder'
>;

/**
 * The window of Messages a list shows for whatever [K] identifies, e.g. a Conversation or a Thread: its
 * newest page, plus the older pages scrolled to so far. [fetch] reads a page, without a cursor the newest;
 * [holds] tells which Messages belong to the open key.
 */
export class MessageWindow<K> {
  private readonly byId = signal(new Map<number, MessageDto>());
  private readonly openKey = signal<K | null>(null);
  private readonly cursor = signal<string | null>(null);
  private readonly loadingOlderState = signal(false);
  // Bumped by every open, so a page that arrives after the User moved on is dropped.
  private generation = 0;
  // The newest Message held with nothing missing between it and the oldest one, which a catch-up must reach.
  private reached: MessageDto | null = null;

  /** What the window holds Messages of; `null` while closed. */
  readonly key: Signal<K | null> = this.openKey.asReadonly();
  readonly messages = computed(() => [...this.byId().values()].sort(byCreation));
  /** Whether there are Messages before the oldest one held. */
  readonly hasOlder = computed(() => this.cursor() !== null);
  readonly loadingOlder = this.loadingOlderState.asReadonly();

  constructor(
    private readonly fetch: (key: K, cursor?: string) => Promise<MessagePage>,
    private readonly holds: (key: K, message: MessageDto) => boolean,
  ) {}

  /** Replaces the window with the newest page of [key]. */
  async open(key: K): Promise<void> {
    const generation = this.reset(key);
    this.applyPage(generation, await this.fetch(key));
  }

  /** Holds nothing. */
  close(): void {
    this.reset(null);
  }

  /** Adds the next older page; does nothing at the beginning or while a page loads. */
  async loadOlder(): Promise<void> {
    const key = this.openKey();
    const cursor = this.cursor();
    if (key === null || cursor === null || this.loadingOlderState()) {
      return;
    }
    const generation = this.generation;
    this.loadingOlderState.set(true);
    try {
      this.applyPage(generation, await this.fetch(key, cursor));
    } finally {
      if (generation === this.generation) {
        this.loadingOlderState.set(false);
      }
    }
  }

  /**
   * Fetches the newest page again and merges it by id. If it doesn't reach the newest Message held without a
   * gap, more was missed than a page holds: the window starts over at that page.
   */
  async refreshNewest(): Promise<void> {
    const key = this.openKey();
    if (key === null) {
      return;
    }
    // Before the request: Messages pushed while it runs are newer than the ones missed.
    const reached = this.reached;
    const generation = this.generation;
    const page = await this.fetch(key);
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
      this.reset(key);
    }
    if (gap || reached === null) {
      this.cursor.set(page.nextCursor);
    }
    this.merge(page.messages, { contiguous: true });
  }

  /** Adds the open key's [messages]; [contiguous] ones are known to leave no gap below them. */
  merge(messages: MessageDto[], { contiguous = false } = {}): void {
    const key = this.openKey();
    const held = key === null ? [] : messages.filter((message) => this.holds(key, message));
    if (contiguous) {
      for (const message of held) {
        if (this.reached === null || byCreation(message, this.reached) > 0) {
          this.reached = message;
        }
      }
    }
    if (held.length > 0) {
      this.byId.update((map) => {
        const next = new Map(map);
        held.forEach((message) => next.set(message.id, message));
        return next;
      });
    }
  }

  /** Changes the Message [id] with [change] if the window holds it; one it doesn't hold isn't missed. */
  update(id: number, change: (message: MessageDto) => MessageDto): void {
    const held = this.byId().get(id);
    if (held !== undefined) {
      this.byId.update((map) => new Map(map).set(id, change(held)));
    }
  }

  /** Empties the window for [key] and returns the generation pages for it must carry. */
  private reset(key: K | null): number {
    this.openKey.set(key);
    this.byId.set(new Map());
    this.reached = null;
    this.cursor.set(null);
    this.loadingOlderState.set(false);
    return ++this.generation;
  }

  /** Adds [page] unless another key was opened since it was asked for. */
  private applyPage(generation: number, page: MessagePage): void {
    if (generation === this.generation) {
      this.merge(page.messages, { contiguous: true });
      this.cursor.set(page.nextCursor);
    }
  }
}
