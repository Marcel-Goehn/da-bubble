import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmojiPickerButton } from './emoji-picker-button';
import { Icon } from './icon';

/**
 * The text box Messages are written in (component sheets 61. and 63.). Enter sends, Shift+Enter starts a
 * new line. The emoji button inserts an emoji from the picker where the caret is. The text is a model, so
 * the owner can keep it as a draft; it's only cleared by the owner.
 */
@Component({
  selector: 'app-composer',
  imports: [EmojiPickerButton, Icon, TranslocoPipe],
  template: `
    <form
      class="flex flex-col gap-20 rounded-20 border border-border bg-surface p-20 hover:border-border-hover has-[textarea:focus-visible]:border-border-focus"
      (submit)="submit($event)"
    >
      <textarea
        class="resize-none bg-transparent outline-none placeholder:text-text-muted"
        rows="2"
        [attr.aria-label]="label()"
        [placeholder]="label()"
        [value]="text()"
        [readOnly]="busy()"
        (input)="text.set(textarea.value)"
        (keydown.enter)="enter($event)"
        #textarea
      ></textarea>
      <div class="flex items-center justify-between">
        <app-emoji-picker-button
          icon="mood"
          position="above"
          [label]="'composer.emoji' | transloco"
          (picked)="insert($event)"
        />
        <button
          type="submit"
          class="rounded-20 p-8 text-accent enabled:hover:bg-hover disabled:text-disabled"
          [attr.aria-label]="'composer.send' | transloco"
          [disabled]="!canSend()"
        >
          <app-icon name="sendFilled" />
        </button>
      </div>
    </form>
  `,
})
export class Composer {
  /** Names the text box for assistive technology and shows as its placeholder. */
  readonly label = input.required<string>();
  readonly text = model('');
  /** While a send is in flight: the text stays as it is and can't be sent again. */
  readonly busy = input(false, { transform: booleanAttribute });
  /** The text to send, trimmed; never blank. */
  readonly send = output<string>();

  protected readonly canSend = computed(() => !this.busy() && this.text().trim() !== '');

  private readonly injector = inject(Injector);
  private readonly textarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('textarea');

  /** Moves focus into the text box, e.g. when the pane it belongs to opens. */
  focus(): void {
    this.textarea().nativeElement.focus();
  }

  /** Puts [emoji] in place of the selection, with the caret after it and focus back in the text box. */
  protected insert(emoji: string): void {
    const textarea = this.textarea().nativeElement;
    if (this.busy()) {
      return;
    }
    const { selectionStart, selectionEnd, value } = textarea;
    textarea.value = value.slice(0, selectionStart) + emoji + value.slice(selectionEnd);
    this.text.set(textarea.value);
    const caret = selectionStart + emoji.length;
    textarea.focus();
    // After the text binding has written the new value, which may move the caret to the end.
    afterNextRender(() => textarea.setSelectionRange(caret, caret), { injector: this.injector });
  }

  protected enter(event: Event): void {
    // An Enter that confirms an IME composition isn't meant to send.
    if (!(event as KeyboardEvent).isComposing) {
      this.submit(event);
    }
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.canSend()) {
      this.send.emit(this.text().trim());
    }
  }
}
