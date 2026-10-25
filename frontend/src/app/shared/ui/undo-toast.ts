import { LiveAnnouncer } from '@angular/cdk/a11y';
import { createGlobalPositionStrategy, createOverlayRef, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  afterRenderEffect,
  Component,
  ElementRef,
  inject,
  Injector,
  Service,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

/** How long a change can be undone from its toast. */
const undoMs = 6000;

interface Undoable {
  /** What happened, already translated. */
  message: string;
  undo: () => void;
  /** Where focus goes once the toast is gone, if it was on the toast. */
  returnFocus?: () => HTMLElement | undefined;
}

/**
 * Offers to undo a change that took effect at once, e.g. a removed Member, in a dark toast for about 6 s.
 * The toast is an overlay, so it stays reachable over an open dialog, which hides the rest of the page from
 * assistive technology.
 */
@Service()
export class UndoService {
  private readonly announcer = inject(LiveAnnouncer);
  private readonly transloco = inject(TranslocoService);
  private readonly injector = inject(Injector);
  private readonly state = signal<Undoable | null>(null);
  private overlay: OverlayRef | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** The change on offer, if any. */
  readonly offer = this.state.asReadonly();

  /**
   * Offers [undo] for the change [message] describes, replacing any earlier offer. If focus was lost, e.g. on
   * a removed row's button, it moves to "Rückgängig"; once the toast is gone, it goes to [returnFocus].
   */
  show(message: string, undo: () => void, returnFocus?: () => HTMLElement | undefined): void {
    clearTimeout(this.timer);
    this.attach();
    this.state.set({ message, undo, returnFocus });
    void this.announcer.announce(
      `${message}. ${this.transloco.translate('undo.action')}`,
      'polite',
    );
    this.timer = setTimeout(() => this.dismiss(), undoMs);
  }

  /** Undoes the change on offer, once. */
  undo(): void {
    const offer = this.state();
    this.dismiss();
    offer?.undo();
  }

  dismiss(): void {
    clearTimeout(this.timer);
    const offer = this.state();
    const hadFocus = this.overlay?.overlayElement.contains(document.activeElement) ?? false;
    this.state.set(null);
    if (hadFocus) {
      offer?.returnFocus?.()?.focus();
    }
  }

  // Attached on first use and kept, above whatever overlay is open at that moment.
  private attach(): void {
    if (this.overlay?.hasAttached()) {
      this.overlay.hostElement.parentElement?.appendChild(this.overlay.hostElement);
      return;
    }
    this.overlay = createOverlayRef(this.injector, {
      positionStrategy: createGlobalPositionStrategy(this.injector)
        .centerHorizontally()
        .bottom('40px'),
    });
    this.overlay.attach(new ComponentPortal(UndoToast, null, this.injector));
  }
}

/** The toast of [UndoService]: "<what happened> · Rückgängig". */
@Component({
  selector: 'app-undo-toast',
  imports: [TranslocoPipe],
  template: `
    @if (undo.offer(); as offer) {
      <div
        class="flex max-w-[calc(100vw-2rem)] items-center gap-15 rounded-30 bg-text py-12 pr-12 pl-25 text-text-inverse shadow-overlay"
      >
        <p>{{ offer.message }}</p>
        <span aria-hidden="true">·</span>
        <button
          #undoButton
          type="button"
          class="rounded-20 px-12 py-6 font-bold underline-offset-4 hover:underline"
          (click)="undo.undo()"
        >
          {{ 'undo.action' | transloco }}
        </button>
      </div>
    }
  `,
})
export class UndoToast {
  private readonly undoButton = viewChild<ElementRef<HTMLButtonElement>>('undoButton');

  protected readonly undo = inject(UndoService);

  constructor() {
    // Focus lost with what the change removed, e.g. a removed row's button, goes to "Rückgängig".
    afterRenderEffect(() => {
      const button = this.undoButton()?.nativeElement;
      if (this.undo.offer() && button && document.activeElement === document.body) {
        button.focus();
      }
    });
  }
}
