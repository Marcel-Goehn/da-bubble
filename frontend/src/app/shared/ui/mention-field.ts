import { Combobox, ComboboxPopup, ComboboxWidget } from '@angular/aria/combobox';
import { Listbox, Option } from '@angular/aria/listbox';
import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { avatarUrl } from '../../core/data/avatars';
import { MentionDirectory } from '../../core/data/mention-directory';
import {
  activeMentionQuery,
  Mention,
  MentionQuery,
  toDisplayText,
  toTokenText,
} from '../../core/data/mentions';
import { UserStore } from '../../core/data/user.store';
import { Avatar } from './avatar';
import { Icon } from './icon';

const sameQuery = (a: MentionQuery | null, b: MentionQuery | null) =>
  a === b || (a !== null && b !== null && a.start === b.start && a.query === b.query);

const optionKey = (mention: Mention) => `${mention.kind}:${mention.id}`;

/**
 * The text box Messages are written and edited in. Typing `@` or `#` opens a picker of Users or of the User's
 * own Channels, narrowed by what follows; the pick goes in as `@Name` or `#Name`. The text box shows Mentions
 * that way, while [text] holds them as tokens, as Messages are sent and stored.
 */
@Component({
  selector: 'app-mention-field',
  imports: [Avatar, Combobox, ComboboxPopup, ComboboxWidget, Icon, Listbox, Option, TranslocoPipe],
  host: { class: 'relative flex flex-col' },
  template: `
    <textarea
      ngCombobox
      #combobox="ngCombobox"
      class="resize-none bg-transparent outline-none placeholder:text-text-muted"
      autocomplete="off"
      [rows]="rows()"
      [attr.aria-label]="label()"
      [placeholder]="placeholder()"
      [value]="shown()"
      [readOnly]="busy()"
      [(expanded)]="expanded"
      (input)="typed()"
      (click)="followCaret()"
      (keyup)="followCaret()"
      (keydown.enter)="enter($event)"
      (keydown.escape)="escape()"
      #textarea
    ></textarea>
    <ng-template ngComboboxPopup [combobox]="combobox">
      <div
        ngComboboxWidget
        ngListbox
        #listbox="ngListbox"
        focusMode="activedescendant"
        selectionMode="explicit"
        class="absolute z-10 flex max-h-300 w-full flex-col gap-5 overflow-y-auto rounded-20 border border-border bg-surface p-10 shadow-overlay"
        [class]="position() === 'above' ? 'bottom-full mb-10' : 'top-full mt-10'"
        [activeDescendant]="listbox.activeDescendant()"
        [attr.aria-label]="
          (query()?.trigger === '#' ? 'mentions.channels' : 'mentions.users') | transloco
        "
        [hidden]="!expanded()"
        [value]="[]"
        (valueChange)="pick($event)"
      >
        @for (option of options(); track optionKey(option)) {
          <div
            ngOption
            class="flex cursor-pointer items-center gap-15 rounded-full px-20 py-4 hover:bg-hover aria-selected:bg-hover data-[active=true]:bg-hover"
            [value]="optionKey(option)"
            [label]="option.name"
          >
            @if (option.kind === 'user') {
              <app-avatar
                [src]="avatarUrl(users.user(option.id)?.avatar ?? null)"
                [name]="option.name"
                [size]="40"
                decorative
              />
            } @else {
              <app-icon name="tag" />
            }
            {{ option.name }}
          </div>
        }
      </div>
    </ng-template>
  `,
})
export class MentionField {
  private readonly directory = inject(MentionDirectory);
  protected readonly users = inject(UserStore);
  private readonly injector = inject(Injector);

  /** Names the text box for assistive technology. */
  readonly label = input.required<string>();
  readonly placeholder = input('');
  readonly rows = input(2);
  /** Where the picker opens: above the text box, as in the composer, or below it. */
  readonly position = input<'above' | 'below'>('above');
  /** While the text is being sent or saved: it stays as it is. */
  readonly busy = input(false, { transform: booleanAttribute });
  /** The text with its Mentions as tokens. */
  readonly text = model('');
  /** Enter was pressed other than to pick a Mention; Shift+Enter starts a new line and isn't reported. */
  readonly enterPressed = output<KeyboardEvent>();
  /** Escape was pressed other than to close the picker. */
  readonly escapePressed = output();

