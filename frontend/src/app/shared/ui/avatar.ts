import { NgOptimizedImage } from '@angular/common';
import { booleanAttribute, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from './icon';

export type Presence = 'online' | 'offline';

/** The diameters the Figma uses for Avatars, in px. */
export type AvatarSize = 40 | 50 | 60 | 168;

const sizes: Record<AvatarSize, string> = {
  40: 'size-40',
  50: 'size-50',
  60: 'size-60',
  168: 'size-168',
};

/**
 * A User's Avatar as a circle, named by the User's name, with a grey silhouette while they have none. Given
 * a Presence, it shows the online / offline dot at the bottom right.
 */
@Component({
  selector: 'app-avatar',
  imports: [Icon, NgOptimizedImage, TranslocoPipe],
  host: { '[class]': 'classes()' },
  template: `
    @if (src(); as src) {
      <img
        class="size-full rounded-full object-cover"
        [ngSrc]="src"
        [width]="size()"
        [height]="size()"
        [alt]="decorative() ? '' : name()"
      />
    } @else {
      <span
        class="flex size-full items-center justify-center rounded-full bg-avatar-placeholder text-text-muted"
        [attr.role]="decorative() ? null : 'img'"
        [attr.aria-hidden]="decorative() ? 'true' : null"
        [attr.aria-label]="decorative() ? null : name()"
      >
        <app-icon name="personFilled" fillContainer />
      </span>
    }
    @if (presence(); as presence) {
      <span
        role="img"
        class="absolute right-0 bottom-0 size-14 rounded-full border-2 border-surface"
        [class.bg-online]="presence === 'online'"
        [class.bg-offline]="presence === 'offline'"
        [attr.aria-label]="
          (presence === 'online' ? 'presence.online' : 'presence.offline') | transloco
        "
      ></span>
    }
  `,
})
export class Avatar {
  /** The Avatar's URL; `null` while the User hasn't chosen one. */
  readonly src = input.required<string | null>();
  readonly name = input.required<string>();
  readonly size = input<AvatarSize>(50);
  readonly presence = input<Presence>();
  /** Hidden from assistive technology where the name is already next to it, e.g. in a sidebar row. */
  readonly decorative = input(false, { transform: booleanAttribute });

  protected readonly classes = computed(
    () => `relative inline-block shrink-0 ${sizes[this.size()]}`,
  );
}
