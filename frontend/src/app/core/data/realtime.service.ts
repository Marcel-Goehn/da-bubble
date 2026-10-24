import { inject, Service } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { RxStomp } from '@stomp/rx-stomp';
import Keycloak from 'keycloak-js';
import { map, merge, Observable } from 'rxjs';
import { RealtimeEvent } from '../../api/generated/model';
import { ErrorService } from '../errors/error.service';
import { ConversationStore } from './conversation.store';
import { MessageStore } from './message.store';
import { PresenceStore } from './presence.store';

export type { RealtimeEvent };

/** A live connection: the events pushed to this tab, and a tick on every (re)connect once subscribed. */
export interface RealtimeConnection {
  events: Observable<RealtimeEvent>;
  connected: Observable<void>;
}

/** Seconds the token must stay valid for a (re)connect; the server closes the session when it expires. */
const MIN_TOKEN_VALIDITY = 30;
const HEARTBEAT_MS = 10_000;
const RECONNECT_DELAY_MS = 2_000;

/**
 * The STOMP connection to the backend: routes every pushed event to its store, and on every (re)connect
 * catches up over REST. The server closes the session when its token expires, and rx-stomp reconnects with a
 * fresh one.
 */
@Service()
export class RealtimeService {
  private readonly keycloak = inject(Keycloak);
  private readonly conversations = inject(ConversationStore);
  private readonly messages = inject(MessageStore);
  private readonly presence = inject(PresenceStore);
  private readonly errors = inject(ErrorService);
  private readonly transloco = inject(TranslocoService);
  private started = false;

  /** Connects, once; later calls do nothing. */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    const { events, connected } = this.connect();
    // Subscribed first, so whatever is sent while the catch-up runs arrives as an event.
    events.subscribe((event) => this.route(event));
    connected.subscribe(() => void this.catchUp());
  }

  /** Opens the connection; tests replace it. */
  protected connect(): RealtimeConnection {
    const stomp = new RxStomp();
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    stomp.configure({
      brokerURL: `${scheme}://${window.location.host}/ws`,
      heartbeatIncoming: HEARTBEAT_MS,
      heartbeatOutgoing: HEARTBEAT_MS,
      reconnectDelay: RECONNECT_DELAY_MS,
      beforeConnect: async (client) => {
        // A failed refresh still tries the current token; the server refuses it and rx-stomp retries.
        await this.keycloak.updateToken(MIN_TOKEN_VALIDITY).catch(() => false);
        client.configure({
          connectHeaders: { Authorization: `Bearer ${this.keycloak.token ?? ''}` },
        });
      },
    });
    stomp.activate();
    return {
      // The User's own events, and those for the whole Workspace such as Presence.
      events: merge(
        stomp.watch({ destination: '/user/queue/events' }),
        stomp.watch({ destination: '/topic/workspace' }),
      ).pipe(map((frame) => JSON.parse(frame.body) as RealtimeEvent)),
      connected: stomp.connected$.pipe(map(() => undefined)),
    };
  }

  /**
   * Refetches what may have changed while disconnected (there is no replay): the sidebar, Presence and the
   * open Conversation's newest page, merged by id. A failure waits for the next reconnect.
   */
  private async catchUp(): Promise<void> {
    await Promise.all([
      this.conversations.refresh(),
      this.presence.refresh(),
      this.messages.refreshNewest(),
    ]).catch(() => this.errors.show(this.transloco.translate('errors.generic')));
  }

  private route(event: RealtimeEvent): void {
    switch (event.type) {
      case 'message.created':
        this.messages.upsert(event.message);
        break;
      case 'presence.changed':
        this.presence.set(event.userId, event.online);
        break;
    }
  }
}
