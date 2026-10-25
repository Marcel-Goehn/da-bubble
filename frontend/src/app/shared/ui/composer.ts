import {
  booleanAttribute,
  Component,
  computed,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { EmojiPickerButton } from './emoji-picker-button';
import { Icon } from './icon';
import { MentionField } from './mention-field';

/**
 * The text box Messages are written in (component sheets 61. and 63.). Enter sends, Shift+Enter starts a
 * new line. `@` and `#` mention a User or Channel from a picker, and the emoji button inserts an emoji from
 * the picker where the caret is. The text is a model, with Mentions as tokens, so the owner can keep it as a
 * draft; it's only cleared by the owner.
 */
@Component({
  selector: 'app-composer',
  imports: [EmojiPickerButton, Icon, MentionField, TranslocoPipe],
  template: `
    <form
      class="flex flex-col gap-20 rounded-20 border border-border bg-surface p-20 hover:border-border-hover has-[textarea:focus-visible]:border-border-focus"
      (submit)="submit($event)"
    >
      <app-mention-field
        [label]="label()"
        [placeholder]="label()"
        [busy]="busy()"
        [(text)]="text"
        (enterPressed)="enter($event)"
      />
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

  private readonly field = viewChild.required(MentionField);

  /** Moves focus into the text box, e.g. when the pane it belongs to opens. */
  focus(): void {
    this.field().focus();
  }

  /** Puts [emoji] in place of the selection, with the caret after it and focus back in the text box. */
  protected insert(emoji: string): void {
    this.field().insert(emoji);
  }

  protected enter(event: KeyboardEvent): void {
    // An Enter that confirms an IME composition isn't meant to send.
    if (!event.isComposing) {
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
