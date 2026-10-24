import { Service, signal } from '@angular/core';

/**
 * Whose composer a draft belongs to: a Channel's, or a DM's by partner, which keeps it while the first
 * Message creates the DM. TODO(#58): `thread:${messageId}`.
 */
export type DraftKey = `conversation:${number}` | `dm:${string}`;

/** The unsent text of each composer, kept in memory while the User switches between Conversations. */
@Service()
export class DraftService {
  private readonly drafts = signal(new Map<DraftKey, string>());

  get(key: DraftKey): string {
    return this.drafts().get(key) ?? '';
  }

  set(key: DraftKey, text: string): void {
    this.drafts.update((drafts) => {
      const next = new Map(drafts);
      if (text === '') {
        next.delete(key);
      } else {
        next.set(key, text);
      }
      return next;
    });
  }
}
