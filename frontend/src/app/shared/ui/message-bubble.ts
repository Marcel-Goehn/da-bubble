import { booleanAttribute, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { DateFormatOptions, TranslocoDatePipe } from '@jsverse/transloco-locale';
import { Presence } from '../../core/data/presence.store';
import { Avatar } from './avatar';

/**
 * One Message as the Figma draws it (component sheets 48. and 49.): Avatar, author name, time and the
 * speech bubble. Others' Messages sit on the left, the User's own mirror to the right in the accent colour.
 */
@Component({
  selector: 'app-message-bubble',
  imports: [Avatar, TranslocoDatePipe, TranslocoPipe],
  host: { class: 'flex gap-20 px-16 py-10 lg:px-45', '[class.flex-row-reverse]': 'own()' },
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
    <div class="flex min-w-0 flex-col gap-8" [class.items-end]="own()">
      <p class="flex items-baseline gap-20" [class.flex-row-reverse]="own()">
        <span class="font-bold">{{ authorName() }}</span>
        <time class="text-14 text-text-muted" [attr.datetime]="createdAt()">
          {{ 'message.time' | transloco: { time: createdAt() | translocoDate: timeFormat } }}
        </time>
      </p>
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
    </div>
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
  /** Whether the logged-in User wrote it. */
  readonly own = input(false, { transform: booleanAttribute });

  protected readonly timeFormat: DateFormatOptions = { timeStyle: 'short' };
}
