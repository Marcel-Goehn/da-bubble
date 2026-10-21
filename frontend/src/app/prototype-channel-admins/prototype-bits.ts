// PROTOTYPE: state and Figma pieces shared by the channel-admins variants. In memory only; reload resets.
import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';

export type Role = 'creator' | 'admin' | 'member';

export interface Person {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
  email: string;
}

const av = (i: number) => `prototype-avatars/avatar-${i}.png`;
export const ME = 'fred';
export const PEOPLE: Person[] = [
  { id: 'fred', name: 'Frederik Beck', avatar: av(3), online: true, email: 'fred.beck@email.com' },
  { id: 'sofia', name: 'Sofia Müller', avatar: av(2), online: true, email: 'sofia.muel@beispiel.com' },
  { id: 'noah', name: 'Noah Braun', avatar: av(1), online: true, email: 'noahbra@beispiel.com' },
  { id: 'elise', name: 'Elise Roth', avatar: av(4), online: false, email: 'rothelise@beispiel.com' },
  { id: 'elias', name: 'Elias Neumann', avatar: av(5), online: true, email: 'ichbinelias@beispiel.com' },
];
const person = (id: string) => PEOPLE.find((p) => p.id === id)!;

interface Membership {
  id: string;
  admin: boolean;
}

export interface Row extends Person {
  isMe: boolean;
  isCreator: boolean;
  isAdmin: boolean;
}

/** One Channel as seen by Frederik ("Du"). The demo bar picks his role and whether it's "Allgemein". */
export class ChannelState {
  readonly role = signal<Role>('admin');
  readonly isDefault = signal(false);
  readonly memberships = signal<Membership[]>([]);
  readonly creatorId = signal<string | null>(null);
  /** Set once Frederik left or deleted the Channel. */
  readonly gone = signal<'left' | 'deleted' | null>(null);
  readonly log = signal<string[]>([]);

  readonly name = computed(() => (this.isDefault() ? 'Allgemein' : 'Entwicklerteam'));

  readonly rows = computed<Row[]>(() => {
    const creator = this.creatorId();
    const rows = this.memberships().map((m) => ({
      ...person(m.id),
      isMe: m.id === ME,
      isCreator: m.id === creator,
      isAdmin: m.admin || m.id === creator,
    }));
    const rank = (r: Row) => (r.isMe ? 0 : r.isCreator ? 1 : r.isAdmin ? 2 : 3);
    return rows.sort((a, b) => rank(a) - rank(b));
  });

  readonly me = computed(() => this.rows().find((r) => r.isMe)!);
  readonly iAmAdmin = computed(() => !this.isDefault() && this.me().isAdmin);
  readonly iAmCreator = computed(() => !this.isDefault() && this.me().isCreator);
  readonly canLeave = computed(() => !this.isDefault() && !this.iAmCreator());
  readonly creatorName = computed(() => {
    const id = this.creatorId();
    return id ? person(id).name : null;
  });

  constructor() {
    this.reset();
  }

  setScenario(role: Role, isDefault: boolean) {
    this.role.set(role);
    this.isDefault.set(isDefault);
    this.reset();
  }

  reset() {
    this.gone.set(null);
    this.log.set([]);
    const m = (id: string, admin = false): Membership => ({ id, admin });
    if (this.isDefault()) {
      this.creatorId.set(null);
      this.memberships.set(PEOPLE.map((p) => m(p.id)));
      return;
    }
    switch (this.role()) {
      case 'creator':
        this.creatorId.set('fred');
        this.memberships.set([m('fred', true), m('sofia'), m('noah', true), m('elise')]);
        break;
      case 'admin':
        this.creatorId.set('noah');
        this.memberships.set([m('fred', true), m('sofia'), m('noah', true), m('elise'), m('elias')]);
        break;
      case 'member':
        this.creatorId.set('noah');
        this.memberships.set([m('fred'), m('sofia', true), m('noah', true), m('elise')]);
        break;
    }
  }

  /** Admin controls apply to everyone except the Creator and yourself (you leave instead). */
  canManage(r: Row) {
    return this.iAmAdmin() && !r.isCreator && !r.isMe;
  }

