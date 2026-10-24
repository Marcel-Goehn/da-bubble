import { booleanAttribute, Component, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { avatarUrl } from '../../core/data/avatars';
import { UserDto } from '../../core/data/user.store';
import { Avatar } from '../../shared/ui/avatar';
import { ProfileCards } from '../profile/profile-cards';

/** The start of a DM (pages 12 A–E): the partner's Avatar and name, and who the DM is between. */
@Component({
  selector: 'app-dm-intro',
  imports: [Avatar, TranslocoPipe],
  host: { class: 'flex flex-col gap-20 px-16 py-20 lg:px-45' },
  template: `
    <p class="flex items-end gap-20 text-24 font-bold">
      <app-avatar
        [src]="avatarUrl(partner().avatar)"
        [name]="partner().name"
        [size]="100"
        decorative
      />
      @if (self()) {
        {{ 'sidebar.selfDm' | transloco: { name: partner().name } }}
      } @else {
        {{ partner().name }}
      }
    </p>
    @if (self()) {
      <p class="text-text-muted">
        <strong>{{ 'dmIntro.selfTitle' | transloco }}</strong>
        {{ 'dmIntro.selfText' | transloco }}
      </p>
    } @else {
      <p class="text-text-muted">
        {{ 'dmIntro.partnerBefore' | transloco }}
        <button
          type="button"
          class="rounded-10 text-interactive hover:text-interactive-hover hover:underline"
          (click)="profiles.open(partner().id)"
        >
          &#64;{{ partner().name }}
        </button>
        {{ 'dmIntro.partnerAfter' | transloco }}
      </p>
    }
  `,
})
export class DmIntro {
  readonly partner = input.required<UserDto>();
  /** Whether it's the User's self-DM. */
  readonly self = input(false, { transform: booleanAttribute });

  protected readonly avatarUrl = avatarUrl;
  protected readonly profiles = inject(ProfileCards);
}
