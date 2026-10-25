import { Combobox, ComboboxPopup, ComboboxWidget } from '@angular/aria/combobox';
import { Listbox, Option } from '@angular/aria/listbox';
import { DialogRef } from '@angular/cdk/dialog';
import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { form, FormField, validate } from '@angular/forms/signals';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { avatarUrl } from '../../core/data/avatars';
import { ConversationStore } from '../../core/data/conversation.store';
import { UserStore } from '../../core/data/user.store';
import { ErrorService } from '../../core/errors/error.service';
import { problemCode } from '../../core/errors/problem';
import { Avatar } from '../../shared/ui/avatar';
import { Button } from '../../shared/ui/button';
import { ChannelNamePipe } from '../../shared/ui/channel-name.pipe';
import { DialogFrame } from '../../shared/ui/dialog-frame';
import { Icon } from '../../shared/ui/icon';

/** The name field, which the dialog focuses as it opens. */
export const createChannelNameId = 'create-channel-name';

/** Whom the new Channel gets as Members besides its Creator. */
type People = 'everyone' | 'specific';

/** As long as the backend allows (`Conversation.CHANNEL_NAME_MAX_LENGTH`). */
const nameMaxLength = 50;

const fieldClasses =
  'flex items-center gap-15 rounded-full border border-border bg-surface px-20 py-12 hover:border-border-hover has-[input:focus-visible]:border-border-focus';

/**
 * "Channel erstellen" (frames 37., 38. and "Add Channel"): first a name and an optional description, then
 * either everyone in the Default Channel or specific people. The Channel opens once created. A name the
 * server says is taken sends the User back to the first step.
 */
