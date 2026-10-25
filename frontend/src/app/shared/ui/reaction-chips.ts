import {
  booleanAttribute,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { translateSignal, TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Language, locales } from '../../core/i18n/i18n.providers';

/** One emoji's Reactions on a Message, as the chips show them. */
export interface ReactionView {
  emoji: string;
  /** Whether the logged-in User reacted with it. */
  mine: boolean;
  /** The names of everyone else who reacted with it, in the order they did. */
  others: string[];
}

/** How many chips show before "+X weitere": in a wide pane, and in a Thread or on mobile. */
const wideCap = 20;
const compactCap = 7;

let nextId = 0;

/**
 * A Message's Reactions as chips (component sheet 50.): the emoji and its count, pressed for the User's own
 * Reaction, with a tooltip saying who reacted. Clicking a chip adds or removes the User's Reaction. Long lists
 * collapse behind "+X weitere": after 20 chips, or after 7 (in two rows) in a Thread and on mobile.
 */
@Component({
  selector: 'app-reaction-chips',
  imports: [TranslocoPipe],
  // Collapsed to 7, the chips and "+X weitere" fill two rows of four.
  host: {
    class: 'gap-8',
    '[class]':
      "compact() ? 'grid w-max grid-cols-4' : 'flex flex-wrap max-lg:grid max-lg:w-max max-lg:grid-cols-4'",
  },
  template: `
    @for (reaction of reactions(); track reaction.emoji; let index = $index) {
      @if (expanded() || index < cap()) {
        <span
          class="group/chip relative"
          [class.max-lg:hidden]="!expanded() && !compact() && index >= compactCap"
        >
          <button
            type="button"
            class="flex items-center gap-10 rounded-20 border border-border bg-surface px-10 py-4 text-16 hover:border-border-hover"
            [class.border-border-focus]="reaction.mine"
            [attr.aria-pressed]="reaction.mine"
            [attr.aria-describedby]="tooltipId(index)"
            (click)="toggled.emit(reaction.emoji)"
          >
            <span>{{ reaction.emoji }}</span>
            <!-- A space in the chip's name between the two. -->
            &ngsp;<span>{{ reaction.others.length + (reaction.mine ? 1 : 0) }}</span>
          </button>
          <!-- Shown on hover and keyboard focus; the names and verb describe the chip. -->
          <span
            class="invisible absolute bottom-full left-1/2 z-10 mb-4 flex w-max max-w-200 -translate-x-1/2 flex-col items-center rounded-30 rounded-bl-none bg-accent px-15 py-10 text-center text-16 text-text-inverse group-focus-within/chip:visible group-hover/chip:visible"
          >
            <span class="text-24" aria-hidden="true">{{ reaction.emoji }}</span>
            <span class="flex flex-col" role="tooltip" [id]="tooltipId(index)">
              <span class="font-bold">{{ who(reaction) }}</span>
              &ngsp;<span>
                @if (reaction.others.length === 0) {
                  {{ 'reactions.reactedYou' | transloco }}
                } @else if (reaction.others.length === 1 && !reaction.mine) {
                  {{ 'reactions.reactedOne' | transloco }}
                } @else {
                  {{ 'reactions.reactedMany' | transloco }}
                }
              </span>
            </span>
          </span>
        </span>
      }
    }
    @if (!expanded()) {
      @if (reactions().length > compactCap) {
        <button
          type="button"
          class="rounded-20 px-10 py-4 text-16 text-interactive hover:bg-hover"
          [class.lg:hidden]="!compact()"
          (click)="expanded.set(true)"
        >
          {{ 'reactions.more' | transloco: { count: reactions().length - compactCap } }}
        </button>
      }
      @if (!compact() && reactions().length > wideCap) {
        <button
          type="button"
          class="rounded-20 px-10 py-4 text-16 text-interactive hover:bg-hover max-lg:hidden"
          (click)="expanded.set(true)"
        >
          {{ 'reactions.more' | transloco: { count: reactions().length - wideCap } }}
        </button>
      }
    } @else if (reactions().length > compactCap) {
      <button
        type="button"
        class="rounded-20 px-10 py-4 text-16 text-interactive hover:bg-hover"
        [class.lg:hidden]="!compact() && reactions().length <= wideCap"
        (click)="expanded.set(false)"
      >
        {{ 'reactions.less' | transloco }}
      </button>
    }
  `,
})
export class ReactionChips {
  readonly reactions = input.required<readonly ReactionView[]>();
  /** In a Thread: 7 chips before "+X weitere" at every width, not only on mobile. */
  readonly compact = input(false, { transform: booleanAttribute });
  /** A chip was clicked: the User's Reaction with this emoji is to be added or removed. */
  readonly toggled = output<string>();

  protected readonly expanded = signal(false);
  protected readonly compactCap = compactCap;
  protected readonly wideCap = wideCap;
  /** The most chips shown while collapsed; between 7 and 20 the mobile cut is the breakpoint's. */
  protected readonly cap = computed(() => (this.compact() ? compactCap : wideCap));

  private readonly lang = toSignal(inject(TranslocoService).langChanges$, { requireSync: true });
  private readonly you = translateSignal('reactions.you');
  private readonly youAlone = translateSignal('reactions.youAlone');
  private readonly id = `reactions-${nextId++}`;

  protected tooltipId(index: number): string {
    return `${this.id}-${index}`;
  }

  /** "Alan Turing und Du": the others first, then the User. */
  protected who(reaction: ReactionView): string {
    if (reaction.others.length === 0) {
      return this.youAlone();
    }
    const names = reaction.mine ? [...reaction.others, this.you()] : reaction.others;
    const locale = locales[this.lang() as Language];
    return new Intl.ListFormat(locale, { type: 'conjunction' }).format(names);
  }
}
