import { Component, computed, inject, output, signal, viewChild } from '@angular/core';
import { form, FormField, validate } from '@angular/forms/signals';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { UserStore } from '../../core/data/user.store';
import { ErrorService } from '../../core/errors/error.service';
import { Button } from '../../shared/ui/button';
import { Icon } from '../../shared/ui/icon';
import { fieldClasses } from '../channel/create-channel-dialog';
import { AvatarDraft, AvatarPicker } from './avatar-picker';

/** The most characters a name has, in code points after trimming, as the backend counts. */
const nameMaxLength = 50;

/**
 * "Dein Profil bearbeiten" (variant C): the Avatar, as the control that changes it, and the name. Nothing
 * changes until "Speichern".
 */
@Component({
  selector: 'app-profile-edit',
  imports: [AvatarPicker, Button, FormField, Icon, TranslocoPipe],
  template: `
    <form class="flex flex-col gap-30" novalidate (submit)="save($event)">
      <app-avatar-picker [(draft)]="draft" />

      <div class="flex flex-col gap-10">
        <label [for]="nameId" class="flex items-center gap-15 text-20 font-bold">
          <app-icon name="accountCircle" />
          {{ 'profile.name' | transloco }}
        </label>
        <div [class]="fieldClasses" [class.border-error!]="nameError()">
          <input
            [id]="nameId"
            class="min-w-0 flex-1 bg-transparent outline-none"
            autocomplete="name"
            [formField]="profile.name"
            [attr.aria-invalid]="nameError() !== undefined"
            [attr.aria-describedby]="nameError() ? nameErrorId : null"
          />
        </div>
        @switch (nameError()) {
          @case ('blank') {
            <p [id]="nameErrorId" class="text-14 text-error">
              {{ 'profile.nameBlank' | transloco }}
            </p>
          }
          @case ('tooLong') {
            <p [id]="nameErrorId" class="text-14 text-error">
              {{ 'profile.nameTooLong' | transloco: { max: nameMaxLength } }}
            </p>
          }
        }
      </div>

      <div class="flex justify-center gap-30">
        <button appButton="secondary" type="button" (click)="done.emit()">
          {{ 'profile.cancel' | transloco }}
        </button>
        <button appButton type="submit" [disabled]="uploading() || saving()">
          {{ 'profile.save' | transloco }}
        </button>
      </div>
    </form>
  `,
})
export class ProfileEdit {
  /** The form is done with: saved, or cancelled. */
  readonly done = output<void>();

  private readonly users = inject(UserStore);
  private readonly errors = inject(ErrorService);
  private readonly transloco = inject(TranslocoService);
  private readonly picker = viewChild.required(AvatarPicker);

  protected readonly fieldClasses = fieldClasses;
  protected readonly nameMaxLength = nameMaxLength;
  protected readonly nameId = 'profile-edit-name';
  protected readonly nameErrorId = 'profile-edit-name-error';

  // The shell's guard has loaded the User.
  protected readonly me = computed(() => this.users.me()!);
  /** The Avatar picked or uploaded in the picker; `null` while it's the saved one. */
  protected readonly draft = signal<AvatarDraft | null>(null);
  protected readonly uploading = computed(() => this.picker().uploading());

  private readonly model = signal({ name: this.me().name });
  protected readonly profile = form(this.model, (path) => {
    validate(path.name, ({ value }) => (value().trim() === '' ? { kind: 'blank' } : undefined));
    validate(path.name, ({ value }) =>
      [...value().trim()].length > nameMaxLength ? { kind: 'tooLong' } : undefined,
    );
  });
  private readonly submitted = signal(false);
  /** What's wrong with the name, once the User has left the field or tried to save. */
  protected readonly nameError = computed(() => {
    if (!this.submitted() && !this.profile.name().touched()) {
      return undefined;
    }
    return this.profile
      .name()
      .errors()
      .map((error) => error.kind)
      .find((kind) => kind === 'blank' || kind === 'tooLong');
  });

  protected readonly saving = signal(false);

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);
    if (this.profile().invalid() || this.uploading()) {
      return;
    }
    const name = this.model().name.trim();
    const draft = this.draft();
    this.saving.set(true);
    try {
      if (name !== this.me().name) {
        await this.users.rename(name);
      }
      if (draft?.kind === 'predefined') {
        await this.users.setAvatar(draft.avatar);
      } else if (draft?.kind === 'upload') {
        await this.users.useUploadedAvatar(draft.id);
      }
      this.done.emit();
    } catch {
      this.errors.show(this.transloco.translate('errors.saveProfileFailed'));
    } finally {
      this.saving.set(false);
    }
  }
}
