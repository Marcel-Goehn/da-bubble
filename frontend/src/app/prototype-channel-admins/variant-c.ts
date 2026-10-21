// PROTOTYPE: variant C "Über das Profil". The list stays as in the Figma, with the role as a subtitle. Clicking a
// Member opens the Figma profile card, which gains an "In #Channel" section with the Admin actions. Removing asks
// inside the card; deleting needs a checkbox.
import { Component, computed, input, output, signal } from '@angular/core';
import { ChannelState, ProtoAvatar, ProtoChannel, ProtoChannelInfo, ProtoConfirm, Row } from './prototype-bits';

@Component({
  selector: 'app-c-members',
  imports: [ProtoAvatar],
  template: `
    @let s = state();
    <ul class="flex flex-col gap-1">
      @for (r of s.rows(); track r.id) {
        <li>
          <button class="flex w-full items-center gap-4 rounded-full py-1.5 pl-3 text-left hover:bg-bg-lavender" (click)="open.emit(r)">
            <app-proto-avatar [row]="r" />
            <span class="flex flex-col leading-tight">
              <span class="text-lg">{{ r.name }}@if (r.isMe) { (Du)}</span>
              @if (r.isCreator) {
                <span class="text-sm text-purple-2">Ersteller · Admin</span>
              } @else if (r.isAdmin) {
                <span class="text-sm text-purple-2">Admin</span>
              }
            </span>
          </button>
        </li>
      }
      @if (s.iAmAdmin()) {
        <li class="flex items-center gap-4 rounded-full py-2 pl-5 hover:text-purple-3">
          <span class="material-symbols-outlined grid size-10 place-items-center rounded-full bg-bg-lavender">person_add</span>
          <span class="text-lg">Mitglieder hinzufügen</span>
        </li>
      }
    </ul>
  `,
})
class CMembers {
  readonly state = input.required<ChannelState>();
  readonly open = output<Row>();
}

@Component({
  selector: 'app-c-profile',
  template: `
    @let s = state();
    @let r = row();
    <div class="w-full max-w-[500px] rounded-[30px] bg-white p-8 shadow-xl" (click)="$event.stopPropagation()">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold">Profil</h2>
        <button class="material-symbols-outlined" (click)="close()">close</button>
      </div>
      <img [src]="r.avatar" class="mx-auto my-6 size-[160px] rounded-full" alt="" />
      <p class="text-3xl font-bold">{{ r.name }}@if (r.isMe) { (Du)}</p>
      <p class="mt-2 flex items-center gap-2 text-lg" [class]="r.online ? 'text-[#92c83e]' : 'text-text-gray'">
        <span class="size-3 rounded-full" [class]="r.online ? 'bg-[#92c83e]' : 'bg-text-gray'"></span>{{ r.online ? 'Aktiv' : 'Abwesend' }}
      </p>
      <p class="mt-5 flex items-center gap-3 font-bold"><span class="material-symbols-outlined">mail</span>E-Mail-Adresse</p>
      <p class="ml-9 text-[#1381ff]">{{ r.email }}</p>

      @if (!s.isDefault()) {
        <section class="mt-6 rounded-[20px] bg-bg-lavender p-4">
          <p class="flex items-center gap-2 font-bold"><span class="material-symbols-outlined !text-xl">tag</span>In {{ s.name() }}</p>
          <p class="mt-1 text-text-gray">
            @if (r.isCreator) { Ersteller und Admin. Kann nicht entfernt werden. }
            @else if (r.isAdmin) { Admin: darf den Channel ändern und Mitglieder verwalten. }
            @else { Mitglied }
          </p>
          @if (s.canManage(r)) {
            @if (asking()) {
              <div class="mt-3 rounded-[16px] bg-white p-3">
                <p>{{ r.name }} sieht #{{ s.name() }} und den Verlauf danach nicht mehr.</p>
                <div class="mt-3 flex gap-2">
                  <button class="rounded-full bg-danger px-4 py-2 font-bold text-white" (click)="s.remove(r.id); close()">Entfernen</button>
                  <button class="rounded-full px-4 py-2 text-purple-3" (click)="asking.set(false)">Abbrechen</button>
                </div>
              </div>
            } @else {
              <div class="mt-3 flex flex-wrap gap-2">
                <button class="rounded-full border border-purple-3 bg-white px-4 py-2 font-bold text-purple-3 hover:bg-purple-3 hover:text-white" (click)="s.setAdmin(r.id, !r.isAdmin)">
                  {{ r.isAdmin ? 'Admin-Rechte entziehen' : 'Zum Admin machen' }}
                </button>
                <button class="rounded-full px-4 py-2 font-bold text-danger hover:bg-white" (click)="asking.set(true)">Aus Channel entfernen</button>
              </div>
            }
          }
        </section>
      }
      @if (!r.isMe) {
        <button class="mx-auto mt-6 flex items-center gap-2 rounded-full bg-purple-3 px-6 py-3 font-bold text-white">
          <span class="material-symbols-outlined">chat_bubble</span>Nachricht
        </button>
      }
    </div>
  `,
})
class CProfile {
  readonly state = input.required<ChannelState>();
  readonly id = input.required<string>();
  readonly closed = output();
  protected readonly asking = signal(false);
  // Re-read the row from state so Admin changes show immediately; a removed Member closes the card.
  protected readonly row = computed(() => this.state().rows().find((r) => r.id === this.id())!);

