import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Button } from './button';
import { MentionField } from './mention-field';

/**
 * The text box a Message is edited in, in place of its bubble (page 13., component sheet 60B.): Speichern
 * or Enter saves, Abbrechen or Escape cancels. It takes focus when it opens. Mentions are offered as in
 * the composer.
 */
@Component({
  selector: 'app-message-editor',
  imports: [Button, MentionField, TranslocoPipe],
  template: `
    <form
      class="flex flex-col gap-20 rounded-20 border border-border bg-surface p-20 hover:border-border-hover has-[textarea:focus-visible]:border-border-focus"
      (submit)="submit($event)"
    >
      <app-mention-field
        position="below"
        [rows]="3"
        [label]="'message.edit' | transloco"
        [busy]="busy()"
        [text]="draft()"
        (textChange)="typed.set($event)"
        (enterPressed)="enter($event)"
        (escapePressed)="cancelled.emit()"
      />
      <div class="flex justify-end gap-20">
        <button appButton="secondary" type="button" (click)="cancelled.emit()">
          {{ 'message.cancel' | transloco }}
        </button>
        <button appButton type="submit" [disabled]="!canSave()">
          {{ 'message.save' | transloco }}
        </button>
      </div>
    </form>
  `,
})
export class MessageEditor {
  /** The Message's text as it is. */
  readonly text = input.required<string>();
  /** While a save is in flight: the text stays as it is and can't be saved again. */
  readonly busy = input(false, { transform: booleanAttribute });
  /** The new text, trimmed; never blank. TODO(#66): may be blank when the Message has Attachments. */
  readonly saved = output<string>();
  readonly cancelled = output();

  // Follows the Message's text until the User types, so a live edit from another tab doesn't wipe theirs.
  protected readonly typed = signal<string | null>(null);
  protected readonly draft = computed(() => this.typed() ?? this.text());
  protected readonly canSave = computed(() => !this.busy() && this.draft().trim() !== '');

  private readonly field = viewChild.required(MentionField);

  constructor() {
    afterNextRender(() => this.field().focus({ atEnd: true }));
  }

  protected enter(event: KeyboardEvent): void {
    // Shift+Enter starts a new line; an Enter that confirms an IME composition isn't meant to save.
    if (!event.shiftKey && !event.isComposing) {
      this.submit(event);
    }
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.canSave()) {
      this.saved.emit(this.draft().trim());
    }
  }
}
