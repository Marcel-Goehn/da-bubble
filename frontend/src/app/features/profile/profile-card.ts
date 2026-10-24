import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { avatarUrl } from '../../core/data/avatars';
import { PresenceStore } from '../../core/data/presence.store';
import { UserStore } from '../../core/data/user.store';
import { Avatar } from '../../shared/ui/avatar';
import { Button } from '../../shared/ui/button';
import { DialogFrame } from '../../shared/ui/dialog-frame';
import { Icon } from '../../shared/ui/icon';

export interface ProfileCardData {
  userId: string;
}

/**
 * A User's profile card (frames 65. and "Profile view main"): Avatar, name, Presence and email. Another
 * User's card offers "Nachricht", which opens the DM with them; the User's own has none.
 */
@Component({
  selector: 'app-profile-card',
  imports: [Avatar, Button, DialogFrame, Icon, TranslocoPipe],
  template: `
    <app-dialog-frame
      class="block w-[min(31rem,calc(100vw-2rem))]"
      [heading]="'profile.title' | transloco"
    >
      @if (user(); as user) {
        <div class="flex flex-col gap-30">
          <app-avatar
            class="self-center"
            [src]="avatarUrl(user.avatar)"
            [name]="user.name"
            [size]="168"
            decorative
          />
          <div class="flex flex-col gap-15">
            <h3 class="text-32 font-bold break-words">{{ user.name }}</h3>
            <p class="flex items-center gap-15 text-20 text-text-muted">
              <span
                aria-hidden="true"
                class="size-16 rounded-full"
                [class.bg-online]="online()"
                [class.bg-offline]="!online()"
              ></span>
              {{ (online() ? 'presence.online' : 'presence.offline') | transloco }}
            </p>
          </div>
          <div class="flex flex-col gap-15">
            <h4 class="flex items-center gap-20 text-20 font-bold">
              <app-icon name="mail" />
              {{ 'profile.email' | transloco }}
            </h4>
            @if (own()) {
              <p class="pl-45 break-all">{{ user.email }}</p>
            } @else {
              <a
                class="pl-45 break-all text-interactive hover:text-interactive-hover hover:underline"
                [href]="'mailto:' + user.email"
                >{{ user.email }}</a
              >
            }
          </div>
          @if (!own()) {
            <button appButton type="button" class="self-center" (click)="message(user.id)">
              <app-icon name="chatBubble" />
              {{ 'profile.message' | transloco }}
            </button>
          }
        </div>
      }
    </app-dialog-frame>
  `,
})
export class ProfileCard {
  private readonly data = inject<ProfileCardData>(DIALOG_DATA);
  private readonly users = inject(UserStore);
  private readonly presence = inject(PresenceStore);
  private readonly dialogRef = inject(DialogRef);
  private readonly router = inject(Router);

  protected readonly avatarUrl = avatarUrl;
  protected readonly user = computed(() => this.users.user(this.data.userId));
  protected readonly own = computed(() => this.data.userId === this.users.me()?.id);
  protected readonly online = computed(() => this.presence.of(this.data.userId) === 'online');

  /** Opens the DM with the User, which exists once it has a Message. */
  protected message(userId: string): void {
    this.dialogRef.close();
    void this.router.navigate(['/dm', userId]);
  }
}
