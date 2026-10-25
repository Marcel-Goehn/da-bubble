import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ConversationStore } from '../../core/data/conversation.store';
import { UserStore } from '../../core/data/user.store';
import { ErrorService } from '../../core/errors/error.service';
import { problemCode } from '../../core/errors/problem';
import { Button } from '../../shared/ui/button';
import { ChannelNamePipe } from '../../shared/ui/channel-name.pipe';
import { DialogFrame } from '../../shared/ui/dialog-frame';
import { Icon } from '../../shared/ui/icon';
import { ProfileCards } from '../profile/profile-cards';
import { ChannelMembers } from './channel-members';
import { fieldClasses, nameMaxLength } from './create-channel-dialog';

export interface ChannelDetailsData {
  channelId: number;
}

/** The field being edited, if any. */
type Editing = 'name' | 'description' | null;

const cardClasses = 'flex flex-col gap-20 rounded-20 border border-border p-20';

const editButtonClasses =
  'ml-auto rounded-20 px-10 py-4 font-normal text-interactive hover:text-interactive-hover hover:underline';

/**
 * A Channel's details ("Channel Edition"): its name and description, which its Admins edit in place, and who
 * created it, whose profile card opens from their name. Anyone but the Creator can leave it. The Default
 * Channel is "Standard-Channel" instead, with nothing to edit or leave. On mobile its Members show here
 * too. Closes when the User loses the Channel.
 */
@Component({
  selector: 'app-channel-details-dialog',
  imports: [Button, ChannelMembers, ChannelNamePipe, DialogFrame, Icon, TranslocoPipe],
  template: `
    <!-- The frame is always there: it names the dialog as it opens. -->
    <app-dialog-frame
      class="block max-h-[calc(100vh-2rem)] w-[min(54rem,calc(100vw-2rem))] overflow-y-auto"
      [heading]="channel() ? (channel()! | channelName) : ''"
    >
      @if (channel(); as channel) {
        <section [class]="cardClasses">
          <div class="flex items-center gap-10">
            <h3 class="font-bold">
              @if (editing() === 'name') {
                <label for="channel-details-name">{{ 'channelDetails.name' | transloco }}</label>
              } @else {
                {{ 'channelDetails.name' | transloco }}
              }
            </h3>
            @if (canEdit() && editing() !== 'name') {
              <button
                type="button"
                [class]="editButtonClasses"
                [attr.aria-label]="'channelDetails.editName' | transloco"
                (click)="edit('name')"
              >
                {{ 'channelDetails.edit' | transloco }}
              </button>
            }
          </div>
          @if (editing() === 'name') {
            <form class="flex flex-col gap-10" novalidate (submit)="saveName($event)">
              <div class="flex items-center gap-10">
                <div class="flex-1" [class]="fieldClasses" [class.border-error!]="nameError()">
                  <app-icon name="tag" class="text-text-muted" />
                  <input
                    #field
                    id="channel-details-name"
                    class="min-w-0 flex-1 bg-transparent outline-none"
                    autocomplete="off"
                    [value]="draft()"
                    (input)="draft.set($any($event.target).value)"
                    (keydown.escape)="cancel($event)"
                    [attr.aria-invalid]="nameError() !== undefined"
                    [attr.aria-describedby]="nameError() ? 'channel-details-name-error' : null"
                  />
                </div>
                <button
                  appButton
                  type="submit"
                  [attr.aria-label]="'channelDetails.saveName' | transloco"
                  [disabled]="nameError() !== undefined || draft().trim() === '' || saving()"
                >
                  {{ 'channelDetails.save' | transloco }}
                </button>
              </div>
              @switch (nameError()) {
                @case ('taken') {
                  <p id="channel-details-name-error" class="text-14 text-error">
                    {{ 'createChannel.nameTaken' | transloco }}
                  </p>
                }
                @case ('tooLong') {
                  <p id="channel-details-name-error" class="text-14 text-error">
                    {{ 'createChannel.nameTooLong' | transloco: { max: nameMaxLength } }}
                  </p>
                }
              }
            </form>
          } @else {
            <p class="flex items-center gap-10 break-words">
              <app-icon name="tag" />
              {{ channel | channelName }}
            </p>
          }
        </section>
        <section [class]="cardClasses">
          <div class="flex items-center gap-10">
            <h3 class="font-bold">
              @if (editing() === 'description') {
                <label for="channel-details-description">{{
                  'channelDetails.description' | transloco
                }}</label>
              } @else {
                {{ 'channelDetails.description' | transloco }}
              }
            </h3>
            @if (canEdit() && editing() !== 'description') {
              <button
                type="button"
                [class]="editButtonClasses"
                [attr.aria-label]="'channelDetails.editDescription' | transloco"
                (click)="edit('description')"
              >
                {{ 'channelDetails.edit' | transloco }}
              </button>
            }
          </div>
          @if (editing() === 'description') {
            <form class="flex items-center gap-10" novalidate (submit)="saveDescription($event)">
              <div class="flex-1" [class]="fieldClasses">
                <input
                  #field
                  id="channel-details-description"
                  class="min-w-0 flex-1 bg-transparent outline-none placeholder:text-text-muted"
                  autocomplete="off"
                  [placeholder]="'channelDetails.descriptionPlaceholder' | transloco"
                  [value]="draft()"
                  (input)="draft.set($any($event.target).value)"
                  (keydown.escape)="cancel($event)"
                />
              </div>
              <button
                appButton
                type="submit"
                [attr.aria-label]="'channelDetails.saveDescription' | transloco"
                [disabled]="saving()"
              >
                {{ 'channelDetails.save' | transloco }}
              </button>
            </form>
          } @else {
            <p class="break-words" [class.text-text-muted]="!channel.description">
              {{ channel.description || ('channelDetails.noDescription' | transloco) }}
            </p>
          }
          <hr class="border-border" />
          @if (channel.isDefault) {
            <h3 class="font-bold">{{ 'channelDetails.defaultChannel' | transloco }}</h3>
            <p class="text-text-muted">{{ 'channelDetails.defaultChannelInfo' | transloco }}</p>
          } @else if (creator(); as creator) {
            <h3 class="font-bold">{{ 'channelDetails.createdBy' | transloco }}</h3>
            <button
              type="button"
              class="self-start text-24 text-interactive hover:text-interactive-hover hover:underline"
              (click)="profiles.open(creator.id)"
            >
              {{ creator.name }}
            </button>
          }
        </section>
        <!-- On desktop the Members are a popover from the Channel header. -->
        <section class="lg:hidden" [class]="cardClasses">
          <h3 class="text-20 font-bold">{{ 'channelMembers.title' | transloco }}</h3>
          <app-channel-members [channelId]="channel.id" />
        </section>
        @if (canLeave()) {
          <button
            appButton
            type="button"
            class="self-end"
            [disabled]="leaving()"
            (click)="leave(channel.id)"
          >
            {{ 'channelDetails.leave' | transloco }}
          </button>
        }
      }
    </app-dialog-frame>
  `,
})
export class ChannelDetailsDialog {
  private readonly data = inject<ChannelDetailsData>(DIALOG_DATA);
  private readonly dialogRef = inject(DialogRef);
  private readonly conversations = inject(ConversationStore);
  private readonly users = inject(UserStore);
  private readonly errors = inject(ErrorService);
  private readonly transloco = inject(TranslocoService);
  private readonly injector = inject(Injector);
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  protected readonly profiles = inject(ProfileCards);
  protected readonly cardClasses = cardClasses;
  protected readonly editButtonClasses = editButtonClasses;
  protected readonly fieldClasses = fieldClasses;
  protected readonly nameMaxLength = nameMaxLength;
  protected readonly channel = computed(() => this.conversations.get(this.data.channelId));
  protected readonly creator = computed(() => {
    const creatorId = this.channel()?.creatorId;
    return creatorId ? this.users.user(creatorId) : undefined;
  });
  /** Admins edit; the Default Channel has none. */
  protected readonly canEdit = computed(() => this.conversations.isAdmin(this.data.channelId));
  /** Anyone but the Creator may leave, except the Default Channel. */
  protected readonly canLeave = computed(() => {
    const channel = this.channel();
    return channel !== undefined && !channel.isDefault && channel.creatorId !== this.users.me()?.id;
  });

