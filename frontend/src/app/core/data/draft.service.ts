import { Service, signal } from '@angular/core';

/**
 * Whose composer a draft belongs to: a Channel's, a DM's by partner, which keeps it while the first
 * Message creates the DM, a Thread's by its parent Message, or "Neue Nachricht"'s.
 */
export type DraftKey = `conversation:${number}` | `dm:${string}` | `thread:${number}` | 'new';

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