@Component({
  selector: 'app-create-channel-dialog',
  imports: [
    Avatar,
    Button,
    ChannelNamePipe,
    Combobox,
    ComboboxPopup,
    ComboboxWidget,
    DialogFrame,
    FormField,
    Icon,
    Listbox,
    Option,
    TranslocoPipe,
  ],
  template: `
    <app-dialog-frame
      class="block w-[min(54rem,calc(100vw-2rem))]"
      [heading]="
        (step() === 'name' ? 'createChannel.title' : 'createChannel.peopleTitle') | transloco
      "
    >
      @if (step() === 'name') {
        <form class="flex flex-col gap-20" novalidate (submit)="toPeople($event)">
          <p>{{ 'createChannel.intro' | transloco }}</p>
          <div class="flex flex-col gap-10">
            <label [for]="nameId" class="font-bold">
              {{ 'createChannel.name' | transloco }}
            </label>
            <div [class]="fieldClasses" [class.border-error!]="nameError()">
              <app-icon name="tag" class="text-text-muted" />
              <input
                #nameInput
                [id]="nameId"
                class="min-w-0 flex-1 bg-transparent outline-none placeholder:text-text-muted"
                autocomplete="off"
                [formField]="details.name"
                [placeholder]="'createChannel.namePlaceholder' | transloco"
                [attr.aria-invalid]="nameError() !== undefined"
                [attr.aria-describedby]="nameError() ? 'create-channel-name-error' : null"
              />
            </div>
            @switch (nameError()) {
              @case ('taken') {
                <p id="create-channel-name-error" class="text-14 text-error">
                  {{ 'createChannel.nameTaken' | transloco }}
                </p>
              }
              @case ('tooLong') {
                <p id="create-channel-name-error" class="text-14 text-error">
                  {{ 'createChannel.nameTooLong' | transloco: { max: nameMaxLength } }}
                </p>
              }
            }
          </div>
          <div class="flex flex-col gap-10">
            <label for="create-channel-description" class="font-bold">
              {{ 'createChannel.description' | transloco }}
              <span class="font-normal text-text-muted">{{
                'createChannel.optional' | transloco
              }}</span>
            </label>
            <div [class]="fieldClasses">
              <input
                id="create-channel-description"
                class="min-w-0 flex-1 bg-transparent outline-none placeholder:text-text-muted"
                autocomplete="off"
                [formField]="details.description"
                [placeholder]="'createChannel.descriptionPlaceholder' | transloco"
              />
            </div>
          </div>
          <button appButton type="submit" class="self-end" [disabled]="details().invalid()">
            {{ 'createChannel.create' | transloco }}
          </button>
        </form>
      } @else {
        <form class="flex flex-col gap-20" novalidate (submit)="create($event)">
          <fieldset class="flex flex-col gap-20">
            <legend class="sr-only">{{ 'createChannel.peopleTitle' | transloco }}</legend>
            <label class="flex cursor-pointer items-center gap-20">
              <input
                #firstChoice
                type="radio"
                name="create-channel-people"
                class="size-20 accent-accent"
                [checked]="people() === 'everyone'"
                (change)="people.set('everyone')"
              />
              <span>
                {{ 'createChannel.everyoneBefore' | transloco }}
                @if (defaultChannel(); as defaultChannel) {
                  <span class="text-link-soft">{{ defaultChannel | channelName }}</span>
                }
                {{ 'createChannel.everyoneAfter' | transloco }}
              </span>
            </label>
            <label class="flex cursor-pointer items-center gap-20">
              <input
                type="radio"
                name="create-channel-people"
                class="size-20 accent-accent"
                [checked]="people() === 'specific'"
                (change)="people.set('specific')"
              />
              {{ 'createChannel.specific' | transloco }}
            </label>
          </fieldset>
          @if (people() === 'specific') {
            <div
              class="flex flex-wrap items-center gap-10 rounded-30 border border-border px-20 py-10 hover:border-border-hover has-[input:focus-visible]:border-border-focus"
            >
              @for (person of picked(); track person.id) {
                <span class="flex items-center gap-10 rounded-full bg-hover py-4 pr-8 pl-4">
                  <app-avatar
                    [src]="avatarUrl(person.avatar)"
                    [name]="person.name"
                    [size]="40"
                    decorative
                  />
                  {{ person.name }}
                  <button
                    type="button"
                    class="rounded-full p-4 hover:text-menu-active"
                    [attr.aria-label]="'createChannel.remove' | transloco: { name: person.name }"
                    (click)="unpick(person.id)"
                  >
                    <app-icon name="close" />
                  </button>
                </span>
              }
              <input
                ngCombobox
                #combobox="ngCombobox"
                class="min-w-40 flex-1 bg-transparent py-6 outline-none placeholder:text-text-muted"
                autocomplete="off"
                [(value)]="query"
                [(expanded)]="pickerOpen"
                [placeholder]="'createChannel.search' | transloco"
                [attr.aria-label]="'createChannel.search' | transloco"
              />
              <ng-template ngComboboxPopup [combobox]="combobox">
                <div
                  ngComboboxWidget
                  ngListbox
                  #listbox="ngListbox"
                  focusMode="activedescendant"
                  selectionMode="explicit"
                  class="mt-10 flex w-full flex-col gap-5 rounded-20 border border-border bg-surface p-10 shadow-overlay"
                  [activeDescendant]="listbox.activeDescendant()"
                  [attr.aria-label]="'createChannel.matches' | transloco"
                  [hidden]="matches().length === 0"
                  [value]="[]"
                  (valueChange)="pick($event)"
                >
                  @for (person of matches(); track person.id) {
                    <div
                      ngOption
                      class="flex cursor-pointer items-center gap-15 rounded-full px-20 py-4 hover:bg-hover aria-selected:bg-hover data-[active=true]:bg-hover"
                      [value]="person.id"
                      [label]="person.name"
                    >
                      <app-avatar
                        [src]="avatarUrl(person.avatar)"
                        [name]="person.name"
                        [size]="40"
                        decorative
                      />
                      {{ person.name }}
                    </div>
                  }
                </div>
              </ng-template>
            </div>
          }
          <button appButton type="submit" class="self-end" [disabled]="creating()">
            {{ 'createChannel.create' | transloco }}
          </button>
        </form>
      }
    </app-dialog-frame>
  `,
})
export class CreateChannelDialog {
  private readonly dialogRef = inject(DialogRef);
  private readonly conversations = inject(ConversationStore);
  private readonly users = inject(UserStore);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorService);
  private readonly transloco = inject(TranslocoService);
  private readonly injector = inject(Injector);
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  private readonly firstChoice = viewChild<ElementRef<HTMLInputElement>>('firstChoice');

  protected readonly avatarUrl = avatarUrl;
  protected readonly fieldClasses = fieldClasses;
  protected readonly nameMaxLength = nameMaxLength;
  protected readonly nameId = createChannelNameId;
  protected readonly step = signal<'name' | 'people'>('name');
  protected readonly people = signal<People>('everyone');
  protected readonly query = signal('');
  protected readonly pickerOpen = signal(false);
  protected readonly creating = signal(false);
  private readonly pickedIds = signal<string[]>([]);
  /** Names the server said are taken, e.g. by a Channel the User isn't a Member of. */
  private readonly takenNames = signal<string[]>([]);

  private readonly model = signal({ name: '', description: '' });
  protected readonly details = form(this.model, (path) => {
    validate(path.name, ({ value }) => (value().trim() === '' ? { kind: 'blank' } : undefined));
    // In code points after trimming, as the backend counts.
    validate(path.name, ({ value }) =>
      [...value().trim()].length > nameMaxLength ? { kind: 'tooLong' } : undefined,
    );
    validate(path.name, ({ value }) => (this.isTaken(value()) ? { kind: 'taken' } : undefined));
  });
  /** What's wrong with the name, shown at the field; a blank one only disables "Erstellen". */
  protected readonly nameError = computed(() =>
    this.details
      .name()
      .errors()
      .map((error) => error.kind)
      .find((kind) => kind === 'taken' || kind === 'tooLong'),
  );

  protected readonly defaultChannel = this.conversations.defaultChannel;

  protected readonly picked = computed(() =>
    this.pickedIds().flatMap((id) => this.users.user(id) ?? []),
  );

  /** Users whose name contains the query, the User themselves and those picked already left out. */
  protected readonly matches = computed(() => {
    const query = this.query().trim().toLowerCase();
    if (query === '') {
      return [];
    }
    const me = this.users.me()?.id;
    const picked = this.pickedIds();
    return this.users
      .all()
      .filter(
        (user) =>
          user.id !== me && !picked.includes(user.id) && user.name.toLowerCase().includes(query),
      );
  });

  protected toPeople(event: Event): void {
    event.preventDefault();
    if (this.details().invalid()) {
      return;
    }
    this.step.set('people');
    this.focusAfterRender(() => this.firstChoice());
  }

  protected pick(ids: string[]): void {
    this.pickedIds.update((picked) => [...picked, ...ids.filter((id) => !picked.includes(id))]);
    this.query.set('');
    this.pickerOpen.set(false);
  }

  protected unpick(id: string): void {
    this.pickedIds.update((picked) => picked.filter((pickedId) => pickedId !== id));
  }

  protected async create(event: Event): Promise<void> {
    event.preventDefault();
    const { name, description } = this.model();
    const everyone = this.people() === 'everyone';
    this.creating.set(true);
    try {
      const channel = await this.conversations.createChannel({
        name: name.trim(),
        description: description.trim() || null,
        addDefaultChannelMembers: everyone,
        memberIds: everyone ? [] : this.pickedIds(),
      });
      this.dialogRef.close();
      await this.router.navigate(['/channel', channel.id]);
    } catch (error) {
      if (problemCode(error) === 'CHANNEL_NAME_TAKEN') {
        this.takenNames.update((taken) => [...taken, name.trim().toLowerCase()]);
        this.step.set('name');
        this.focusAfterRender(() => this.nameInput());
      } else {
        this.errors.show(this.transloco.translate('errors.createChannelFailed'));
      }
    } finally {
      this.creating.set(false);
    }
  }

  private isTaken(name: string): boolean {
    return (
      this.conversations.isChannelNameTaken(name) ||
      this.takenNames().includes(name.trim().toLowerCase())
    );
  }

  private focusAfterRender(target: () => ElementRef<HTMLElement> | undefined): void {
    afterNextRender(() => target()?.nativeElement.focus(), { injector: this.injector });
  }
}
