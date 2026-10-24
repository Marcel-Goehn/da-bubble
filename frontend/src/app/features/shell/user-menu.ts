import { Menu, MenuContent, MenuItem, MenuTrigger } from '@angular/aria/menu';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import Keycloak from 'keycloak-js';
import { avatarUrl } from '../../core/data/avatars';
import { PresenceStore } from '../../core/data/presence.store';
import { UserStore } from '../../core/data/user.store';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';

type UserMenuItem = 'profile' | 'logout' | 'impressum' | 'datenschutz';

const itemClasses =
  'cursor-pointer rounded-full px-20 py-8 outline-none hover:bg-hover hover:text-menu-active data-[active=true]:bg-hover data-[active=true]:text-menu-active';

/**
 * The logged-in User's name and Avatar, opening Profil, Log out and the legal links. A popover below
 * the trigger on desktop, a sheet at the bottom on mobile.
 */
@Component({
  selector: 'app-user-menu',
  imports: [Avatar, Icon, Menu, MenuContent, MenuItem, MenuTrigger, TranslocoPipe],
  host: { class: 'relative' },
  template: `
    <button
      ngMenuTrigger
      type="button"
      class="flex items-center gap-20 rounded-full p-4 hover:text-interactive"
      [menu]="menu"
    >
      <!-- The name is the trigger's accessible name, so it stays for screen readers on mobile. -->
      <span class="text-32 font-bold max-lg:sr-only">{{ me().name }}</span>
      <app-avatar
        [src]="avatarUrl(me().avatar)"
        [name]="me().name"
        [size]="60"
        [presence]="presence.of(me().id)"
        decorative
      />
      <app-icon name="keyboardArrowDown" class="max-lg:hidden" />
    </button>

    <div
      ngMenu
      #menu="ngMenu"
      class="z-10 flex flex-col items-center gap-10 bg-surface p-30 text-20 shadow-overlay max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:rounded-t-30 max-lg:shadow-overlay-up lg:absolute lg:top-full lg:right-0 lg:mt-10 lg:w-282 lg:rounded-30 lg:rounded-tr-none lg:text-24"
      [attr.aria-label]="'userMenu.label' | transloco"
      [hidden]="!menu.visible()"
      (itemSelected)="select($event)"
    >
      <ng-template ngMenuContent>
        <div ngMenuItem value="profile" [class]="itemClasses">
          {{ 'userMenu.profile' | transloco }}
        </div>
        <div ngMenuItem value="logout" [class]="itemClasses">
          {{ 'userMenu.logout' | transloco }}
        </div>
        <div
          role="group"
          class="mt-10 flex items-center gap-5 text-16 text-text-muted"
          [attr.aria-label]="'legal.label' | transloco"
        >
          <div ngMenuItem value="impressum" [class]="itemClasses">
            {{ 'legal.impressum.title' | transloco }}
          </div>
          <span aria-hidden="true">·</span>
          <div ngMenuItem value="datenschutz" [class]="itemClasses">
            {{ 'legal.datenschutz.title' | transloco }}
          </div>
        </div>
      </ng-template>
    </div>
  `,
})
export class UserMenu {
  private readonly router = inject(Router);
  private readonly keycloak = inject(Keycloak);
  private readonly users = inject(UserStore);

  // The shell's guard has loaded the User.
  protected readonly me = computed(() => this.users.me()!);
  protected readonly presence = inject(PresenceStore);
  protected readonly avatarUrl = avatarUrl;
  protected readonly itemClasses = itemClasses;

  protected select(item: UserMenuItem | undefined): void {
    switch (item) {
      case 'profile':
        // TODO(#56): open the own profile view.
        break;
      case 'logout':
        void this.keycloak.logout({ redirectUri: `${window.location.origin}/` });
        break;
      case 'impressum':
      case 'datenschutz':
        void this.router.navigate(['/', item]);
        break;
    }
  }
}
