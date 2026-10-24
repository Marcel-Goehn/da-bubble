import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import Keycloak from 'keycloak-js';
import { avatarUrl, predefinedAvatars } from '../../core/data/avatars';
import { ConversationStore } from '../../core/data/conversation.store';
import { PredefinedAvatar, UserStore } from '../../core/data/user.store';
import { Avatar } from '../../shared/ui/avatar';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';

/** How long "Konto erfolgreich erstellt!" shows before the User enters the Workspace. */
const createdOverlayMs = 1500;

/** Where a new User picks one of the predefined Avatars before entering the Workspace. */
@Component({
  selector: 'app-avatar-step',
  imports: [Avatar, Button, Icon, NgOptimizedImage, TranslocoPipe],
  template: `
    <div class="flex min-h-dvh flex-col">
      <header class="flex justify-center px-16 pt-40 md:justify-start md:px-75 md:pt-75">
        <div class="flex items-center gap-15">
          <img class="size-56 md:size-70" ngSrc="/logo-mark.svg" width="70" height="70" alt="" />
          <span class="text-32 font-bold">{{ 'app.name' | transloco }}</span>
        </div>
      </header>

      <main class="flex flex-1 flex-col items-center justify-center px-16 py-30">
        <section
          class="flex w-full max-w-606 flex-col items-center gap-20 rounded-30 bg-surface px-20 py-30 md:px-50 md:py-40"
          aria-labelledby="avatar-step-title"
        >
          <!-- Where the Figma's back arrow sits: there is no earlier step to go back to. -->
          <button
            type="button"
            class="flex items-center gap-8 self-start rounded-20 text-18 text-interactive hover:text-interactive-hover hover:underline"
            (click)="logout()"
          >
            <app-icon name="logout" />
            {{ 'avatarStep.logout' | transloco }}
          </button>
          <h1 id="avatar-step-title" class="text-center text-32 font-bold text-accent md:text-46">
            {{ 'avatarStep.title' | transloco }}
          </h1>
          <app-avatar [src]="preview()" [name]="me().name" [size]="168" />
          <p class="text-32 font-bold">{{ me().name }}</p>
          <fieldset role="radiogroup" class="flex w-full flex-col gap-20">
            <legend class="mb-20 text-18 md:text-20">
              {{ 'avatarStep.chooseFromList' | transloco }}
            </legend>
            <div class="flex flex-wrap justify-center gap-15 md:gap-20">
              @for (avatar of avatars; track avatar; let n = $index) {
                <label
                  class="cursor-pointer rounded-full ring-avatar-ring-hover hover:ring-4 has-checked:ring-4 has-checked:ring-avatar-ring-selected has-focus-visible:outline-2 has-focus-visible:outline-offset-8 has-focus-visible:outline-border-focus"
                >
                  <input
                    class="sr-only"
                    type="radio"
                    name="avatar"
                    [value]="avatar"
                    [checked]="selected() === avatar"
                    (change)="selected.set(avatar)"
                  />
                  <img
                    class="size-64 rounded-full"
                    [ngSrc]="avatarUrl(avatar)"
                    width="64"
                    height="64"
                    [alt]="'avatarStep.avatar' | transloco: { number: n + 1 }"
                  />
                </label>
              }
            </div>
          </fieldset>
          <div class="flex w-full justify-end">
            <button
              appButton
              type="button"
              [disabled]="selected() === null || saving()"
              (click)="save()"
            >
              {{ 'avatarStep.continue' | transloco }}
            </button>
          </div>
        </section>
      </main>

      <!-- Present from the start: a live region only announces content added to it later. -->
      <div
        role="status"
        class="pointer-events-none fixed inset-x-16 bottom-40 flex justify-center md:inset-x-auto md:right-0"
      >
        @if (created()) {
          <p
            class="rounded-30 bg-accent px-40 py-30 text-24 font-bold text-text-inverse shadow-overlay motion-safe:animate-slide-in md:rounded-r-none md:text-32"
          >
            {{ 'avatarStep.created' | transloco }}
          </p>
        }
      </div>
    </div>
  `,
})
export class AvatarStep {
  private readonly users = inject(UserStore);
  private readonly router = inject(Router);
  private readonly keycloak = inject(Keycloak);
  private readonly conversations = inject(ConversationStore);

  // The route's guard has loaded the User.
  protected readonly me = computed(() => this.users.me()!);
  protected readonly avatars = predefinedAvatars;
  protected readonly avatarUrl = avatarUrl;
  protected readonly selected = signal<PredefinedAvatar | null>(null);
  protected readonly saving = signal(false);
  protected readonly created = signal(false);
  protected readonly preview = computed(() => avatarUrl(this.selected()));

  protected async save(): Promise<void> {
    // Stays set on success, so Weiter can't save twice while the overlay shows.
    this.saving.set(true);
    try {
      await this.users.setAvatar(this.selected()!);
    } catch (error) {
      this.saving.set(false);
      throw error;
    }
    this.created.set(true);
    // The sidebar loads while the overlay shows; it holds the Default Channel to land in.
    const loaded = this.conversations.load().catch(() => undefined);
    setTimeout(() => {
      void loaded.then(() => {
        const landing = this.conversations.defaultChannel();
        void this.router.navigate(landing ? ['/channel', landing.id] : ['/']);
      });
    }, createdOverlayMs);
  }

  protected logout(): void {
    void this.keycloak.logout({ redirectUri: `${window.location.origin}/` });
  }
}
