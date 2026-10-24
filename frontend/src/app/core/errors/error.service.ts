import { LiveAnnouncer } from '@angular/cdk/a11y';
import { inject, Service, signal } from '@angular/core';

/** How long a toast stays before it goes away by itself. */
const toastMs = 6000;

/** Failures that aren't tied to a field: shown as a toast and announced to screen readers. */
@Service()
export class ErrorService {
  private readonly announcer = inject(LiveAnnouncer);
  private readonly toastState = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** The translated message of the toast on screen, if any. */
  readonly toast = this.toastState.asReadonly();

  /** Shows [message], already translated, replacing any toast on screen. */
  show(message: string): void {
    clearTimeout(this.timer);
    this.toastState.set(message);
    void this.announcer.announce(message, 'assertive');
    this.timer = setTimeout(() => this.dismiss(), toastMs);
  }

  dismiss(): void {
    clearTimeout(this.timer);
    this.toastState.set(null);
  }
}
