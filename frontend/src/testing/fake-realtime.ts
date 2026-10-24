import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import {
  RealtimeConnection,
  RealtimeEvent,
  RealtimeService,
} from '../app/core/data/realtime.service';

/**
 * The real [RealtimeService] (routing and catch-up included) without a STOMP connection: tests push events
 * with [emit] and stand in for the server accepting a (re)connect with [reconnect].
 */
@Injectable()
export class FakeRealtimeService extends RealtimeService {
  private readonly events = new Subject<RealtimeEvent>();
  private readonly connected = new Subject<void>();

  /** Delivers [event] as if the server had pushed it to this tab. */
  emit(event: RealtimeEvent): void {
    this.events.next(event);
  }

  /** Connects (again), after which the app catches up on what it may have missed. */
  reconnect(): void {
    this.connected.next();
  }

  protected override connect(): RealtimeConnection {
    return { events: this.events, connected: this.connected };
  }
}
