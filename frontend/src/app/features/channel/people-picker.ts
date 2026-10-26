import { Combobox, ComboboxPopup, ComboboxWidget } from '@angular/aria/combobox';
import { Listbox, Option } from '@angular/aria/listbox';
import { Component, computed, inject, input, model, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { avatarUrl } from '../../core/data/avatars';
import { UserStore } from '../../core/data/user.store';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';

/**
 * Picks Users by name: a combobox of matching names, and the picked ones as removable chips. The User
 * themselves and the [excluded] are never offered.
 */
@Component({
  selector: 'app-people-picker',
  imports: [Avatar, Combobox, ComboboxPopup, ComboboxWidget, Icon, Listbox, Option, TranslocoPipe],
  template: `
    <div
      class="flex flex-wrap items-center gap-10 rounded-30 border border-border px-20 py-10 hover:border-border-hover has-[input:focus-visible]:border-border-focus"
    >
      @for (person of pickedUsers(); track person.id) {
        <span class="flex items-center gap-10 rounded-full bg-hover py-4 pr-8 pl-4">
          <app-avatar [src]="avatarUrl(person)" [name]="person.name" [size]="40" decorative />
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
        [(expanded)]="open"
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
              <app-avatar [src]="avatarUrl(person)" [name]="person.name" [size]="40" decorative />
              {{ person.name }}
            </div>
          }
        </div>
      </ng-template>
    </div>
  `,
})
export class PeoplePicker {
  private readonly users = inject(UserStore);

  /** The ids of the picked Users, in the order they were picked. */
  readonly picked = model<string[]>([]);
  /** Users never offered, e.g. a Channel's Members already. */
  readonly excluded = input<readonly string[]>([]);

  protected readonly avatarUrl = avatarUrl;
  protected readonly query = signal('');
  protected readonly open = signal(false);

  protected readonly pickedUsers = computed(() =>
    this.picked().flatMap((id) => this.users.user(id) ?? []),
  );

  /** Users whose name contains the query, the User themselves, the excluded and those picked left out. */
  protected readonly matches = computed(() => {
    const query = this.query().trim().toLowerCase();
    if (query === '') {
      return [];
    }
    const me = this.users.me()?.id;
    const left = new Set([...this.picked(), ...this.excluded()]);
    return this.users
      .all()
      .filter(
        (user) => user.id !== me && !left.has(user.id) && user.name.toLowerCase().includes(query),
      );
  });

  protected pick(ids: string[]): void {
    this.picked.update((picked) => [...picked, ...ids.filter((id) => !picked.includes(id))]);
    this.query.set('');
    this.open.set(false);
  }

  protected unpick(id: string): void {
    this.picked.update((picked) => picked.filter((pickedId) => pickedId !== id));
  }
}