  setAdmin(id: string, admin: boolean) {
    this.memberships.update((ms) => ms.map((x) => (x.id === id ? { ...x, admin } : x)));
    this.note(`${person(id).name}: Admin ${admin ? 'erteilt' : 'entzogen'}`);
  }

  remove(id: string) {
    const removed = this.memberships().find((x) => x.id === id);
    this.memberships.update((ms) => ms.filter((x) => x.id !== id));
    this.note(`${person(id).name} entfernt`);
    return removed;
  }

  restore(ms: Membership) {
    this.memberships.update((all) => [...all, ms]);
    this.note(`${person(ms.id).name} wieder hinzugefügt`);
  }

  leave() {
    this.gone.set('left');
    this.note('Channel verlassen');
  }

  deleteChannel() {
    this.gone.set('deleted');
    this.note('Channel gelöscht');
  }

  private note(s: string) {
    this.log.update((l) => [...l, s]);
  }
}

/** Fake workspace: Figma header, and the Channel header with "# Name ⌄", the Member stack and "add Members". */
@Component({
  selector: 'app-proto-channel',
  template: `
    <div class="relative flex h-full flex-col bg-bg-lavender font-sans">
      <header class="flex shrink-0 items-center gap-4 px-6" [class]="mobile() ? 'h-[70px]' : 'h-[80px]'">
        <span class="flex items-center gap-2 text-xl font-bold">
          <span class="grid size-9 place-items-center rounded-lg bg-primary text-sm text-white">DA</span>
          @if (!mobile()) { DABubble } @else { Devspace }
        </span>
        <span class="ml-auto flex items-center gap-3 text-xl font-bold">
          @if (!mobile()) { Frederik Beck }
          <img src="prototype-avatars/avatar-3.png" class="size-[50px] rounded-full" alt="" />
        </span>
      </header>
      <div class="flex flex-1 flex-col rounded-t-[30px] bg-white" [class.mx-4]="!mobile()" [class.rounded-[30px]]="!mobile()" [class.mb-4]="!mobile()">
        @if (state().gone(); as gone) {
          <div class="m-auto max-w-sm text-center text-text-gray">
            <span class="material-symbols-outlined !text-5xl">{{ gone === 'deleted' ? 'delete' : 'logout' }}</span>
            <p class="mt-2 text-lg">
              {{ gone === 'deleted' ? '#' + state().name() + ' wurde gelöscht.' : 'Du hast #' + state().name() + ' verlassen.' }}
            </p>
            <p class="text-sm">Zurück zu „Allgemein“ (Demo: Rolle oben neu wählen)</p>
          </div>
        } @else {
          <div class="flex items-center gap-3 px-6 py-4 shadow-[0_2px_10px_rgba(0,0,0,0.08)]">
            <button class="flex items-center gap-2 rounded-full px-3 py-1.5 text-2xl font-bold hover:bg-bg-lavender hover:text-purple-3" (click)="openEdit.emit()">
              <span class="material-symbols-outlined !text-3xl">tag</span>{{ state().name() }}
              <span class="material-symbols-outlined">keyboard_arrow_down</span>
            </button>
            <button class="ml-auto flex items-center gap-1 rounded-full py-1 pr-3 pl-1 text-xl font-semibold hover:bg-bg-lavender hover:text-purple-3" (click)="openMembers.emit()">
              <span class="flex -space-x-3">
                @for (r of state().rows().slice(0, 3); track r.id) {
                  <img [src]="r.avatar" class="size-10 rounded-full border-2 border-white" alt="" />
                }
              </span>
              {{ state().rows().length }}
            </button>
            @if (state().iAmAdmin() && !mobile()) {
              <button class="grid size-10 place-items-center rounded-full bg-bg-lavender hover:text-purple-3" title="Mitglieder hinzufügen">
                <span class="material-symbols-outlined">person_add</span>
              </button>
            }
          </div>
          <div class="flex-1 p-6 text-sm text-text-gray">… Nachrichten …</div>
        }
      </div>
      <ng-content />
    </div>
  `,
})
export class ProtoChannel {
  readonly state = input.required<ChannelState>();
  readonly mobile = input(false);
  readonly openEdit = output();
  readonly openMembers = output();
}

