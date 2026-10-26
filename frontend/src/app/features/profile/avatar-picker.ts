import { Menu, MenuContent, MenuItem, MenuTrigger } from '@angular/aria/menu';
import { NgOptimizedImage } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  avatarTypes,
  avatarUrl,
  predefinedAvatars,
  predefinedAvatarUrl,
} from '../../core/data/avatars';
import {
  AvatarUploadError,
  AvatarUploadFailure,
  PredefinedAvatar,
  UserStore,
} from '../../core/data/user.store';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';

/** The Avatar the User has picked or uploaded in the form, not yet saved. */
export type AvatarDraft =
  { kind: 'predefined'; avatar: PredefinedAvatar } | { kind: 'upload'; id: number; url: string };

type AvatarMenuItem = 'upload' | 'choose' | 'remove';

const itemClasses =
  'flex cursor-pointer items-center gap-15 rounded-full px-20 py-10 outline-none hover:bg-hover hover:text-menu-active data-[active=true]:bg-hover data-[active=true]:text-menu-active';

// A popover beside the Avatar on desktop, a sheet at the bottom on mobile, like the user menu.
const panelClasses =
  'z-10 bg-surface p-20 text-18 shadow-overlay max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:rounded-t-30 max-lg:shadow-overlay-up lg:absolute lg:top-1/2 lg:left-full lg:ml-10 lg:w-282 lg:rounded-20';

function dragsFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes('Files') ?? false;
}

/**
 * The logged-in User's Avatar as the control that changes it (variant C). Clicking it opens a menu to upload a
 * photo, choose one of the 6 predefined Avatars or remove an uploaded one; a picture can also be dropped on
 * it. An upload shows a progress ring and a refused one a red pill. The choice is only a [draft] until the
 * form saves it; an unsaved upload expires on the server.
 */