  protected readonly avatarUrl = avatarUrl;
  protected readonly optionKey = optionKey;
  protected readonly shown = computed(() => toDisplayText(this.text()).text);
  /** The Mention being typed, if the caret is in one. */
  protected readonly query = signal<MentionQuery | null>(null, { equal: sameQuery });
  protected readonly options = computed(() => {
    const query = this.query();
    return query ? this.directory.candidates(query.trigger, query.query) : [];
  });
  /** Open while there's something to offer, until Escape or leaving the text box closes it. */
  protected readonly expanded = linkedSignal(() => this.options().length > 0);

  /** Picked Mentions, kept so their `@Name` stays a Mention while the User types around it. */
  private readonly picked = signal<Mention[]>([]);
  private readonly textarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('textarea');
  /** Whether the picker was open when the key now being handled went down, before the combobox acts on it. */
  private openOnKeydown = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      // Ahead of the combobox, which would open the picker on ArrowDown rather than move the caret.
      const beforeCombobox = (event: KeyboardEvent) => {
        this.openOnKeydown = this.expanded();
        if (event.key === 'ArrowDown' && !this.openOnKeydown) {
          event.stopPropagation();
        }
      };
      host.addEventListener('keydown', beforeCombobox, { capture: true });
      destroyRef.onDestroy(() =>
        host.removeEventListener('keydown', beforeCombobox, { capture: true }),
      );
    });
  }

  /** Moves focus into the text box, with the caret at the end if [atEnd]. */
  focus({ atEnd = false } = {}): void {
    const textarea = this.textarea().nativeElement;
    textarea.focus();
    if (atEnd) {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  }

  /** Puts [text] in place of the selection, with the caret after it and focus back in the text box. */
  insert(text: string): void {
    if (this.busy()) {
      return;
    }
    const { selectionStart, selectionEnd, value } = this.textarea().nativeElement;
    this.replace(selectionStart, selectionEnd, value, text);
  }

  protected typed(): void {
    const { value } = this.textarea().nativeElement;
    const known = [...toDisplayText(this.text()).mentions, ...this.picked()];
    this.text.set(toTokenText(value, known));
    this.followCaret();
  }

  protected followCaret(): void {
    const { value, selectionStart, selectionEnd } = this.textarea().nativeElement;
    this.query.set(
      selectionStart === selectionEnd ? activeMentionQuery(value, selectionStart) : null,
    );
  }

  protected pick(keys: string[]): void {
    const query = this.query();
    const mention = this.options().find((option) => optionKey(option) === keys[0]);
    if (!query || !mention) {
      return;
    }
    this.picked.update((picked) => [...picked, mention]);
    const { value } = this.textarea().nativeElement;
    const end = query.start + 1 + query.query.length;
    this.replace(query.start, end, value, `${query.trigger}${mention.name} `);
  }

  protected enter(event: Event): void {
    // Angular types a key event binding's $event as a plain Event.
    const keyboardEvent = event as KeyboardEvent;
    if (this.openOnKeydown) {
      // The combobox picks the active option.
      keyboardEvent.preventDefault();
      return;
    }
    this.enterPressed.emit(keyboardEvent);
  }

  protected escape(): void {
    if (!this.openOnKeydown) {
      this.escapePressed.emit();
    }
  }

  /** Replaces [start]..[end] of the shown [value] with [inserted] and puts the caret after it. */
  private replace(start: number, end: number, value: string, inserted: string): void {
    const textarea = this.textarea().nativeElement;
    textarea.value = value.slice(0, start) + inserted + value.slice(end);
    const caret = start + inserted.length;
    textarea.focus();
    textarea.setSelectionRange(caret, caret);
    this.typed();
    // After the text binding has written the new value, which may move the caret to the end.
    afterNextRender(() => textarea.setSelectionRange(caret, caret), { injector: this.injector });
  }
}