/** Figma "Channel Edition" cards: name, description, "Erstellt von". Admins get "Bearbeiten" / pencil. */
@Component({
  selector: 'app-proto-channel-info',
  template: `
    @let s = state();
    <div class="flex flex-col gap-5">
      <section class="rounded-[20px] border border-line p-5" [class.border-0]="mobile()" [class.p-0]="mobile()">
        <div class="flex items-center font-bold">
          Channel-Name
          @if (s.iAmAdmin()) { <ng-container *ngTemplateOutlet="edit" /> }
        </div>
        <p class="mt-3 flex items-center gap-2"><span class="material-symbols-outlined">tag</span>{{ s.name() }}</p>
      </section>
      <section class="rounded-[20px] border border-line p-5" [class.border-0]="mobile()" [class.p-0]="mobile()">
        <div class="flex items-center font-bold">
          Beschreibung
          @if (s.iAmAdmin()) { <ng-container *ngTemplateOutlet="edit" /> }
        </div>
        <p class="mt-3">
          @if (s.isDefault()) {
            Hier ist das ganze Team. Jeder ist automatisch dabei.
          } @else {
            Dieser Channel ist für alles rund um das Entwicklerteam vorgesehen.
          }
        </p>
        <hr class="my-4 border-line" />
        @if (s.creatorName(); as c) {
          <p class="font-bold">Erstellt von</p>
          <p class="mt-2 text-xl text-purple-2">{{ c }}@if (s.iAmCreator()) { (Du)}</p>
        } @else {
          <p class="font-bold">Standard-Channel</p>
          <p class="mt-2 text-text-gray">Alle sind Mitglied. Niemand kann ihn ändern, verlassen oder löschen.</p>
        }
      </section>
    </div>
    <ng-template #edit>
      @if (mobile()) {
        <span class="material-symbols-outlined ml-auto grid size-9 place-items-center rounded-full bg-bg-lavender !text-xl">edit</span>
      } @else {
        <span class="ml-auto font-normal text-purple-3">Bearbeiten</span>
      }
    </ng-template>
  `,
  imports: [NgTemplateOutlet],
})
export class ProtoChannelInfo {
  readonly state = input.required<ChannelState>();
  readonly mobile = input(false);
}

/** Figma-style confirm dialog (white card, round buttons). Extra content (checkbox, input) is projected. */
@Component({
  selector: 'app-proto-confirm',
  template: `
    <div class="absolute inset-0 z-30 grid place-items-center bg-black/30 p-4" (click)="cancel.emit()">
      <div class="w-full max-w-[480px] rounded-[30px] bg-white p-8 shadow-xl" (click)="$event.stopPropagation()">
        <h3 class="text-2xl font-bold">{{ title() }}</h3>
        <p class="mt-3 text-text-gray"><ng-content select="[text]" /></p>
        <ng-content />
        <div class="mt-6 flex justify-end gap-3">
          <button class="rounded-full border border-purple-3 px-6 py-2.5 font-bold text-purple-3 hover:bg-purple-3 hover:text-white" (click)="cancel.emit()">Abbrechen</button>
          <button
            class="rounded-full px-6 py-2.5 font-bold text-white disabled:opacity-40"
            [class]="danger() ? 'bg-danger' : 'bg-purple-3'"
            [disabled]="disabled()"
            (click)="confirm.emit()"
          >{{ confirmLabel() }}</button>
        </div>
      </div>
    </div>
  `,
})
export class ProtoConfirm {
  readonly title = input.required<string>();
  readonly confirmLabel = input.required<string>();
  readonly danger = input(false);
  readonly disabled = input(false);
  readonly confirm = output();
  readonly cancel = output();
}

/** Member row in the Figma "Mitglieder" style: Avatar with Presence dot, name, "(Du)". */
@Component({
  selector: 'app-proto-avatar',
  template: `
    <span class="relative block shrink-0" [class]="small() ? 'size-10' : 'size-[50px]'">
      <img [src]="row().avatar" class="size-full rounded-full" alt="" />
      <span class="absolute right-0 bottom-0 size-3.5 rounded-full border-2 border-white" [class]="row().online ? 'bg-[#92c83e]' : 'bg-text-gray'"></span>
      <ng-content />
    </span>
  `,
})
export class ProtoAvatar {
  readonly row = input.required<Row>();
  readonly small = input(false);
}

