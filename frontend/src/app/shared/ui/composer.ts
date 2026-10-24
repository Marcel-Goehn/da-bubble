import { booleanAttribute, Component, computed, input, model, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from './icon';

/**
 * The text box Messages are written in (component sheets 61. and 63.). Enter sends, Shift+Enter starts a
 * new line. The text is a model, so the owner can keep it as a draft; it's only cleared by the owner.
 */
@Component({
  selector: 'app-composer',
  imports: [Icon, TranslocoPipe],
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
      <div class="flex justify-end">
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
