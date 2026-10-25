import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { avatarUrl } from '../../core/data/avatars';
import { ConversationStore } from '../../core/data/conversation.store';
import { PresenceStore } from '../../core/data/presence.store';
import { UserStore } from '../../core/data/user.store';
import { Avatar } from '../../shared/ui/avatar';
import { ChannelNamePipe } from '../../shared/ui/channel-name.pipe';
import { Icon } from '../../shared/ui/icon';
import { ChannelDialogs } from '../channel/channel-dialogs';

const rowClasses =
  'flex items-center gap-15 rounded-full px-20 py-4 hover:bg-hover hover:text-menu-active';
const activeRowClasses = 'bg-hover font-bold text-menu-active';

/** The Workspace menu: the User's Channels and DMs, each section collapsible. */
@Component({
  selector: 'app-sidebar',
  imports: [Avatar, ChannelNamePipe, Icon, RouterLink, RouterLinkActive, TranslocoPipe],
  host: { class: 'flex flex-col gap-25' },
  template: `
    <div class="flex items-center gap-15 max-lg:contents">
      <app-icon name="workspaces" class="size-40! text-accent max-lg:hidden" />
      <h2 class="text-24 font-bold max-lg:hidden">{{ 'workspace.name' | transloco }}</h2>
      <!-- On mobile it floats over the menu, as there is no header row there. -->
      <a
        routerLink="/new"
        class="ml-auto rounded-full max-lg:fixed max-lg:right-20 max-lg:bottom-20 max-lg:z-10 max-lg:bg-accent max-lg:p-15 max-lg:text-text-inverse max-lg:shadow-overlay max-lg:hover:bg-accent-hover lg:p-8 lg:hover:bg-hover lg:hover:text-interactive"
        [attr.aria-label]="'newMessage.title' | transloco"
      >
        <app-icon name="editSquare" />
      </a>
    </div>

    <section class="flex flex-col gap-10">
      <div class="flex items-center justify-between gap-10">
        <h2 class="text-20 font-bold">
          <button
            type="button"
            class="flex items-center gap-10 rounded-15 py-4 pr-10 hover:text-interactive"
            aria-controls="sidebar-channels"
            [attr.aria-expanded]="channelsOpen()"
            (click)="channelsOpen.set(!channelsOpen())"
          >
            <app-icon name="arrowDropDown" [class.-rotate-90]="!channelsOpen()" />
            <app-icon name="workspaces" />
            {{ 'sidebar.channels' | transloco }}
          </button>
        </h2>
        <button
          type="button"
          class="rounded-full p-8 hover:bg-hover hover:text-interactive"
          [attr.aria-label]="'sidebar.createChannel' | transloco"
          (click)="channelDialogs.openCreate()"
        >
          <app-icon name="add" />
        </button>
      </div>
      <ul
        id="sidebar-channels"
        class="flex flex-col gap-5 pl-25"
        [attr.aria-label]="'sidebar.channels' | transloco"
        [hidden]="!channelsOpen()"
      >
        @for (channel of channels(); track channel.id) {
          <li>
            <a
              [class]="rowClasses"
              [routerLink]="['/channel', channel.id]"
              [routerLinkActive]="activeRowClasses"
              ariaCurrentWhenActive="page"
            >
              <app-icon name="tag" />
              <span class="truncate">{{ channel | channelName }}</span>
            </a>
          </li>
        }
        <li>
          <button
            type="button"
            class="w-full"
            [class]="rowClasses"
            (click)="channelDialogs.openCreate()"
          >
            <app-icon name="addCircle" />
            {{ 'sidebar.addChannel' | transloco }}
          </button>
        </li>
      </ul>
    </section>

    <section class="flex flex-col gap-10">
      <h2 class="text-20 font-bold">
        <button
          type="button"
          class="flex items-center gap-10 rounded-15 py-4 pr-10 hover:text-interactive"
          aria-controls="sidebar-direct-messages"
          [attr.aria-expanded]="directMessagesOpen()"
          (click)="directMessagesOpen.set(!directMessagesOpen())"
        >
          <app-icon name="arrowDropDown" [class.-rotate-90]="!directMessagesOpen()" />
          <app-icon name="accountCircle" />
          {{ 'sidebar.directMessages' | transloco }}
        </button>
      </h2>
      <ul
        id="sidebar-direct-messages"
        class="flex flex-col gap-5 pl-25"
        [attr.aria-label]="'sidebar.directMessages' | transloco"
        [hidden]="!directMessagesOpen()"
      >
        @for (row of directMessages(); track row.id) {
          <li>
            <a
              [class]="rowClasses"
              [routerLink]="['/dm', row.partner.id]"
              [routerLinkActive]="activeRowClasses"
              ariaCurrentWhenActive="page"
            >
              <app-avatar
                [src]="avatarUrl(row.partner.avatar)"
                [name]="row.partner.name"
                [presence]="presence.of(row.partner.id)"
                decorative
              />
              <span class="truncate">
                @if (row.isSelf) {
                  {{ 'sidebar.selfDm' | transloco: { name: row.partner.name } }}
                } @else {
                  {{ row.partner.name }}
                }
              </span>
            </a>
          </li>
        }
      </ul>
    </section>
  `,
})
export class Sidebar {
  private readonly conversations = inject(ConversationStore);
  private readonly users = inject(UserStore);

  protected readonly presence = inject(PresenceStore);
  protected readonly channelDialogs = inject(ChannelDialogs);
  protected readonly rowClasses = rowClasses;
  protected readonly activeRowClasses = activeRowClasses;
  protected readonly avatarUrl = avatarUrl;
  protected readonly channelsOpen = signal(true);
  protected readonly directMessagesOpen = signal(true);
  protected readonly channels = this.conversations.channels;

  // A DM whose partner isn't loaded yet is left out rather than shown without a name.
  protected readonly directMessages = computed(() => {
    const me = this.users.me()?.id;
    return this.conversations.directMessages().flatMap((dm) => {
      const partner = dm.partnerId === null ? undefined : this.users.user(dm.partnerId);
      return partner ? [{ id: dm.id, partner, isSelf: partner.id === me }] : [];
    });
  });
}