  protected close() {
    this.closed.emit();
  }
}

@Component({
  selector: 'app-variant-c',
  imports: [ProtoChannel, ProtoChannelInfo, ProtoConfirm, CMembers, CProfile],
  template: `
    @let s = state();
    <app-proto-channel [state]="s" [mobile]="mobile()" (openEdit)="panel.set('edit')" (openMembers)="panel.set('members')">
      @if (!s.gone()) {
        @if (panel() === 'members') {
          <div class="absolute inset-0 z-10" (click)="panel.set(null)"></div>
          <div
            class="absolute z-10 rounded-[30px] rounded-tr-none bg-white p-8 shadow-[0_6px_14px_rgba(0,0,0,0.2)]"
            [class]="mobile() ? 'top-[150px] right-3 left-3' : 'top-[160px] right-12 w-[415px]'"
          >
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-2xl font-bold">Mitglieder</h2>
              <button class="material-symbols-outlined" (click)="panel.set(null)">close</button>
            </div>
            <app-c-members [state]="s" (open)="profile.set($event.id)" />
          </div>
        }
        @if (panel() === 'edit') {
          <div class="absolute inset-0 z-10 bg-black/20" [class.hidden]="mobile()" (click)="panel.set(null)"></div>
          <div
            class="absolute z-10 overflow-y-auto bg-white"
            [class]="mobile() ? 'inset-0 p-5 pb-8' : 'top-[140px] left-[60px] w-[870px] rounded-[30px] rounded-tl-none p-10 shadow-xl'"
          >
            <div class="mb-6 flex items-center justify-between">
              <h2 class="flex items-center gap-2 text-2xl font-bold"><span class="material-symbols-outlined !text-3xl">tag</span>{{ s.name() }}</h2>
              <button class="material-symbols-outlined" (click)="panel.set(null)">close</button>
            </div>
            <app-proto-channel-info [state]="s" [mobile]="mobile()" />
            @if (mobile()) {
              <section class="mt-6 rounded-[20px] border border-line p-4">
                <h3 class="mb-3 text-xl font-bold">Mitglieder</h3>
                <app-c-members [state]="s" (open)="profile.set($event.id)" />
              </section>
            }
            <div class="mt-6 flex justify-end">
              @if (s.iAmCreator()) {
                <button class="rounded-full border-2 border-danger px-6 py-3 font-bold text-danger hover:bg-danger hover:text-white" (click)="ack.set(false); confirmDelete.set(true)">
                  Channel löschen
                </button>
              } @else if (s.canLeave()) {
                <button class="rounded-full bg-purple-3 px-6 py-3 font-bold text-white" (click)="s.leave()">Channel verlassen</button>
              }
            </div>
          </div>
        }
        @if (profile(); as id) {
          @if (inChannel(id)) {
            <div class="absolute inset-0 z-20 grid place-items-center bg-black/20 p-4" (click)="profile.set(null)">
              <app-c-profile [state]="s" [id]="id" (closed)="profile.set(null)" />
            </div>
          }
        }
      }
      @if (confirmDelete()) {
        <app-proto-confirm
          [title]="'#' + s.name() + ' löschen?'"
          confirmLabel="Channel löschen"
          [danger]="true"
          [disabled]="!ack()"
          (cancel)="confirmDelete.set(false)"
          (confirm)="s.deleteChannel(); confirmDelete.set(false)"
        >
          <span text>Du bist der Ersteller, deshalb kannst du ihn nicht verlassen, nur löschen.</span>
          <label class="mt-4 flex cursor-pointer items-start gap-3 rounded-[16px] bg-bg-lavender p-4">
            <input type="checkbox" class="mt-1 size-4 accent-danger" [checked]="ack()" (change)="ack.set(!ack())" />
            <span>Alle Nachrichten, Threads und Dateien werden für alle {{ s.rows().length }} Mitglieder gelöscht. Das kann nicht rückgängig gemacht werden.</span>
          </label>
        </app-proto-confirm>
      }
    </app-proto-channel>
  `,
})
export class VariantC {
  readonly state = input.required<ChannelState>();
  readonly mobile = input(false);
  protected readonly panel = signal<'members' | 'edit' | null>(null);
  protected readonly profile = signal<string | null>(null);
  protected readonly confirmDelete = signal(false);
  protected readonly ack = signal(false);

  ngOnInit() {
    this.panel.set(this.mobile() ? 'edit' : 'members');
  }

  protected inChannel(id: string) {
    return this.state().rows().some((r) => r.id === id);
  }
}
