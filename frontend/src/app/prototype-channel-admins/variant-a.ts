// PROTOTYPE: variant A "Zeilenmenü". Role label at the end of each row; Admins get a ⋮ menu per Member.
// Removing and deleting both go through a Figma-style confirm dialog.
import { Component, input, output, signal } from '@angular/core';
import { ChannelState, ProtoAvatar, ProtoChannel, ProtoChannelInfo, ProtoConfirm, Row } from './prototype-bits';

@Component({
  selector: 'app-a-members',
  imports: [ProtoAvatar],
  template: `
    @let s = state();
    <ul class="flex flex-col gap-1">
      @for (r of s.rows(); track r.id) {
        <li class="group relative flex items-center gap-4 rounded-full py-1.5 pr-2 pl-3 hover:bg-bg-lavender">
          <app-proto-avatar [row]="r" />
          <span class="flex-1 text-lg">{{ r.name }}@if (r.isMe) { (Du)}</span>
          @if (r.isCreator) {
            <span class="text-sm text-text-gray">Ersteller</span>
          } @else if (r.isAdmin) {
            <span class="text-sm text-text-gray">Admin</span>
          }
          @if (s.canManage(r)) {
            <button
              class="grid size-9 place-items-center rounded-full hover:bg-white hover:text-purple-3"
              [class.opacity-0]="!mobile() && menuFor() !== r.id"
              [class.group-hover:opacity-100]="!mobile()"
              (click)="menuFor.set(menuFor() === r.id ? null : r.id)"
            >
              <span class="material-symbols-outlined">more_vert</span>
            </button>
          }
          @if (menuFor() === r.id) {
            <div class="absolute top-12 right-2 z-20 flex w-64 flex-col rounded-[20px] rounded-tr-none bg-white p-2 shadow-[0_6px_14px_rgba(0,0,0,0.2)]">
              <button class="rounded-full px-4 py-2 text-left hover:bg-bg-lavender hover:text-purple-3" (click)="s.setAdmin(r.id, !r.isAdmin); menuFor.set(null)">
                {{ r.isAdmin ? 'Admin-Rechte entziehen' : 'Zum Admin machen' }}
              </button>
              <button class="rounded-full px-4 py-2 text-left text-danger hover:bg-bg-lavender" (click)="askRemove.emit(r); menuFor.set(null)">
                Aus dem Channel entfernen
              </button>
            </div>
          }
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
class AMembers {
  readonly state = input.required<ChannelState>();
  readonly mobile = input(false);
  protected readonly menuFor = signal<string | null>(null);
  readonly askRemove = output<Row>();
}

@Component({
  selector: 'app-variant-a',
  imports: [ProtoChannel, ProtoChannelInfo, ProtoConfirm, AMembers],
  template: `
    @let s = state();
    <app-proto-channel [state]="s" [mobile]="mobile()" (openEdit)="panel.set('edit')" (openMembers)="panel.set('members')">
      @if (!s.gone()) {
        @if (panel() === 'members') {
          <div class="absolute inset-0 z-10" (click)="panel.set(null)"></div>
          <div
            class="absolute z-10 rounded-[30px] rounded-tr-none bg-white p-8 shadow-[0_6px_14px_rgba(0,0,0,0.2)]"
            [class]="mobile() ? 'top-[150px] right-3 left-3' : 'top-[160px] right-12 w-[440px]'"
          >
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-2xl font-bold">Mitglieder</h2>
              <button class="material-symbols-outlined" (click)="panel.set(null)">close</button>
            </div>
            <app-a-members [state]="s" [mobile]="mobile()" (askRemove)="confirmRemove.set($event)" />
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
                <app-a-members [state]="s" [mobile]="true" (askRemove)="confirmRemove.set($event)" />
              </section>
            }
            <div class="mt-6 flex justify-end">
              @if (s.iAmCreator()) {
                <button class="rounded-full bg-danger px-6 py-3 font-bold text-white" (click)="confirmDelete.set(true)">Channel löschen</button>
              } @else if (s.canLeave()) {
                <button class="rounded-full bg-purple-3 px-6 py-3 font-bold text-white" (click)="s.leave()">Channel verlassen</button>
              }
            </div>
          </div>
        }
      }
      @if (confirmRemove(); as r) {
        <app-proto-confirm
          [title]="r.name + ' entfernen?'"
          confirmLabel="Entfernen"
          [danger]="true"
          (cancel)="confirmRemove.set(null)"
          (confirm)="s.remove(r.id); confirmRemove.set(null)"
        >
          <span text>{{ r.name }} sieht #{{ s.name() }} und seinen Verlauf danach nicht mehr. Du kannst die Person später wieder hinzufügen.</span>
        </app-proto-confirm>
      }
      @if (confirmDelete()) {
        <app-proto-confirm
          [title]="'#' + s.name() + ' löschen?'"
          confirmLabel="Endgültig löschen"
          [danger]="true"
          (cancel)="confirmDelete.set(false)"
          (confirm)="s.deleteChannel(); confirmDelete.set(false)"
        >
          <span text>
            Alle Nachrichten, Threads und Dateien werden für alle {{ s.rows().length }} Mitglieder gelöscht.
            Das kann nicht rückgängig gemacht werden.
          </span>
        </app-proto-confirm>
      }
    </app-proto-channel>
  `,
})
export class VariantA {
  readonly state = input.required<ChannelState>();
  readonly mobile = input(false);
  protected readonly panel = signal<'members' | 'edit' | null>(null);
  protected readonly confirmDelete = signal(false);
  protected readonly confirmRemove = signal<Row | null>(null);

  ngOnInit() {
    this.panel.set(this.mobile() ? 'edit' : 'members');
  }
}