  protected readonly editing = signal<Editing>(null);
  protected readonly draft = signal('');
  protected readonly saving = signal(false);
  protected readonly leaving = signal(false);
  /** Names the server said are taken, e.g. by a Channel the User isn't a Member of. */
  private readonly takenNames = signal<string[]>([]);

  /** What's wrong with the new name, shown at the field; a blank one only disables "Speichern". */
  protected readonly nameError = computed(() => {
    const name = this.draft().trim();
    if ([...name].length > nameMaxLength) {
      return 'tooLong';
    }
    const taken =
      this.conversations.isChannelNameTaken(name, this.data.channelId) ||
      this.takenNames().includes(name.toLowerCase());
    return taken ? 'taken' : undefined;
  });

  constructor() {
    // Gone for the User: they left, were removed, or it was deleted.
    effect(() => {
      if (this.channel() === undefined) {
        this.dialogRef.close();
      }
    });
  }

  protected edit(field: 'name' | 'description'): void {
    const channel = this.channel();
    this.draft.set((field === 'name' ? channel?.name : channel?.description) ?? '');
    this.editing.set(field);
    afterNextRender(() => this.field()?.nativeElement.focus(), { injector: this.injector });
  }

  /** Escape leaves the field, not the dialog. */
  protected cancel(event: Event): void {
    event.stopPropagation();
    this.editing.set(null);
  }

  protected saveName(event: Event): Promise<void> {
    event.preventDefault();
    const name = this.draft().trim();
    if (name === '' || this.nameError()) {
      return Promise.resolve();
    }
    return this.save({ name });
  }

  protected saveDescription(event: Event): Promise<void> {
    event.preventDefault();
    return this.save({ description: this.draft().trim() });
  }

  protected async leave(channelId: number): Promise<void> {
    this.leaving.set(true);
    try {
      // Once it's gone, this dialog closes and the Channel's view moves to the Default Channel.
      await this.conversations.leaveChannel(channelId);
    } catch {
      this.errors.show(this.transloco.translate('errors.leaveChannelFailed'));
    } finally {
      this.leaving.set(false);
    }
  }

  private async save(change: { name?: string; description?: string }): Promise<void> {
    this.saving.set(true);
    try {
      await this.conversations.editChannel(this.data.channelId, change);
      this.editing.set(null);
    } catch (error) {
      if (change.name !== undefined && problemCode(error) === 'CHANNEL_NAME_TAKEN') {
        this.takenNames.update((taken) => [...taken, change.name!.toLowerCase()]);
      } else {
        this.errors.show(this.transloco.translate('errors.editChannelFailed'));
      }
    } finally {
      this.saving.set(false);
    }
  }
}