@Component({
  selector: 'app-avatar-picker',
  imports: [
    Avatar,
    Icon,
    Menu,
    MenuContent,
    MenuItem,
    MenuTrigger,
    NgOptimizedImage,
    TranslocoPipe,
  ],
  template: `
    <div class="flex flex-col items-center gap-15">
      <div class="relative">
        <button
          ngMenuTrigger
          #trigger
          type="button"
          class="relative block rounded-full outline-offset-4"
          [class]="dragging() ? 'outline-4 outline-border-focus outline-dashed' : ''"
          [menu]="menu"
          [attr.aria-label]="'profile.avatar.change' | transloco"
          (click)="listOpen.set(false)"
          (dragenter)="dragEnter($event)"
          (dragover)="dragOver($event)"
          (dragleave)="dragLeave($event)"
          (drop)="drop($event)"
        >
          <app-avatar [src]="preview()" [name]="me().name" [size]="168" />
          <span
            aria-hidden="true"
            class="absolute right-8 bottom-8 flex size-44 items-center justify-center rounded-full bg-accent text-text-inverse shadow-overlay"
          >
            <app-icon name="edit" />
          </span>
        </button>
        @if (progress() !== null) {
          <svg
            role="progressbar"
            class="pointer-events-none absolute -inset-6 -rotate-90"
            viewBox="0 0 100 100"
            aria-valuemin="0"
            aria-valuemax="100"
            [attr.aria-valuenow]="percent()"
            [attr.aria-label]="'profile.avatar.uploading' | transloco"
          >
            <circle cx="50" cy="50" r="48" fill="none" stroke-width="3" class="stroke-hover" />
            <circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke-width="3"
              pathLength="100"
              class="stroke-accent"
              [attr.stroke-dasharray]="percent() + ' 100'"
            />
          </svg>
        }
        @if (dragging()) {
          <span
            class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-accent/70 p-20 text-center font-bold text-text-inverse"
          >
            {{ 'profile.avatar.drop' | transloco }}
          </span>
        }

        <div
          ngMenu
          #menu="ngMenu"
          [class]="panelClasses + ' flex flex-col gap-5'"
          [attr.aria-label]="'profile.avatar.change' | transloco"
          [hidden]="!menu.visible()"
          (itemSelected)="select($event)"
        >
          <ng-template ngMenuContent>
            <div ngMenuItem value="upload" [class]="itemClasses">
              <app-icon name="upload" />
              {{ 'profile.avatar.upload' | transloco }}
            </div>
            <div ngMenuItem value="choose" [class]="itemClasses">
              <app-icon name="face" />
              {{ 'profile.avatar.choose' | transloco }}
            </div>
            @if (uploaded()) {
              <div ngMenuItem value="remove" [class]="itemClasses">
                <app-icon name="delete" />
                {{ 'profile.avatar.remove' | transloco }}
              </div>
            }
          </ng-template>
        </div>

        @if (listOpen()) {
          <fieldset role="radiogroup" [class]="panelClasses" #list>
            <legend class="float-left mb-15 font-bold">
              {{ 'profile.avatar.choose' | transloco }}
            </legend>
            <div class="clear-left grid grid-cols-3 justify-items-center gap-15">
              @for (avatar of avatars; track avatar; let n = $index) {
                <label
                  class="cursor-pointer rounded-full ring-avatar-ring-hover hover:ring-4 has-checked:ring-4 has-checked:ring-avatar-ring-selected has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-border-focus"
                >
                  <input
                    class="sr-only"
                    type="radio"
                    name="profile-avatar"
                    [value]="avatar"
                    [checked]="chosen() === avatar"
                    (change)="draft.set({ kind: 'predefined', avatar })"
                    (click)="clicked($event)"
                    (keydown.escape)="closeList($event)"
                  />
                  <img
                    class="size-64 rounded-full"
                    [ngSrc]="predefinedAvatarUrl(avatar)"
                    width="64"
                    height="64"
                    [alt]="'avatarStep.avatar' | transloco: { number: n + 1 }"
                  />
                </label>
              }
            </div>
          </fieldset>
        }
        <input
          #picker
          type="file"
          [accept]="accept"
          hidden
          [attr.aria-label]="'profile.avatar.upload' | transloco"
          (change)="pick(picker)"
        />
      </div>

      @if (uploadError(); as error) {
        <p
          role="alert"
          class="flex items-center gap-10 rounded-full bg-danger py-8 pr-8 pl-15 text-14 text-text-inverse"
        >
          <app-icon name="error" />
          <span>
            @switch (error.reason) {
              @case ('tooLarge') {
                {{ 'profile.avatar.errors.tooLarge' | transloco: { name: error.name } }}
              }
              @case ('unsupported') {
                {{ 'profile.avatar.errors.unsupported' | transloco: { name: error.name } }}
              }
              @case ('failed') {
                {{ 'profile.avatar.errors.failed' | transloco: { name: error.name } }}
              }
            }
          </span>
          <button
            type="button"
            class="flex shrink-0 rounded-full p-4 hover:bg-error"
            [attr.aria-label]="'profile.avatar.dismissError' | transloco"
            (click)="uploadError.set(null)"
          >
            <app-icon name="close" />
          </button>
        </p>
      } @else {
        <p class="text-center text-14 text-text-muted">
          <span class="max-lg:hidden">{{ 'profile.avatar.hint' | transloco }} · </span>
          {{ 'profile.avatar.formats' | transloco }}
        </p>
      }
    </div>
  `,
})
export class AvatarPicker {
  private readonly users = inject(UserStore);
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly picker = viewChild.required<ElementRef<HTMLInputElement>>('picker');
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  protected readonly itemClasses = itemClasses;
  protected readonly panelClasses = panelClasses;
  protected readonly avatars = predefinedAvatars;
  protected readonly predefinedAvatarUrl = predefinedAvatarUrl;
  protected readonly accept = avatarTypes.join(',');

  // The shell's guard has loaded the User.
  protected readonly me = computed(() => this.users.me()!);

  readonly draft = model<AvatarDraft | null>(null);
  protected readonly preview = computed(() => {
    const draft = this.draft();
    if (draft === null) {
      return avatarUrl(this.me());
    }
    return draft.kind === 'upload' ? draft.url : predefinedAvatarUrl(draft.avatar);
  });
  /** Whether the Avatar shown is an uploaded one, which "Foto entfernen" removes. */
  protected readonly uploaded = computed(() => {
    const draft = this.draft();
    return draft === null ? this.me().uploadedAvatarUrl !== null : draft.kind === 'upload';
  });
  /** The predefined Avatar shown, checked in the list. */
  protected readonly chosen = computed(() => {
    const draft = this.draft();
    return draft === null ? this.me().avatar : draft.kind === 'predefined' ? draft.avatar : null;
  });

