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
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { DateFormatOptions, TranslocoDatePipe } from '@jsverse/transloco-locale';
import { Presence } from '../../core/data/presence.store';
import { AttachmentDto } from '../../core/data/message.store';
import { AttachmentList, AttachmentOpening } from './attachment-list';
import { Avatar } from './avatar';
import { EmojiPickerButton } from './emoji-picker-button';
import { Icon } from './icon';
import { MessageEditor } from './message-editor';
import { MessageText } from './message-text';
import { ReactionChips, ReactionView } from './reaction-chips';

type MessageAction = 'edit' | 'delete';

const itemClasses =
  'cursor-pointer rounded-full px-20 py-8 whitespace-nowrap outline-none hover:bg-hover hover:text-menu-active data-[active=true]:bg-hover data-[active=true]:text-menu-active';

/**
 * One Message as the Figma draws it (component sheets 48. and 49.): Avatar, author name, time and the
 * speech bubble. Others' Messages sit on the left, the User's own mirror to the right in the accent colour.
 * The User's own Messages offer a ⋮ popover (sheets 52. and 76.) to edit them in place or delete them.
 * A Deleted Message keeps its place, author and time, with a dashed ghost in place of the bubble.
 * Attachments sit below the bubble; a Message with only Attachments has no bubble.
 * A Message that opens a Thread offers "Antworten" on hover (sheet 52.) and, once it has Replies, the
 * "N Antworten" link with the time of the last one (sheet 50.), which a Deleted Message keeps, and "N neu"
 * for its Unread Replies.
 */
