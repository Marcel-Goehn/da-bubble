import { Menu, MenuContent, MenuItem, MenuTrigger } from '@angular/aria/menu';
import {
  afterRenderEffect,
  booleanAttribute,
  Component,
  computed,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { DateFormatOptions, TranslocoDatePipe } from '@jsverse/transloco-locale';
import { Presence } from '../../core/data/presence.store';
import { Avatar } from './avatar';
import { Icon } from './icon';
import { MessageEditor } from './message-editor';

type MessageAction = 'edit' | 'delete';

const itemClasses =
  'cursor-pointer rounded-full px-20 py-8 whitespace-nowrap outline-none hover:bg-hover hover:text-menu-active data-[active=true]:bg-hover data-[active=true]:text-menu-active';

/**
 * One Message as the Figma draws it (component sheets 48. and 49.): Avatar, author name, time and the
 * speech bubble. Others' Messages sit on the left, the User's own mirror to the right in the accent colour.
 * The User's own Messages offer a ⋮ popover (sheets 52. and 76.) to edit them in place or delete them.
 * A Deleted Message keeps its place, author and time, with a dashed ghost in place of the bubble.
 */
@Component({
  selector: 'app-message-bubble',
  imports: [
    Avatar,
    Icon,
    Menu,
    MenuContent,
    MenuItem,
    MenuTrigger,
    MessageEditor,
    TranslocoDatePipe,
    TranslocoPipe,
  ],
  host: {
    class: 'group relative flex gap-20 px-16 py-10 hover:bg-hover lg:px-45',
    '[class.flex-row-reverse]': 'own()',
    '[class.bg-hover]': 'showsEditor()',
  },
  template: `
    <app-avatar
      class="max-lg:size-50!"
      [class.shadow-avatar]="own()"
      [class.rounded-full]="own()"
      [src]="avatarSrc()"
      [name]="authorName()"
      [presence]="presence()"
      [size]="70"
      decorative
    />
    <div
      class="flex min-w-0 flex-col gap-8"
      [class.flex-1]="showsEditor()"
      [class.items-end]="own()"
    >
      <p class="flex items-baseline gap-20" [class.flex-row-reverse]="own()">
        <button
          type="button"
          class="rounded-10 font-bold hover:text-interactive"
          (click)="authorSelected.emit()"
        >
          {{ authorName() }}
        </button>
        <span class="text-14 text-text-muted">
          <time [attr.datetime]="createdAt()">{{
            'message.time' | transloco: { time: createdAt() | translocoDate: timeFormat }
          }}</time>
          @if (edited() && !deleted()) {
            {{ 'message.edited' | transloco }}
          }
        </span>
      </p>
      @if (deleted()) {
        <!-- A ghost of the bubble: same corners, dashed outline, no fill. TODO(#58): keep its Thread link. -->
        <p
          class="flex items-center gap-10 rounded-30 border border-dashed border-border p-15 text-text-muted italic"
          [class]="own() ? 'rounded-tr-none' : 'rounded-tl-none'"
        >
          <app-icon name="block" />
          {{ 'message.deleted' | transloco }}
        </p>
      } @else if (showsEditor()) {
        <app-message-editor
          class="self-stretch"
          [text]="text()"
          [busy]="saving()"
          (saved)="editSaved.emit($event)"
          (cancelled)="editCancelled.emit()"
        />
      } @else {
        <p
          class="rounded-30 p-15 break-words whitespace-pre-wrap"
          [class]="
            own()
              ? 'rounded-tr-none bg-bubble-own text-text-inverse'
              : 'rounded-tl-none bg-bubble-other'
          "
        >
          {{ text() }}
        </p>
      }
    </div>

    @if (hasActions()) {
      <!-- Shown on hover, and while focus is in it, so it's reachable by keyboard. -->
      <div
        class="absolute top-0 -translate-y-1/2 rounded-25 border border-border bg-surface px-10 py-4 opacity-0 group-hover:opacity-100 focus-within:opacity-100"
        [class]="
          own() ? 'left-16 rounded-bl-none lg:left-45' : 'right-16 rounded-br-none lg:right-45'
        "
      >
        <button
          ngMenuTrigger
          type="button"
          class="flex rounded-20 p-4 hover:bg-hover hover:text-interactive"
          [attr.aria-label]="'message.actions' | transloco"
          [menu]="menu"
          #trigger
        >
          <app-icon name="moreVert" />
        </button>
        <div
          ngMenu
          #menu="ngMenu"
          class="absolute top-full z-10 mt-4 flex flex-col gap-4 rounded-30 bg-surface p-10 text-18 shadow-overlay"
          [class]="own() ? 'left-0 rounded-tl-none' : 'right-0 rounded-tr-none'"
          [attr.aria-label]="'message.actions' | transloco"
          [hidden]="!menu.visible()"
          (itemSelected)="select($event)"
        >
          <ng-template ngMenuContent>
            <div ngMenuItem value="edit" [class]="itemClasses">
              {{ 'message.edit' | transloco }}
            </div>
            <div ngMenuItem value="delete" [class]="itemClasses">
              {{ 'message.delete' | transloco }}
            </div>
          </ng-template>
        </div>
      </div>
    }
  `,
})
export class MessageBubble {
  readonly authorName = input.required<string>();
  /** The author's Avatar URL; `null` while they have none. */
  readonly avatarSrc = input.required<string | null>();
  readonly presence = input<Presence>();
  readonly text = input.required<string>();
  /** When the Message was sent, as an ISO instant. */
  readonly createdAt = input.required<string>();
  /** Whether its author changed its text after sending it. */
  readonly edited = input(false, { transform: booleanAttribute });
  /** Whether it's a Deleted Message, shown as a ghost of its bubble. */
  readonly deleted = input(false, { transform: booleanAttribute });
  /** Whether the logged-in User wrote it. */
  readonly own = input(false, { transform: booleanAttribute });
  /** Whether its text is being edited in place of the bubble. */
  readonly editing = input(false, { transform: booleanAttribute });
  /** While an edit is being saved. */
  readonly saving = input(false, { transform: booleanAttribute });
  /** The author's name was clicked, e.g. to open their profile card. */
  readonly authorSelected = output();
  /** "Nachricht bearbeiten" was chosen. */
  readonly editRequested = output();
  /** "Nachricht löschen" was chosen, with the ⋮ to return focus to; the owner confirms before deleting. */
  readonly deleteRequested = output<HTMLElement>();
  /** The edited text, trimmed. */
  readonly editSaved = output<string>();
  readonly editCancelled = output();

  /** A Deleted Message can't be edited, so its editor closes if it's deleted meanwhile. */
  protected readonly showsEditor = computed(() => this.editing() && !this.deleted());
  /** Only the author's own Messages have actions, and none once deleted or while editing. */
  protected readonly hasActions = computed(() => this.own() && !this.deleted() && !this.editing());
  protected readonly itemClasses = itemClasses;
  protected readonly timeFormat: DateFormatOptions = { timeStyle: 'short' };

  private readonly trigger = viewChild<ElementRef<HTMLElement>>('trigger');

  constructor() {
    // When the editor closes, focus goes back to the ⋮ it was opened from rather than to the page.
    let wasEditing = false;
    afterRenderEffect(() => {
      const showsEditor = this.showsEditor();
      if (wasEditing && !showsEditor) {
        this.trigger()?.nativeElement.focus();
      }
      wasEditing = showsEditor;
    });
  }

  protected select(action: MessageAction | undefined): void {
    switch (action) {
      case 'edit':
        this.editRequested.emit();
        break;
      case 'delete':
        this.deleteRequested.emit(this.trigger()!.nativeElement);
        break;
    }
  }
}