  /** How much of the upload has arrived, from 0 to 1; `null` while nothing uploads. */
  protected readonly progress = signal<number | null>(null);
  /** Whether a picture is uploading, which holds off saving. */
  readonly uploading = computed(() => this.progress() !== null);
  protected readonly percent = computed(() => Math.round((this.progress() ?? 0) * 100));
  protected readonly uploadError = signal<{ reason: AvatarUploadError; name: string } | null>(null);
  protected readonly listOpen = signal(false);
  protected readonly dragging = signal(false);
  /** Counts the elements the files are over, as entering a child comes before leaving its parent. */
  private dragDepth = 0;
  /** Tells the latest upload apart; an earlier one still running is ignored once it ends. */
  private uploadCount = 0;

  protected select(item: AvatarMenuItem | undefined): void {
    switch (item) {
      case 'upload':
        this.picker().nativeElement.click();
        break;
      case 'choose':
        this.listOpen.set(true);
        this.afterRender(() => {
          const radios = this.list()?.nativeElement.querySelectorAll('input');
          const checked = Array.from(radios ?? []).find((radio) => radio.checked);
          (checked ?? radios?.[0])?.focus();
        });
        break;
      case 'remove':
        this.draft.set({ kind: 'predefined', avatar: predefinedAvatars[0] });
        break;
    }
  }

  /** A pointer click on an Avatar in the list picks it and closes the list; arrow keys only move. */
  protected clicked(event: MouseEvent): void {
    if (event.detail > 0) {
      this.listOpen.set(false);
      this.trigger().nativeElement.focus();
    }
  }

  /** Closes the list back onto the Avatar, and keeps Escape from closing the whole dialog. */
  protected closeList(event: Event): void {
    event.stopPropagation();
    this.listOpen.set(false);
    this.trigger().nativeElement.focus();
  }

  protected pick(input: HTMLInputElement): void {
    const file = input.files?.[0];
    // Cleared, so picking the same file again uploads it again.
    input.value = '';
    if (file) {
      void this.upload(file);
    }
  }

  protected dragEnter(event: DragEvent): void {
    if (dragsFiles(event)) {
      this.dragDepth++;
      this.dragOver(event);
    }
  }

  protected dragOver(event: DragEvent): void {
    if (!dragsFiles(event)) {
      return;
    }
    // Otherwise the browser opens a file dropped here in place of the app.
    event.preventDefault();
    this.dragging.set(true);
    event.dataTransfer!.dropEffect = 'copy';
  }

  protected dragLeave(event: DragEvent): void {
    if (dragsFiles(event)) {
      this.dragDepth = Math.max(0, this.dragDepth - 1);
      this.dragging.set(this.dragDepth > 0);
    }
  }

  protected drop(event: DragEvent): void {
    this.dragDepth = 0;
    this.dragging.set(false);
    if (!dragsFiles(event)) {
      return;
    }
    event.preventDefault();
    const file = event.dataTransfer!.files[0];
    if (file) {
      void this.upload(file);
    }
  }

  private async upload(file: File): Promise<void> {
    const count = ++this.uploadCount;
    const latest = () => count === this.uploadCount;
    this.uploadError.set(null);
    this.progress.set(0);
    try {
      const upload = await this.users.uploadAvatar(file, (fraction) => {
        if (latest()) {
          this.progress.set(fraction);
        }
      });
      if (latest()) {
        this.draft.set({ kind: 'upload', id: upload.id, url: upload.url });
      }
    } catch (error) {
      if (latest()) {
        const reason = error instanceof AvatarUploadFailure ? error.reason : 'failed';
        this.uploadError.set({ reason, name: file.name });
      }
    } finally {
      if (latest()) {
        this.progress.set(null);
      }
    }
  }

  private afterRender(action: () => void): void {
    afterNextRender(action, { injector: this.injector });
  }
}