@Component({
  selector: 'app-message-bubble',
  imports: [
    AttachmentList,
    Avatar,
    EmojiPickerButton,
    Icon,
    Menu,
    MenuContent,
    MenuItem,
    MenuTrigger,
    MessageEditor,
    MessageText,
    ReactionChips,
    RouterLink,
    TranslocoDatePipe,
    TranslocoPipe,
  ],
  host: {
    class: 'group/message relative flex gap-20 px-16 py-10 hover:bg-hover lg:px-45',
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
        <!-- A ghost of the bubble: same corners, dashed outline, no fill. -->
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
          [allowEmpty]="attachments().length > 0"
          (saved)="editSaved.emit($event)"
          (cancelled)="editCancelled.emit()"
        />
      } @else if (text() !== '') {
        <p
          class="rounded-30 p-15 break-words whitespace-pre-wrap"
          [class]="
            own()
              ? 'rounded-tr-none bg-bubble-own text-text-inverse'
              : 'rounded-tl-none bg-bubble-other'
          "
        >
          <!-- Spaced off the author line, as the text was before it had Mentions. -->
          &ngsp;<app-message-text
            [text]="text()"
            (userSelected)="mentionSelected.emit($event)"
          />&ngsp;
        </p>
      }
      @if (attachments().length > 0 && !deleted()) {
        <app-attachment-list
          [class.justify-end]="own()"
          [attachments]="attachments()"
          (opened)="attachmentOpened.emit($event)"
          (imageOpened)="imageOpened.emit($event)"
          (failed)="attachmentFailed.emit()"
        />
      }
      @if (reactions().length > 0 && !deleted()) {
        <app-reaction-chips
          [class.justify-end]="own()"
          [reactions]="reactions()"
          [compact]="compactReactions()"
          (toggled)="reactionToggled.emit($event)"
        />
      }
      @if (threadLink(); as threadLink) {
        @if (replyCount() > 0) {
          <a
            class="flex items-baseline gap-20 rounded-10 text-interactive hover:font-bold"
            [class.flex-row-reverse]="own()"
            [routerLink]="threadLink"
          >
            <span [class.font-bold]="unreadReplies() > 0">{{
              'thread.replyCount' | transloco: { count: replyCount() }
            }}</span>
            @if (unreadReplies() > 0) {
              &ngsp;<span class="flex items-center gap-6 text-14 font-bold text-danger"
                ><span class="size-8 rounded-full bg-danger"></span
                >{{ 'thread.unreadReplies' | transloco: { count: unreadReplies() } }}</span
              >
            }
            @if (lastReplyAt(); as lastReplyAt) {
              <!-- A space in the link's name between the two. -->
              &ngsp;<span class="text-14 text-text-muted">{{
                'thread.lastReply' | transloco: { time: lastReplyAt | translocoDate: timeFormat }
              }}</span>
            }
          </a>
        }
      }
    </div>

    @if (hasToolbar()) {
      <!-- Shown on hover, and while focus is in it, so it's reachable by keyboard. -->
      <div
        data-hover-bar
        class="absolute top-0 flex -translate-y-1/2 items-center gap-4 rounded-25 border border-border bg-surface px-10 py-4 opacity-0 group-hover/message:opacity-100 focus-within:opacity-100"
        [class.opacity-100]="picking()"
        [class]="
          own() ? 'left-16 rounded-bl-none lg:left-45' : 'right-16 rounded-br-none lg:right-45'
        "
      >
        @if (!deleted()) {
          @for (emoji of quickReactions; track emoji) {
            <button
              type="button"
              class="flex size-32 items-center justify-center rounded-20 hover:bg-hover"
              [attr.aria-label]="'reactions.quick' | transloco: { emoji }"
              (click)="reactionToggled.emit(emoji)"
            >
              {{ emoji }}
            </button>
          }
          <app-emoji-picker-button
            icon="addReaction"
            position="below"
            [label]="'reactions.add' | transloco"
            (picked)="reactionToggled.emit($event)"
          />
        }
        @if (threadLink(); as threadLink) {
          <a
            class="flex rounded-20 p-4 hover:bg-hover hover:text-interactive"
            [routerLink]="threadLink"
            [attr.aria-label]="'thread.reply' | transloco"
          >
            <app-icon name="comment" />
          </a>
        }
        @if (hasActions()) {
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
        }
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
  /** How many Replies its Thread has. */
  readonly replyCount = input(0);
  /** How many Replies in its Thread are Unread, shown as "N neu". */
  readonly unreadReplies = input(0);
  /** When the last Reply in its Thread was sent, as an ISO instant; `null` without one. */
  readonly lastReplyAt = input<string | null>(null);
  /** Where its Thread opens, as router link commands; `null` for one that has none here, such as a Reply. */
  readonly threadLink = input<readonly unknown[] | null>(null);
  /** Its Attachments, in the order they were sent. */
  readonly attachments = input<readonly AttachmentDto[]>([]);
  /** Its Reactions, one entry per emoji. */
  readonly reactions = input<readonly ReactionView[]>([]);
  /** Whether long Reaction lists collapse after 7 at every width, as in a Thread. */
  readonly compactReactions = input(false, { transform: booleanAttribute });
  /** While an edit is being saved. */
  readonly saving = input(false, { transform: booleanAttribute });
  /** The author's name was clicked, e.g. to open their profile card. */
  readonly authorSelected = output();
  /** An `@` Mention of the User with this id was clicked. */
  readonly mentionSelected = output<string>();
  /** "Nachricht bearbeiten" was chosen. */
  readonly editRequested = output();
  /** "Nachricht löschen" was chosen, with the ⋮ to return focus to; the owner confirms before deleting. */
  readonly deleteRequested = output<HTMLElement>();
  /** The edited text, trimmed. */
  readonly editSaved = output<string>();
  readonly editCancelled = output();
  /** An Attachment is to be opened in a new tab or downloaded. */
  readonly attachmentOpened = output<AttachmentOpening>();
  /** An image of its Attachments is to be shown in the lightbox. */
  readonly imageOpened = output<AttachmentDto>();
  /** An image of its Attachments didn't load, e.g. because its URL has expired. */
  readonly attachmentFailed = output();
  /** The User's Reaction with this emoji is to be added, or removed if they've reacted with it. */
  readonly reactionToggled = output<string>();

  /** A Deleted Message can't be edited, so its editor closes if it's deleted meanwhile. */
  protected readonly showsEditor = computed(() => this.editing() && !this.deleted());
  /** Only the author's own Messages have actions, and none once deleted or while editing. */
  protected readonly hasActions = computed(() => this.own() && !this.deleted() && !this.editing());
  /**
   * The hover toolbar: the quick reactions and the emoji picker, "Antworten" for a Message with a Thread, and
   * ⋮ for the author's actions. A Deleted Message can't be reacted to, but keeps its Thread.
   */
  protected readonly hasToolbar = computed(
    () => !this.editing() && (!this.deleted() || this.threadLink() !== null),
  );
  protected readonly quickReactions = ['✅', '👍'];
  protected readonly itemClasses = itemClasses;
  protected readonly timeFormat: DateFormatOptions = { timeStyle: 'short' };

  private readonly trigger = viewChild<ElementRef<HTMLElement>>('trigger');
  private readonly reactionPicker = viewChild(EmojiPickerButton);
  /** The toolbar stays while its emoji picker is open, even once the pointer has moved onto the picker. */
  protected readonly picking = computed(() => this.reactionPicker()?.open() ?? false);

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
