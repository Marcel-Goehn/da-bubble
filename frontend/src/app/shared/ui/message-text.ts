import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MentionDirectory } from '../../core/data/mention-directory';
import { renderMessageText } from '../../core/data/mentions';

/**
 * A Message's text with its Mentions under the current names. An `@` Mention is a button, e.g. to open the
 * User's profile card; a `#` Mention links to the Channel if the User is a Member and is plain text
 * otherwise.
 */
@Component({
  selector: 'app-message-text',
  imports: [RouterLink],
  // Every piece of text sits in an element, so the template's own whitespace never shows in the Message.
  template: `
    @for (part of parts(); track $index) {
      @if (part.kind === 'user') {
        <button
          type="button"
          class="rounded-10 font-bold hover:underline"
          (click)="userSelected.emit(part.id)"
        >
          <span>&#64;{{ part.name }}</span>
        </button>
      } @else if (part.kind === 'channel') {
        <a class="rounded-10 font-bold hover:underline" [routerLink]="['/channel', part.id]">
          <span>#{{ part.name }}</span>
        </a>
      } @else {
        <span>{{ part.text }}</span>
      }
    }
  `,
})
export class MessageText {
  private readonly directory = inject(MentionDirectory);

  readonly text = input.required<string>();
  /** An `@` Mention of the User with this id was clicked. */
  readonly userSelected = output<string>();

  protected readonly parts = computed(() => renderMessageText(this.text(), this.directory.lookup));
}
