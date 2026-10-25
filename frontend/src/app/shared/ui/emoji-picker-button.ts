import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import {
  afterRenderEffect,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmojiPickerLoader, LoadedEmojiPicker } from './emoji-picker-loader';
import { Icon } from './icon';
import { IconName } from './icons';

const gap = 8;
const above: ConnectedPosition[] = [
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -gap },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -gap },
];
const below: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: gap },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: gap },
];

/**
 * An icon button that opens the emoji picker as a popover at itself: above it (the composer) or below it
 * (the reaction bar), flipping when there's no room. Picking an emoji or pressing Escape closes it and
 * returns focus to the button; the picker itself is loaded on first open.
 */
@Component({
  selector: 'app-emoji-picker-button',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, Icon, TranslocoPipe],
  host: { class: 'flex' },
  template: `
    <button
      type="button"
      class="flex rounded-20 p-4 hover:bg-hover hover:text-interactive"
      cdkOverlayOrigin
      aria-haspopup="dialog"
      [attr.aria-label]="label()"
      [attr.aria-expanded]="open()"
      (click)="toggle()"
      #origin="cdkOverlayOrigin"
      #trigger
    >
      <app-icon [name]="icon()" />
    </button>
    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions()"
      (overlayOutsideClick)="outsideClick($event)"
      (overlayKeydown)="keydown($event)"
      (detach)="close(false)"
    >
      <div
        class="overflow-hidden rounded-30 bg-surface shadow-overlay"
        role="dialog"
        [attr.aria-label]="'emojiPicker.label' | transloco"
        #panel
      ></div>
    </ng-template>
  `,
})
export class EmojiPickerButton {
  /** Names the button for assistive technology. */
  readonly label = input.required<string>();
  readonly icon = input.required<IconName>();
  /** Where the popover opens: above the button, or below it. */
  readonly position = input<'above' | 'below'>('above');
  /** An emoji was picked, as native Unicode with its skin tone. */
  readonly picked = output<string>();

  /** Whether the popover is open. */
  readonly open = signal(false);

  protected readonly positions = computed(() =>
    this.position() === 'above' ? [...above, ...below] : [...below, ...above],
  );

  private readonly loader = inject(EmojiPickerLoader);
  private readonly picker = signal<LoadedEmojiPicker | null>(null);
  private readonly trigger = viewChild.required<ElementRef<HTMLElement>>('trigger');
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly overlay = viewChild.required(CdkConnectedOverlay);

  constructor() {
    // Each opening renders a new panel; the one picker moves into it and takes focus. The panel was placed
    // while empty, so it's placed again for the picker's size, flipping if there's no room where it was.
    afterRenderEffect(() => {
      const panel = this.panel()?.nativeElement;
      const picker = this.picker();
      if (panel !== undefined && picker !== null && !panel.contains(picker.element)) {
        panel.append(picker.element);
        this.overlay().overlayRef.updatePosition();
        picker.focus();
      }
    });
  }

  protected async toggle(): Promise<void> {
    if (this.open()) {
      this.close(true);
      return;
    }
    this.open.set(true);
    if (this.picker() === null) {
      const picker = await this.loader.create();
      picker.element.addEventListener('emoji-click', (event) =>
        this.pick((event as CustomEvent<{ unicode: string }>).detail.unicode),
      );
      this.picker.set(picker);
    }
  }

  /** Closes the popover, returning focus to the button when [restoreFocus]. */
  close(restoreFocus: boolean): void {
    if (!this.open()) {
      return;
    }
    this.open.set(false);
    if (restoreFocus) {
      this.trigger().nativeElement.focus();
    }
  }

  protected keydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close(true);
    }
  }

  /** A click elsewhere closes it; one on the button is its own toggle. */
  protected outsideClick(event: MouseEvent): void {
    if (!this.trigger().nativeElement.contains(event.target as Node)) {
      this.close(false);
    }
  }

  private pick(emoji: string): void {
    this.close(true);
    this.picked.emit(emoji);
  }
}
