import { inject, Service, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PresenceService } from '../../api/generated/presence/presence.service';

export type Presence = 'online' | 'offline';

/** Which Users are online; everyone else is offline. Only the server knows, so it's never derived here. */
@Service()
export class PresenceStore {
  private readonly api = inject(PresenceService);
  private readonly online = signal(new Set<string>());
  /** The changes pushed while a snapshot is on its way, which are newer than it. */
  private pushedDuringRefresh: Map<string, boolean> | null = null;

  /** The Presence of the User with [userId]. */
  of(userId: string): Presence {
    return this.online().has(userId) ? 'online' : 'offline';
  }

  /** Fetches who is online now and replaces what's held, keeping whatever was pushed meanwhile. */
  async refresh(): Promise<void> {
    const pushed = new Map<string, boolean>();
    this.pushedDuringRefresh = pushed;
    try {
      const next = new Set(await firstValueFrom(this.api.listOnline()));
      pushed.forEach((online, userId) => toggle(next, userId, online));
      this.online.set(next);
    } finally {
      if (this.pushedDuringRefresh === pushed) {
        this.pushedDuringRefresh = null;
      }
    }
  }

  /** Records a pushed change of the User with [userId]. */
  set(userId: string, online: boolean): void {
    this.pushedDuringRefresh?.set(userId, online);
    this.online.update((current) => toggle(new Set(current), userId, online));
  }
}

function toggle(online: Set<string>, userId: string, isOnline: boolean): Set<string> {
  if (isOnline) {
    online.add(userId);
  } else {
    online.delete(userId);
  }
  return online;
}
